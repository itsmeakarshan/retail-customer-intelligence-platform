import React from 'react';
import { CheckCircle, Database, FileText, Trash2, Filter, XCircle, Users } from 'lucide-react';

export const DataQualityPage: React.FC = () => {
  const stats = [
    { title: "Raw Row Count", val: "1,067,371", desc: "UCI Online Retail dataset", icon: Database, color: "var(--text-main)" },
    { title: "Cleaned Transactions", val: "797,815", desc: "Filtered & validated rows", icon: FileText, color: "var(--color-emerald)" },
    { title: "Removed Duplicates", val: "26,479", desc: "Exact identical transactions", icon: Trash2, color: "var(--color-amber)" },
    { title: "Filtered Missing IDs", val: "243,007", desc: "22.77% unassigned transactions", icon: Filter, color: "var(--color-amber)" },
    { title: "Cancelled Invoices", val: "18,390", desc: "Invoices starting with 'C'", icon: XCircle, color: "var(--color-rose)" },
    { title: "Unique Customers", val: "5,939", desc: "Distinct customer IDs", icon: Users, color: "var(--primary-accent)" }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>Data Quality &amp; Pipeline Governance</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Reproducible ETL data pipeline audit trail &amp; transformation logs.
        </p>
      </div>

      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="glass-card kpi-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="kpi-header" style={{ marginBottom: '12px' }}>
                <span className="kpi-title">{s.title}</span>
                <Icon size={20} color={s.color} />
              </div>
              <div className="kpi-value" style={{ color: s.color, marginBottom: '8px' }}>{s.val}</div>
              <div className="kpi-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{s.desc}</div>
            </div>
          )
        })}
      </div>

      <div className="glass-card" style={{ padding: 32 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-main)' }}>
          <CheckCircle size={24} color="var(--color-emerald)" /> Data Cleaning &amp; Validation Protocol
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
          {/* Timeline connecting line */}
          <div style={{ position: 'absolute', left: 16, top: 20, bottom: 20, width: 2, background: 'rgba(255,255,255,0.1)' }}></div>
          
          <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, zIndex: 2, color: 'var(--text-main)' }}>1</div>
            <div style={{ flex: 1, padding: 16, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px solid var(--bg-card-border)' }}>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>Raw Data Preservation</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>Raw CSV <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>data/raw/online_retail_II.csv</code> remains strictly untouched.</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--color-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, zIndex: 2, color: 'var(--color-amber)' }}>2</div>
            <div style={{ flex: 1, padding: 16, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px solid var(--bg-card-border)' }}>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>Missing Customer ID Handling</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>243,007 transactions without a registered <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>Customer ID</code> were filtered from customer-level ML pipelines to prevent distorted entity profiles.</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--color-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, zIndex: 2, color: 'var(--color-rose)' }}>3</div>
            <div style={{ flex: 1, padding: 16, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px solid var(--bg-card-border)' }}>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>Order Cancellations &amp; Returns</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>Invoices starting with 'C' (18,390 records) are isolated to calculate <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>cancellation_rate</code> and <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>cancelled_revenue</code> features without skewing positive purchase monetary values.</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, zIndex: 2, color: 'var(--primary-accent)' }}>4</div>
            <div style={{ flex: 1, padding: 16, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px solid var(--bg-card-border)' }}>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>Non-Positive Price Filtering</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>5 negative prices and 6,202 zero-unit-price promotional entries filtered out for monetary feature accuracy.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Enrichment Disclosure Card */}
      <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid #818CF8', background: 'rgba(99, 102, 241, 0.05)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🧪 Demo Enrichment &amp; Synthetic Metadata Disclosure
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
          The original UCI Online Retail II transaction dataset does not contain customer contact details or product expiry dates. 
          To demonstrate end-to-end customer targeting, retention campaigns, and inventory expiry intelligence, 
          the platform maintains strictly separated synthetic metadata in <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: '#A5B4FC' }}>customer_demo_metadata</code> and <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: '#A5B4FC' }}>product_demo_metadata</code>.
          <br /><br />
          <strong>Customer email addresses are synthetic demo data and are not real customer contact details.</strong>
          <br /><br />
          <strong>Strict ML Isolation Guarantee:</strong> Synthetic metadata is used exclusively for demonstration workflows and is <strong>never</strong> fed into the machine learning feature pipeline or model training process.
        </p>
      </div>
    </div>
  );
};
