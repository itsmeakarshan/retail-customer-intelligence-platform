export const API_BASE = "http://localhost:8000/api";

export interface ExecutiveSummary {
  total_customers: number;
  high_risk_customers: number;
  medium_risk_customers: number;
  low_risk_customers: number;
  overall_churn_rate: number;
  total_revenue_at_risk: number;
  total_predicted_future_value: number;
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
  risk_level: string;
  segment_name: string;
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
}

export interface RevenueRiskBreakdown {
  by_segment: Array<{ segment_name: string; customer_count: number; revenue_at_risk: number; predicted_future_value: number }>;
  by_risk_level: Array<{ risk_level: string; customer_count: number; revenue_at_risk: number; predicted_future_value: number }>;
  by_country: Array<{ country: string; customer_count: number; revenue_at_risk: number; predicted_future_value: number }>;
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

export async function fetchSummary(): Promise<ExecutiveSummary> {
  const res = await fetch(`${API_BASE}/summary`);
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
}): Promise<PaginatedCustomers> {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.risk_level) query.append("risk_level", params.risk_level);
  if (params.segment) query.append("segment", params.segment);
  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.order) query.append("order", params.order);

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

export async function fetchSegments(): Promise<SegmentSummary[]> {
  const res = await fetch(`${API_BASE}/segments`);
  return res.json();
}

export async function fetchRevenueRisk(): Promise<RevenueRiskBreakdown> {
  const res = await fetch(`${API_BASE}/revenue-risk`);
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

export async function fetchChat(query: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
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

export async function fetchMonthlyTrends(): Promise<MonthlyTrend[]> {
  const res = await fetch(`${API_BASE}/monthly-trends`);
  return res.json();
}

// Retention & Expiry Types & API Calls
export interface RetentionSummary {
  customers_needing_attention: number;
  high_value_customers_at_risk: number;
  potential_revenue_at_risk: number;
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
  synthetic_expiry_date: string;
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
  synthetic_expiry_date: string;
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

export async function fetchExpiryDashboard(): Promise<ExpiryDashboardData> {
  const res = await fetch(`${API_BASE}/expiry/dashboard`);
  return res.json();
}

export async function fetchExpiryProductsFiltered(
  filterPeriod?: string,
  status?: string,
  search?: string,
  limit: number = 100
): Promise<ExpiryProduct[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
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

export async function fetchRetentionSummary(): Promise<RetentionSummary> {
  const res = await fetch(`${API_BASE}/retention/summary`);
  return res.json();
}

export async function fetchRecommendedCampaigns(): Promise<RecommendedCampaign[]> {
  const res = await fetch(`${API_BASE}/retention/recommended-campaigns`);
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



