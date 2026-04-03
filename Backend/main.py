from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import networkx as nx
from datetime import date
import uvicorn
from contextlib import asynccontextmanager

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)