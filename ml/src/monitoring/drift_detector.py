"""
Model & Data Monitoring Module
Implements Population Stability Index (PSI), Kolmogorov-Smirnov (KS) tests,
and demand distribution drift detection for production machine learning & analytics pipelines.
"""
import numpy as np
import pandas as pd
import scipy.stats as stats
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime

def calculate_psi(baseline: np.ndarray, current: np.ndarray, num_bins: int = 10) -> float:
    """
    Calculates Population Stability Index (PSI) between baseline and current distributions.
    Handles zeros with epsilon smoothing.
    """
    if len(baseline) == 0 or len(current) == 0:
        return 0.0

    # Create quantile bins based on baseline distribution
    percentiles = np.linspace(0, 100, num_bins + 1)
    bin_edges = np.percentile(baseline, percentiles)
    # Ensure unique bin edges
    bin_edges = np.unique(bin_edges)
    if len(bin_edges) < 2:
        return 0.0

    # Extend lowest and highest bin edges slightly to catch edge values
    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf

    # Calculate frequencies in each bin
    baseline_counts, _ = np.histogram(baseline, bins=bin_edges)
    current_counts, _ = np.histogram(current, bins=bin_edges)

    # Convert to proportions with smoothing epsilon
    eps = 1e-4
    b_prop = (baseline_counts / len(baseline)) + eps
    c_prop = (current_counts / len(current)) + eps

    # Normalize back to sum to 1
    b_prop = b_prop / np.sum(b_prop)
    c_prop = c_prop / np.sum(c_prop)

    # PSI formula: sum((Current - Baseline) * ln(Current / Baseline))
    psi_val = np.sum((c_prop - b_prop) * np.log(c_prop / b_prop))
    return float(round(max(0.0, psi_val), 4))

class DriftMonitor:
    """
    System Drift and Model Health Monitor.
    """
    def __init__(self, psi_warning_threshold: float = 0.10, psi_alert_threshold: float = 0.25):
        self.psi_warning = psi_warning_threshold
        self.psi_alert = psi_alert_threshold

    def evaluate_feature_drift(
        self,
        baseline_df: pd.DataFrame,
        current_df: pd.DataFrame,
        feature_columns: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Calculates PSI and KS 2-sample tests for a list of numerical features.
        """
        results = []
        for col in feature_columns:
            if col not in baseline_df.columns or col not in current_df.columns:
                continue

            b_vals = baseline_df[col].dropna().values.astype(float)
            c_vals = current_df[col].dropna().values.astype(float)

            if len(b_vals) < 10 or len(c_vals) < 10:
                continue

            psi = calculate_psi(b_vals, c_vals)
            ks_res = stats.ks_2samp(b_vals, c_vals)
            ks_stat = round(float(ks_res.statistic), 4)
            ks_pvalue = round(float(ks_res.pvalue), 4)

            b_mean = round(float(np.mean(b_vals)), 2)
            c_mean = round(float(np.mean(c_vals)), 2)
            b_std = round(float(np.std(b_vals)), 2)
            c_std = round(float(np.std(c_vals)), 2)
            pct_change = round(((c_mean - b_mean) / b_mean * 100.0), 1) if b_mean != 0 else 0.0

            if psi >= self.psi_alert:
                status = "Alert"
                status_color = "rose"
                status_emoji = "🔴"
                action = f"Significant distribution shift detected in {col}. Review segment definitions or feature pipeline."
            elif psi >= self.psi_warning:
                status = "Warning"
                status_color = "amber"
                status_emoji = "🟡"
                action = f"Moderate distribution shift in {col}. Monitor incoming customer cohorts."
            else:
                status = "Healthy"
                status_color = "emerald"
                status_emoji = "🟢"
                action = "Distribution is stable within acceptable tolerance."

            results.append({
                "feature_name": col,
                "psi": psi,
                "ks_statistic": ks_stat,
                "ks_pvalue": ks_pvalue,
                "baseline_mean": b_mean,
                "current_mean": c_mean,
                "baseline_std": b_std,
                "current_std": c_std,
                "mean_pct_change": pct_change,
                "status": status,
                "status_color": status_color,
                "status_emoji": status_emoji,
                "recommended_action": action
            })

        return results

    def evaluate_demand_drift(
        self,
        df_transactions: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Evaluates demand shift by comparing earlier historical transactions vs recent transaction window.
        """
        df = df_transactions.copy()
        df['invoice_date'] = pd.to_datetime(df['invoice_date'])
        
        max_date = df['invoice_date'].max()
        cutoff_recent = max_date - pd.Timedelta(days=90)
        
        baseline_tx = df[df['invoice_date'] < cutoff_recent]
        recent_tx = df[df['invoice_date'] >= cutoff_recent]

        if baseline_tx.empty or recent_tx.empty:
            return {
                "status": "Healthy",
                "demand_psi": 0.0,
                "alerts": [],
                "recent_window_days": 90
            }

        # Daily quantity aggregate
        b_daily = baseline_tx.groupby(baseline_tx['invoice_date'].dt.date)['quantity'].sum().values.astype(float)
        c_daily = recent_tx.groupby(recent_tx['invoice_date'].dt.date)['quantity'].sum().values.astype(float)

        demand_psi = calculate_psi(b_daily, c_daily)

        # Product specific demand shifts (> 40% change in weekly volume)
        b_prod_avg = baseline_tx.groupby('stock_code')['quantity'].sum() / (len(baseline_tx['invoice_date'].dt.date.unique()) / 7.0)
        c_prod_avg = recent_tx.groupby('stock_code')['quantity'].sum() / (len(recent_tx['invoice_date'].dt.date.unique()) / 7.0)
        
        prod_comp = pd.DataFrame({
            'baseline_weekly': b_prod_avg,
            'recent_weekly': c_prod_avg
        }).dropna()
        
        prod_comp['pct_change'] = ((prod_comp['recent_weekly'] - prod_comp['baseline_weekly']) / prod_comp['baseline_weekly']) * 100.0
        
        # Filter significant shifters (baseline weekly >= 20 units)
        significant = prod_comp[prod_comp['baseline_weekly'] >= 20].copy()
        
        rising_prods = significant[significant['pct_change'] >= 40.0].sort_values('pct_change', ascending=False).head(10)
        falling_prods = significant[significant['pct_change'] <= -40.0].sort_values('pct_change', ascending=True).head(10)

        alerts = []
        for code, row in rising_prods.iterrows():
            alerts.append({
                "type": "Demand Spike",
                "stock_code": str(code),
                "baseline_weekly_units": round(float(row['baseline_weekly']), 1),
                "recent_weekly_units": round(float(row['recent_weekly']), 1),
                "pct_change": round(float(row['pct_change']), 1),
                "severity": "Warning" if row['pct_change'] < 80 else "Alert",
                "message": f"Demand for product {code} increased by {row['pct_change']:.1f}% in the recent 90 days."
            })

        for code, row in falling_prods.iterrows():
            alerts.append({
                "type": "Demand Drop",
                "stock_code": str(code),
                "baseline_weekly_units": round(float(row['baseline_weekly']), 1),
                "recent_weekly_units": round(float(row['recent_weekly']), 1),
                "pct_change": round(float(row['pct_change']), 1),
                "severity": "Warning" if row['pct_change'] > -70 else "Alert",
                "message": f"Demand for product {code} fell by {abs(row['pct_change']):.1f}% in the recent 90 days."
            })

        overall_status = "Healthy"
        if demand_psi >= self.psi_alert or len([a for a in alerts if a['severity'] == 'Alert']) > 5:
            overall_status = "Alert"
        elif demand_psi >= self.psi_warning or len(alerts) > 0:
            overall_status = "Warning"

        return {
            "status": overall_status,
            "demand_psi": demand_psi,
            "baseline_daily_mean": round(float(np.mean(b_daily)), 1) if len(b_daily) > 0 else 0.0,
            "recent_daily_mean": round(float(np.mean(c_daily)), 1) if len(c_daily) > 0 else 0.0,
            "alerts": alerts,
            "total_alerts": len(alerts),
            "recent_window_days": 90
        }
