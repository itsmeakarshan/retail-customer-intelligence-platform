"""
Automated Integration Tests for FastAPI Backend Endpoints
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert "database_connected" in data
    assert "models_loaded" in data

def test_summary_endpoint():
    response = client.get("/api/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_customers"] > 0
    assert "total_revenue_at_risk" in data
    assert "overall_churn_rate" in data

def test_customers_list_endpoint():
    response = client.get("/api/customers?limit=10&page=1")
    assert response.status_code == 200
    data = response.json()
    assert "customers" in data
    assert len(data["customers"]) <= 10
    assert data["total"] > 0

def test_customer_detail_and_risk_endpoints():
    # Fetch first customer ID
    list_res = client.get("/api/customers?limit=1")
    cust_id = list_res.json()["customers"][0]["customer_id"]
    
    # Test Detail
    detail_res = client.get(f"/api/customers/{cust_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["customer_id"] == cust_id
    
    # Test Risk
    risk_res = client.get(f"/api/customers/{cust_id}/risk")
    assert risk_res.status_code == 200
    assert "churn_probability" in risk_res.json()
    
    # Test Explanation
    exp_res = client.get(f"/api/customers/{cust_id}/explanation")
    assert exp_res.status_code == 200
    assert "top_risk_drivers" in exp_res.json()

def test_invalid_customer():
    res = client.get("/api/customers/NON_EXISTENT_ID_9999999")
    assert res.status_code == 404

def test_segments_endpoint():
    res = client.get("/api/segments")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) > 0

def test_revenue_risk_endpoint():
    res = client.get("/api/revenue-risk")
    assert res.status_code == 200
    data = res.json()
    assert "by_segment" in data
    assert "by_risk_level" in data

def test_model_metrics_endpoint():
    res = client.get("/api/model-metrics")
    assert res.status_code == 200
    assert "churn_classification" in res.json()

def test_chat_status_endpoint():
    res = client.get("/api/chat/status")
    assert res.status_code == 200
    assert "available" in res.json()

def test_chat_endpoint_fallback():
    res = client.post("/api/chat", json={"query": "Who needs my attention?"})
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "available" in data
