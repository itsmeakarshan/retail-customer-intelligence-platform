import React, { useEffect, useState } from 'react';
import { fetchRevenueRisk, fetchSummary, fetchCustomers } from '../services/api';
import type { RevenueRiskBreakdown, ExecutiveSummary, CustomerListItem } from '../services/api';
import { CustomerDetailModal } from './CustomerDetailModal';
import { TrendingDown, ShieldAlert, DollarSign, Globe, Award } from 'lucide-react';

export const RevenueRiskPage: React.FC = () => {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [riskBreakdown, setRiskBreakdown] = useState<RevenueRiskBreakdown | null>(null);
  const [topAtRiskCustomers, setTopAtRiskCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [sumData, riskData, customersData] = await Promise.all([
          fetchSummary(),
          fetchRevenueRisk(),
          fetchCustomers({ page: 1, limit: 10, sort_by: 'revenue_at_risk', order: 'desc' })
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
  }, []);

  if (loading) {
    return <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading Revenue Risk Analysis...</div>;
  }

  const riskPct = summary && summary.total_predicted_future_value > 0
    ? (summary.total_revenue_at_risk / summary.total_predicted_future_value) * 100
    : 0;
    
  const topSegment = riskBreakdown?.by_segment && riskBreakdown.by_segment.length > 0 
    ? riskBreakdown.by_segment.sort((a, b) => b.revenue_at_risk - a.revenue_at_risk)[0].segment_name 
    : 'Unknown';

  const totalCustomers = summary?.total_customers || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Banner */}
      <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--color-rose)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <ShieldAlert color="var(--color-rose)" size={28} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Where Could I Lose Future Sales?</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          This analysis identifies total projected 90-day spend for accounts showing high risk of becoming inactive.
          Focusing re-engagement on these key accounts protects portfolio revenue.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid-4">
        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Revenue at Risk</span>
            <DollarSign size={20} color="var(--color-rose)" />
          </div>
          <div className="kpi-value text-red">
            £{summary?.total_revenue_at_risk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-footer">
            <span>{riskPct.toFixed(1)}% of total expected revenue</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Projected Revenue</span>
            <Award size={20} color="var(--color-emerald)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-emerald)' }}>
            £{summary?.total_predicted_future_value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-footer">
            <span>Across all {totalCustomers.toLocaleString()} active customers</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">High-Risk Accounts</span>
            <TrendingDown size={20} color="var(--color-amber)" />
          </div>
          <div className="kpi-value text-amber">
            {summary?.high_risk_customers.toLocaleString()}
          </div>
          <div className="kpi-footer">
            <span>Accounts with &gt; 70% inactivity likelihood</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Top Exposure Group</span>
            <Globe size={20} color="var(--primary-accent)" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem', color: 'var(--primary-accent)' }}>
            {topSegment}
          </div>
          <div className="kpi-footer">
            <span>Accounts needing immediate VIP retention</span>
          </div>
        </div>
      </div>

      {/* Grid: Segment Risk & Country Risk */}
      <div className="grid-2">
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Revenue Exposure by Customer Group</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {riskBreakdown?.by_segment.sort((a,b) => b.revenue_at_risk - a.revenue_at_risk).map((seg) => {
              const maxVal = Math.max(...riskBreakdown.by_segment.map(s => s.revenue_at_risk));
              const pct = maxVal > 0 ? (seg.revenue_at_risk / maxVal) * 100 : 0;
              return (
                <div key={seg.segment_name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{seg.segment_name}</span>
                    <span style={{ color: 'var(--color-rose)', fontWeight: 600 }}>£{seg.revenue_at_risk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-amber), var(--color-rose))', borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Top Markets by Revenue Exposure</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {riskBreakdown?.by_country.sort((a,b) => b.revenue_at_risk - a.revenue_at_risk).slice(0, 5).map((c) => (
              <div key={c.country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe size={18} color="var(--primary-accent)" />
                  <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{c.country}</span>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--color-rose)' }}>£{c.revenue_at_risk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
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
              <th>Est. 90d Value</th>
              <th>Revenue at Risk</th>
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
                  <td>£{cust.predicted_future_value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-rose)' }}>
                    £{cust.revenue_at_risk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
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
