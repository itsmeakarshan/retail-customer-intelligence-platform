import React, { useEffect, useState } from 'react';
import { fetchSegments } from '../services/api';
import type { SegmentSummary } from '../services/api';

export const SegmentationPage: React.FC = () => {
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchSegments();
        setSegments(res);
      } catch (err) {
        console.error("Failed to load customer groups:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Potential Revenue at Risk</span>
              <span style={{ fontWeight: 700, color: '#FBBF24' }}>&pound;{seg.total_revenue_at_risk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
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
                <th style={{ padding: '12px 20px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Potential Revenue at Risk</th>
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
                  <td style={{ padding: '12px 20px', fontWeight: 700, color: '#FBBF24', fontSize: '0.85rem' }}>&pound;{seg.total_revenue_at_risk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
