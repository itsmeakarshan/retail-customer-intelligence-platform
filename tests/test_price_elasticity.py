"""
Unit and integration tests for the Price Elasticity Engine.
"""
import pytest
import pandas as pd
import numpy as np

from ml.src.pricing.price_elasticity import PriceElasticityEngine


@pytest.fixture
def price_variation_df():
    """Generates synthetic transactions with deliberate negative log-log price sensitivity."""
    np.random.seed(42)
    rows = []
    # True elasticity beta ≈ -1.5
    prices = [2.0, 2.5, 3.0, 3.5, 4.0]
    
    for p in prices:
        for i in range(15):
            log_p = np.log(p)
            log_q = 5.0 - 1.5 * log_p + np.random.normal(0, 0.1)
            q = max(1, int(np.exp(log_q)))
            rows.append({
                "invoice": f"INV-{p}-{i}",
                "stock_code": "ELASTIC_ITEM",
                "description": "Elastic Product Test",
                "quantity": q,
                "price": p,
                "invoice_date": f"2023-0{1 + (i % 6)}-15 12:00:00",
                "customer_id": 1000 + i,
                "country": "United Kingdom",
                "is_cancelled": 0
            })
            
    # Insufficient variation item
    for i in range(20):
        rows.append({
            "invoice": f"INV-FIXED-{i}",
            "stock_code": "FIXED_PRICE_ITEM",
            "description": "Fixed Price Product",
            "quantity": 10,
            "price": 5.0,
            "invoice_date": "2023-01-15 12:00:00",
            "customer_id": 2000 + i,
            "country": "United Kingdom",
            "is_cancelled": 0
        })
        
    return pd.DataFrame(rows)


def test_log_log_regression_estimation(price_variation_df):
    """Tests OLS log-log estimation with p-value and confidence interval."""
    engine = PriceElasticityEngine()
    res = engine.estimate_product_elasticity(price_variation_df, "ELASTIC_ITEM")
    
    assert res is not None
    assert res["status"] == "Success"
    assert res["elasticity"] < -1.0  # Elastic
    assert res["p_value"] < 0.05    # Statistically significant
    assert res["ci_lower"] <= res["elasticity"]
    assert res["ci_upper"] >= res["elasticity"]
    assert "Elastic" in res["category"]


def test_insufficient_variation_handling(price_variation_df):
    """Tests graceful handling when price has zero variation."""
    engine = PriceElasticityEngine()
    res = engine.estimate_product_elasticity(price_variation_df, "FIXED_PRICE_ITEM")
    
    assert res is not None
    assert res["category"] == "Insufficient Variation"
    assert res["elasticity"] is None


def test_price_scenario_simulation():
    """Tests price change simulation (-10% discount on elastic good boosts revenue)."""
    engine = PriceElasticityEngine()
    current_price = 10.0
    current_qty = 100.0
    elasticity = -2.0  # -10% price -> +20% quantity
    
    sim = engine.simulate_price_scenario(
        current_price=current_price,
        baseline_quantity=current_qty,
        elasticity=elasticity,
        price_change_pct=-10.0,
        scenario_unit_cost=5.0
    )
    
    assert sim["new_price"] == 9.0
    assert sim["expected_quantity"] == 120.0  # +20%
    assert sim["expected_revenue"] == 9.0 * 120.0  # 1080.0 vs current 1000.0 (+80)
    assert sim["revenue_difference"] == 80.0
    assert sim["scenario_profit"] is not None
    assert sim["scenario_profit"] == (9.0 - 5.0) * 120.0  # 480.0 vs baseline 500.0
