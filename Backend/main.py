from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import pandas as pd
from pydantic import BaseModel
import numpy as np
import os
import traceback
import networkx as nx
from datetime import date
from sklearn.cluster import KMeans
import uvicorn
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from nlp_analysis import extract_post_insights
from chatbot import process_chat_message
from genai_insights import generate_timeline_summary

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

app = FastAPI(title="Investigative Social Media Analysis Dashboard")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'Data', 'epstine_submissions_merged.csv')
df = None

def _filter_dataframe(query=None, subreddit=None, author=None, start_date=None, end_date=None):
    if df is None:
        return pd.DataFrame()
    filtered_df = df.copy()
    if query:
        filtered_df = filtered_df[filtered_df['content'].str.contains(query, case=False, na=False) | filtered_df['title'].str.contains(query, case=False, na=False)]
    if subreddit:
        filtered_df = filtered_df[filtered_df['subreddit'] == subreddit]
    if author:
        filtered_df = filtered_df[filtered_df['author'] == author]
    return filtered_df

@app.on_event("startup")
async def startup_event():
    global df
    global schema_context
    print("Loading initial dataset...")
    try:
        if os.path.exists(DATA_PATH):
            df = pd.read_csv(DATA_PATH)
            # First try numeric conversion just in case there are strings that look like ints
            df['created_utc_num'] = pd.to_numeric(df['created_utc'], errors='coerce')
            df['datetime'] = pd.to_datetime(df['created_utc_num'], unit='s', errors='coerce')
            # Extract just the date for timeline aggregation
            df['date'] = df['datetime'].dt.date
            print(f"Dataset loaded: {len(df)} rows")
            
            # Build schema context for the AI
            col_info = []
            for col in df.columns:
                if df[col].dtype == 'object':
                    unique_vals = df[col].dropna().unique()
                    if len(unique_vals) < 10:
                        col_info.append(f"- {col} (categorical): e.g., {', '.join(map(str, unique_vals[:5]))}")
                    else:
                        col_info.append(f"- {col} (text)")
                else:
                    col_info.append(f"- {col} (numeric): min={df[col].min()}, max={df[col].max()}")
            schema_context = "\n".join(col_info)
    except Exception as e:
        print(f"Error loading dataset: {e}")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Core backend engine running"}

@app.get("/api/topic/timeline")
def get_timeline(
    q: str = Query(None, description="Search query string"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)")
):
    """Returns the time series of posts per day."""
    filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date)
    if 'date' not in filtered_df.columns or len(filtered_df) == 0:
        return []
    # Group by date and count
    timeline = filtered_df.groupby('date').size().reset_index(name='count')
    # Sort by date
    timeline = timeline.sort_values('date')
    results = [
        {"date": row['date'].isoformat(), "count": row['count']}
        for _, row in timeline.iterrows() if pd.notna(row['date'])
    ]
    return results

@app.get("/api/topic/network")
def get_network(
    q: str = Query(None, description="Search query string"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)"),
    limit_nodes: int = Query(100, description="Max nodes to return")
):
    """Returns a network graph representing Author -> Subreddit connections."""
    filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date)
    
    required_cols = ['author', 'subreddit']
    if not all(col in filtered_df.columns for col in required_cols) or len(filtered_df) == 0:
        return {"nodes": [], "links": []}

    # Simplistic graph building for the initial mock commit
    nodes_dict = {}
    links_dict = {}
    
    # Process edges
    for _, row in filtered_df.head(limit_nodes).iterrows():
        a = str(row['author'])
        s = str(row['subreddit'])
        if pd.isna(a) or pd.isna(s) or a == 'nan' or s == 'nan': continue
        
        a_id = f"author_{a}"
        s_id = f"sub_{s}"
        
        nodes_dict[a_id] = {"id": a_id, "label": a, "group": "author", "centrality": 0}
        nodes_dict[s_id] = {"id": s_id, "label": s, "group": "subreddit", "centrality": 0}
        
        edge_id = f"{a_id}-{s_id}"
        if edge_id not in links_dict:
            links_dict[edge_id] = {"source": a_id, "target": s_id, "value": 1}
        else:
            links_dict[edge_id]["value"] += 1
            
    nodes = list(nodes_dict.values())
    links = list(links_dict.values())
    
    # Calculate basic Betweenness Centrality
    G = nx.Graph()
    for link in links:
        G.add_edge(link["source"], link["target"], weight=link["value"])
    try:
        centrality = nx.betweenness_centrality(G)
        for node in nodes:
            node["centrality"] = centrality.get(node["id"], 0)
    except Exception as e:
        pass
        
    return {"nodes": nodes, "links": links}

@app.get("/api/topic/clusters")
def get_clusters(
    n_clusters: int = Query(5, description="Number of clusters to generate via KMeans", ge=2, le=20),
    limit: int = Query(2000, description="Max points to return for 3D rendering")
):
    """Returns 3D coordinates for posts, clustered dynamically via KMeans."""
    if df is None or len(df) == 0:
        return []
    working_df = df.copy()

    # Drop null coordinates
    if 'umap_x' not in working_df.columns or 'umap_y' not in working_df.columns:
        return []
        
    valid_df = working_df.dropna(subset=['umap_x', 'umap_y', 'umap_z'])
    if len(valid_df) == 0:
        return []

    # Cap size for WebGL performance
    if len(valid_df) > limit:
        valid_df = valid_df.sample(n=limit, random_state=42).copy()

    # Run Lightning-Fast KMeans on the 3D coords
    coords = valid_df[['umap_x', 'umap_y', 'umap_z']].values
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
    valid_df['cluster'] = kmeans.fit_predict(coords)

    # Select columns to send to frontend
    cols_to_keep = ['author', 'subreddit', 'title', 'umap_x', 'umap_y', 'umap_z', 'cluster', 'score']
    cols_to_keep = [c for c in cols_to_keep if c in valid_df.columns]

    result_df = valid_df[cols_to_keep].fillna('')
    if 'score' in result_df.columns:
        result_df['score'] = pd.to_numeric(result_df['score'], errors='coerce').fillna(0)

    return result_df.to_dict(orient='records')

@app.get("/api/topic/search")
def search_posts(
    q: str = Query(None, description="Search query string"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)"),
    page: int = Query(1, description="Page number", ge=1),
    limit: int = Query(10, description="Results per page", ge=1, le=100)
):
    """Basic keyword search endpoint."""
    filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date)
    
    if len(filtered_df) == 0:
        return {"total_matches": 0, "results": []}
        
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_df = filtered_df.iloc[start_idx:end_idx]
    
    results = paginated_df.to_dict(orient='records')
    # Run simple NLP insights locally on the loaded page
    cleaned_results = []
    for r in results:
        r_clean = {k: ('' if pd.isna(v) else v) for k, v in r.items()}
        insights = extract_post_insights(str(r_clean.get('title', '')) + " " + str(r_clean.get('content', '')))
        r_clean['nlp_insights'] = insights
        cleaned_results.append(r_clean)
        
    return {"total_matches": len(filtered_df), "results": cleaned_results}

class ChatRequest(BaseModel):
    message: str
    history: list[dict]

class ChatResponse(BaseModel):
    response: str
    error: str = None

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    return process_chat_message(
        message=req.message,
        history=req.history,
        api_key=OPENAI_API_KEY,
        schema_context=schema_context,
        query_callback=None
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)