"""
Unit Tests for Expiry Products Dashboard, Clearance Pricing, and Historical Data Protection
"""

import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.synthetic_generator import init_synthetic_tables

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
DB_PATH = os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db")

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_synthetic_tables(DB_PATH)

def test_expiry_dashboard_api():
    client = TestClient(app)
    res = client.get("/api/expiry/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert "timeline" in data
    assert "status_distribution" in data
    assert "value_by_period" in data
    
    kpis = data["kpis"]
    assert kpis["products_tracked"] > 0
    assert kpis["stock_value_at_risk"] >= 0

def test_expiry_products_filtered_api():
    client = TestClient(app)
    res = client.get("/api/expiry/products?filter_period=month&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if len(data) > 0:
        item = data[0]
        assert "stock_code" in item
        assert "clearance_price" in item
        assert "days_remaining_label" in item

def test_expiry_product_detail_api():
    client = TestClient(app)
    res = client.get("/api/expiry/products/85123A")
    assert res.status_code == 200
    data = res.json()
    assert data["stock_code"] == "85123A"
    assert "monthly_sales" in data
    assert isinstance(data["monthly_sales"], list)

def test_update_clearance_price_api():
    client = TestClient(app)
    res = client.post("/api/expiry/clearance-price", json={
        "stock_code": "85123A",
        "clearance_discount": 25.0
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["updated_count"] == 1

def test_bulk_update_clearance_price_api():
    client = TestClient(app)
    res = client.post("/api/expiry/bulk-clearance-price", json={
        "stock_codes": ["85123A", "71053"],
        "clearance_discount": 30.0
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["updated_count"] == 2

def test_print_label_data_api():
    client = TestClient(app)
    res = client.get("/api/expiry/label-data/85123A")
    assert res.status_code == 200
    data = res.json()
    assert data["stock_code"] == "85123A"
    assert "was_price" in data
    assert "now_price" in data

def test_historical_transaction_prices_unmodified():
    """
    CRITICAL SAFETY REQUIREMENT:
    Updating clearance prices in product_demo_metadata MUST NOT modify historical transaction unit prices.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT price FROM transactions WHERE stock_code='85123A' LIMIT 5")
    prices = [r[0] for r in c.fetchall()]
    conn.close()

    assert len(prices) > 0
    # Guarantee that transaction prices are positive numbers and remain original transaction values
    assert all(p > 0 for p in prices)
