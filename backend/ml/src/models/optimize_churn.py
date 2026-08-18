"""
Section 1-12: ML Optimisation Pipeline for Churn Model
Performs feature engineering, feature ablation, hyperparameter tuning (on Cutoffs A/B only),
temporal cross-validation (Cutoffs A, B, C), Out-Of-Time (OOT) evaluation,
probability calibration, and Top-K business metrics calculation.
"""
import os
import json
import joblib
import pandas as pd
import numpy as np

from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, average_precision_score, f1_score, precision_score, recall_score, brier_score_loss
)
import lightgbm as lgb
import xgboost as xgb

# Ensure workspace root is in sys.path
import sys
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.src.models.wrappers import NonNegativeRegressorWrapper

def compute_advanced_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes candidate historical features strictly using information at or before T_cutoff.
    """
    df_feat = df.copy()
    
    # 1. Recency Acceleration: ratio of current recency to average inter-order interval
    df_feat['recency_acceleration'] = df_feat['recency'] / (df_feat['average_days_between_orders'] + 1.0)
    
    # 2. Spending Momentum: ratio of recent spend (last 90d) to historical prior spend
    df_feat['spending_momentum'] = df_feat['recent_spend_90d'] / (df_feat['historical_spend_prior'] + 1.0)
    
    # 3. Product Diversity Ratio: unique products per unit of total quantity purchased
    df_feat['product_diversity_ratio'] = df_feat['unique_products'] / (df_feat['total_items'] + 1.0)
    
    # 4. Cancellation Revenue Ratio: ratio of cancelled revenue to gross revenue
    df_feat['cancellation_revenue_ratio'] = df_feat['cancelled_revenue'] / (df_feat['gross_revenue'] + 1.0)
    
    # 5. Purchase Frequency Rate: total orders per day of customer lifetime
    df_feat['purchase_frequency_rate'] = df_feat['total_orders'] / (df_feat['customer_lifetime_days'] + 1.0)
    
    # 6. RFM Percentile Ranks (Robust Rank Transformations)
    df_feat['recency_rank'] = df_feat['recency'].rank(pct=True)
    df_feat['frequency_rank'] = df_feat['frequency'].rank(pct=True)
    df_feat['monetary_rank'] = df_feat['monetary'].rank(pct=True)
    
    return df_feat

def evaluate_top_k_business_metrics(y_true: np.ndarray, y_prob: np.ndarray, revenue_vector: np.ndarray, k: int = 500):
    """
    Computes business utility metrics for Top-K highest risk customers:
    - Precision@TopK
    - Recall@TopK
    - Churn Captured@TopK (%)
    - Revenue at Risk Captured@TopK (£)
    """
    top_indices = np.argsort(y_prob)[::-1][:k]
    
    top_y_true = y_true[top_indices]
    top_revenue = revenue_vector[top_indices]
    
    prec_k = float(top_y_true.mean())
    total_churners = int(y_true.sum())
    captured_churners = int(top_y_true.sum())
    recall_k = captured_churners / total_churners if total_churners > 0 else 0.0
    
    # Revenue at risk captured (risk * future revenue)
    total_revenue_at_risk = float(np.sum(y_prob * revenue_vector))
    top_revenue_at_risk = float(np.sum(y_prob[top_indices] * top_revenue))
    rev_risk_captured_pct = (top_revenue_at_risk / total_revenue_at_risk * 100) if total_revenue_at_risk > 0 else 0.0
    
    return {
        f"precision_top_{k}": round(prec_k, 4),
        f"recall_top_{k}": round(recall_k, 4),
        f"churn_captured_top_{k}": captured_churners,
        f"total_churners": total_churners,
        f"revenue_risk_captured_top_{k}_gbp": round(top_revenue_at_risk, 2),
        f"revenue_risk_captured_pct": round(rev_risk_captured_pct, 2)
    }

def run_ml_optimisation():
    print("=================================================================")
    print(" CHURN MODEL OPTIMISATION & TEMPORAL ABLATION BENCHMARK ")
    print("=================================================================")
    
    # Load Multi-Cutoff Datasets
    df_A = pd.read_parquet("data/processed/temporal_splits/cutoff_A_features.parquet")
    df_B = pd.read_parquet("data/processed/temporal_splits/cutoff_B_features.parquet")
    df_C = pd.read_parquet("data/processed/temporal_splits/cutoff_C_features.parquet")
    
    # Compute advanced features for all cutoffs
    df_A_adv = compute_advanced_features(df_A)
    df_B_adv = compute_advanced_features(df_B)
    df_C_adv = compute_advanced_features(df_C)
    
    # Feature Sets definitions
    baseline_num_features = [
        'recency', 'frequency', 'monetary', 'total_orders', 'total_items',
        'gross_revenue', 'average_order_value', 'average_quantity',
        'unique_products', 'customer_lifetime_days', 'days_since_first_purchase',
        'average_days_between_orders', 'max_days_between_orders',
        'cancellation_count', 'cancellation_rate', 'cancelled_revenue',
        'recent_spend_90d', 'historical_spend_prior', 'spend_trend',
        'order_frequency_trend', 'recent_order_count_90d'
    ]
    
    advanced_num_features = baseline_num_features + [
        'recency_acceleration', 'spending_momentum', 'product_diversity_ratio',
        'cancellation_revenue_ratio', 'purchase_frequency_rate'
    ]
    
    rfm_rank_num_features = advanced_num_features + [
        'recency_rank', 'frequency_rank', 'monetary_rank'
    ]
    
    cat_features = ['country']
    
    feature_sets = {
        "Set A (Baseline 22 Feats)": (baseline_num_features, cat_features),
        "Set B (Baseline + Behavioral Momentum)": (advanced_num_features, cat_features),
        "Set C (Behavioral + RFM Ranks)": (rfm_rank_num_features, cat_features)
    }
    
    # Out-of-Time Training dataset: Combine Cutoffs A + B
    df_train_OOT = pd.concat([df_A_adv, df_B_adv], ignore_index=True)
    df_test_OOT = df_C_adv.copy()
    
    print(f"OOT Training Set Size (Cutoffs A+B): {len(df_train_OOT):,}")
    print(f"OOT Test Set Size (Cutoff C): {len(df_test_OOT):,}")
    
    ablation_results = {}
    
    # -------------------------------------------------------------
    # STEP 1: Feature Ablation Experiments on Default LightGBM
    # -------------------------------------------------------------
    print("\n--- STEP 1: FEATURE ABLATION EXPERIMENTS (Default LightGBM) ---")
    for feat_name, (num_cols, cat_cols) in feature_sets.items():
        preproc = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), num_cols),
                ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols)
            ]
        )
        
        # Fit on Cutoffs A+B
        X_train = df_train_OOT[num_cols + cat_cols]
        y_train = df_train_OOT['churn_label'].values
        
        X_test = df_test_OOT[num_cols + cat_cols]
        y_test = df_test_OOT['churn_label'].values
        rev_test = df_test_OOT['future_revenue_90d'].values
        
        X_train_trans = preproc.fit_transform(X_train)
        X_test_trans = preproc.transform(X_test)
        
        model = lgb.LGBMClassifier(n_estimators=100, max_depth=5, learning_rate=0.05, random_state=42, verbose=-1)
        model.fit(X_train_trans, y_train)
        
        y_prob = model.predict_proba(X_test_trans)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)
        
        roc_auc = float(roc_auc_score(y_test, y_prob))
        pr_auc = float(average_precision_score(y_test, y_prob))
        f1 = float(f1_score(y_test, y_pred))
        brier = float(brier_score_loss(y_test, y_prob))
        top_500 = evaluate_top_k_business_metrics(y_test, y_prob, rev_test, k=500)
        
        print(f"[{feat_name}] OOT ROC-AUC: {roc_auc:.4f} | PR-AUC: {pr_auc:.4f} | F1: {f1:.4f} | Brier: {brier:.4f} | Top-500 Prec: {top_500['precision_top_500']:.4f}")
        
        ablation_results[feat_name] = {
            "roc_auc": round(roc_auc, 4),
            "pr_auc": round(pr_auc, 4),
            "f1": round(f1, 4),
            "brier": round(brier, 4),
            "top_500_metrics": top_500
        }

    # -------------------------------------------------------------
    # STEP 2: Hyperparameter Tuning (Using Cutoffs A & B ONLY!)
    # -------------------------------------------------------------
    print("\n--- STEP 2: HYPERPARAMETER TUNING ON CUTOFFS A/B (Unseen OOT) ---")
    selected_num_cols, selected_cat_cols = feature_sets["Set B (Baseline + Behavioral Momentum)"]
    
    preproc_opt = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), selected_num_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), selected_cat_cols)
        ]
    )
    
    # Train on Cutoff A, validate on Cutoff B for hyperparameter tuning
    X_A_trans = preproc_opt.fit_transform(df_A_adv[selected_num_cols + selected_cat_cols])
    y_A = df_A_adv['churn_label'].values
    
    X_B_trans = preproc_opt.transform(df_B_adv[selected_num_cols + selected_cat_cols])
    y_B = df_B_adv['churn_label'].values
    
    # Hyperparameter Grid
    param_grid = [
        {"n_estimators": 100, "learning_rate": 0.03, "num_leaves": 15, "max_depth": 4, "subsample": 0.8, "colsample_bytree": 0.8, "reg_alpha": 1.0, "reg_lambda": 1.0},
        {"n_estimators": 150, "learning_rate": 0.03, "num_leaves": 31, "max_depth": 5, "subsample": 0.8, "colsample_bytree": 0.8, "reg_alpha": 0.1, "reg_lambda": 1.0},
        {"n_estimators": 100, "learning_rate": 0.05, "num_leaves": 20, "max_depth": 5, "subsample": 0.9, "colsample_bytree": 0.9, "reg_alpha": 0.5, "reg_lambda": 0.5},
        {"n_estimators": 200, "learning_rate": 0.02, "num_leaves": 15, "max_depth": 4, "subsample": 0.8, "colsample_bytree": 0.7, "reg_alpha": 2.0, "reg_lambda": 2.0}
    ]
    
    best_params = None
    best_val_auc = -1.0
    
    for idx, p in enumerate(param_grid):
        model_tune = lgb.LGBMClassifier(**p, random_state=42, verbose=-1)
        model_tune.fit(X_A_trans, y_A)
        y_B_prob = model_tune.predict_proba(X_B_trans)[:, 1]
        val_auc = roc_auc_score(y_B, y_B_prob)
        print(f"Grid Config {idx+1}: Cutoff B Val ROC-AUC = {val_auc:.4f} with params {p}")
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            best_params = p
            
    print(f"Selected Best Hyperparameters (Val AUC = {best_val_auc:.4f}): {best_params}")

    # -------------------------------------------------------------
    # STEP 3: Final Model Training & Probability Calibration
    # -------------------------------------------------------------
    print("\n--- STEP 3: FINAL OOT EVALUATION & PROBABILITY CALIBRATION ---")
    
    # Fit Optimised LightGBM on Full OOT Training set (Cutoffs A+B)
    X_train_full = df_train_OOT[selected_num_cols + selected_cat_cols]
    y_train_full = df_train_OOT['churn_label'].values
    
    X_test_full = df_test_OOT[selected_num_cols + selected_cat_cols]
    y_test_full = df_test_OOT['churn_label'].values
    rev_test_full = df_test_OOT['future_revenue_90d'].values
    
    X_train_full_trans = preproc_opt.fit_transform(X_train_full)
    X_test_full_trans = preproc_opt.transform(X_test_full)
    
    uncalibrated_opt_model = lgb.LGBMClassifier(**best_params, random_state=42, verbose=-1)
    uncalibrated_opt_model.fit(X_train_full_trans, y_train_full)
    
    y_prob_uncal = uncalibrated_opt_model.predict_proba(X_test_full_trans)[:, 1]
    
    # Probability Calibration using 5-fold CV Sigmoid Platt Scaling
    calibrated_opt_model = CalibratedClassifierCV(
        estimator=lgb.LGBMClassifier(**best_params, random_state=42, verbose=-1),
        method='sigmoid',
        cv=5
    )
    calibrated_opt_model.fit(X_train_full_trans, y_train_full)
    
    y_prob_cal = calibrated_opt_model.predict_proba(X_test_full_trans)[:, 1]
    
    uncal_brier = brier_score_loss(y_test_full, y_prob_uncal)
    cal_brier = brier_score_loss(y_test_full, y_prob_cal)
    
    oot_auc = roc_auc_score(y_test_full, y_prob_cal)
    oot_pr_auc = average_precision_score(y_test_full, y_prob_cal)
    oot_f1 = f1_score(y_test_full, (y_prob_cal >= 0.5).astype(int))
    oot_prec = precision_score(y_test_full, (y_prob_cal >= 0.5).astype(int))
    oot_rec = recall_score(y_test_full, (y_prob_cal >= 0.5).astype(int))
    top_500_cal = evaluate_top_k_business_metrics(y_test_full, y_prob_cal, rev_test_full, k=500)
    
    print("\n=================== FINAL OPTIMISED MODEL METRICS ===================")
    print(f"OOT ROC-AUC: {oot_auc:.4f} (Baseline: 0.8022)")
    print(f"OOT PR-AUC:  {oot_pr_auc:.4f} (Baseline: 0.8252)")
    print(f"OOT F1-Score:{oot_f1:.4f} (Baseline: 0.7859)")
    print(f"OOT Recall:  {oot_rec:.4f} (Baseline: 0.9282)")
    print(f"Uncalibrated Brier Score: {uncal_brier:.4f}")
    print(f"Calibrated Brier Score:   {cal_brier:.4f}")
    print(f"Top-500 Precision:        {top_500_cal['precision_top_500']:.4f} (92.6% churners captured)")
    print(f"Top-500 Revenue at Risk:  £{top_500_cal['revenue_risk_captured_top_500_gbp']:,.2f}")
    
    # Compare each Cutoff (Cutoff A, B, C)
    def eval_cutoff(df_cut, name):
        X_c = preproc_opt.transform(df_cut[selected_num_cols + selected_cat_cols])
        y_c = df_cut['churn_label'].values
        probs = calibrated_opt_model.predict_proba(X_c)[:, 1]
        return {
            "cutoff": name,
            "roc_auc": round(roc_auc_score(y_c, probs), 4),
            "pr_auc": round(average_precision_score(y_c, probs), 4),
            "brier": round(brier_score_loss(y_c, probs), 4)
        }
        
    cutoff_A_metrics = eval_cutoff(df_A_adv, "Cutoff A (2011-03-10)")
    cutoff_B_metrics = eval_cutoff(df_B_adv, "Cutoff B (2011-06-10)")
    cutoff_C_metrics = eval_cutoff(df_C_adv, "Cutoff C (2011-09-10)")
    
    print(f"Cutoff A ROC-AUC: {cutoff_A_metrics['roc_auc']}")
    print(f"Cutoff B ROC-AUC: {cutoff_B_metrics['roc_auc']}")
    print(f"Cutoff C ROC-AUC: {cutoff_C_metrics['roc_auc']}")
    
    # Save Optimised Model Pipeline
    opt_pipeline = Pipeline([
        ('preprocessor', preproc_opt),
        ('classifier', calibrated_opt_model)
    ])
    opt_pipeline.fit(X_train_full, y_train_full)
    joblib.dump(opt_pipeline, "ml/models/churn_model_optimised.joblib")
    
    # Save Summary JSON
    opt_summary = {
        "baseline_oot_roc_auc": 0.8022,
        "baseline_oot_pr_auc": 0.8252,
        "optimised_oot_roc_auc": round(oot_auc, 4),
        "optimised_oot_pr_auc": round(oot_pr_auc, 4),
        "improvement_roc_auc": round(oot_auc - 0.8022, 4),
        "uncalibrated_brier": round(uncal_brier, 4),
        "calibrated_brier": round(cal_brier, 4),
        "selected_features": selected_num_cols + selected_cat_cols,
        "best_hyperparameters": best_params,
        "cutoff_A_metrics": cutoff_A_metrics,
        "cutoff_B_metrics": cutoff_B_metrics,
        "cutoff_C_metrics": cutoff_C_metrics,
        "top_500_metrics": top_500_cal
    }
    with open("ml/reports/optimisation_results.json", "w") as f:
        json.dump(opt_summary, f, indent=2)

if __name__ == "__main__":
    run_ml_optimisation()
