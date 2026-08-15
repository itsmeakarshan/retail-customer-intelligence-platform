import React, { useEffect, useState } from 'react';
import {
  fetchMonitoringSummary,
  getMonitoringDownloadURL
} from '../services/api';
import type {
  MonitoringSummary
} from '../services/api';
import {
  Activity,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Search,
  Download,
  BarChart2
} from 'lucide-react';

interface MonitoringPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const MonitoringPage: React.FC<MonitoringPageProps> = ({
  activeDashboardId = 'default'
}) => {
  const [monitoringData, setMonitoringData] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [alertSearch, setAlertSearch] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetchMonitoringSummary(activeDashboardId);
        setMonitoringData(res);
      } catch (err) {
        console.error("Failed to load monitoring data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
        Scanning feature distributions & calculating Population Stability Indices (PSI)...
      </div>
    );
  }

  const overallHealth = monitoringData?.overall_system_health || 'Healthy';
  const featureDriftResults = monitoringData?.feature_drift_results || [];
  const demandAlerts = monitoringData?.demand_alerts || [];

  const filteredAlerts = demandAlerts.filter(a =>
    a.stock_code.toLowerCase().includes(alertSearch.toLowerCase()) ||
    a.message.toLowerCase().includes(alertSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
              <Activity size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #F8FAFC)' }}>
              Model & Data Monitoring Center
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            Real-time population stability index (PSI), Kolmogorov-Smirnov (KS) tests, and demand anomaly detection.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href={getMonitoringDownloadURL(activeDashboardId)}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#FCA5A5',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <Download size={16} />
            Download Monitoring Report
          </a>
        </div>
      </div>

      {/* 4 Health Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Overall System Health</span>
            {overallHealth === 'Healthy' ? <ShieldCheck size={20} color="#10B981" /> : <ShieldAlert size={20} color="#EF4444" />}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: overallHealth === 'Healthy' ? '#10B981' : (overallHealth === 'Warning' ? '#F59E0B' : '#EF4444') }}>
            {overallHealth === 'Healthy' ? '🟢 Healthy' : (overallHealth === 'Warning' ? '🟡 Warning' : '🔴 Attention')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            {monitoringData?.total_features_monitored || 0} features continuously tracked
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Feature Data Drift (PSI)</span>
            <BarChart2 size={20} color="#818CF8" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: monitoringData?.feature_drift_status === 'Healthy' ? '#10B981' : '#F59E0B' }}>
            {monitoringData?.feature_drift_status || 'Healthy'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            PSI Threshold: Warning ≥ 0.10, Alert ≥ 0.25
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Demand Distribution Shift</span>
            <TrendingUp size={20} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: monitoringData?.demand_drift_status === 'Healthy' ? '#10B981' : '#F59E0B' }}>
            {monitoringData?.demand_drift_status || 'Healthy'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            {monitoringData?.total_alerts_count || 0} volume shift alerts identified
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Prediction Stability</span>
            <CheckCircle2 size={20} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#10B981' }}>
            {monitoringData?.prediction_drift_status || 'Healthy'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            Churn &amp; 30d value distributions stable
          </div>
        </div>
      </div>

      {/* Feature Drift Evaluation Table */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Customer &amp; Model Feature Distribution Drift (PSI &amp; KS Tests)
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
            Comparing historical baseline distribution against recent 90-day transactions cohort.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted, #94A3B8)' }}>
                <th style={{ padding: '12px 8px' }}>Feature Name</th>
                <th style={{ padding: '12px 8px' }}>Baseline Mean</th>
                <th style={{ padding: '12px 8px' }}>Recent Mean</th>
                <th style={{ padding: '12px 8px' }}>Shift (%)</th>
                <th style={{ padding: '12px 8px' }}>PSI Score</th>
                <th style={{ padding: '12px 8px' }}>KS p-value</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Recommended Operational Action</th>
              </tr>
            </thead>
            <tbody>
              {featureDriftResults.map((feat) => (
                <tr key={feat.feature_name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 600, color: '#818CF8' }}>
                    {feat.feature_name}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted, #94A3B8)' }}>{feat.baseline_mean.toLocaleString()}</td>
                  <td style={{ padding: '12px 8px', color: '#F8FAFC' }}>{feat.current_mean.toLocaleString()}</td>
                  <td style={{ padding: '12px 8px', color: feat.mean_pct_change >= 0 ? '#10B981' : '#F43F5E' }}>
                    {feat.mean_pct_change > 0 ? '+' : ''}{feat.mean_pct_change}%
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: feat.psi >= 0.25 ? '#EF4444' : (feat.psi >= 0.10 ? '#F59E0B' : '#10B981') }}>
                    {feat.psi.toFixed(4)}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted, #94A3B8)', fontSize: '0.8rem' }}>
                    {feat.ks_pvalue.toFixed(4)}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: feat.status === 'Alert' ? 'rgba(239, 68, 68, 0.15)' : (feat.status === 'Warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                        color: feat.status === 'Alert' ? '#EF4444' : (feat.status === 'Warning' ? '#F59E0B' : '#10B981')
                      }}
                    >
                      {feat.status_emoji} {feat.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)' }}>
                    {feat.recommended_action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demand Spikes & Anomaly Alerts */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              Product Demand Volume Shift Alerts (&gt; 40% Velocity Change)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
              Identifies catalog items experiencing unusual spikes or drops in recent transaction activity.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted, #94A3B8)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Filter alerts..."
              value={alertSearch}
              onChange={(e) => setAlertSearch(e.target.value)}
              style={{
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#F8FAFC',
                fontSize: '0.85rem',
                outline: 'none',
                width: '200px'
              }}
            />
          </div>
        </div>

        {/* Alerts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {filteredAlerts.slice(0, 12).map((alert, idx) => {
            const isSpike = alert.type === 'Demand Spike';
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: isSpike ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isSpike ? <TrendingUp size={16} color="#10B981" /> : <TrendingDown size={16} color="#EF4444" />}
                    <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.9rem' }}>
                      Product {alert.stock_code}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: isSpike ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isSpike ? '#10B981' : '#EF4444'
                    }}
                  >
                    {isSpike ? '📈 Demand Surge' : '📉 Demand Drop'}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94A3B8)' }}>
                  {alert.message}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>Baseline: {alert.baseline_weekly_units} units/wk</span>
                  <strong style={{ color: isSpike ? '#10B981' : '#EF4444' }}>
                    Recent: {alert.recent_weekly_units} units/wk ({alert.pct_change > 0 ? '+' : ''}{alert.pct_change}%)
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
