from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
import pandas as pd
import numpy as np
import networkx as nx
from datetime import date
from sklearn.cluster import KMeans
import os
import uvicorn
import traceback
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import pickle
import faiss
from nlp_analysis import extract_post_insights
from chatbot import process_chat_message
from genai_insights import generate_timeline_summary
load_dotenv()


GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

app = FastAPI(title="Investigative Social Media Analysis Dashboard")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'Data', 'epstine_submissions_merged.csv')



# Global variables
df = None
schema_context: str = ""  # cached dataset schema for the AI system prompt
semantic_model = None
post_embeddings = None



# Store faiss index globally
faiss_index = None

def init_semantic_search():
    """Initializes the dense embedding model and loads pre-computed FAISS index into memory."""
    global semantic_model, post_embeddings, faiss_index
    
    print("Initializing Dense Semantic Search with FAISS...")
    try:
        if semantic_model is None:
            # We must use the exact same model we generated embeddings with
            semantic_model = SentenceTransformer('all-MiniLM-L6-v2')
            
        if post_embeddings is None:
            emb_path = os.path.join(os.path.dirname(__file__), '..', 'Data', 'embeddings.pkl')
            with open(emb_path, 'rb') as f:
                post_embeddings = pickle.load(f)
            
            # Since vectors might not be normalized, normalize them to 1.0 length for Cosine Similarity
            # which FAISS computes natively via Inner Product (IndexFlatIP)
            vector_dim = post_embeddings.shape[1]
            faiss_index = faiss.IndexFlatIP(vector_dim)
            
            # Make a copy, enforce float32, and build the FAISS index dynamically for max speed
            normalized_embeddings = post_embeddings.copy().astype(np.float32)
            faiss.normalize_L2(normalized_embeddings)
            
            # Keep normalized pool in memory for subset-filtering speed
            post_embeddings = normalized_embeddings 
            
            faiss_index.add(normalized_embeddings)
            
            print(f"Loaded FAISS index with {faiss_index.ntotal} vectors of dimension {vector_dim}")
    except Exception as e:
        print(f"Failed to initialize semantic search. Error: {e}")
        post_embeddings = None
        faiss_index = None

def semantic_search_impl(query: str, top_k: int = 5, pre_filtered_indices=None):
    """
    Semantic search using ultra-fast FAISS Inner Product (equivalent to Cosine Similarity here).
    """
    global semantic_model, post_embeddings, faiss_index, df
    
    if semantic_model is None or faiss_index is None:
        init_semantic_search()
        
    if df is None or faiss_index is None:
        print("FAISS index or dataframe missing!")
        return pd.DataFrame() # Fallback empty
        
    # Generate vector for user query and normalize it for FAISS Cosine matching
    query_vec = semantic_model.encode([query]).astype(np.float32)
    faiss.normalize_L2(query_vec)
    
    # Check if there are active UI filters (e.g. Author=XYZ)
    # If the user filtered heavily, falling back to slicing the numpy matrix is actually 
    # faster and guarantees exactly top_k results.
    if pre_filtered_indices is not None and len(pre_filtered_indices) < len(df):
        # We only want to search a small slice of users
        subset_embeddings = post_embeddings[pre_filtered_indices]
        
        # We already normalized vectors, so dot product is mathematically purely Cosine Sim
        sims = np.dot(subset_embeddings, query_vec.T).flatten()
        
        # Sort and take top hits
        max_idx = min(len(sims), top_k)
        subset_top_indices = np.argsort(sims)[-max_idx:][::-1]
        
        # Map back to original dataframe index
        master_indices = pre_filtered_indices[subset_top_indices]
        
        results = df.iloc[master_indices].copy()
        raw_sims = sims[subset_top_indices]
        
        # Hybrid Search: Boost scores for exact keyword matches
        exact_matches = results['content_lower'].str.contains(query.lower(), na=False, regex=False)
        boosted_sims = raw_sims + (exact_matches.astype(float) * 0.15)
        
        results['similarity'] = boosted_sims
        
        # Re-sort after hybrid boost
        results = results.sort_values('similarity', ascending=False)
        return results[results['similarity'] > 0.0]
        
    else:
        # Full unfiltered search -> Unleash FAISS
        # We fetch extra results (e.g. top_k * 3) because we'll re-rank them with our Hybrid Boost
        fetch_k = min(top_k * 3, len(df))
        distances, indices = faiss_index.search(query_vec, fetch_k)
        
        # FAISS returns a 2D array, take the first row
        sims = distances[0]
        top_indices = indices[0]
        
        # Combine FAISS hits with the pandas dataframe
        results = df.iloc[top_indices].copy()
        
        # Hybrid Search: Boost scores for exact keyword matches
        exact_matches = results['content_lower'].str.contains(query.lower(), na=False, regex=False)
        boosted_sims = sims + (exact_matches.astype(float) * 0.15)
        
        results['similarity'] = boosted_sims
        
        # Re-sort after hybrid boost, then slice exactly back to top_k
        results = results.sort_values('similarity', ascending=False).head(top_k)
        
        # Filter anything with negative/garbage similarities
        results = results[results['similarity'] > 0.0]
        return results

@app.on_event("startup")
def load_data():
    global df
    print("Loading dataset into memory...")
    try:
        # We need to handle potential mixed types and missing data gracefully
        df = pd.read_csv(DATA_PATH, dtype=str)
        
        # Ensure 'content' column exists (title + selftext combined during preprocessing)
        if 'content' not in df.columns:
            df['title'] = df['title'].fillna('')
            df['selftext'] = df['selftext'].fillna('')
            df['content'] = df['title'] + " " + df['selftext']
            
        # Ensure text is lowercase for easier searching
        df['content_lower'] = df['content'].str.lower()
        
        # Convert created_utc to datetime if it exists
        if 'created_utc' in df.columns:
            # First try numeric conversion just in case there are strings that look like ints
            df['created_utc_num'] = pd.to_numeric(df['created_utc'], errors='coerce')
            df['datetime'] = pd.to_datetime(df['created_utc_num'], unit='s', errors='coerce')
            # Extract just the date for timeline aggregation
            df['date'] = df['datetime'].dt.date
            
        # Convert metrics to numeric
        for col in ['score', 'num_comments']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                
        print(f"Dataset loaded. Total records: {len(df)}")
        _build_schema_context()
        
        # Load embedding model and vectors at startup
        init_semantic_search()
    except Exception as e:
        print(f"Failed to load dataset: {e}")

def _build_schema_context():
    """Build a compact schema description of the DataFrame for the AI system prompt."""
    global schema_context
    if df is None:
        schema_context = "No dataset loaded."
        return
    lines = []
    lines.append(f"The DataFrame is named `df` and has {len(df):,} rows.")
    lines.append("\nColumns and dtypes:")
    for col, dtype in df.dtypes.items():
        lines.append(f"  - {col!r}: {dtype}")
    schema_context = "\n".join(lines)
    print("Schema context built.")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Investigative Social Media Analysis API is running."}

def _filter_dataframe(
    query: str | None = None,
    subreddit: str | None = None,
    author: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    search_mode: str = "semantic"
) -> pd.DataFrame:
    """Helper method to filter the dataframe based on query parameters."""
    if df is None:
        return pd.DataFrame()
        
    filtered_df = df.copy()
    
    # Apply date filters first
    if start_date and 'date' in filtered_df.columns:
        filtered_df = filtered_df[filtered_df['date'] >= start_date]
        
    if end_date and 'date' in filtered_df.columns:
        filtered_df = filtered_df[filtered_df['date'] <= end_date]
        
    # Apply auth/sub filters
    if subreddit:
        filtered_df = filtered_df[filtered_df['subreddit'].str.lower() == subreddit.lower()]
        
    if author:
        filtered_df = filtered_df[filtered_df['author'].str.lower() == author.lower()]
    
    # Apply query filter last (using semantic if specified)
    if query and query.strip() and len(query.strip()) > 1:
        if search_mode == "semantic":
            valid_indices = filtered_df.index.to_numpy()
            filtered_df = semantic_search_impl(query=query, top_k=1000, pre_filtered_indices=valid_indices)
        else:
            filtered_df = filtered_df[filtered_df['content_lower'].str.contains(query.lower(), na=False)]
    elif query:
        filtered_df = filtered_df[filtered_df['content_lower'].str.contains(query.lower(), na=False)]
        
    return filtered_df

@app.get("/api/topic/search")
def search_topic(
    q: str = Query(None, description="Search query string"),
    search_mode: str = Query("semantic", description="Search mode: 'keyword' or 'semantic'"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)"),
    sort_by: str = Query("score", description="Field to sort by (score, num_comments, datetime, engagement_score, semantic)"),
    order: str = Query("desc", description="Sort order (asc, desc)"),
    limit: int = Query(50, description="Max results to return"),
    offset: int = Query(0, description="Number of results to skip")
):
    """Returns top posts matching the query with sorting and pagination."""
    
    # 1. Base Filter (Without Query string first, so we get index context)
    start_dt = pd.to_datetime(start_date) if start_date else None
    end_dt = pd.to_datetime(end_date) if end_date else None
    filtered_df = _filter_dataframe(query=None, subreddit=subreddit, author=author, start_date=start_dt, end_date=end_dt, search_mode="keyword")
    
    if len(filtered_df) == 0:
        return {"total_matches": 0, "results": []}
        
    # 2. Execute Search
    if q and q.strip() and len(q.strip()) > 1:
        
        if search_mode == "keyword":
            # Pure Keyword Search
            filtered_df = filtered_df[filtered_df['content_lower'].str.contains(q.lower(), na=False)]
            # In keyword mode, we do NOT override sorting. It can stick to default score.
        else:
            # Semantic / Hybrid Search
            valid_indices = filtered_df.index.to_numpy()
            semantic_results = semantic_search_impl(query=q, top_k=limit + offset, pre_filtered_indices=valid_indices)
            
            # Override the filtered_df with the semantic payload results and set default sorting.
            if len(semantic_results) > 0:
                filtered_df = semantic_results
                if sort_by == "score": # If the user hasn't explicitly clicked a table header and default state is 'score', we override the UI to use 'semantic'.
                    sort_by = "similarity"
            else:
                filtered_df = filtered_df.head(0) # Emptied out
            
    elif q:
        # Edge Case handler for weird stuff (empty string, 1 character)
        filtered_df = filtered_df[filtered_df['content_lower'].str.contains(q.lower(), na=False)]

    # Calculate Engagement Score if needed
    if sort_by == 'engagement_score' or 'engagement_score' in filtered_df.columns:
        filtered_df['engagement_score'] = filtered_df['score'] + filtered_df['num_comments']

    # Sort the dataframe
    if sort_by in filtered_df.columns:
        ascending = (order == "asc")
        filtered_df = filtered_df.sort_values(by=sort_by, ascending=ascending)
        
    # Apply pagination
    paginated_df = filtered_df.iloc[offset : offset + limit]
    
    results = paginated_df.to_dict(orient='records')
    
    # Clean NaN values which JSON can't serialize
    cleaned_results = []
    for row in results:
        clean_row = {k: (v if pd.notna(v) else None) for k, v in row.items()}
        cleaned_results.append(clean_row)
        
    return {"total_matches": len(filtered_df), "results": cleaned_results}
    
@app.get("/api/topic/timeline")
def get_timeline(
    q: str = Query(None, description="Search query string"),
    search_mode: str = Query("semantic", description="Search mode: 'keyword' or 'semantic'"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)")
):
    """Returns the time series of posts per day."""
    filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date, search_mode=search_mode)
    
    if 'date' not in filtered_df.columns or len(filtered_df) == 0:
        return []
        
    # Group by date and count
    timeline = filtered_df.groupby('date').size().reset_index(name='count')
    # Sort by date
    timeline = timeline.sort_values('date')
    
    # Format for JSON response
    results = [
        {"date": row['date'].isoformat(), "count": row['count']}
        for _, row in timeline.iterrows() if pd.notna(row['date'])
    ]
    
    return results

@app.get("/api/topic/timeline/summary")
def get_timeline_summary(
    q: str = Query(None, description="Search query string"),
    search_mode: str = Query("semantic", description="Search mode: 'keyword' or 'semantic'"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)")
):
    """Returns AI-generated narrative summary of the timeline."""
    # Build timeline directly using get_timeline
    timeline_results = get_timeline(q, search_mode, subreddit, author, start_date, end_date)
    
    if not timeline_results or len(timeline_results) == 0:
        return {"summary": "No data available to summarize."}
        
    topic_description = f"topic '{q}'" if q else (f"subreddit {subreddit}" if subreddit else (f"user {author}" if author else "the whole dataset"))
    summary = generate_timeline_summary(timeline_results, api_key=OPENAI_API_KEY, topic=topic_description)
    
    return {"summary": summary}

@app.get("/api/topic/subreddits")
def get_subreddits(
    q: str = Query(None, description="Search query string"),
    search_mode: str = Query("semantic", description="Search mode: 'keyword' or 'semantic'"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(20, description="Number of top subreddits to return")
):
    """Returns the top subreddits discussing the topic."""
    filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date, search_mode=search_mode)
    
    if 'subreddit' not in filtered_df.columns or len(filtered_df) == 0:
        return []
        
    # Group by subreddit and count
    top_subs = filtered_df.groupby('subreddit').size().reset_index(name='count')
    top_subs = top_subs.sort_values('count', ascending=False).head(limit)
    
    results = top_subs.to_dict(orient='records')
    return results

@app.get("/api/topic/domains")
def get_domains(
    q: str = Query(None, description="Search query string"),
    search_mode: str = Query("semantic", description="Search mode: 'keyword' or 'semantic'"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(20, description="Number of top domains to return")
):
    """Returns the top domains shared in the topic."""
    filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date, search_mode=search_mode)
    
    if 'domain' not in filtered_df.columns or len(filtered_df) == 0:
        return []
        
    # Filter out empty or common reddit domains if needed
    domain_df = filtered_df[filtered_df['domain'].notna() & (filtered_df['domain'] != '')]
    
    # Exclude internal reddit domains to focus on external sources
    internal_domains = ['reddit.com', 'i.redd.it', 'v.redd.it', 'self.Epstein', 'self.conspiracy']
    domain_df = domain_df[~domain_df['domain'].isin(internal_domains)]
    # Also exclude implicit self posts
    domain_df = domain_df[~domain_df['domain'].str.startswith('self.', na=False)]
    
    top_domains = domain_df.groupby('domain').size().reset_index(name='count')
    top_domains = top_domains.sort_values('count', ascending=False).head(limit)
    
    return top_domains.to_dict(orient='records')

@app.get("/api/topic/authors")
def get_authors(
    q: str = Query(None, description="Search query string"),
    search_mode: str = Query("semantic", description="Search mode: 'keyword' or 'semantic'"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(20, description="Number of top authors to return")
):
    """Returns the most active authors discussing the topic."""
    
    if author:
        # Instead of just returning the user, find Co-Active Actors.
        base_df = _filter_dataframe(query=q, subreddit=subreddit, author=None, start_date=start_date, end_date=end_date, search_mode=search_mode)
        if 'author' not in base_df.columns or len(base_df) == 0:
            return []
            
        # Get target user's subreddits and domains
        target_posts = base_df[base_df['author'].notna() & (base_df['author'].str.lower() == author.lower())]
        target_subs = target_posts['subreddit'].dropna().unique()
        
        # Consider domains, but filter out standard internal ones
        internal_domains = ['reddit.com', 'i.redd.it', 'v.redd.it', 'self.Epstein', 'self.conspiracy']
        if 'domain' in target_posts.columns:
            target_domains = target_posts['domain'].dropna()
            target_domains = target_domains[~target_domains.isin(internal_domains) & ~target_domains.str.startswith('self.')].unique()
        else:
            target_domains = []
            
        # Find co-actors (other users sharing same subreddits or domains)
        co_actors_df = base_df[
            base_df['author'].notna() &
            (base_df['author'] != '[deleted]') &
            (base_df['author'].str.lower() != author.lower())
        ]
        
        if len(target_domains) > 0:
            co_actors_df = co_actors_df[
                co_actors_df['subreddit'].isin(target_subs) | 
                (co_actors_df.get('domain', pd.Series()).isin(target_domains))
            ]
        else:
            co_actors_df = co_actors_df[co_actors_df['subreddit'].isin(target_subs)]
            
        author_df = co_actors_df
    else:
        # Normal behavior for top authors overall
        filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date, search_mode=search_mode)
        if 'author' not in filtered_df.columns or len(filtered_df) == 0:
            return []
        
        # Filter out deleted authors
        author_df = filtered_df[filtered_df['author'].notna() & (filtered_df['author'] != '[deleted]')]
    
    if len(author_df) == 0:
        return []
    top_authors = author_df.groupby('author').size().reset_index(name='count')
    top_authors = top_authors.sort_values('count', ascending=False).head(limit)
    
    return top_authors.to_dict(orient='records')

@app.get("/api/topic/network")
def get_network(
    q: str = Query(None, description="Search query string"),
    search_mode: str = Query("semantic", description="Search mode: 'keyword' or 'semantic'"),
    subreddit: str = Query(None, description="Subreddit to search in"),
    author: str = Query(None, description="Author to search for"),
    start_date: date = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(None, description="End date (YYYY-MM-DD)"),
    limit_nodes: int = Query(100, description="Max nodes to return")
):
    """
    Returns a network graph representing Author -> Subreddit connections.
    Format is suitable for react-force-graph: { "nodes": [], "links": [] }
    """
    filtered_df = _filter_dataframe(query=q, subreddit=subreddit, author=author, start_date=start_date, end_date=end_date, search_mode=search_mode)
    
    required_cols = ['author', 'subreddit']
    if not all(col in filtered_df.columns for col in required_cols) or len(filtered_df) == 0:
        return {"nodes": [], "links": []}
        
    # Filter valid connections
    valid_df = filtered_df[
        filtered_df['author'].notna() & 
        (filtered_df['author'] != '[deleted]') & 
        filtered_df['subreddit'].notna() & 
        (filtered_df['subreddit'] != '')
    ]
    
    # Get top edges
    edges = valid_df.groupby(['author', 'subreddit']).size().reset_index(name='weight')
    edges = edges.sort_values('weight', ascending=False).head(limit_nodes * 2)
    
    nodes_dict = {}
    links = []
    
    for _, row in edges.iterrows():
        author_id = f"author_{row['author']}"
        subreddit_id = f"sub_{row['subreddit']}"
        
        if author_id not in nodes_dict:
            nodes_dict[author_id] = {"id": author_id, "name": row['author'], "group": 1} # 1 for Author
            
        if subreddit_id not in nodes_dict:
            nodes_dict[subreddit_id] = {"id": subreddit_id, "name": f"r/{row['subreddit']}", "group": 2} # 2 for Subreddit
            
        links.append({
            "source": author_id,
            "target": subreddit_id,
            "value": int(row['weight'])
        })
        
    nodes = list(nodes_dict.values())
    
    # Calculate Betweenness Centrality using NetworkX
    G = nx.Graph()
    for link in links:
        G.add_edge(link["source"], link["target"], weight=link["value"])
        
    try:
        centrality = nx.betweenness_centrality(G) # Unweighted represents structural bridging
        for node in nodes:
            node["centrality"] = centrality.get(node["id"], 0)
    except Exception as e:
        print(f"Error calculating centrality: {e}")
        for node in nodes:
            node["centrality"] = 0
            
    # Cap total nodes if needed
    if len(nodes) > limit_nodes:
        # Sort nodes by centrality, then trim to keep the most central/important components
        nodes = sorted(nodes, key=lambda x: x.get("centrality", 0), reverse=True)[:limit_nodes]
        valid_node_ids = {n['id'] for n in nodes}
        links = [l for l in links if l['source'] in valid_node_ids and l['target'] in valid_node_ids]
        
    return {"nodes": nodes, "links": links}

@app.get("/api/topic/clusters")
def get_clusters(
    n_clusters: int = Query(5, description="Number of clusters to generate via KMeans", ge=2, le=20),
    limit: int = Query(2000, description="Max points to return for 3D rendering")
):
    """
    Returns 3D coordinates for posts, clustered dynamically.
    """
    if df is None or len(df) == 0:
        return []
        
    working_df = df.copy()

    # Drop null coordinates
    valid_df = working_df.dropna(subset=['umap_x', 'umap_y', 'umap_z'])
    if len(valid_df) == 0:
        return []
        
    # Cap size for webgl performance
    if len(valid_df) > limit:
        valid_df = valid_df.sample(n=limit, random_state=42).copy()
    else:
        valid_df = valid_df.copy()
        
    # Run Lightning-Fast KMeans on the 3D coords
    coords = valid_df[['umap_x', 'umap_y', 'umap_z']].values
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
    valid_df['cluster'] = kmeans.fit_predict(coords)
    
    # Select columns to send to frontend
    cols_to_keep = ['author', 'subreddit', 'title', 'umap_x', 'umap_y', 'umap_z', 'cluster', 'score']
    # Filter safely
    cols_to_keep = [c for c in cols_to_keep if c in valid_df.columns]
    
    # Fill NaN values with empty string or 0 before converting to dict
    result_df = valid_df[cols_to_keep].fillna('')
    if 'score' in result_df.columns:
         result_df['score'] = pd.to_numeric(result_df['score'], errors='coerce').fillna(0)
    
    results = result_df.to_dict(orient='records')
    return results

@app.get("/api/topic/datamapplot")
def generate_datamapplot_view(
    n_clusters: int = Query(8, description="Number of clusters to generate via KMeans", ge=2, le=50)
):
    """
    Generates a full interactive Datamapplot HTML and serves it.
    Fulfills the ML embedding visualization mandate.
    """
    try:
        import datamapplot
    except ImportError:
        return HTMLResponse("<h2>Error: datamapplot is not installed.</h2><p>Please stop your backend server and run: <code>pip install datamapplot umap-learn</code> and restart.</p>")
        
    if df is None or len(df) == 0:
        return HTMLResponse("<p>Dataset not loaded.</p>")
        
    working_df = df.copy()
    valid_df = working_df.dropna(subset=['umap_x', 'umap_y'])
    if len(valid_df) == 0:
        return HTMLResponse("<p>No 2D UMAP coordinates found in dataset.</p>")
        
    # Cap size for fast HTML generation
    if len(valid_df) > 8000:
        valid_df = valid_df.sample(n=8000, random_state=42).copy()
    else:
        valid_df = valid_df.copy()
        
    coords = valid_df[['umap_x', 'umap_y']].to_numpy(dtype=np.float32)
    
    # We need text labels for the clusters so datamapplot colors them
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
    cluster_ids = kmeans.fit_predict(coords)
    labels = np.array([f"Narrative Cluster {i+1}" for i in cluster_ids])
    
    # Clean text for HTML hovering
    def clean_text(sr, title):
        c_sr = str(sr).replace('"', '').replace("'", "")
        c_ti = str(title).replace('"', '').replace("'", "")
        return f"r/{c_sr} - {c_ti}"
        
    hover_text = valid_df.apply(lambda row: clean_text(row.get('subreddit',''), row.get('title','')), axis=1).tolist()
    
    output_path = os.path.join(os.path.dirname(__file__), "datamap_export.html")
    
    try:
        plot = datamapplot.create_interactive_plot(
            coords,
            labels,
            hover_text=hover_text,
            title="TRACE · Investigation Datamapplot",
            enable_search=True
        )
        plot.save(output_path)
        
        with open(output_path, "r", encoding="utf-8") as f:
            html_content = f.read()
            
        return HTMLResponse(content=html_content)
    except Exception as e:
        return HTMLResponse(f"<h2>Error generating Datamapplot</h2><p>{str(e)}</p>")

# ─── CHATBOT ──────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    text: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

class ChatResponse(BaseModel):
    answer: str
    code: str | None = None
    raw_result: str | None = None

class PostAnalyzeRequest(BaseModel):
    title: str
    content: str

class PostAnalysisResponse(BaseModel):
    sentiment: str | None = None
    entities: list[str] | None = None
    narrative: str | None = None
    name_calling: str | None = None
    doubt_credibility: str | None = None
    error: str | None = None
    
@app.post("/api/post/analyze", response_model=PostAnalysisResponse)
async def analyze_post(req: PostAnalyzeRequest):
    return extract_post_insights(req.title, req.content, OPENAI_API_KEY)

def _run_query(code: str) -> str:
    """Execute AI-generated pandas code and return string representation of result."""
    print(f"\n[DEBUG main.py] Incoming code from AI to run:\n{code}\n")
    if not code or not code.strip():
        return "Error: No code provided to execute."
        
    if df is None:
        return "Error: Dataset not loaded."
        
    namespace = {"df": df, "pd": pd, "np": np, "semantic_search": semantic_search_impl, "result": None}
    initial_keys = set(namespace.keys())
    
    try:
        exec(code, namespace)  # noqa: S102
        result = namespace.get("result")
        print(f"[DEBUG main.py] Result after exec: {type(result)}")
        
        if result is None:
            # Determine newly created variables
            new_keys = [k for k in namespace.keys() if k not in initial_keys and not k.startswith('_')]
            if new_keys:
                last_key = new_keys[-1]
                result = namespace[last_key]
                print(f"[DEBUG main.py] Automatically grabbed result from newly assigned variable '{last_key}'.")
            else:
                # Fallback: maybe they just passed an expression directly without assigning
                try:
                    result = eval(code, namespace)
                    print("[DEBUG main.py] Evaluated as expression successfully.")
                except Exception as e:
                    err_msg = f"Error: Code ran but `result` was not assigned and code was not a valid expression. Eval error: {e}"
                    print(f"[DEBUG main.py] {err_msg}")
                    return err_msg
        
        # Process result for JSON serialization
        if hasattr(result, "tolist"):  # Convert numpy arrays (like from .unique()) to lists
            result = result.tolist()
            print("[DEBUG main.py] Converted numpy array to list.")

        if isinstance(result, pd.DataFrame):
            ret = result.head(20).to_json(orient="records")
            print(f"[DEBUG main.py] Returning DataFrame JSON: {ret[:100]}...")
            return ret
        if isinstance(result, pd.Series):
            ret = result.head(20).to_json()
            print(f"[DEBUG main.py] Returning Series JSON: {ret[:100]}...")
            return ret
            
        import json
        try:
            ret = json.dumps(result, default=str)
            print(f"[DEBUG main.py] Returning JSON dumps: {ret[:100]}...")
            return ret
        except Exception as e:
            print(f"[DEBUG main.py] JSON dump failed: {e}. Falling back to str().")
            return str(result)
    except Exception as e:
        err = f"Execution error:\n{traceback.format_exc(limit=3)}"
        print(f"[DEBUG main.py] {err}")
        return err

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    return process_chat_message(
        message=req.message,
        history=req.history,
        api_key=OPENAI_API_KEY,
        schema_context=schema_context,
        query_callback=_run_query
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
