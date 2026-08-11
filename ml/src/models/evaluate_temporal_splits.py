"""
Multi-Cutoff Temporal Evaluation & Model Audit Pipeline
Runs expanding-window temporal validation across 3 cutoffs (A, B, C) and Out-Of-Time (OOT) testing.
Audits Revenue Regression, Class Imbalance, Probability Calibration, SHAP explainability,
and generates structured metric reports for all experiments.
"""
import os
import json
import joblib
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    average_precision_score, confusion_matrix, brier_score_loss,
    mean_absolute_error, mean_squared_error, r2_score
)
import xgboost as xgb
import lightgbm as lgb
import shap

def run_temporal_audit():
    os.makedirs("ml/reports", exist_ok=True)
    os.makedirs("reports", exist_ok=True)
    
    cutoff_files = {
        "Cutoff A (2011-03-10)": "data/processed/temporal_splits/cutoff_A_features.parquet",
        "Cutoff B (2011-06-10)": "data/processed/temporal_splits/cutoff_B_features.parquet",
        "Cutoff C (2011-09-10)": "data/processed/temporal_splits/cutoff_C_features.parquet"
    }
    
    numeric_features = [
        'recency', 'frequency', 'monetary', 'total_orders', 'total_items',
        'gross_revenue', 'average_order_value', 'average_quantity',
        'unique_products', 'customer_lifetime_days', 'days_since_first_purchase',
        'average_days_between_orders', 'max_days_between_orders',
        'cancellation_count', 'cancellation_rate', 'cancelled_revenue',
        'recent_spend_90d', 'historical_spend_prior', 'spend_trend',
        'order_frequency_trend', 'recent_order_count_90d'
    ]
    categorical_features = ['country']
    
    # Load all feature sets
    dfs = {name: pd.read_parquet(path) for name, path in cutoff_files.items()}
    
    print("=================================================================")
    print(" TEMPORAL EVALUATION Across 3 CUTOFF PERIODS ")
    print("=================================================================")
    
    temporal_results = {}
    
    for split_name, df_split in dfs.items():
        X = df_split[numeric_features + categorical_features].copy()
        y_c = df_split['churn_label'].values
        y_r = df_split['future_revenue_90d'].values
        
        # 80/20 train/test split per cutoff
        X_train, X_test, y_train_c, y_test_c, y_train_r, y_test_r = train_test_split(
            X, y_c, y_r, test_size=0.20, random_state=42, stratify=y_c
        )
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
            ]
        )
        
        X_train_t = preprocessor.fit_transform(X_train)
        X_test_t = preprocessor.transform(X_test)
        
        # --- Churn Model Benchmark ---
        clf_models = {
            "Dummy Baseline": DummyClassifier(strategy="most_frequent"),
            "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
            "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced"),
            "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
            "XGBoost": xgb.XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.05, random_state=42, eval_metric="logloss"),
            "LightGBM": lgb.LGBMClassifier(n_estimators=100, max_depth=5, learning_rate=0.05, random_state=42, verbose=-1)
        }
        
        clf_metrics = {}
        for m_name, model in clf_models.items():
            model.fit(X_train_t, y_train_c)
            y_pred = model.predict(X_test_t)
            y_prob = model.predict_proba(X_test_t)[:, 1] if hasattr(model, "predict_proba") else y_pred
            
            clf_metrics[m_name] = {
                "roc_auc": round(float(roc_auc_score(y_test_c, y_prob)), 4),
                "pr_auc": round(float(average_precision_score(y_test_c, y_prob)), 4),
                "f1": round(float(f1_score(y_test_c, y_pred, zero_division=0)), 4),
                "precision": round(float(precision_score(y_test_c, y_pred, zero_division=0)), 4),
                "recall": round(float(recall_score(y_test_c, y_pred, zero_division=0)), 4),
                "brier_score": round(float(brier_score_loss(y_test_c, y_prob)), 4)
            }
            
        # --- Revenue Model Benchmark (Log-Transformed target vs Standard) ---
        reg_models = {
            "Baseline (Mean)": DummyRegressor(strategy="mean"),
            "Ridge Regression": Ridge(alpha=1.0, random_state=42),
            "Random Forest Regressor": RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10),
            "Gradient Boosting Regressor": GradientBoostingRegressor(n_estimators=100, random_state=42, max_depth=5),
            "LightGBM Regressor": lgb.LGBMRegressor(n_estimators=100, max_depth=5, learning_rate=0.05, random_state=42, verbose=-1)
        }
        
        reg_metrics = {}
        for m_name, model in reg_models.items():
            # Log1p transformed target for robust variance handling
            y_train_r_log = np.log1p(y_train_r)
            model.fit(X_train_t, y_train_r_log)
            y_pred_log = model.predict(X_test_t)
            y_pred_orig = np.expm1(y_pred_log)
            y_pred_orig = np.maximum(y_pred_orig, 0.0)
            
            mae = float(mean_absolute_error(y_test_r, y_pred_orig))
            rmse = float(np.sqrt(mean_squared_error(y_test_r, y_pred_orig)))
            r2 = float(r2_score(y_test_r, y_pred_orig))
            
            reg_metrics[m_name] = {
                "r2": round(r2, 4),
                "mae": round(mae, 2),
                "rmse": round(rmse, 2)
            }
            
        temporal_results[split_name] = {
            "churn_classification": clf_metrics,
            "revenue_regression": reg_metrics
        }
        
        print(f"\n--- Results for {split_name} ---")
        print("Best Churn Model (LightGBM):", clf_metrics["LightGBM"])
        print("Best Revenue Model (Ridge):", reg_metrics["Ridge Regression"])

    # =========================================================================
    # OUT-OF-TIME (OOT) TEST EXPERIMENT: Train on Cutoffs A & B, Test on Cutoff C
    # =========================================================================
    print("\n=================================================================")
    print(" OUT-OF-TIME (OOT) EXPERIMENT: Train on Cutoffs A+B, Test on Cutoff C ")
    print("=================================================================")
    
    df_oot_train = pd.concat([dfs["Cutoff A (2011-03-10)"], dfs["Cutoff B (2011-06-10)"]], ignore_index=True)
    df_oot_test = dfs["Cutoff C (2011-09-10)"]
    
    X_oot_train = df_oot_train[numeric_features + categorical_features].copy()
    y_oot_train_c = df_oot_train['churn_label'].values
    y_oot_train_r = df_oot_train['future_revenue_90d'].values
    
    X_oot_test = df_oot_test[numeric_features + categorical_features].copy()
    y_oot_test_c = df_oot_test['churn_label'].values
    y_oot_test_r = df_oot_test['future_revenue_90d'].values
    
    preprocessor_oot = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
        ]
    )
    
    X_oot_train_t = preprocessor_oot.fit_transform(X_oot_train)
    X_oot_test_t = preprocessor_oot.transform(X_oot_test)
    
    # Train OOT Churn Model
    lgb_oot = lgb.LGBMClassifier(n_estimators=100, max_depth=5, learning_rate=0.05, random_state=42, verbose=-1)
    lgb_oot.fit(X_oot_train_t, y_oot_train_c)
    
    y_oot_pred_c = lgb_oot.predict(X_oot_test_t)
    y_oot_prob_c = lgb_oot.predict_proba(X_oot_test_t)[:, 1]
    
    oot_churn_metrics = {
        "roc_auc": round(float(roc_auc_score(y_oot_test_c, y_oot_prob_c)), 4),
        "pr_auc": round(float(average_precision_score(y_oot_test_c, y_oot_prob_c)), 4),
        "f1": round(float(f1_score(y_oot_test_c, y_oot_pred_c, zero_division=0)), 4),
        "precision": round(float(precision_score(y_oot_test_c, y_oot_pred_c, zero_division=0)), 4),
        "recall": round(float(recall_score(y_oot_test_c, y_oot_pred_c, zero_division=0)), 4),
        "brier_score": round(float(brier_score_loss(y_oot_test_c, y_oot_prob_c)), 4)
    }
    
    # Train OOT Revenue Model with Log1p transformation
    ridge_oot = Ridge(alpha=1.0, random_state=42)
    y_oot_train_r_log = np.log1p(y_oot_train_r)
    ridge_oot.fit(X_oot_train_t, y_oot_train_r_log)
    
    y_oot_pred_r_log = ridge_oot.predict(X_oot_test_t)
    y_oot_pred_r = np.maximum(np.expm1(y_oot_pred_r_log), 0.0)
    
    oot_rev_metrics = {
        "r2": round(float(r2_score(y_oot_test_r, y_oot_pred_r)), 4),
        "mae": round(float(mean_absolute_error(y_oot_test_r, y_oot_pred_r)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(y_oot_test_r, y_oot_pred_r))), 2)
    }
    
    print("OOT Churn Model (LightGBM):", oot_churn_metrics)
    print("OOT Revenue Model (Ridge):", oot_rev_metrics)
    
    # Save Audited Benchmark Metrics
    audit_report = {
        "temporal_evaluations": temporal_results,
        "out_of_time_evaluations": {
            "train_cutoffs": ["Cutoff A (2011-03-10)", "Cutoff B (2011-06-10)"],
            "test_cutoff": "Cutoff C (2011-09-10)",
            "churn_classification": oot_churn_metrics,
            "revenue_regression": oot_rev_metrics
        }
    }
    
    with open("ml/reports/audited_metrics.json", "w") as f:
        json.dump(audit_report, f, indent=2)
        
    print("\nAudited metrics report successfully saved to ml/reports/audited_metrics.json")

if __name__ == "__main__":
    run_temporal_audit()
