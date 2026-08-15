"""
Unit and integration tests for the Inventory Optimisation Engine.
"""
import pytest
from ml.src.forecasting.inventory_optimizer import InventoryOptimizer, SERVICE_LEVEL_Z


def test_service_level_z_values():
    """Tests standard normal z values for service levels."""
    assert SERVICE_LEVEL_Z[0.90] == 1.282
    assert SERVICE_LEVEL_Z[0.95] == 1.645
    assert SERVICE_LEVEL_Z[0.98] == 2.054
    assert SERVICE_LEVEL_Z[0.99] == 2.326


def test_inventory_calculation_replenishment_needed():
    """Tests ROP, Safety Stock, and Suggested Order when stock is low."""
    optimizer = InventoryOptimizer(default_lead_time_days=7, default_service_level=0.95)
    
    item = optimizer.calculate_item_inventory(
        stock_code="TEST_ITEM",
        description="Test Item",
        expected_30d_demand=300.0,
        daily_demand_std=5.0,
        unit_price=10.0,
        current_stock=50,
        lead_time_days=7,
        service_level=0.95
    )
    
    assert item["stock_code"] == "TEST_ITEM"
    assert item["safety_stock"] > 0
    assert item["reorder_point"] > 50
    assert item["status"] == "Replenishment Needed"
    assert item["suggested_order"] > 0
    assert item["order_cost_scenario"] == item["suggested_order"] * 10.0


def test_inventory_calculation_excess_stock():
    """Tests status when current stock significantly exceeds 60-day demand."""
    optimizer = InventoryOptimizer()
    
    item = optimizer.calculate_item_inventory(
        stock_code="EXCESS_ITEM",
        description="Excess Item",
        expected_30d_demand=100.0,
        daily_demand_std=2.0,
        unit_price=5.0,
        current_stock=1000,
        lead_time_days=7,
        service_level=0.95
    )
    
    assert item["status"] == "Excess Stock"
    assert item["suggested_order"] == 0


def test_inventory_expiry_risk_alert():
    """Tests expiry integration to trigger alert and halt replenishment."""
    optimizer = InventoryOptimizer()
    
    item = optimizer.calculate_item_inventory(
        stock_code="EXP_ITEM",
        description="Expiring Item",
        expected_30d_demand=300.0,  # 10/day
        daily_demand_std=3.0,
        unit_price=8.0,
        current_stock=100,  # Low stock, but expires in 5 days (expected demand 50)
        lead_time_days=7,
        service_level=0.95,
        expiry_days_remaining=5,
        expiry_status="Critical"
    )
    
    assert item["expiry_risk_alert"] is not None
    assert item["expiry_risk_alert"]["is_high_risk"] is True
    assert item["expiry_risk_alert"]["units_at_risk"] == 50
    assert item["suggested_order"] == 0  # Replenishment halted to prevent waste
