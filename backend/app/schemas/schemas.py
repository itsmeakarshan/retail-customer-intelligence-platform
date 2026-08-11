"""
Pydantic Schemas for API Requests & Responses
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class HealthResponse(BaseModel):
    status: str
    database_connected: bool
    models_loaded: bool
    timestamp: str

class ExecutiveSummary(BaseModel):
    total_customers: int
    high_risk_customers: int
    medium_risk_customers: int
    low_risk_customers: int
    overall_churn_rate: float
    total_revenue_at_risk: float
    total_predicted_future_value: float
    average_customer_value: float
    total_segments: int

class CustomerListItem(BaseModel):
    customer_id: str
    country: str
    recency: int
    frequency: int
    monetary: float
    gross_revenue: float
    churn_probability: float
    predicted_future_value: float
    revenue_at_risk: float
    risk_level: str
    segment_name: str

class PaginatedCustomersResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    customers: List[CustomerListItem]

class TransactionItem(BaseModel):
    invoice: str
    stock_code: str
    description: str
    quantity: int
    invoice_date: str
    price: float
    revenue: float
    is_cancelled: bool

class CustomerDetailResponse(BaseModel):
    customer_id: str
    country: str
    recency: int
    frequency: int
    monetary: float
    gross_revenue: float
    average_order_value: float
    average_quantity: float
    unique_products: int
    customer_lifetime_days: int
    cancellation_count: int
    cancellation_rate: float
    cancelled_revenue: float
    recent_spend_90d: float
    historical_spend_prior: float
    spend_trend: float
    churn_label: int
    churn_probability: float
    predicted_future_value: float
    revenue_at_risk: float
    risk_level: str
    segment_name: str
    recent_transactions: List[TransactionItem]

class ExplanationFactor(BaseModel):
    feature_name: str
    feature_value: Any
    impact: str # "Increases Churn Risk" or "Protects Retention"
    description: str

class CustomerExplanationResponse(BaseModel):
    customer_id: str
    churn_probability: float
    risk_level: str
    top_risk_drivers: List[ExplanationFactor]
    protective_factors: List[ExplanationFactor]

class SegmentSummaryItem(BaseModel):
    segment_name: str
    customer_count: int
    avg_recency: float
    avg_frequency: float
    total_monetary: float
    avg_monetary: float
    avg_churn_prob: float
    total_revenue_at_risk: float
    avg_predicted_value: float

class RevenueRiskBreakdown(BaseModel):
    by_segment: List[Dict[str, Any]]
    by_risk_level: List[Dict[str, Any]]
    by_country: List[Dict[str, Any]]

class ModelPerformanceItem(BaseModel):
    model_type: str
    model_name: str
    training_date: str
    metrics: Dict[str, Any]
    confusion_matrix: Optional[List[List[int]]] = None

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str
    available: bool
    suggested_tab: Optional[str] = "dashboard"
    source_grounding: Optional[str] = None

# New Retention & Expiry Schemas
class RetentionSummaryResponse(BaseModel):
    customers_needing_attention: int
    high_value_customers_at_risk: int
    potential_revenue_at_risk: float
    products_expiring_soon: int
    high_value_customers_bought_expiring: int

class RecommendedCampaignItem(BaseModel):
    id: str
    campaign_name: str
    target_group: str
    target_product_code: Optional[str] = None
    target_product_name: Optional[str] = None
    reason: str
    customer_count: int
    potential_revenue_at_risk: float
    recommended_action: str
    suggested_discount: float
    suggested_message: str

class ExpirySummaryResponse(BaseModel):
    total_products: int
    expiring_soon: int
    expired: int
    healthy: int
    expiring_7_days: int
    expiring_30_days: int
    associated_revenue_at_risk: float

class ExpiryProductItem(BaseModel):
    stock_code: str
    description: str
    synthetic_expiry_date: str
    expiry_days_remaining: int
    days_remaining_label: str
    expiry_status: str
    units_available: int
    unit_price: float
    stock_value: float
    recommended_discount: float
    clearance_discount: float
    clearance_price: float
    potential_clearance_revenue: float
    historical_units_sold: int
    historical_revenue: float

class ExpiryKPIs(BaseModel):
    products_tracked: int
    expiring_this_month: int
    already_expired: int
    stock_value_at_risk: float
    potential_clearance_value: float

class ExpiryTimelinePoint(BaseModel):
    date: str
    month_label: str
    products_expiring: int
    estimated_stock_value: float
    total_units: int

class ExpiryStatusDistribution(BaseModel):
    category: str
    status_label: str
    products_count: int
    total_units: int
    stock_value: float
    percentage: float

class ExpiryValueByPeriod(BaseModel):
    period: str
    period_label: str
    products_count: int
    total_units: int
    stock_value: float

class ExpiryDashboardResponse(BaseModel):
    kpis: ExpiryKPIs
    timeline: List[ExpiryTimelinePoint]
    status_distribution: List[ExpiryStatusDistribution]
    value_by_period: List[ExpiryValueByPeriod]

class ExpiryProductDetailResponse(BaseModel):
    stock_code: str
    description: str
    synthetic_expiry_date: str
    expiry_days_remaining: int
    days_remaining_label: str
    expiry_status: str
    units_available: int
    unit_price: float
    stock_value: float
    recommended_discount: float
    clearance_discount: float
    clearance_price: float
    potential_clearance_revenue: float
    monthly_sales: List[Dict[str, Any]]

class UpdateClearancePriceRequest(BaseModel):
    stock_code: str
    clearance_discount: float

class BulkClearancePriceRequest(BaseModel):
    stock_codes: List[str]
    clearance_discount: float

class ClearancePriceResponse(BaseModel):
    success: bool
    updated_count: int
    message: str


class ExpiryCustomerItem(BaseModel):
    customer_id: str
    country: str
    segment_name: str
    risk_level: str
    churn_probability: float
    predicted_future_value: float
    revenue_at_risk: float
    purchased_product_code: str
    purchased_product_desc: str
    expiry_days_remaining: int
    demo_email: str

class CampaignCreateRequest(BaseModel):
    campaign_name: str
    target_group: str
    target_product_code: Optional[str] = None
    offer_type: str
    discount_percent: float
    subject: str
    message: str

class EmailPreviewRequest(BaseModel):
    campaign_name: str
    target_group: str
    selected_customer_ids: Optional[List[str]] = None
    target_product_code: Optional[str] = None
    discount_percent: float
    subject: str
    message: str

class EmailPreviewResponse(BaseModel):
    campaign_name: str
    target_group: str
    customer_count: int
    selected_customer_ids: List[str]
    total_customer_value: float
    potential_revenue_at_risk: float
    offer_summary: str
    subject: str
    formatted_html_preview: str
    demo_recipient: str
    demo_mode: bool

class EmailTestRequest(BaseModel):
    campaign_name: str
    target_group: str
    subject: str
    message: str
    selected_customer_ids: Optional[List[str]] = None
    discount_percent: Optional[float] = 15.0
    campaign_id: Optional[int] = None

class EmailTestResponse(BaseModel):
    success: bool
    audit_id: int
    demo_mode: bool
    provider_configured: bool
    recipient: str
    delivery_mode: str
    status: str
    timestamp: str
    message: str
    message_id: Optional[str] = None

class EmailStatusResponse(BaseModel):
    configured: bool
    demo_recipient: str
    api_key_masked: Optional[str] = None
    status: str
    message: str



