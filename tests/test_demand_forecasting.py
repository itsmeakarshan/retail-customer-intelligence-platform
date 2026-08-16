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
    calculate_metrics,
    calculate_trend_momentum
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
    assert "trend_pct" in result
    assert "trend_direction" in result
    assert result["trend_direction"] in ["Rising", "Falling", "Stable"]


def test_trend_momentum_rising():
    """Tests that a 30-day forecast with higher demand in days 24-30 classifies as Rising."""
    # Days 1-7: avg 10.0, Days 24-30: avg 20.0 (+100% change)
    forecast_30d = [10.0] * 7 + [15.0] * 16 + [20.0] * 7
    res = calculate_trend_momentum(forecast_30d)
    
    assert res["first_7_avg"] == 10.0
    assert res["last_7_avg"] == 20.0
    assert res["diff"] == 10.0
    assert res["trend_pct"] == 100.0
    assert res["trend_direction"] == "Rising"


def test_trend_momentum_falling():
    """Tests that a 30-day forecast with lower demand in days 24-30 classifies as Falling."""
    # Days 1-7: avg 25.0, Days 24-30: avg 15.0 (-40% change)
    forecast_30d = [25.0] * 7 + [20.0] * 16 + [15.0] * 7
    res = calculate_trend_momentum(forecast_30d)
    
    assert res["first_7_avg"] == 25.0
    assert res["last_7_avg"] == 15.0
    assert res["diff"] == -10.0
    assert res["trend_pct"] == -40.0
    assert res["trend_direction"] == "Falling"


def test_trend_momentum_stable():
    """Tests that flat forecasts or minor variations classify as Stable."""
    # 1. Perfectly flat
    flat_series = [12.0] * 30
    res_flat = calculate_trend_momentum(flat_series)
    assert res_flat["diff"] == 0.0
    assert res_flat["trend_pct"] == 0.0
    assert res_flat["trend_direction"] == "Stable"

    # 2. Minor change below percentage threshold (from 20.0 to 20.4, +2.0% change)
    minor_pct = [20.0] * 7 + [20.0] * 16 + [20.4] * 7
    res_minor = calculate_trend_momentum(minor_pct)
    assert res_minor["trend_pct"] == 2.0
    assert res_minor["trend_direction"] == "Stable"

    # 3. Minor change below absolute threshold (from 1.0 to 1.3, diff = 0.3 units/day)
    minor_abs = [1.0] * 7 + [1.0] * 16 + [1.3] * 7
    res_abs = calculate_trend_momentum(minor_abs)
    assert res_abs["trend_direction"] == "Stable"


def test_trend_momentum_near_zero_first_week():
    """Tests that near-zero first-week demand is protected and avoids absurd percentages."""
    # 1. Tiny demand with negligible absolute difference (0.01 to 0.03 units/day)
    tiny_diff = [0.01] * 7 + [0.02] * 16 + [0.03] * 7
    res_tiny = calculate_trend_momentum(tiny_diff)
    # Absolute difference is 0.02 (< 0.5 threshold) -> Classified as Stable without exploding percentage
    assert res_tiny["trend_direction"] == "Stable"
    assert res_tiny["trend_pct"] < 10.0

    # 2. Starting from zero baseline up to 5 units/day
    zero_start = [0.0] * 7 + [2.0] * 16 + [5.0] * 7
    res_surge = calculate_trend_momentum(zero_start)
    assert res_surge["trend_direction"] == "Rising"
    assert res_surge["trend_pct"] > 0
    assert res_surge["trend_pct"] <= 500.0  # Protected and bounded


def test_trend_momentum_no_division_by_zero():
    """Tests robust handling of zero demand and empty series without division by zero."""
    # All zeros
    res_zeros = calculate_trend_momentum([0.0] * 30)
    assert res_zeros["trend_pct"] == 0.0
    assert res_zeros["trend_direction"] == "Stable"

    # Empty list
    res_empty = calculate_trend_momentum([])
    assert res_empty["trend_pct"] == 0.0
    assert res_empty["trend_direction"] == "Stable"

    # None input
    res_none = calculate_trend_momentum(None)
    assert res_none["trend_pct"] == 0.0
    assert res_none["trend_direction"] == "Stable"


def test_trend_momentum_classification_formats():
    """Tests trend momentum calculation across dictionary list and numpy input formats."""
    dict_forecast = [{"forecast_units": 10.0} for _ in range(7)] + \
                    [{"forecast_units": 15.0} for _ in range(16)] + \
                    [{"forecast_units": 5.0} for _ in range(7)]
    
    res = calculate_trend_momentum(dict_forecast)
    assert res["first_7_avg"] == 10.0
    assert res["last_7_avg"] == 5.0
    assert res["trend_pct"] == -50.0
    assert res["trend_direction"] == "Falling"

    # Numpy array input
    np_arr = np.array([10.0] * 7 + [10.0] * 16 + [18.0] * 7)
    res_np = calculate_trend_momentum(np_arr)
    assert res_np["trend_pct"] == 80.0
    assert res_np["trend_direction"] == "Rising"

