"""
Integration tests for the new Retail Intelligence REST Endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_forecasting_summary_endpoint():
    """Tests GET /api/forecasting/summary."""
    response = client.get("/api/forecasting/summary?dashboard_id=default")
    assert response.status_code == 200
    data = response.json()
    assert "products_forecasted" in data
    assert "total_expected_30d_units" in data
    assert "avg_mae" in data
    assert "products_rising_demand" in data


def test_forecasting_products_endpoint():
    """Tests GET /api/forecasting/products."""
    response = client.get("/api/forecasting/products?dashboard_id=default&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "stock_code" in first
    assert "expected_30d_demand" in first
    assert "recent_30d_demand" in first


def test_forecasting_product_detail_endpoint():
    """Tests GET /api/forecasting/product/{stock_code}."""
    response = client.get("/api/forecasting/product/85123A?dashboard_id=default")
    assert response.status_code == 200
    data = response.json()
    assert data["stock_code"] == "85123A"
    assert "history" in data
    assert "forecast" in data
    assert len(data["forecast"]) == 30
    first_f = data["forecast"][0]
    assert "forecast_units" in first_f
    assert "lower_bound" in first_f
    assert "upper_bound" in first_f


def test_inventory_summary_endpoint():
    """Tests GET /api/inventory/summary."""
    response = client.get("/api/inventory/summary?dashboard_id=default")
    assert response.status_code == 200
    data = response.json()
    assert "total_products_analysed" in data
    assert "replenishment_needed_count" in data
    assert "total_suggested_order_units" in data


def test_inventory_simulate_endpoint():
    """Tests POST /api/inventory/simulate."""
    payload = {
        "stock_code": "85123A",
        "current_stock": 150,
        "lead_time_days": 10,
        "service_level": 0.95,
        "holding_cost_pct": 0.20
    }
    response = client.post("/api/inventory/simulate?dashboard_id=default", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["stock_code"] == "85123A"
    assert "safety_stock" in data
    assert "reorder_point" in data
    assert "suggested_order" in data


def test_pricing_summary_endpoint():
    """Tests GET /api/pricing/summary."""
    response = client.get("/api/pricing/summary?dashboard_id=default")
    assert response.status_code == 200
    data = response.json()
    assert "total_products_analysed" in data
    assert "elastic_products_count" in data
    assert "inelastic_products_count" in data


def test_pricing_simulate_endpoint():
    """Tests POST /api/pricing/simulate."""
    payload = {
        "stock_code": "85123A",
        "price_change_pct": -10.0,
        "scenario_unit_cost": 1.50
    }
    response = client.post("/api/pricing/simulate?dashboard_id=default", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["stock_code"] == "85123A"
    assert "new_price" in data
    assert "expected_quantity" in data
    assert "revenue_difference" in data


def test_monitoring_summary_endpoint():
    """Tests GET /api/monitoring/summary."""
    response = client.get("/api/monitoring/summary?dashboard_id=default")
    assert response.status_code == 200
    data = response.json()
    assert "overall_system_health" in data
    assert "feature_drift_results" in data
    assert "demand_alerts" in data


def test_csv_download_endpoints():
    """Tests the new CSV export download endpoints."""
    # Forecast CSV
    fc_resp = client.get("/api/forecasting/download?dashboard_id=default")
    assert fc_resp.status_code == 200
    assert "text/csv" in fc_resp.headers["content-type"]
    assert "stock_code" in fc_resp.text

    # Inventory CSV
    inv_resp = client.get("/api/inventory/download?dashboard_id=default")
    assert inv_resp.status_code == 200
    assert "text/csv" in inv_resp.headers["content-type"]
    assert "reorder_point" in inv_resp.text

    # Pricing CSV
    pr_resp = client.get("/api/pricing/download?dashboard_id=default")
    assert pr_resp.status_code == 200
    assert "text/csv" in pr_resp.headers["content-type"]
    assert "elasticity" in pr_resp.text

    # Monitoring CSV
    mon_resp = client.get("/api/monitoring/download?dashboard_id=default")
    assert mon_resp.status_code == 200
    assert "text/csv" in mon_resp.headers["content-type"]
    assert "feature_name" in mon_resp.text
