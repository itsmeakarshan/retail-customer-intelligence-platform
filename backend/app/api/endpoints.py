"""
FastAPI REST API Endpoints Implementation
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import pandas as pd
import os
import json
import math
from typing import Optional, List, Dict, Any

from backend.app.db.database import get_db
from backend.app.schemas import schemas
from backend.app.services.inference import inference_service
from backend.app.services.ai_assistant import ai_assistant_service
from backend.app.services.email_service import email_service

router = APIRouter(prefix="/api")

@router.get("/health", response_model=schemas.HealthResponse)
def get_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1")).fetchone()
        db_ok = True
    except Exception:
        db_ok = False
        
    models_ok = inference_service.is_ready()
    
    return {
        "status": "ok" if (db_ok and models_ok) else "degraded",
        "database_connected": db_ok,
        "models_loaded": models_ok,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/summary", response_model=schemas.ExecutiveSummary)
def get_executive_summary(db: Session = Depends(get_db)):
    query = """
    SELECT 
        COUNT(*) as total_customers,
        SUM(CASE WHEN churn_probability >= 0.70 THEN 1 ELSE 0 END) as high_risk_customers,
        SUM(CASE WHEN churn_probability >= 0.40 AND churn_probability < 0.70 THEN 1 ELSE 0 END) as medium_risk_customers,
        SUM(CASE WHEN churn_probability < 0.40 THEN 1 ELSE 0 END) as low_risk_customers,
        AVG(churn_probability) as overall_churn_rate,
        SUM(revenue_at_risk) as total_revenue_at_risk,
        SUM(predicted_future_value) as total_predicted_future_value,
        AVG(monetary) as average_customer_value,
        COUNT(DISTINCT segment_name) as total_segments
    FROM customers;
    """
    result = db.execute(text(query)).mappings().fetchone()
    if not result:
        raise HTTPException(status_code=500, detail="Failed to calculate executive summary metrics")
        
    return {
        "total_customers": int(result["total_customers"]),
        "high_risk_customers": int(result["high_risk_customers"]),
        "medium_risk_customers": int(result["medium_risk_customers"]),
        "low_risk_customers": int(result["low_risk_customers"]),
        "overall_churn_rate": round(float(result["overall_churn_rate"] or 0), 4),
        "total_revenue_at_risk": round(float(result["total_revenue_at_risk"] or 0), 2),
        "total_predicted_future_value": round(float(result["total_predicted_future_value"] or 0), 2),
        "average_customer_value": round(float(result["average_customer_value"] or 0), 2),
        "total_segments": int(result["total_segments"])
    }

@router.get("/customers", response_model=schemas.PaginatedCustomersResponse)
def get_customers(
    search: Optional[str] = Query(None, description="Search by Customer ID"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (High Risk, Medium Risk, Low Risk)"),
    segment: Optional[str] = Query(None, description="Filter by segment name"),
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    sort_by: str = Query("revenue_at_risk", description="Column to sort by"),
    order: str = Query("desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db)
):
    valid_sort_cols = [
        "customer_id", "recency", "frequency", "monetary",
        "gross_revenue", "churn_probability", "predicted_future_value", "revenue_at_risk"
    ]
    if sort_by not in valid_sort_cols:
        sort_by = "revenue_at_risk"
        
    sort_dir = "DESC" if order.lower() == "desc" else "ASC"
    
    where_clauses = []
    params = {}
    
    if search and not isinstance(search, Query):
        where_clauses.append("customer_id LIKE :search")
        params["search"] = f"%{search}%"
        
    if risk_level and not isinstance(risk_level, Query):
        where_clauses.append("risk_level = :risk_level")
        params["risk_level"] = risk_level
        
    if segment and not isinstance(segment, Query):
        where_clauses.append("segment_name = :segment")
        params["segment"] = segment
        
    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    
    # Count total
    count_sql = f"SELECT COUNT(*) FROM customers{where_str}"
    total_count = db.execute(text(count_sql), params).scalar()
    
    offset = (page - 1) * limit
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    
    # Query items
    query_sql = f"""
    SELECT 
        customer_id, country, recency, frequency, monetary, gross_revenue,
        churn_probability, predicted_future_value, revenue_at_risk, risk_level, segment_name
    FROM customers
    {where_str}
    ORDER BY {sort_by} {sort_dir}
    LIMIT :limit OFFSET :offset
    """
    params["limit"] = limit
    params["offset"] = offset
    
    rows = db.execute(text(query_sql), params).mappings().fetchall()
    
    customers = [
        {
            "customer_id": str(r["customer_id"]),
            "country": r["country"],
            "recency": int(r["recency"]),
            "frequency": int(r["frequency"]),
            "monetary": round(float(r["monetary"]), 2),
            "gross_revenue": round(float(r["gross_revenue"]), 2),
            "churn_probability": round(float(r["churn_probability"]), 4),
            "predicted_future_value": round(float(r["predicted_future_value"]), 2),
            "revenue_at_risk": round(float(r["revenue_at_risk"]), 2),
            "risk_level": r["risk_level"],
            "segment_name": r["segment_name"]
        } for r in rows
    ]
    
    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "customers": customers
    }

@router.get("/customers/{customer_id}", response_model=schemas.CustomerDetailResponse)
def get_customer_detail(customer_id: str, db: Session = Depends(get_db)):
    sql_cust = "SELECT * FROM customer_features WHERE customer_id = :cid"
    cust_row = db.execute(text(sql_cust), {"cid": customer_id}).mappings().fetchone()
    
    if not cust_row:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")
        
    # Get recent transactions
    sql_tx = """
    SELECT invoice, stock_code, description, quantity, invoice_date, price, revenue, is_cancelled
    FROM transactions
    WHERE customer_id = :cid
    ORDER BY invoice_date DESC
    LIMIT 20
    """
    tx_rows = db.execute(text(sql_tx), {"cid": customer_id}).mappings().fetchall()
    
    recent_transactions = [
        {
            "invoice": str(tx["invoice"]),
            "stock_code": str(tx["stock_code"]),
            "description": str(tx["description"]),
            "quantity": int(tx["quantity"]),
            "invoice_date": str(tx["invoice_date"]),
            "price": round(float(tx["price"]), 2),
            "revenue": round(float(tx["revenue"]), 2),
            "is_cancelled": bool(tx["is_cancelled"])
        } for tx in tx_rows
    ]
    
    risk_level = "High Risk" if cust_row["churn_probability"] >= 0.70 else ("Medium Risk" if cust_row["churn_probability"] >= 0.40 else "Low Risk")
    
    return {
        "customer_id": str(cust_row["customer_id"]),
        "country": str(cust_row["country"]),
        "recency": int(cust_row["recency"]),
        "frequency": int(cust_row["frequency"]),
        "monetary": round(float(cust_row["monetary"]), 2),
        "gross_revenue": round(float(cust_row["gross_revenue"]), 2),
        "average_order_value": round(float(cust_row["average_order_value"]), 2),
        "average_quantity": round(float(cust_row["average_quantity"]), 2),
        "unique_products": int(cust_row["unique_products"]),
        "customer_lifetime_days": int(cust_row["customer_lifetime_days"]),
        "cancellation_count": int(cust_row["cancellation_count"]),
        "cancellation_rate": round(float(cust_row["cancellation_rate"]), 4),
        "cancelled_revenue": round(float(cust_row["cancelled_revenue"]), 2),
        "recent_spend_90d": round(float(cust_row["recent_spend_90d"]), 2),
        "historical_spend_prior": round(float(cust_row["historical_spend_prior"]), 2),
        "spend_trend": round(float(cust_row["spend_trend"]), 4),
        "churn_label": int(cust_row["churn_label"]),
        "churn_probability": round(float(cust_row["churn_probability"]), 4),
        "predicted_future_value": round(float(cust_row["predicted_future_value"]), 2),
        "revenue_at_risk": round(float(cust_row["revenue_at_risk"]), 2),
        "risk_level": risk_level,
        "segment_name": str(cust_row["segment_name"]),
        "recent_transactions": recent_transactions
    }

@router.get("/customers/{customer_id}/risk")
def get_customer_risk(customer_id: str, db: Session = Depends(get_db)):
    sql_cust = "SELECT customer_id, churn_probability, predicted_future_value, revenue_at_risk, risk_level, segment_name FROM customers WHERE customer_id = :cid"
    row = db.execute(text(sql_cust), {"cid": customer_id}).mappings().fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")
        
    return {
        "customer_id": str(row["customer_id"]),
        "churn_probability": round(float(row["churn_probability"]), 4),
        "predicted_future_value": round(float(row["predicted_future_value"]), 2),
        "revenue_at_risk": round(float(row["revenue_at_risk"]), 2),
        "risk_level": row["risk_level"],
        "segment_name": row["segment_name"]
    }

@router.get("/customers/{customer_id}/explanation", response_model=schemas.CustomerExplanationResponse)
def get_customer_explanation(customer_id: str, db: Session = Depends(get_db)):
    sql_cust = "SELECT * FROM customer_features WHERE customer_id = :cid"
    row = db.execute(text(sql_cust), {"cid": customer_id}).mappings().fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")
        
    row_dict = dict(row)
    explanation = inference_service.explain_customer_risk(row_dict)
    
    risk_level = "High Risk" if row["churn_probability"] >= 0.70 else ("Medium Risk" if row["churn_probability"] >= 0.40 else "Low Risk")
    
    return {
        "customer_id": str(row["customer_id"]),
        "churn_probability": round(float(row["churn_probability"]), 4),
        "risk_level": risk_level,
        "top_risk_drivers": explanation["top_risk_drivers"],
        "protective_factors": explanation["protective_factors"]
    }

@router.get("/segments", response_model=List[schemas.SegmentSummaryItem])
def get_segments(db: Session = Depends(get_db)):
    query = """
    SELECT 
        segment_name,
        customer_count,
        avg_recency,
        avg_frequency,
        total_monetary,
        avg_monetary,
        avg_churn_prob,
        total_revenue_at_risk,
        avg_predicted_value
    FROM segments
    ORDER BY total_revenue_at_risk DESC;
    """
    rows = db.execute(text(query)).mappings().fetchall()
    
    return [
        {
            "segment_name": r["segment_name"],
            "customer_count": int(r["customer_count"]),
            "avg_recency": round(float(r["avg_recency"]), 1),
            "avg_frequency": round(float(r["avg_frequency"]), 1),
            "total_monetary": round(float(r["total_monetary"]), 2),
            "avg_monetary": round(float(r["avg_monetary"]), 2),
            "avg_churn_prob": round(float(r["avg_churn_prob"]), 4),
            "total_revenue_at_risk": round(float(r["total_revenue_at_risk"]), 2),
            "avg_predicted_value": round(float(r["avg_predicted_value"]), 2)
        } for r in rows
    ]

@router.get("/revenue-risk", response_model=schemas.RevenueRiskBreakdown)
def get_revenue_risk_breakdown(db: Session = Depends(get_db)):
    # By Segment
    sql_seg = """
    SELECT segment_name, COUNT(*) as customer_count, SUM(revenue_at_risk) as revenue_at_risk, SUM(predicted_future_value) as predicted_future_value
    FROM customers GROUP BY segment_name ORDER BY revenue_at_risk DESC;
    """
    seg_rows = db.execute(text(sql_seg)).mappings().fetchall()
    by_segment = [{
        "segment_name": r["segment_name"],
        "customer_count": int(r["customer_count"]),
        "revenue_at_risk": round(float(r["revenue_at_risk"] or 0), 2),
        "predicted_future_value": round(float(r["predicted_future_value"] or 0), 2)
    } for r in seg_rows]
    
    # By Risk Level
    sql_risk = """
    SELECT risk_level, COUNT(*) as customer_count, SUM(revenue_at_risk) as revenue_at_risk, SUM(predicted_future_value) as predicted_future_value
    FROM customers GROUP BY risk_level ORDER BY revenue_at_risk DESC;
    """
    risk_rows = db.execute(text(sql_risk)).mappings().fetchall()
    by_risk = [{
        "risk_level": r["risk_level"],
        "customer_count": int(r["customer_count"]),
        "revenue_at_risk": round(float(r["revenue_at_risk"] or 0), 2),
        "predicted_future_value": round(float(r["predicted_future_value"] or 0), 2)
    } for r in risk_rows]
    
    # By Top 5 Countries
    sql_ctry = """
    SELECT country, COUNT(*) as customer_count, SUM(revenue_at_risk) as revenue_at_risk, SUM(predicted_future_value) as predicted_future_value
    FROM customers GROUP BY country ORDER BY revenue_at_risk DESC LIMIT 5;
    """
    ctry_rows = db.execute(text(sql_ctry)).mappings().fetchall()
    by_country = [{
        "country": r["country"],
        "customer_count": int(r["customer_count"]),
        "revenue_at_risk": round(float(r["revenue_at_risk"] or 0), 2),
        "predicted_future_value": round(float(r["predicted_future_value"] or 0), 2)
    } for r in ctry_rows]
    
    return {
        "by_segment": by_segment,
        "by_risk_level": by_risk,
        "by_country": by_country
    }

@router.get("/model-metrics")
def get_model_metrics(db: Session = Depends(get_db)):
    sql_meta = "SELECT * FROM model_metadata"
    rows = db.execute(text(sql_meta)).mappings().fetchall()
    
    churn_meta_path = "ml/reports/churn_metrics.json"
    rev_meta_path = "ml/reports/revenue_metrics.json"
    
    churn_json = json.load(open(churn_meta_path)) if os.path.exists(churn_meta_path) else {}
    rev_json = json.load(open(rev_meta_path)) if os.path.exists(rev_meta_path) else {}
    
    return {
        "summary": [dict(r) for r in rows],
        "churn_classification": churn_json,
        "customer_value_regression": rev_json
    }

@router.get("/chat/status")
def get_chat_status():
    return ai_assistant_service.check_availability()

@router.post("/chat", response_model=schemas.ChatResponse)
def post_chat(req: schemas.ChatRequest, db: Session = Depends(get_db)):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    db_summary = get_executive_summary(db)
    segments = get_segments(db)
    top_customers_resp = get_customers(search=None, risk_level=None, segment=None, page=1, limit=10, sort_by="revenue_at_risk", order="desc", db=db)
    top_risk_cust = top_customers_resp["customers"]
    revenue_risk = get_revenue_risk_breakdown(db)
    
    result = ai_assistant_service.ask_assistant(
        user_question=req.query,
        db_summary=db_summary,
        segments=segments,
        top_risk_cust=top_risk_cust,
        revenue_risk=revenue_risk
    )
    return result

@router.get("/monthly-trends")
def get_monthly_trends(db: Session = Depends(get_db)):
    sql = """
    SELECT 
        substr(invoice_date, 1, 7) as month,
        COUNT(DISTINCT invoice) as orders,
        ROUND(SUM(revenue), 2) as revenue,
        COUNT(DISTINCT customer_id) as active_customers
    FROM transactions 
    WHERE is_cancelled = 0
    GROUP BY substr(invoice_date, 1, 7)
    ORDER BY month
    """
    rows = db.execute(text(sql)).mappings().fetchall()
    return [
        {
            "month": r["month"],
            "orders": int(r["orders"]),
            "revenue": float(r["revenue"]),
            "active_customers": int(r["active_customers"])
        } for r in rows
    ]

# ==========================================
# RETENTION CAMPAIGNS & EXPIRY ENDPOINTS
# ==========================================

@router.get("/retention/summary", response_model=schemas.RetentionSummaryResponse)
def get_retention_summary(db: Session = Depends(get_db)):
    # 1. Customers needing attention
    sql_attn = "SELECT COUNT(*) FROM customers WHERE churn_probability >= 0.70"
    attn_cnt = db.execute(text(sql_attn)).scalar() or 0

    # 2. High Value customers at risk
    sql_hv_risk = "SELECT COUNT(*), COALESCE(SUM(revenue_at_risk), 0) FROM customers WHERE segment_name = 'High-Value At Risk'"
    hv_row = db.execute(text(sql_hv_risk)).fetchone()
    hv_cnt = hv_row[0] if hv_row else 0
    rev_at_risk = float(hv_row[1]) if hv_row else 0.0

    # 3. Total revenue at risk across all customers
    sql_total_risk = "SELECT COALESCE(SUM(revenue_at_risk), 0) FROM customers"
    total_rev_risk = float(db.execute(text(sql_total_risk)).scalar() or 0.0)

    # 4. Products expiring soon
    sql_exp_soon = "SELECT COUNT(*) FROM product_demo_metadata WHERE expiry_status = 'Expiring Soon'"
    exp_soon_cnt = db.execute(text(sql_exp_soon)).scalar() or 0

    # 5. High-value customers who bought expiring products
    sql_bought_expiring = """
    SELECT COUNT(DISTINCT t.customer_id)
    FROM transactions t
    JOIN product_demo_metadata p ON t.stock_code = p.stock_code
    JOIN customers c ON t.customer_id = c.customer_id
    WHERE p.expiry_status = 'Expiring Soon' AND c.churn_probability >= 0.40
    """
    bought_expiring_cnt = db.execute(text(sql_bought_expiring)).scalar() or 0

    return {
        "customers_needing_attention": int(attn_cnt),
        "high_value_customers_at_risk": int(hv_cnt),
        "potential_revenue_at_risk": round(total_rev_risk, 2),
        "products_expiring_soon": int(exp_soon_cnt),
        "high_value_customers_bought_expiring": int(bought_expiring_cnt)
    }

@router.get("/retention/recommended-campaigns", response_model=List[schemas.RecommendedCampaignItem])
def get_recommended_campaigns(db: Session = Depends(get_db)):
    # Campaign 1: High-Value At Risk
    sql_hv = "SELECT COUNT(*), COALESCE(SUM(revenue_at_risk), 0) FROM customers WHERE segment_name = 'High-Value At Risk'"
    hv_row = db.execute(text(sql_hv)).fetchone()
    hv_cnt = hv_row[0] if hv_row else 703
    hv_risk = float(hv_row[1]) if hv_row else 142079.85

    # Campaign 2: Expiring Products Target
    sql_exp = """
    SELECT COUNT(DISTINCT t.customer_id), COALESCE(SUM(c.revenue_at_risk), 0)
    FROM transactions t
    JOIN product_demo_metadata p ON t.stock_code = p.stock_code
    JOIN customers c ON t.customer_id = c.customer_id
    WHERE p.expiry_status = 'Expiring Soon' AND c.churn_probability >= 0.40
    """
    exp_row = db.execute(text(sql_exp)).fetchone()
    exp_cnt = exp_row[0] if exp_row else 38
    exp_risk = float(exp_row[1]) if exp_row else 45000.0

    # Campaign 3: High-Risk Account Recovery
    sql_hr = "SELECT COUNT(*), COALESCE(SUM(revenue_at_risk), 0) FROM customers WHERE churn_probability >= 0.70"
    hr_row = db.execute(text(sql_hr)).fetchone()
    hr_cnt = hr_row[0] if hr_row else 2163
    hr_risk = float(hr_row[1]) if hr_row else 380000.0

    return [
        {
            "id": "rec_1",
            "campaign_name": "💎 VIP High-Value VIP Retention",
            "target_group": "High-Value At Risk",
            "target_product_code": None,
            "target_product_name": None,
            "reason": "Top priority accounts showing slipping recency despite massive historical spending.",
            "customer_count": int(hv_cnt),
            "potential_revenue_at_risk": round(hv_risk, 2),
            "recommended_action": "Launch VIP 15% discount campaign with personal account follow-up.",
            "suggested_discount": 15.0,
            "suggested_message": "We miss you! Enjoy an exclusive 15% off your next order with code VIP15."
        },
        {
            "id": "rec_2",
            "campaign_name": "📦 Expiring Inventory Flash Clearance",
            "target_group": "Active Casuals & At Risk",
            "target_product_code": "85123A",
            "target_product_name": "WHITE HANGING HEART T-LIGHT HOLDER (Expiring in 12 days)",
            "reason": "Target accounts that previously purchased products nearing synthetic expiry dates.",
            "customer_count": int(exp_cnt),
            "potential_revenue_at_risk": round(exp_risk, 2),
            "recommended_action": "Offer 25% clearance promotion to previous buyers before product expiry.",
            "suggested_discount": 25.0,
            "suggested_message": "Special offer on your previous favorite! Enjoy 25% off white hanging heart lights code FRESH25."
        },
        {
            "id": "rec_3",
            "campaign_name": "🚨 High-Risk Winback Offer",
            "target_group": "High Risk (>70%)",
            "target_product_code": None,
            "target_product_name": None,
            "reason": "Accounts with high probability of inactivity requiring urgent re-engagement incentive.",
            "customer_count": int(hr_cnt),
            "potential_revenue_at_risk": round(hr_risk, 2),
            "recommended_action": "Automated WhatsApp outreach with 20% discount offer.",
            "suggested_discount": 20.0,
            "suggested_message": "We'd love to welcome you back! Enjoy 20% off your order today with code WELCOME20."
        }
    ]

@router.get("/expiry/summary", response_model=schemas.ExpirySummaryResponse)
def get_expiry_summary(db: Session = Depends(get_db)):
    sql = """
    SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN expiry_status = 'Expiring Soon' THEN 1 ELSE 0 END) as expiring_soon,
        SUM(CASE WHEN expiry_status = 'Expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN expiry_status = 'Healthy' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN expiry_days_remaining BETWEEN 0 AND 7 THEN 1 ELSE 0 END) as expiring_7_days,
        SUM(CASE WHEN expiry_days_remaining BETWEEN 0 AND 30 THEN 1 ELSE 0 END) as expiring_30_days
    FROM product_demo_metadata
    """
    row = db.execute(text(sql)).mappings().fetchone()
    
    # Associated revenue at risk for expiring products
    sql_rev = """
    SELECT COALESCE(SUM(c.revenue_at_risk), 0)
    FROM transactions t
    JOIN product_demo_metadata p ON t.stock_code = p.stock_code
    JOIN customers c ON t.customer_id = c.customer_id
    WHERE p.expiry_status = 'Expiring Soon'
    """
    assoc_rev = float(db.execute(text(sql_rev)).scalar() or 0.0)

    return {
        "total_products": int(row["total_products"] or 0),
        "expiring_soon": int(row["expiring_soon"] or 0),
        "expired": int(row["expired"] or 0),
        "healthy": int(row["healthy"] or 0),
        "expiring_7_days": int(row["expiring_7_days"] or 0),
        "expiring_30_days": int(row["expiring_30_days"] or 0),
        "associated_revenue_at_risk": round(assoc_rev, 2)
    }

@router.get("/expiry/products", response_model=List[schemas.ExpiryProductItem])
def get_expiry_products(status: Optional[str] = None, db: Session = Depends(get_db)):
    where_clause = ""
    params = {}
    if status and status.lower() != 'all':
        where_clause = "WHERE p.expiry_status = :status"
        params["status"] = status

    sql = f"""
    SELECT 
        p.stock_code,
        p.description,
        p.synthetic_expiry_date,
        p.expiry_days_remaining,
        p.expiry_status,
        COALESCE(SUM(t.quantity), 0) as historical_units_sold,
        COALESCE(SUM(t.revenue), 0) as historical_revenue,
        COUNT(DISTINCT t.customer_id) as customers_bought_count
    FROM product_demo_metadata p
    LEFT JOIN transactions t ON p.stock_code = t.stock_code AND t.is_cancelled = 0
    {where_clause}
    GROUP BY p.stock_code
    ORDER BY p.expiry_days_remaining ASC
    LIMIT 100
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    return [
        {
            "stock_code": r["stock_code"],
            "description": r["description"] or f"Stock Code #{r['stock_code']}",
            "synthetic_expiry_date": r["synthetic_expiry_date"],
            "expiry_days_remaining": int(r["expiry_days_remaining"]),
            "expiry_status": r["expiry_status"],
            "historical_units_sold": int(r["historical_units_sold"]),
            "historical_revenue": round(float(r["historical_revenue"]), 2),
            "customers_bought_count": int(r["customers_bought_count"])
        } for r in rows
    ]

@router.get("/expiry/customers", response_model=List[schemas.ExpiryCustomerItem])
def get_expiry_customers(stock_code: Optional[str] = None, db: Session = Depends(get_db)):
    where_extra = ""
    params = {}
    if stock_code:
        where_extra = "AND p.stock_code = :stock_code"
        params["stock_code"] = stock_code

    sql = f"""
    SELECT DISTINCT
        c.customer_id,
        c.country,
        c.segment_name,
        c.risk_level,
        c.churn_probability,
        c.predicted_future_value,
        c.revenue_at_risk,
        p.stock_code as purchased_product_code,
        p.description as purchased_product_desc,
        p.expiry_days_remaining,
        m.demo_email
    FROM transactions t
    JOIN product_demo_metadata p ON t.stock_code = p.stock_code
    JOIN customers c ON t.customer_id = c.customer_id
    JOIN customer_demo_metadata m ON c.customer_id = m.customer_id
    WHERE p.expiry_status = 'Expiring Soon' {where_extra}
    ORDER BY c.revenue_at_risk DESC
    LIMIT 50
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    return [
        {
            "customer_id": r["customer_id"],
            "country": r["country"],
            "segment_name": r["segment_name"],
            "risk_level": r["risk_level"],
            "churn_probability": float(r["churn_probability"]),
            "predicted_future_value": round(float(r["predicted_future_value"]), 2),
            "revenue_at_risk": round(float(r["revenue_at_risk"]), 2),
            "purchased_product_code": r["purchased_product_code"],
            "purchased_product_desc": r["purchased_product_desc"],
            "expiry_days_remaining": int(r["expiry_days_remaining"]),
            "demo_email": r["demo_email"]
        } for r in rows
    ]

@router.get("/retention/customers", response_model=schemas.PaginatedCustomersResponse)
def get_retention_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    segment: Optional[str] = None,
    risk_level: Optional[str] = None,
    stock_code: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    offset = (page - 1) * limit
    where_clauses = []
    params = {"limit": limit, "offset": offset}

    if segment and segment != 'all':
        where_clauses.append("c.segment_name = :segment")
        params["segment"] = segment

    if risk_level and risk_level != 'all':
        if risk_level == 'high':
            where_clauses.append("c.churn_probability >= 0.70")
        elif risk_level == 'medium':
            where_clauses.append("c.churn_probability >= 0.40 AND c.churn_probability < 0.70")
        elif risk_level == 'low':
            where_clauses.append("c.churn_probability < 0.40")

    if stock_code:
        where_clauses.append("c.customer_id IN (SELECT DISTINCT customer_id FROM transactions WHERE stock_code = :stock_code)")
        params["stock_code"] = stock_code

    if search and search.strip():
        where_clauses.append("c.customer_id LIKE :search")
        params["search"] = f"%{search.strip()}%"

    where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    count_sql = f"SELECT COUNT(*) FROM customers c {where_str}"
    total = db.execute(text(count_sql), params).scalar() or 0

    query_sql = f"""
    SELECT 
        c.customer_id, c.country, c.recency, c.frequency, c.monetary, c.gross_revenue,
        c.churn_probability, c.predicted_future_value, c.revenue_at_risk, c.risk_level, c.segment_name
    FROM customers c
    {where_str}
    ORDER BY c.revenue_at_risk DESC
    LIMIT :limit OFFSET :offset
    """
    rows = db.execute(text(query_sql), params).mappings().fetchall()
    
    customers = [
        {
            "customer_id": r["customer_id"],
            "country": r["country"],
            "recency": r["recency"],
            "frequency": r["frequency"],
            "monetary": float(r["monetary"]),
            "gross_revenue": float(r["gross_revenue"]),
            "churn_probability": float(r["churn_probability"]),
            "predicted_future_value": float(r["predicted_future_value"]),
            "revenue_at_risk": float(r["revenue_at_risk"]),
            "risk_level": r["risk_level"],
            "segment_name": r["segment_name"]
        } for r in rows
    ]

    total_pages = math.ceil(total / limit) if total > 0 else 1

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "customers": customers
    }

@router.post("/campaigns")
def create_campaign(req: schemas.CampaignCreateRequest, db: Session = Depends(get_db)):
    now_iso = datetime.now().isoformat()
    sql = """
    INSERT INTO campaigns (campaign_name, target_group, target_product_code, offer_type, discount_percent, message, created_at, status)
    VALUES (:name, :target, :prod, :offer, :disc, :msg, :created, 'Active')
    """
    result = db.execute(text(sql), {
        "name": req.campaign_name,
        "target": req.target_group,
        "prod": req.target_product_code,
        "offer": req.offer_type,
        "disc": req.discount_percent,
        "msg": req.message,
        "created": now_iso
    })
    db.commit()
    return {"status": "created", "campaign_id": result.lastrowid, "created_at": now_iso}

@router.post("/campaigns/preview-email", response_model=schemas.EmailPreviewResponse)
def preview_email(req: schemas.EmailPreviewRequest, db: Session = Depends(get_db)):
    selected_ids = req.selected_customer_ids or ["13085"]
    
    if selected_ids:
        # Calculate specific metrics for selected Customer IDs
        placeholders = ", ".join([f":cid_{i}" for i in range(len(selected_ids))])
        params = {f"cid_{i}": cid for i, cid in enumerate(selected_ids)}
        
        sql = f"SELECT COUNT(*), COALESCE(SUM(predicted_future_value), 0), COALESCE(SUM(revenue_at_risk), 0) FROM customers WHERE customer_id IN ({placeholders})"
        row = db.execute(text(sql), params).fetchone()
        cust_cnt = row[0] if row else len(selected_ids)
        total_val = float(row[1]) if row else 0.0
        rev_risk = float(row[2]) if row else 0.0
    else:
        cust_cnt = 1
        total_val = 1500.0
        rev_risk = 450.0

    demo_recipient = email_service.get_demo_recipient()
    primary_cid = selected_ids[0] if selected_ids else "13085"

    html_preview = f"""
    <div style="font-family: sans-serif; background-color: #1E293B; color: #F8FAFC; padding: 20px; border-radius: 12px;">
      <div style="border-bottom: 1px solid #334155; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="font-size: 11px; background: rgba(99, 102, 241, 0.2); color: #A5B4FC; padding: 2px 8px; border-radius: 4px; font-weight: 700;">🧪 DEMO MODE — Preview for Customer #{primary_cid}</span>
        <h3 style="margin: 12px 0 4px 0; color: #FFFFFF; font-size: 18px;">{req.subject}</h3>
        <div style="font-size: 12px; color: #94A3B8;">Sender: Customer Intelligence Platform &lt;noreply@customer-intelligence-demo.com&gt;</div>
        <div style="font-size: 12px; color: #94A3B8;">Real Delivery Target: <strong>{demo_recipient}</strong></div>
      </div>
      <div style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin-bottom: 20px;">
        {req.message}
      </div>
      <div style="background: rgba(99, 102, 241, 0.15); border: 1px solid #6366F1; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #A5B4FC; font-weight: 700; text-transform: uppercase;">Exclusive Retention Discount</div>
        <div style="font-size: 24px; font-weight: 800; color: #FFFFFF; margin: 4px 0;">{req.discount_percent}% OFF</div>
        <div style="font-size: 12px; color: #CBD5E1;">Use Promo Code: <strong>SAVE{int(req.discount_percent)}</strong></div>
      </div>
    </div>
    """

    return {
        "campaign_name": req.campaign_name,
        "target_group": req.target_group,
        "customer_count": int(cust_cnt),
        "selected_customer_ids": selected_ids,
        "total_customer_value": round(total_val, 2),
        "potential_revenue_at_risk": round(rev_risk, 2),
        "offer_summary": f"{req.discount_percent}% Discount",
        "subject": req.subject,
        "formatted_html_preview": html_preview,
        "demo_recipient": demo_recipient,
        "demo_mode": True
    }

@router.post("/campaigns/send-test-email", response_model=schemas.EmailTestResponse)
def send_test_email(req: schemas.EmailTestRequest):
    res = email_service.send_test_email(
        campaign_name=req.campaign_name,
        target_group=req.target_group,
        subject=req.subject,
        message_text=req.message,
        selected_customer_ids=req.selected_customer_ids,
        discount_percent=req.discount_percent or 15.0,
        campaign_id=req.campaign_id
    )
    return res

@router.get("/campaigns/history")
def get_campaign_history(db: Session = Depends(get_db)):
    sql_c = "SELECT * FROM campaigns ORDER BY id DESC LIMIT 50"
    campaigns = [dict(r) for r in db.execute(text(sql_c)).mappings().fetchall()]

    sql_a = "SELECT * FROM campaign_audit_log ORDER BY id DESC LIMIT 50"
    audit_logs = [dict(r) for r in db.execute(text(sql_a)).mappings().fetchall()]

    return {
        "campaigns": campaigns,
        "audit_logs": audit_logs
    }

@router.get("/campaigns/email/status", response_model=schemas.EmailStatusResponse)
def get_email_status():
    return email_service.get_status()



