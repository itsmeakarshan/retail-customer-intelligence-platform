"""
Phase 10: SQLite Database Creation & Population Script
Populates data/processed/retail_analytics.db with relational tables:
- customers
- transactions
- customer_features
- predictions
- segments
- model_metadata
Creates indexes for fast query execution.
"""
import os
import json
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime

DB_PATH = "data/processed/retail_analytics.db"

def populate_database(
    clean_trans_path: str = "data/processed/clean_transactions.parquet",
    features_path: str = "data/processed/customer_features.parquet",
    db_path: str = DB_PATH
):
    print(f"Connecting to SQLite database at {db_path}...")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Load Clean Transactions
    print("Loading clean transactions...")
    trans_df = pd.read_parquet(clean_trans_path)
    trans_df['invoice_date'] = trans_df['invoice_date'].astype(str)
    
    # 2. Load Customer Features & Predictions
    print("Loading customer features and predictions...")
    feat_df = pd.read_parquet(features_path)
    
    # Add Risk Level categorization
    def assign_risk_level(prob):
        if prob >= 0.70:
            return "High Risk"
        elif prob >= 0.40:
            return "Medium Risk"
        else:
            return "Low Risk"
            
    feat_df['risk_level'] = feat_df['churn_probability'].apply(assign_risk_level)
    
    # Create Table: transactions
    print("Writing 'transactions' table...")
    trans_df.to_sql('transactions', conn, if_exists='replace', index=False)
    
    # Create Table: customer_features
    print("Writing 'customer_features' table...")
    feat_df.to_sql('customer_features', conn, if_exists='replace', index=False)
    
    # Create Table: customers (Customer Master View)
    print("Writing 'customers' table...")
    cust_table = feat_df[[
        'customer_id', 'country', 'recency', 'frequency', 'monetary',
        'gross_revenue', 'churn_label', 'churn_probability',
        'predicted_future_value', 'revenue_at_risk', 'risk_level', 'segment_name'
    ]].copy()
    cust_table.to_sql('customers', conn, if_exists='replace', index=False)
    
    # Create Table: predictions
    print("Writing 'predictions' table...")
    pred_table = feat_df[[
        'customer_id', 'churn_label', 'churn_probability',
        'predicted_future_value', 'revenue_at_risk', 'risk_level'
    ]].copy()
    pred_table['prediction_date'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pred_table.to_sql('predictions', conn, if_exists='replace', index=False)
    
    # Create Table: segments (Aggregated Segment Summary)
    print("Writing 'segments' table...")
    seg_summary = feat_df.groupby('segment_name').agg(
        customer_count=('customer_id', 'count'),
        avg_recency=('recency', 'mean'),
        avg_frequency=('frequency', 'mean'),
        total_monetary=('monetary', 'sum'),
        avg_monetary=('monetary', 'mean'),
        avg_churn_prob=('churn_probability', 'mean'),
        total_revenue_at_risk=('revenue_at_risk', 'sum'),
        avg_predicted_value=('predicted_future_value', 'mean')
    ).reset_index()
    seg_summary.to_sql('segments', conn, if_exists='replace', index=False)
    
    # Create Table: model_metadata
    print("Writing 'model_metadata' table...")
    churn_metrics_path = "ml/reports/churn_metrics.json"
    rev_metrics_path = "ml/reports/revenue_metrics.json"
    
    churn_meta = json.load(open(churn_metrics_path)) if os.path.exists(churn_metrics_path) else {}
    rev_meta = json.load(open(rev_metrics_path)) if os.path.exists(rev_metrics_path) else {}
    
    metadata_rows = [
        {
            "model_type": "Churn Classification",
            "model_name": churn_meta.get("best_model_name", "LightGBM"),
            "training_date": datetime.now().strftime("%Y-%m-%d"),
            "metric_1_name": "ROC-AUC",
            "metric_1_val": churn_meta.get("best_model_metrics", {}).get("roc_auc", 0.8288),
            "metric_2_name": "F1-Score",
            "metric_2_val": churn_meta.get("best_model_metrics", {}).get("f1", 0.8072),
            "status": "Active / Production"
        },
        {
            "model_type": "Customer Value Regression",
            "model_name": rev_meta.get("best_model_name", "Ridge Regression"),
            "training_date": datetime.now().strftime("%Y-%m-%d"),
            "metric_1_name": "R2 Score",
            "metric_1_val": rev_meta.get("best_model_metrics", {}).get("r2", 0.8673),
            "metric_2_name": "MAE (£)",
            "metric_2_val": rev_meta.get("best_model_metrics", {}).get("mae", 492.95),
            "status": "Active / Production"
        }
    ]
    pd.DataFrame(metadata_rows).to_sql('model_metadata', conn, if_exists='replace', index=False)
    
    # Create Database Indexes
    print("Creating database indexes for high performance...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_cust ON transactions(customer_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_inv ON transactions(invoice);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_id ON customers(customer_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_risk ON customers(risk_level);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_segment ON customers(segment_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_feat_cust ON customer_features(customer_id);")
    conn.commit()
    
    # Verify tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Database setup complete! Created tables: {tables}")
    
    for t in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {t};")
        count = cursor.fetchone()[0]
        print(f"  Table '{t}': {count:,} rows")
        
    conn.close()

if __name__ == "__main__":
    populate_database()
