import React, { useEffect, useState } from 'react';
import { fetchModelMetrics } from '../services/api';
import type { ModelMetricsResponse } from '../services/api';
import { Award, AlertTriangle, ShieldCheck } from 'lucide-react';

export const ModelPerformancePage: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchModelMetrics();
        setMetrics(res);
      } catch (err) {
        console.error("Failed to load model metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading model performance analytics...</div>;

  const churnBest = metrics?.churn_classification?.best_model_metrics;
  const churnBestName = metrics?.churn_classification?.best_model_name;
  const allChurn = metrics?.churn_classification?.all_models_metrics || {};

  const revBest = metrics?.customer_value_regression?.best_model_metrics;
  const revBestName = metrics?.customer_value_regression?.best_model_name;
  const allRev = metrics?.customer_value_regression?.all_models_metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>Technical Model Performance</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Detailed ML metrics for technical evaluation
        </p>
      </div>

      {/* Production Models Summary Banner */}
      <div className="grid-2">
        <div className="glass-card" style={{ padding: 24, borderTop: '4px solid var(--primary-accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Award size={24} color="var(--primary-accent)" />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Production Classifier</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{churnBestName}</h3>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 12 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>ROC-AUC</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-emerald)' }}>{churnBest?.roc_auc}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>PR-AUC</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-accent)' }}>{churnBest?.pr_auc}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>F1-Score</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-amber)' }}>{churnBest?.f1}</div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24, borderTop: '4px solid var(--color-emerald)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Award size={24} color="var(--color-emerald)" />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Production Regressor</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{revBestName}</h3>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: 16, borderRadius: 12 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>R&sup2; Score</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-emerald)' }}>{revBest?.r2}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>MAE</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>&pound;{revBest?.mae}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>RMSE</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>&pound;{revBest?.rmse}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Classification Comparison Table */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-card-border)', fontWeight: 600, color: 'var(--text-main)' }}>
            Churn Classification Benchmark (Cutoff C Test Set)
          </div>
          <div className="table-container">
            <table className="custom-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Model Architecture</th>
                  <th>ROC-AUC</th>
                  <th>PR-AUC</th>
                  <th>F1</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allChurn).map(([name, m]: [string, any]) => (
                  <tr key={name} style={{ background: name === churnBestName ? 'rgba(99, 102, 241, 0.1)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>
                      {name} {name === churnBestName && <span style={{ fontSize: '0.7rem', background: 'var(--primary-accent)', color: '#fff', padding: '2px 6px', borderRadius: 12, marginLeft: 8 }}>Selected</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>{m.roc_auc}</td>
                    <td>{m.pr_auc}</td>
                    <td>{m.f1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regression Comparison Table */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-card-border)', fontWeight: 600, color: 'var(--text-main)' }}>
            Customer Value Regression Models Comparison
          </div>
          <div className="table-container">
            <table className="custom-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Regressor Architecture</th>
                  <th>R&sup2; Score</th>
                  <th>MAE (&pound;)</th>
                  <th>RMSE (&pound;)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allRev).map(([name, m]: [string, any]) => (
                  <tr key={name} style={{ background: name === revBestName ? 'rgba(16, 185, 129, 0.1)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>
                      {name} {name === revBestName && <span style={{ fontSize: '0.7rem', background: 'var(--color-emerald)', color: '#fff', padding: '2px 6px', borderRadius: 12, marginLeft: 8 }}>Selected</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>{m.r2}</td>
                    <td>&pound;{m.mae}</td>
                    <td>&pound;{m.rmse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Out-Of-Time (OOT) Temporal Validation Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-card-border)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
          <ShieldCheck size={18} color="var(--color-emerald)" /> Multi-Cutoff Temporal &amp; Out-Of-Time (OOT) Generalization
        </div>
        <div className="table-container">
          <table className="custom-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Temporal Cutoff</th>
                <th>Date Range</th>
                <th>Cohort Size</th>
                <th>Observed 90d Churn</th>
                <th>ROC-AUC</th>
                <th>OOT Recall</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Cutoff A</td>
                <td>2011-03-10</td>
                <td>4,656</td>
                <td>65.72%</td>
                <td>0.7966</td>
                <td>90.21%</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Cutoff B</td>
                <td>2011-06-10</td>
                <td>5,032</td>
                <td>68.48%</td>
                <td>0.8229</td>
                <td>90.14%</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Cutoff C</td>
                <td>2011-09-10</td>
                <td>5,344</td>
                <td>57.11%</td>
                <td>0.8288</td>
                <td>84.43%</td>
              </tr>
              <tr style={{ background: 'rgba(16, 185, 129, 0.1)', fontWeight: 700 }}>
                <td>Out-Of-Time (OOT) Test</td>
                <td>Cutoffs A+B &rarr; Cutoff C</td>
                <td>5,344</td>
                <td>57.11%</td>
                <td style={{ color: 'var(--color-emerald)' }}>0.8022</td>
                <td style={{ color: 'var(--color-emerald)' }}>92.82%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Limitations Section */}
      <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--color-amber)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle color="var(--color-amber)" size={22} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>Model Scope &amp; Operational Limitations</h3>
        </div>
        <ul style={{ color: 'var(--text-muted)', fontSize: '0.95rem', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, lineHeight: 1.5 }}>
          <li><strong>Statistical Estimate Only:</strong> Model predictions reflect historical transaction likelihoods and are not guaranteed sales forecasts.</li>
          <li><strong>90-Day Prediction Scope:</strong> Values represent estimated forward 90-day spend, not lifetime customer value (LTV).</li>
          <li><strong>Wholesale Sensitivity:</strong> Top 1% of high-volume wholesale buyers contribute ~38% of total revenue; large individual orders can influence aggregate portfolio figures.</li>
          <li><strong>Domain Specificity:</strong> Trained specifically on UK/international non-subscription B2B/B2C retail transactions (2009-2011).</li>
        </ul>
      </div>
    </div>
  );
};
