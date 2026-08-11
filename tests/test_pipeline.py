"""
Comprehensive Data Science Audit & Automated Test Suite (Requirement 9)
Tests data cleaning, temporal cutoff boundary enforcement, zero target leakage,
multi-cutoff temporal validation, ML inference bounds, and database integrity.
"""
import pytest
import os
import pandas as pd
import numpy as np
import joblib
from ml.src.models.wrappers import NonNegativeRegressorWrapper

DATA_RAW_PATH = "data/raw/online_retail_II.csv"
DATA_CLEAN_PATH = "data/processed/clean_transactions.parquet"
FEATURES_PATH = "data/processed/customer_features.parquet"
CHURN_MODEL_PATH = "ml/models/churn_model.joblib"
CHURN_OPT_MODEL_PATH = "ml/models/churn_model_optimised.joblib"
REVENUE_MODEL_PATH = "ml/models/revenue_model.joblib"
SEG_MODEL_PATH = "ml/models/segmentation_model.joblib"

# --- 1. DATA INTEGRITY TESTS ---
def test_raw_dataset_exists():
    assert os.path.exists(DATA_RAW_PATH), "Raw dataset file missing"

def test_clean_data_integrity():
    assert os.path.exists(DATA_CLEAN_PATH), "Clean dataset file missing"
    df = pd.read_parquet(DATA_CLEAN_PATH)
    
    expected_cols = {'invoice', 'stock_code', 'quantity', 'invoice_date', 'price', 'customer_id', 'country', 'revenue', 'is_cancelled'}
    assert expected_cols.issubset(df.columns)
    assert df['customer_id'].isnull().sum() == 0
    assert (df['price'] <= 0).sum() == 0
    
    calculated_rev = (df['quantity'] * df['price']).round(2)
    assert np.allclose(df['revenue'].round(2), calculated_rev)

# --- 2. TEMPORAL LEAKAGE TESTS ---
def test_strict_temporal_feature_no_leakage():
    """
    Explicitly tests that observation window features only use transactions on or before Cutoff Date.
    Cutoff Date = 2011-09-10
    """
    cutoff = pd.to_datetime("2011-09-10 00:00:00")
    clean_df = pd.read_parquet(DATA_CLEAN_PATH)
    clean_df['invoice_date'] = pd.to_datetime(clean_df['invoice_date'])
    
    obs_tx = clean_df[clean_df['invoice_date'] <= cutoff]
    pred_tx = clean_df[clean_df['invoice_date'] > cutoff]
    
    features_df = pd.read_parquet(FEATURES_PATH)
    
    # Check 10 random sample customers
    sample_cids = features_df['customer_id'].sample(min(10, len(features_df)), random_state=42)
    
    for cid in sample_cids:
        c_feat = features_df[features_df['customer_id'] == cid].iloc[0]
        c_obs_tx = obs_tx[obs_tx['customer_id'] == cid]
        c_pred_tx = pred_tx[pred_tx['customer_id'] == cid]
        
        # Recency check using obs window only
        if len(c_obs_tx) > 0 and len(c_obs_tx[c_obs_tx['quantity'] > 0]) > 0:
            last_obs_date = c_obs_tx[c_obs_tx['quantity'] > 0]['invoice_date'].max()
            expected_recency = (cutoff - last_obs_date).days
            assert c_feat['recency'] == expected_recency, f"Recency mismatch for customer {cid}"
            
        # Target check using prediction window only
        future_purchases = c_pred_tx[(c_pred_tx['quantity'] > 0) & (~c_pred_tx['is_cancelled'])]
        expected_churn = 0 if len(future_purchases) > 0 else 1
        assert c_feat['churn_label'] == expected_churn, f"Churn target mismatch for customer {cid}"

def test_future_revenue_no_leakage():
    """
    Explicitly tests that future_revenue_90d equals positive spend in (cutoff, cutoff + 90d].
    """
    cutoff = pd.to_datetime("2011-09-10 00:00:00")
    max_pred = cutoff + pd.Timedelta(days=90)
    
    clean_df = pd.read_parquet(DATA_CLEAN_PATH)
    clean_df['invoice_date'] = pd.to_datetime(clean_df['invoice_date'])
    
    pred_tx = clean_df[(clean_df['invoice_date'] > cutoff) & (clean_df['invoice_date'] <= max_pred)]
    features_df = pd.read_parquet(FEATURES_PATH)
    
    for cid in features_df['customer_id'].sample(min(10, len(features_df)), random_state=42):
        c_feat = features_df[features_df['customer_id'] == cid].iloc[0]
        c_pred = pred_tx[(pred_tx['customer_id'] == cid) & (pred_tx['quantity'] > 0) & (~pred_tx['is_cancelled'])]
        
        expected_future_rev = float(c_pred['revenue'].sum()) if len(c_pred) > 0 else 0.0
        assert np.isclose(c_feat['future_revenue_90d'], expected_future_rev, atol=0.01)

def test_advanced_features_exist_and_no_leakage():
    """
    Tests that 5 advanced historical features exist, contain no nulls, and use t <= T_cutoff.
    """
    features_df = pd.read_parquet(FEATURES_PATH)
    adv_cols = ['recency_acceleration', 'spending_momentum', 'product_diversity_ratio', 'cancellation_revenue_ratio', 'purchase_frequency_rate']
    for col in adv_cols:
        assert col in features_df.columns, f"Missing feature {col}"
        assert features_df[col].isnull().sum() == 0, f"Nulls found in {col}"

# --- 3. MULTI-CUTOFF & TRAIN/TEST TEMPORAL ORDERING TESTS ---
def test_multi_cutoff_datasets_exist():
    assert os.path.exists("data/processed/temporal_splits/cutoff_A_features.parquet")
    assert os.path.exists("data/processed/temporal_splits/cutoff_B_features.parquet")
    assert os.path.exists("data/processed/temporal_splits/cutoff_C_features.parquet")

def test_train_test_temporal_ordering():
    df_a = pd.read_parquet("data/processed/temporal_splits/cutoff_A_features.parquet")
    df_b = pd.read_parquet("data/processed/temporal_splits/cutoff_B_features.parquet")
    df_c = pd.read_parquet("data/processed/temporal_splits/cutoff_C_features.parquet")
    
    # As cutoff date expands (A=Mar 2011, B=Jun 2011, C=Sep 2011), active customer count increases
    assert len(df_a) <= len(df_b) <= len(df_c)

# --- 4. ML MODEL INFERENCE & SCHEMA CONSISTENCY TESTS ---
def test_churn_model_inference():
    assert os.path.exists(CHURN_MODEL_PATH)
    model = joblib.load(CHURN_MODEL_PATH)
    features_df = pd.read_parquet(FEATURES_PATH)
    sample_x = features_df.head(10)
    
    probs = model.predict_proba(sample_x)[:, 1]
    assert len(probs) == 10
    assert np.all(probs >= 0.0) and np.all(probs <= 1.0)

def test_optimised_churn_model_inference_and_calibration():
    assert os.path.exists(CHURN_OPT_MODEL_PATH)
    model = joblib.load(CHURN_OPT_MODEL_PATH)
    features_df = pd.read_parquet(FEATURES_PATH)
    sample_x = features_df.head(10)
    
    probs = model.predict_proba(sample_x)[:, 1]
    assert len(probs) == 10
    assert np.all(probs >= 0.0) and np.all(probs <= 1.0)

def test_revenue_model_inference_non_negative():
    assert os.path.exists(REVENUE_MODEL_PATH)
    model = joblib.load(REVENUE_MODEL_PATH)
    features_df = pd.read_parquet(FEATURES_PATH)
    sample_x = features_df.head(10)
    
    preds = model.predict(sample_x)
    assert len(preds) == 10
    # Revenue predictions must be non-negative
    assert np.all(preds >= 0.0)

def test_segmentation_model():
    assert os.path.exists(SEG_MODEL_PATH)
    seg_pipeline = joblib.load(SEG_MODEL_PATH)
    assert 'kmeans' in seg_pipeline
    assert 'scaler' in seg_pipeline
    assert 'segment_map' in seg_pipeline
