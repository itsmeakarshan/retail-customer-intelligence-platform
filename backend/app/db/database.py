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

def is_valid_sqlite_db(path: str) -> bool:
    """Checks if a SQLite database file exists, is non-empty, and passes integrity check."""
    if not path or not os.path.exists(path) or os.path.getsize(path) < 5 * 1024 * 1024:
        return False
    try:
        import sqlite3
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        c = conn.cursor()
        c.execute("PRAGMA quick_check;")
        row = c.fetchone()
        conn.close()
        return row is not None and row[0] == "ok"
    except Exception:
        return False

def resolve_db_path() -> str:
    """
    Resolves the SQLite database path for local development and containerized environments.
    If compressed database files are present, they are extracted to /tmp/retail_analytics.db.
    """
    env_db = os.getenv("DATABASE_PATH")
    if env_db and is_valid_sqlite_db(env_db):
        return env_db

    tmp_db_path = "/tmp/retail_analytics.db"

    # If /tmp/retail_analytics.db already exists and passes quick_check, return it immediately
    if is_valid_sqlite_db(tmp_db_path):
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
                # Atomic extraction to /tmp using unique PID tempfile
                tmp_part_path = f"{tmp_db_path}.{os.getpid()}.part"
                try:
                    with gzip.open(cand, "rb") as f_in:
                        with open(tmp_part_path, "wb") as f_out:
                            shutil.copyfileobj(f_in, f_out)
                    if is_valid_sqlite_db(tmp_part_path):
                        os.replace(tmp_part_path, tmp_db_path)
                        return tmp_db_path
                    else:
                        if os.path.exists(tmp_part_path):
                            os.remove(tmp_part_path)
                except Exception as e:
                    print(f"[DB] Extraction error from {cand}: {e}")
                    if os.path.exists(tmp_part_path):
                        try:
                            os.remove(tmp_part_path)
                        except Exception:
                            pass
            else:
                # If uncompressed file exists and is valid
                if is_valid_sqlite_db(cand):
                    # In serverless/read-only mode, copy to /tmp for write access
                    try:
                        shutil.copyfile(cand, tmp_db_path)
                        if is_valid_sqlite_db(tmp_db_path):
                            return tmp_db_path
                    except Exception:
                        pass
                    return cand

    # Default fallback for fresh local setups
    local_default = os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db")
    try:
        os.makedirs(os.path.dirname(local_default), exist_ok=True)
    except Exception:
        return tmp_db_path
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

