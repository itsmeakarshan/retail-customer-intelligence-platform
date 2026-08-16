import React, { useEffect, useState } from 'react';
import {
  fetchDataQualitySummary,
  getDataQualityDownloadURL
} from '../services/api';
import type {
  DataQualitySummary
} from '../services/api';
import {
  Database,
  CheckCircle2,
  Filter,
  Trash2,
  XCircle,
  Users,
  Download,
  Cpu,
  Info,
  Check
} from 'lucide-react';

interface DataQualityPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const DataQualityPage: React.FC<DataQualityPageProps> = ({
  activeDashboardId = 'default'
}) => {
  const [data, setData] = useState<DataQualitySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetchDataQualitySummary(activeDashboardId);
        setData(res);
      } catch (err) {
        console.error("Failed to load data quality summary:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
        Auditing transaction database completeness, column validity, and ETL transformations...
      </div>
    );
  }

  const columnAudits = data?.column_audits || [];
  const etlSteps = data?.etl_pipeline_steps || [];
  const coverage = data?.product_coverage;
  const mlImpacts = data?.ml_impacts || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header & Export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
              <Database size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #F8FAFC)' }}>
              Data Quality &amp; Pipeline Governance Audit
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            Empirical dataset validation, column-level completeness, deduplication audit, and machine learning pipeline impact.
          </p>
        </div>

        <a
          href={getDataQualityDownloadURL(activeDashboardId)}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#A7F3D0',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
            cursor: 'pointer'
          }}
        >
          <Download size={16} />
          Download Data Quality Audit (CSV)
        </a>
      </div>

      {/* Top 6 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div className="glass-card" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)' }}>Raw Ingested Rows</span>
            <Database size={18} color="#94A3B8" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#F8FAFC' }}>
            {data?.raw_dataset_rows.toLocaleString() || '1,067,371'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
            Original raw transactions
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)' }}>Clean Transactions</span>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#10B981' }}>
            {data?.clean_dataset_rows.toLocaleString() || '797,815'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
            {data?.positive_sales_rows.toLocaleString() || '779,425'} positive + 18,390 returns
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)' }}>Cancellation Rate</span>
            <XCircle size={18} color="#EC4899" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#EC4899' }}>
            {data?.cancellation_rate_pct.toFixed(2)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
            {data?.cancelled_rows.toLocaleString() || '18,390'} return transactions
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)' }}>Filtered Guest Records</span>
            <Filter size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#F59E0B' }}>
            243,007
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
            22.77% unassigned Customer IDs
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)' }}>Removed Duplicates</span>
            <Trash2 size={18} color="#818CF8" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#818CF8' }}>
            26,479
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
            Exact POS double-scans
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)' }}>Unique Customers</span>
            <Users size={18} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#38BDF8' }}>
            {data?.unique_customers_count.toLocaleString() || '5,939'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
            5,878 active in ML scoring
          </div>
        </div>
      </div>

      {/* SECTION 1: COLUMN-LEVEL DATA QUALITY AUDIT TABLE */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Dataset Column-Level Completeness &amp; Validity Audit
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
            Verification across all 8 canonical transaction attributes in the cleaned database.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted, #94A3B8)' }}>
                <th style={{ padding: '10px 8px' }}>Column Name</th>
                <th style={{ padding: '10px 8px' }}>Data Type</th>
                <th style={{ padding: '10px 8px' }}>Total Records</th>
                <th style={{ padding: '10px 8px' }}>Valid Records</th>
                <th style={{ padding: '10px 8px' }}>Missing (%)</th>
                <th style={{ padding: '10px 8px' }}>Unique Count</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Audit Observation</th>
              </tr>
            </thead>
            <tbody>
              {columnAudits.map((col) => (
                <tr key={col.column_name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: '#38BDF8' }}>
                    {col.column_name}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-muted, #94A3B8)', fontSize: '0.78rem' }}>
                    {col.data_type}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#F8FAFC' }}>
                    {col.total_records.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#10B981', fontWeight: 600 }}>
                    {col.valid_records.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 8px', color: col.missing_percentage === 0 ? '#10B981' : '#F59E0B' }}>
                    {col.missing_percentage.toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px 8px', color: '#F8FAFC' }}>
                    {col.unique_count.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> {col.validity_status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)' }}>
                    {col.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: PRODUCT COVERAGE & MODELING ELIGIBILITY BREAKDOWN */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Product Catalog Coverage &amp; Modeling Eligibility Breakdown
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
            Transparent explanation of why products qualify for or are excluded from specific predictive models.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 700 }}>ML Demand Forecaster Eligible</span>
              <span style={{ fontSize: '0.75rem', color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                {coverage?.eligible_percentage.toFixed(1)}% of Catalog
              </span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10B981', marginTop: '6px' }}>
              {coverage?.eligible_products_count.toLocaleString()} Products
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px', lineHeight: '1.4', margin: 0 }}>
              Products with at least 5 recorded transaction orders across the 2-year history. Sufficient volume to train autoregressive lag features.
            </p>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#F59E0B', fontWeight: 700 }}>Excluded from Deep Demand ML</span>
              <span style={{ fontSize: '0.75rem', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                {coverage?.excluded_percentage.toFixed(1)}% of Catalog
              </span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F59E0B', marginTop: '6px' }}>
              {coverage?.excluded_products_count.toLocaleString()} Products
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px', lineHeight: '1.4', margin: 0 }}>
              {coverage?.excluded_reason}
            </p>
          </div>

          <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#38BDF8', fontWeight: 700 }}>Statistically Verified Elasticity</span>
              <span style={{ fontSize: '0.75rem', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                {coverage?.multi_price_percentage.toFixed(1)}% of Catalog
              </span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38BDF8', marginTop: '6px' }}>
              {coverage?.multi_price_elastic_products.toLocaleString()} Products
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px', lineHeight: '1.4', margin: 0 }}>
              Products with genuine multi-tier price variation ($N \ge 20$, distinct prices $\ge 2$, $p \le 0.10$). Valid for mathematical price optimisation.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#F8FAFC', fontWeight: 700 }}>Fixed Shelf Price Items</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                {coverage?.fixed_price_percentage.toFixed(1)}% of Catalog
              </span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F8FAFC', marginTop: '6px' }}>
              {coverage?.fixed_price_products.toLocaleString()} Products
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px', lineHeight: '1.4', margin: 0 }}>
              Sold at a single constant shelf price throughout historical transactions. Historical baseline pricing is displayed without fabricated elasticity.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: ETL PIPELINE PROTOCOL & AUDIT TRAIL */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Reproducible ETL Data Pipeline Audit Trail
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
            Sequential filtering rules applied during ingestion from raw CSV to cleaned relational database.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {etlSteps.map((step) => (
            <div
              key={step.step_number}
              style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid #818CF8',
                  color: '#C7D2FE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}
              >
                {step.step_number}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.95rem' }}>
                    {step.step_title}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted, #94A3B8)' }}>
                      Input: {step.input_count.toLocaleString()} &rarr; Output: {step.output_count.toLocaleString()}
                    </span>
                    {step.filtered_count > 0 && (
                      <span style={{ color: '#F59E0B', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        -{step.filtered_count.toLocaleString()} filtered
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '2px' }}>
                  <strong>Rule:</strong> {step.rule_description}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', fontStyle: 'italic' }}>
                  <strong>Business Rationale:</strong> {step.business_rationale}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: DATA QUALITY IMPACT ON MACHINE LEARNING MODELS */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Data Quality &amp; Machine Learning Interdependence Matrix
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
            How specific dataset characteristics impact ML algorithms and downstream commercial decisions.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {mlImpacts.map((imp, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38BDF8', fontWeight: 700, fontSize: '0.95rem' }}>
                <Cpu size={16} />
                <span>{imp.ml_pipeline_name}</span>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)' }}>
                <strong style={{ color: '#FDE047' }}>Data Quality Risk:</strong> {imp.affected_by}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)' }}>
                <strong style={{ color: '#10B981' }}>Pipeline Mitigation:</strong> {imp.mitigation_applied}
              </div>

              <div style={{ fontSize: '0.78rem', color: '#CBD5E1', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ color: '#818CF8' }}>Business Decision Impact:</strong> {imp.decision_impact}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5: DEMO ENRICHMENT & SYNTHETIC METADATA DISCLOSURE */}
      <div className="glass-card" style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} color="#818CF8" />
          <span>Demo Metadata Isolation &amp; Privacy Disclosure</span>
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: '1.6', margin: 0 }}>
          The original Online Retail transaction dataset contains only transactional entities (Invoices, SKUs, Descriptions, Quantities, Timestamps, Prices, Customer IDs, and Countries). It does not contain customer email addresses or product expiry dates.<br /><br />
          To demonstrate end-to-end customer retention campaigns and inventory expiry workflows, synthetic demo metadata is maintained in strictly segregated tables (<code style={{ color: '#A5B4FC' }}>customer_demo_metadata</code> and <code style={{ color: '#A5B4FC' }}>product_demo_metadata</code>).<br /><br />
          <strong>Strict ML Isolation Guarantee:</strong> Synthetic metadata is never fed into machine learning feature matrices, model training routines, or econometric elasticity estimators.
        </p>
      </div>
    </div>
  );
};
