import React, { useEffect, useState } from 'react';
import { fetchCustomerDetail, fetchCustomerExplanation } from '../services/api';
import type { CustomerDetail, CustomerExplanation } from '../services/api';
import { X, AlertTriangle, ShieldCheck, Info } from 'lucide-react';

interface ModalProps {
  customerId: string;
  onClose: () => void;
}

export const CustomerDetailModal: React.FC<ModalProps> = ({ customerId, onClose }) => {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [explanation, setExplanation] = useState<CustomerExplanation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [det, exp] = await Promise.all([
          fetchCustomerDetail(customerId),
          fetchCustomerExplanation(customerId)
        ]);
        setDetail(det);
        setExplanation(exp);
      } catch (err) {
        console.error("Modal fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [customerId]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: 24, borderRadius: 16 }}>
        <button className="close-btn" onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}><X size={24} /></button>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading customer profile & risk analysis...</div>
        ) : !detail ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>Customer profile not found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Modal Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>Customer ID: #{detail.customer_id}</h2>
                <span className={`risk-badge ${detail.churn_probability >= 0.70 ? 'risk-high' : detail.churn_probability >= 0.40 ? 'risk-medium' : 'risk-low'}`}>
                  {detail.churn_probability >= 0.70 ? 'HIGH PRIORITY' : detail.churn_probability >= 0.40 ? 'NEEDS ATTENTION' : 'LOW RISK'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#94A3B8', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: 12 }}>
                  {detail.segment_name}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginTop: 4, marginBottom: 0 }}>Primary Market: {detail.country}</p>
            </div>

            {/* Inactivity Risk Gauge & Financial Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: 4 }}>Likelihood of Stopping</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: detail.churn_probability >= 0.70 ? '#EF4444' : detail.churn_probability >= 0.40 ? '#F59E0B' : '#10B981' }}>
                  {(detail.churn_probability * 100).toFixed(0)}% Likely
                </div>
              </div>

              <div style={{ padding: 16, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Expected Spend — Next 30 Days</span>
                  <span title="Derived from the ML model's 90-day forward prediction using an even daily run-rate assumption (predicted 90-day value ÷ 3)." style={{ cursor: 'help' }}>
                    <Info size={13} color="#94A3B8" />
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F8FAFC' }}>&pound;{detail.expected_30d_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 2 }}>Daily run-rate estimate (÷3.0)</div>
              </div>

              <div style={{ padding: 16, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ fontSize: '0.8rem', color: '#FCA5A5', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Company May Lose</span>
                  <span title="Estimated 30-day loss exposure based on churn probability × estimated 30-day spend. Estimated business exposure, not a guaranteed loss." style={{ cursor: 'help' }}>
                    <Info size={13} color="#FCA5A5" />
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#EF4444' }}>&pound;{detail.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '0.72rem', color: '#FCA5A5', marginTop: 2 }}>↓ {detail.loss_percentage_30d.toFixed(1)}% of expected 30-day spend</div>
              </div>

              <div style={{ padding: 16, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: 4 }}>Total Historical Spend</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F8FAFC' }}>&pound;{detail.gross_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* Why Does This Customer Need Attention? */}
            {explanation && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', color: '#FCA5A5', margin: '0 0 12px 0' }}>
                    <AlertTriangle size={18} color="#EF4444" /> Why Does This Customer Need Attention?
                  </h4>
                  {explanation.top_risk_drivers.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: 0 }}>No major risk indicators detected.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {explanation.top_risk_drivers.map((rf, idx) => (
                        <div key={idx} style={{ fontSize: '0.85rem' }}>
                          <strong style={{ color: '#FCA5A5' }}>{rf.feature_name}</strong> ({rf.feature_value})
                          <p style={{ color: '#94A3B8', margin: '2px 0 0 0' }}>{rf.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: 16, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', color: '#6EE7B7', margin: '0 0 12px 0' }}>
                    <ShieldCheck size={18} color="#10B981" /> Positive Retention Factors
                  </h4>
                  {explanation.protective_factors.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: 0 }}>No strong retention factors identified.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {explanation.protective_factors.map((pf, idx) => (
                        <div key={idx} style={{ fontSize: '0.85rem' }}>
                          <strong style={{ color: '#6EE7B7' }}>{pf.feature_name}</strong> ({pf.feature_value})
                          <p style={{ color: '#94A3B8', margin: '2px 0 0 0' }}>{pf.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Historical Account Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Total Orders</span>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{detail.frequency} orders</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Avg Order Value</span>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>&pound;{detail.average_order_value.toFixed(2)}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Unique Products</span>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{detail.unique_products} items</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Customer Lifetime</span>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{detail.customer_lifetime_days} days</div>
              </div>
            </div>

            {/* Recent Transactions Table */}
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 12px 0', color: '#F8FAFC' }}>Recent Transaction History</h4>
              <div className="table-container" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--bg-card-border)', borderRadius: 8 }}>
                <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1E293B', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Invoice</th>
                      <th style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Date</th>
                      <th style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Description</th>
                      <th style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Qty</th>
                      <th style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Price</th>
                      <th style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--bg-card-border)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recent_transactions.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#F8FAFC', fontSize: '0.85rem' }}>{tx.invoice}</td>
                        <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '0.85rem' }}>{tx.invoice_date}</td>
                        <td style={{ padding: '12px 16px', color: '#F8FAFC', fontSize: '0.85rem' }}>{tx.description}</td>
                        <td style={{ padding: '12px 16px', color: '#F8FAFC', fontSize: '0.85rem' }}>{tx.quantity}</td>
                        <td style={{ padding: '12px 16px', color: '#F8FAFC', fontSize: '0.85rem' }}>&pound;{tx.price.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: tx.is_cancelled ? '#EF4444' : '#10B981', fontSize: '0.85rem' }}>
                          &pound;{tx.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
