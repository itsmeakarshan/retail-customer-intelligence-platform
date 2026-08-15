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
    "High-Value Champions": "Your most loyal, frequent buyers who purchase regularly and generate top revenue.",
    "High-Value At Risk": "Valuable accounts showing signs they may stop buying due to slipping recency.",
    "Active Casuals": "Moderate spenders who purchase periodically and maintain healthy engagement.",
    "Low-Value / Dormant": "Accounts with lower historical spend or longer gaps since their last purchase."
  };

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
        subtitle="The At Risk and Low-Value segments contain accounts requiring targeted activation to prevent complete attrition."
        metricLabel="Total Groups Tracked"
        metricValue={`${segments.length} Customer Segments`}
        recommendedAction="Focus retention campaigns on the High-Value At Risk segment to protect top revenue sources."
        buttonText="View Retention Campaigns"
        onActionClick={() => onNavigateTab && onNavigateTab('retention')}
      />

      {/* Interactive Customer Groups Donut Chart */}
      <div className="glass-card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.8" />
            {(() => {
              const totalCust = segments.reduce((acc, s) => acc + s.customer_count, 0) || 1;
              let accumPct = 0;
              const colors = ['#6366F1', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

              return segments.map((s, idx) => {
                const slicePct = (s.customer_count / totalCust);
                const strokeDasharray = `${slicePct * 100} ${100 - slicePct * 100}`;
                const strokeDashoffset = `${-accumPct * 100}`;
                accumPct += slicePct;
                const strokeColor = colors[idx % colors.length];

                return (
                  <circle
                    key={s.segment_name}
                    className="donut-slice"
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3.8"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  >
                    <title>{`${s.segment_name}: ${s.customer_count.toLocaleString()} accounts (${(slicePct * 100).toFixed(1)}%)`}</title>
                  </circle>
                );
              });
            })()}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
              {segments.reduce((acc, s) => acc + s.customer_count, 0).toLocaleString()}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px 0', color: '#F8FAFC' }}>Customer Group Share</h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '0 0 16px 0' }}>Proportion of total customer portfolio in each cluster.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {segments.map((seg, idx) => {
              const totalCust = segments.reduce((acc, s) => acc + s.customer_count, 0) || 1;
              const pct = ((seg.customer_count / totalCust) * 100).toFixed(1);
              const colors = ['#6366F1', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
              return (
                <div key={seg.segment_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[idx % colors.length] }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{seg.segment_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{seg.customer_count.toLocaleString()} accounts ({pct}%)</div>
                  </div>
                </div>
              );
            })}
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
