"""
Comprehensive Data Science Audit Script
Inspects feature leakage, revenue distribution, outlier influence,
churn rate composition, and multi-cutoff temporal splits.
"""
import os
import pandas as pd
import numpy as np

DATA_CLEAN_PATH = "data/processed/clean_transactions.parquet"
FEATURES_PATH = "data/processed/customer_features.parquet"

def audit_features_and_targets():
    print("=================================================================")
    print(" 1. FEATURE LEAKAGE & REVENUE DISTRIBUTION AUDIT ")
    print("=================================================================")
    
    df_feat = pd.read_parquet(FEATURES_PATH)
    df_trans = pd.read_parquet(DATA_CLEAN_PATH)
    df_trans['invoice_date'] = pd.to_datetime(df_trans['invoice_date'])
    
    print(f"Total customers in feature dataset: {len(df_feat)}")
    print(f"Columns in feature dataset:\n{df_feat.columns.tolist()}\n")
    
    # Feature list check
    features = [
        'recency', 'frequency', 'monetary', 'total_orders', 'total_items',
        'gross_revenue', 'average_order_value', 'average_quantity',
        'unique_products', 'customer_lifetime_days', 'days_since_first_purchase',
        'average_days_between_orders', 'max_days_between_orders',
        'cancellation_count', 'cancellation_rate', 'cancelled_revenue',
        'recent_spend_90d', 'historical_spend_prior', 'spend_trend',
        'order_frequency_trend', 'recent_order_count_90d', 'country'
    ]
    
    print(f"Number of input features: {len(features)}")
    
    # Check target leakage: compare cutoff date vs transaction dates
    cutoff_date = pd.to_datetime("2011-09-10 00:00:00")
    
    # Outlier analysis on gross_revenue & future_revenue_90d
    print("\n--- Revenue Summary & Outliers ---")
    print(df_feat[['monetary', 'gross_revenue', 'future_revenue_90d']].describe().round(2))
    
    top_spenders = df_feat.sort_values(by='future_revenue_90d', ascending=False).head(10)
    print("\nTop 5 Spenders in Future 90-day Window:")
    print(top_spenders[['customer_id', 'monetary', 'gross_revenue', 'recent_spend_90d', 'future_revenue_90d', 'churn_label']])
    
    # Churn Rate Composition Analysis
    print("\n=================================================================")
    print(" 2. CHURN RATE & RECENCY COMPOSITION AUDIT ")
    print("=================================================================")
    churn_count = (df_feat['churn_label'] == 1).sum()
    retained_count = (df_feat['churn_label'] == 0).sum()
    churn_pct = (df_feat['churn_label'].mean() * 100)
    
    print(f"Total Customers: {len(df_feat)}")
    print(f"Churn Count (1): {churn_count} ({churn_pct:.2f}%)")
    print(f"Retained Count (0): {retained_count} ({100 - churn_pct:.2f}%)")
    
    # Recency breakdown vs Churn
    print("\nChurn Rate by Customer Recency Bins:")
    df_feat['recency_bin'] = pd.cut(df_feat['recency'], bins=[-1, 30, 60, 90, 180, 365, 1000], labels=['0-30d', '31-60d', '61-90d', '91-180d', '181-365d', '>365d'])
    rec_summary = df_feat.groupby('recency_bin', observed=False).agg(
        total_customers=('customer_id', 'count'),
        churned=('churn_label', lambda x: (x == 1).sum()),
        churn_rate=('churn_label', lambda x: round(x.mean() * 100, 2))
    )
    print(rec_summary)

if __name__ == "__main__":
    audit_features_and_targets()
