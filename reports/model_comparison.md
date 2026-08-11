# Comprehensive Audited Model Comparison Report

## 1. Multi-Cutoff Temporal Cross-Validation Summary

To evaluate model stability across time, expanding historical windows were constructed at 3 distinct observation cutoff dates:
- **Cutoff A (`2011-03-10`)**: 4,656 active customers | 65.72% 90d Churn Rate
- **Cutoff B (`2011-06-10`)**: 5,032 active customers | 68.48% 90d Churn Rate
- **Cutoff C (`2011-09-10`)**: 5,344 active customers | 57.11% 90d Churn Rate

### Out-Of-Time (OOT) Experiment
- **Training Set**: Historical data from Cutoff A + Cutoff B (`9,688` samples).
- **Test Set**: Out-of-time evaluation on Cutoff C (`5,344` samples).

---

## 2. Churn Classification Models Benchmark

| Model Architecture | Cutoff C Test ROC-AUC | Cutoff C PR-AUC | Cutoff C F1 | OOT Test ROC-AUC | OOT Test Recall | Brier Score |
|---|---|---|---|---|---|---|
| **LightGBM Classifier** *(Selected)* | **0.8288** | **0.8494** | **0.8072** | **0.8022** | **92.82%** | **0.1601** |
| XGBoost Classifier | 0.8266 | 0.8450 | 0.7984 | 0.8001 | 91.50% | 0.1610 |
| Gradient Boosting | 0.8251 | 0.8469 | 0.7956 | 0.7988 | 90.80% | 0.1618 |
| Random Forest | 0.8179 | 0.8360 | 0.7691 | 0.7915 | 88.20% | 0.1662 |
| Logistic Regression | 0.8083 | 0.8364 | 0.7824 | 0.7840 | 89.10% | 0.1742 |
| Dummy Baseline | 0.5000 | 0.5706 | 0.7266 | 0.5000 | 100.0% | 0.2450 |

---

## 3. Customer Value Regression Models Benchmark

| Model Architecture | Cutoff C R² Score | Cutoff C MAE (£) | Cutoff C RMSE (£) | Cutoff A MAE (£) | Cutoff B MAE (£) |
|---|---|---|---|---|---|
| **Ridge Regression (Standard Scale)** *(Selected)* | **0.8876** | **£487.32** | **£1,353.72** | **£248.92** | **£245.16** |
| **Huber Robust Regressor** | **0.8415** | **£393.71** | **£1,607.56** | **£228.68** | **£214.67** |
| Random Forest Regressor | 0.8166 | £431.70 | £1,729.24 | £247.76 | £264.85 |
| Gradient Boosting Regressor | 0.7501 | £458.37 | £2,018.49 | £268.40 | £275.10 |
| LightGBM Regressor | 0.4642 | £554.24 | £2,955.90 | £270.01 | £287.45 |
| Baseline (Mean) | -0.0003 | £831.35 | £4,038.71 | £480.12 | £460.50 |

---

## 4. Target Leakage Verification Table

Every single input feature was audited against the cutoff timestamp boundary ($t \le T_{cutoff}$):

| Feature Name | Temporal Window | Status | Description |
|---|---|---|---|
| `recency` | $t \le T_{cutoff}$ | ✅ Clean | Days inactive prior to $T_{cutoff}$. |
| `frequency` | $t \le T_{cutoff}$ | ✅ Clean | Completed orders prior to $T_{cutoff}$. |
| `monetary` | $t \le T_{cutoff}$ | ✅ Clean | Gross revenue spent prior to $T_{cutoff}$. |
| `gross_revenue` | $t \le T_{cutoff}$ | ✅ Clean | Sum of positive purchase line items before $T_{cutoff}$. |
| `total_orders` | $t \le T_{cutoff}$ | ✅ Clean | Distinct invoices prior to $T_{cutoff}$. |
| `total_items` | $t \le T_{cutoff}$ | ✅ Clean | Total quantity purchased before $T_{cutoff}$. |
| `average_order_value` | $t \le T_{cutoff}$ | ✅ Clean | `gross_revenue / total_orders` before $T_{cutoff}$. |
| `average_quantity` | $t \le T_{cutoff}$ | ✅ Clean | `total_items / total_orders` before $T_{cutoff}$. |
| `unique_products` | $t \le T_{cutoff}$ | ✅ Clean | Distinct stock codes purchased before $T_{cutoff}$. |
| `customer_lifetime_days` | $t \le T_{cutoff}$ | ✅ Clean | Days between first and last order before $T_{cutoff}$. |
| `days_since_first_purchase`| $t \le T_{cutoff}$ | ✅ Clean | `T_cutoff - min(invoice_date)` before $T_{cutoff}$. |
| `average_days_between_orders`| $t \le T_{cutoff}$ | ✅ Clean | Mean inter-order interval before $T_{cutoff}$. |
| `max_days_between_orders` | $t \le T_{cutoff}$ | ✅ Clean | Max inter-order interval before $T_{cutoff}$. |
| `cancellation_count` | $t \le T_{cutoff}$ | ✅ Clean | Cancelled invoices ('C') before $T_{cutoff}$. |
| `cancellation_rate` | $t \le T_{cutoff}$ | ✅ Clean | `cancellation_count / total_invoices` before $T_{cutoff}$. |
| `cancelled_revenue` | $t \le T_{cutoff}$ | ✅ Clean | Total lost revenue from returns before $T_{cutoff}$. |
| `recent_spend_90d` | $(T_{cutoff}-90d, T_{cutoff}]$ | ✅ Clean | Spend in 90 days leading up to $T_{cutoff}$. |
| `historical_spend_prior` | $t \le (T_{cutoff}-90d)$ | ✅ Clean | Spend prior to 90 days before $T_{cutoff}$. |
| `spend_trend` | $t \le T_{cutoff}$ | ✅ Clean | Ratio of recent spend to historical spend. |
| `order_frequency_trend` | $t \le T_{cutoff}$ | ✅ Clean | Ratio of recent order count to historical count. |
| `recent_order_count_90d` | $(T_{cutoff}-90d, T_{cutoff}]$ | ✅ Clean | Orders in 90 days prior to $T_{cutoff}$. |
| `country` | $t \le T_{cutoff}$ | ✅ Clean | Customer country. |
| `future_orders_90d` | $(T_{cutoff}, T_{cutoff}+90d]$ | 🎯 Target | Target variable for churn label creation. |
| `future_revenue_90d` | $(T_{cutoff}, T_{cutoff}+90d]$ | 🎯 Target | Target variable for revenue regression. |
