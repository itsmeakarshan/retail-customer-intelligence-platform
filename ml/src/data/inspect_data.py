"""
Phase 1: Data Understanding & Inspection Script
Inspects raw dataset and outputs data quality summary metrics and JSON report.
"""
import os
import json
import pandas as pd
import numpy as np

def run_inspection(data_path="data/raw/online_retail_II.csv", output_report_path="reports/data_quality_metrics.json"):
    print(f"Loading raw dataset from {data_path}...")
    df = pd.read_csv(data_path)
    
    # Standardize column names for inspection
    # Expected columns: Invoice, StockCode, Description, Quantity, InvoiceDate, Price, Customer ID, Country
    raw_shape = df.shape
    cols = df.columns.tolist()
    
    # Convert InvoiceDate to datetime
    df['InvoiceDate'] = pd.to_datetime(df['InvoiceDate'], errors='coerce')
    
    # Missing values
    missing_counts = df.isnull().sum().to_dict()
    missing_pct = (df.isnull().sum() / len(df) * 100).round(2).to_dict()
    
    # Duplicates
    dup_count = int(df.duplicated().sum())
    dup_pct = round(dup_count / len(df) * 100, 2)
    
    # Cancellations: Invoices starting with 'C'
    is_cancelled = df['Invoice'].astype(str).str.upper().str.startswith('C')
    cancellation_count = int(is_cancelled.sum())
    cancellation_pct = round(cancellation_count / len(df) * 100, 2)
    
    # Negative / Zero Quantities
    neg_qty = df[df['Quantity'] < 0]
    zero_qty = df[df['Quantity'] == 0]
    pos_qty = df[df['Quantity'] > 0]
    
    # Negative / Zero Prices
    neg_price = df[df['Price'] < 0]
    zero_price = df[df['Price'] == 0]
    pos_price = df[df['Price'] > 0]
    
    # Customer ID stats
    missing_cust_id_count = int(df['Customer ID'].isnull().sum())
    missing_cust_id_pct = round(missing_cust_id_count / len(df) * 100, 2)
    valid_cust_df = df.dropna(subset=['Customer ID'])
    
    unique_cust_total = int(df['Customer ID'].nunique())
    unique_invoices_total = int(df['Invoice'].nunique())
    unique_products_total = int(df['StockCode'].nunique())
    unique_countries = int(df['Country'].nunique())
    
    top_countries = df['Country'].value_counts().head(10).to_dict()
    
    date_min = str(df['InvoiceDate'].min())
    date_max = str(df['InvoiceDate'].max())
    
    # Analyze cancellations vs negative quantity relationship
    neg_qty_cancelled = int((df['Quantity'] < 0 & is_cancelled).sum())
    neg_qty_not_cancelled = int((df['Quantity'] < 0 & ~is_cancelled).sum())
    
    metrics = {
        "raw_rows": raw_shape[0],
        "raw_cols": raw_shape[1],
        "columns": cols,
        "missing_counts": missing_counts,
        "missing_pct": missing_pct,
        "duplicate_rows": dup_count,
        "duplicate_pct": dup_pct,
        "cancellation_count": cancellation_count,
        "cancellation_pct": cancellation_pct,
        "negative_quantity_count": len(neg_qty),
        "zero_quantity_count": len(zero_qty),
        "negative_quantity_cancelled": neg_qty_cancelled,
        "negative_quantity_not_cancelled": neg_qty_not_cancelled,
        "negative_price_count": len(neg_price),
        "zero_price_count": len(zero_price),
        "missing_customer_id_count": missing_cust_id_count,
        "missing_customer_id_pct": missing_cust_id_pct,
        "unique_customers": unique_cust_total,
        "unique_invoices": unique_invoices_total,
        "unique_products": unique_products_total,
        "unique_countries": unique_countries,
        "top_countries": top_countries,
        "date_min": date_min,
        "date_max": date_max,
        "quantity_min": float(df['Quantity'].min()),
        "quantity_max": float(df['Quantity'].max()),
        "quantity_median": float(df['Quantity'].median()),
        "price_min": float(df['Price'].min()),
        "price_max": float(df['Price'].max()),
        "price_median": float(df['Price'].median()),
    }
    
    os.makedirs(os.path.dirname(output_report_path), exist_ok=True)
    with open(output_report_path, "w") as f:
        json.dump(metrics, f, indent=2)
        
    print("Inspection complete! Summary metrics:")
    for k, v in metrics.items():
        if not isinstance(v, dict) and not isinstance(v, list):
            print(f"  {k}: {v}")
            
    return metrics

if __name__ == "__main__":
    run_inspection()
