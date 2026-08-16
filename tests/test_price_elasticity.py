"""
Unit and integration tests for the Price Elasticity Engine and Pricing Analytics.
Covers:
- Log-log OLS elasticity estimation with Month and Day-of-Week controls
- Standard error, t-statistic, p-value, R-squared, and 95% Confidence Intervals
- Insufficient price variation and anti-leverage diagnostics
- Insufficient observations (< min_samples)
- Zero/negative/invalid data handling
- Scenario price, expected quantity, and revenue calculation
- Optional user-provided unit cost profit calculation
- Verification of no fabricated unit costs
- Non-causal association interpretations
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
            
    # Insufficient variation item (single fixed price)
    for i in range(25):
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

    # High dominance / leverage item (98% of tx at single price, 1 isolated bulk tx)
    for i in range(50):
        rows.append({
            "invoice": f"INV-DOM-{i}",
            "stock_code": "HIGH_DOMINANCE_ITEM",
            "description": "High Dominance Shelf Price Item",
            "quantity": 2,
            "price": 4.15,
            "invoice_date": "2023-02-10 10:00:00",
            "customer_id": 3000 + i,
            "country": "United Kingdom",
            "is_cancelled": 0
        })
    # 1 single wholesale bulk order at discounted price
    rows.append({
        "invoice": "INV-DOM-BULK",
        "stock_code": "HIGH_DOMINANCE_ITEM",
        "description": "High Dominance Shelf Price Item",
        "quantity": 200,
        "price": 3.75,
        "invoice_date": "2023-02-12 11:00:00",
        "customer_id": 3999,
        "country": "United Kingdom",
        "is_cancelled": 0
    })

    # Insufficient sample size item (< 20 tx)
    for i in range(8):
        rows.append({
            "invoice": f"INV-FEW-{i}",
            "stock_code": "FEW_TX_ITEM",
            "description": "Few Transactions Product",
            "quantity": 5,
            "price": 3.0 + (i % 2) * 0.5,
            "invoice_date": "2023-03-01 12:00:00",
            "customer_id": 4000 + i,
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
    assert "associated with" in res["interpretation"]
    assert "causes" not in res["interpretation"].lower()
    assert res["data_provenance"] == "Real historical transactions"


def test_95_percent_confidence_interval_math(price_variation_df):
    """Verifies that the 95% confidence interval is correctly calculated from beta and standard error."""
    engine = PriceElasticityEngine()
    res = engine.estimate_product_elasticity(price_variation_df, "ELASTIC_ITEM")
    
    beta = res["elasticity"]
    se = res["se"]
    ci_low = res["ci_lower"]
    ci_high = res["ci_upper"]
    
    assert beta is not None
    assert se is not None and se > 0
    assert ci_low < beta < ci_high
    # Difference should be symmetric around beta
    diff_low = round(beta - ci_low, 2)
    diff_high = round(ci_high - beta, 2)
    assert abs(diff_low - diff_high) <= 0.02


def test_insufficient_variation_fixed_price(price_variation_df):
    """Tests graceful handling when product price has zero variation."""
    engine = PriceElasticityEngine()
    res = engine.estimate_product_elasticity(price_variation_df, "FIXED_PRICE_ITEM")
    
    assert res is not None
    assert res["category"] == "Insufficient Variation"
    assert res["status"] == "Insufficient Price Variation"
    assert res["elasticity"] is None
    assert res["ci_lower"] is None
    assert res["ci_upper"] is None
    assert res["p_value"] is None
    assert "Insufficient price variation" in res["interpretation"]


def test_anti_leverage_high_dominance_check(price_variation_df):
    """Tests that high dominant price share (>85%) with single isolated secondary order is flagged."""
    engine = PriceElasticityEngine()
    res = engine.estimate_product_elasticity(price_variation_df, "HIGH_DOMINANCE_ITEM")
    
    assert res is not None
    assert res["status"] == "Insufficient Price Variation"
    assert res["category"] == "Insufficient Variation"
    assert res["elasticity"] is None
    assert "secondary price tier has only 1 observation" in res["interpretation"]


def test_insufficient_samples_handling(price_variation_df):
    """Tests graceful handling when product has fewer than min_samples (20) transactions."""
    engine = PriceElasticityEngine(min_samples=20)
    res = engine.estimate_product_elasticity(price_variation_df, "FEW_TX_ITEM")
    
    assert res is not None
    assert res["status"] == "Insufficient Data"
    assert res["category"] == "Insufficient Data"
    assert res["elasticity"] is None
    assert res["sample_size"] == 8
    assert "Fewer than 20 transactions" in res["interpretation"]


def test_zero_negative_and_cancelled_filtering():
    """Tests that zero, negative, and cancelled transactions are safely excluded."""
    engine = PriceElasticityEngine(min_samples=5)
    rows = [
        {"stock_code": "TEST_CLEAN", "price": 0.0, "quantity": 10, "is_cancelled": 0, "invoice_date": "2023-01-01"},
        {"stock_code": "TEST_CLEAN", "price": -5.0, "quantity": 10, "is_cancelled": 0, "invoice_date": "2023-01-01"},
        {"stock_code": "TEST_CLEAN", "price": 10.0, "quantity": -5, "is_cancelled": 0, "invoice_date": "2023-01-01"},
        {"stock_code": "TEST_CLEAN", "price": 10.0, "quantity": 10, "is_cancelled": 1, "invoice_date": "2023-01-01"},
    ]
    df_bad = pd.DataFrame(rows)
    res = engine.estimate_product_elasticity(df_bad, "TEST_CLEAN")
    
    assert res["sample_size"] == 0
    assert res["status"] == "Insufficient Data"
    assert res["elasticity"] is None


def test_price_scenario_simulation_with_user_cost():
    """Tests price change simulation with optional user-provided unit cost assumption."""
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
    
    assert sim["current_price"] == 10.0
    assert sim["new_price"] == 9.0
    assert sim["price_change_pct"] == -10.0
    assert sim["elasticity_used"] == -2.0
    assert sim["expected_quantity"] == 120.0  # +20%
    assert sim["baseline_revenue"] == 1000.0
    assert sim["expected_revenue"] == 9.0 * 120.0  # 1080.0 (+80)
    assert sim["revenue_difference"] == 80.0
    assert sim["revenue_diff_pct"] == 8.0
    assert sim["scenario_unit_cost"] == 5.0
    assert sim["baseline_profit"] == (10.0 - 5.0) * 100.0  # 500.0
    assert sim["scenario_profit"] == (9.0 - 5.0) * 120.0  # 480.0
    assert sim["profit_difference"] == -20.0
    assert "hypothetical user assumption" in sim["disclosure"]


def test_price_scenario_simulation_without_cost_no_fabrication():
    """Tests that when unit cost is not provided, profit fields remain None (never fabricated)."""
    engine = PriceElasticityEngine()
    current_price = 4.0
    current_qty = 50.0
    elasticity = -1.5
    
    sim = engine.simulate_price_scenario(
        current_price=current_price,
        baseline_quantity=current_qty,
        elasticity=elasticity,
        price_change_pct=10.0,
        scenario_unit_cost=None
    )
    
    assert sim["new_price"] == 4.40
    assert sim["expected_quantity"] == 50.0 * (1.0 - 0.15)  # 42.5
    assert sim["scenario_unit_cost"] is None
    assert sim["baseline_profit"] is None
    assert sim["scenario_profit"] is None
    assert sim["profit_difference"] is None


def test_optimize_price_profit_maximisation():
    """Tests that mathematical optimisation correctly identifies profit-maximising price given unit cost."""
    engine = PriceElasticityEngine()
    # At P0 = 10, Q0 = 100, beta = -2.0, unit cost c = 6.0:
    # Q(P) = 100 * (1 - 2 * (P - 10)/10) = 300 - 20 P
    # Profit(P) = (P - 6) * (300 - 20 P) = -20 P^2 + 420 P - 1800
    # dProfit/dP = -40 P + 420 = 0 => P* = 10.50
    opt = engine.optimize_price(
        current_price=10.0,
        baseline_quantity=100.0,
        elasticity=-2.0,
        objective="profit",
        unit_cost=6.0
    )
    
    assert opt["recommended_price"] == 10.50
    assert opt["expected_30d_quantity"] == 90.0
    assert opt["expected_30d_revenue"] == 10.50 * 90.0  # 945.00
    assert opt["expected_30d_cost"] == 6.0 * 90.0       # 540.00
    assert opt["expected_30d_profit"] == 405.00        # vs baseline 400.00 (+5.00)
    assert opt["profit_difference"] == 5.00
    assert opt["profit_margin_pct"] == round((405.0 / 945.0) * 100.0, 1)  # 42.9%


def test_optimize_price_revenue_maximisation():
    """Tests that mathematical optimisation correctly identifies revenue-maximising price."""
    engine = PriceElasticityEngine()
    # At P0 = 10, Q0 = 100, beta = -2.0:
    # Q(P) = 300 - 20 P
    # Revenue(P) = 300 P - 20 P^2
    # dRev/dP = 300 - 40 P = 0 => P* = 7.50
    opt = engine.optimize_price(
        current_price=10.0,
        baseline_quantity=100.0,
        elasticity=-2.0,
        objective="revenue",
        unit_cost=None
    )
    
    assert opt["recommended_price"] == 7.50
    assert opt["expected_30d_quantity"] == 150.0
    assert opt["expected_30d_revenue"] == 7.50 * 150.0  # 1125.00 (vs baseline 1000.00, +125.00)
    assert opt["revenue_difference"] == 125.00
    assert opt["expected_30d_profit"] is None  # Cost not supplied => profit is None


def test_profit_vs_revenue_objective_divergence():
    """Verifies that profit and revenue objectives yield different recommendations based on unit cost."""
    engine = PriceElasticityEngine()
    opt_rev = engine.optimize_price(
        current_price=10.0,
        baseline_quantity=100.0,
        elasticity=-2.0,
        objective="revenue",
        unit_cost=6.0
    )
    opt_prof = engine.optimize_price(
        current_price=10.0,
        baseline_quantity=100.0,
        elasticity=-2.0,
        objective="profit",
        unit_cost=6.0
    )
    
    # Revenue objective seeks volume expansion (P* = 7.50)
    # Profit objective defends unit margin (P* = 10.50)
    assert opt_rev["recommended_price"] == 7.50
    assert opt_prof["recommended_price"] == 10.50
    assert opt_prof["recommended_price"] > opt_rev["recommended_price"]
    assert opt_prof["expected_30d_profit"] > opt_rev["expected_30d_profit"]


def test_optimize_price_boundary_condition():
    """Verifies that when optimal point lies at edge of search bounds, boundary flag is raised."""
    engine = PriceElasticityEngine()
    # With highly inelastic demand (beta = -0.1), higher price always yields higher revenue
    opt = engine.optimize_price(
        current_price=10.0,
        baseline_quantity=100.0,
        elasticity=-0.1,
        objective="revenue",
        min_price_factor=0.50,
        max_price_factor=1.50
    )
    
    assert opt["recommended_price"] == 15.00  # Hits upper bound (150%)
    assert opt["is_at_boundary"] is True
    assert "Optimal price is at the edge of the tested search range" in opt["boundary_note"]


def test_optimize_price_negative_quantity_protection():
    """Verifies that expected quantities cannot become negative even under large price increases."""
    engine = PriceElasticityEngine()
    opt = engine.optimize_price(
        current_price=10.0,
        baseline_quantity=100.0,
        elasticity=-15.0,  # Extreme elasticity
        objective="revenue",
        min_price_factor=0.50,
        max_price_factor=2.00
    )
    
    assert opt["expected_30d_quantity"] >= 5.0  # Protected by 0.05 floor factor
    assert opt["expected_30d_revenue"] >= 0.0


def test_optimize_price_zero_unit_cost():
    """Verifies that a unit cost of £0.00 is valid (digital/marginal-cost-free goods)."""
    engine = PriceElasticityEngine()
    opt = engine.optimize_price(
        current_price=10.0,
        baseline_quantity=100.0,
        elasticity=-2.0,
        objective="profit",
        unit_cost=0.0
    )
    
    # When cost = 0, Profit = Revenue, so P* = 7.50
    assert opt["recommended_price"] == 7.50
    assert opt["expected_30d_cost"] == 0.00
    assert opt["expected_30d_profit"] == opt["expected_30d_revenue"]
    assert opt["profit_margin_pct"] == 100.0


def test_optimize_price_unit_cost_exceeds_price():
    """Verifies handling when unit cost exceeds historical selling price."""
    engine = PriceElasticityEngine()
    opt = engine.optimize_price(
        current_price=5.0,
        baseline_quantity=50.0,
        elasticity=-1.2,
        objective="profit",
        unit_cost=7.0  # Unit cost higher than historical selling price
    )
    
    assert opt is not None
    assert opt["unit_cost"] == 7.0
    assert opt["baseline_30d_profit"] < 0  # Historical baseline was running at a loss
    assert opt["expected_30d_profit"] is not None

