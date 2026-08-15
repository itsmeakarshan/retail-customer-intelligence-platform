"""
Unit and integration tests for the Demand Forecasting Engine.
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from ml.src.forecasting.demand_forecaster import (
    DemandForecaster,
    calculate_smape,
    calculate_metrics
)


@pytest.fixture
def sample_transactions_df():
    """Generates synthetic transactions for 2 products across 180 consecutive days."""
    np.random.seed(42)
    start_date = datetime(2023, 1, 1)
    dates = [start_date + timedelta(days=i) for i in range(180)]
    
    rows = []
    for d in dates:
        # Product A: regular daily demand with slight upward trend
        qty_a = max(1, int(np.random.poisson(lam=15) + (d - start_date).days * 0.05))
        price_a = 5.0
        rows.append({
            "invoice": f"INV-{d.strftime('%Y%m%d')}-A",
            "stock_code": "PROD_A",
            "description": "Product A Test",
            "quantity": qty_a,
            "invoice_date": d.strftime("%Y-%m-%d %H:%M:%S"),
            "price": price_a,
            "customer_id": 1001,
            "country": "United Kingdom",
            "is_cancelled": 0
        })
        
        # Product B: lower demand with price variation
        qty_b = max(1, int(np.random.poisson(lam=5)))
        price_b = 12.0 if (d.weekday() >= 5) else 10.0
        rows.append({
            "invoice": f"INV-{d.strftime('%Y%m%d')}-B",
            "stock_code": "PROD_B",
            "description": "Product B Test",
            "quantity": qty_b,
            "invoice_date": d.strftime("%Y-%m-%d %H:%M:%S"),
            "price": price_b,
            "customer_id": 1002,
            "country": "United Kingdom",
            "is_cancelled": 0
        })
        
    return pd.DataFrame(rows)


def test_metric_calculations():
    """Tests MAE, RMSE, and sMAPE formula implementations."""
    y_true = np.array([10.0, 20.0, 30.0, 40.0])
    y_pred = np.array([12.0, 18.0, 33.0, 38.0])
    
    metrics = calculate_metrics(y_true, y_pred)
    smape = calculate_smape(y_true, y_pred)
    
    assert np.isclose(metrics["mae"], 2.25)
    assert metrics["rmse"] > 0 and metrics["rmse"] < 3.0
    assert smape > 0 and smape < 20.0
    assert np.isclose(metrics["smape"], smape, atol=0.01)


def test_demand_forecaster_preparation(sample_transactions_df):
    """Tests daily continuous aggregation and lag feature engineering."""
    forecaster = DemandForecaster(horizon_days=30)
    daily_df = forecaster.prepare_daily_series(sample_transactions_df, "PROD_A")
    
    assert len(daily_df) == 180
    assert "quantity" in daily_df.columns
    assert "price" in daily_df.columns
    
    feat_df = forecaster.create_features(daily_df)
    assert "lag_1" in feat_df.columns
    assert "lag_7" in feat_df.columns
    assert "lag_28" in feat_df.columns
    assert "rolling_mean_7" in feat_df.columns
    assert "day_of_week" in feat_df.columns
    assert "month" in feat_df.columns


def test_out_of_time_validation(sample_transactions_df):
    """Tests chronological out-of-time validation vs baseline."""
    forecaster = DemandForecaster(horizon_days=30)
    daily_df = forecaster.prepare_daily_series(sample_transactions_df, "PROD_A")
    
    val_res = forecaster.train_and_evaluate_product(daily_df, "PROD_A")
    
    assert val_res is not None
    assert "ml_metrics" in val_res
    assert "baseline_metrics" in val_res
    assert "ml_beat_baseline" in val_res
    assert val_res["ml_metrics"]["mae"] >= 0.0


def test_forecast_next_30_days_with_intervals(sample_transactions_df):
    """Tests 30-day recursive forecast with empirical prediction intervals."""
    forecaster = DemandForecaster(horizon_days=30)
    daily_df = forecaster.prepare_daily_series(sample_transactions_df, "PROD_A")
    result = forecaster.generate_30day_forecast(daily_df, "PROD_A")
    
    assert result is not None
    assert result["stock_code"] == "PROD_A"
    assert len(result["daily_forecast"]) == 30
    assert result["expected_30d_demand"] > 0
    assert result["lower_30d_estimate"] <= result["expected_30d_demand"]
    assert result["upper_30d_estimate"] >= result["expected_30d_demand"]
    
    # Check structure of daily forecasts
    first_day = result["daily_forecast"][0]
    assert "date" in first_day
    assert "forecast_units" in first_day
    assert "lower_bound" in first_day
    assert "upper_bound" in first_day
    assert first_day["lower_bound"] <= first_day["forecast_units"]
    assert first_day["upper_bound"] >= first_day["forecast_units"]
