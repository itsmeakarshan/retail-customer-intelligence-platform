# 📓 Data Science & Machine Learning Notebook Layer

This directory contains the complete, reproducible **Data Science and Machine Learning Notebook Suite** for the Retail Customer Intelligence & Pricing Platform. 

Every notebook is directly connected to the project's real production datasets (`data/raw/online_retail_II.csv`, `data/processed/clean_transactions.parquet`), production model pipelines (`ml/src/`), trained model artifacts (`ml/models/`), and evaluation metrics reports (`ml/reports/`).

---

## 🗺️ Notebook Roadmap & Workflow Sequence

```
Raw Transaction Ingestion (1,067,371 rows)
    │
    ▼
01_dataset_overview.ipynb ──────────► Overview, Schema & Data Dictionary
    │
    ▼
02_data_quality_and_cleaning.ipynb ─► 5-Step ETL Sanitation Funnel (797,815 clean rows)
    │
    ├─────────────────────────────────────────┬────────────────────────────────────────┐
    ▼                                         ▼                                        ▼
03_sales_and_revenue_eda.ipynb      04_customer_eda.ipynb                    05_product_and_demand_eda.ipynb
(Temporal & Seasonal Patterns)     (RFM Spend Concentration & Pareto)       (Catalog Demand & Price Variation)
    │                                         │                                        │
    └─────────────────────────────────────────┼────────────────────────────────────────┘
                                              ▼
                                    06_feature_engineering.ipynb
                                    (Zero-Leakage 90-Day Split & 26 Behavioral Predictors)
                                              │
    ┌─────────────────────────────────────────┼────────────────────────────────────────┐
    ▼                                         ▼                                        ▼
07_customer_segmentation.ipynb      08_churn_prediction.ipynb                09_customer_revenue_prediction.ipynb
(Unsupervised K-Means k=4)         (Gradient Boosting, 0.8313 AUC)          (Random Forest, 0.8875 R²)
    │                                         │                                        │
    └─────────────────────────────────────────┼────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴────────────────────────┐
                    ▼                                                  ▼
          10_demand_forecasting.ipynb                        11_price_elasticity.ipynb
          (LightGBM 30-Day Forward Forecast)                 (Econometric Log-Log OLS & Profit Optimization)
                    │                                                  │
                    └─────────────────────────┬────────────────────────┘
                                              ▼
                                    12_model_comparison_and_evaluation.ipynb
                                    (Temporal Multi-Cutoff Validation & Trade-off Synthesis)
                                              │
                                              ▼
                                    13_error_analysis_and_business_insights.ipynb
                                    (Residual Diagnostics, Failure Modes & Commercial Strategy)
```

---

## 📑 Notebook Inventory & Production Traceability

| Notebook | Focus & Objective | Key Ground-Truth Metrics | Production Script | Saved Artifact | Dashboard Consumer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`01_dataset_overview.ipynb`** | Raw & clean dataset schema audit | 1,067,371 raw $\to$ 797,815 clean rows; 5,939 customers, 4,646 SKUs | `ml/src/data/clean_data.py` | `clean_transactions.parquet` | `DataQualityPage.tsx` |
| **`02_data_quality_and_cleaning.ipynb`** | Reproducible 5-step ETL pipeline | 243,007 guest rows filtered, 26,479 duplicates removed | `ml/src/data/clean_data.py` | `retail_analytics.db` | `DataQualityPage.tsx` |
| **`03_sales_and_revenue_eda.ipynb`** | Revenue seasonality & velocity | £17.37M gross revenue, peak Q4 wholesale spikes | `ml/src/forecasting/demand_forecaster.py` | `clean_transactions.parquet` | `OverviewDashboardPage.tsx` |
| **`04_customer_eda.ipynb`** | Customer RFM & spend concentration | Repeat buyers generate 96.1% of revenue; top 20% generate ~78% | `ml/src/features/build_features.py` | `customer_features.parquet` | `CustomerSegmentationPage.tsx` |
| **`05_product_and_demand_eda.ipynb`** | Catalog demand & price structure | 4,631 total SKUs; 4,363 eligible for ML; 877 multi-price elastic | `ml/src/pricing/price_elasticity.py` | `clean_transactions.parquet` | `InventoryOptimisationPage.tsx` |
| **`06_feature_engineering.ipynb`** | Zero-leakage temporal feature vectors | 26 behavioral features; 90-day observation/prediction cutoff | `ml/src/features/build_features.py` | `customer_features.parquet` | ML Training Pipeline |
| **`07_customer_segmentation.ipynb`** | Unsupervised customer RFM clustering | Optimal $k=4$, Silhouette Score = 0.428 | `ml/src/models/train_all.py` | `ml/models/segmentation_model.joblib` | `CustomerSegmentationPage.tsx` |
| **`08_churn_prediction.ipynb`** | 90-day customer churn risk classification | Gradient Boosting: **0.8313 ROC-AUC**, **0.8512 PR-AUC**, 0.8028 F1 | `ml/src/models/train_all.py` | `ml/models/churn_model.joblib` | `RevenueRiskPage.tsx` |
| **`09_customer_revenue_prediction.ipynb`** | 90-day forward customer spend regression | Random Forest Regressor: **0.8875 $R^2$**, £400.53 MAE | `ml/src/models/train_all.py` | `ml/models/revenue_model.joblib` | `RevenueRiskPage.tsx` |
| **`10_demand_forecasting.ipynb`** | 30-day recursive daily SKU forecasting | LightGBM: **31.84% sMAPE** (+18.6% vs 30-day Moving Average) | `ml/src/forecasting/demand_forecaster.py` | Dynamic LightGBM Pipeline | `DemandForecastingPage.tsx` |
| **`11_price_elasticity.ipynb`** | Econometric log-log OLS pricing & profit optimization | 877 verified elastic SKUs (mean $\beta = -1.85$), seasonal controls | `ml/src/pricing/price_elasticity.py` | Dynamic OLS Engine | `PricingProfitPage.tsx` |
| **`12_model_comparison_and_evaluation.ipynb`** | Multi-cutoff temporal cross-validation | Validated across Cutoffs A (2011-03), B (2011-06), C (2011-09) | `ml/src/models/evaluate_temporal_splits.py`| `ml/reports/audited_metrics.json` | `ModelPerformancePage.tsx` |
| **`13_error_analysis_and_business_insights.ipynb`** | Residual diagnostics & commercial strategy | 92.2% top-500 retention precision; margin-optimized pricing | Integrated Platform | `ml/reports/optimisation_results.json` | Executive Decision System |

---

## ⚙️ Environment Setup & Reproduction

```bash
# 1. Activate Python virtual environment
source .venv/bin/activate

# 2. Run automated validation across all 13 notebooks
python scripts/validate_notebooks.py

# 3. Launch Jupyter Notebook or Jupyter Lab
jupyter lab notebooks/
```
