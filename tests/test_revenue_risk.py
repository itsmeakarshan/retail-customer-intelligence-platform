"""
Unit & Integration Tests for 30-Day Revenue Horizon & Business Metrics
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_summary_30d_revenue_metrics():
    response = client.get("/api/summary")
    assert response.status_code == 200
    data = response.json()
    
    # Check 30-day fields exist
    assert "total_expected_30d_revenue" in data
    assert "total_company_may_lose_30d" in data
    assert "loss_percentage_30d" in data
    
    # Check mathematical relationship
    exp_30d = data["total_expected_30d_revenue"]
    lose_30d = data["total_company_may_lose_30d"]
    loss_pct = data["loss_percentage_30d"]
    
    # Expected spend should be predicted 90d value / 3.0
    assert exp_30d == pytest.approx(data["total_predicted_future_value"] / 3.0, 0.05)
    # Company May Lose should be revenue at risk / 3.0
    assert lose_30d == pytest.approx(data["total_revenue_at_risk"] / 3.0, 0.05)
    # Loss percentage should be (company_may_lose / expected_30d) * 100
    expected_pct = round((lose_30d / exp_30d) * 100, 1)
    assert loss_pct == pytest.approx(expected_pct, 0.2)
    # Loss cannot exceed expected revenue
    assert lose_30d <= exp_30d

def test_revenue_risk_breakdown_30d_metrics():
    response = client.get("/api/revenue-risk")
    assert response.status_code == 200
    data = response.json()
    
    for seg in data["by_segment"]:
        assert "expected_30d_revenue" in seg
        assert "company_may_lose_30d" in seg
        assert "loss_percentage_30d" in seg
        assert seg["company_may_lose_30d"] <= seg["expected_30d_revenue"]

    for ctry in data["by_country"]:
        assert "expected_30d_revenue" in ctry
        assert "company_may_lose_30d" in ctry
        assert "loss_percentage_30d" in ctry
        assert ctry["company_may_lose_30d"] <= ctry["expected_30d_revenue"]

def test_customer_list_30d_metrics():
    response = client.get("/api/customers?limit=10")
    assert response.status_code == 200
    data = response.json()
    
    for cust in data["customers"]:
        assert "expected_30d_revenue" in cust
        assert "company_may_lose_30d" in cust
        assert "loss_percentage_30d" in cust
        assert cust["expected_30d_revenue"] == pytest.approx(cust["predicted_future_value"] / 3.0, 0.05)
        assert cust["company_may_lose_30d"] == pytest.approx(cust["revenue_at_risk"] / 3.0, 0.05)

def test_retention_summary_30d_metrics():
    response = client.get("/api/retention/summary")
    assert response.status_code == 200
    data = response.json()
    
    assert "total_expected_30d_revenue" in data
    assert "company_may_lose_30d" in data
    assert "loss_percentage_30d" in data
    assert data["company_may_lose_30d"] <= data["total_expected_30d_revenue"]
