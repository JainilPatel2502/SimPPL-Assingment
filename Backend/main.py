from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
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

@app.on_event("startup")
async def startup_event():
    global df
    print("Loading initial dataset...")
    # Stub for loading data - will be expanded in later commits
    try:
        if os.path.exists(DATA_PATH):
            df = pd.read_csv(DATA_PATH)
            print(f"Dataset loaded: {len(df)} rows")
    except Exception as e:
        print(f"Error loading dataset: {e}")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Core backend engine running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
