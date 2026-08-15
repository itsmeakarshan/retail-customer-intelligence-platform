"""
Demand Forecasting Module for Retail Intelligence Platform
Implements product-level daily time-series demand forecasting for the Next 30 Days.
Follows strict time-series validation (no future leakage), baseline comparisons (Moving Average),
and statistically defensible prediction intervals based on out-of-time empirical residual variance.
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timedelta
import logging
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

logger = logging.getLogger(__name__)

def calculate_smape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Calculates Symmetric Mean Absolute Percentage Error (sMAPE).
    Handles zero-demand intermittent periods robustly without division by zero.
    Returns value in percentage (0 to 100).
    """
    denominator = (np.abs(y_true) + np.abs(y_pred)) / 2.0
    diff = np.abs(y_pred - y_true)
    # Avoid zero division when both true and pred are 0
    mask = denominator != 0
    if not np.any(mask):
        return 0.0
    return float(np.mean(diff[mask] / denominator[mask]) * 100.0)

def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Calculates MAE, RMSE, and sMAPE."""
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    smape = calculate_smape(y_true, y_pred)
    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "smape": round(smape, 2)
    }

class DemandForecaster:
    """
    Product Demand Forecasting Engine.
    Produces 30-day future demand predictions with uncertainty intervals and validation metrics.
    """
    def __init__(self, horizon_days: int = 30):
        self.horizon_days = horizon_days
        self.models: Dict[str, Any] = {}
        self.residual_std: Dict[str, float] = {}
        self.validation_metrics: Dict[str, Dict[str, Any]] = {}
        self.product_metadata: Dict[str, Dict[str, Any]] = {}

    def prepare_daily_series(self, df_transactions: pd.DataFrame, stock_code: str) -> pd.DataFrame:
        """
        Extracts and prepares daily demand time-series for a specific product.
        Fills missing operational calendar days with 0 demand.
        """
        df_prod = df_transactions[
            (df_transactions['stock_code'] == stock_code) & 
            (df_transactions['is_cancelled'] == 0) & 
            (df_transactions['quantity'] > 0)
        ].copy()

        if df_prod.empty:
            return pd.DataFrame(columns=['date', 'quantity', 'price', 'tx_count'])

        df_prod['invoice_date'] = pd.to_datetime(df_prod['invoice_date'])
        df_prod['date'] = df_prod['invoice_date'].dt.floor('D')

        # Daily aggregation
        daily = df_prod.groupby('date').agg(
            quantity=('quantity', 'sum'),
            price=('price', 'mean'),
            tx_count=('invoice', 'nunique')
        ).reset_index()

        # Build full continuous date range
        min_date = daily['date'].min()
        max_date = daily['date'].max()
        full_idx = pd.date_range(start=min_date, end=max_date, freq='D')
        
        daily = daily.set_index('date').reindex(full_idx)
        daily['quantity'] = daily['quantity'].fillna(0.0)
        daily['tx_count'] = daily['tx_count'].fillna(0.0)
        daily['price'] = daily['price'].ffill().bfill().fillna(0.0)
        daily = daily.reset_index().rename(columns={'index': 'date'})

        return daily

    def create_features(self, df_daily: pd.DataFrame) -> pd.DataFrame:
        """
        Creates historical features for time t strictly using data available at t (no future leakage).
        Features:
        - Lags: 1, 7, 14, 21, 28
        - Rolling means: 7d, 14d, 28d (lagged by 1 to prevent current day leakage)
        - Rolling std: 7d, 14d
        - Day-of-week, Month, Day of month, Is Weekend
        - Rolling average price
        """
        df = df_daily.copy()
        q = df['quantity']

        # Lag features
        df['lag_1'] = q.shift(1)
        df['lag_7'] = q.shift(7)
        df['lag_14'] = q.shift(14)
        df['lag_21'] = q.shift(21)
        df['lag_28'] = q.shift(28)

        # Rolling statistics (using shift(1) so today's demand is never used in features)
        q_lag1 = q.shift(1)
        df['rolling_mean_7'] = q_lag1.rolling(window=7, min_periods=1).mean()
        df['rolling_mean_14'] = q_lag1.rolling(window=14, min_periods=1).mean()
        df['rolling_mean_28'] = q_lag1.rolling(window=28, min_periods=1).mean()
        df['rolling_std_7'] = q_lag1.rolling(window=7, min_periods=1).std().fillna(0.0)
        df['rolling_std_14'] = q_lag1.rolling(window=14, min_periods=1).std().fillna(0.0)
        df['rolling_max_14'] = q_lag1.rolling(window=14, min_periods=1).max().fillna(0.0)

        # Calendar features
        df['day_of_week'] = df['date'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['month'] = df['date'].dt.month
        df['day_of_month'] = df['date'].dt.day

        # Price feature (lagged)
        df['price_lag1'] = df['price'].shift(1).fillna(0.0)

        return df

    def train_and_evaluate_product(
        self, 
        df_daily: pd.DataFrame, 
        stock_code: str
    ) -> Optional[Dict[str, Any]]:
        """
        Performs strict chronological time-based validation on a single product.
        Splits:
        - Total series must be at least 60 days
        - Validation period: Last 30 days of the series
        - Training period: Everything prior to the last 30 days
        Compares Baseline (Moving Average) vs ML Model.
        """
        if len(df_daily) < 60:
            # Insufficient series length for 30-day time-series evaluation
            return None

        df_feat = self.create_features(df_daily).dropna()
        if len(df_feat) < 35:
            return None

        feature_cols = [
            'lag_1', 'lag_7', 'lag_14', 'lag_21', 'lag_28',
            'rolling_mean_7', 'rolling_mean_14', 'rolling_mean_28',
            'rolling_std_7', 'rolling_std_14', 'rolling_max_14',
            'day_of_week', 'is_weekend', 'month', 'day_of_month',
            'price_lag1'
        ]

        # Time-based split: out-of-time validation on last 30 days
        val_size = min(30, int(len(df_feat) * 0.25))
        train_df = df_feat.iloc[:-val_size]
        val_df = df_feat.iloc[-val_size:]

        X_train = train_df[feature_cols]
        y_train = train_df['quantity'].values
        X_val = val_df[feature_cols]
        y_val = val_df['quantity'].values

        # 1. Baseline: 14-day and 28-day Moving Average
        baseline_pred = val_df['rolling_mean_14'].values
        baseline_metrics = calculate_metrics(y_val, baseline_pred)

        # 2. ML Model: LightGBM Regressor or Ridge / RandomForest
        if HAS_LIGHTGBM and len(X_train) >= 30:
            model = lgb.LGBMRegressor(
                n_estimators=60,
                learning_rate=0.05,
                max_depth=4,
                num_leaves=15,
                random_state=42,
                verbosity=-1
            )
        else:
            model = RandomForestRegressor(
                n_estimators=50,
                max_depth=5,
                random_state=42
            )

        model.fit(X_train, y_train)
        ml_val_pred = np.maximum(0.0, model.predict(X_val))
        ml_metrics = calculate_metrics(y_val, ml_val_pred)

        # Residuals for Prediction Intervals
        residuals = y_val - ml_val_pred
        res_std = float(np.std(residuals)) if len(residuals) > 1 else float(np.std(y_val) * 0.3)
        res_std = max(res_std, 0.5)

        # Final fit on entire dataset to forecast future
        final_model = model
        final_model.fit(df_feat[feature_cols], df_feat['quantity'].values)

        self.models[stock_code] = final_model
        self.residual_std[stock_code] = res_std
        
        perf_info = {
            "stock_code": stock_code,
            "sample_days": len(df_daily),
            "validation_days": val_size,
            "ml_model_type": type(model).__name__,
            "ml_metrics": ml_metrics,
            "baseline_metrics": baseline_metrics,
            "ml_beat_baseline": bool(ml_metrics['mae'] <= baseline_metrics['mae']),
            "residual_std": round(res_std, 3),
            "interval_method": "Empirical residual standard deviation over out-of-time validation window (85% coverage ~ 1.44 sigma)"
        }
        self.validation_metrics[stock_code] = perf_info
        return perf_info

    def generate_30day_forecast(
        self, 
        df_daily: pd.DataFrame, 
        stock_code: str
    ) -> Dict[str, Any]:
        """
        Generates 30-day future daily demand forecasts with uncertainty bounds.
        """
        if stock_code not in self.models:
            # Attempt training
            res = self.train_and_evaluate_product(df_daily, stock_code)
            if not res:
                # Fallback to simple moving average if dataset is too short
                recent_mean = float(df_daily['quantity'].tail(14).mean()) if not df_daily.empty else 0.0
                recent_std = float(df_daily['quantity'].tail(14).std()) if not df_daily.empty else 1.0
                if np.isnan(recent_std):
                    recent_std = 1.0
                
                last_date = df_daily['date'].max() if not df_daily.empty else datetime.now()
                future_dates = [last_date + timedelta(days=i) for i in range(1, self.horizon_days + 1)]
                daily_forecasts = []
                for dt in future_dates:
                    daily_forecasts.append({
                        "date": dt.strftime("%Y-%m-%d"),
                        "forecast_units": round(recent_mean, 1),
                        "lower_bound": round(max(0.0, recent_mean - 1.44 * recent_std), 1),
                        "upper_bound": round(recent_mean + 1.44 * recent_std, 1)
                    })
                total_expected = round(recent_mean * self.horizon_days, 1)
                return {
                    "stock_code": stock_code,
                    "model_used": "MovingAverageFallback (Short Series)",
                    "expected_30d_demand": total_expected,
                    "lower_30d_estimate": round(max(0.0, total_expected - 1.44 * recent_std * np.sqrt(30)), 1),
                    "upper_30d_estimate": round(total_expected + 1.44 * recent_std * np.sqrt(30), 1),
                    "daily_forecast": daily_forecasts,
                    "interval_method": "Historical 14-day sample standard deviation"
                }

        model = self.models[stock_code]
        res_std = self.residual_std.get(stock_code, 1.0)

        # Recursive Multi-Step Forecasting for Next 30 Days
        df_working = df_daily.copy()
        last_date = df_working['date'].max()
        last_price = float(df_working['price'].iloc[-1]) if not df_working.empty else 1.0

        daily_forecasts = []
        feature_cols = [
            'lag_1', 'lag_7', 'lag_14', 'lag_21', 'lag_28',
            'rolling_mean_7', 'rolling_mean_14', 'rolling_mean_28',
            'rolling_std_7', 'rolling_std_14', 'rolling_max_14',
            'day_of_week', 'is_weekend', 'month', 'day_of_month',
            'price_lag1'
        ]

        for step in range(1, self.horizon_days + 1):
            next_date = last_date + timedelta(days=step)
            
            # Compute features for next_date using past actuals + previous step forecasts
            q = df_working['quantity']
            
            lag_1 = float(q.iloc[-1]) if len(q) >= 1 else 0.0
            lag_7 = float(q.iloc[-7]) if len(q) >= 7 else lag_1
            lag_14 = float(q.iloc[-14]) if len(q) >= 14 else lag_7
            lag_21 = float(q.iloc[-21]) if len(q) >= 21 else lag_14
            lag_28 = float(q.iloc[-28]) if len(q) >= 28 else lag_21

            rolling_7 = float(q.iloc[-7:].mean()) if len(q) >= 7 else float(q.mean())
            rolling_14 = float(q.iloc[-14:].mean()) if len(q) >= 14 else float(q.mean())
            rolling_28 = float(q.iloc[-28:].mean()) if len(q) >= 28 else float(q.mean())
            rolling_std7 = float(q.iloc[-7:].std()) if len(q) >= 7 else 0.0
            rolling_std14 = float(q.iloc[-14:].std()) if len(q) >= 14 else 0.0
            rolling_max14 = float(q.iloc[-14:].max()) if len(q) >= 14 else lag_1

            if np.isnan(rolling_std7): rolling_std7 = 0.0
            if np.isnan(rolling_std14): rolling_std14 = 0.0

            feat_row = pd.DataFrame([{
                'lag_1': lag_1,
                'lag_7': lag_7,
                'lag_14': lag_14,
                'lag_21': lag_21,
                'lag_28': lag_28,
                'rolling_mean_7': rolling_7,
                'rolling_mean_14': rolling_14,
                'rolling_mean_28': rolling_28,
                'rolling_std_7': rolling_std7,
                'rolling_std_14': rolling_std14,
                'rolling_max_14': rolling_max14,
                'day_of_week': next_date.dayofweek,
                'is_weekend': 1 if next_date.dayofweek in [5, 6] else 0,
                'month': next_date.month,
                'day_of_month': next_date.day,
                'price_lag1': last_price
            }])[feature_cols]

            pred_qty = max(0.0, float(model.predict(feat_row)[0]))
            
            # Prediction intervals (85% coverage: z=1.44, compounding slightly with horizon step)
            step_uncertainty = res_std * (1.0 + 0.015 * step)
            lower_bound = max(0.0, round(pred_qty - 1.44 * step_uncertainty, 1))
            upper_bound = round(pred_qty + 1.44 * step_uncertainty, 1)

            daily_forecasts.append({
                "date": next_date.strftime("%Y-%m-%d"),
                "forecast_units": round(pred_qty, 1),
                "lower_bound": lower_bound,
                "upper_bound": upper_bound
            })

            # Append synthetic row for next step's autoregressive features
            new_row = pd.DataFrame([{
                'date': next_date,
                'quantity': pred_qty,
                'price': last_price,
                'tx_count': 1.0
            }])
            df_working = pd.concat([df_working, new_row], ignore_index=True)

        tot_expected = round(sum(d['forecast_units'] for d in daily_forecasts), 1)
        tot_lower = round(max(0.0, sum(d['lower_bound'] for d in daily_forecasts)), 1)
        tot_upper = round(sum(d['upper_bound'] for d in daily_forecasts), 1)

        return {
            "stock_code": stock_code,
            "model_used": type(model).__name__,
            "expected_30d_demand": tot_expected,
            "lower_30d_estimate": tot_lower,
            "upper_30d_estimate": tot_upper,
            "daily_forecast": daily_forecasts,
            "validation_metrics": self.validation_metrics.get(stock_code),
            "interval_method": "Empirical residual standard deviation over out-of-time validation window (85% coverage)"
        }
