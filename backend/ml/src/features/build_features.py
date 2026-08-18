"""
Phase 3 & Phase 4: Feature Engineering & Temporal Churn/Value Target Construction
Strictly temporal feature calculation to ensure ZERO target leakage.

Observation Window: [2009-12-01, 2011-09-10]
Prediction Window:  (2011-09-10, 2011-12-09] (90 days)
"""
import os
import pandas as pd
import numpy as np
from datetime import datetime

CUTOFF_DATE = pd.to_datetime("2011-09-10 00:00:00")
MAX_DATE = pd.to_datetime("2011-12-09 23:59:59")

def build_customer_features(
    clean_data_path: str = "data/processed/clean_transactions.parquet",
    output_feature_path: str = "data/processed/customer_features.parquet",
    output_csv_path: str = "data/processed/customer_features.csv"
) -> pd.DataFrame:
    print(f"Loading cleaned transaction data from {clean_data_path}...")
    df = pd.read_parquet(clean_data_path)
    df['invoice_date'] = pd.to_datetime(df['invoice_date'])
    
    # 1. Split transactions into Observation Window & Prediction Window
    obs_df = df[df['invoice_date'] <= CUTOFF_DATE].copy()
    pred_df = df[(df['invoice_date'] > CUTOFF_DATE) & (df['invoice_date'] <= MAX_DATE)].copy()
    
    print(f"Observation window transactions: {len(obs_df):,}")
    print(f"Prediction window transactions: {len(pred_df):,}")
    
    # Only keep customers who were active at least once in the observation window
    obs_customers = obs_df['customer_id'].unique()
    print(f"Total active customers in Observation Window: {len(obs_customers):,}")
    
    # 2. Extract positive purchases and cancellations in Observation Window
    records = []
    
    for cid, c_df in obs_df.groupby('customer_id'):
        c_purchases = c_df[(c_df['quantity'] > 0) & (~c_df['is_cancelled'])]
        c_cancels = c_df[c_df['is_cancelled'] | (c_df['quantity'] < 0)]
        
        # Mandatory fallback if customer only has cancellations
        if len(c_purchases) == 0:
            recency = (CUTOFF_DATE - c_df['invoice_date'].max()).days
            frequency = 0
            monetary = 0.0
            total_orders = 0
            total_items = 0
            gross_revenue = 0.0
            avg_order_value = 0.0
            avg_quantity = 0.0
            unique_products = 0
            cust_lifetime_days = 0
            avg_days_between_orders = 0.0
            max_days_between_orders = 0.0
            cancellation_count = len(c_cancels['invoice'].unique())
            cancellation_rate = 1.0
            cancelled_revenue = float(abs(c_cancels['revenue'].sum()))
            country = c_df['country'].mode().iloc[0] if len(c_df['country']) > 0 else 'United Kingdom'
            recent_spend_90d = 0.0
            historical_spend_prior = 0.0
            recent_order_count_90d = 0
            days_since_first_purchase = (CUTOFF_DATE - c_df['invoice_date'].min()).days
        else:
            first_date = c_purchases['invoice_date'].min()
            last_date = c_purchases['invoice_date'].max()
            
            recency = (CUTOFF_DATE - last_date).days
            order_invoices = c_purchases['invoice'].unique()
            frequency = len(order_invoices)
            monetary = float(c_purchases['revenue'].sum())
            total_orders = frequency
            total_items = int(c_purchases['quantity'].sum())
            gross_revenue = monetary
            avg_order_value = gross_revenue / total_orders if total_orders > 0 else 0.0
            avg_quantity = total_items / total_orders if total_orders > 0 else 0.0
            unique_products = int(c_purchases['stock_code'].nunique())
            cust_lifetime_days = (last_date - first_date).days
            days_since_first_purchase = (CUTOFF_DATE - first_date).days
            
            # Inter-order intervals
            order_dates = c_purchases.groupby('invoice')['invoice_date'].min().sort_values()
            if len(order_dates) > 1:
                diffs = order_dates.diff().dropna().dt.total_seconds() / (24 * 3600)
                avg_days_between_orders = float(diffs.mean())
                max_days_between_orders = float(diffs.max())
            else:
                avg_days_between_orders = 0.0
                max_days_between_orders = 0.0
                
            cancellation_count = len(c_cancels['invoice'].unique()) if len(c_cancels) > 0 else 0
            cancellation_rate = cancellation_count / (total_orders + cancellation_count) if (total_orders + cancellation_count) > 0 else 0.0
            cancelled_revenue = float(abs(c_cancels['revenue'].sum())) if len(c_cancels) > 0 else 0.0
            country = c_purchases['country'].mode().iloc[0] if len(c_purchases) > 0 else 'United Kingdom'
            
            # Trend features (Recent 90d before cutoff vs older)
            recent_cutoff_start = CUTOFF_DATE - pd.Timedelta(days=90)
            recent_p = c_purchases[c_purchases['invoice_date'] > recent_cutoff_start]
            older_p = c_purchases[c_purchases['invoice_date'] <= recent_cutoff_start]
            
            recent_spend_90d = float(recent_p['revenue'].sum())
            historical_spend_prior = float(older_p['revenue'].sum())
            recent_order_count_90d = len(recent_p['invoice'].unique())
            
        spend_trend = recent_spend_90d / (historical_spend_prior + 1.0)
        order_frequency_trend = recent_order_count_90d / (total_orders + 1.0)
        
        # Validated Advanced Behavioral Features
        recency_acceleration = recency / (avg_days_between_orders + 1.0)
        spending_momentum = recent_spend_90d / (historical_spend_prior + 1.0)
        product_diversity_ratio = unique_products / (total_items + 1.0)
        cancellation_revenue_ratio = cancelled_revenue / (gross_revenue + 1.0)
        purchase_frequency_rate = total_orders / (cust_lifetime_days + 1.0)
        
        # 3. Compute Target variables from Prediction Window
        c_pred = pred_df[(pred_df['customer_id'] == cid) & (pred_df['quantity'] > 0) & (~pred_df['is_cancelled'])]
        
        if len(c_pred) > 0:
            future_orders = len(c_pred['invoice'].unique())
            future_revenue = float(c_pred['revenue'].sum())
            churn_label = 0 # Active / Retained
        else:
            future_orders = 0
            future_revenue = 0.0
            churn_label = 1 # Churned
            
        records.append({
            'customer_id': cid,
            'recency': recency,
            'frequency': frequency,
            'monetary': monetary,
            'total_orders': total_orders,
            'total_items': total_items,
            'gross_revenue': gross_revenue,
            'average_order_value': round(avg_order_value, 2),
            'average_quantity': round(avg_quantity, 2),
            'unique_products': unique_products,
            'customer_lifetime_days': cust_lifetime_days,
            'days_since_first_purchase': days_since_first_purchase,
            'average_days_between_orders': round(avg_days_between_orders, 2),
            'max_days_between_orders': round(max_days_between_orders, 2),
            'cancellation_count': cancellation_count,
            'cancellation_rate': round(cancellation_rate, 4),
            'cancelled_revenue': round(cancelled_revenue, 2),
            'country': country,
            'recent_spend_90d': round(recent_spend_90d, 2),
            'historical_spend_prior': round(historical_spend_prior, 2),
            'spend_trend': round(spend_trend, 4),
            'order_frequency_trend': round(order_frequency_trend, 4),
            'recent_order_count_90d': recent_order_count_90d,
            'recency_acceleration': round(recency_acceleration, 4),
            'spending_momentum': round(spending_momentum, 4),
            'product_diversity_ratio': round(product_diversity_ratio, 4),
            'cancellation_revenue_ratio': round(cancellation_revenue_ratio, 4),
            'purchase_frequency_rate': round(purchase_frequency_rate, 4),
            'future_orders_90d': future_orders,
            'future_revenue_90d': round(future_revenue, 2),
            'churn_label': churn_label
        })
        
    features_df = pd.DataFrame(records)
    
    print("\n--- Feature Dataset Summary ---")
    print(f"Total customer records: {len(features_df):,}")
    print(f"Overall Churn Rate (90d): {features_df['churn_label'].mean() * 100:.2f}%")
    print(f"Churn count (1): {(features_df['churn_label'] == 1).sum():,}")
    print(f"Retained count (0): {(features_df['churn_label'] == 0).sum():,}")
    print(f"Average future 90d revenue: £{features_df['future_revenue_90d'].mean():.2f}")
    
    os.makedirs(os.path.dirname(output_feature_path), exist_ok=True)
    features_df.to_parquet(output_feature_path, index=False)
    features_df.to_csv(output_csv_path, index=False)
    print(f"Saved feature dataset to {output_feature_path} and {output_csv_path}")
    
    return features_df

if __name__ == "__main__":
    build_customer_features()
