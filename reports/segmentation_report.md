# Customer Segmentation Report

## 1. Methodology
- **Algorithm**: K-Means Unsupervised Clustering (k=5 selected via Silhouette optimization).
- **Features**: Standardized RFM (Recency, Frequency, Monetary) + Cancellation Rate + Unique Product Variety.

## 2. Cluster Profiles & Business Classifications
| Segment Name | Customer Count | Avg Recency | Avg Frequency | Total Spend (£) | Avg Churn Risk | Total Revenue at Risk (£) |
|---|---|---|---|---|---|---|
| **High-Value Champions** | 4 | 3.0 days | 171.0 orders | £306,438.62 | 0.00% | £0.00 |
| **High-Value At Risk** | 25 | 26.2 days | 100.9 orders | £418,293.78 | 8.00% | £18,172.90 |
| **Active Casuals** | 1,146 | 52.5 days | 13.9 orders | £1,322,695.88 | 19.72% | £223,782.10 |
| **Low-Value / Dormant** | 1,057 | 258.1 days | 3.0 orders | £474,836.52 | 65.66% | £282,109.80 |
| **Segment 0 (Inactive)** | 3,112 | 254.4 days | 2.6 orders | £520,854.28 | 68.38% | £454,293.84 |
