"""
Price Analytics & Elasticity of Demand Module
Estimates observational price elasticity of demand using controlled log-log regression models.
Reports coefficient (beta), standard error, 95% confidence intervals, p-values, R-squared, and sample sizes.
Follows scientific honesty: observational price elasticity does not establish causality;
interprets relationships as "associated with" rather than "causes".
"""
import numpy as np
import pandas as pd
import scipy.stats as stats
from typing import Dict, List, Any, Optional

class PriceElasticityEngine:
    """
    Price Elasticity and Scenario Analysis Engine.
    """
    def __init__(self, min_samples: int = 15, min_distinct_prices: int = 2):
        self.min_samples = min_samples
        self.min_distinct_prices = min_distinct_prices

    def estimate_product_elasticity(
        self,
        df_transactions: pd.DataFrame,
        stock_code: str
    ) -> Dict[str, Any]:
        """
        Estimates price elasticity of demand for a single product.
        Controls for seasonality (Month) and Day of Week.
        """
        df_prod = df_transactions[
            (df_transactions['stock_code'] == stock_code) &
            (df_transactions['is_cancelled'] == 0) &
            (df_transactions['quantity'] > 0) &
            (df_transactions['price'] > 0)
        ].copy()

        sample_size = len(df_prod)
        if sample_size < self.min_samples:
            return {
                "stock_code": stock_code,
                "status": "Insufficient Data",
                "sample_size": sample_size,
                "distinct_prices": df_prod['price'].nunique() if not df_prod.empty else 0,
                "elasticity": None,
                "ci_lower": None,
                "ci_upper": None,
                "p_value": None,
                "r_squared": None,
                "category": "Insufficient Variation",
                "interpretation": f"Fewer than {self.min_samples} transactions ({sample_size} recorded). Insufficient data to fit elasticity model.",
                "is_statistically_significant": False
            }

        distinct_prices = df_prod['price'].nunique()
        price_std = float(df_prod['price'].std())
        if distinct_prices < self.min_distinct_prices or price_std < 0.01:
            return {
                "stock_code": stock_code,
                "status": "Insufficient Price Variation",
                "sample_size": sample_size,
                "distinct_prices": distinct_prices,
                "avg_price": round(float(df_prod['price'].mean()), 2),
                "elasticity": None,
                "ci_lower": None,
                "ci_upper": None,
                "p_value": None,
                "r_squared": None,
                "category": "Insufficient Variation",
                "interpretation": f"Product has only {distinct_prices} distinct price level(s) in history. Real price variation is required to estimate elasticity.",
                "is_statistically_significant": False
            }

        df_prod['invoice_date'] = pd.to_datetime(df_prod['invoice_date'])
        df_prod['month'] = df_prod['invoice_date'].dt.month
        df_prod['day_of_week'] = df_prod['invoice_date'].dt.dayofweek

        # Log transform for Log-Log regression: ln(Q) = a + b*ln(P) + c*Month + d*DOW
        log_q = np.log(df_prod['quantity'].values.astype(float))
        log_p = np.log(df_prod['price'].values.astype(float))
        month = df_prod['month'].values.astype(float)
        dow = df_prod['day_of_week'].values.astype(float)
        intercept = np.ones(sample_size)

        X = np.column_stack([intercept, log_p, month, dow])
        y = log_q

        try:
            # Ordinary Least Squares (OLS) via QR / SVD
            params, residuals, rank, s = np.linalg.lstsq(X, y, rcond=None)
            beta_p = float(params[1])

            # Fitted values and residuals
            y_pred = X @ params
            res = y - y_pred
            ssr = float(np.sum(res ** 2))
            sst = float(np.sum((y - np.mean(y)) ** 2))
            r_squared = float(max(0.0, 1.0 - (ssr / sst))) if sst > 0 else 0.0

            # Degrees of freedom
            df_resid = sample_size - X.shape[1]
            if df_resid <= 0:
                raise ValueError("Not enough degrees of freedom")

            # Variance-covariance matrix of coefficients: (X'X)^(-1) * sigma^2
            sigma2 = ssr / df_resid
            cov_matrix = np.linalg.pinv(X.T @ X) * sigma2
            se_beta = float(np.sqrt(max(1e-12, cov_matrix[1, 1])))

            # t-statistic and two-tailed p-value
            t_stat = beta_p / se_beta
            p_val = float(2.0 * (1.0 - stats.t.cdf(abs(t_stat), df=df_resid)))

            # 95% Confidence Interval (alpha=0.05)
            t_crit = float(stats.t.ppf(0.975, df=df_resid))
            ci_lower = round(beta_p - t_crit * se_beta, 3)
            ci_upper = round(beta_p + t_crit * se_beta, 3)
            elasticity = round(beta_p, 3)
            is_sig = bool(p_val < 0.10)

            # Categorisation
            if not is_sig:
                category = "Inconclusive (Low Statistical Significance)"
                interpretation = (
                    f"Estimated elasticity is {elasticity} (95% CI: [{ci_lower}, {ci_upper}]), "
                    f"but p-value ({p_val:.3f}) exceeds 0.10. Price-demand relationship is not statistically distinguishable from zero."
                )
            elif elasticity < -1.0:
                category = "Elastic (High Price Sensitivity)"
                pct_change = abs(elasticity)
                interpretation = (
                    f"A 1% increase in price is associated with approximately a {pct_change:.2f}% decrease in quantity sold, "
                    f"after controlling for seasonality and day-of-week effects."
                )
            elif -1.0 <= elasticity <= 0.0:
                category = "Inelastic (Low Price Sensitivity)"
                pct_change = abs(elasticity)
                interpretation = (
                    f"A 1% increase in price is associated with approximately a {pct_change:.2f}% decrease in quantity sold. "
                    f"Demand is relatively inelastic; price increases may yield higher total revenue."
                )
            else:
                category = "Positive Association (Confounded/Premium)"
                interpretation = (
                    f"A positive association (+{elasticity}) between price and volume was observed in historical records. "
                    f"This typically indicates premium mix shifts or bundled seasonal orders rather than a causal demand law."
                )

            return {
                "stock_code": stock_code,
                "status": "Success",
                "sample_size": sample_size,
                "distinct_prices": distinct_prices,
                "avg_price": round(float(df_prod['price'].mean()), 2),
                "min_price": round(float(df_prod['price'].min()), 2),
                "max_price": round(float(df_prod['price'].max()), 2),
                "avg_quantity": round(float(df_prod['quantity'].mean()), 1),
                "total_quantity": int(df_prod['quantity'].sum()),
                "elasticity": elasticity,
                "se": round(se_beta, 3),
                "t_stat": round(t_stat, 2),
                "p_value": round(p_val, 4),
                "ci_lower": ci_lower,
                "ci_upper": ci_upper,
                "r_squared": round(r_squared, 3),
                "category": category,
                "interpretation": interpretation,
                "is_statistically_significant": is_sig,
                "methodology": "Ordinary Least Squares Log-Log regression with Month and Day-of-Week controls"
            }
        except Exception as e:
            return {
                "stock_code": stock_code,
                "status": "Estimation Failed",
                "sample_size": sample_size,
                "error": str(e),
                "category": "Insufficient Variation",
                "interpretation": "Failed to invert design matrix for regression."
            }

    def simulate_price_scenario(
        self,
        current_price: float,
        baseline_quantity: float,
        elasticity: float,
        price_change_pct: float,
        scenario_unit_cost: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Simulates expected quantity, expected revenue, and optional scenario profit for a candidate price change.
        """
        new_price = round(current_price * (1.0 + price_change_pct / 100.0), 2)
        
        # Bounded elasticity response: Q_new = Q_0 * (1 + beta * (dP/P))
        # Ensure quantity cannot be negative
        expected_qty_factor = max(0.05, 1.0 + elasticity * (price_change_pct / 100.0))
        expected_qty = round(baseline_quantity * expected_qty_factor, 1)

        baseline_revenue = round(current_price * baseline_quantity, 2)
        expected_revenue = round(new_price * expected_qty, 2)
        revenue_diff = round(expected_revenue - baseline_revenue, 2)
        revenue_diff_pct = round((revenue_diff / baseline_revenue * 100.0), 1) if baseline_revenue > 0 else 0.0

        scenario_profit = None
        baseline_profit = None
        profit_diff = None
        if scenario_unit_cost is not None and scenario_unit_cost > 0:
            baseline_profit = round((current_price - scenario_unit_cost) * baseline_quantity, 2)
            scenario_profit = round((new_price - scenario_unit_cost) * expected_qty, 2)
            profit_diff = round(scenario_profit - baseline_profit, 2)

        return {
            "current_price": current_price,
            "new_price": new_price,
            "price_change_pct": price_change_pct,
            "elasticity_used": elasticity,
            "baseline_quantity": baseline_quantity,
            "expected_quantity": expected_qty,
            "quantity_change_pct": round((expected_qty_factor - 1.0) * 100.0, 1),
            "baseline_revenue": baseline_revenue,
            "expected_revenue": expected_revenue,
            "revenue_difference": revenue_diff,
            "revenue_diff_pct": revenue_diff_pct,
            "scenario_unit_cost": scenario_unit_cost,
            "baseline_profit": baseline_profit,
            "scenario_profit": scenario_profit,
            "profit_difference": profit_diff,
            "disclosure": "Scenario Simulator Estimate (Assumes constant price elasticity across local price variations)"
        }
