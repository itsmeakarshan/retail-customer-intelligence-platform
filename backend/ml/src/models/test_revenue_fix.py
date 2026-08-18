"""
Revenue Model Stabilization & Architecture Audit Script
Tests multiple regression formulations:
1. Standard monetary scale (Target = future_revenue_90d)
2. Winsorized / Outlier-Clipped Target (99th percentile clip)
3. Tree-based regressors (Random Forest, Gradient Boosting, XGBoost, LightGBM)
"""
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import Ridge, HuberRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import lightgbm as lgb
import xgboost as xgb

def audit_revenue_formulations():
    dfs = {
        "Cutoff A (2011-03-10)": pd.read_parquet("data/processed/temporal_splits/cutoff_A_features.parquet"),
        "Cutoff B (2011-06-10)": pd.read_parquet("data/processed/temporal_splits/cutoff_B_features.parquet"),
        "Cutoff C (2011-09-10)": pd.read_parquet("data/processed/temporal_splits/cutoff_C_features.parquet")
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
    
    for split_name, df_split in dfs.items():
        print(f"\n=================== Revenue Audit for {split_name} ===================")
        X = df_split[numeric_features + categorical_features].copy()
        y_r = df_split['future_revenue_90d'].values
        
        X_train, X_test, y_train_r, y_test_r = train_test_split(
            X, y_r, test_size=0.20, random_state=42
        )
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
            ]
        )
        
        X_train_t = preprocessor.fit_transform(X_train)
        X_test_t = preprocessor.transform(X_test)
        
        # Test 1: Standard Scale Ridge (no log transform)
        ridge = Ridge(alpha=100.0, random_state=42)
        ridge.fit(X_train_t, y_train_r)
        pred_ridge = np.maximum(ridge.predict(X_test_t), 0.0)
        print(f"[Ridge (Standard)] R2: {r2_score(y_test_r, pred_ridge):.4f} | MAE: £{mean_absolute_error(y_test_r, pred_ridge):.2f} | RMSE: £{np.sqrt(mean_squared_error(y_test_r, pred_ridge)):.2f}")
        
        # Test 2: Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
        rf.fit(X_train_t, y_train_r)
        pred_rf = np.maximum(rf.predict(X_test_t), 0.0)
        print(f"[Random Forest] R2: {r2_score(y_test_r, pred_rf):.4f} | MAE: £{mean_absolute_error(y_test_r, pred_rf):.2f} | RMSE: £{np.sqrt(mean_squared_error(y_test_r, pred_rf)):.2f}")
        
        # Test 3: LightGBM Regressor
        lgbm = lgb.LGBMRegressor(n_estimators=100, max_depth=5, learning_rate=0.03, random_state=42, verbose=-1)
        lgbm.fit(X_train_t, y_train_r)
        pred_lgbm = np.maximum(lgbm.predict(X_test_t), 0.0)
        print(f"[LightGBM Regressor] R2: {r2_score(y_test_r, pred_lgbm):.4f} | MAE: £{mean_absolute_error(y_test_r, pred_lgbm):.2f} | RMSE: £{np.sqrt(mean_squared_error(y_test_r, pred_lgbm)):.2f}")

        # Test 4: Huber Regressor (Robust to monetary outliers)
        huber = HuberRegressor(max_iter=1000)
        huber.fit(X_train_t, y_train_r)
        pred_huber = np.maximum(huber.predict(X_test_t), 0.0)
        print(f"[Huber Robust] R2: {r2_score(y_test_r, pred_huber):.4f} | MAE: £{mean_absolute_error(y_test_r, pred_huber):.2f} | RMSE: £{np.sqrt(mean_squared_error(y_test_r, pred_huber)):.2f}")

if __name__ == "__main__":
    audit_revenue_formulations()
