"""
ML Inference Service Layer
Loads saved models offline and handles feature-level predictions and explainability.
"""
import os
import json
import joblib
import pandas as pd
import numpy as np

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

MODELS_DIR = os.getenv("MODELS_DIR")
if not MODELS_DIR or not os.path.exists(MODELS_DIR):
    for cand in [
        os.path.join(PROJECT_ROOT, "ml/models"),
        os.path.join(BACKEND_ROOT, "ml/models"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../ml/models")),
        "ml/models",
    ]:
        if os.path.exists(cand):
            MODELS_DIR = os.path.abspath(cand)
            break
    if not MODELS_DIR:
        MODELS_DIR = os.path.join(PROJECT_ROOT, "ml/models")

REPORTS_DIR = os.getenv("REPORTS_DIR")
if not REPORTS_DIR or not os.path.exists(REPORTS_DIR):
    for cand in [
        os.path.join(PROJECT_ROOT, "ml/reports"),
        os.path.join(BACKEND_ROOT, "ml/reports"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../ml/reports")),
        "ml/reports",
    ]:
        if os.path.exists(cand):
            REPORTS_DIR = os.path.abspath(cand)
            break
    if not REPORTS_DIR:
        REPORTS_DIR = os.path.join(PROJECT_ROOT, "ml/reports")

class InferenceService:
    def __init__(self):
        self.churn_model = None
        self.revenue_model = None
        self.segmentation_model = None
        self.churn_meta = {}
        self.revenue_meta = {}
        self.load_models()

    def load_models(self):
        churn_path = os.path.join(MODELS_DIR, "churn_model.joblib")
        revenue_path = os.path.join(MODELS_DIR, "revenue_model.joblib")
        seg_path = os.path.join(MODELS_DIR, "segmentation_model.joblib")
        churn_meta_path = os.path.join(REPORTS_DIR, "churn_metrics.json")
        rev_meta_path = os.path.join(REPORTS_DIR, "revenue_metrics.json")

        if os.path.exists(churn_path):
            self.churn_model = joblib.load(churn_path)
            print("Loaded Churn Model pipeline successfully.")
        if os.path.exists(revenue_path):
            self.revenue_model = joblib.load(revenue_path)
            print("Loaded Revenue Model pipeline successfully.")
        if os.path.exists(seg_path):
            self.segmentation_model = joblib.load(seg_path)
            print("Loaded Segmentation Model pipeline successfully.")
            
        if os.path.exists(churn_meta_path):
            with open(churn_meta_path) as f:
                self.churn_meta = json.load(f)
        if os.path.exists(rev_meta_path):
            with open(rev_meta_path) as f:
                self.revenue_meta = json.load(f)

    def is_ready(self) -> bool:
        return self.churn_model is not None and self.revenue_model is not None

    def explain_customer_risk(self, customer_row: pd.Series) -> dict:
        """
        Generates individual feature risk factors and protective factors
        based on model weights & customer behavioral feature values.
        """
        recency = customer_row.get('recency', 0)
        freq = customer_row.get('frequency', 0)
        spend = customer_row.get('monetary', 0.0)
        cancel_rate = customer_row.get('cancellation_rate', 0.0)
        max_days = customer_row.get('max_days_between_orders', 0.0)
        spend_trend = customer_row.get('spend_trend', 0.0)
        unique_prods = customer_row.get('unique_products', 0)

        risk_drivers = []
        protective_factors = []

        # Recency impact
        if recency > 90:
            risk_drivers.append({
                "feature_name": "Recency (Days Inactive)",
                "feature_value": f"{recency} days",
                "impact": "Increases Churn Risk",
                "description": f"Customer has not purchased for {recency} days (exceeds typical 90-day cycle)."
            })
        else:
            protective_factors.append({
                "feature_name": "Recent Purchase Activity",
                "feature_value": f"{recency} days ago",
                "impact": "Protects Retention",
                "description": f"Customer purchased within the last {recency} days."
            })

        # Order Frequency impact
        if freq >= 10:
            protective_factors.append({
                "feature_name": "Historical Order Frequency",
                "feature_value": f"{freq} orders",
                "impact": "Protects Retention",
                "description": f"Strong purchase history with {freq} completed transactions."
            })
        elif freq <= 2:
            risk_drivers.append({
                "feature_name": "Low Order Frequency",
                "feature_value": f"{freq} orders",
                "impact": "Increases Churn Risk",
                "description": f"Low overall engagement with only {freq} order(s)."
            })

        # Spend Trend impact
        if spend_trend < 0.2:
            risk_drivers.append({
                "feature_name": "Declining Spend Trend",
                "feature_value": f"Trend index: {spend_trend}",
                "impact": "Increases Churn Risk",
                "description": "Recent 90-day spend is significantly lower than historical average."
            })
        else:
            protective_factors.append({
                "feature_name": "Healthy Spend Velocity",
                "feature_value": f"Trend index: {spend_trend}",
                "impact": "Protects Retention",
                "description": "Consistent or increasing purchasing trajectory over recent months."
            })

        # Cancellation impact
        if cancel_rate > 0.15:
            risk_drivers.append({
                "feature_name": "Elevated Cancellation Rate",
                "feature_value": f"{cancel_rate * 100:.1f}%",
                "impact": "Increases Churn Risk",
                "description": "High return or order cancellation history indicating potential dissatisfaction."
            })

        # Product Variety
        if unique_prods >= 20:
            protective_factors.append({
                "feature_name": "Product Variety Engagement",
                "feature_value": f"{unique_prods} products",
                "impact": "Protects Retention",
                "description": "Customer buys a wide variety of products, deepening brand affinity."
            })

        return {
            "top_risk_drivers": risk_drivers[:3],
            "protective_factors": protective_factors[:3]
        }

# Global singleton
inference_service = InferenceService()
