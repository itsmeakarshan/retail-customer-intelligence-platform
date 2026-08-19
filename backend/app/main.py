"""
FastAPI Main Application Entrypoint
"""
import sys
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure workspace root and backend directory are in python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
for p in [PROJECT_ROOT, BACKEND_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Load environment variables from root .env file
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

if not __package__:
    if os.path.exists(os.path.join(PROJECT_ROOT, "backend")):
        __package__ = "backend.app"
    else:
        __package__ = "app"


from .api.endpoints import router as api_router
from .services.synthetic_generator import init_synthetic_tables
from .services.retail_intelligence_service import retail_intelligence_service
from .db.database import SessionLocal, init_indexes

app = FastAPI(
    title="Customer Intelligence & Revenue Risk Platform API",
    description="End-to-End Production Data Science API for Churn, Value Prediction & Revenue-at-Risk Analytics",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    try:
        init_synthetic_tables()
    except Exception as e:
        print(f"[Startup Notice] init_synthetic_tables: {e}")

    try:
        init_indexes()
    except Exception as e:
        print(f"[Startup Notice] init_indexes: {e}")

    try:
        db = SessionLocal()
        try:
            retail_intelligence_service.warm_up_cache(db=db)
        finally:
            db.close()
    except Exception as e:
        print(f"[Startup Notice] warm_up_cache: {e}")

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
    app_target = "backend.app.main:app" if os.path.exists(os.path.join(PROJECT_ROOT, "backend")) else "app.main:app"
    uvicorn.run(app_target, host="0.0.0.0", port=8000, reload=True)
