"""
Backend Database Configuration
Connects SQLite database data/processed/retail_analytics.db via SQLAlchemy
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Path relative to workspace root or environment override
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
DB_PATH = os.getenv("DATABASE_PATH", os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db"))
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

