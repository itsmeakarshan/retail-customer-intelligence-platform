# Churn Model Report

## 1. Problem Formulation & Temporal Cutoff
- **Objective**: Predict whether an active customer will make zero qualifying purchases during the 90-day prediction window (`2011-09-10` to `2011-12-09`).
- **Observation Cutoff Date**: `2011-09-10 00:00:00`
- **Total Customer Cohort**: `5,344` customers active during the observation period (`2009-12-01` to `2011-09-10`).
- **Observed 90-Day Churn Rate**: `57.07%` (3,050 churned customers, 2,294 retained customers).

## 2. Selected Architecture: LightGBM Classifier
- **Hyperparameters**: `n_estimators=100`, `max_depth=5`, `learning_rate=0.05`, `random_state=42`.
- **Holdout Test Set Performance (20% split, 1,069 samples)**:
  - **ROC-AUC**: `0.8288`
  - **PR-AUC**: `0.8494`
  - **F1-Score**: `0.8072`
  - **Recall**: `0.8443`
  - **Precision**: `0.7733`
  - **Brier Score Loss**: `0.1601`

## 3. Global Top Predictors
1. `recency` (Days inactive prior to cutoff) - Weight: 287.0
2. `unique_products` (Distinct stock codes purchased) - Weight: 218.0
3. `average_order_value` (Gross revenue / order count) - Weight: 197.0
4. `max_days_between_orders` (Maximum inter-purchase interval) - Weight: 180.0
5. `average_quantity` (Items per transaction) - Weight: 151.0
