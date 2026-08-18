"""
Phase 2: Data Cleaning Pipeline
Loads raw transactions, cleans invalid records, formats dates and types,
calculates line-item revenue, and validates the clean transaction dataset.
"""
import os
import pandas as pd
import numpy as np

def clean_transaction_data(
    input_path: str = "data/raw/online_retail_II.csv",
    output_path: str = "data/processed/clean_transactions.parquet",
    csv_output_path: str = "data/processed/clean_transactions.csv"
) -> pd.DataFrame:
    print(f"Reading raw data from {input_path}...")
    df = pd.read_csv(input_path)
    
    # 1. Standardize column names
    df = df.rename(columns={
        'Invoice': 'invoice',
        'StockCode': 'stock_code',
        'Description': 'description',
        'Quantity': 'quantity',
        'InvoiceDate': 'invoice_date',
        'Price': 'price',
        'Customer ID': 'customer_id',
        'Country': 'country'
    })
    
    # 2. Parse Datetime
    df['invoice_date'] = pd.to_datetime(df['invoice_date'], errors='coerce')
    
    # 3. Clean Customer ID
    df = df.dropna(subset=['customer_id'])
    df['customer_id'] = df['customer_id'].astype(int).astype(str)
    
    # 4. Clean Description & StockCode whitespace
    df['description'] = df['description'].astype(str).str.strip()
    df['stock_code'] = df['stock_code'].astype(str).str.strip()
    df['country'] = df['country'].astype(str).str.strip()
    
    # 5. Handle Cancellations vs Positive Transactions
    df['invoice'] = df['invoice'].astype(str).str.strip()
    df['is_cancelled'] = df['invoice'].str.upper().str.startswith('C')
    
    # 6. Deduplicate exact duplicate records
    initial_len = len(df)
    df = df.drop_duplicates()
    deduped_len = len(df)
    print(f"Removed {initial_len - deduped_len} exact duplicate rows.")
    
    # 7. Price filtering (unit price must be strictly positive > 0)
    df = df[df['price'] > 0]
    
    # 8. Revenue calculation
    # For positive purchases: quantity > 0 -> revenue > 0
    # For cancellations: quantity < 0 -> revenue < 0 (or zeroed out for returns tracking)
    df['revenue'] = df['quantity'] * df['price']
    
    # 9. Validation checks
    assert df['customer_id'].isnull().sum() == 0, "Validation Error: Null customer_ids present"
    assert (df['price'] <= 0).sum() == 0, "Validation Error: Non-positive prices present"
    assert len(df) > 0, "Validation Error: Clean dataset is empty"
    
    print(f"Data cleaning complete! Total clean rows: {len(df):,}")
    print(f"Unique customers in clean data: {df['customer_id'].nunique():,}")
    print(f"Positive purchase rows: {(df['quantity'] > 0).sum():,}")
    print(f"Cancellation rows: {df['is_cancelled'].sum():,}")
    
    # Save processed outputs
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_parquet(output_path, index=False)
    df.to_csv(csv_output_path, index=False)
    print(f"Saved clean dataset to {output_path} and {csv_output_path}")
    
    return df

if __name__ == "__main__":
    clean_transaction_data()
