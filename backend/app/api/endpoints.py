"""
FastAPI REST API Endpoints Implementation
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from fastapi.responses import FileResponse
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
from backend.app.services.csv_processor import csv_processor
from backend.app.services.retail_intelligence_service import retail_intelligence_service

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
def get_executive_summary(
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        summary_path = os.path.join(session_dir, "results_summary.json")
        if os.path.exists(summary_path):
            with open(summary_path) as f:
                res_data = json.load(f)
            tot_exp_30d = float(res_data.get("total_expected_30d_revenue", 0))
            tot_lose_30d = float(res_data.get("total_company_may_lose_30d", 0))
            tot_rev_risk = tot_lose_30d * 3.0
            tot_pred_val = tot_exp_30d * 3.0
            loss_pct_30d = float(res_data.get("loss_percentage_30d", 0.0))
            tot_cust = int(res_data.get("unique_customers", 0))
            avg_cust_val = round(tot_pred_val / tot_cust, 2) if tot_cust > 0 else 0.0
            high_risk = int(res_data.get("high_risk_customers", 0))
            med_risk = int(res_data.get("medium_risk_customers", 0))
            low_risk = int(res_data.get("low_risk_customers", 0))
            overall_churn = round(high_risk / tot_cust, 4) if tot_cust > 0 else 0.0
            segments_cnt = len(res_data.get("segments_summary", [])) or 4
            return {
                "total_customers": tot_cust,
                "high_risk_customers": high_risk,
                "medium_risk_customers": med_risk,
                "low_risk_customers": low_risk,
                "overall_churn_rate": overall_churn,
                "total_revenue_at_risk": round(tot_rev_risk, 2),
                "total_predicted_future_value": round(tot_pred_val, 2),
                "total_expected_30d_revenue": round(tot_exp_30d, 2),
                "total_company_may_lose_30d": round(tot_lose_30d, 2),
                "loss_percentage_30d": loss_pct_30d,
                "average_customer_value": avg_cust_val,
                "total_segments": segments_cnt
            }

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
        
    tot_rev_risk = float(result["total_revenue_at_risk"] or 0)
    tot_pred_val = float(result["total_predicted_future_value"] or 0)
    tot_exp_30d = round(tot_pred_val / 3.0, 2)
    tot_lose_30d = round(tot_rev_risk / 3.0, 2)
    loss_pct_30d = round((tot_lose_30d / tot_exp_30d * 100), 1) if tot_exp_30d > 0 else 0.0

    return {
        "total_customers": int(result["total_customers"]),
        "high_risk_customers": int(result["high_risk_customers"]),
        "medium_risk_customers": int(result["medium_risk_customers"]),
        "low_risk_customers": int(result["low_risk_customers"]),
        "overall_churn_rate": round(float(result["overall_churn_rate"] or 0), 4),
        "total_revenue_at_risk": round(tot_rev_risk, 2),
        "total_predicted_future_value": round(tot_pred_val, 2),
        "total_expected_30d_revenue": tot_exp_30d,
        "total_company_may_lose_30d": tot_lose_30d,
        "loss_percentage_30d": loss_pct_30d,
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
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        pred_path = os.path.join(session_dir, "customer_predictions.csv")
        if os.path.exists(pred_path):
            df_pred = pd.read_csv(pred_path)
            if 'risk_level' not in df_pred.columns:
                df_pred['risk_level'] = np.where(
                    df_pred['churn_probability'] >= 0.70, 'High Risk',
                    np.where(df_pred['churn_probability'] >= 0.40, 'Needs Attention', 'Low Risk')
                )
            if search and search.strip():
                df_pred = df_pred[df_pred['customer_id'].astype(str).str.contains(search.strip(), case=False, na=False)]
            if risk_level:
                df_pred = df_pred[df_pred['risk_level'] == risk_level]
            if segment:
                df_pred = df_pred[df_pred['segment_name'] == segment]
            
            total_count = len(df_pred)
            total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
            
            valid_sort = sort_by if sort_by in df_pred.columns else 'revenue_at_risk'
            ascending = (order.lower() == 'asc')
            df_sorted = df_pred.sort_values(by=valid_sort, ascending=ascending)
            
            offset = (page - 1) * limit
            page_df = df_sorted.iloc[offset:offset + limit]
            
            customers = []
            for _, r in page_df.iterrows():
                cid_str = str(r['customer_id'])
                cp = float(r.get('churn_probability', 0))
                pv = float(r.get('predicted_future_value', 0))
                rar = float(r.get('revenue_at_risk', 0))
                e30 = float(r.get('expected_30d_revenue', round(pv / 3.0, 2)))
                l30 = float(r.get('company_may_lose_30d', round(rar / 3.0, 2)))
                lp30 = float(r.get('loss_percentage_30d', round(cp * 100, 1)))
                cust_email = str(r.get('email', '')) if 'email' in r and pd.notnull(r.get('email')) else f"customer_{cid_str}@example.com"
                
                customers.append({
                    "customer_id": cid_str,
                    "country": str(r.get('country', 'United Kingdom')),
                    "recency": int(r.get('recency', 0)),
                    "frequency": int(r.get('frequency', 0)),
                    "monetary": round(float(r.get('monetary', 0)), 2),
                    "gross_revenue": round(float(r.get('gross_revenue', r.get('monetary', 0))), 2),
                    "churn_probability": round(cp, 4),
                    "predicted_future_value": round(pv, 2),
                    "revenue_at_risk": round(rar, 2),
                    "expected_30d_revenue": round(e30, 2),
                    "company_may_lose_30d": round(l30, 2),
                    "loss_percentage_30d": round(lp30, 1),
                    "risk_level": str(r.get('risk_level', 'Low Risk')),
                    "segment_name": str(r.get('segment_name', 'Active Casuals')),
                    "email": cust_email
                })
                
            return {
                "total": total_count,
                "page": page,
                "limit": limit,
                "total_pages": total_pages,
                "customers": customers
            }

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
        where_clauses.append("c.customer_id LIKE :search")
        params["search"] = f"%{search}%"
        
    if risk_level and not isinstance(risk_level, Query):
        where_clauses.append("c.risk_level = :risk_level")
        params["risk_level"] = risk_level
        
    if segment and not isinstance(segment, Query):
        where_clauses.append("c.segment_name = :segment")
        params["segment"] = segment
        
    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    
    # Count total
    count_sql = f"SELECT COUNT(*) FROM customers c {where_str}"
    total_count = db.execute(text(count_sql), params).scalar()
    
    offset = (page - 1) * limit
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    
    # Query items
    query_sql = f"""
    SELECT 
        c.customer_id, c.country, c.recency, c.frequency, c.monetary, c.gross_revenue,
        c.churn_probability, c.predicted_future_value, c.revenue_at_risk, c.risk_level, c.segment_name,
        m.demo_email as email
    FROM customers c
    LEFT JOIN customer_demo_metadata m ON c.customer_id = m.customer_id
    {where_str}
    ORDER BY c.{sort_by} {sort_dir}
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
            "expected_30d_revenue": round(float(r["predicted_future_value"]) / 3.0, 2),
            "company_may_lose_30d": round(float(r["revenue_at_risk"]) / 3.0, 2),
            "loss_percentage_30d": round(float(r["churn_probability"]) * 100, 1),
            "risk_level": r["risk_level"],
            "segment_name": r["segment_name"],
            "email": r["email"] if r["email"] else f"customer_{r['customer_id']}@example.com"
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
    sql_cust = """
    SELECT c.*, f.average_order_value, f.average_quantity, f.unique_products,
           f.customer_lifetime_days, f.cancellation_count, f.cancellation_rate,
           f.cancelled_revenue, f.recent_spend_90d, f.historical_spend_prior, f.spend_trend
    FROM customers c
    LEFT JOIN customer_features f ON c.customer_id = f.customer_id
    WHERE c.customer_id = :cid
    """
    cust_row = db.execute(text(sql_cust), {"cid": customer_id}).mappings().fetchone()
    
    if not cust_row:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")
        
    # Get recent transactions
    sql_tx = """
    SELECT invoice, stock_code, description, quantity, invoice_date, price, revenue, is_cancelled
    FROM transactions
    WHERE customer_id = :cid
    ORDER BY invoice_date DESC
    LIMIT 10
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
    pred_val = float(cust_row["predicted_future_value"])
    rev_risk = float(cust_row["revenue_at_risk"])
    exp_30d = round(pred_val / 3.0, 2)
    lose_30d = round(rev_risk / 3.0, 2)
    loss_pct = round(float(cust_row["churn_probability"]) * 100, 1)

    return {
        "customer_id": str(cust_row["customer_id"]),
        "country": str(cust_row["country"]),
        "recency": int(cust_row["recency"]),
        "frequency": int(cust_row["frequency"]),
        "monetary": round(float(cust_row["monetary"] or 0), 2),
        "gross_revenue": round(float(cust_row["gross_revenue"] or 0), 2),
        "average_order_value": round(float(cust_row.get("average_order_value") or 0), 2),
        "average_quantity": round(float(cust_row.get("average_quantity") or 0), 2),
        "unique_products": int(cust_row.get("unique_products") or 0),
        "customer_lifetime_days": int(cust_row.get("customer_lifetime_days") or 0),
        "cancellation_count": int(cust_row.get("cancellation_count") or 0),
        "cancellation_rate": round(float(cust_row.get("cancellation_rate") or 0), 4),
        "cancelled_revenue": round(float(cust_row.get("cancelled_revenue") or 0), 2),
        "recent_spend_90d": round(float(cust_row.get("recent_spend_90d") or 0), 2),
        "historical_spend_prior": round(float(cust_row.get("historical_spend_prior") or 0), 2),
        "spend_trend": round(float(cust_row.get("spend_trend") or 0), 4),
        "churn_label": int(cust_row["churn_label"]),
        "churn_probability": round(float(cust_row["churn_probability"]), 4),
        "predicted_future_value": round(pred_val, 2),
        "revenue_at_risk": round(rev_risk, 2),
        "expected_30d_revenue": exp_30d,
        "company_may_lose_30d": lose_30d,
        "loss_percentage_30d": loss_pct,
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
def get_segments(
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        seg_path = os.path.join(session_dir, "customer_segmentation.csv")
        if os.path.exists(seg_path):
            df_seg = pd.read_csv(seg_path)
            segments = []
            for _, r in df_seg.iterrows():
                count = int(r.get("customer_count", 0))
                tot_mon = round(float(r.get("total_monetary", 0)), 2)
                avg_mon = round(float(r.get("avg_monetary", 0)), 2)
                avg_rec = round(float(r.get("avg_recency", 0)), 1)
                exp_30d = round(float(r.get("expected_30d_revenue", 0)), 2)
                lose_30d = round(float(r.get("company_may_lose_30d", 0)), 2)
                loss_pct = round(float(r.get("loss_percentage_30d", 0)), 1)
                avg_val = round(exp_30d * 3.0 / count, 2) if count > 0 else 0.0
                tot_rev_risk = lose_30d * 3.0
                
                segments.append({
                    "segment_name": str(r["segment_name"]),
                    "customer_count": count,
                    "avg_recency": avg_rec,
                    "avg_frequency": 3.5,
                    "total_monetary": tot_mon,
                    "avg_monetary": avg_mon,
                    "avg_churn_prob": round(lose_30d / (exp_30d + 0.01), 4),
                    "total_revenue_at_risk": round(tot_rev_risk, 2),
                    "avg_predicted_value": avg_val,
                    "expected_30d_revenue": exp_30d,
                    "company_may_lose_30d": lose_30d,
                    "loss_percentage_30d": loss_pct
                })
            return segments

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
    
    segments = []
    for r in rows:
        count = int(r["customer_count"])
        avg_val = float(r["avg_predicted_value"])
        tot_rev_risk = float(r["total_revenue_at_risk"])
        tot_pred = avg_val * count
        exp_30d = round(tot_pred / 3.0, 2)
        lose_30d = round(tot_rev_risk / 3.0, 2)
        loss_pct = round((lose_30d / exp_30d * 100), 1) if exp_30d > 0 else 0.0

        segments.append({
            "segment_name": r["segment_name"],
            "customer_count": count,
            "avg_recency": round(float(r["avg_recency"]), 1),
            "avg_frequency": round(float(r["avg_frequency"]), 1),
            "total_monetary": round(float(r["total_monetary"]), 2),
            "avg_monetary": round(float(r["avg_monetary"]), 2),
            "avg_churn_prob": round(float(r["avg_churn_prob"]), 4),
            "total_revenue_at_risk": round(tot_rev_risk, 2),
            "avg_predicted_value": round(avg_val, 2),
            "expected_30d_revenue": exp_30d,
            "company_may_lose_30d": lose_30d,
            "loss_percentage_30d": loss_pct
        })
    return segments

@router.get("/revenue-risk", response_model=schemas.RevenueRiskBreakdown)
def get_revenue_risk_breakdown(
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        pred_path = os.path.join(session_dir, "customer_predictions.csv")
        if os.path.exists(pred_path):
            df_pred = pd.read_csv(pred_path)
            if 'risk_level' not in df_pred.columns:
                df_pred['risk_level'] = np.where(
                    df_pred['churn_probability'] >= 0.70, 'High Risk',
                    np.where(df_pred['churn_probability'] >= 0.40, 'Needs Attention', 'Low Risk')
                )
            
            by_segment = []
            for seg, g in df_pred.groupby('segment_name'):
                cnt = len(g)
                rar = float(g['revenue_at_risk'].sum())
                pv = float(g['predicted_future_value'].sum())
                e30 = round(pv / 3.0, 2)
                l30 = round(rar / 3.0, 2)
                lp = round((l30 / e30 * 100), 1) if e30 > 0 else 0.0
                by_segment.append({
                    "segment_name": seg,
                    "customer_count": cnt,
                    "revenue_at_risk": round(rar, 2),
                    "predicted_future_value": round(pv, 2),
                    "expected_30d_revenue": e30,
                    "company_may_lose_30d": l30,
                    "loss_percentage_30d": lp
                })
            by_segment.sort(key=lambda x: x["company_may_lose_30d"], reverse=True)

            by_risk = []
            for rk, g in df_pred.groupby('risk_level'):
                cnt = len(g)
                rar = float(g['revenue_at_risk'].sum())
                pv = float(g['predicted_future_value'].sum())
                e30 = round(pv / 3.0, 2)
                l30 = round(rar / 3.0, 2)
                lp = round((l30 / e30 * 100), 1) if e30 > 0 else 0.0
                by_risk.append({
                    "risk_level": rk,
                    "customer_count": cnt,
                    "revenue_at_risk": round(rar, 2),
                    "predicted_future_value": round(pv, 2),
                    "expected_30d_revenue": e30,
                    "company_may_lose_30d": l30,
                    "loss_percentage_30d": lp
                })
            by_risk.sort(key=lambda x: x["company_may_lose_30d"], reverse=True)

            by_country = []
            for ctry, g in df_pred.groupby('country'):
                cnt = len(g)
                rar = float(g['revenue_at_risk'].sum())
                pv = float(g['predicted_future_value'].sum())
                e30 = round(pv / 3.0, 2)
                l30 = round(rar / 3.0, 2)
                lp = round((l30 / e30 * 100), 1) if e30 > 0 else 0.0
                by_country.append({
                    "country": ctry,
                    "customer_count": cnt,
                    "revenue_at_risk": round(rar, 2),
                    "predicted_future_value": round(pv, 2),
                    "expected_30d_revenue": e30,
                    "company_may_lose_30d": l30,
                    "loss_percentage_30d": lp
                })
            by_country.sort(key=lambda x: x["company_may_lose_30d"], reverse=True)

            return {
                "by_segment": by_segment,
                "by_risk_level": by_risk,
                "by_country": by_country[:5]
            }

    # By Segment
    sql_seg = """
    SELECT segment_name, COUNT(*) as customer_count, SUM(revenue_at_risk) as revenue_at_risk, SUM(predicted_future_value) as predicted_future_value
    FROM customers GROUP BY segment_name ORDER BY revenue_at_risk DESC;
    """
    seg_rows = db.execute(text(sql_seg)).mappings().fetchall()
    by_segment = []
    for r in seg_rows:
        rev_risk = float(r["revenue_at_risk"] or 0)
        pred_val = float(r["predicted_future_value"] or 0)
        exp_30d = round(pred_val / 3.0, 2)
        lose_30d = round(rev_risk / 3.0, 2)
        loss_pct = round((lose_30d / exp_30d * 100), 1) if exp_30d > 0 else 0.0
        by_segment.append({
            "segment_name": r["segment_name"],
            "customer_count": int(r["customer_count"]),
            "revenue_at_risk": round(rev_risk, 2),
            "predicted_future_value": round(pred_val, 2),
            "expected_30d_revenue": exp_30d,
            "company_may_lose_30d": lose_30d,
            "loss_percentage_30d": loss_pct
        })
    
    # By Risk Level
    sql_risk = """
    SELECT risk_level, COUNT(*) as customer_count, SUM(revenue_at_risk) as revenue_at_risk, SUM(predicted_future_value) as predicted_future_value
    FROM customers GROUP BY risk_level ORDER BY revenue_at_risk DESC;
    """
    risk_rows = db.execute(text(sql_risk)).mappings().fetchall()
    by_risk = []
    for r in risk_rows:
        rev_risk = float(r["revenue_at_risk"] or 0)
        pred_val = float(r["predicted_future_value"] or 0)
        exp_30d = round(pred_val / 3.0, 2)
        lose_30d = round(rev_risk / 3.0, 2)
        loss_pct = round((lose_30d / exp_30d * 100), 1) if exp_30d > 0 else 0.0
        by_risk.append({
            "risk_level": r["risk_level"],
            "customer_count": int(r["customer_count"]),
            "revenue_at_risk": round(rev_risk, 2),
            "predicted_future_value": round(pred_val, 2),
            "expected_30d_revenue": exp_30d,
            "company_may_lose_30d": lose_30d,
            "loss_percentage_30d": loss_pct
        })
    
    # By Top 5 Countries
    sql_ctry = """
    SELECT country, COUNT(*) as customer_count, SUM(revenue_at_risk) as revenue_at_risk, SUM(predicted_future_value) as predicted_future_value
    FROM customers GROUP BY country ORDER BY revenue_at_risk DESC LIMIT 5;
    """
    ctry_rows = db.execute(text(sql_ctry)).mappings().fetchall()
    by_country = []
    for r in ctry_rows:
        rev_risk = float(r["revenue_at_risk"] or 0)
        pred_val = float(r["predicted_future_value"] or 0)
        exp_30d = round(pred_val / 3.0, 2)
        lose_30d = round(rev_risk / 3.0, 2)
        loss_pct = round((lose_30d / exp_30d * 100), 1) if exp_30d > 0 else 0.0
        by_country.append({
            "country": r["country"],
            "customer_count": int(r["customer_count"]),
            "revenue_at_risk": round(rev_risk, 2),
            "predicted_future_value": round(pred_val, 2),
            "expected_30d_revenue": exp_30d,
            "company_may_lose_30d": lose_30d,
            "loss_percentage_30d": loss_pct
        })
    
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
def post_chat(
    req: schemas.ChatRequest,
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    db_summary = get_executive_summary(dashboard_id=dashboard_id, db=db)
    segments = get_segments(dashboard_id=dashboard_id, db=db)
    top_customers_resp = get_customers(search=None, risk_level=None, segment=None, page=1, limit=10, sort_by="revenue_at_risk", order="desc", dashboard_id=dashboard_id, db=db)
    top_risk_cust = top_customers_resp.get("customers", []) if isinstance(top_customers_resp, dict) else getattr(top_customers_resp, "customers", [])
    revenue_risk = get_revenue_risk_breakdown(dashboard_id=dashboard_id, db=db)
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    
    demand_summary = None
    inventory_summary = None
    pricing_summary = None
    monitoring_summary = None
    try:
        demand_summary = retail_intelligence_service.get_demand_summary(db=db, session_dir=session_dir)
        inventory_summary = retail_intelligence_service.get_inventory_summary(db=db, session_dir=session_dir)
        pricing_summary = retail_intelligence_service.get_pricing_summary(db=db, session_dir=session_dir)
        monitoring_summary = retail_intelligence_service.get_monitoring_summary(db=db, session_dir=session_dir)
    except Exception:
        pass

    result = ai_assistant_service.ask_assistant(
        user_question=req.query,
        db_summary=db_summary,
        segments=segments,
        top_risk_cust=top_risk_cust,
        revenue_risk=revenue_risk,
        demand_summary=demand_summary,
        inventory_summary=inventory_summary,
        pricing_summary=pricing_summary,
        monitoring_summary=monitoring_summary,
        db=db if dashboard_id == "default" else None,
        session_dir=session_dir
    )
    return result

@router.get("/monthly-trends")
def get_monthly_trends(
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        tx_path = os.path.join(session_dir, "cleaned_transactions.csv")
        if os.path.exists(tx_path):
            df_tx = pd.read_csv(tx_path)
            if 'is_cancelled' in df_tx.columns:
                df_tx = df_tx[~df_tx['is_cancelled']]
            df_tx['invoice_date'] = pd.to_datetime(df_tx['invoice_date'], errors='coerce')
            df_tx = df_tx.dropna(subset=['invoice_date'])
            df_tx['month'] = df_tx['invoice_date'].dt.strftime('%Y-%m')
            
            grp = df_tx.groupby('month').agg(
                orders=('invoice', 'nunique'),
                revenue=('revenue', 'sum'),
                active_customers=('customer_id', 'nunique')
            ).reset_index().sort_values('month')
            
            return [
                {
                    "month": str(r["month"]),
                    "orders": int(r["orders"]),
                    "revenue": round(float(r["revenue"]), 2),
                    "active_customers": int(r["active_customers"])
                } for _, r in grp.iterrows()
            ]

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
def get_retention_summary(
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        summary_path = os.path.join(session_dir, "results_summary.json")
        if os.path.exists(summary_path):
            with open(summary_path) as f:
                res_data = json.load(f)
            
            high_risk = int(res_data.get("high_risk_customers", 0))
            med_risk = int(res_data.get("medium_risk_customers", 0))
            tot_exp_30d = float(res_data.get("total_expected_30d_revenue", 0))
            tot_lose_30d = float(res_data.get("total_company_may_lose_30d", 0))
            loss_pct = float(res_data.get("loss_percentage_30d", 0.0))
            
            return {
                "customers_needing_attention": high_risk,
                "high_value_customers_at_risk": med_risk,
                "potential_revenue_at_risk": tot_lose_30d,
                "total_expected_30d_revenue": tot_exp_30d,
                "company_may_lose_30d": tot_lose_30d,
                "loss_percentage_30d": loss_pct,
                "products_expiring_soon": 0,
                "high_value_customers_bought_expiring": 0
            }

    # 1. Customers needing attention
    sql_attn = "SELECT COUNT(*) FROM customers WHERE churn_probability >= 0.70"
    attn_cnt = db.execute(text(sql_attn)).scalar() or 0

    # 2. High Value customers at risk
    sql_hv_risk = "SELECT COUNT(*), COALESCE(SUM(revenue_at_risk), 0) FROM customers WHERE segment_name = 'High-Value At Risk'"
    hv_row = db.execute(text(sql_hv_risk)).fetchone()
    hv_cnt = hv_row[0] if hv_row else 0

    # 3. Total revenue at risk across all customers
    sql_total_risk = "SELECT COALESCE(SUM(revenue_at_risk), 0), COALESCE(SUM(predicted_future_value), 0) FROM customers"
    tot_row = db.execute(text(sql_total_risk)).fetchone()
    total_rev_risk = float(tot_row[0]) if tot_row else 0.0
    total_pred_val = float(tot_row[1]) if tot_row else 0.0

    total_exp_30d = round(total_pred_val / 3.0, 2)
    company_may_lose = round(total_rev_risk / 3.0, 2)
    loss_pct = round((company_may_lose / total_exp_30d * 100), 1) if total_exp_30d > 0 else 0.0

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
        "potential_revenue_at_risk": company_may_lose,
        "total_expected_30d_revenue": total_exp_30d,
        "company_may_lose_30d": company_may_lose,
        "loss_percentage_30d": loss_pct,
        "products_expiring_soon": int(exp_soon_cnt),
        "high_value_customers_bought_expiring": int(bought_expiring_cnt)
    }

@router.get("/retention/recommended-campaigns", response_model=List[schemas.RecommendedCampaignItem])
def get_recommended_campaigns(
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        pred_path = os.path.join(session_dir, "customer_predictions.csv")
        if os.path.exists(pred_path):
            df_pred = pd.read_csv(pred_path)
            high_risk = df_pred[df_pred['churn_probability'] >= 0.70]
            hr_cnt = len(high_risk)
            hr_rar = float(high_risk['revenue_at_risk'].sum()) if hr_cnt > 0 else 0.0
            hr_pv = float(high_risk['predicted_future_value'].sum()) if hr_cnt > 0 else 0.0
            hr_e30 = round(hr_pv / 3.0, 2)
            hr_l30 = round(hr_rar / 3.0, 2)
            hr_pct = round((hr_l30 / hr_e30 * 100), 1) if hr_e30 > 0 else 0.0
            
            med_risk = df_pred[(df_pred['churn_probability'] >= 0.40) & (df_pred['churn_probability'] < 0.70)]
            mr_cnt = len(med_risk)
            mr_rar = float(med_risk['revenue_at_risk'].sum()) if mr_cnt > 0 else 0.0
            mr_pv = float(med_risk['predicted_future_value'].sum()) if mr_cnt > 0 else 0.0
            mr_e30 = round(mr_pv / 3.0, 2)
            mr_l30 = round(mr_rar / 3.0, 2)
            mr_pct = round((mr_l30 / mr_e30 * 100), 1) if mr_e30 > 0 else 0.0
            
            return [
                {
                    "id": "rec_1",
                    "campaign_name": "🚨 High-Risk Attrition Winback",
                    "target_group": "High Risk (>70%)",
                    "target_product_code": None,
                    "target_product_name": None,
                    "reason": f"Identified {hr_cnt} high-risk accounts requiring immediate retention action based on uploaded metrics.",
                    "customer_count": hr_cnt,
                    "potential_revenue_at_risk": hr_l30,
                    "expected_30d_revenue": hr_e30,
                    "company_may_lose_30d": hr_l30,
                    "loss_percentage_30d": hr_pct,
                    "recommended_action": "Target with custom winback promo code and dedicated outreach.",
                    "suggested_discount": 20.0,
                    "suggested_message": "Exclusive 20% discount offer to reactivate your account."
                },
                {
                    "id": "rec_2",
                    "campaign_name": "⚡ Needs Attention Re-Engagement",
                    "target_group": "Medium Risk (40%-70%)",
                    "target_product_code": None,
                    "target_product_name": None,
                    "reason": f"Targeting {mr_cnt} medium-risk customers showing declining activity in uploaded dataset.",
                    "customer_count": mr_cnt,
                    "potential_revenue_at_risk": mr_l30,
                    "expected_30d_revenue": mr_e30,
                    "company_may_lose_30d": mr_l30,
                    "loss_percentage_30d": mr_pct,
                    "recommended_action": "Send personalized email recommendations and 15% incentive.",
                    "suggested_discount": 15.0,
                    "suggested_message": "Enjoy 15% off your next purchase with code RETENTION15."
                }
            ]

    # Campaign 1: High-Value At Risk
    sql_hv = "SELECT COUNT(*), COALESCE(SUM(revenue_at_risk), 0), COALESCE(SUM(predicted_future_value), 0) FROM customers WHERE segment_name = 'High-Value At Risk'"
    hv_row = db.execute(text(sql_hv)).fetchone()
    hv_cnt = hv_row[0] if hv_row else 703
    hv_risk = float(hv_row[1]) if hv_row else 142079.85
    hv_pred = float(hv_row[2]) if hv_row else 420000.0

    hv_exp_30d = round(hv_pred / 3.0, 2)
    hv_lose_30d = round(hv_risk / 3.0, 2)
    hv_pct = round((hv_lose_30d / hv_exp_30d * 100), 1) if hv_exp_30d > 0 else 0.0

    # Campaign 2: Expiring Products Target
    sql_exp = """
    SELECT COUNT(DISTINCT t.customer_id), COALESCE(SUM(c.revenue_at_risk), 0), COALESCE(SUM(c.predicted_future_value), 0)
    FROM transactions t
    JOIN product_demo_metadata p ON t.stock_code = p.stock_code
    JOIN customers c ON t.customer_id = c.customer_id
    WHERE p.expiry_status = 'Expiring Soon' AND c.churn_probability >= 0.40
    """
    exp_row = db.execute(text(sql_exp)).fetchone()
    exp_cnt = exp_row[0] if exp_row else 38
    exp_risk = float(exp_row[1]) if exp_row else 45000.0
    exp_pred = float(exp_row[2]) if exp_row else 120000.0

    exp_exp_30d = round(exp_pred / 3.0, 2)
    exp_lose_30d = round(exp_risk / 3.0, 2)
    exp_pct = round((exp_lose_30d / exp_exp_30d * 100), 1) if exp_exp_30d > 0 else 0.0

    # Campaign 3: High-Risk Account Recovery
    sql_hr = "SELECT COUNT(*), COALESCE(SUM(revenue_at_risk), 0), COALESCE(SUM(predicted_future_value), 0) FROM customers WHERE churn_probability >= 0.70"
    hr_row = db.execute(text(sql_hr)).fetchone()
    hr_cnt = hr_row[0] if hr_row else 2163
    hr_risk = float(hr_row[1]) if hr_row else 380000.0
    hr_pred = float(hr_row[2]) if hr_row else 900000.0

    hr_exp_30d = round(hr_pred / 3.0, 2)
    hr_lose_30d = round(hr_risk / 3.0, 2)
    hr_pct = round((hr_lose_30d / hr_exp_30d * 100), 1) if hr_exp_30d > 0 else 0.0

    return [
        {
            "id": "rec_1",
            "campaign_name": "💎 VIP High-Value VIP Retention",
            "target_group": "High-Value At Risk",
            "target_product_code": None,
            "target_product_name": None,
            "reason": "Top priority accounts showing slipping recency despite massive historical spending.",
            "customer_count": int(hv_cnt),
            "potential_revenue_at_risk": hv_lose_30d,
            "expected_30d_revenue": hv_exp_30d,
            "company_may_lose_30d": hv_lose_30d,
            "loss_percentage_30d": hv_pct,
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
            "potential_revenue_at_risk": exp_lose_30d,
            "expected_30d_revenue": exp_exp_30d,
            "company_may_lose_30d": exp_lose_30d,
            "loss_percentage_30d": exp_pct,
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
            "potential_revenue_at_risk": hr_lose_30d,
            "expected_30d_revenue": hr_exp_30d,
            "company_may_lose_30d": hr_lose_30d,
            "loss_percentage_30d": hr_pct,
            "recommended_action": "Automated WhatsApp outreach with 20% discount offer.",
            "suggested_discount": 20.0,
            "suggested_message": "We'd love to welcome you back! Enjoy 20% off your order today with code WELCOME20."
        }
    ]


def format_days_remaining_label(days: int) -> str:
    if days < -1:
        return f"Expired {abs(days)} days ago"
    elif days == -1:
        return "Expired yesterday"
    elif days == 0:
        return "Expires today"
    elif days == 1:
        return "Expires tomorrow"
    else:
        return f"Expires in {days} days"

@router.get("/expiry/dashboard", response_model=schemas.ExpiryDashboardResponse)
def get_expiry_dashboard(
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id)
        # Check if uploaded session has expiry information
        cleaned_csv = os.path.join(session_dir, "cleaned_transactions.csv")
        if os.path.exists(cleaned_csv):
            import pandas as pd
            df_up = pd.read_csv(cleaned_csv)
            exp_col = None
            for c in ['expiry_within_days', 'expiry_days_remaining', 'ExpiryWithinDays', 'expiry_days']:
                if c in df_up.columns:
                    exp_col = c
                    break
            if exp_col and df_up[exp_col].notnull().any():
                prods = []
                for code, g in df_up.groupby('stock_code'):
                    exp_val = g[exp_col].dropna()
                    if not exp_val.empty:
                        try:
                            d_rem = int(float(exp_val.iloc[0]))
                            u_avail = max(10, int(g['quantity'].abs().sum())) if 'quantity' in g.columns else 25
                            u_price = float(g['price'].mean()) if 'price' in g.columns else 9.99
                            s_val = u_avail * u_price
                            c_disc = 30.0 if d_rem <= 7 else (20.0 if d_rem <= 30 else 0.0)
                            c_price = round(u_price * (1.0 - c_disc / 100.0), 2)
                            prods.append({
                                "expiry_days_remaining": d_rem,
                                "units_available": u_avail,
                                "stock_value": s_val,
                                "clearance_price": c_price
                            })
                        except Exception:
                            pass
                if prods:
                    tot_tr = len(prods)
                    exp_m = sum(1 for p in prods if 0 <= p["expiry_days_remaining"] <= 30)
                    al_exp = sum(1 for p in prods if p["expiry_days_remaining"] < 0)
                    stk_risk = sum(p["stock_value"] for p in prods if p["expiry_days_remaining"] <= 30)
                    clr_val = sum(p["clearance_price"] * p["units_available"] for p in prods if p["expiry_days_remaining"] <= 30)
                    return {
                        "kpis": {
                            "products_tracked": tot_tr,
                            "expiring_this_month": exp_m,
                            "already_expired": al_exp,
                            "stock_value_at_risk": round(stk_risk, 2),
                            "potential_clearance_value": round(clr_val, 2)
                        },
                        "timeline": [
                            {"date": "0–7 Days", "month_label": "0–7 Days", "products_expiring": sum(1 for p in prods if 0 <= p["expiry_days_remaining"] <= 7), "estimated_stock_value": round(sum(p["stock_value"] for p in prods if 0 <= p["expiry_days_remaining"] <= 7), 2), "total_units": sum(p["units_available"] for p in prods if 0 <= p["expiry_days_remaining"] <= 7)},
                            {"date": "8–30 Days", "month_label": "8–30 Days", "products_expiring": sum(1 for p in prods if 8 <= p["expiry_days_remaining"] <= 30), "estimated_stock_value": round(sum(p["stock_value"] for p in prods if 8 <= p["expiry_days_remaining"] <= 30), 2), "total_units": sum(p["units_available"] for p in prods if 8 <= p["expiry_days_remaining"] <= 30)},
                            {"date": "31+ Days", "month_label": "31+ Days", "products_expiring": sum(1 for p in prods if p["expiry_days_remaining"] > 30), "estimated_stock_value": round(sum(p["stock_value"] for p in prods if p["expiry_days_remaining"] > 30), 2), "total_units": sum(p["units_available"] for p in prods if p["expiry_days_remaining"] > 30)}
                        ],
                        "status_distribution": [
                            {"category": "🟢 Healthy", "status_label": "Healthy (>30d)", "products_count": sum(1 for p in prods if p["expiry_days_remaining"] > 30), "total_units": sum(p["units_available"] for p in prods if p["expiry_days_remaining"] > 30), "stock_value": round(sum(p["stock_value"] for p in prods if p["expiry_days_remaining"] > 30), 2), "percentage": round(sum(1 for p in prods if p["expiry_days_remaining"] > 30)/tot_tr*100, 1)},
                            {"category": "🟡 Expiring Soon", "status_label": "Expiring Soon (0–30d)", "products_count": exp_m, "total_units": sum(p["units_available"] for p in prods if 0 <= p["expiry_days_remaining"] <= 30), "stock_value": round(stk_risk, 2), "percentage": round(exp_m/tot_tr*100, 1)},
                            {"category": "🔴 Expired", "status_label": "Expired (<0d)", "products_count": al_exp, "total_units": sum(p["units_available"] for p in prods if p["expiry_days_remaining"] < 0), "stock_value": round(sum(p["stock_value"] for p in prods if p["expiry_days_remaining"] < 0), 2), "percentage": round(al_exp/tot_tr*100, 1)}
                        ],
                        "value_by_period": [
                            {"period": "Expired", "period_label": "Expired", "products_count": al_exp, "total_units": sum(p["units_available"] for p in prods if p["expiry_days_remaining"] < 0), "stock_value": round(sum(p["stock_value"] for p in prods if p["expiry_days_remaining"] < 0), 2)},
                            {"period": "Within 7 Days", "period_label": "Within 7 Days", "products_count": sum(1 for p in prods if 0 <= p["expiry_days_remaining"] <= 7), "total_units": sum(p["units_available"] for p in prods if 0 <= p["expiry_days_remaining"] <= 7), "stock_value": round(sum(p["stock_value"] for p in prods if 0 <= p["expiry_days_remaining"] <= 7), 2)},
                            {"period": "8–30 Days", "period_label": "8–30 Days", "products_count": sum(1 for p in prods if 8 <= p["expiry_days_remaining"] <= 30), "total_units": sum(p["units_available"] for p in prods if 8 <= p["expiry_days_remaining"] <= 30), "stock_value": round(sum(p["stock_value"] for p in prods if 8 <= p["expiry_days_remaining"] <= 30), 2)},
                            {"period": "31+ Days", "period_label": "31+ Days", "products_count": sum(1 for p in prods if p["expiry_days_remaining"] > 30), "total_units": sum(p["units_available"] for p in prods if p["expiry_days_remaining"] > 30), "stock_value": round(sum(p["stock_value"] for p in prods if p["expiry_days_remaining"] > 30), 2)}
                        ]
                    }

        empty_kpis = {
            "products_tracked": 0,
            "expiring_this_month": 0,
            "already_expired": 0,
            "stock_value_at_risk": 0.0,
            "potential_clearance_value": 0.0
        }
        return {
            "kpis": empty_kpis,
            "timeline": [],
            "status_distribution": [],
            "value_by_period": []
        }

    # 1. KPIs
    sql_kpi = """
    SELECT 
        COUNT(*) as total_tracked,
        SUM(CASE WHEN expiry_days_remaining BETWEEN 0 AND 30 THEN 1 ELSE 0 END) as expiring_this_month,
        SUM(CASE WHEN expiry_days_remaining < 0 THEN 1 ELSE 0 END) as already_expired,
        COALESCE(SUM(CASE WHEN expiry_days_remaining <= 30 THEN stock_value ELSE 0 END), 0) as stock_value_at_risk,
        COALESCE(SUM(CASE WHEN expiry_days_remaining <= 30 THEN (clearance_price * units_available) ELSE 0 END), 0) as potential_clearance_value
    FROM product_demo_metadata
    """
    row = db.execute(text(sql_kpi)).mappings().fetchone()
    
    kpis = {
        "products_tracked": int(row["total_tracked"] or 0),
        "expiring_this_month": int(row["expiring_this_month"] or 0),
        "already_expired": int(row["already_expired"] or 0),
        "stock_value_at_risk": round(float(row["stock_value_at_risk"] or 0.0), 2),
        "potential_clearance_value": round(float(row["potential_clearance_value"] or 0.0), 2)
    }

    # 2. Timeline Chart (Grouped by relative expiration horizon)
    sql_timeline = """
    SELECT 
        CASE
            WHEN expiry_days_remaining < 0 THEN 'Expired (<0d)'
            WHEN expiry_days_remaining BETWEEN 0 AND 7 THEN '0–7 Days'
            WHEN expiry_days_remaining BETWEEN 8 AND 14 THEN '8–14 Days'
            WHEN expiry_days_remaining BETWEEN 15 AND 30 THEN '15–30 Days'
            WHEN expiry_days_remaining BETWEEN 31 AND 60 THEN '31–60 Days'
            WHEN expiry_days_remaining BETWEEN 61 AND 90 THEN '61–90 Days'
            ELSE '90+ Days'
        END as horizon_key,
        COUNT(*) as products_count,
        COALESCE(SUM(stock_value), 0) as stock_value,
        COALESCE(SUM(units_available), 0) as total_units
    FROM product_demo_metadata
    GROUP BY horizon_key
    """
    timeline_rows = db.execute(text(sql_timeline)).mappings().fetchall()
    horizon_order = ["Expired (<0d)", "0–7 Days", "8–14 Days", "15–30 Days", "31–60 Days", "61–90 Days", "90+ Days"]
    
    timeline = []
    for h in horizon_order:
        found = next((r for r in timeline_rows if r["horizon_key"] == h), None)
        cnt = int(found["products_count"]) if found else 0
        units = int(found["total_units"]) if found else 0
        val = round(float(found["stock_value"]), 2) if found else 0.0
        timeline.append({
            "date": h,
            "month_label": h,
            "products_expiring": cnt,
            "estimated_stock_value": val,
            "total_units": units
        })

    # 3. Interactive Donut / Pie Chart (Expiry Status Distribution)
    sql_dist = """
    SELECT 
        expiry_status,
        COUNT(*) as cnt,
        COALESCE(SUM(units_available), 0) as units,
        COALESCE(SUM(stock_value), 0) as val
    FROM product_demo_metadata
    GROUP BY expiry_status
    """
    dist_rows = db.execute(text(sql_dist)).mappings().fetchall()
    total_prods = sum(r["cnt"] for r in dist_rows) or 1
    
    status_order = ["🟢 Healthy", "🟡 Expiring Soon", "🔴 Expired"]
    status_map = {
        "Healthy": ("🟢 Healthy", "Healthy (>30d)"),
        "Expiring Soon": ("🟡 Expiring Soon", "Expiring Soon (1–30d)"),
        "Expired": ("🔴 Expired", "Expired (<0d)")
    }
    
    status_distribution = []
    for raw_status, (category, label) in status_map.items():
        found = next((r for r in dist_rows if r["expiry_status"] == raw_status), None)
        cnt = int(found["cnt"]) if found else 0
        units = int(found["units"]) if found else 0
        val = round(float(found["val"]), 2) if found else 0.0
        pct = round((cnt / total_prods) * 100, 1)
        
        status_distribution.append({
            "category": category,
            "status_label": label,
            "products_count": cnt,
            "total_units": units,
            "stock_value": val,
            "percentage": pct
        })

    # 4. Stock Value Bar Chart by Expiry Period
    sql_period = """
    SELECT 
        CASE 
            WHEN expiry_days_remaining < 0 THEN 'Expired'
            WHEN expiry_days_remaining BETWEEN 0 AND 7 THEN 'Within 7 Days'
            WHEN expiry_days_remaining BETWEEN 8 AND 30 THEN '8–30 Days'
            WHEN expiry_days_remaining BETWEEN 31 AND 60 THEN '31–60 Days'
            ELSE '61+ Days'
        END as period,
        COUNT(*) as cnt,
        COALESCE(SUM(units_available), 0) as units,
        COALESCE(SUM(stock_value), 0) as val
    FROM product_demo_metadata
    GROUP BY period
    """
    period_rows = db.execute(text(sql_period)).mappings().fetchall()
    period_order = ["Expired", "Within 7 Days", "8–30 Days", "31–60 Days", "61+ Days"]
    
    value_by_period = []
    for p in period_order:
        found = next((r for r in period_rows if r["period"] == p), None)
        cnt = int(found["cnt"]) if found else 0
        units = int(found["units"]) if found else 0
        val = round(float(found["val"]), 2) if found else 0.0
        
        value_by_period.append({
            "period": p,
            "period_label": p,
            "products_count": cnt,
            "total_units": units,
            "stock_value": val
        })

    return {
        "kpis": kpis,
        "timeline": timeline,
        "status_distribution": status_distribution,
        "value_by_period": value_by_period
    }

@router.get("/expiry/products", response_model=List[schemas.ExpiryProductItem])
def get_expiry_products(
    filter_period: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    dashboard_id: Optional[str] = Query("default", description="Dashboard ID"),
    db: Session = Depends(get_db)
):
    if dashboard_id and dashboard_id != "default":
        return []
    where_clauses = []
    params = {"limit": limit}

    if filter_period:
        fp = filter_period.lower()
        if fp == 'week':
            where_clauses.append("p.expiry_days_remaining BETWEEN 0 AND 7")
        elif fp == 'month':
            where_clauses.append("p.expiry_days_remaining BETWEEN 0 AND 30")
        elif fp == 'next30':
            where_clauses.append("p.expiry_days_remaining BETWEEN 0 AND 30")
        elif fp == 'next60':
            where_clauses.append("p.expiry_days_remaining BETWEEN 0 AND 60")
        elif fp == 'expired':
            where_clauses.append("p.expiry_days_remaining < 0")

    if status and status.lower() != 'all':
        if 'healthy' in status.lower():
            where_clauses.append("p.expiry_status = 'Healthy'")
        elif 'soon' in status.lower():
            where_clauses.append("p.expiry_status = 'Expiring Soon'")
        elif 'month' in status.lower():
            where_clauses.append("p.expiry_days_remaining BETWEEN 0 AND 30")
        elif 'expired' in status.lower():
            where_clauses.append("p.expiry_status = 'Expired'")

    if search and search.strip():
        where_clauses.append("(p.stock_code LIKE :search OR p.description LIKE :search)")
        params["search"] = f"%{search.strip()}%"

    where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    sql = f"""
    SELECT 
        p.stock_code,
        p.description,
        p.synthetic_expiry_date,
        p.expiry_days_remaining,
        p.expiry_status,
        p.units_available,
        p.unit_price,
        p.stock_value,
        p.recommended_discount,
        p.clearance_discount,
        p.clearance_price,
        COALESCE(SUM(t.quantity), 0) as historical_units_sold,
        COALESCE(SUM(t.revenue), 0) as historical_revenue
    FROM product_demo_metadata p
    LEFT JOIN transactions t ON p.stock_code = t.stock_code AND t.is_cancelled = 0
    {where_str}
    GROUP BY p.stock_code
    ORDER BY p.expiry_days_remaining ASC
    LIMIT :limit
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    
    result = []
    for r in rows:
        days = int(r["expiry_days_remaining"])
        clr_price = float(r["clearance_price"])
        units = int(r["units_available"])
        
        result.append({
            "stock_code": r["stock_code"],
            "description": r["description"] or f"Stock Code #{r['stock_code']}",
            "synthetic_expiry_date": r["synthetic_expiry_date"],
            "expiry_days_remaining": days,
            "days_remaining_label": format_days_remaining_label(days),
            "expiry_status": r["expiry_status"],
            "units_available": units,
            "unit_price": round(float(r["unit_price"]), 2),
            "stock_value": round(float(r["stock_value"]), 2),
            "recommended_discount": float(r["recommended_discount"]),
            "clearance_discount": float(r["clearance_discount"]),
            "clearance_price": round(clr_price, 2),
            "potential_clearance_revenue": round(clr_price * units, 2),
            "historical_units_sold": int(r["historical_units_sold"]),
            "historical_revenue": round(float(r["historical_revenue"]), 2)
        })
    return result

@router.get("/expiry/products/{stock_code}", response_model=schemas.ExpiryProductDetailResponse)
def get_expiry_product_detail(stock_code: str, db: Session = Depends(get_db)):
    sql_prod = """
    SELECT * FROM product_demo_metadata WHERE stock_code = :code
    """
    p = db.execute(text(sql_prod), {"code": stock_code}).mappings().fetchone()
    if not p:
        raise HTTPException(status_code=404, detail=f"Product with stock_code {stock_code} not found")

    # Historical monthly sales trend from transactions
    sql_sales = """
    SELECT 
        strftime('%Y-%m', invoice_date) as month_key,
        SUM(quantity) as units_sold,
        SUM(revenue) as total_rev
    FROM transactions
    WHERE stock_code = :code AND is_cancelled = 0
    GROUP BY month_key
    ORDER BY month_key ASC
    """
    sales_rows = db.execute(text(sql_sales), {"code": stock_code}).mappings().fetchall()
    
    monthly_sales = [
        {
            "month": r["month_key"],
            "units_sold": int(r["units_sold"] or 0),
            "revenue": round(float(r["total_rev"] or 0.0), 2)
        } for r in sales_rows
    ]

    days = int(p["expiry_days_remaining"])
    units = int(p["units_available"])
    clr_price = float(p["clearance_price"])

    return {
        "stock_code": p["stock_code"],
        "description": p["description"],
        "synthetic_expiry_date": p["synthetic_expiry_date"],
        "expiry_days_remaining": days,
        "days_remaining_label": format_days_remaining_label(days),
        "expiry_status": p["expiry_status"],
        "units_available": units,
        "unit_price": round(float(p["unit_price"]), 2),
        "stock_value": round(float(p["stock_value"]), 2),
        "recommended_discount": float(p["recommended_discount"]),
        "clearance_discount": float(p["clearance_discount"]),
        "clearance_price": round(clr_price, 2),
        "potential_clearance_revenue": round(clr_price * units, 2),
        "monthly_sales": monthly_sales
    }

@router.post("/expiry/clearance-price", response_model=schemas.ClearancePriceResponse)
def update_clearance_price(req: schemas.UpdateClearancePriceRequest, db: Session = Depends(get_db)):
    if req.clearance_discount < 0 or req.clearance_discount > 100:
        raise HTTPException(status_code=400, detail="Clearance discount must be between 0% and 100%")

    sql_get = "SELECT * FROM product_demo_metadata WHERE stock_code = :code"
    p = db.execute(text(sql_get), {"code": req.stock_code}).mappings().fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    unit_price = float(p["unit_price"])
    old_disc = float(p["clearance_discount"])
    old_clr_price = float(p["clearance_price"])
    
    new_disc = float(req.clearance_discount)
    new_clr_price = round(unit_price * (1.0 - new_disc / 100.0), 2)
    now_iso = datetime.now().isoformat()

    # Update product_demo_metadata
    sql_upd = """
    UPDATE product_demo_metadata
    SET clearance_discount = :disc, clearance_price = :clr_price, price_updated_at = :updated
    WHERE stock_code = :code
    """
    db.execute(text(sql_upd), {
        "disc": new_disc,
        "clr_price": new_clr_price,
        "updated": now_iso,
        "code": req.stock_code
    })

    # Log audit entry
    sql_audit = """
    INSERT INTO price_change_audit_log (
        stock_code, product_name, old_unit_price, old_discount, new_discount,
        old_clearance_price, new_clearance_price, updated_at, action
    ) VALUES (:code, :name, :uprice, :old_d, :new_d, :old_cp, :new_cp, :updated, 'SINGLE_UPDATE')
    """
    db.execute(text(sql_audit), {
        "code": req.stock_code,
        "name": p["description"],
        "uprice": unit_price,
        "old_d": old_disc,
        "new_d": new_disc,
        "old_cp": old_clr_price,
        "new_cp": new_clr_price,
        "updated": now_iso
    })
    db.commit()

    return {
        "success": True,
        "updated_count": 1,
        "message": f"Updated clearance price for {p['description']} ({req.stock_code}) to £{new_clr_price:.2f} ({new_disc}% discount)."
    }

@router.post("/expiry/bulk-clearance-price", response_model=schemas.ClearancePriceResponse)
def bulk_update_clearance_price(req: schemas.BulkClearancePriceRequest, db: Session = Depends(get_db)):
    if not req.stock_codes:
        raise HTTPException(status_code=400, detail="No stock codes provided")
    if req.clearance_discount < 0 or req.clearance_discount > 100:
        raise HTTPException(status_code=400, detail="Clearance discount must be between 0% and 100%")

    now_iso = datetime.now().isoformat()
    updated_count = 0

    for code in req.stock_codes:
        sql_get = "SELECT * FROM product_demo_metadata WHERE stock_code = :code"
        p = db.execute(text(sql_get), {"code": code}).mappings().fetchone()
        if p:
            unit_price = float(p["unit_price"])
            old_disc = float(p["clearance_discount"])
            old_clr_price = float(p["clearance_price"])
            
            new_disc = float(req.clearance_discount)
            new_clr_price = round(unit_price * (1.0 - new_disc / 100.0), 2)

            sql_upd = """
            UPDATE product_demo_metadata
            SET clearance_discount = :disc, clearance_price = :clr_price, price_updated_at = :updated
            WHERE stock_code = :code
            """
            db.execute(text(sql_upd), {"disc": new_disc, "clr_price": new_clr_price, "updated": now_iso, "code": code})

            sql_audit = """
            INSERT INTO price_change_audit_log (
                stock_code, product_name, old_unit_price, old_discount, new_discount,
                old_clearance_price, new_clearance_price, updated_at, action
            ) VALUES (:code, :name, :uprice, :old_d, :new_d, :old_cp, :new_cp, :updated, 'BULK_UPDATE')
            """
            db.execute(text(sql_audit), {
                "code": code,
                "name": p["description"],
                "uprice": unit_price,
                "old_d": old_disc,
                "new_d": new_disc,
                "old_cp": old_clr_price,
                "new_cp": new_clr_price,
                "updated": now_iso
            })
            updated_count += 1

    db.commit()
    return {
        "success": True,
        "updated_count": updated_count,
        "message": f"Successfully updated clearance discount to {req.clearance_discount}% for {updated_count} products."
    }

@router.get("/expiry/label-data/{stock_code}")
def get_label_data(stock_code: str, db: Session = Depends(get_db)):
    sql_prod = "SELECT * FROM product_demo_metadata WHERE stock_code = :code"
    p = db.execute(text(sql_prod), {"code": stock_code}).mappings().fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    unit_price = float(p["unit_price"])
    clr_discount = float(p["clearance_discount"])
    clr_price = float(p["clearance_price"])

    return {
        "store_name": "AK RETAILS",
        "title": "CLEARANCE SPECIAL OFFER",
        "product_name": p["description"],
        "stock_code": p["stock_code"],
        "was_price": f"£{unit_price:.2f}",
        "now_price": f"£{clr_price:.2f}",
        "savings_percent": f"{clr_discount:.0f}%",
        "expiry_date": p["synthetic_expiry_date"],
        "days_remaining_label": format_days_remaining_label(int(p["expiry_days_remaining"]))
    }

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
            "expected_30d_revenue": round(float(r["predicted_future_value"]) / 3.0, 2),
            "company_may_lose_30d": round(float(r["revenue_at_risk"]) / 3.0, 2),
            "loss_percentage_30d": round(float(r["churn_probability"]) * 100, 1),
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
            "expected_30d_revenue": round(float(r["predicted_future_value"]) / 3.0, 2),
            "company_may_lose_30d": round(float(r["revenue_at_risk"]) / 3.0, 2),
            "loss_percentage_30d": round(float(r["churn_probability"]) * 100, 1),
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

    tot_exp_30d = round(total_val / 3.0, 2)
    lose_30d = round(rev_risk / 3.0, 2)
    loss_pct = round((lose_30d / tot_exp_30d * 100), 1) if tot_exp_30d > 0 else 0.0

    return {
        "campaign_name": req.campaign_name,
        "target_group": req.target_group,
        "customer_count": int(cust_cnt),
        "selected_customer_ids": selected_ids,
        "total_customer_value": round(total_val, 2),
        "potential_revenue_at_risk": lose_30d,
        "total_expected_30d_revenue": tot_exp_30d,
        "company_may_lose_30d": lose_30d,
        "loss_percentage_30d": loss_pct,
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


# --- CSV & Excel Upload & Isolated Analytics Endpoints ---

@router.get("/upload/template")
def download_data_template(format: str = Query("xlsx", description="Template format: xlsx or csv")):
    if format.lower() == "csv":
        csv_content = csv_processor.get_template_csv()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="retail_transaction_template.csv"'}
        )
    else:
        excel_bytes = csv_processor.get_template_excel()
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="retail_transaction_template.xlsx"'}
        )

@router.get("/upload/template-excel")
def download_excel_template():
    excel_bytes = csv_processor.get_template_excel()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="retail_transaction_template.xlsx"'}
    )

@router.post("/upload/validate")
async def validate_uploaded_csv(file: UploadFile = File(...)):
    filename = file.filename.lower()
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a valid CSV (.csv) or Excel (.xlsx) file.")
        
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        
    # If uploaded file is Excel, convert to CSV bytes internally
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            df_excel = pd.read_excel(io.BytesIO(content))
            csv_buf = io.StringIO()
            df_excel.to_csv(csv_buf, index=False)
            content = csv_buf.getvalue().encode('utf-8')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel spreadsheet: {str(e)}")

    result = csv_processor.validate_and_stage_csv(content, file.filename)
    return result

@router.post("/upload/process/{session_id}")
def process_uploaded_csv(session_id: str):
    try:
        results = csv_processor.process_staged_csv(session_id)
        return results
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found.")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")

@router.get("/upload/results/{session_id}")
def get_upload_results(session_id: str):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR if hasattr(csv_processor, 'UPLOADS_DIR') else os.path.join(os.path.dirname(__file__), "../../../data/uploads"), session_id)
    summary_path = os.path.join(session_dir, "results_summary.json")
    
    if not os.path.exists(summary_path):
        raise HTTPException(status_code=404, detail="Results not found for this session.")
        
    with open(summary_path) as f:
        data = json.load(f)
    return data

@router.get("/upload/download/{session_id}/{file_type}")
def download_upload_result_file(session_id: str, file_type: str):
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
    session_dir = os.path.join(project_root, "data/uploads", session_id)
    
    excel_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    
    file_map = {
        "cleaned": ("cleaned_transactions.csv", "cleaned_transactions.csv", "text/csv"),
        "cleaned_excel": ("cleaned_transactions.xlsx", "cleaned_transactions.xlsx", excel_type),
        "predictions": ("customer_predictions.csv", "customer_predictions.csv", "text/csv"),
        "predictions_excel": ("customer_predictions.xlsx", "customer_predictions.xlsx", excel_type),
        "segmentation": ("customer_segmentation.csv", "customer_segmentation.csv", "text/csv"),
        "segmentation_excel": ("customer_segmentation.xlsx", "customer_segmentation.xlsx", excel_type),
        "revenue_risk": ("revenue_risk_results.csv", "revenue_risk_results.csv", "text/csv"),
        "revenue_risk_excel": ("revenue_risk_results.xlsx", "revenue_risk_results.xlsx", excel_type),
        "quality_report": ("data_quality_report.csv", "data_quality_report.csv", "text/csv"),
        "quality_report_excel": ("data_quality_report.xlsx", "data_quality_report.xlsx", excel_type),
        "forecast": ("demand_forecast.csv", "demand_forecast.csv", "text/csv"),
        "forecast_excel": ("demand_forecast.xlsx", "demand_forecast.xlsx", excel_type),
        "inventory": ("inventory_recommendations.csv", "inventory_recommendations.csv", "text/csv"),
        "inventory_excel": ("inventory_recommendations.xlsx", "inventory_recommendations.xlsx", excel_type),
        "pricing": ("price_elasticity.csv", "price_elasticity.csv", "text/csv"),
        "pricing_excel": ("price_elasticity.xlsx", "price_elasticity.xlsx", excel_type),
        "monitoring": ("monitoring_report.csv", "monitoring_report.csv", "text/csv"),
        "monitoring_excel": ("monitoring_report.xlsx", "monitoring_report.xlsx", excel_type),
        "workbook_excel": ("full_analysis_workbook.xlsx", "full_analysis_workbook.xlsx", excel_type),
        "bundle": ("results_bundle.zip", "results_bundle.zip", "application/zip")
    }
    
    if file_type not in file_map:
        raise HTTPException(status_code=400, detail=f"Invalid file type requested. Valid options: {', '.join(file_map.keys())}")
        
    internal_name, download_name, media_type = file_map[file_type]
    file_path = os.path.join(session_dir, internal_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Requested result file '{internal_name}' was not found.")
        
    return FileResponse(
        path=file_path,
        filename=download_name,
        media_type=media_type
    )

# =============================================================================
# PHASE 3-5: DEMAND FORECASTING ENDPOINTS
# =============================================================================
@router.get("/forecasting/summary", response_model=schemas.DemandForecastingSummary)
def get_forecasting_summary(
    dashboard_id: Optional[str] = Query("default", description="Dashboard session ID"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    return retail_intelligence_service.get_demand_summary(db=db, session_dir=session_dir)

@router.get("/forecasting/products", response_model=List[schemas.ProductDemandItem])
def get_forecasting_products(
    dashboard_id: Optional[str] = Query("default", description="Dashboard session ID"),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    trend: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    items = retail_intelligence_service.get_product_demand_list(db=db, session_dir=session_dir, limit=limit)
    if search:
        s_lower = search.lower()
        items = [i for i in items if s_lower in i['stock_code'].lower() or s_lower in i['description'].lower()]
    if trend:
        items = [i for i in items if i['trend_direction'].lower() == trend.lower()]
    return items

@router.get("/forecasting/product/{stock_code}", response_model=schemas.ProductDemandDetailResponse)
def get_forecasting_product_detail(
    stock_code: str,
    dashboard_id: Optional[str] = Query("default", description="Dashboard session ID"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    detail = retail_intelligence_service.get_product_demand_detail(stock_code, db=db, session_dir=session_dir)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Product '{stock_code}' not found in active transaction history.")
    return detail

@router.get("/forecasting/download")
def download_demand_forecast_csv(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    items = retail_intelligence_service.get_product_demand_list(db=db, session_dir=session_dir, limit=300)
    df = pd.DataFrame(items)
    csv_bytes = df.to_csv(index=False).encode('utf-8')
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=demand_forecast_{dashboard_id}.csv"}
    )

# =============================================================================
# PHASE 6-8: INVENTORY OPTIMISATION ENDPOINTS
# =============================================================================
@router.get("/inventory/summary", response_model=schemas.InventorySummaryResponse)
def get_inventory_summary(
    dashboard_id: Optional[str] = Query("default", description="Dashboard session ID"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    return retail_intelligence_service.get_inventory_summary(db=db, session_dir=session_dir)

@router.get("/inventory/recommendations", response_model=List[schemas.InventoryItem])
def get_inventory_recommendations(
    dashboard_id: Optional[str] = Query("default", description="Dashboard session ID"),
    status: Optional[str] = Query(None, description="Filter by status: 'Replenishment Needed', 'Excess Stock', 'Healthy', 'Expiring'"),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    items = retail_intelligence_service.get_inventory_recommendations(db=db, session_dir=session_dir, limit=limit)
    if search:
        s_lower = search.lower()
        items = [i for i in items if s_lower in i['stock_code'].lower() or s_lower in i['description'].lower()]
    if status:
        if status.lower() == 'expiring':
            items = [i for i in items if i.get('expiry_risk_alert') is not None]
        else:
            items = [i for i in items if i['status'].lower() == status.lower()]
    return items

@router.post("/inventory/simulate", response_model=schemas.InventorySimulationResponse)
def simulate_inventory(
    req: schemas.InventorySimulationRequest,
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    return retail_intelligence_service.simulate_inventory(
        stock_code=req.stock_code,
        current_stock=req.current_stock,
        lead_time_days=req.lead_time_days,
        service_level=req.service_level,
        holding_cost_pct=req.holding_cost_pct or 0.20,
        stockout_cost_mult=req.stockout_cost_mult or 1.50,
        unit_cost=req.unit_cost,
        db=db,
        session_dir=session_dir
    )

@router.get("/inventory/download")
def download_inventory_csv(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    items = retail_intelligence_service.get_inventory_recommendations(db=db, session_dir=session_dir, limit=300)
    flat_items = []
    for item in items:
        flat_items.append({
            "stock_code": item['stock_code'],
            "description": item['description'],
            "unit_price": item['unit_price'],
            "expected_30d_demand": item['expected_30d_demand'],
            "lead_time_days": item['lead_time_days'],
            "safety_stock": item['safety_stock'],
            "reorder_point": item['reorder_point'],
            "current_stock": item['current_stock'],
            "suggested_order": item['suggested_order'],
            "status": item['status'],
            "reason": item['reason'],
            "stock_value_scenario": item['stock_value_scenario'],
            "order_cost_scenario": item['order_cost_scenario'],
            "has_expiry_risk": bool(item.get('expiry_risk_alert') is not None)
        })
    df = pd.DataFrame(flat_items)
    csv_bytes = df.to_csv(index=False).encode('utf-8')
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=inventory_recommendations_{dashboard_id}.csv"}
    )

# =============================================================================
# PHASE 9-11: PRICE ANALYTICS ENDPOINTS
# =============================================================================
@router.get("/pricing/summary", response_model=schemas.PricingSummaryResponse)
def get_pricing_summary(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    return retail_intelligence_service.get_pricing_summary(db=db, session_dir=session_dir)

@router.get("/pricing/products", response_model=List[schemas.PriceElasticityItem])
def get_pricing_products(
    dashboard_id: Optional[str] = Query("default"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    items = retail_intelligence_service.get_price_elasticity_list(db=db, session_dir=session_dir, limit=limit)
    if search:
        s_lower = search.lower()
        items = [i for i in items if s_lower in i['stock_code'].lower() or s_lower in i['description'].lower()]
    if category:
        items = [i for i in items if category.lower() in i.get('category', '').lower()]
    return items

@router.post("/pricing/simulate", response_model=schemas.PriceSimulationResponse)
def simulate_price_scenario(
    req: schemas.PriceSimulationRequest,
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    return retail_intelligence_service.simulate_price(
        stock_code=req.stock_code,
        price_change_pct=req.price_change_pct,
        scenario_unit_cost=req.scenario_unit_cost,
        db=db,
        session_dir=session_dir
    )

@router.get("/pricing/download")
def download_pricing_csv(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    items = retail_intelligence_service.get_price_elasticity_list(db=db, session_dir=session_dir, limit=300)
    df = pd.DataFrame(items)
    csv_bytes = df.to_csv(index=False).encode('utf-8')
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=price_elasticity_{dashboard_id}.csv"}
    )

# =============================================================================
# PHASE 12: MODEL / DATA MONITORING ENDPOINTS
# =============================================================================
@router.get("/monitoring/summary", response_model=schemas.MonitoringSummaryResponse)
def get_monitoring_summary(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    return retail_intelligence_service.get_monitoring_summary(db=db, session_dir=session_dir)

@router.get("/monitoring/drift-metrics", response_model=List[schemas.FeatureDriftItem])
def get_monitoring_drift_metrics(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    mon_res = retail_intelligence_service.get_monitoring_summary(db=db, session_dir=session_dir)
    return mon_res.get('feature_drift_results', [])

@router.get("/monitoring/alerts", response_model=List[schemas.DemandAlertItem])
def get_monitoring_alerts(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    mon_res = retail_intelligence_service.get_monitoring_summary(db=db, session_dir=session_dir)
    return mon_res.get('demand_alerts', [])

@router.get("/monitoring/download")
def download_monitoring_csv(
    dashboard_id: Optional[str] = Query("default"),
    db: Session = Depends(get_db)
):
    session_dir = os.path.join(csv_processor.UPLOADS_DIR, dashboard_id) if dashboard_id and dashboard_id != "default" else None
    mon_res = retail_intelligence_service.get_monitoring_summary(db=db, session_dir=session_dir)
    drift_items = mon_res.get('feature_drift_results', [])
    df = pd.DataFrame(drift_items) if drift_items else pd.DataFrame([{"System_Health": mon_res.get("overall_system_health", "Healthy")}])
    csv_bytes = df.to_csv(index=False).encode('utf-8')
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=monitoring_report_{dashboard_id}.csv"}
    )





