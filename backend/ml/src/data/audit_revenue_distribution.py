"""
Section 12 & 34: Revenue Model & Temporal Distribution Audit Script
Analyzes future 90-day revenue distribution across Cutoffs A, B, and C to investigate
why R^2 varies across temporal splits.
"""
import pandas as pd
import numpy as np

def audit_revenue_temporal_distribution():
    dfs = {
        "Cutoff A (2011-03-10)": pd.read_parquet("data/processed/temporal_splits/cutoff_A_features.parquet"),
        "Cutoff B (2011-06-10)": pd.read_parquet("data/processed/temporal_splits/cutoff_B_features.parquet"),
        "Cutoff C (2011-09-10)": pd.read_parquet("data/processed/temporal_splits/cutoff_C_features.parquet")
    }
    
    report = []
    print("=================================================================")
    print(" REVENUE TARGET DISTRIBUTION & OUTLIER CONCENTRATION AUDIT ")
    print("=================================================================")
    
    for name, df in dfs.items():
        y = df['future_revenue_90d'].values
        total_customers = len(df)
        zero_count = (y == 0).sum()
        zero_pct = (zero_count / total_customers) * 100
        
        mean_val = np.mean(y)
        median_val = np.median(y)
        p95_val = np.percentile(y, 95)
        p99_val = np.percentile(y, 99)
        max_val = np.max(y)
        total_revenue = np.sum(y)
        
        # Top 1% and Top 5% revenue concentration
        top_1_cutoff = int(np.ceil(0.01 * total_customers))
        top_5_cutoff = int(np.ceil(0.05 * total_customers))
        
        sorted_y = np.sort(y)[::-1]
        top_1_sum = np.sum(sorted_y[:top_1_cutoff])
        top_5_sum = np.sum(sorted_y[:top_5_cutoff])
        
        top_1_share = (top_1_sum / total_revenue) * 100 if total_revenue > 0 else 0
        top_5_share = (top_5_sum / total_revenue) * 100 if total_revenue > 0 else 0
        
        print(f"\n--- {name} ---")
        print(f"Total Customers: {total_customers:,}")
        print(f"Zero Revenue Count: {zero_count:,} ({zero_pct:.2f}%)")
        print(f"Mean Revenue: £{mean_val:.2f} | Median: £{median_val:.2f}")
        print(f"95th Percentile: £{p95_val:.2f} | 99th Percentile: £{p99_val:.2f} | Max: £{max_val:,.2f}")
        print(f"Total 90d Revenue: £{total_revenue:,.2f}")
        print(f"Top 1% Customers ({top_1_cutoff}): £{top_1_sum:,.2f} ({top_1_share:.2f}% of total revenue)")
        print(f"Top 5% Customers ({top_5_cutoff}): £{top_5_sum:,.2f} ({top_5_share:.2f}% of total revenue)")

if __name__ == "__main__":
    audit_revenue_temporal_distribution()
