"""
Unit and integration tests for the Model and Data Monitoring Engine.
"""
import pytest
import pandas as pd
import numpy as np

from ml.src.monitoring.drift_detector import DriftMonitor, calculate_psi


def test_psi_calculation():
    """Tests Population Stability Index on identical and shifted distributions."""
    np.random.seed(42)
    baseline = np.random.normal(50, 10, 1000)
    
    # Case 1: Identical distribution -> PSI should be very close to 0 (< 0.05)
    psi_identical = calculate_psi(baseline, baseline)
    assert psi_identical < 0.05
    
    # Case 2: Significant shift in distribution -> PSI should exceed 0.25 (Alert threshold)
    shifted = np.random.normal(80, 10, 1000)
    psi_shifted = calculate_psi(baseline, shifted)
    assert psi_shifted > 0.25


def test_feature_drift_evaluation():
    """Tests feature drift computation across baseline and current customer features."""
    np.random.seed(42)
    
    baseline_df = pd.DataFrame({
        "recency": np.random.exponential(scale=20, size=500),
        "frequency": np.random.poisson(lam=5, size=500),
        "monetary": np.random.normal(500, 100, size=500)
    })
    
    # Current has shifted recency and stable monetary
    current_df = pd.DataFrame({
        "recency": np.random.exponential(scale=60, size=500),
        "frequency": np.random.poisson(lam=5, size=500),
        "monetary": np.random.normal(500, 100, size=500)
    })
    
    monitor = DriftMonitor()
    results = monitor.evaluate_feature_drift(
        baseline_df,
        current_df,
        ["recency", "frequency", "monetary"]
    )
    
    assert len(results) == 3
    rec_res = next(r for r in results if r["feature_name"] == "recency")
    assert rec_res["psi"] > 0.10
    assert rec_res["status"] in ["Warning", "Alert"]
    
    mon_res = next(r for r in results if r["feature_name"] == "monetary")
    assert mon_res["status"] == "Healthy"


def test_demand_drift_and_anomaly_alerts():
    """Tests detection of demand volume shifts and spike/drop alerts."""
    np.random.seed(42)
    
    # Generate 180 days of transaction data
    dates = pd.date_range(start="2023-01-01", periods=180, freq="D")
    rows = []
    
    for d in dates:
        # Normal steady item
        rows.append({
            "invoice": f"INV-{d.strftime('%Y%m%d')}-1",
            "stock_code": "PROD_STEADY",
            "quantity": 25,
            "price": 5.0,
            "invoice_date": d,
            "customer_id": 1001,
            "country": "United Kingdom",
            "is_cancelled": 0
        })
        
        # Surging item (doubles in last 60 days)
        qty_surge = 80 if d >= pd.Timestamp("2023-04-01") else 20
        rows.append({
            "invoice": f"INV-{d.strftime('%Y%m%d')}-2",
            "stock_code": "PROD_SURGE",
            "quantity": qty_surge,
            "price": 8.0,
            "invoice_date": d,
            "customer_id": 1002,
            "country": "United Kingdom",
            "is_cancelled": 0
        })
        
    df_tx = pd.DataFrame(rows)
    monitor = DriftMonitor()
    
    demand_res = monitor.evaluate_demand_drift(df_tx)
    
    assert demand_res is not None
    assert "status" in demand_res
    assert "alerts" in demand_res
    assert len(demand_res["alerts"]) > 0
    
    spike_alert = next((a for a in demand_res["alerts"] if a["stock_code"] == "PROD_SURGE"), None)
    assert spike_alert is not None
    assert spike_alert["type"] == "Demand Spike"
    assert spike_alert["pct_change"] > 40.0
