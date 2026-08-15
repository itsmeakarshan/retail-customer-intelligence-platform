import React, { useEffect, useState } from 'react';
import {
  fetchPricingSummary,
  fetchPriceElasticityProducts,
  simulatePriceScenario,
  getPriceElasticityDownloadURL
} from '../services/api';
import type {
  PricingSummary,
  PriceElasticityItem,
  PriceSimulationResult
} from '../services/api';
import {
  PoundSterling,
  TrendingUp,
  TrendingDown,
  Percent,
  Sliders,
  Search,
  Download,
  Info,
  Layers
} from 'lucide-react';

interface PriceAnalyticsPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const PriceAnalyticsPage: React.FC<PriceAnalyticsPageProps> = ({
  activeDashboardId = 'default'
}) => {
  const [summary, setSummary] = useState<PricingSummary | null>(null);
  const [products, setProducts] = useState<PriceElasticityItem[]>([]);
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Scenario Simulator state
  const [simPriceChange, setSimPriceChange] = useState<number>(-10.0);
  const [simUnitCost, setSimUnitCost] = useState<number | undefined>(undefined);
  const [simResult, setSimResult] = useState<PriceSimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumRes, prodsRes] = await Promise.all([
          fetchPricingSummary(activeDashboardId),
          fetchPriceElasticityProducts({ dashboard_id: activeDashboardId, limit: 120 })
        ]);
        setSummary(sumRes);
        setProducts(prodsRes);

        if (prodsRes.length > 0) {
          const first = prodsRes[0];
          setSelectedStockCode(first.stock_code);
          const defaultCost = Number((first.avg_price * 0.6).toFixed(2));
          setSimUnitCost(defaultCost);
          runSimulation(first.stock_code, -10.0, defaultCost);
        }
      } catch (err) {
        console.error("Failed to load price analytics data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  async function runSimulation(code: string, changePct: number, cost?: number) {
    setSimLoading(true);
    try {
      const res = await simulatePriceScenario(
        {
          stock_code: code,
          price_change_pct: changePct,
          scenario_unit_cost: cost
        },
        activeDashboardId
      );
      setSimResult(res);
    } catch (err) {
      console.error("Price simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  }

  const handleSelectProduct = (prod: PriceElasticityItem) => {
    setSelectedStockCode(prod.stock_code);
    const defaultCost = Number((prod.avg_price * 0.6).toFixed(2));
    setSimUnitCost(defaultCost);
    runSimulation(prod.stock_code, simPriceChange, defaultCost);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.stock_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'elastic') return p.category.includes('Elastic (');
    if (categoryFilter === 'inelastic') return p.category.includes('Inelastic (');
    if (categoryFilter === 'inconclusive') return p.category.includes('Inconclusive');
    if (categoryFilter === 'insufficient') return p.category.includes('Insufficient');
    return true;
  });

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
        Loading Price Analytics & Elasticity Engine...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.15)', color: '#EAB308' }}>
              <PoundSterling size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #F8FAFC)' }}>
              Price Analytics & Elasticity Engine
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            Econometric log-log price sensitivity estimations with seasonal controls and interactive scenario simulation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href={getPriceElasticityDownloadURL(activeDashboardId)}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.2)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              color: '#FDE047',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <Download size={16} />
            Download Price Elasticity CSV
          </a>
        </div>
      </div>

      {/* Scientific Honesty Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.2)',
          fontSize: '0.82rem',
          color: '#FEF08A'
        }}
      >
        <Info size={18} color="#EAB308" style={{ flexShrink: 0 }} />
        <div>
          <strong>Scientific Methodology Disclosure:</strong> Observational price elasticity is estimated via Log-Log Ordinary Least Squares (OLS) controlling for monthly seasonality and day-of-week effects. Results reflect statistical <em>association</em> in historical market transactions rather than randomized causal experiments.
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Products Analysed</span>
            <Layers size={20} color="#818CF8" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#F8FAFC' }}>
            {summary?.total_products_analysed || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            Min 15 tx &amp; multi-price variation
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Highly Elastic Products (β &lt; -1)</span>
            <TrendingDown size={20} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#38BDF8' }}>
            {summary?.elastic_products_count || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#38BDF8', marginTop: '6px' }}>
            Volume highly responsive to discounts
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Inelastic Products (-1 ≤ β ≤ 0)</span>
            <TrendingUp size={20} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#10B981' }}>
            {summary?.inelastic_products_count || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '6px' }}>
            Pricing power (margin expansion)
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Avg Elasticity (Elastic Catalog)</span>
            <Percent size={20} color="#EAB308" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#EAB308' }}>
            {summary?.avg_elasticity_elastic_items || -1.85}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            1% price drop ≈ {Math.abs(summary?.avg_elasticity_elastic_items || 1.85)}% volume surge
          </div>
        </div>
      </div>

      {/* Interactive Price Scenario Simulator */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={20} color="#EAB308" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Interactive Price Scenario Simulator (-20% to +20%)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>
                Selected Product:
              </label>
              <select
                value={selectedStockCode}
                onChange={(e) => {
                  const p = products.find(prod => prod.stock_code === e.target.value);
                  if (p) handleSelectProduct(p);
                }}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F8FAFC',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                {products.map(p => (
                  <option key={p.stock_code} value={p.stock_code} style={{ background: '#0F172A' }}>
                    {p.stock_code} — {p.description} (Avg: £{p.avg_price.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>
                <span>Price Adjustment (%):</span>
                <strong style={{ color: simPriceChange >= 0 ? '#10B981' : '#F43F5E', fontSize: '1.1rem' }}>
                  {simPriceChange > 0 ? '+' : ''}{simPriceChange}%
                </strong>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="1"
                value={simPriceChange}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimPriceChange(val);
                  runSimulation(selectedStockCode, val, simUnitCost);
                }}
                style={{ width: '100%', marginTop: '6px', accentColor: '#EAB308' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted, #64748B)' }}>
                <span>-20% Discount</span>
                <span>0% (Current)</span>
                <span>+20% Premium</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>
                Scenario Unit Cost (£) (Optional for Margin/Profit estimation):
              </label>
              <input
                type="number"
                step="0.10"
                min="0.01"
                value={simUnitCost || ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setSimUnitCost(val);
                  runSimulation(selectedStockCode, simPriceChange, val);
                }}
                placeholder="e.g. 1.20 (Scenario Unit Cost)"
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F8FAFC',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Simulation Output Card */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#EAB308', fontWeight: 600, textTransform: 'uppercase' }}>
                  Scenario Simulation Outcome {simLoading ? '(Calculating...)' : ''}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)' }}>
                  Elasticity β = {simResult?.elasticity_used || -1.25}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F8FAFC' }}>
                  £{simResult?.new_price.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>
                  (Current: £{simResult?.current_price.toFixed(2)})
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Expected Monthly Qty</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38BDF8' }}>
                  {Math.round(simResult?.expected_quantity || 0).toLocaleString()} units
                </div>
                <div style={{ fontSize: '0.7rem', color: (simResult?.quantity_change_pct || 0) >= 0 ? '#10B981' : '#F43F5E' }}>
                  {(simResult?.quantity_change_pct || 0) > 0 ? '+' : ''}{simResult?.quantity_change_pct}% volume
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Expected Monthly Revenue</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                  £{(simResult?.expected_revenue || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.7rem', color: (simResult?.revenue_difference || 0) >= 0 ? '#10B981' : '#F43F5E' }}>
                  {(simResult?.revenue_difference || 0) > 0 ? '+' : ''}£{(simResult?.revenue_difference || 0).toFixed(2)} ({(simResult?.revenue_diff_pct || 0)}%)
                </div>
              </div>

              {simResult?.scenario_profit !== null && simResult?.scenario_profit !== undefined && (
                <>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Scenario Monthly Profit</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981' }}>
                      £{(simResult.scenario_profit || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Profit Impact vs Baseline</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: (simResult.profit_difference || 0) >= 0 ? '#10B981' : '#F43F5E' }}>
                      {(simResult.profit_difference || 0) > 0 ? '+' : ''}£{(simResult.profit_difference || 0).toFixed(2)}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontStyle: 'italic' }}>
              * {simResult?.disclosure}
            </div>
          </div>
        </div>
      </div>

      {/* Price Elasticity Catalog Table */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              Product Price Elasticity & Sensitivity Catalog
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
              Evaluated with Log-Log Ordinary Least Squares, reporting standard errors, 95% confidence intervals, and p-values.
            </p>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--text-muted, #94A3B8)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search stock code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#F8FAFC',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: '#0F172A' }}>All Elasticity Categories</option>
              <option value="elastic" style={{ background: '#0F172A' }}>🟢 Highly Elastic (β &lt; -1)</option>
              <option value="inelastic" style={{ background: '#0F172A' }}>🔵 Inelastic (-1 ≤ β ≤ 0)</option>
              <option value="inconclusive" style={{ background: '#0F172A' }}>🟡 Inconclusive (p &gt; 0.10)</option>
              <option value="insufficient" style={{ background: '#0F172A' }}>⚪ Insufficient Variation</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted, #94A3B8)' }}>
                <th style={{ padding: '12px 8px' }}>Stock Code</th>
                <th style={{ padding: '12px 8px' }}>Description</th>
                <th style={{ padding: '12px 8px' }}>Avg Price</th>
                <th style={{ padding: '12px 8px' }}>Total Units</th>
                <th style={{ padding: '12px 8px' }}>Elasticity (β)</th>
                <th style={{ padding: '12px 8px' }}>95% CI</th>
                <th style={{ padding: '12px 8px' }}>p-value</th>
                <th style={{ padding: '12px 8px' }}>R²</th>
                <th style={{ padding: '12px 8px' }}>Category</th>
                <th style={{ padding: '12px 8px' }}>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice(0, 40).map((p) => {
                const isSelected = p.stock_code === selectedStockCode;
                const isElastic = p.category.includes('Elastic (');
                const isInelastic = p.category.includes('Inelastic (');

                return (
                  <tr
                    key={p.stock_code}
                    onClick={() => handleSelectProduct(p)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(234, 179, 8, 0.12)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#EAB308' }}>{p.stock_code}</td>
                    <td style={{ padding: '12px 8px', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#F8FAFC' }}>
                      {p.description}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#F8FAFC' }}>£{p.avg_price.toFixed(2)}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted, #94A3B8)' }}>{p.total_quantity.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: isElastic ? '#38BDF8' : (isInelastic ? '#10B981' : 'var(--text-muted, #94A3B8)') }}>
                      {p.elasticity !== null && p.elasticity !== undefined ? p.elasticity.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted, #94A3B8)', fontSize: '0.78rem' }}>
                      {p.ci_lower !== null && p.ci_upper !== null ? `[${p.ci_lower}, ${p.ci_upper}]` : '—'}
                    </td>
                    <td style={{ padding: '12px 8px', color: (p.p_value || 1.0) < 0.05 ? '#10B981' : 'var(--text-muted, #94A3B8)', fontSize: '0.8rem' }}>
                      {p.p_value !== null && p.p_value !== undefined ? p.p_value.toFixed(4) : '—'}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted, #94A3B8)', fontSize: '0.8rem' }}>
                      {p.r_squared !== null && p.r_squared !== undefined ? p.r_squared.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: isElastic ? 'rgba(56, 189, 248, 0.15)' : (isInelastic ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.06)'),
                          color: isElastic ? '#38BDF8' : (isInelastic ? '#10B981' : 'var(--text-muted, #94A3B8)')
                        }}
                      >
                        {p.category.split('(')[0].trim()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', maxWidth: '260px' }}>
                      {p.interpretation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
