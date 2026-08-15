"""
Pipeline Integration Test for tests/sample_100_customers.csv.
Exercises the entire CSV Upload & Analytics Processing Pipeline end-to-end.
"""
import os
import io
import json
import zipfile
import pytest
import pandas as pd
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.csv_processor import csv_processor, UPLOADS_DIR
from backend.app.services.retail_intelligence_service import retail_intelligence_service

client = TestClient(app)
SAMPLE_CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "sample_100_customers.csv"))


def test_sample_csv_file_integrity():
    """Verifies basic structure and requirements of sample_100_customers.csv."""
    assert os.path.exists(SAMPLE_CSV_PATH), f"File {SAMPLE_CSV_PATH} not found"
    df = pd.read_csv(SAMPLE_CSV_PATH)
    
    assert len(df) > 1000
    assert df["CustomerID"].nunique() == 100
    assert df["StockCode"].nunique() >= 20
    assert "Invoice" in df.columns
    assert "StockCode" in df.columns
    assert "Description" in df.columns
    assert "Quantity" in df.columns
    assert "InvoiceDate" in df.columns
    assert "Price" in df.columns
    assert "CustomerID" in df.columns
    assert "Country" in df.columns


def test_full_pipeline_execution():
    """Runs sample_100_customers.csv through the entire end-to-end processing pipeline."""
    with open(SAMPLE_CSV_PATH, "rb") as f:
        file_bytes = f.read()

    # Step 1: Validate & Stage
    files = {"file": ("sample_100_customers.csv", io.BytesIO(file_bytes), "text/csv")}
    val_response = client.post("/api/upload/validate", files=files)
    assert val_response.status_code == 200
    val_data = val_response.json()
    
    assert val_data["is_valid"] is True
    assert val_data["unique_customers"] == 100
    assert val_data["quality_score"] >= 80
    session_id = val_data["session_id"]
    session_dir = os.path.join(UPLOADS_DIR, session_id)

    # Step 2: Process Staged CSV
    proc_response = client.post(f"/api/upload/process/{session_id}")
    assert proc_response.status_code == 200
    proc_data = proc_response.json()
    
    assert proc_data["status"] == "complete"
    assert proc_data["unique_customers"] == 100
    assert proc_data["total_expected_30d_revenue"] > 0
    assert proc_data["total_company_may_lose_30d"] > 0
    assert len(proc_data["segments_summary"]) > 0
    assert len(proc_data["top_exposure_accounts"]) > 0

    # Step 3: Verify Output Files Exist on Disk
    expected_files = [
        "cleaned_transactions.csv",
        "customer_features.csv",
        "customer_predictions.csv",
        "customer_segmentation.csv",
        "revenue_risk_results.csv",
        "data_quality_report.csv",
        "demand_forecast.csv",
        "inventory_recommendations.csv",
        "price_elasticity.csv",
        "monitoring_report.csv",
        "full_analysis_workbook.xlsx",
        "results_bundle.zip"
    ]
    for fname in expected_files:
        fpath = os.path.join(session_dir, fname)
        assert os.path.exists(fpath), f"Expected file {fname} not generated in {session_dir}"
        assert os.path.getsize(fpath) > 0, f"File {fname} is empty"

    # Step 4: Verify Multi-Discipline Retail Intelligence for this Uploaded Session
    
    # 4a. Demand Forecasting
    fc_sum = client.get(f"/api/forecasting/summary?dashboard_id={session_id}")
    assert fc_sum.status_code == 200
    fc_sum_data = fc_sum.json()
    assert fc_sum_data["products_forecasted"] > 0
    assert fc_sum_data["total_expected_30d_units"] > 0

    fc_prods = client.get(f"/api/forecasting/products?dashboard_id={session_id}&limit=10")
    assert fc_prods.status_code == 200
    assert len(fc_prods.json()) > 0
    
    # 4b. Inventory Optimisation
    inv_sum = client.get(f"/api/inventory/summary?dashboard_id={session_id}")
    assert inv_sum.status_code == 200
    inv_sum_data = inv_sum.json()
    assert inv_sum_data["total_products_analysed"] > 0

    inv_recs = client.get(f"/api/inventory/recommendations?dashboard_id={session_id}&limit=10")
    assert inv_recs.status_code == 200
    assert len(inv_recs.json()) > 0

    # 4c. Price Analytics & Elasticity
    pr_sum = client.get(f"/api/pricing/summary?dashboard_id={session_id}")
    assert pr_sum.status_code == 200
    pr_sum_data = pr_sum.json()
    assert pr_sum_data["total_products_analysed"] > 0

    pr_prods = client.get(f"/api/pricing/products?dashboard_id={session_id}&limit=10")
    assert pr_prods.status_code == 200
    assert len(pr_prods.json()) > 0

    # 4d. Monitoring & Drift
    mon_sum = client.get(f"/api/monitoring/summary?dashboard_id={session_id}")
    assert mon_sum.status_code == 200
    mon_sum_data = mon_sum.json()
    assert "overall_system_health" in mon_sum_data

    # Step 5: Verify Downloads
    download_endpoints = [
        f"/api/upload/download/{session_id}/bundle",
        f"/api/upload/download/{session_id}/workbook_excel",
        f"/api/upload/download/{session_id}/cleaned",
        f"/api/upload/download/{session_id}/predictions",
        f"/api/upload/download/{session_id}/segmentation",
        f"/api/upload/download/{session_id}/revenue_risk",
        f"/api/upload/download/{session_id}/quality_report",
        f"/api/forecasting/download?dashboard_id={session_id}",
        f"/api/inventory/download?dashboard_id={session_id}",
        f"/api/pricing/download?dashboard_id={session_id}",
        f"/api/monitoring/download?dashboard_id={session_id}"
    ]
    for ep in download_endpoints:
        dl_res = client.get(ep)
        assert dl_res.status_code == 200, f"Download endpoint {ep} failed with status {dl_res.status_code}"
        assert len(dl_res.content) > 0

    # Step 6: Verify ZIP Bundle Content
    zip_res = client.get(f"/api/upload/download/{session_id}/bundle")
    with zipfile.ZipFile(io.BytesIO(zip_res.content)) as zf:
        names = zf.namelist()
        assert "cleaned_transactions.csv" in names
        assert "customer_predictions.csv" in names
        assert "customer_segmentation.csv" in names
        assert "revenue_risk_results.csv"
        assert "demand_forecast.csv" in names
        assert "inventory_recommendations.csv" in names
        assert "price_elasticity.csv" in names
        assert "monitoring_report.csv" in names
        assert "full_analysis_workbook.xlsx" in names
