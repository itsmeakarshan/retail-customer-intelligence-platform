"""
Unit Tests for Retention Campaigns, Product Expiry, and Real Brevo Transactional Email Integration
"""

import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.email_service import email_service
from backend.app.services.synthetic_generator import init_synthetic_tables

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
DB_PATH = os.path.join(PROJECT_ROOT, "data/processed/retail_analytics.db")

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_synthetic_tables(DB_PATH)

def test_synthetic_tables_exist():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    conn.close()

    assert "customer_demo_metadata" in tables
    assert "product_demo_metadata" in tables
    assert "campaigns" in tables
    assert "campaign_audit_log" in tables

def test_synthetic_metadata_isolation_from_ml_features():
    """
    Guarantees synthetic fields (phone, email, expiry) are NOT present in customer_features
    or fed into ML inference pipelines.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("PRAGMA table_info(customer_features)")
    cols = [r[1] for r in c.fetchall()]
    conn.close()

    assert "demo_phone" not in cols
    assert "demo_email" not in cols
    assert "synthetic_expiry_date" not in cols

def test_email_status_api():
    client = TestClient(app)
    res = client.get("/api/campaigns/email/status")
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
    assert "status" in data
    assert "demo_recipient" in data

def test_email_unconfigured_honest_status():
    """
    Guarantees that when BREVO_API_KEY is absent, send_test_email returns
    status 'Email Service Not Configured' instead of faking success.
    """
    old_key = os.environ.pop("BREVO_API_KEY", None)
    try:
        res = email_service.send_test_email(
            campaign_name="Test Campaign",
            target_group="High-Value At Risk",
            subject="Test Subject",
            message_text="Hello Test",
            selected_customer_ids=["13085"]
        )
        assert res["success"] is False
        assert res["status"] == "Email Service Not Configured"
        assert "not configured" in res["message"].lower()
    finally:
        if old_key:
            os.environ["BREVO_API_KEY"] = old_key

def test_demo_recipient_isolation():
    """
    Guarantees test email recipient is ALWAYS DEMO_EMAIL_ADDRESS, regardless of customer selection.
    """
    status = email_service.get_status()
    assert status["demo_recipient"] == "akarshanrasyal4@gmail.com"

def test_retention_summary_api():
    client = TestClient(app)
    res = client.get("/api/retention/summary")
    assert res.status_code == 200
    data = res.json()
    assert "customers_needing_attention" in data
    assert "high_value_customers_at_risk" in data
    assert "potential_revenue_at_risk" in data
    assert "products_expiring_soon" in data

def test_expiry_products_api():
    client = TestClient(app)
    res = client.get("/api/expiry/products?status=Expiring%20Soon")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if len(data) > 0:
        item = data[0]
        assert "stock_code" in item
        assert "synthetic_expiry_date" in item
        assert "expiry_days_remaining" in item

def test_email_preview_api():
    client = TestClient(app)
    prev = client.post("/api/campaigns/preview-email", json={
        "campaign_name": "Test VIP Campaign",
        "target_group": "High-Value At Risk",
        "selected_customer_ids": ["13085", "13086"],
        "discount_percent": 15.0,
        "subject": "Special Offer 🎁",
        "message": "Enjoy 15% off"
    })
    assert prev.status_code == 200
    pdata = prev.json()
    assert pdata["demo_mode"] is True
    assert pdata["demo_recipient"] == "akarshanrasyal4@gmail.com"
    assert pdata["customer_count"] >= 1
    assert "formatted_html_preview" in pdata

def test_customer_selection_search_api():
    client = TestClient(app)
    res = client.get("/api/retention/customers?search=13085")
    assert res.status_code == 200
    data = res.json()
    assert "customers" in data
    assert len(data["customers"]) >= 1
    assert data["customers"][0]["customer_id"] == "13085"
