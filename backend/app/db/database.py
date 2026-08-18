"""
Backend Database Configuration
Connects SQLite database data/processed/retail_analytics.db via SQLAlchemy
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import gzip
import shutil

# Path relative to workspace root or environment override
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

def resolve_db_path() -> str:
    """
    Resolves the SQLite database path for local development and Vercel serverless environments.
    In serverless / read-only filesystem environments (like Vercel/AWS Lambda),
    the SQLite database is extracted/copied to /tmp/retail_analytics.db so that SQLite has full read/write access.
    """
    env_db = os.getenv("DATABASE_PATH")
    if env_db:
        return env_db

    is_serverless = (
        os.getenv("VERCEL") == "1"
        or os.getenv("AWS_LAMBDA_FUNCTION_NAME") is not None
        or not os.access(os.path.dirname(__file__), os.W_OK)
    )
    tmp_db_path = "/tmp/retail_analytics.db"

    # If /tmp/retail_analytics.db already exists and is non-empty, use it
    if os.path.exists(tmp_db_path) and os.path.getsize(tmp_db_path) > 1024 * 1024:
        return tmp_db_path

    # Candidate source files (uncompressed and compressed .gz)
    source_candidates = [
        os.path.join(BACKEND_ROOT, "data/retail_analytics.db.gz"),
        os.path.join(BACKEND_ROOT, "data/processed/retail_analytics.db.gz"),
        os.path.join(PROJECT_ROOT, "data/retail_analytics.db.gz"),
        os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db.gz"),
        os.path.join(BACKEND_ROOT, "data/processed/retail_analytics.db"),
        os.path.join(BACKEND_ROOT, "retail_analytics.db"),
        os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db"),
        "data/processed/retail_analytics.db",
    ]

    for cand in source_candidates:
        if os.path.exists(cand):
            if cand.endswith(".gz"):
                target_path = tmp_db_path if is_serverless else os.path.join(os.path.dirname(cand), "retail_analytics.db")
                try:
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    if not os.path.exists(target_path) or os.path.getsize(target_path) < 1024 * 1024:
                        with gzip.open(cand, "rb") as f_in:
                            with open(target_path, "wb") as f_out:
                                shutil.copyfileobj(f_in, f_out)
                    return target_path
                except Exception as e:
                    print(f"[DB] Error extracting compressed DB from {cand}: {e}")
            else:
                if is_serverless:
                    try:
                        shutil.copyfile(cand, tmp_db_path)
                        return tmp_db_path
                    except Exception as e:
                        print(f"[DB] Error copying DB to /tmp from {cand}: {e}")
                        return cand
                return cand

    # Default fallback for fresh local setups
    local_default = os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db")
    os.makedirs(os.path.dirname(local_default), exist_ok=True)
    return local_default

DB_PATH = resolve_db_path()
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_indexes():
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trans_stock ON transactions(stock_code);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trans_cust ON transactions(customer_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cust_churn ON customers(churn_probability);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cust_seg ON customers(segment_name);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pdemo_expiry ON product_demo_metadata(expiry_status);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pdemo_stock ON product_demo_metadata(stock_code);"))
            conn.commit()
    except Exception as e:
        print(f"Index creation notice: {e}")

