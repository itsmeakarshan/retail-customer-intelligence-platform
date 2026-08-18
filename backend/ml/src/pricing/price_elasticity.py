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
    Price Elasticity, Mathematical Price Optimisation, and Scenario Analysis Engine.
    Uses Log-Log Ordinary Least Squares (OLS) with Month (seasonality) and Day-of-Week controls.
    Enforces rigorous price variation and sample size diagnostics to prevent leverage distortion.
    """
    def __init__(
        self,
        min_samples: int = 20,
        min_distinct_prices: int = 2,
        min_cv: float = 0.04,
        max_dominant_share: float = 0.85,
        min_secondary_count: int = 3
    ):
        self.min_samples = min_samples
        self.min_distinct_prices = min_distinct_prices
        self.min_cv = min_cv
        self.max_dominant_share = max_dominant_share
        self.min_secondary_count = min_secondary_count

    def estimate_product_elasticity(
        self,
        df_transactions: pd.DataFrame,
        stock_code: str
    ) -> Dict[str, Any]:
        """
        Estimates price elasticity of demand for a single product.
        Controls for seasonality (Month) and Day of Week.
        Returns statistical diagnostics, confidence intervals, and data provenance.
        """
        if 'stock_code' in df_transactions.columns and not (df_transactions['stock_code'] == stock_code).all():
            df_prod = df_transactions[
                (df_transactions['stock_code'] == stock_code) &
                (df_transactions['is_cancelled'] == 0) &
                (df_transactions['quantity'] > 0) &
                (df_transactions['price'] > 0)
            ].copy()
        else:
            df_prod = df_transactions[
                (df_transactions['is_cancelled'] == 0) &
                (df_transactions['quantity'] > 0) &
                (df_transactions['price'] > 0)
            ].copy() if not df_transactions.empty else df_transactions.copy()

        sample_size = len(df_prod)
        if sample_size < self.min_samples:
            avg_p = round(float(df_prod['price'].mean()), 2) if not df_prod.empty else 0.0
            min_p = round(float(df_prod['price'].min()), 2) if not df_prod.empty else 0.0
            max_p = round(float(df_prod['price'].max()), 2) if not df_prod.empty else 0.0
            avg_q = round(float(df_prod['quantity'].mean()), 1) if not df_prod.empty else 0.0
            tot_q = int(df_prod['quantity'].sum()) if not df_prod.empty else 0
            distinct_p = df_prod['price'].nunique() if not df_prod.empty else 0

            return {
                "stock_code": stock_code,
                "status": "Insufficient Data",
                "sample_size": sample_size,
                "distinct_prices": distinct_p,
                "avg_price": avg_p,
                "min_price": min_p,
                "max_price": max_p,
                "avg_quantity": avg_q,
                "total_quantity": tot_q,
                "elasticity": None,
                "se": None,
                "t_stat": None,
                "p_value": None,
                "ci_lower": None,
                "ci_upper": None,
                "r_squared": None,
                "category": "Insufficient Data",
                "interpretation": f"Fewer than {self.min_samples} transactions ({sample_size} recorded). Insufficient transaction history to fit price elasticity model.",
                "is_statistically_significant": False,
                "is_statistically_eligible": False,
                "data_provenance": "Real historical transactions",
                "methodology": "Ordinary Least Squares Log-Log regression with Month and Day-of-Week controls"
            }

        distinct_prices = df_prod['price'].nunique()
        prices = df_prod['price'].values.astype(float)
        avg_price = float(np.mean(prices))
        std_price = float(np.std(prices))
        cv_price = std_price / avg_price if avg_price > 0 else 0.0
        
        p_counts = df_prod['price'].value_counts()
        dominant_share = float(p_counts.iloc[0]) / sample_size
        second_price_cnt = int(p_counts.iloc[1]) if len(p_counts) > 1 else 0

        # Eligibility check for meaningful price variation (preventing high-leverage distortion)
        if distinct_prices < self.min_distinct_prices or cv_price < self.min_cv or dominant_share > self.max_dominant_share or second_price_cnt < self.min_secondary_count:
            reason_details = []
            if distinct_prices < self.min_distinct_prices:
                reason_details.append(f"only {distinct_prices} distinct price level(s)")
            if cv_price < self.min_cv:
                reason_details.append(f"price coefficient of variation ({cv_price:.1%}) below {self.min_cv:.1%}")
            if dominant_share > self.max_dominant_share:
                reason_details.append(f"{dominant_share:.1%} of transactions at a single dominant price")
            if second_price_cnt < self.min_secondary_count:
                reason_details.append(f"secondary price tier has only {second_price_cnt} observation(s) (minimum {self.min_secondary_count} required to prevent leverage distortion)")

            reason_str = "; ".join(reason_details)
            return {
                "stock_code": stock_code,
                "status": "Insufficient Price Variation",
                "sample_size": sample_size,
                "distinct_prices": distinct_prices,
                "avg_price": round(avg_price, 2),
                "min_price": round(float(np.min(prices)), 2),
                "max_price": round(float(np.max(prices)), 2),
                "avg_quantity": round(float(df_prod['quantity'].mean()), 1),
                "total_quantity": int(df_prod['quantity'].sum()),
                "elasticity": None,
                "se": None,
                "t_stat": None,
                "p_value": None,
                "ci_lower": None,
                "ci_upper": None,
                "r_squared": None,
                "category": "Insufficient Variation",
                "interpretation": f"Insufficient price variation for reliable econometric estimation: {reason_str}.",
                "is_statistically_significant": False,
                "is_statistically_eligible": False,
                "data_provenance": "Real historical transactions",
                "methodology": "Ordinary Least Squares Log-Log regression with Month and Day-of-Week controls"
            }

        df_prod['invoice_date'] = pd.to_datetime(df_prod['invoice_date'])
        df_prod['month'] = df_prod['invoice_date'].dt.month
        df_prod['day_of_week'] = df_prod['invoice_date'].dt.dayofweek

        # Log transform for Log-Log regression: ln(Q) = b0 + b1*ln(P) + b2*Month + b3*DOW
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
                raise ValueError("Insufficient degrees of freedom for regression.")

            # Variance-covariance matrix of coefficients: (X'X)^(-1) * sigma^2
            sigma2 = ssr / df_resid
            cov_matrix = np.linalg.pinv(X.T @ X) * sigma2
            se_beta = float(np.sqrt(max(1e-12, cov_matrix[1, 1])))

            # t-statistic and two-tailed p-value
            t_stat = beta_p / se_beta
            p_val = float(2.0 * (1.0 - stats.t.cdf(abs(t_stat), df=df_resid)))

            # 95% Confidence Interval (alpha=0.05) using Student-t distribution
            t_crit = float(stats.t.ppf(0.975, df=df_resid))
            ci_lower = round(beta_p - t_crit * se_beta, 3)
            ci_upper = round(beta_p + t_crit * se_beta, 3)
            elasticity = round(beta_p, 3)
            is_sig = bool(p_val < 0.10)

            # Categorisation with non-causal association interpretations
            if not is_sig:
                category = "Inconclusive (Low Statistical Significance)"
                interpretation = (
                    f"Estimated elasticity is {elasticity} (95% CI: [{ci_lower}, {ci_upper}]), "
                    f"but p-value ({p_val:.4f}) exceeds 0.10. Price-demand relationship is not statistically distinguishable from zero after controlling for seasonality and day-of-week effects."
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
                    f"A 1% increase in price is associated with approximately a {pct_change:.2f}% decrease in quantity sold, "
                    f"after controlling for seasonality and day-of-week effects."
                )
            else:
                category = "Positive Association (Confounded/Premium)"
                interpretation = (
                    f"A 1% increase in price is associated with approximately a {elasticity:.2f}% increase in quantity sold, "
                    f"after controlling for seasonality and day-of-week effects. Observational association likely reflects premium product mix or bundle shifts."
                )

            return {
                "stock_code": stock_code,
                "status": "Success",
                "sample_size": sample_size,
                "distinct_prices": distinct_prices,
                "avg_price": round(avg_price, 2),
                "min_price": round(float(np.min(prices)), 2),
                "max_price": round(float(np.max(prices)), 2),
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
                "is_statistically_eligible": True,
                "data_provenance": "Real historical transactions",
                "methodology": "Ordinary Least Squares Log-Log regression with Month and Day-of-Week controls"
            }
        except Exception as e:
            return {
                "stock_code": stock_code,
                "status": "Estimation Failed",
                "sample_size": sample_size,
                "error": str(e),
                "category": "Insufficient Variation",
                "interpretation": f"Failed to fit regression model: {str(e)}",
                "is_statistically_eligible": False,
                "data_provenance": "Real historical transactions",
                "methodology": "Ordinary Least Squares Log-Log regression with Month and Day-of-Week controls"
            }

    def optimize_price(
        self,
        current_price: float,
        baseline_quantity: float,
        elasticity: float,
        objective: str = "profit",
        unit_cost: Optional[float] = None,
        min_price_factor: float = 0.50,
        max_price_factor: float = 1.50,
        grid_steps: int = 200
    ) -> Dict[str, Any]:
        """
        Performs mathematical price optimisation to find the price that maximises Profit or Revenue.
        
        Search Bounds:
        - Evaluates candidate prices from 50% to 150% of historical average price by default.
        - Enforces non-negative expected quantities via bounded elasticity formula.
        - Maximises Revenue = Price * Q(Price) or Profit = (Price - Unit Cost) * Q(Price).
        """
        cur_p = max(0.01, float(current_price))
        base_q = max(1.0, float(baseline_quantity))
        
        search_min = round(max(0.01, cur_p * min_price_factor), 2)
        search_max = round(max(search_min + 0.05, cur_p * max_price_factor), 2)
        
        # Grid of candidate prices with penny-precise resolution
        num_penny_steps = int(round((search_max - search_min) * 100.0)) + 1
        steps = min(2000, max(grid_steps, num_penny_steps))
        candidates = np.linspace(search_min, search_max, steps)
        candidates = np.unique(np.round(np.append(candidates, cur_p), 2))
        candidates.sort()

        evaluated_points = []
        best_point = None
        best_metric = -float('inf')

        for p in candidates:
            p_val = float(p)
            price_change_pct = ((p_val - cur_p) / cur_p) * 100.0
            
            # Bounded elasticity response: Q(P) = Q_0 * max(0.05, 1 + beta * (dP/P))
            expected_qty_factor = max(0.05, 1.0 + elasticity * (price_change_pct / 100.0))
            expected_qty = round(base_q * expected_qty_factor, 1)
            
            expected_rev = round(p_val * expected_qty, 2)
            
            expected_cost = None
            expected_prof = None
            margin_pct = None
            
            if unit_cost is not None and unit_cost >= 0:
                expected_cost = round(unit_cost * expected_qty, 2)
                expected_prof = round((p_val - unit_cost) * expected_qty, 2)
                margin_pct = round((expected_prof / expected_rev * 100.0), 1) if expected_rev > 0 else 0.0

            point_dict = {
                "price": round(p_val, 2),
                "price_change_pct": round(price_change_pct, 1),
                "expected_quantity": expected_qty,
                "expected_revenue": expected_rev,
                "expected_cost": expected_cost,
                "expected_profit": expected_prof,
                "profit_margin_pct": margin_pct
            }
            evaluated_points.append(point_dict)

            # Determine unrounded exact objective score for continuous optimisation
            raw_qty = base_q * expected_qty_factor
            if objective == "profit" and unit_cost is not None and unit_cost >= 0:
                score = (p_val - unit_cost) * raw_qty
            else:
                score = p_val * raw_qty

            if score > best_metric:
                best_metric = score
                best_point = point_dict
            elif score == best_metric and best_point is not None:
                # In exact tie-break, prefer price closest to historical price
                if abs(p_val - cur_p) < abs(best_point["price"] - cur_p):
                    best_point = point_dict

        if best_point is None:
            best_point = evaluated_points[0]

        opt_price = best_point["price"]
        is_at_boundary = bool(opt_price <= search_min or opt_price >= search_max)
        boundary_note = "Optimal price is at the edge of the tested search range (50% - 150% of historical price)." if is_at_boundary else None

        baseline_revenue = round(cur_p * base_q, 2)
        baseline_cost = round(unit_cost * base_q, 2) if unit_cost is not None and unit_cost >= 0 else None
        baseline_profit = round((cur_p - unit_cost) * base_q, 2) if unit_cost is not None and unit_cost >= 0 else None
        baseline_margin = round((baseline_profit / baseline_revenue * 100.0), 1) if baseline_profit is not None and baseline_revenue > 0 else None

        rev_diff = round(best_point["expected_revenue"] - baseline_revenue, 2)
        rev_diff_pct = round((rev_diff / baseline_revenue * 100.0), 1) if baseline_revenue > 0 else 0.0

        prof_diff = None
        prof_diff_pct = None
        if best_point["expected_profit"] is not None and baseline_profit is not None:
            prof_diff = round(best_point["expected_profit"] - baseline_profit, 2)
            prof_diff_pct = round((prof_diff / abs(baseline_profit) * 100.0), 1) if abs(baseline_profit) > 0 else 0.0

        # Sample 15-20 points for chart sensitivity curve
        step = max(1, len(evaluated_points) // 18)
        sampled_curve = evaluated_points[::step]
        if evaluated_points[-1] not in sampled_curve:
            sampled_curve.append(evaluated_points[-1])

        return {
            "objective": objective,
            "elasticity_used": elasticity,
            "search_min_price": search_min,
            "search_max_price": search_max,
            "unit_cost": unit_cost,
            "historical_avg_price": round(cur_p, 2),
            "baseline_30d_quantity": base_q,
            "baseline_30d_revenue": baseline_revenue,
            "baseline_30d_cost": baseline_cost,
            "baseline_30d_profit": baseline_profit,
            "baseline_profit_margin_pct": baseline_margin,
            "recommended_price": opt_price,
            "price_change_pct": best_point["price_change_pct"],
            "expected_30d_quantity": best_point["expected_quantity"],
            "quantity_change_pct": round(((best_point["expected_quantity"] - base_q) / base_q * 100.0), 1),
            "expected_30d_revenue": best_point["expected_revenue"],
            "revenue_difference": rev_diff,
            "revenue_diff_pct": rev_diff_pct,
            "expected_30d_cost": best_point["expected_cost"],
            "expected_30d_profit": best_point["expected_profit"],
            "profit_difference": prof_diff,
            "profit_diff_pct": prof_diff_pct,
            "profit_margin_pct": best_point["profit_margin_pct"],
            "is_at_boundary": is_at_boundary,
            "boundary_note": boundary_note,
            "sensitivity_curve": sampled_curve,
            "disclosure": "Price recommendations are mathematical estimates based on historical price-demand relationships. Historical elasticity represents statistical association and does not guarantee future customer behaviour."
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
        Clearly separates real historical baselines from hypothetical scenario inputs and outputs.
        """
        new_price = round(current_price * (1.0 + price_change_pct / 100.0), 2)
        
        # Bounded elasticity response: Q_new = Q_0 * (1 + beta * (dP/P))
        # Ensure expected quantity is positive and non-negative
        expected_qty_factor = max(0.05, 1.0 + elasticity * (price_change_pct / 100.0))
        expected_qty = round(baseline_quantity * expected_qty_factor, 1)

        baseline_revenue = round(current_price * baseline_quantity, 2)
        expected_revenue = round(new_price * expected_qty, 2)
        revenue_diff = round(expected_revenue - baseline_revenue, 2)
        revenue_diff_pct = round((revenue_diff / baseline_revenue * 100.0), 1) if baseline_revenue > 0 else 0.0

        scenario_profit = None
        baseline_profit = None
        profit_diff = None
        scenario_margin_pct = None
        baseline_margin_pct = None
        scenario_cost = None
        baseline_cost = None

        if scenario_unit_cost is not None and scenario_unit_cost >= 0:
            baseline_cost = round(scenario_unit_cost * baseline_quantity, 2)
            scenario_cost = round(scenario_unit_cost * expected_qty, 2)
            baseline_profit = round((current_price - scenario_unit_cost) * baseline_quantity, 2)
            scenario_profit = round((new_price - scenario_unit_cost) * expected_qty, 2)
            profit_diff = round(scenario_profit - baseline_profit, 2)
            baseline_margin_pct = round((baseline_profit / baseline_revenue * 100.0), 1) if baseline_revenue > 0 else 0.0
            scenario_margin_pct = round((scenario_profit / expected_revenue * 100.0), 1) if expected_revenue > 0 else 0.0

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
            "baseline_cost": baseline_cost,
            "scenario_cost": scenario_cost,
            "baseline_profit": baseline_profit,
            "scenario_profit": scenario_profit,
            "profit_difference": profit_diff,
            "baseline_margin_pct": baseline_margin_pct,
            "scenario_margin_pct": scenario_margin_pct,
            "disclosure": "Scenario simulation estimate based on historical observational elasticity (assumes constant elasticity around selected price). Unit cost is a hypothetical user assumption; unit costs are not in the historical transaction dataset."
        }
