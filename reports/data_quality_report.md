# Data Quality & Exploration Report: Online Retail II

## Executive Summary
This report summarizes the data quality assessment and initial exploratory analysis conducted on the raw UCI Online Retail II dataset (`online_retail_II.csv`). The dataset contains transaction records from an online retail business operating between December 1, 2009, and December 9, 2011.

---

## 1. Raw Dataset Dimensions & Structure
- **Total Rows**: `1,067,371`
- **Total Columns**: `8`
- **Date Range**: `2009-12-01 07:45:00` to `2011-12-09 12:50:00` (24 months)
- **Unique Customers (`Customer ID`)**: `5,942`
- **Unique Invoices**: `53,628`
- **Unique Products (`StockCode`)**: `5,305`
- **Unique Countries**: `43`

### Column Overview
| Column | Data Type | Missing Count | Missing % | Description |
|---|---|---|---|---|
| `Invoice` | String / Object | 0 | 0.00% | 6-digit invoice number. If begins with 'C', indicates a cancellation. |
| `StockCode` | String / Object | 0 | 0.00% | Product code. |
| `Description` | String / Object | 4,382 | 0.41% | Product name. |
| `Quantity` | Integer / Float | 0 | 0.00% | Quantities of product per transaction. |
| `InvoiceDate` | Datetime | 0 | 0.00% | Date and time when transaction was generated. |
| `Price` | Float | 0 | 0.00% | Product unit price in GBP (£). |
| `Customer ID` | Float / String | 243,007 | 22.77% | 5-digit customer identifier. |
| `Country` | String | 0 | 0.00% | Customer country of origin. |

---

## 2. Key Data Quality Findings

### A. Missing Customer IDs (22.77%)
- **Findings**: 243,007 transaction records lack a `Customer ID`.
- **Impact**: Customer-level behavioral features (RFM, churn, revenue prediction) require identifiable customer entities.
- **Decision**: Transactions without `Customer ID` will be filtered out for customer-level ML modeling, but accounted for in total raw business data documentation.

### B. Cancellations & Negative Quantities
- **Findings**: 19,494 transactions (1.83%) begin with 'C' (e.g., `C489449`). Total negative quantity records: 22,950.
- **Impact**: Negative quantities represent returns or order cancellations. Treating them as positive purchases would distort monetary metrics.
- **Decision**: 
  - Invoices starting with 'C' are explicit cancellations.
  - Cancellations will be separated: positive transactions contribute to total spend and frequency, while cancellations/returns will be used to compute specific customer return/cancellation risk metrics (e.g., `cancellation_rate`, `cancelled_revenue`).

### C. Price Anomalies (Negative & Zero Prices)
- **Findings**:
  - `5` records with negative prices (likely manual accounting adjustments or bad entries).
  - `6,202` records with `Price == 0` (promotional items, system testing, or lost inventory entries).
- **Decision**: Filter out non-positive unit prices (`Price <= 0`) for monetary calculations.

### D. Duplicate Transactions (3.22%)
- **Findings**: `34,335` exact duplicate rows identified across all columns.
- **Decision**: Exact duplicates will be deduplicated to prevent artificial inflating of transaction counts.

---

## 3. Geographic Distribution (Top 5 Countries)
1. **United Kingdom**: ~90% of total transactions
2. **EIRE (Ireland)**
3. **Germany**
4. **France**
5. **Netherlands**

---

## 4. Pipeline Strategy & Data Cleaning Principles
1. **Raw Preservation**: Raw file `data/raw/online_retail_II.csv` is untouched.
2. **Reproducible Transformations**: All cleaning rules are encoded in `ml/src/data/clean_data.py`.
3. **Cleaned Schema**:
   - Filter `Customer ID.notnull()`
   - Filter `Price > 0`
   - Calculate line item revenue: `revenue = Quantity * Price`
   - Flag `is_cancelled` (Invoice starts with 'C')
   - Filter `Quantity > 0` for purchase metrics while storing returns in a separate feature pipeline.
