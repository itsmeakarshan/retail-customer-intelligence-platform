import React, { useEffect, useState } from 'react';
import { fetchSegments } from '../services/api';
import type { SegmentSummary } from '../services/api';
import { Info } from 'lucide-react';
import { RecommendedActionCard } from './RecommendedActionCard';

interface SegmentationPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const SegmentationPage: React.FC<SegmentationPageProps> = ({ activeDashboardId = 'default', onNavigateTab }) => {
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSegIndex, setHoveredSegIndex] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetchSegments(activeDashboardId);
        setSegments(res);
      } catch (err) {
        console.error("Failed to load customer groups:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeDashboardId]);

  if (loading) return <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading customer groups...</div>;

  const groupDescriptions: Record<string, string> = {
    "Top VIP Customers": "Your most loyal, frequent buyers who purchase regularly and generate top revenue.",
    "At-Risk VIP Customers": "Valuable accounts showing signs they may stop buying due to slipping recency.",
    "Active Customers": "Moderate spenders who purchase periodically and maintain healthy engagement.",
    "Inactive / Dormant Customers": "Accounts with lower historical spend or longer gaps since their last purchase.",
    // Fallbacks for legacy API keys if cached
    "High-Value Champions": "Your most loyal, frequent buyers who purchase regularly and generate top revenue.",
    "High-Value At Risk": "Valuable accounts showing signs they may stop buying due to slipping recency.",
    "Active Casuals": "Moderate spenders who purchase periodically and maintain healthy engagement.",
    "Low-Value / Dormant": "Accounts with lower historical spend or longer gaps since their last purchase."
  };

  // Donut Arc Calculations for Customer Groups
  const donutR = 75;
  const circumference = 2 * Math.PI * donutR;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>Customer Groups Overview</h2>
          <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginTop: 4, marginBottom: 0 }}>
            Accounts grouped by purchasing habits, total spend, and inactivity risk.
          </p>
        </div>
      </div>

      <RecommendedActionCard
        title="Group Segmentation Strategy"
        subtitle="The At Risk VIP and Inactive segments contain accounts requiring targeted activation to prevent complete attrition."
        metricLabel="Total Groups Tracked"
        metricValue={`${segments.length} Customer Segments`}
        recommendedAction="Focus retention campaigns on the At-Risk VIP Customers segment to protect top revenue sources."
        buttonText="View Retention Campaigns"
        onActionClick={() => onNavigateTab && onNavigateTab('retention')}
      />

      {/* Interactive Customer Groups Donut Chart */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
              Customer Group Distribution
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', margin: '4px 0 0 0' }}>
              Proportion of total customer portfolio in each cluster.
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
                Portfolio
              </span>
              <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.02em', marginTop: '2px' }}>
                {totalSegmentCust.toLocaleString()}
              </span>
            </div>

            {/* Floating Dark Tooltip Box */}
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
                boxShadow: '0 12px 30px rgba(0,0,0,0.7), 0 0 20px rgba(236,72,153,0.25)',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '180px' }}>
            {styledSegmentsData.map((seg, i) => (
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
                  {seg.value.toLocaleString()}
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
              {totalSegmentCust.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
              Total Active Accounts
            </div>
          </div>

          <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '12px' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#06B6D4' }}>
              {segments.length} Segment Groups
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
              Cluster Models Applied
            </div>
          </div>
        </div>
      </div>

      {/* Segment Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {segments.map((seg) => (
          <div key={seg.segment_name} className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#818CF8', fontWeight: 600 }}>Customer Group</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '2px 0 4px 0', color: '#F8FAFC' }}>{seg.segment_name}</h3>
              <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0 }}>
                {groupDescriptions[seg.segment_name] || "Accounts clustered by spending behavior."}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', marginBottom: 2 }}>Customer Count</span>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{seg.customer_count.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', marginBottom: 2 }}>Avg Inactivity</span>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{seg.avg_recency} days</div>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', marginBottom: 2 }}>Avg Spend</span>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>&pound;{seg.avg_monetary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', marginBottom: 2 }}>Risk Level</span>
                <div style={{ fontWeight: 600, color: seg.avg_churn_prob > 0.5 ? '#EF4444' : '#10B981' }}>
                  {(seg.avg_churn_prob * 100).toFixed(0)}% Risk
                </div>
              </div>
            </div>

            <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Company May Lose</span>
                  <span title="Estimated 30-day business loss exposure derived from the ML model's 90-day forward prediction using an even daily run-rate assumption (predicted 90-day value ÷ 3)." style={{ cursor: 'help' }}>
                    <Info size={13} color="#94A3B8" />
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'block' }}>↓ {seg.loss_percentage_30d}% of 30-day expected</span>
              </div>
              <span style={{ fontWeight: 700, color: '#EF4444' }}>&pound;{(seg.company_may_lose_30d || (seg.total_revenue_at_risk / 3.0)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-card-border)', fontWeight: 600, color: '#F8FAFC' }}>
          Detailed Customer Group Comparison
        </div>
        <div className="table-container">
          <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Customer Group</th>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Customers</th>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Avg Inactivity</th>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Avg Order Frequency</th>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Total Historical Spend</th>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Avg Spend per Customer</th>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Inactivity Risk</th>
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Company May Lose</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg, idx) => (
                <tr key={seg.segment_name} style={{ borderBottom: idx === segments.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 20px', fontWeight: 600, color: '#F8FAFC', fontSize: '0.85rem' }}>{seg.segment_name}</td>
                  <td style={{ padding: '12px 20px', color: '#F8FAFC', fontSize: '0.85rem' }}>{seg.customer_count.toLocaleString()}</td>
                  <td style={{ padding: '12px 20px', color: '#F8FAFC', fontSize: '0.85rem' }}>{seg.avg_recency} days ago</td>
                  <td style={{ padding: '12px 20px', color: '#F8FAFC', fontSize: '0.85rem' }}>{seg.avg_frequency} orders</td>
                  <td style={{ padding: '12px 20px', color: '#F8FAFC', fontSize: '0.85rem' }}>&pound;{seg.total_monetary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 20px', color: '#F8FAFC', fontSize: '0.85rem' }}>&pound;{seg.avg_monetary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 20px', color: '#F8FAFC', fontSize: '0.85rem' }}>{(seg.avg_churn_prob * 100).toFixed(1)}%</td>
                  <td style={{ padding: '12px 20px', fontWeight: 700, color: '#EF4444', fontSize: '0.85rem' }}>
                    &pound;{(seg.company_may_lose_30d || (seg.total_revenue_at_risk / 3.0)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
