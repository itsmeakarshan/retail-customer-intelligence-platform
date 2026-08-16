"""
FastAPI Main Application Entrypoint
"""
import sys
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure workspace root is in python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load environment variables from root .env file
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from backend.app.api.endpoints import router as api_router
from backend.app.services.synthetic_generator import init_synthetic_tables
from backend.app.services.retail_intelligence_service import retail_intelligence_service
from backend.app.db.database import SessionLocal

app = FastAPI(
    title="Customer Intelligence & Revenue Risk Platform API",
    description="End-to-End Production Data Science API for Churn, Value Prediction & Revenue-at-Risk Analytics",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    init_synthetic_tables()
    db = SessionLocal()
    try:
        retail_intelligence_service.warm_up_cache(db=db)
    finally:
        db.close()

# Enable CORS for local React Frontend (Vite default port 5173 / 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Customer Intelligence & Revenue Risk Platform API",
        "docs": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
