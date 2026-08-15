export const API_BASE = "http://localhost:8000/api";

export interface ExecutiveSummary {
  total_customers: number;
  high_risk_customers: number;
  medium_risk_customers: number;
  low_risk_customers: number;
  overall_churn_rate: number;
  total_revenue_at_risk: number;
  total_predicted_future_value: number;
  total_expected_30d_revenue: number;
  total_company_may_lose_30d: number;
  loss_percentage_30d: number;
  average_customer_value: number;
  total_segments: number;
}

export interface CustomerListItem {
  customer_id: string;
  country: string;
  recency: number;
  frequency: number;
  monetary: number;
  gross_revenue: number;
  churn_probability: number;
  predicted_future_value: number;
  revenue_at_risk: number;
  expected_30d_revenue: number;
  company_may_lose_30d: number;
  loss_percentage_30d: number;
  risk_level: string;
  segment_name: string;
  email?: string;
}

export interface PaginatedCustomers {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  customers: CustomerListItem[];
}

export interface ExplanationFactor {
  feature_name: string;
  feature_value: any;
  impact: string;
  description: string;
}

export interface CustomerExplanation {
  customer_id: string;
  churn_probability: number;
  risk_level: string;
  top_risk_drivers: ExplanationFactor[];
  protective_factors: ExplanationFactor[];
}

export interface CustomerTransaction {
  invoice: string;
  stock_code: string;
  description: string;
  quantity: number;
  invoice_date: string;
  price: number;
  revenue: number;
  is_cancelled: boolean;
}

export interface CustomerDetail extends CustomerListItem {
  average_order_value: number;
  average_quantity: number;
  unique_products: number;
  customer_lifetime_days: number;
  cancellation_count: number;
  cancellation_rate: number;
  cancelled_revenue: number;
  recent_spend_90d: number;
  historical_spend_prior: number;
  spend_trend: number;
  churn_label: number;
  recent_transactions: CustomerTransaction[];
}

export interface SegmentSummary {
  segment_name: string;
  customer_count: number;
  avg_recency: number;
  avg_frequency: number;
  total_monetary: number;
  avg_monetary: number;
  avg_churn_prob: number;
  total_revenue_at_risk: number;
  avg_predicted_value: number;
  expected_30d_revenue: number;
  company_may_lose_30d: number;
  loss_percentage_30d: number;
}

export interface RevenueRiskBreakdown {
  by_segment: Array<{ segment_name: string; customer_count: number; revenue_at_risk: number; predicted_future_value: number; expected_30d_revenue: number; company_may_lose_30d: number; loss_percentage_30d: number }>;
  by_risk_level: Array<{ risk_level: string; customer_count: number; revenue_at_risk: number; predicted_future_value: number; expected_30d_revenue: number; company_may_lose_30d: number; loss_percentage_30d: number }>;
  by_country: Array<{ country: string; customer_count: number; revenue_at_risk: number; predicted_future_value: number; expected_30d_revenue: number; company_may_lose_30d: number; loss_percentage_30d: number }>;
}

export interface ModelMetricsResponse {
  summary: Array<{
    model_type: string;
    model_name: string;
    training_date: string;
    metric_1_name: string;
    metric_1_val: number;
    metric_2_name: string;
    metric_2_val: number;
    status: string;
  }>;
  churn_classification: any;
  customer_value_regression: any;
}

export interface ChatResponse {
  answer: string;
  available: boolean;
  suggested_tab?: string;
  source_grounding?: string;
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchSummary(dashboardId: string = 'default'): Promise<ExecutiveSummary> {
  const res = await fetch(`${API_BASE}/summary?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return res.json();
}

export async function fetchCustomers(params: {
  search?: string;
  risk_level?: string;
  segment?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: string;
  dashboard_id?: string;
}): Promise<PaginatedCustomers> {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.risk_level) query.append("risk_level", params.risk_level);
  if (params.segment) query.append("segment", params.segment);
  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.order) query.append("order", params.order);
  if (params.dashboard_id) query.append("dashboard_id", params.dashboard_id);

  const res = await fetch(`${API_BASE}/customers?${query.toString()}`);
  return res.json();
}

export async function fetchCustomerDetail(customerId: string): Promise<CustomerDetail> {
  const res = await fetch(`${API_BASE}/customers/${customerId}`);
  return res.json();
}

export async function fetchCustomerExplanation(customerId: string): Promise<CustomerExplanation> {
  const res = await fetch(`${API_BASE}/customers/${customerId}/explanation`);
  return res.json();
}

export async function fetchSegments(dashboardId: string = 'default'): Promise<SegmentSummary[]> {
  const res = await fetch(`${API_BASE}/segments?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return res.json();
}

export async function fetchRevenueRisk(dashboardId: string = 'default'): Promise<RevenueRiskBreakdown> {
  const res = await fetch(`${API_BASE}/revenue-risk?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return res.json();
}

export async function fetchModelMetrics(): Promise<ModelMetricsResponse> {
  const res = await fetch(`${API_BASE}/model-metrics`);
  return res.json();
}

export async function fetchChatStatus(): Promise<{ available: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/chat/status`);
  return res.json();
}

export async function fetchChat(query: string, dashboardId: string = 'default'): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat?dashboard_id=${encodeURIComponent(dashboardId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  return res.json();
}

export interface MonthlyTrend {
  month: string;
  orders: number;
  revenue: number;
  active_customers: number;
}

export async function fetchMonthlyTrends(dashboardId: string = 'default'): Promise<MonthlyTrend[]> {
  const res = await fetch(`${API_BASE}/monthly-trends?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return res.json();
}

// Retention & Expiry Types & API Calls
export interface RetentionSummary {
  customers_needing_attention: number;
  high_value_customers_at_risk: number;
  potential_revenue_at_risk: number;
  total_expected_30d_revenue: number;
  company_may_lose_30d: number;
  loss_percentage_30d: number;
  products_expiring_soon: number;
  high_value_customers_bought_expiring: number;
}

export interface RecommendedCampaign {
  id: string;
  campaign_name: string;
  target_group: string;
  target_product_code?: string;
  target_product_name?: string;
  reason: string;
  customer_count: number;
  potential_revenue_at_risk: number;
  expected_30d_revenue: number;
  company_may_lose_30d: number;
  loss_percentage_30d: number;
  recommended_action: string;
  suggested_discount: number;
  suggested_message: string;
}

export interface ExpirySummary {
  total_products: number;
  expiring_soon: number;
  expired: number;
  healthy: number;
  expiring_7_days: number;
  expiring_30_days: number;
  associated_revenue_at_risk: number;
}

export interface ExpiryProduct {
  stock_code: string;
  description: string;
  synthetic_expiry_date?: string;
  expiry_days_remaining: number;
  days_remaining_label: string;
  expiry_status: string;
  units_available: number;
  unit_price: number;
  stock_value: number;
  recommended_discount: number;
  clearance_discount: number;
  clearance_price: number;
  potential_clearance_revenue: number;
  historical_units_sold: number;
  historical_revenue: number;
}

export interface ExpiryCustomer {
  customer_id: string;
  country: string;
  segment_name: string;
  risk_level: string;
  churn_probability: number;
  predicted_future_value: number;
  revenue_at_risk: number;
  expected_30d_revenue: number;
  company_may_lose_30d: number;
  loss_percentage_30d: number;
  purchased_product_code: string;
  purchased_product_desc: string;
  expiry_days_remaining: number;
  demo_email: string;
}

export interface EmailPreviewResponse {
  campaign_name: string;
  target_group: string;
  customer_count: number;
  selected_customer_ids: string[];
  total_customer_value: number;
  potential_revenue_at_risk: number;
  total_expected_30d_revenue: number;
  company_may_lose_30d: number;
  loss_percentage_30d: number;
  offer_summary: string;
  subject: string;
  formatted_html_preview: string;
  demo_recipient: string;
  demo_mode: boolean;
}

export interface EmailTestResponse {
  success: boolean;
  audit_id: number;
  demo_mode: boolean;
  provider_configured: boolean;
  recipient: string;
  delivery_mode: string;
  status: string;
  timestamp: string;
  message: string;
  message_id?: string;
}

export interface EmailStatusResponse {
  configured: boolean;
  demo_recipient: string;
  api_key_masked?: string;
  status: string;
  message: string;
}

export interface ExpiryKPIs {
  products_tracked: number;
  expiring_this_month: number;
  already_expired: number;
  stock_value_at_risk: number;
  potential_clearance_value: number;
}

export interface ExpiryTimelinePoint {
  date: string;
  month_label: string;
  products_expiring: number;
  estimated_stock_value: number;
  total_units: number;
}

export interface ExpiryStatusDistribution {
  category: string;
  status_label: string;
  products_count: number;
  total_units: number;
  stock_value: number;
  percentage: number;
}

export interface ExpiryValueByPeriod {
  period: string;
  period_label: string;
  products_count: number;
  total_units: number;
  stock_value: number;
}

export interface ExpiryDashboardData {
  kpis: ExpiryKPIs;
  timeline: ExpiryTimelinePoint[];
  status_distribution: ExpiryStatusDistribution[];
  value_by_period: ExpiryValueByPeriod[];
}

export interface ExpiryProductDetailData {
  stock_code: string;
  description: string;
  synthetic_expiry_date?: string;
  expiry_days_remaining: number;
  days_remaining_label: string;
  expiry_status: string;
  units_available: number;
  unit_price: number;
  stock_value: number;
  recommended_discount: number;
  clearance_discount: number;
  clearance_price: number;
  potential_clearance_revenue: number;
  monthly_sales: { month: string; units_sold: number; revenue: number }[];
}

export async function fetchExpiryDashboard(dashboardId: string = 'default'): Promise<ExpiryDashboardData> {
  const res = await fetch(`${API_BASE}/expiry/dashboard?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return res.json();
}

export async function fetchExpiryProductsFiltered(
  filterPeriod?: string,
  status?: string,
  search?: string,
  limit: number = 100,
  dashboardId: string = 'default'
): Promise<ExpiryProduct[]> {
  const params = new URLSearchParams({ limit: limit.toString(), dashboard_id: dashboardId });
  if (filterPeriod && filterPeriod !== 'all') params.append('filter_period', filterPeriod);
  if (status && status !== 'all') params.append('status', status);
  if (search && search.trim()) params.append('search', search.trim());

  const res = await fetch(`${API_BASE}/expiry/products?${params.toString()}`);
  return res.json();
}

export async function fetchExpiryProductDetail(stockCode: string): Promise<ExpiryProductDetailData> {
  const res = await fetch(`${API_BASE}/expiry/products/${encodeURIComponent(stockCode)}`);
  return res.json();
}

export async function updateClearancePrice(stockCode: string, clearanceDiscount: number) {
  const res = await fetch(`${API_BASE}/expiry/clearance-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stock_code: stockCode, clearance_discount: clearanceDiscount })
  });
  return res.json();
}

export async function bulkUpdateClearancePrice(stockCodes: string[], clearanceDiscount: number) {
  const res = await fetch(`${API_BASE}/expiry/bulk-clearance-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stock_codes: stockCodes, clearance_discount: clearanceDiscount })
  });
  return res.json();
}

export async function fetchLabelData(stockCode: string) {
  const res = await fetch(`${API_BASE}/expiry/label-data/${encodeURIComponent(stockCode)}`);
  return res.json();
}

export async function fetchEmailStatus(): Promise<EmailStatusResponse> {
  const res = await fetch(`${API_BASE}/campaigns/email/status`);
  return res.json();
}

export async function fetchRetentionSummary(dashboardId: string = 'default'): Promise<RetentionSummary> {
  const res = await fetch(`${API_BASE}/retention/summary?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return res.json();
}

export async function fetchRecommendedCampaigns(dashboardId: string = 'default'): Promise<RecommendedCampaign[]> {
  const res = await fetch(`${API_BASE}/retention/recommended-campaigns?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return res.json();
}

export async function fetchExpirySummary(): Promise<ExpirySummary> {
  const res = await fetch(`${API_BASE}/expiry/summary`);
  return res.json();
}

export async function fetchExpiryProducts(status?: string): Promise<ExpiryProduct[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE}/expiry/products${query}`);
  return res.json();
}

export async function fetchExpiryCustomers(stockCode?: string): Promise<ExpiryCustomer[]> {
  const query = stockCode ? `?stock_code=${encodeURIComponent(stockCode)}` : '';
  const res = await fetch(`${API_BASE}/expiry/customers${query}`);
  return res.json();
}

export async function fetchRetentionCustomers(
  page: number = 1,
  limit: number = 10,
  segment?: string,
  riskLevel?: string,
  stockCode?: string,
  search?: string
) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (segment && segment !== 'all') params.append('segment', segment);
  if (riskLevel && riskLevel !== 'all') params.append('risk_level', riskLevel);
  if (stockCode) params.append('stock_code', stockCode);
  if (search && search.trim()) params.append('search', search.trim());

  const res = await fetch(`${API_BASE}/retention/customers?${params.toString()}`);
  return res.json();
}

export async function createCampaign(data: {
  campaign_name: string;
  target_group: string;
  target_product_code?: string;
  offer_type: string;
  discount_percent: number;
  subject: string;
  message: string;
}) {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function previewEmail(data: {
  campaign_name: string;
  target_group: string;
  selected_customer_ids?: string[];
  target_product_code?: string;
  discount_percent: number;
  subject: string;
  message: string;
}): Promise<EmailPreviewResponse> {
  const res = await fetch(`${API_BASE}/campaigns/preview-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function sendTestEmail(data: {
  campaign_name: string;
  target_group: string;
  subject: string;
  message: string;
  selected_customer_ids?: string[];
  discount_percent?: number;
  campaign_id?: number;
}): Promise<EmailTestResponse> {
  const res = await fetch(`${API_BASE}/campaigns/send-test-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function fetchCampaignHistory(): Promise<{ campaigns: any[]; audit_logs: any[] }> {
  const res = await fetch(`${API_BASE}/campaigns/history`);
  return res.json();
}

// --- CSV Upload API Service Helpers ---

export interface CSVValidationReport {
  session_id: string;
  is_valid: boolean;
  filename?: string;
  file_size_mb?: number;
  encoding?: string;
  total_rows?: number;
  total_columns?: number;
  unique_customers?: number;
  unique_products?: number;
  date_range?: string;
  estimated_gross_revenue?: number;
  quality_score?: number;
  health_status?: string;
  null_customers?: number;
  null_customers_pct?: number;
  invalid_dates?: number;
  invalid_prices?: number;
  cancellation_rows?: number;
  duplicate_rows?: number;
  preview_rows?: Record<string, any>[];
  missing_columns?: string[];
  found_columns?: string[];
  error_message?: string;
}

export interface UploadSessionResults {
  session_id: string;
  status: string;
  total_rows: number;
  unique_customers: number;
  unique_products: number;
  date_range: string;
  quality_score: number;
  high_risk_customers: number;
  medium_risk_customers: number;
  low_risk_customers: number;
  total_expected_30d_revenue: number;
  total_company_may_lose_30d: number;
  loss_percentage_30d: number;
  segments_summary: any[];
  top_exposure_accounts: any[];
  expiry_available: boolean;
  expiry_message: string;
  email_demo_restricted: boolean;
}

export function getCSVTemplateURL(): string {
  return `${API_BASE}/upload/template?format=csv`;
}

export function getExcelTemplateURL(): string {
  return `${API_BASE}/upload/template-excel`;
}

export function getDownloadResultURL(sessionId: string, fileType: string): string {
  return `${API_BASE}/upload/download/${sessionId}/${fileType}`;
}

export async function validateCSVUpload(file: File): Promise<CSVValidationReport> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload/validate`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "CSV validation failed." }));
    throw new Error(err.detail || "CSV validation failed.");
  }
  return res.json();
}

export async function processCSVUpload(sessionId: string): Promise<UploadSessionResults> {
  const res = await fetch(`${API_BASE}/upload/process/${sessionId}`, {
    method: "POST"
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to process CSV analysis." }));
    throw new Error(err.detail || "Failed to process CSV analysis.");
  }
  return res.json();
}

export async function fetchUploadResults(sessionId: string): Promise<UploadSessionResults> {
  const res = await fetch(`${API_BASE}/upload/results/${sessionId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch upload results.");
  }
  return res.json();
}

// =============================================================================
// PHASE 3-5: DEMAND FORECASTING TYPES & API
// =============================================================================
export interface DemandForecastingSummary {
  products_forecasted: number;
  total_expected_30d_units: number;
  products_rising_demand: number;
  products_falling_demand: number;
  products_stable_demand: number;
  avg_mae: number;
  avg_smape: number;
  ml_beat_baseline_pct: number;
  forecast_horizon_days: number;
}

export interface ProductDemandItem {
  stock_code: string;
  description: string;
  unit_price: number;
  recent_30d_demand: number;
  expected_30d_demand: number;
  lower_30d_estimate: number;
  upper_30d_estimate: number;
  trend_pct: number;
  trend_direction: "Rising" | "Falling" | "Stable";
  status: "Healthy" | "Monitor" | "Replenishment Needed";
  recommended_action: string;
  confidence_interval_label: string;
  current_stock?: number;
}

export interface DailyDemandPoint {
  date: string;
  actual_units?: number;
  forecast_units?: number;
  lower_bound?: number;
  upper_bound?: number;
}

export interface ProductDemandDetail {
  stock_code: string;
  description: string;
  unit_price: number;
  recent_30d_demand: number;
  expected_30d_demand: number;
  lower_30d_estimate: number;
  upper_30d_estimate: number;
  trend_pct: number;
  trend_direction: string;
  history: DailyDemandPoint[];
  forecast: DailyDemandPoint[];
  validation_metrics?: {
    stock_code: string;
    sample_days: number;
    validation_days: number;
    ml_model_type: string;
    ml_metrics: { mae: number; rmse: number; smape: number };
    baseline_metrics: { mae: number; rmse: number; smape: number };
    ml_beat_baseline: boolean;
    residual_std: number;
    interval_method: string;
  };
  interval_method: string;
}

export async function fetchDemandSummary(dashboardId = "default"): Promise<DemandForecastingSummary> {
  const res = await fetch(`${API_BASE}/forecasting/summary?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!res.ok) throw new Error("Failed to fetch demand forecasting summary.");
  return res.json();
}

export async function fetchDemandProducts(params?: {
  dashboard_id?: string;
  limit?: number;
  search?: string;
  trend?: string;
}): Promise<ProductDemandItem[]> {
  const url = new URL(`${API_BASE}/forecasting/products`);
  url.searchParams.set("dashboard_id", params?.dashboard_id || "default");
  if (params?.limit) url.searchParams.set("limit", params.limit.toString());
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.trend) url.searchParams.set("trend", params.trend);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch demand products list.");
  return res.json();
}

export async function fetchDemandProductDetail(stockCode: string, dashboardId = "default"): Promise<ProductDemandDetail> {
  const res = await fetch(`${API_BASE}/forecasting/product/${encodeURIComponent(stockCode)}?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!res.ok) throw new Error(`Failed to fetch demand detail for ${stockCode}.`);
  return res.json();
}

export function getDemandForecastDownloadURL(dashboardId = "default"): string {
  return `${API_BASE}/forecasting/download?dashboard_id=${encodeURIComponent(dashboardId)}`;
}

// =============================================================================
// PHASE 6-8: INVENTORY OPTIMISATION TYPES & API
// =============================================================================
export interface ExpiryRiskAlert {
  is_high_risk: boolean;
  expiry_days_remaining: number;
  expiry_status: string;
  expected_demand_before_expiry: number;
  units_at_risk: number;
  estimated_waste_cost: number;
  recommendation: string;
}

export interface InventoryItem {
  stock_code: string;
  description: string;
  unit_price: number;
  expected_30d_demand: number;
  daily_mean_demand: number;
  daily_std_demand: number;
  lead_time_days: number;
  service_level: number;
  z_score: number;
  lead_time_demand: number;
  safety_stock: number;
  reorder_point: number;
  current_stock: number;
  suggested_order: number;
  status: "Replenishment Needed" | "Excess Stock" | "Healthy";
  status_color: string;
  status_emoji: string;
  reason: string;
  stock_value_scenario: number;
  order_cost_scenario: number;
  expiry_risk_alert?: ExpiryRiskAlert;
  data_disclosure: string;
}

export interface InventorySummary {
  total_products_analysed: number;
  replenishment_needed_count: number;
  excess_stock_count: number;
  healthy_count: number;
  high_expiry_risk_count: number;
  total_suggested_order_units: number;
  total_scenario_stock_value: number;
  total_suggested_order_cost: number;
  default_lead_time_days: number;
  default_service_level: number;
}

export interface InventorySimulationRequest {
  stock_code: string;
  current_stock: number;
  lead_time_days: number;
  service_level: number;
  holding_cost_pct?: number;
  stockout_cost_mult?: number;
  unit_cost?: number;
}

export interface InventorySimulationResult {
  stock_code: string;
  description: string;
  unit_price: number;
  lead_time_days: number;
  service_level: number;
  expected_30d_demand: number;
  lead_time_demand: number;
  safety_stock: number;
  reorder_point: number;
  current_stock: number;
  suggested_order: number;
  status: string;
  status_emoji: string;
  reason: string;
  holding_cost_annual_scenario: number;
  stockout_risk_exposure_scenario: number;
  order_cost_scenario: number;
  disclosure: string;
}

export async function fetchInventorySummary(dashboardId = "default"): Promise<InventorySummary> {
  const res = await fetch(`${API_BASE}/inventory/summary?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!res.ok) throw new Error("Failed to fetch inventory summary.");
  return res.json();
}

export async function fetchInventoryRecommendations(params?: {
  dashboard_id?: string;
  status?: string;
  search?: string;
  limit?: number;
}): Promise<InventoryItem[]> {
  const url = new URL(`${API_BASE}/inventory/recommendations`);
  url.searchParams.set("dashboard_id", params?.dashboard_id || "default");
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.limit) url.searchParams.set("limit", params.limit.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch inventory recommendations.");
  return res.json();
}

export async function simulateInventory(
  payload: InventorySimulationRequest,
  dashboardId = "default"
): Promise<InventorySimulationResult> {
  const res = await fetch(`${API_BASE}/inventory/simulate?dashboard_id=${encodeURIComponent(dashboardId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Inventory simulation failed.");
  return res.json();
}

export function getInventoryDownloadURL(dashboardId = "default"): string {
  return `${API_BASE}/inventory/download?dashboard_id=${encodeURIComponent(dashboardId)}`;
}

// =============================================================================
// PHASE 9-11: PRICE ANALYTICS & ELASTICITY TYPES & API
// =============================================================================
export interface PriceElasticityItem {
  stock_code: string;
  description: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  avg_quantity: number;
  total_quantity: number;
  distinct_prices: number;
  sample_size: number;
  elasticity?: number;
  se?: number;
  t_stat?: number;
  p_value?: number;
  ci_lower?: number;
  ci_upper?: number;
  r_squared?: number;
  category: string;
  interpretation: string;
  is_statistically_significant: boolean;
  status: string;
}

export interface PricingSummary {
  total_products_analysed: number;
  elastic_products_count: number;
  inelastic_products_count: number;
  inconclusive_count: number;
  insufficient_variation_count: number;
  revenue_opportunity_count: number;
  avg_elasticity_elastic_items: number;
}

export interface PriceSimulationRequest {
  stock_code: string;
  price_change_pct: number;
  scenario_unit_cost?: number;
}

export interface PriceSimulationResult {
  current_price: number;
  new_price: number;
  price_change_pct: number;
  elasticity_used: number;
  baseline_quantity: number;
  expected_quantity: number;
  quantity_change_pct: number;
  baseline_revenue: number;
  expected_revenue: number;
  revenue_difference: number;
  revenue_diff_pct: number;
  scenario_unit_cost?: number;
  baseline_profit?: number;
  scenario_profit?: number;
  profit_difference?: number;
  disclosure: string;
}

export async function fetchPricingSummary(dashboardId = "default"): Promise<PricingSummary> {
  const res = await fetch(`${API_BASE}/pricing/summary?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!res.ok) throw new Error("Failed to fetch pricing summary.");
  return res.json();
}

export async function fetchPriceElasticityProducts(params?: {
  dashboard_id?: string;
  category?: string;
  search?: string;
  limit?: number;
}): Promise<PriceElasticityItem[]> {
  const url = new URL(`${API_BASE}/pricing/products`);
  url.searchParams.set("dashboard_id", params?.dashboard_id || "default");
  if (params?.category) url.searchParams.set("category", params.category);
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.limit) url.searchParams.set("limit", params.limit.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch price elasticity products.");
  return res.json();
}

export async function simulatePriceScenario(
  payload: PriceSimulationRequest,
  dashboardId = "default"
): Promise<PriceSimulationResult> {
  const res = await fetch(`${API_BASE}/pricing/simulate?dashboard_id=${encodeURIComponent(dashboardId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Price simulation failed.");
  return res.json();
}

export function getPriceElasticityDownloadURL(dashboardId = "default"): string {
  return `${API_BASE}/pricing/download?dashboard_id=${encodeURIComponent(dashboardId)}`;
}

// =============================================================================
// PHASE 12: MODEL & DATA MONITORING TYPES & API
// =============================================================================
export interface FeatureDriftItem {
  feature_name: string;
  psi: number;
  ks_statistic: number;
  ks_pvalue: number;
  baseline_mean: number;
  current_mean: number;
  baseline_std: number;
  current_std: number;
  mean_pct_change: number;
  status: "Healthy" | "Warning" | "Alert";
  status_color: string;
  status_emoji: string;
  recommended_action: string;
}

export interface DemandAlertItem {
  type: string;
  stock_code: string;
  baseline_weekly_units: number;
  recent_weekly_units: number;
  pct_change: number;
  severity: "Warning" | "Alert";
  message: string;
}

export interface MonitoringSummary {
  overall_system_health: "Healthy" | "Warning" | "Alert";
  feature_drift_status: string;
  demand_drift_status: string;
  prediction_drift_status: string;
  total_features_monitored: number;
  total_alerts_count: number;
  feature_drift_results: FeatureDriftItem[];
  demand_alerts: DemandAlertItem[];
  recent_window_days: number;
  timestamp: string;
}

export async function fetchMonitoringSummary(dashboardId = "default"): Promise<MonitoringSummary> {
  const res = await fetch(`${API_BASE}/monitoring/summary?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!res.ok) throw new Error("Failed to fetch monitoring summary.");
  return res.json();
}

export async function fetchMonitoringDriftMetrics(dashboardId = "default"): Promise<FeatureDriftItem[]> {
  const res = await fetch(`${API_BASE}/monitoring/drift-metrics?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!res.ok) throw new Error("Failed to fetch drift metrics.");
  return res.json();
}

export async function fetchMonitoringAlerts(dashboardId = "default"): Promise<DemandAlertItem[]> {
  const res = await fetch(`${API_BASE}/monitoring/alerts?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!res.ok) throw new Error("Failed to fetch monitoring alerts.");
  return res.json();
}

export function getMonitoringDownloadURL(dashboardId = "default"): string {
  return `${API_BASE}/monitoring/download?dashboard_id=${encodeURIComponent(dashboardId)}`;
}





