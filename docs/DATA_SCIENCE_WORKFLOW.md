# 🏗️ Complete Retail Data Science & Machine Learning Workflow

This document details the complete end-to-end Data Science, Machine Learning, and Production Architecture of the **Retail Customer Intelligence & Pricing Platform**.

---

## 🔄 End-to-End Architectural Pipeline

```
               ┌──────────────────────────────────────────────┐
               │              1. RAW DATA STORE               │
               │   data/raw/online_retail_II.csv (1,067,371)  │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         2. DATA QUALITY & SANITATION         │
               │  - Guest Checkout Filter (-243,007 rows)     │
               │  - Deduplication (-26,479 duplicate rows)    │
               │  - Non-Positive Price Sanitization (-70 rows)│
               │  - Returns Isolation (18,390 rows, 2.30%)    │
               │  Output: clean_transactions.parquet (797,815)│
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         3. EXPLORATORY DATA ANALYSIS         │
               │  - Transaction & Seasonality Patterns (Q4)   │
               │  - Customer RFM & Lorenz Spend Concentration │
               │  - Catalog Velocity & Elasticity Structure   │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │    4. ZERO-LEAKAGE FEATURE ENGINEERING       │
               │  - Observation Cutoff: [2009-12-01, 2011-09] │
               │  - 90-Day Forward Holdout: (2011-09, 2011-12]│
               │  - 26 Behavioral Vectors (RFM, Acceleration) │
               │  Output: customer_features.parquet (5,344)   │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │          5. ML TRAINING & BENCHMARKING       │
               │  - Churn: Dummy, LogReg, RF, GB, XGB, LightGBM│
               │  - Revenue: Mean, Ridge, Huber, RF, GB, LGBM │
               │  - Forecaster: LightGBM vs 30d Moving Average│
               │  - Segmentation: Standardized K-Means (k=4)  │
               │  - Elasticity: Log-Log OLS w/ Season Controls│
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │       6. TEMPORAL OUT-OF-TIME VALIDATION     │
               │  - Multi-Cutoff Evaluation: Cutoffs A, B, C  │
               │  - Ground-Truth Holdout & Reliability Brier  │
               │  Output: ml/reports/audited_metrics.json     │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │          7. PRODUCTION MODEL SELECTION       │
               │  - Churn: Gradient Boosting (0.8313 ROC-AUC) │
               │  - Revenue: Random Forest (0.8875 R²)        │
               │  - Demand: LightGBM (31.84% sMAPE, +18.6%)   │
               │  - Segments: K-Means k=4 (0.428 Silhouette)  │
               │  - Pricing: Log-Log OLS (877 Elastic SKUs)   │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │           8. SAVED MODEL ARTIFACTS           │
               │  - ml/models/churn_model.joblib (142.8 KB)   │
               │  - ml/models/revenue_model.joblib (1.64 MB)  │
               │  - ml/models/segmentation_model.joblib (23KB)│
               │  - SQLite DB: data/processed/retail_analytics│
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │           9. PRODUCTION FASTAPI BACKEND      │
               │  - /api/forecasting/products & /summary      │
               │  - /api/inventory/summary & /simulate        │
               │  - /api/pricing/products & /optimize         │
               │  - /api/revenue-risk/summary & /customers    │
               │  - /api/segments/distribution                │
               │  - /api/model-insights/summary               │
               │  - /api/monitoring/summary                   │
               │  - /api/data-quality/summary                 │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      10. REACT FRONTEND DECISION DASHBOARD   │
               │  - Demand Forecasting Dashboard              │
               │  - Inventory & Expiry Optimisation Center    │
               │  - Business Pricing & Profit Calculator      │
               │  - Revenue at Risk & Retention Campaigns     │
               │  - Customer Behavioral Segmentation          │
               │  - ML Model Insights & Architecture Inventory│
               │  - Data Quality & Governance Audit           │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         11. SYSTEM & MODEL MONITORING        │
               │  - Live SQLite DB Connectivity & Latency     │
               │  - 5/5 In-Memory ML Runtime State Registry   │
               │  - Feature Distribution Drift (PSI & KS Test)│
               │  - Velocity Spike Alerts (>40% Volume Shifts)│
               └──────────────────────────────────────────────┘
```

---

## 📊 Summary of Production ML Models

| Model Pipeline | Problem Formulation | Algorithm | Validation Methodology | Verified Performance | Production Artifact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Product Demand Forecaster** | 30-Day Recursive Daily Demand | LightGBM Regressor (Lags + Rolling) | Out-of-Time 30-Day Validation | **31.84% sMAPE** (+18.6% vs Moving Average) | `ml/src/forecasting/demand_forecaster.py` |
| **Customer Churn Classifier** | 90-Day Account Inactivity | Gradient Boosting (Tree Ensemble) | 80/20 Stratified Chronological Split | **0.8313 ROC-AUC**, **0.8512 PR-AUC**, 0.8028 F1 | `ml/models/churn_model.joblib` |
| **Customer Forward Spend** | 90-Day Forward Revenue (£) | Random Forest Regressor (100 Trees) | 80/20 Stratified Chronological Split | **0.8875 $R^2$**, **£400.53 MAE** | `ml/models/revenue_model.joblib` |
| **Customer Segmentation** | RFM Behavioral Clustering | K-Means ($k=4$, Standard Scaler) | Inertia Elbow & Silhouette Analysis | **0.428 Silhouette Score** (4 Distinct Personas) | `ml/models/segmentation_model.joblib` |
| **Price Elasticity Engine** | Econometric Demand Sensitivity | Log-Log OLS w/ Seasonality Controls | Statistical Eligibility Gating ($N \ge 20$) | **877 Verified Elastic SKUs** (Mean $\beta = -1.85$) | `ml/src/pricing/price_elasticity.py` |

---

## 🛡️ Data Science Ethics & Governance Protocol
1. **Zero Fabricated Results:** No placeholder metrics, random seed benchmarks, or synthetic rows are used in ML training.
2. **Synthetic Demo Isolation:** Demonstration customer email addresses and product expiration dates reside in strictly segregated demo tables (`customer_demo_metadata`, `product_demo_metadata`) and **never enter** ML feature pipelines.
3. **Observational Honest Disclosure:** Price elasticity models are explicitly disclosed as non-causal statistical associations rather than randomized controlled experiments.
