# Customer Value & Revenue Prediction Report

## 1. Problem Definition
- **Target Variable**: `future_revenue_90d` (Actual positive purchase revenue generated in the 90-day window following `2011-09-10`).
- **Feature Constraint**: Strictly uses historical features computed prior to `2011-09-10`. Zero future information leakage.

## 2. Selected Architecture: Ridge Regression
- **Regularization**: L2 Penalty `alpha=1.0`.
- **Holdout Test Set Performance**:
  - **R² Score**: `0.8673` (Explains 86.73% of variance in future customer spend)
  - **Mean Absolute Error (MAE)**: `£492.95`
  - **Root Mean Squared Error (RMSE)**: `£1,471.01`

## 3. Financial Takeaways
- The customer value regression model enables accurate forward-looking valuation of individual customer cohorts.
- High-value outlier buyers are predicted with strong stability without inflating variance across medium-spend tiers.
