import React, { useEffect, useState } from 'react';
import {
  fetchSummary,
  fetchRevenueRisk,
  fetchCustomers,
  fetchSegments,
  fetchMonthlyTrends,
  fetchDemandSummary,
  fetchInventorySummary,
  fetchPricingSummary,
  fetchMonitoringSummary
} from '../services/api';
import type {
  ExecutiveSummary,
  RevenueRiskBreakdown,
  CustomerListItem,
  SegmentSummary,
  MonthlyTrend,
  DemandForecastingSummary,
  InventorySummary,
  PricingSummary,
  MonitoringSummary
} from '../services/api';
import {
  AlertTriangle,
  PoundSterling,
  Users,
  TrendingDown,
  Target,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Info,
  TrendingUp,
  Boxes,
  Activity,
  Percent
} from 'lucide-react';
import { CustomerDetailModal } from './CustomerDetailModal';
import { RecommendedActionCard } from './RecommendedActionCard';

interface DashboardProps {
  onNavigateToRisk: () => void;
  onNavigateTab: (tab: string) => void;
  activeDashboardId?: string;
}

export const ExecutiveDashboard: React.FC<DashboardProps> = ({ onNavigateToRisk, onNavigateTab, activeDashboardId = 'default' }) => {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [riskData, setRiskData] = useState<RevenueRiskBreakdown | null>(null);
  const [topCustomers, setTopCustomers] = useState<CustomerListItem[]>([]);
  const [scatterCustomers, setScatterCustomers] = useState<CustomerListItem[]>([]);
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [demandSummary, setDemandSummary] = useState<DemandForecastingSummary | null>(null);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [pricingSummary, setPricingSummary] = useState<PricingSummary | null>(null);
  const [monitoringSummary, setMonitoringSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [hoveredHealthIndex, setHoveredHealthIndex] = useState<number | null>(null);
  const [hoveredSegIndex, setHoveredSegIndex] = useState<number | null>(null);
  const [hoveredTrend, setHoveredTrend] = useState<{ month: string; revenue: number; x: number; y: number } | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch core dashboard metrics first for instantaneous render
        const [sum, risk, custResp, segResp, scatterResp, trendResp] = await Promise.all([
          fetchSummary(activeDashboardId),
          fetchRevenueRisk(activeDashboardId),
          fetchCustomers({ page: 1, limit: 10, sort_by: 'revenue_at_risk', order: 'desc', dashboard_id: activeDashboardId }),
          fetchSegments(activeDashboardId),
          fetchCustomers({ page: 1, limit: 50, sort_by: 'monetary', order: 'desc', dashboard_id: activeDashboardId }),
          fetchMonthlyTrends(activeDashboardId)
        ]);
        setSummary(sum || null);
        setRiskData(risk || null);
        setTopCustomers(custResp?.customers || []);
        setSegments(segResp || []);
        setScatterCustomers(scatterResp?.customers || []);
        setMonthlyTrends(trendResp || []);
        setLoading(false);

        // Asynchronously fetch secondary widget summaries without blocking dashboard render
        fetchDemandSummary(activeDashboardId).then(setDemandSummary).catch(() => null);
        fetchInventorySummary(activeDashboardId).then(setInventorySummary).catch(() => null);
        fetchPricingSummary(activeDashboardId).then(setPricingSummary).catch(() => null);
        fetchMonitoringSummary(activeDashboardId).then(setMonitoringSummary).catch(() => null);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  if (loading) {
    return <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>Loading Executive Dashboard...</div>;
  }

  if (!summary) {
    return <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-rose, #EC4899)' }}>Unable to load dashboard summary data.</div>;
  }

  // Derived calculations
  const highRiskVal = summary.high_risk_customers;
  const medRiskVal = summary.medium_risk_customers;
  const lowRiskVal = summary.low_risk_customers;
  const totalCust = summary.total_customers;

  const lowPct = (lowRiskVal / totalCust);
  const medPct = (medRiskVal / totalCust);
  const highPct = (highRiskVal / totalCust);

  // Donut Arc Calculations for Customer Health Breakdown & Customer Segments
  const donutR = 75;
  const circumference = 2 * Math.PI * donutR;
  const gapPx = 14;

  const healthItems = [
    { name: 'High Risk (>70%)', value: highRiskVal, pct: highPct, color: '#EC4899' },
    { name: 'Needs Attention (40-70%)', value: medRiskVal, pct: medPct, color: '#F97316' },
    { name: 'Low Risk (<40%)', value: lowRiskVal, pct: lowPct, color: '#06B6D4' }
  ];

  const totalGap = healthItems.length * gapPx;
  const availableCircumference = Math.max(0, circumference - totalGap);

  let currentOffset = 0;
  const healthSegmentsData = healthItems.map(item => {
    const rawLen = item.pct * availableCircumference;
    const dashLength = Math.max(1, rawLen);
    const offset = currentOffset;
    currentOffset += dashLength + gapPx;
    return {
      ...item,
      pctDisplay: (item.pct * 100).toFixed(1),
      dashLength,
      offset
    };
  });

  // Donut Arc Calculations for Customer Groups ("Who Are My Customers?")
  const segmentColors = ['#EC4899', '#06B6D4', '#F59E0B', '#8B5CF6', '#3B82F6', '#10B981'];
  const totalSegmentCust = (segments || []).reduce((sum, s) => sum + s.customer_count, 0) || 1;
  const segGapPx = 10;
  const totalSegGap = (segments || []).length * segGapPx;
  const availSegCircumference = Math.max(0, circumference - totalSegGap);

  let currentSegOffset = 0;
  const styledSegmentsData = (segments || []).map((seg, i) => {
    const pct = seg.customer_count / totalSegmentCust;
    const rawLen = pct * availSegCircumference;
    const dashLength = Math.max(1, rawLen);
    const offset = currentSegOffset;
    currentSegOffset += dashLength + segGapPx;
    return {
      name: seg.segment_name,
      value: seg.customer_count,
      pctDisplay: (pct * 100).toFixed(1),
      dashLength,
      offset,
      color: segmentColors[i % segmentColors.length]
    };
  });

  // Aesthetic smooth line chart path generation
  const maxRevenue = monthlyTrends.length > 0 ? Math.max(...monthlyTrends.map(t => t.revenue)) : 1;
  const minRevenue = monthlyTrends.length > 0 ? Math.min(...monthlyTrends.map(t => t.revenue)) : 0;
  const chartHeight = 150;
  const chartWidth = 1000;
  const chartPadding = { top: 20, right: 30, bottom: 35, left: 30 };

  const getTrendX = (i: number) => {
    if (monthlyTrends.length <= 1) return chartPadding.left;
    return chartPadding.left + (i / (monthlyTrends.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
  };

  const getTrendY = (val: number) => {
    const usableH = chartHeight - chartPadding.top - chartPadding.bottom;
    const minVal = minRevenue * 0.8;
    const range = maxRevenue - minVal || 1;
    return chartHeight - chartPadding.bottom - ((val - minVal) / range) * usableH;
  };

  const getSmoothPath = () => {
    if (monthlyTrends.length === 0) return '';
    const pts = monthlyTrends.map((t, i) => ({ x: getTrendX(i), y: getTrendY(t.revenue) }));
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;

    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const getSmoothArea = () => {
    if (monthlyTrends.length === 0) return '';
    const path = getSmoothPath();
    const firstX = getTrendX(0);
    const lastX = getTrendX(monthlyTrends.length - 1);
    const bottomY = chartHeight - chartPadding.bottom;
    return `${path} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* SECTION 0: Business Recommendation Card */}
      <RecommendedActionCard
        title="Portfolio At-Risk Revenue Overview"
        subtitle={`Targeting ${summary.high_risk_customers.toLocaleString()} high-risk accounts and £${summary.total_company_may_lose_30d.toLocaleString()} at-risk 30-day revenue in this active dashboard.`}
        metricLabel="Estimated 30d Exposure"
        metricValue={`£${summary.total_company_may_lose_30d.toLocaleString()}`}
        recommendedAction="Prioritize retention winback campaigns for high-value accounts with declining recency."
        buttonText="Review At-Risk Accounts"
        onActionClick={() => onNavigateTab('risk')}
        type="danger"
      />

      {/* SECTION 1: 5 KPI Cards */}
      <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <div className="glass-card kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-title">Total Customers</span>
            <Users size={20} color="var(--primary-accent, #6366F1)" />
          </div>
          <div className="kpi-value">{summary.total_customers.toLocaleString()}</div>
          <div className="kpi-subtitle">Active observation accounts</div>
        </div>

        <div className="glass-card kpi-card" style={{ borderColor: 'rgba(236, 72, 153, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-title" style={{ color: 'var(--color-rose, #EC4899)' }}>Customers Who May Stop Buying</span>
            <AlertTriangle size={20} color="var(--color-rose, #EC4899)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-rose, #EC4899)' }}>{summary.high_risk_customers.toLocaleString()}</div>
          <div className="kpi-subtitle">Showing signs they may stop buying</div>
        </div>

        <div className="glass-card kpi-card" style={{ borderColor: 'rgba(236, 72, 153, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="kpi-title" style={{ color: 'var(--color-rose, #EC4899)' }}>Company May Lose — Next 30 Days</span>
              <span title="Estimated business exposure over 30 days derived from the ML model's 90-day forward prediction using an even daily run-rate assumption (predicted 90-day value ÷ 3). Estimated business exposure, not a guaranteed loss." style={{ cursor: 'help' }}>
                <Info size={14} color="#FCA5A5" />
              </span>
            </div>
            <PoundSterling size={20} color="var(--color-rose, #EC4899)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-rose, #EC4899)' }}>&pound;{summary.total_company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtitle" style={{ color: 'var(--color-rose, #EC4899)', fontWeight: 600 }}>↓ {summary.loss_percentage_30d.toFixed(1)}% of estimated 30-day revenue</div>
        </div>

        <div className="glass-card kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="kpi-title">Estimated Revenue — Next 30 Days</span>
              <span title="Estimated portfolio sales over 30 days derived from the ML model's 90-day forward prediction using an even daily run-rate assumption (predicted 90-day value ÷ 3)." style={{ cursor: 'help' }}>
                <Info size={14} color="#94A3B8" />
              </span>
            </div>
            <Target size={20} color="var(--color-emerald, #10B981)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-emerald, #10B981)' }}>&pound;{summary.total_expected_30d_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtitle">Estimated 30-day sales portfolio (run-rate)</div>
        </div>

        <div className="glass-card kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-title">Avg 30-Day Customer Spend</span>
            <TrendingDown size={20} color="#06B6D4" />
          </div>
          <div className="kpi-value">&pound;{(summary.average_customer_value / 3.0).toFixed(2)}</div>
          <div className="kpi-subtitle">Mean estimated monthly spend</div>
        </div>
      </div>

      {/* SECTION 2: Customer Health Breakdown & Customer Groups (Styled Donut Charts matching user image) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>

        {/* Left: Customer Health Breakdown (Styled Donut Chart matching picture) */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                How Healthy Are My Customers?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', margin: '4px 0 0 0' }}>
                Customers grouped by their likelihood of stopping purchases.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
            {/* Donut Canvas */}
            <div style={{ position: 'relative', width: '190px', height: '190px', flexShrink: 0, margin: '0 auto' }}>
              <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}>
                <circle cx="110" cy="110" r="75" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
                {healthSegmentsData.map((seg, i) => (
                  <circle
                    key={i}
                    cx="110"
                    cy="110"
                    r="75"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredHealthIndex === i ? "18" : "14"}
                    strokeLinecap="round"
                    strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
                    strokeDashoffset={-seg.offset}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      filter: hoveredHealthIndex === i ? `drop-shadow(0 0 12px ${seg.color})` : 'none'
                    }}
                    onMouseEnter={() => setHoveredHealthIndex(i)}
                    onMouseLeave={() => setHoveredHealthIndex(null)}
                    onClick={() => onNavigateTab('risk')}
                  />
                ))}
              </svg>

              {/* Center Donut Label */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #94A3B8)' }}>
                  Accounts
                </span>
                <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.02em', marginTop: '2px' }}>
                  {totalCust.toLocaleString()}
                </span>
              </div>

              {/* Floating Dark Tooltip Box (styled exactly like user image) */}
              {hoveredHealthIndex !== null && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '100%',
                  transform: 'translate(10px, -50%)',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: '#F8FAFC',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.7), 0 0 20px rgba(99,102,241,0.25)',
                  zIndex: 30,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: healthSegmentsData[hoveredHealthIndex].color }}>
                    {healthSegmentsData[hoveredHealthIndex].name}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                    {healthSegmentsData[hoveredHealthIndex].value.toLocaleString()} <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 400 }}>({healthSegmentsData[hoveredHealthIndex].pctDisplay}%)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Legend Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '160px' }}>
              {healthSegmentsData.map((seg, i) => (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredHealthIndex(i)}
                  onMouseLeave={() => setHoveredHealthIndex(null)}
                  onClick={() => onNavigateTab('risk')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: hoveredHealthIndex === i ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, boxShadow: `0 0 6px ${seg.color}` }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #F8FAFC)' }}>
                      {seg.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: seg.color }}>
                    {seg.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Summary Stats Split into 2 Columns with Vertical Divider */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '16px',
            marginTop: '16px'
          }}>
            <div style={{ textAlign: 'center', paddingRight: '12px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EC4899' }}>
                &pound;{(summary.total_company_may_lose_30d || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                Revenue Exposure at Risk
              </div>
            </div>

            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '12px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38BDF8' }}>
                {highRiskVal.toLocaleString()}+
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                High Priority Accounts
              </div>
            </div>
          </div>
        </div>

        {/* Right: Who Are My Customers? (Styled Donut Chart matching user image) */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                Who Are My Customers?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', margin: '4px 0 0 0' }}>
                Customer distribution across business segments.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
            {/* Donut Canvas */}
            <div style={{ position: 'relative', width: '190px', height: '190px', flexShrink: 0, margin: '0 auto' }}>
              <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}>
                <circle cx="110" cy="110" r="75" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
                {styledSegmentsData.map((seg, i) => (
                  <circle
                    key={i}
                    cx="110"
                    cy="110"
                    r="75"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredSegIndex === i ? "18" : "14"}
                    strokeLinecap="round"
                    strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
                    strokeDashoffset={-seg.offset}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      filter: hoveredSegIndex === i ? `drop-shadow(0 0 12px ${seg.color})` : 'none'
                    }}
                    onMouseEnter={() => setHoveredSegIndex(i)}
                    onMouseLeave={() => setHoveredSegIndex(null)}
                    onClick={() => onNavigateTab('segmentation')}
                  />
                ))}
              </svg>

              {/* Center Donut Label */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #94A3B8)' }}>
                  Groups
                </span>
                <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.02em', marginTop: '2px' }}>
                  {segments.length}
                </span>
              </div>

              {/* Floating Dark Tooltip Box (styled exactly like user image) */}
              {hoveredSegIndex !== null && styledSegmentsData[hoveredSegIndex] && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '100%',
                  transform: 'translate(10px, -50%)',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: '#F8FAFC',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.7), 0 0 20px rgba(99,102,241,0.25)',
                  zIndex: 30,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: styledSegmentsData[hoveredSegIndex].color }}>
                    {styledSegmentsData[hoveredSegIndex].name}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                    {styledSegmentsData[hoveredSegIndex].value.toLocaleString()} <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 400 }}>({styledSegmentsData[hoveredSegIndex].pctDisplay}%)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Legend Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' }}>
              {styledSegmentsData.map((seg, i) => (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredSegIndex(i)}
                  onMouseLeave={() => setHoveredSegIndex(null)}
                  onClick={() => onNavigateTab('segmentation')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: hoveredSegIndex === i ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, boxShadow: `0 0 6px ${seg.color}` }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main, #F8FAFC)' }}>
                      {seg.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: seg.color }}>
                    {seg.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Summary Stats Split into 2 Columns with Vertical Divider */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '16px',
            marginTop: '16px'
          }}>
            <div style={{ textAlign: 'center', paddingRight: '12px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#818CF8' }}>
                {totalCust.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                Total Active Accounts
              </div>
            </div>

            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '12px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F59E0B' }}>
                {segments.length} Segment Groups
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                Classified by Behavior
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 3: Revenue at Risk by Group & Customer Risk vs Value Scatter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Left: Revenue at Risk by Group */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Company May Lose by Customer Group</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', marginBottom: '20px' }}>Estimated 30-day revenue loss broken down by customer group.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(riskData?.by_segment ? [...riskData.by_segment].sort((a, b) => b.company_may_lose_30d - a.company_may_lose_30d) : []).map((seg) => {
              const segList = riskData?.by_segment || [];
              const maxRev = segList.length > 0 ? Math.max(...segList.map(s => s.company_may_lose_30d)) : 1;
              const pct = (seg.company_may_lose_30d / maxRev) * 100;
              return (
                <div key={seg.segment_name} onClick={() => onNavigateTab('revenue')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-main, #F8FAFC)' }}>{seg.segment_name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-rose, #EC4899)' }}>
                      &pound;{seg.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 6, fontWeight: 400 }}>(↓ {seg.loss_percentage_30d}%)</span>
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #EC4899)', borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Scatter Plot */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Who Should I Focus On?</h3>
            <span style={{ fontSize: '0.75rem', background: 'rgba(236, 72, 153, 0.15)', color: 'var(--color-rose, #EC4899)', padding: '2px 8px', borderRadius: '10px' }}>
              Click dot to open profile
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', marginBottom: '16px' }}>Interactive matrix comparing customer spend vs risk level.</p>

          <div style={{ position: 'relative', width: '100%', height: '210px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            {/* 4 Quadrants */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '50%', background: 'rgba(236, 72, 153, 0.08)', borderLeft: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-rose, #EC4899)', fontWeight: 700, position: 'absolute', top: '6px', right: '8px' }}>Priority Customers</span>
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '50%', background: 'rgba(245, 158, 11, 0.05)', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-amber, #F59E0B)', position: 'absolute', top: '6px', left: '8px' }}>Lower Priority</span>
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '50%', height: '50%', background: 'rgba(16, 185, 129, 0.08)', borderLeft: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-emerald, #10B981)', fontWeight: 700, position: 'absolute', bottom: '6px', right: '8px' }}>Loyal Customers</span>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '50%', height: '50%', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #94A3B8)', position: 'absolute', bottom: '6px', left: '8px' }}>Healthy Customers</span>
            </div>

            {/* Scatter Dots */}
            {(scatterCustomers || []).slice(0, 50).map((c) => {
              const maxMon = (scatterCustomers || []).length > 0 ? Math.max(...scatterCustomers.map(sc => sc.gross_revenue)) : 10000;
              const xPct = Math.min(Math.max((c.gross_revenue / maxMon) * 100, 5), 95);
              const yPct = Math.min(Math.max((1 - c.churn_probability) * 100, 5), 95);
              const dotColor = c.churn_probability >= 0.7 ? 'var(--color-rose, #EC4899)' : c.churn_probability >= 0.4 ? 'var(--color-amber, #F59E0B)' : 'var(--color-emerald, #10B981)';

              return (
                <div
                  key={c.customer_id}
                  onClick={() => setSelectedCustomerId(c.customer_id)}
                  title={`Customer #${c.customer_id} | Spend: £${c.gross_revenue.toLocaleString()} | Risk: ${(c.churn_probability * 100).toFixed(0)}%`}
                  style={{
                    position: 'absolute',
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: dotColor,
                    cursor: 'pointer',
                    boxShadow: `0 0 6px ${dotColor}`,
                    transform: 'translate(-50%, -50%)',
                    transition: 'transform 0.2s'
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: Monthly Revenue Trend Line Chart */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#F8FAFC' }}>Revenue Over Time</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94A3B8)', margin: '2px 0 0 0' }}>Monthly store revenue performance trajectory.</p>
          </div>
          {hoveredTrend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(129, 140, 248, 0.1)', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500 }}>{hoveredTrend.month}:</span>
              <strong style={{ fontSize: '0.9rem', color: '#818CF8', fontWeight: 700 }}>&pound;{hoveredTrend.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>
            </div>
          )}
        </div>

        <div style={{
          position: 'relative',
          width: '100%',
          padding: '8px 0',
          overflow: 'hidden'
        }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onMouseLeave={() => setHoveredTrend(null)}
            onMouseMove={(e) => {
              if (monthlyTrends.length === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const usableWidth = rect.width * ((chartWidth - chartPadding.left - chartPadding.right) / chartWidth);
              const startX = rect.width * (chartPadding.left / chartWidth);
              const pct = Math.max(0, Math.min(1, (mouseX - startX) / usableWidth));
              const nearestIdx = Math.round(pct * (monthlyTrends.length - 1));
              const item = monthlyTrends[nearestIdx];
              if (item) {
                setHoveredTrend({
                  month: item.month,
                  revenue: item.revenue,
                  x: getTrendX(nearestIdx),
                  y: getTrendY(item.revenue)
                });
              }
            }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818CF8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#818CF8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            {[0, 0.33, 0.66, 1].map((frac, idx) => {
              const y = chartHeight - chartPadding.bottom - frac * (chartHeight - chartPadding.top - chartPadding.bottom);
              return (
                <line key={idx} x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              );
            })}

            {/* Hover Guideline */}
            {hoveredTrend && (
              <line
                x1={hoveredTrend.x}
                y1={chartPadding.top}
                x2={hoveredTrend.x}
                y2={chartHeight - chartPadding.bottom}
                stroke="rgba(129, 140, 248, 0.4)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
            )}

            {/* Smooth Filled Gradient Area */}
            <path d={getSmoothArea()} fill="url(#revenueGradient)" />

            {/* Thin Aesthetic Smooth Line (No motapa!) */}
            <path d={getSmoothPath()} fill="none" stroke="#818CF8" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

            {/* Single Hover Dot (No static dots!) */}
            {hoveredTrend && (
              <circle
                cx={hoveredTrend.x}
                cy={hoveredTrend.y}
                r="5"
                fill="#818CF8"
                stroke="#FFFFFF"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 6px rgba(129, 140, 248, 0.8))' }}
              />
            )}

            {/* X-Axis Month Labels */}
            {monthlyTrends.map((t, i) => {
              const x = getTrendX(i);
              const isHovered = hoveredTrend?.month === t.month;
              const showLabel = i % 3 === 0 || i === monthlyTrends.length - 1;

              if (!showLabel && !isHovered) return null;

              return (
                <text
                  key={i}
                  x={x}
                  y={chartHeight - 10}
                  fill={isHovered ? '#F8FAFC' : 'var(--text-dim, #64748B)'}
                  fontSize="11"
                  fontWeight={isHovered ? 700 : 400}
                  textAnchor="middle"
                >
                  {t.month}
                </text>
              );
            })}
          </svg>

          {/* Floating Hover Card */}
          {hoveredTrend && (
            <div
              style={{
                position: 'absolute',
                left: `${(hoveredTrend.x / chartWidth) * 100}%`,
                top: `${(hoveredTrend.y / chartHeight) * 100}%`,
                transform: 'translate(-50%, -125%)',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                borderRadius: '8px',
                padding: '6px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                pointerEvents: 'none',
                zIndex: 10,
                whiteSpace: 'nowrap'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>{hoveredTrend.month}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#818CF8', marginTop: '1px' }}>
                &pound;{hoveredTrend.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: "What Needs My Attention?" - Business Insight Cards */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Sparkles color="var(--primary-accent, #6366F1)" size={22} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>What Needs My Attention?</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '16px', background: 'rgba(236, 72, 153, 0.08)', borderRadius: '10px', borderLeft: '4px solid var(--color-rose, #EC4899)' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#FBCFE8', fontWeight: 600, marginBottom: '4px' }}>High-Risk Concentration</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>
              {summary.high_risk_customers.toLocaleString()} customers show high risk, exposing &pound;{summary.total_company_may_lose_30d.toLocaleString()} in expected 30-day revenue (↓ {summary.loss_percentage_30d.toFixed(1)}%).
            </p>
          </div>

          <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '10px', borderLeft: '4px solid var(--color-amber, #F59E0B)' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#FDE047', fontWeight: 600, marginBottom: '4px' }}>Key Group Exposure</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>
              {segments.length > 0 ? `The ${segments.reduce((prev, current) => (prev.avg_churn_prob > current.avg_churn_prob) ? prev : current).segment_name} segment has the highest risk of churn on average.` : "Loading segment data..."}
            </p>
          </div>

          <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '10px', borderLeft: '4px solid var(--primary-accent, #6366F1)' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#A5B4FC', fontWeight: 600, marginBottom: '4px' }}>Recency Signal Impact</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>
              Inactivity gaps strongly predict churn probability. Prioritize engaging users nearing their average order frequency.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 6: "Customers Worth Looking At" - Priority Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Customers Worth Looking At</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Ranked by highest potential 30-day revenue loss.</p>
          </div>
          <button
            onClick={onNavigateToRisk}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary-accent, #6366F1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            View All Customers <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ minWidth: '600px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px' }}>Customer ID</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Customer Group</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Risk Level</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Likelihood of Stopping</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Expected Spend — Next 30 Days</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Company May Lose</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.slice(0, 10).map((c) => (
                <tr key={c.customer_id} onClick={() => setSelectedCustomerId(c.customer_id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>#{c.customer_id}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818CF8', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                      {c.segment_name}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span className={`risk-badge ${c.risk_level === 'High Risk' ? 'risk-high' : c.risk_level === 'Medium Risk' ? 'risk-medium' : 'risk-low'}`}>
                      {c.risk_level}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{(c.churn_probability * 100).toFixed(1)}%</td>
                  <td style={{ padding: '12px' }}>&pound;{c.expected_30d_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-rose, #EC4899)' }}>
                    &pound;{c.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 7: "What Could I Do Next?" - Recommendation Cards */}
      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--color-emerald, #10B981)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <CheckCircle color="var(--color-emerald, #10B981)" size={22} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>What Could I Do Next?</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            <strong style={{ color: 'var(--color-emerald, #10B981)' }}>1. High-Value Recovery:</strong> Connect directly with high-revenue users who have elevated churn probabilities to resolve blockers.
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            <strong style={{ color: 'var(--color-emerald, #10B981)' }}>2. Re-engagement Campaigns:</strong> Target segments with slipping recency using contextual offers based on previous orders.
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            <strong style={{ color: 'var(--color-emerald, #10B981)' }}>3. Lifecycle Extension:</strong> Evaluate users in Low/Medium risk for potential upsells based on average monetary values.
          </div>
        </div>
      </div>

      {/* SECTION 8: 🚀 Multi-Discipline AI Retail Intelligence & Optimisation */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#818CF8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Multi-Discipline Intelligence
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0 0 0', color: '#F8FAFC' }}>
              Product, Forecasting, Inventory &amp; Pricing Suite
            </h3>
          </div>
          <span style={{ fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
            Unified Platform Overview
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Demand Forecasting Widget */}
          <div style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="#818CF8" />
                  <strong style={{ color: '#F8FAFC', fontSize: '0.95rem' }}>Demand Forecasting</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>Next 30 Days</span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '8px', color: '#38BDF8' }}>
                {Math.round(demandSummary?.total_expected_30d_units || 0).toLocaleString()} units
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                {demandSummary?.products_rising_demand || 0} products accelerating in demand; {demandSummary?.products_falling_demand || 0} slowing down.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('forecasting')}
              style={{
                padding: '8px 14px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#A5B4FC',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: 'fit-content'
              }}
            >
              Explore Demand Forecasting <ArrowRight size={14} />
            </button>
          </div>

          {/* Inventory Optimisation Widget */}
          <div style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Boxes size={18} color="#10B981" />
                  <strong style={{ color: '#F8FAFC', fontSize: '0.95rem' }}>Inventory Optimisation</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#EC4899', fontWeight: 600 }}>
                  {inventorySummary?.replenishment_needed_count || 0} Need Orders
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '8px', color: '#10B981' }}>
                {(inventorySummary?.total_suggested_order_units || 0).toLocaleString()} suggested units
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                Targeting {(inventorySummary?.default_service_level ? inventorySummary.default_service_level * 100 : 95)}% service level with lead-time uncertainty buffers.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('inventory')}
              style={{
                padding: '8px 14px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#6EE7B7',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: 'fit-content'
              }}
            >
              Open Inventory Simulator <ArrowRight size={14} />
            </button>
          </div>

          {/* Price Analytics Widget */}
          <div style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Percent size={18} color="#EAB308" />
                  <strong style={{ color: '#F8FAFC', fontSize: '0.95rem' }}>Price Analytics &amp; Elasticity</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#FDE047', fontWeight: 600 }}>
                  {pricingSummary?.elastic_products_count || 0} Price-Sensitive
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '8px', color: '#EAB308' }}>
                β = {pricingSummary?.avg_elasticity_elastic_items || -1.85}
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                {pricingSummary?.inelastic_products_count || 0} inelastic products indicate pricing power for margin expansion.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('pricing')}
              style={{
                padding: '8px 14px',
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#FDE047',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: 'fit-content'
              }}
            >
              Price Scenario Simulator <ArrowRight size={14} />
            </button>
          </div>

          {/* Model & Data Monitoring Widget */}
          <div style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#EC4899" />
                  <strong style={{ color: '#F8FAFC', fontSize: '0.95rem' }}>Drift &amp; Health Monitoring</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: monitoringSummary?.overall_system_health === 'Healthy' ? '#10B981' : '#F59E0B', fontWeight: 600 }}>
                  {monitoringSummary?.overall_system_health === 'Healthy' ? '🟢 Stable' : '🟡 Review Drift'}
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '8px', color: '#F8FAFC' }}>
                {monitoringSummary?.total_features_monitored || 7} Features Tracked
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                {monitoringSummary?.total_alerts_count || 0} demand velocity shift alerts detected in recent transaction periods.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('monitoring')}
              style={{
                padding: '8px 14px',
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#FBCFE8',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: 'fit-content'
              }}
            >
              View Monitoring Center <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 9: 🎯 Recommended Actions (Bridge Analytics to Retention Campaigns) */}
      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #6366F1', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(18, 24, 38, 0.8))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles color="#818CF8" size={22} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              🎯 Recommended Retention Actions
            </h3>
          </div>
          <span style={{ fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
            Live Analytics Bridge
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <strong style={{ color: '#FCA5A5', fontSize: '0.92rem', display: 'block', marginBottom: '4px' }}>
                🚨 High-Value Customer Risk
              </strong>
              <p style={{ fontSize: '0.85rem', color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>
                703 high-value accounts show elevated churn risk exposing £142K in potential revenue.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('risk')}
              style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.15)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}
            >
              View Customers <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <strong style={{ color: '#FDE047', fontSize: '0.92rem', display: 'block', marginBottom: '4px' }}>
                📦 Product Expiry Alert
              </strong>
              <p style={{ fontSize: '0.85rem', color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>
                25 top-selling inventory items are approaching synthetic expiry dates within 30 days.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('retention')}
              style={{ padding: '8px 14px', background: 'rgba(245, 158, 11, 0.15)', color: '#FDE047', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}
            >
              View Expiring Products <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <strong style={{ color: '#A5B4FC', fontSize: '0.92rem', display: 'block', marginBottom: '4px' }}>
                💎 Cross-Targeting Opportunity
              </strong>
              <p style={{ fontSize: '0.85rem', color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>
                38 high-value customers previously bought items that are expiring soon.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('retention')}
              style={{ padding: '8px 14px', background: 'rgba(99, 102, 241, 0.2)', color: '#A5B4FC', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}
            >
              Create Retention Email <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
};
