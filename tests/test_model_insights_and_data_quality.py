import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_model_insights_summary_endpoint():
    """Tests GET /api/model-insights/summary returns real models and verified metrics."""
    resp = client.get("/api/model-insights/summary?dashboard_id=default")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_models_count"] == 5
    assert data["active_models_count"] == 5
    assert len(data["models"]) == 5

    model_ids = [m["model_id"] for m in data["models"]]
    assert "demand_forecasting_lgbm" in model_ids
    assert "churn_classification_gb" in model_ids
    assert "revenue_regression_rf" in model_ids
    assert "segmentation_kmeans" in model_ids
    assert "price_elasticity_ols" in model_ids

    # Verify each model has real metrics and existing artifacts
    for m in data["models"]:
        assert len(m["input_features"]) > 0
        assert len(m["target_variable"]) > 0
        assert len(m["business_summary"]) > 0
        assert len(m["evaluation_metrics"]) > 0
        assert m["is_loaded"] is True
        assert os.path.exists(m["artifact_path"]), f"Artifact {m['artifact_path']} must exist on disk"

        # Check metrics are formatted without empty placeholders
        for metric in m["evaluation_metrics"]:
            assert metric["metric_name"]
            assert metric["metric_formatted"]
            assert metric["metric_formatted"] != "TODO"

    # Specific check for Demand Forecasting LightGBM
    lgbm_model = next(m for m in data["models"] if m["model_id"] == "demand_forecasting_lgbm")
    assert "LightGBM" in lgbm_model["algorithm"]
    assert lgbm_model["evaluation_records_count"] == 4363
    smape_metric = next(met for met in lgbm_model["evaluation_metrics"] if "sMAPE" in met["metric_name"])
    assert smape_metric["metric_value"] == 31.84

    # Specific check for Churn Classifier
    churn_model = next(m for m in data["models"] if m["model_id"] == "churn_classification_gb")
    assert "Gradient Boosting" in churn_model["algorithm"]
    roc_metric = next(met for met in churn_model["evaluation_metrics"] if met["metric_name"] == "ROC-AUC")
    assert roc_metric["metric_value"] == 0.8313

    # Specific check for Revenue Regressor
    rev_model = next(m for m in data["models"] if m["model_id"] == "revenue_regression_rf")
    assert "Random Forest" in rev_model["algorithm"]
    r2_metric = next(met for met in rev_model["evaluation_metrics"] if "R²" in met["metric_name"])
    assert r2_metric["metric_value"] == 0.8875


def test_model_insights_download_csv_endpoint():
    """Tests GET /api/model-insights/download generates a valid CSV."""
    resp = client.get("/api/model-insights/download?dashboard_id=default")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "demand_forecasting_lgbm" in resp.text
    assert "churn_classification_gb" in resp.text
    assert "sMAPE" in resp.text


def test_monitoring_summary_live_system_and_model_status():
    """Tests GET /api/monitoring/summary contains live DB health, model runtime, and feature drift."""
    resp = client.get("/api/monitoring/summary?dashboard_id=default")
    assert resp.status_code == 200
    data = resp.json()

    assert "overall_system_health" in data
    assert "system_health" in data
    sys_health = data["system_health"]
    assert sys_health["db_connected"] is True
    assert sys_health["db_records_count"] == 797815
    assert sys_health["db_tables_count"] >= 13

    assert "model_runtime_statuses" in data
    assert len(data["model_runtime_statuses"]) == 5
    for m in data["model_runtime_statuses"]:
        assert m["is_loaded"] is True
        assert m["artifact_exists"] is True
        assert m["records_scored"] > 0

    assert "data_freshness" in data
    freshness = data["data_freshness"]
    assert freshness["total_transactions"] == 797815
    assert freshness["total_customers"] == 5939
    assert freshness["date_span_days"] == 738
    assert "2009-12-01" in freshness["earliest_date"]
    assert "2011-12-09" in freshness["latest_date"]

    assert "feature_drift_results" in data
    assert len(data["feature_drift_results"]) > 0

    assert "historical_monitoring_disclosure" in data
    assert "not persisted" in data["historical_monitoring_disclosure"].lower()


def test_data_quality_summary_endpoint():
    """Tests GET /api/data-quality/summary returns real empirical dataset statistics."""
    resp = client.get("/api/data-quality/summary?dashboard_id=default")
    assert resp.status_code == 200
    data = resp.json()

    # Exact verified counts
    assert data["raw_dataset_rows"] == 1067371
    assert data["clean_dataset_rows"] == 797815
    assert data["positive_sales_rows"] == 779425
    assert data["cancelled_rows"] == 18390
    assert data["cancellation_rate_pct"] == 2.30
    assert data["unique_customers_count"] == 5939
    assert data["unique_products_count"] == 4646

    # Column audits
    assert len(data["column_audits"]) == 8
    col_names = [c["column_name"] for c in data["column_audits"]]
    assert "Invoice" in col_names
    assert "StockCode" in col_names
    assert "Description" in col_names
    assert "Quantity" in col_names
    assert "InvoiceDate" in col_names
    assert "Price" in col_names
    assert "Customer ID" in col_names
    assert "Country" in col_names

    for col in data["column_audits"]:
        assert col["total_records"] == 797815
        assert col["valid_records"] == 797815
        assert col["missing_percentage"] == 0.0
        assert col["validity_status"] == "Pass"

    # ETL pipeline audit steps
    assert len(data["etl_pipeline_steps"]) == 5
    step_numbers = [s["step_number"] for s in data["etl_pipeline_steps"]]
    assert step_numbers == [1, 2, 3, 4, 5]

    # Product coverage single source of truth
    cov = data["product_coverage"]
    assert cov["total_catalog_products"] == 4631
    assert cov["eligible_products_count"] == 4363
    assert cov["excluded_products_count"] == 268
    assert cov["multi_price_elastic_products"] == 877
    assert cov["fixed_price_products"] == 3486
    assert "fewer than 5" in cov["excluded_reason"]

    # ML impacts
    assert len(data["ml_impacts"]) == 4


def test_data_quality_download_csv_endpoint():
    """Tests GET /api/data-quality/download generates valid CSV audit."""
    resp = client.get("/api/data-quality/download?dashboard_id=default")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "StockCode" in resp.text
    assert "Quantity" in resp.text
    assert "Pass" in resp.text


def test_cross_page_canonical_consistency():
    """
    Verifies that product population counts, eligible counts, and excluded counts
    are completely consistent across Pricing, Forecasting, Data Quality, and Model Insights.
    """
    # 1. Pricing products count
    pricing_resp = client.get("/api/pricing/products?dashboard_id=default")
    assert pricing_resp.status_code == 200
    pricing_prods = pricing_resp.json()
    assert len(pricing_prods) == 4631

    # 2. Data Quality counts
    dq_resp = client.get("/api/data-quality/summary?dashboard_id=default")
    assert dq_resp.status_code == 200
    dq_cov = dq_resp.json()["product_coverage"]
    assert dq_cov["total_catalog_products"] == 4631
    assert dq_cov["eligible_products_count"] == 4363
    assert dq_cov["excluded_products_count"] == 268
    assert dq_cov["multi_price_elastic_products"] == 877

    # 3. Model Insights eligible counts
    insights_resp = client.get("/api/model-insights/summary?dashboard_id=default")
    assert insights_resp.status_code == 200
    insights_models = insights_resp.json()["models"]
    fc_model = next(m for m in insights_models if m["model_id"] == "demand_forecasting_lgbm")
    assert fc_model["evaluation_records_count"] == 4363
    elasticity_model = next(m for m in insights_models if m["model_id"] == "price_elasticity_ols")
    assert elasticity_model["evaluation_records_count"] == 4631
