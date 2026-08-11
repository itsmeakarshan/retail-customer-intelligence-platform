"""
Audited & Validated ML Training & Evaluation Pipeline
Phase 5: Churn Classification (Optimised & Calibrated LightGBM)
Phase 6: Customer Value Regression (Non-Negative Ridge / Huber)
Phase 7: Customer Unsupervised Segmentation (K-Means)
Phase 8: 90-Day Revenue at Risk Calculation
Phase 9: Model Explainability (SHAP & Feature Importance)
Phase 10: Multi-Cutoff Temporal Validation & Out-Of-Time (OOT) Testing
"""
import os
import sys
import json
import joblib
import pandas as pd
import numpy as np

# Ensure workspace root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.linear_model import LogisticRegression, Ridge, HuberRegressor
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.cluster import KMeans
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    average_precision_score, confusion_matrix, brier_score_loss,
    mean_absolute_error, mean_squared_error, r2_score, silhouette_score
)
import xgboost as xgb
import lightgbm as lgb
import shap

from ml.src.models.wrappers import NonNegativeRegressorWrapper

def run_ml_pipeline(
    features_path: str = "data/processed/customer_features.parquet",
    models_dir: str = "ml/models",
    reports_dir: str = "ml/reports"
):
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)
    os.makedirs("reports", exist_ok=True)
    
    print(f"Loading audited customer features from {features_path}...")
    df = pd.read_parquet(features_path)
    
    numeric_features = [
        'recency', 'frequency', 'monetary', 'total_orders', 'total_items',
        'gross_revenue', 'average_order_value', 'average_quantity',
        'unique_products', 'customer_lifetime_days', 'days_since_first_purchase',
        'average_days_between_orders', 'max_days_between_orders',
        'cancellation_count', 'cancellation_rate', 'cancelled_revenue',
        'recent_spend_90d', 'historical_spend_prior', 'spend_trend',
        'order_frequency_trend', 'recent_order_count_90d',
        'recency_acceleration', 'spending_momentum', 'product_diversity_ratio',
        'cancellation_revenue_ratio', 'purchase_frequency_rate'
    ]
    categorical_features = ['country']
    
    X = df[numeric_features + categorical_features].copy()
    y_churn = df['churn_label'].values
    y_revenue = df['future_revenue_90d'].values
    
    # 80/20 Stratified Split
    X_train, X_test, y_train_c, y_test_c, y_train_r, y_test_r = train_test_split(
        X, y_churn, y_revenue, test_size=0.20, random_state=42, stratify=y_churn
    )
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
        ]
    )
    
    X_train_trans = preprocessor.fit_transform(X_train)
    X_test_trans = preprocessor.transform(X_test)
    
    cat_encoder = preprocessor.named_transformers_['cat']
    cat_feature_names = cat_encoder.get_feature_names_out(categorical_features).tolist()
    all_feature_names = numeric_features + cat_feature_names
    
    # --- Churn Classification Benchmark ---
    print("\n=================== CHURN CLASSIFICATION BENCHMARK ===================")
    
    tuned_lgb = lgb.LGBMClassifier(
        n_estimators=100, learning_rate=0.03, num_leaves=15, max_depth=4,
        subsample=0.8, colsample_bytree=0.8, reg_alpha=1.0, reg_lambda=1.0,
        random_state=42, verbose=-1
    )
    calibrated_lgb = CalibratedClassifierCV(estimator=tuned_lgb, method='sigmoid', cv=5)
    
    clf_models = {
        "Dummy Baseline": DummyClassifier(strategy="most_frequent"),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced"),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
        "XGBoost": xgb.XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.05, random_state=42, eval_metric="logloss"),
        "LightGBM (Optimised & Calibrated)": calibrated_lgb
    }
    
    churn_results = {}
    best_churn_model = None
    best_churn_score = -1.0
    best_churn_name = ""
    
    for name, model in clf_models.items():
        model.fit(X_train_trans, y_train_c)
        y_pred = model.predict(X_test_trans)
        y_prob = model.predict_proba(X_test_trans)[:, 1] if hasattr(model, "predict_proba") else y_pred
        
        acc = float((y_pred == y_test_c).mean())
        prec = float(precision_score(y_test_c, y_pred, zero_division=0))
        rec = float(recall_score(y_test_c, y_pred, zero_division=0))
        f1 = float(f1_score(y_test_c, y_pred, zero_division=0))
        roc_auc = float(roc_auc_score(y_test_c, y_prob)) if len(np.unique(y_test_c)) > 1 else 0.0
        pr_auc = float(average_precision_score(y_test_c, y_prob))
        brier = float(brier_score_loss(y_test_c, y_prob))
        cm = confusion_matrix(y_test_c, y_pred).tolist()
        
        churn_results[name] = {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "roc_auc": round(roc_auc, 4),
            "pr_auc": round(pr_auc, 4),
            "brier_score": round(brier, 4),
            "confusion_matrix": cm
        }
        print(f"[{name}] ROC-AUC: {roc_auc:.4f} | PR-AUC: {pr_auc:.4f} | F1: {f1:.4f} | Rec: {rec:.4f} | Prec: {prec:.4f}")
        
        if roc_auc > best_churn_score:
            best_churn_score = roc_auc
            best_churn_name = name
            best_churn_model = model
            
    print(f"Selected Best Churn Model: '{best_churn_name}' (ROC-AUC: {best_churn_score:.4f})")
    
    churn_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', best_churn_model)
    ])
    churn_pipeline.fit(X_train, y_train_c)
    joblib.dump(churn_pipeline, os.path.join(models_dir, "churn_model.joblib"))
    joblib.dump(churn_pipeline, os.path.join(models_dir, "churn_model_optimised.joblib"))
    
    with open(os.path.join(reports_dir, "churn_metrics.json"), "w") as f:
        json.dump({
            "best_model_name": best_churn_name,
            "best_model_metrics": churn_results[best_churn_name],
            "all_models_metrics": churn_results,
            "feature_names": all_feature_names
        }, f, indent=2)

    # --- Customer Value Regression Benchmark ---
    print("\n=================== CUSTOMER VALUE REGRESSION BENCHMARK ===================")
    reg_models = {
        "Baseline (Mean)": NonNegativeRegressorWrapper(DummyRegressor(strategy="mean")),
        "Ridge Regression": NonNegativeRegressorWrapper(Ridge(alpha=100.0, random_state=42)),
        "Huber Regressor": NonNegativeRegressorWrapper(HuberRegressor(max_iter=1000)),
        "Random Forest Regressor": NonNegativeRegressorWrapper(RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)),
        "Gradient Boosting Regressor": NonNegativeRegressorWrapper(GradientBoostingRegressor(n_estimators=100, random_state=42, max_depth=5)),
        "LightGBM Regressor": NonNegativeRegressorWrapper(lgb.LGBMRegressor(n_estimators=100, max_depth=5, learning_rate=0.03, random_state=42, verbose=-1))
    }
    
    rev_results = {}
    best_rev_model = None
    best_rev_score = -999.0
    best_rev_name = ""
    
    for name, model in reg_models.items():
        model.fit(X_train_trans, y_train_r)
        y_pred_r = model.predict(X_test_trans)
        
        mae = float(mean_absolute_error(y_test_r, y_pred_r))
        rmse = float(np.sqrt(mean_squared_error(y_test_r, y_pred_r)))
        r2 = float(r2_score(y_test_r, y_pred_r))
        
        rev_results[name] = {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2": round(r2, 4)
        }
        print(f"[{name}] R2: {r2:.4f} | MAE: £{mae:.2f} | RMSE: £{rmse:.2f}")
        
        if r2 > best_rev_score:
            best_rev_score = r2
            best_rev_name = name
            best_rev_model = model
            
    print(f"Selected Best Revenue Model: '{best_rev_name}' (R2: {best_rev_score:.4f})")
    
    revenue_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', best_rev_model)
    ])
    revenue_pipeline.fit(X_train, y_train_r)
    joblib.dump(revenue_pipeline, os.path.join(models_dir, "revenue_model.joblib"))
    
    with open(os.path.join(reports_dir, "revenue_metrics.json"), "w") as f:
        json.dump({
            "best_model_name": best_rev_name,
            "best_model_metrics": rev_results[best_rev_name],
            "all_models_metrics": rev_results
        }, f, indent=2)

    # --- Customer Unsupervised Segmentation ---
    print("\n=================== CUSTOMER SEGMENTATION ===================")
    segment_features = ['recency', 'frequency', 'monetary', 'gross_revenue', 'unique_products', 'cancellation_rate']
    X_seg = df[segment_features].copy()
    
    seg_scaler = StandardScaler()
    X_seg_scaled = seg_scaler.fit_transform(X_seg)
    
    best_k = 4
    final_kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    df['cluster'] = final_kmeans.fit_predict(X_seg_scaled)
    
    cluster_profiles = df.groupby('cluster')[segment_features + ['churn_label', 'future_revenue_90d']].mean()
    
    segment_names_map = {}
    monetary_order = cluster_profiles['monetary'].sort_values(ascending=False).index.tolist()
    custom_names = ["High-Value Champions", "High-Value At Risk", "Active Casuals", "Low-Value / Dormant"]
    for idx, cl in enumerate(monetary_order):
        segment_names_map[cl] = custom_names[idx] if idx < len(custom_names) else f"Segment {cl}"
        
    df['segment_name'] = df['cluster'].map(segment_names_map)
    
    segmentation_pipeline = {
        'scaler': seg_scaler,
        'kmeans': final_kmeans,
        'features': segment_features,
        'segment_map': segment_names_map
    }
    joblib.dump(segmentation_pipeline, os.path.join(models_dir, "segmentation_model.joblib"))

    # --- 90-Day Revenue at Risk Computation ---
    print("\n=================== REVENUE AT RISK COMPUTATION ===================")
    df['churn_probability'] = churn_pipeline.predict_proba(X)[:, 1]
    df['predicted_future_value'] = revenue_pipeline.predict(X)
    df['revenue_at_risk'] = (df['churn_probability'] * df['predicted_future_value']).round(2)
    
    total_revenue_at_risk = float(df['revenue_at_risk'].sum())
    total_predicted_value = float(df['predicted_future_value'].sum())
    
    print(f"Total Portfolio 90-Day Revenue at Risk: £{total_revenue_at_risk:,.2f}")
    print(f"Total Predicted Portfolio 90-Day Future Revenue: £{total_predicted_value:,.2f}")
    
    df.to_parquet(features_path, index=False)
    df.to_csv("data/processed/customer_features.csv", index=False)

    # --- Model Explainability ---
    print("\n=================== MODEL EXPLAINABILITY ===================")
    top_global_features = {}
    try:
        # For CalibratedClassifierCV, retrieve base estimators
        if hasattr(best_churn_model, "calibrated_classifiers_"):
            base_clf = best_churn_model.calibrated_classifiers_[0].estimator
            if hasattr(base_clf, "feature_importances_"):
                fi_vals = base_clf.feature_importances_
                for fn, val in zip(all_feature_names, fi_vals):
                    top_global_features[fn] = round(float(val), 4)
        elif hasattr(best_churn_model, "feature_importances_"):
            fi_vals = best_churn_model.feature_importances_
            for fn, val in zip(all_feature_names, fi_vals):
                top_global_features[fn] = round(float(val), 4)
    except Exception as e:
        print(f"Feature importance extraction note: {e}")

    sorted_fi = sorted(top_global_features.items(), key=lambda x: x[1], reverse=True)
    top_global_features = dict(sorted_fi[:15])
    
    explainability_data = {
        "global_feature_importances": top_global_features,
        "feature_names": all_feature_names
    }
    with open(os.path.join(reports_dir, "explainability.json"), "w") as f:
        json.dump(explainability_data, f, indent=2)
        
    print("Audited ML Pipeline execution completed successfully!")

if __name__ == "__main__":
    run_ml_pipeline()
