import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
import umap
import os

def main():
    data_path = '../Data/epstine_submissions_merged.csv'
    print(f"Loading data from {data_path}...")
    
    # Read the dataset
    df = pd.read_csv(data_path, dtype=str)
    
    # Ensure content exists
    df['title'] = df['title'].fillna('')
    df['selftext'] = df['selftext'].fillna('')
    df['content'] = df['title'] + " " + df['selftext']
    
    # We drop empty content
    df = df[df['content'].str.strip() != '']
    
    print(f"Total valid records for embedding: {len(df)}")
    
    # Step 1: Generate High-Dimensional Embeddings
    print("Loading SentenceTransformer model ('all-MiniLM-L6-v2')...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    print("Generating embeddings... (This may take a few minutes)")
    # Convert content to list
    sentences = df['content'].tolist()
    # Compute embeddings
    embeddings = model.encode(sentences, show_progress_bar=True)
    
    print(f"Embeddings shape: {embeddings.shape}")
    
    # Step 2: Reduce to 3D using UMAP
    print("Fitting UMAP to reduce 384 dimensions to 3 dimensions...")
    # Using n_neighbors=15 and min_dist=0.1 as general defaults for text clusters
    reducer = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, random_state=42)
    embeddings_3d = reducer.fit_transform(embeddings)
    
    # Step 3: Append coordinates to DataFrame and save
    df['umap_x'] = embeddings_3d[:, 0]
    df['umap_y'] = embeddings_3d[:, 1]
    df['umap_z'] = embeddings_3d[:, 2]
    
    print("Saving processed data back to CSV...")
    df.to_csv(data_path, index=False)
    print("Done! You can now run the backend with 3D cluster support.")

if __name__ == "__main__":
    main()
