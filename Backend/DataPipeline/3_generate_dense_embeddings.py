import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
import os
import pickle

def main():
    data_path = '../Data/epstine_submissions_merged.csv'
    output_embeddings_path = '../Data/embeddings.pkl'
    
    print(f"Loading data from {data_path}...")
    
    # Read the dataset
    df = pd.read_csv(data_path, dtype=str)
    
    # Ensure content exists
    df['title'] = df['title'].fillna('')
    df['selftext'] = df['selftext'].fillna('')
    df['content'] = df['title'] + " " + df['selftext']
    
    # Drop empty content to match what we did before
    # Important: we need to keep the index aligned with the CSV rows!
    df['content'] = df['content'].str.strip()
    
    print("Loading SentenceTransformer model ('all-MiniLM-L6-v2')...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    print("Generating dense embeddings for ALL rows... (This may take a few minutes)")
    sentences = df['content'].tolist()
    
    # Compute embeddings
    embeddings = model.encode(sentences, show_progress_bar=True)
    print(f"Embeddings shape: {embeddings.shape}")
    
    print(f"Saving high-dimensional embeddings to {output_embeddings_path}...")
    # Saving as a pickle numpy array so the backend can load it instantly into memory
    with open(output_embeddings_path, 'wb') as f:
        pickle.dump(embeddings, f)
        
    print("Done! You can now use `embeddings.pkl` in the backend for true semantic search.")

if __name__ == "__main__":
    main()
