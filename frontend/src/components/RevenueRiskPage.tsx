import React, { useEffect, useState } from 'react';
import { fetchRevenueRisk, fetchSummary, fetchCustomers } from '../services/api';
import type { RevenueRiskBreakdown, ExecutiveSummary, CustomerListItem } from '../services/api';
import { CustomerDetailModal } from './CustomerDetailModal';
import { RecommendedActionCard } from './RecommendedActionCard';
import { TrendingDown, ShieldAlert, DollarSign, Globe, Award, Info } from 'lucide-react';

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
      {/* Banner */}
      <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--color-rose)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldAlert color="var(--color-rose)" size={28} />
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              30-Day Revenue Risk & Portfolio Exposure
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
              Estimates 30-day potential revenue exposure derived from the ML model's 90-day forward predictions using a uniform daily run-rate assumption (predicted 90-day value ÷ 3).
            </p>
          </div>
        </div>
      </div>

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
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>30-Day Revenue Risk Distribution</h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: 20 }}>Visual breakdown of potential business loss exposure by customer group.</p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 150, height: 150 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.8" />
                {(() => {
                  const segs = riskBreakdown?.by_segment || [];
                  const totalRisk = segs.reduce((acc, s) => acc + s.company_may_lose_30d, 0) || 1;
                  let accumPct = 0;
                  const colors = ['#EF4444', '#F59E0B', '#6366F1', '#10B981', '#8B5CF6'];

                  return segs.map((s, idx) => {
                    const slicePct = (s.company_may_lose_30d / totalRisk);
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
                        <title>{`${s.segment_name}: £${s.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })} (${(slicePct * 100).toFixed(1)}%)`}</title>
                      </circle>
                    );
                  });
                })()}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#EF4444' }}>
                  £{((summary?.total_company_may_lose_30d || 0) / 1000).toFixed(1)}k
                </span>
                <span style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exposure</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {riskBreakdown?.by_segment.sort((a,b) => b.company_may_lose_30d - a.company_may_lose_30d).map((seg, idx) => {
                const colors = ['#EF4444', '#F59E0B', '#6366F1', '#10B981', '#8B5CF6'];
                return (
                  <div key={seg.segment_name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[idx % colors.length] }} />
                      <span style={{ color: '#F8FAFC', fontWeight: 500 }}>{seg.segment_name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#F8FAFC' }}>
                      £{seg.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

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
