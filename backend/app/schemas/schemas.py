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
    total_expected_30d_revenue: float
    total_company_may_lose_30d: float
    loss_percentage_30d: float
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
    expected_30d_revenue: float
    company_may_lose_30d: float
    loss_percentage_30d: float
    risk_level: str
    segment_name: str
    email: Optional[str] = None

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
    expected_30d_revenue: float
    company_may_lose_30d: float
    loss_percentage_30d: float
    risk_level: str
    segment_name: str
    email: Optional[str] = None
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
    expected_30d_revenue: float
    company_may_lose_30d: float
    loss_percentage_30d: float

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
    total_expected_30d_revenue: float
    company_may_lose_30d: float
    loss_percentage_30d: float
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
    expected_30d_revenue: float
    company_may_lose_30d: float
    loss_percentage_30d: float
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
    synthetic_expiry_date: Optional[str] = None

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
    synthetic_expiry_date: Optional[str] = None
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
    expected_30d_revenue: float
    company_may_lose_30d: float
    loss_percentage_30d: float
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
    total_expected_30d_revenue: float
    company_may_lose_30d: float
    loss_percentage_30d: float
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


class DashboardMeta(BaseModel):
    id: str
    name: str
    is_default: bool
    created_at: str
    filename: Optional[str] = None
    total_customers: int
    total_revenue: float
    total_expected_30d_revenue: float
    company_may_lose_30d: float

class DashboardListResponse(BaseModel):
    active_dashboard_id: str
    dashboards: List[DashboardMeta]

# ==========================================
# PHASE 3-5: DEMAND FORECASTING SCHEMAS
# ==========================================
class DemandForecastingSummary(BaseModel):
    products_forecasted: int
    total_expected_30d_units: float
    products_rising_demand: int
    products_falling_demand: int
    products_stable_demand: int
    avg_mae: float
    avg_smape: float
    ml_beat_baseline_pct: float
    forecast_horizon_days: int

class ProductDemandItem(BaseModel):
    stock_code: str
    description: str
    unit_price: float
    recent_30d_demand: float
    expected_30d_demand: float
    lower_30d_estimate: float
    upper_30d_estimate: float
    trend_pct: float
    trend_direction: str # "Rising", "Falling", "Stable"
    status: str # "Healthy", "Monitor", "Replenishment Needed"
    recommended_action: str
    confidence_interval_label: str
    current_stock: Optional[int] = None

class DailyDemandPoint(BaseModel):
    date: str
    actual_units: Optional[float] = None
    forecast_units: Optional[float] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None

class ProductDemandDetailResponse(BaseModel):
    stock_code: str
    description: str
    unit_price: float
    recent_30d_demand: float
    expected_30d_demand: float
    lower_30d_estimate: float
    upper_30d_estimate: float
    trend_pct: float
    trend_direction: str
    history: List[DailyDemandPoint]
    forecast: List[DailyDemandPoint]
    validation_metrics: Optional[Dict[str, Any]] = None
    interval_method: str

# ==========================================
# PHASE 6-8: INVENTORY OPTIMISATION SCHEMAS
# ==========================================
class ExpiryRiskAlert(BaseModel):
    is_high_risk: bool
    expiry_days_remaining: int
    expiry_status: str
    expected_demand_before_expiry: float
    units_at_risk: int
    estimated_waste_cost: float
    recommendation: str

class InventoryItem(BaseModel):
    stock_code: str
    description: str
    unit_price: float
    expected_30d_demand: float
    daily_mean_demand: float
    daily_std_demand: float
    lead_time_days: int
    service_level: float
    z_score: float
    lead_time_demand: float
    safety_stock: int
    reorder_point: int
    current_stock: int
    suggested_order: int
    status: str # "Replenishment Needed", "Excess Stock", "Healthy"
    status_color: str
    status_emoji: str
    reason: str
    stock_value_scenario: float
    order_cost_scenario: float
    expiry_risk_alert: Optional[ExpiryRiskAlert] = None
    data_disclosure: str

class InventorySummaryResponse(BaseModel):
    total_products_analysed: int
    replenishment_needed_count: int
    excess_stock_count: int
    healthy_count: int
    high_expiry_risk_count: int
    total_suggested_order_units: int
    total_scenario_stock_value: float
    total_suggested_order_cost: float
    default_lead_time_days: int
    default_service_level: float

class InventorySimulationRequest(BaseModel):
    stock_code: str
    current_stock: int
    lead_time_days: int
    service_level: float
    holding_cost_pct: Optional[float] = 0.20
    stockout_cost_mult: Optional[float] = 1.50
    unit_cost: Optional[float] = None

class InventorySimulationResponse(BaseModel):
    stock_code: str
    description: str
    unit_price: float
    lead_time_days: int
    service_level: float
    expected_30d_demand: float
    lead_time_demand: float
    safety_stock: int
    reorder_point: int
    current_stock: int
    suggested_order: int
    status: str
    status_emoji: str
    reason: str
    holding_cost_annual_scenario: float
    stockout_risk_exposure_scenario: float
    order_cost_scenario: float
    disclosure: str

# ==========================================
# PHASE 9-11: PRICE ANALYTICS SCHEMAS
# ==========================================
class PriceElasticityItem(BaseModel):
    stock_code: str
    description: str
    avg_price: float
    min_price: float
    max_price: float
    avg_quantity: float
    total_quantity: int
    distinct_prices: int
    sample_size: int
    elasticity: Optional[float] = None
    se: Optional[float] = None
    t_stat: Optional[float] = None
    p_value: Optional[float] = None
    ci_lower: Optional[float] = None
    ci_upper: Optional[float] = None
    r_squared: Optional[float] = None
    category: str # "Elastic (High Price Sensitivity)", "Inelastic (Low Price Sensitivity)", "Inconclusive", "Insufficient Variation"
    interpretation: str
    is_statistically_significant: bool
    status: str

class PricingSummaryResponse(BaseModel):
    total_products_analysed: int
    elastic_products_count: int
    inelastic_products_count: int
    inconclusive_count: int
    insufficient_variation_count: int
    revenue_opportunity_count: int
    avg_elasticity_elastic_items: float

class PriceSimulationRequest(BaseModel):
    stock_code: str
    price_change_pct: float
    scenario_unit_cost: Optional[float] = None

class PriceSimulationResponse(BaseModel):
    stock_code: Optional[str] = None
    current_price: float
    new_price: float
    price_change_pct: float
    elasticity_used: float
    baseline_quantity: float
    expected_quantity: float
    quantity_change_pct: float
    baseline_revenue: float
    expected_revenue: float
    revenue_difference: float
    revenue_diff_pct: float
    scenario_unit_cost: Optional[float] = None
    baseline_profit: Optional[float] = None
    scenario_profit: Optional[float] = None
    profit_difference: Optional[float] = None
    disclosure: str

# ==========================================
# PHASE 12: MODEL / DATA MONITORING SCHEMAS
# ==========================================
class FeatureDriftItem(BaseModel):
    feature_name: str
    psi: float
    ks_statistic: float
    ks_pvalue: float
    baseline_mean: float
    current_mean: float
    baseline_std: float
    current_std: float
    mean_pct_change: float
    status: str # "Healthy", "Warning", "Alert"
    status_color: str
    status_emoji: str
    recommended_action: str

class DemandAlertItem(BaseModel):
    type: str # "Demand Spike", "Demand Drop"
    stock_code: str
    baseline_weekly_units: float
    recent_weekly_units: float
    pct_change: float
    severity: str # "Warning", "Alert"
    message: str

class MonitoringSummaryResponse(BaseModel):
    overall_system_health: str # "Healthy", "Warning", "Alert"
    feature_drift_status: str
    demand_drift_status: str
    prediction_drift_status: str
    total_features_monitored: int
    total_alerts_count: int
    feature_drift_results: List[FeatureDriftItem]
    demand_alerts: List[DemandAlertItem]
    recent_window_days: int
    timestamp: str

