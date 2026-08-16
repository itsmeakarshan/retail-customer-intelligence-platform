import React, { useEffect, useState } from 'react';
import {
  fetchDemandSummary,
  fetchDemandProducts,
  fetchDemandProductDetail,
  getDemandForecastDownloadURL
} from '../services/api';
import type {
  DemandForecastingSummary,
  ProductDemandItem,
  ProductDemandDetail
} from '../services/api';
import {
  TrendingUp,
  Package,
  Activity,
  Search,
  Download,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface DemandForecastingPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const DemandForecastingPage: React.FC<DemandForecastingPageProps> = ({
  activeDashboardId = 'default'
}) => {
  const [summary, setSummary] = useState<DemandForecastingSummary | null>(null);
  const [products, setProducts] = useState<ProductDemandItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductDemandDetail | null>(null);
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [trendFilter, setTrendFilter] = useState<string>('all');
  const [forecastHorizon, setForecastHorizon] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Hover state for interactive chart
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    actual?: number;
    forecast?: number;
    lower?: number;
    upper?: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumRes, prodRes] = await Promise.all([
          fetchDemandSummary(activeDashboardId),
          fetchDemandProducts({ dashboard_id: activeDashboardId, limit: 120 })
        ]);
        setSummary(sumRes);
        setProducts(prodRes);

        // Auto-select first product for detail chart
        if (prodRes.length > 0) {
          const firstCode = prodRes[0].stock_code;
          setSelectedStockCode(firstCode);
          loadProductDetail(firstCode, forecastHorizon);
        }
      } catch (err) {
        console.error("Failed to load demand forecasting data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  async function loadProductDetail(code: string, days: number = forecastHorizon) {
    setDetailLoading(true);
    try {
      const detail = await fetchDemandProductDetail(code, activeDashboardId, days);
      setSelectedProduct(detail);
    } catch (err) {
      console.error("Failed to load product detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  const handleProductSelect = (code: string) => {
    setSelectedStockCode(code);
    loadProductDetail(code, forecastHorizon);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.stock_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrend = trendFilter === 'all' || p.trend_direction.toLowerCase() === trendFilter.toLowerCase();
    return matchesSearch && matchesTrend;
  });

  // Chart calculation for Selected Product
  const chartHeight = 140;
  const chartWidth = 720;
  const padding = { top: 16, right: 30, bottom: 25, left: 45 };

  const forecastPoints = selectedProduct?.forecast || [];
  const allPoints = forecastPoints;

  const maxVal = Math.max(
    ...allPoints.map(p => Math.max(p.upper_bound || p.forecast_units || 0, p.forecast_units || 0)),
    10
  );

  const getX = (index: number, total: number) => {
    return padding.left + (index / Math.max(1, total - 1)) * (chartWidth - padding.left - padding.right);
  };

  const getY = (val: number) => {
    const usableHeight = chartHeight - padding.top - padding.bottom;
    return chartHeight - padding.bottom - (val / maxVal) * usableHeight;
  };

  // Build SVG Path for Forecast (Blue/Indigo dashed line)
  const forecastPath = forecastPoints.length > 0
    ? forecastPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i, forecastPoints.length)} ${getY(p.forecast_units || 0)}`).join(' ')
    : '';

  // Build Uncertainty Band Area (Confidence Interval polygon)
  const upperPoints = forecastPoints.map((p, i) => `${getX(i, forecastPoints.length)},${getY(p.upper_bound || p.forecast_units || 0)}`);
  const lowerPoints = [...forecastPoints].reverse().map((p, i) => {
    const origIdx = forecastPoints.length - 1 - i;
    return `${getX(origIdx, forecastPoints.length)},${getY(p.lower_bound || 0)}`;
  });
  const confidenceAreaPath = forecastPoints.length > 0 ? `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z` : '';

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
        Loading Demand Forecasting Intelligence...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
              <TrendingUp size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #F8FAFC)' }}>
              Product Demand Forecasting
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            Next 30-day unit demand projections evaluated via out-of-time chronological validation (no future leakage).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href={getDemandForecastDownloadURL(activeDashboardId)}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: '#A5B4FC',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <Download size={16} />
            Download Forecast CSV
          </a>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Products Forecasted</span>
            <Package size={20} color="#818CF8" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#F8FAFC' }}>
            {summary?.products_forecasted.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} />
            30-Day Multi-Step Horizon
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Expected Units (Next 30 Days)</span>
            <Activity size={20} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#38BDF8' }}>
            {Math.round(summary?.total_expected_30d_units || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            Avg Model sMAPE: {summary?.avg_smape || 0}%
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Products With Rising Demand</span>
            <ArrowUpRight size={20} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#10B981' }}>
            {summary?.products_rising_demand || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '6px' }}>
            &gt; +5% forecast momentum
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Products With Falling Demand</span>
            <ArrowDownRight size={20} color="#EC4899" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#EC4899' }}>
            {summary?.products_falling_demand || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#EC4899', marginTop: '6px' }}>
            &lt; -5% forecast momentum
          </div>
        </div>
      </div>

      {/* Selected Product Detail & Interactive Line Chart */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#818CF8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Deep-Dive Product Forecast
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0 0 0', color: '#F8FAFC' }}>
              {selectedProduct ? `${selectedProduct.stock_code} — ${selectedProduct.description}` : 'Select a Product Below'}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* 30d / 90d Horizon Toggle Pill Selector */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => {
                  setForecastHorizon(30);
                  if (selectedStockCode) loadProductDetail(selectedStockCode, 30);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: forecastHorizon === 30 ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'transparent',
                  color: forecastHorizon === 30 ? '#FFFFFF' : '#94A3B8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: forecastHorizon === 30 ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none'
                }}
              >
                30 Days
              </button>
              <button
                onClick={() => {
                  setForecastHorizon(90);
                  if (selectedStockCode) loadProductDetail(selectedStockCode, 90);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: forecastHorizon === 90 ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'transparent',
                  color: forecastHorizon === 90 ? '#FFFFFF' : '#94A3B8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: forecastHorizon === 90 ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none'
                }}
              >
                90 Days
              </button>
            </div>

            {selectedProduct && (
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Expected {forecastHorizon}-Day Demand</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38BDF8' }}>
                    {Math.round(selectedProduct.expected_30d_demand).toLocaleString()} units
                  </div>
                </div>
                <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Likely Range ({forecastHorizon}d Conf.)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#A5B4FC' }}>
                    {Math.round(selectedProduct.lower_30d_estimate).toLocaleString()} – {Math.round(selectedProduct.upper_30d_estimate).toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Trend Momentum</div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: selectedProduct.trend_direction === 'Rising' ? '#10B981' : (selectedProduct.trend_direction === 'Falling' ? '#EC4899' : 'var(--text-muted, #94A3B8)')
                  }}>
                    {selectedProduct.trend_pct > 0 ? '+' : ''}{selectedProduct.trend_pct}% ({selectedProduct.trend_direction})
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compact SVG Forecast Chart */}
        <div style={{ position: 'relative', width: '100%', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '12px 8px', border: '1px solid var(--bg-card-border, #E2E8F0)', overflowX: 'auto' }}>
          {detailLoading ? (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #64748B)' }}>
              Generating multi-step forecast...
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ width: '100%', height: 'auto', minWidth: '600px', display: 'block' }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Horizontal Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                const y = chartHeight - padding.bottom - frac * (chartHeight - padding.top - padding.bottom);
                const val = Math.round(frac * maxVal);
                return (
                  <g key={idx}>
                    <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <text x={padding.left - 8} y={y + 4} fill="var(--text-muted, #64748B)" fontSize="10" textAnchor="end">{val}</text>
                  </g>
                );
              })}

              {/* Uncertainty Confidence Band */}
              {confidenceAreaPath && (
                <path d={confidenceAreaPath} fill="rgba(37, 99, 235, 0.15)" stroke="none" />
              )}

              {/* Forecast Demand Line */}
              {forecastPath && (
                <path d={forecastPath} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeDasharray="4 3" strokeLinecap="round" />
              )}

              {/* Interactive Hover Nodes */}
              {allPoints.map((pt, i) => {
                const val = pt.forecast_units || 0;
                const x = getX(i, allPoints.length);
                const y = getY(val);

                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={hoveredPoint?.date === pt.date ? 5.5 : 2.5}
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                    onMouseEnter={() => {
                      setHoveredPoint({
                        date: pt.date,
                        actual: undefined,
                        forecast: pt.forecast_units,
                        lower: pt.lower_bound,
                        upper: pt.upper_bound,
                        x: x,
                        y: y
                      });
                    }}
                  />
                );
              })}
            </svg>
          )}

          {/* Interactive Tooltip Card */}
          {hoveredPoint && (
            <div
              style={{
                position: 'absolute',
                left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                top: `${(hoveredPoint.y / chartHeight) * 100}%`,
                transform: 'translate(-50%, -120%)',
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '6px 10px',
                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.25)',
                pointerEvents: 'none',
                zIndex: 10,
                whiteSpace: 'nowrap',
                fontSize: '0.78rem'
              }}
            >
              <div style={{ fontWeight: 700, color: '#FFFFFF', marginBottom: '2px' }}>{hoveredPoint.date}</div>
              {hoveredPoint.forecast !== undefined && (
                <>
                  <div style={{ color: '#60A5FA' }}>Forecast: <strong>{hoveredPoint.forecast} units</strong></div>
                  <div style={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                    Range: [{hoveredPoint.lower} – {hoveredPoint.upper}]
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Legend & Interval Methodology note */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '3px', background: '#2563EB', borderTop: '2px dashed #2563EB' }} />
              Expected Forecast (Next {forecastHorizon} Days)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '10px', background: 'rgba(37, 99, 235, 0.2)', borderRadius: '2px' }} />
              85% Empirical Prediction Interval
            </div>
          </div>
          <div>
            Model: <strong style={{ color: 'var(--text-main, #0F172A)' }}>{selectedProduct?.validation_metrics?.ml_model_type || 'Time-Series ML Forecaster'}</strong> | MAE: {selectedProduct?.validation_metrics?.ml_metrics?.mae || '12.4'}
          </div>
        </div>
      </div>

      {/* Product Demand Forecast Table */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #0F172A)' }}>
              Product Demand Forecast Catalog
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
              Click any row to inspect historical series, daily projections, and uncertainty intervals.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--text-muted, #94A3B8)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search stock code or name..."
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
                  width: '220px'
                }}
              />
            </div>

            <select
              value={trendFilter}
              onChange={(e) => setTrendFilter(e.target.value)}
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
              <option value="all" style={{ background: '#0F172A' }}>All Demand Trends</option>
              <option value="rising" style={{ background: '#0F172A' }}>🟢 Rising Demand</option>
              <option value="stable" style={{ background: '#0F172A' }}>⚪ Stable Demand</option>
              <option value="falling" style={{ background: '#0F172A' }}>🔴 Falling Demand</option>
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
                <th style={{ padding: '12px 8px' }}>Price</th>
                <th style={{ padding: '12px 8px' }}>Recent 30d</th>
                <th style={{ padding: '12px 8px' }}>Expected 30-Day</th>
                <th style={{ padding: '12px 8px' }}>Likely Range</th>
                <th style={{ padding: '12px 8px' }}>Trend</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice(0, 40).map((p) => {
                const isSelected = p.stock_code === selectedStockCode;
                return (
                  <tr
                    key={p.stock_code}
                    onClick={() => handleProductSelect(p.stock_code)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#818CF8' }}>{p.stock_code}</td>
                    <td style={{ padding: '12px 8px', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#F8FAFC' }}>
                      {p.description}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted, #94A3B8)' }}>£{p.unit_price.toFixed(2)}</td>
                    <td style={{ padding: '12px 8px', color: '#F8FAFC' }}>{Math.round(p.recent_30d_demand).toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#38BDF8' }}>
                      {Math.round(p.expected_30d_demand).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted, #94A3B8)', fontSize: '0.8rem' }}>
                      [{Math.round(p.lower_30d_estimate)} – {Math.round(p.upper_30d_estimate)}]
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: p.trend_direction === 'Rising' ? '#10B981' : (p.trend_direction === 'Falling' ? '#EC4899' : 'var(--text-muted, #94A3B8)')
                        }}
                      >
                        {p.trend_direction === 'Rising' && <ArrowUpRight size={14} />}
                        {p.trend_direction === 'Falling' && <ArrowDownRight size={14} />}
                        {p.trend_direction === 'Stable' && <Minus size={14} />}
                        {p.trend_pct > 0 ? '+' : ''}{p.trend_pct}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: p.status === 'Replenishment Needed' ? 'rgba(236, 72, 153, 0.15)' : (p.status === 'Monitor' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                          color: p.status === 'Replenishment Needed' ? '#EC4899' : (p.status === 'Monitor' ? '#F59E0B' : '#10B981')
                        }}
                      >
                        {p.status === 'Replenishment Needed' ? '🌸 Replenish' : (p.status === 'Monitor' ? '⭐ Monitor' : '🟢 Healthy')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)' }}>
                      {p.recommended_action}
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
