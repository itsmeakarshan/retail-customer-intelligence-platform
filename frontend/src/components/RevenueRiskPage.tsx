import React, { useEffect, useState } from 'react';
import { fetchRevenueRisk, fetchSummary, fetchCustomers } from '../services/api';
import type { RevenueRiskBreakdown, ExecutiveSummary, CustomerListItem } from '../services/api';
import { CustomerDetailModal } from './CustomerDetailModal';
import { RecommendedActionCard } from './RecommendedActionCard';
import { TrendingDown, DollarSign, Globe, Award, Info } from 'lucide-react';

interface RevenueRiskPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const RevenueRiskPage: React.FC<RevenueRiskPageProps> = ({ activeDashboardId = 'default', onNavigateTab }) => {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [riskBreakdown, setRiskBreakdown] = useState<RevenueRiskBreakdown | null>(null);
  const [topAtRiskCustomers, setTopAtRiskCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [hoveredSegIndex, setHoveredSegIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumData, riskData, customersData] = await Promise.all([
          fetchSummary(activeDashboardId),
          fetchRevenueRisk(activeDashboardId),
          fetchCustomers({ page: 1, limit: 10, sort_by: 'revenue_at_risk', order: 'desc', dashboard_id: activeDashboardId })
        ]);
        
        setSummary(sumData);
        setRiskBreakdown(riskData);
        setTopAtRiskCustomers(customersData.customers);

      } catch (err) {
        console.error("Failed to fetch revenue risk data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  if (loading) {
    return <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading Revenue Risk Analysis...</div>;
  }

  const topSegment = riskBreakdown?.by_segment && riskBreakdown.by_segment.length > 0 
    ? riskBreakdown.by_segment.sort((a, b) => b.company_may_lose_30d - a.company_may_lose_30d)[0].segment_name 
    : 'Unknown';

  const totalCustomers = summary?.total_customers || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <RecommendedActionCard
        title="Revenue Contraction Mitigation"
        subtitle={`The highest revenue exposure is concentrated in the ${topSegment} group with £${(summary?.total_company_may_lose_30d || 0).toLocaleString()} 30-day exposure.`}
        metricLabel="Concentrated Risk Segment"
        metricValue={topSegment}
        recommendedAction="Target top-exposure accounts with tailored winback discounts and account manager outreach."
        buttonText="View High-Risk Customers"
        onActionClick={() => onNavigateTab && onNavigateTab('risk')}
        type="danger"
      />

      {/* KPI Cards */}
      <div className="grid-4">
        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="kpi-title">Company May Lose — Next 30 Days</span>
              <span title="Estimated business exposure over 30 days derived from the ML model's 90-day forward prediction using an even daily run-rate assumption (predicted 90-day value ÷ 3). Estimated business exposure, not a guaranteed loss." style={{ cursor: 'help' }}>
                <Info size={14} color="#FCA5A5" />
              </span>
            </div>
            <DollarSign size={20} color="var(--color-rose)" />
          </div>
          <div className="kpi-value text-red">
            £{summary?.total_company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-footer" style={{ color: 'var(--color-rose)', fontWeight: 600 }}>
            <span>↓ {summary?.loss_percentage_30d.toFixed(1)}% of estimated 30-day revenue</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="kpi-title">Estimated Revenue — Next 30 Days</span>
              <span title="Estimated portfolio sales over 30 days derived from the ML model's 90-day forward prediction using an even daily run-rate assumption (predicted 90-day value ÷ 3)." style={{ cursor: 'help' }}>
                <Info size={14} color="#94A3B8" />
              </span>
            </div>
            <Award size={20} color="var(--color-emerald)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-emerald)' }}>
            £{summary?.total_expected_30d_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-footer">
            <span>Across all {totalCustomers.toLocaleString()} active customers</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Customers Who May Stop Buying</span>
            <TrendingDown size={20} color="var(--color-amber)" />
          </div>
          <div className="kpi-value text-amber">
            {summary?.high_risk_customers.toLocaleString()}
          </div>
          <div className="kpi-footer">
            <span>Accounts showing &gt;70% inactivity likelihood</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Most Affected Customer Group</span>
            <Globe size={20} color="var(--primary-accent)" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem', color: 'var(--primary-accent)' }}>
            {topSegment}
          </div>
          <div className="kpi-footer">
            <span>Customer group facing highest 30-day loss exposure</span>
          </div>
        </div>
      </div>

      {/* Grid: Segment Risk & Country Risk */}
      <div className="grid-2">
        {/* Left: 30-Day Revenue Risk Distribution (Styled Donut Chart) */}
        {(() => {
          const donutR = 75;
          const circumference = 2 * Math.PI * donutR;
          const riskColors = ['#EC4899', '#F97316', '#06B6D4', '#8B5CF6', '#3B82F6', '#10B981'];
          const segs = riskBreakdown?.by_segment || [];
          const totalRiskVal = segs.reduce((acc, s) => acc + s.company_may_lose_30d, 0) || 1;
          const segGapPx = 10;
          const totalSegGap = segs.length * segGapPx;
          const availSegCircumference = Math.max(0, circumference - totalSegGap);

          let currentSegOffset = 0;
          const styledRiskSegments = segs.map((seg, i) => {
            const pct = seg.company_may_lose_30d / totalRiskVal;
            const rawLen = pct * availSegCircumference;
            const dashLength = Math.max(1, rawLen);
            const offset = currentSegOffset;
            currentSegOffset += dashLength + segGapPx;
            return {
              name: seg.segment_name,
              value: seg.company_may_lose_30d,
              pctDisplay: (pct * 100).toFixed(1),
              dashLength,
              offset,
              color: riskColors[i % riskColors.length]
            };
          });

          return (
            <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                    30-Day Revenue Risk Distribution
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', margin: '4px 0 0 0' }}>
                    Visual breakdown of potential business loss exposure by customer group.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
                {/* Donut Canvas */}
                <div style={{ position: 'relative', width: '190px', height: '190px', flexShrink: 0, margin: '0 auto' }}>
                  <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}>
                    <circle cx="110" cy="110" r="75" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
                    {styledRiskSegments.map((seg, i) => (
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
                      Exposure
                    </span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#EC4899', letterSpacing: '-0.02em', marginTop: '2px' }}>
                      &pound;{((summary?.total_company_may_lose_30d || 0) / 1000).toFixed(1)}k
                    </span>
                  </div>

                  {/* Floating Dark Tooltip Box */}
                  {hoveredSegIndex !== null && styledRiskSegments[hoveredSegIndex] && (
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
                      boxShadow: '0 12px 30px rgba(0,0,0,0.7), 0 0 20px rgba(236,72,153,0.25)',
                      zIndex: 30,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: styledRiskSegments[hoveredSegIndex].color }}>
                        {styledRiskSegments[hoveredSegIndex].name}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                        &pound;{styledRiskSegments[hoveredSegIndex].value.toLocaleString('en-GB', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 400 }}>({styledRiskSegments[hoveredSegIndex].pctDisplay}%)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Legend Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '180px' }}>
                  {styledRiskSegments.map((seg, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredSegIndex(i)}
                      onMouseLeave={() => setHoveredSegIndex(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: hoveredSegIndex === i ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
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
                        &pound;{seg.value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Summary Stats Split into 2 Columns */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '16px',
                marginTop: '16px'
              }}>
                <div style={{ textAlign: 'center', paddingRight: '12px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EC4899' }}>
                    &pound;{(summary?.total_company_may_lose_30d || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                    Estimated 30d Loss Exposure
                  </div>
                </div>

                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '12px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#06B6D4' }}>
                    {summary?.high_risk_customers.toLocaleString()}+
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                    High Priority At-Risk Accounts
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Company May Lose by Market</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {riskBreakdown?.by_country.sort((a,b) => b.company_may_lose_30d - a.company_may_lose_30d).slice(0, 5).map((c) => (
              <div key={c.country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe size={18} color="var(--primary-accent)" />
                  <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{c.country}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-rose)' }}>£{c.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>↓ {c.loss_percentage_30d}% of 30-day expected</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top At-Risk Customers Table */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Top 10 Highest Exposure Accounts</h3>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Country</th>
              <th>Customer Group</th>
              <th>Risk Level</th>
              <th>Expected Spend — Next 30 Days</th>
              <th>Company May Lose</th>
            </tr>
          </thead>
          <tbody>
            {topAtRiskCustomers.map((cust) => {
              const riskLvl = cust.churn_probability >= 0.7 ? 'risk-high' : cust.churn_probability >= 0.4 ? 'risk-medium' : 'risk-low';
              return (
                <tr key={cust.customer_id} onClick={() => setSelectedCustomerId(cust.customer_id)} style={{ cursor: 'pointer' }}>
                  <td>#{cust.customer_id}</td>
                  <td>{cust.country}</td>
                  <td>
                    <span className="badge-status" style={{ background: 'rgba(129, 140, 248, 0.15)', color: 'var(--primary-accent)' }}>
                      {cust.segment_name}
                    </span>
                  </td>
                  <td>
                    <span className={`risk-badge ${riskLvl}`}>
                      {(cust.churn_probability * 100).toFixed(1)}% Risk
                    </span>
                  </td>
                  <td>£{cust.expected_30d_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-rose)' }}>
                    £{cust.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {selectedCustomerId && (
        <CustomerDetailModal 
          customerId={selectedCustomerId} 
          onClose={() => setSelectedCustomerId(null)} 
        />
      )}
    </div>
  );
};
