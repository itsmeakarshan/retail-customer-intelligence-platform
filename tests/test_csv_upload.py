"""
Unit & Integration Tests for Reusable CSV Upload & Analytics Feature
"""
import os
import io
import json
import zipfile
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.csv_processor import csv_processor

client = TestClient(app)

SAMPLE_VALID_CSV = (
    "Invoice,StockCode,Description,Quantity,InvoiceDate,Price,CustomerID,Country\n"
    "536365,85123A,WHITE HANGING HEART T-LIGHT HOLDER,6,2011-01-05 08:26:00,2.55,17850,United Kingdom\n"
    "536365,71053,WHITE METAL LANTERN,6,2011-01-05 08:26:00,3.39,17850,United Kingdom\n"
    "536367,84879,ASSORTED COLOUR BIRD ORNAMENT,32,2011-01-06 09:15:00,1.69,13047,United Kingdom\n"
    "C536379,D,Discount,-1,2011-01-06 10:12:00,27.50,14527,United Kingdom\n"
    "536368,22960,JAM MAKING SET WITH JARS,6,2011-02-10 11:20:00,4.25,17850,United Kingdom\n"
)

SAMPLE_INVALID_CSV = (
    "StockCode,Description,Quantity,Price,Country\n"
    "85123A,WHITE HANGING HEART,6,2.55,United Kingdom\n"
)

def test_download_csv_template_endpoint():
    response_csv = client.get("/api/upload/template?format=csv")
    assert response_csv.status_code == 200
    assert response_csv.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Invoice,StockCode,Description,Quantity,InvoiceDate,Price,CustomerID,Country" in response_csv.text

    response_excel = client.get("/api/upload/template")
    assert response_excel.status_code == 200
    assert response_excel.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

def test_validate_valid_csv_endpoint():
    files = {"file": ("test_upload.csv", io.BytesIO(SAMPLE_VALID_CSV.encode("utf-8")), "text/csv")}
    response = client.post("/api/upload/validate", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert "session_id" in data
    assert data["total_rows"] == 5
    assert data["unique_customers"] == 3
    assert data["quality_score"] > 50
    assert len(data["preview_rows"]) == 5

def test_validate_missing_columns_endpoint():
    files = {"file": ("invalid_upload.csv", io.BytesIO(SAMPLE_INVALID_CSV.encode("utf-8")), "text/csv")}
    response = client.post("/api/upload/validate", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is False
    assert "Missing required columns" in data["error_message"]

def test_download_excel_template_endpoint():
    response = client.get("/api/upload/template-excel")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(response.content) > 500

def test_process_uploaded_csv_and_excel_workflow():
    # 1. Validate CSV
    files = {"file": ("workflow_test.csv", io.BytesIO(SAMPLE_VALID_CSV.encode("utf-8")), "text/csv")}
    val_resp = client.post("/api/upload/validate", files=files)
    assert val_resp.status_code == 200
    session_id = val_resp.json()["session_id"]
    
    # 2. Process
    proc_resp = client.post(f"/api/upload/process/{session_id}")
    assert proc_resp.status_code == 200
    data = proc_resp.json()
    
    assert data["status"] == "complete"
    assert data["unique_customers"] > 0
    assert data["total_expected_30d_revenue"] >= 0
    assert data["total_company_may_lose_30d"] >= 0
    assert "segments_summary" in data
    assert len(data["top_exposure_accounts"]) > 0

    # 3. Test Download endpoints for CSV & Excel files
    excel_file_types = [
        "cleaned", "cleaned_excel", "predictions", "predictions_excel",
        "segmentation", "segmentation_excel", "revenue_risk", "revenue_risk_excel",
        "quality_report", "quality_report_excel", "workbook_excel", "bundle"
    ]
    for ftype in excel_file_types:
        dl_resp = client.get(f"/api/upload/download/{session_id}/{ftype}")
        assert dl_resp.status_code == 200, f"Download for {ftype} failed"
        assert len(dl_resp.content) > 0

    # Test ZIP bundle content contains Excel files
    zip_resp = client.get(f"/api/upload/download/{session_id}/bundle")
    with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as zf:
        namelist = zf.namelist()
        assert "cleaned_transactions.csv" in namelist
        assert "customer_predictions.csv" in namelist
        assert "cleaned_transactions.xlsx" in namelist
        assert "customer_predictions.xlsx" in namelist
        assert "full_analysis_workbook.xlsx" in namelist

def test_original_db_and_ml_models_isolation():
    # Ensure original summary endpoint still returns exact baseline numbers
    sum_resp = client.get("/api/summary")
    assert sum_resp.status_code == 200
    sum_data = sum_resp.json()
    assert sum_data["total_customers"] == 5344
    assert sum_data["total_expected_30d_revenue"] == pytest.approx(995358.99, 0.05)
    assert sum_data["total_company_may_lose_30d"] == pytest.approx(256356.48, 0.05)
