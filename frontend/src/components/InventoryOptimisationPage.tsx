import React, { useEffect, useState } from 'react';
import {
  fetchInventorySummary,
  fetchInventoryRecommendations,
  simulateInventory,
  getInventoryDownloadURL
} from '../services/api';
import type {
  InventorySummary,
  InventoryItem,
  InventorySimulationResult
} from '../services/api';
import {
  Boxes,
  AlertTriangle,
  RefreshCw,
  Search,
  Download,
  Sliders,
  ShieldAlert,
  Info,
  Layers
} from 'lucide-react';

interface InventoryOptimisationPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const InventoryOptimisationPage: React.FC<InventoryOptimisationPageProps> = ({
  activeDashboardId = 'default'
}) => {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Simulator state
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');
  const [simStock, setSimStock] = useState<number>(200);
  const [simLeadTime, setSimLeadTime] = useState<number>(7);
  const [simServiceLevel, setSimServiceLevel] = useState<number>(0.95);
  const [simHoldingPct] = useState<number>(0.20);
  const [simResult, setSimResult] = useState<InventorySimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumRes, itemsRes] = await Promise.all([
          fetchInventorySummary(activeDashboardId),
          fetchInventoryRecommendations({ dashboard_id: activeDashboardId, limit: 120 })
        ]);
        setSummary(sumRes);
        setItems(itemsRes);

        if (itemsRes.length > 0) {
          const first = itemsRes[0];
          setSelectedStockCode(first.stock_code);
          setSimStock(first.current_stock);
          setSimLeadTime(first.lead_time_days);
          setSimServiceLevel(first.service_level);
          runSimulation(first.stock_code, first.current_stock, first.lead_time_days, first.service_level, 0.20);
        }
      } catch (err) {
        console.error("Failed to load inventory data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  async function runSimulation(code: string, stock: number, lt: number, sl: number, hp: number) {
    setSimLoading(true);
    try {
      const res = await simulateInventory(
        {
          stock_code: code,
          current_stock: stock,
          lead_time_days: lt,
          service_level: sl,
          holding_cost_pct: hp
        },
        activeDashboardId
      );
      setSimResult(res);
    } catch (err) {
      console.error("Inventory simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  }

  const handleSelectItem = (item: InventoryItem) => {
    setSelectedStockCode(item.stock_code);
    setSimStock(item.current_stock);
    setSimLeadTime(item.lead_time_days);
    setSimServiceLevel(item.service_level);
    runSimulation(item.stock_code, item.current_stock, item.lead_time_days, item.service_level, simHoldingPct);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.stock_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'replenishment') return item.status === 'Replenishment Needed';
    if (statusFilter === 'excess') return item.status === 'Excess Stock';
    if (statusFilter === 'healthy') return item.status === 'Healthy';
    if (statusFilter === 'expiring') return Boolean(item.expiry_risk_alert);
    return true;
  });

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
        Loading Inventory Optimisation Engine...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
              <Boxes size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #F8FAFC)' }}>
              Inventory Optimisation & Replenishment
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            Calculates safety stock, lead time uncertainty, and suggested order quantities powered by demand forecasts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href={getInventoryDownloadURL(activeDashboardId)}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#6EE7B7',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <Download size={16} />
            Download Recommendations CSV
          </a>
        </div>
      </div>

      {/* Scenario Transparency Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          fontSize: '0.82rem',
          color: '#93C5FD'
        }}
      >
        <Info size={18} color="#60A5FA" style={{ flexShrink: 0 }} />
        <div>
          <strong>Business Scenario Transparency:</strong> The historical transaction dataset does not record physical warehouse inventory or supplier lead times. Current stock and lead times are treated as <em>Scenario Simulation Inputs</em> for replenishment planning.
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
            Target Service Level: {(summary?.default_service_level ? summary.default_service_level * 100 : 95)}%
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Replenishment Needed</span>
            <AlertTriangle size={20} color="#F43F5E" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#F43F5E' }}>
            {summary?.replenishment_needed_count || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#F43F5E', marginTop: '6px' }}>
            Stock at or below Reorder Point
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Suggested Units to Order</span>
            <RefreshCw size={20} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#38BDF8' }}>
            {(summary?.total_suggested_order_units || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            Est. Cost: £{(summary?.total_suggested_order_cost || 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>High Expiry Waste Risk</span>
            <ShieldAlert size={20} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#F59E0B' }}>
            {summary?.high_expiry_risk_count || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '6px' }}>
            Stock exceeds demand before expiry
          </div>
        </div>
      </div>

      {/* Interactive Scenario Simulator Panel */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={20} color="#818CF8" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Interactive Inventory Scenario Simulator
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>
                Selected Product:
              </label>
              <select
                value={selectedStockCode}
                onChange={(e) => {
                  const it = items.find(i => i.stock_code === e.target.value);
                  if (it) handleSelectItem(it);
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
                {items.map(it => (
                  <option key={it.stock_code} value={it.stock_code} style={{ background: '#0F172A' }}>
                    {it.stock_code} — {it.description} (£{it.unit_price.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                <span>Scenario Current Stock:</span>
                <strong style={{ color: '#F8FAFC' }}>{simStock} units</strong>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="50"
                value={simStock}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimStock(val);
                  runSimulation(selectedStockCode, val, simLeadTime, simServiceLevel, simHoldingPct);
                }}
                style={{ width: '100%', marginTop: '6px', accentColor: '#818CF8' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                <span>Supplier Lead Time:</span>
                <strong style={{ color: '#F8FAFC' }}>{simLeadTime} days</strong>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={simLeadTime}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimLeadTime(val);
                  runSimulation(selectedStockCode, simStock, val, simServiceLevel, simHoldingPct);
                }}
                style={{ width: '100%', marginTop: '6px', accentColor: '#818CF8' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                <span>Target Service Level:</span>
                <strong style={{ color: '#F8FAFC' }}>{(simServiceLevel * 100).toFixed(0)}%</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                {[0.90, 0.95, 0.98, 0.99].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setSimServiceLevel(lvl);
                      runSimulation(selectedStockCode, simStock, simLeadTime, lvl, simHoldingPct);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: '6px',
                      border: simServiceLevel === lvl ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.1)',
                      background: simServiceLevel === lvl ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.03)',
                      color: simServiceLevel === lvl ? '#F8FAFC' : 'var(--text-muted, #94A3B8)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {(lvl * 100).toFixed(0)}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Simulation Output Card */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#818CF8', fontWeight: 600, textTransform: 'uppercase' }}>
                  Scenario Recommendation {simLoading ? '(Calculating...)' : ''}
                </span>
                <span style={{ fontSize: '1rem' }}>{simResult?.status_emoji}</span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#38BDF8' }}>
                Suggested Order: {simResult?.suggested_order.toLocaleString() || 0} units
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                {simResult?.reason}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Expected 30d Demand</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>
                  {Math.round(simResult?.expected_30d_demand || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Lead Time Demand</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>
                  {Math.round(simResult?.lead_time_demand || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Safety Stock (z·σ_LT)</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#A5B4FC' }}>
                  {simResult?.safety_stock || 0} units
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Reorder Point (ROP)</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F43F5E' }}>
                  {simResult?.reorder_point || 0} units
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Recommendations Table */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              Product Replenishment & Stock Optimization Catalog
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
              Click any product row to populate the Scenario Simulator above.
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <option value="all" style={{ background: '#0F172A' }}>All Inventory Statuses</option>
              <option value="replenishment" style={{ background: '#0F172A' }}>🔴 Replenishment Needed</option>
              <option value="healthy" style={{ background: '#0F172A' }}>🟢 Healthy Stock</option>
              <option value="excess" style={{ background: '#0F172A' }}>🟡 Excess Stock</option>
              <option value="expiring" style={{ background: '#0F172A' }}>⚠️ High Expiry Risk</option>
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
                <th style={{ padding: '12px 8px' }}>30d Forecast</th>
                <th style={{ padding: '12px 8px' }}>Scenario Stock</th>
                <th style={{ padding: '12px 8px' }}>Safety Stock</th>
                <th style={{ padding: '12px 8px' }}>Reorder Point</th>
                <th style={{ padding: '12px 8px' }}>Suggested Order</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Reason & Expiry Alert</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 40).map((it) => {
                const isSelected = it.stock_code === selectedStockCode;
                return (
                  <tr
                    key={it.stock_code}
                    onClick={() => handleSelectItem(it)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#10B981' }}>{it.stock_code}</td>
                    <td style={{ padding: '12px 8px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#F8FAFC' }}>
                      {it.description}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#38BDF8' }}>{Math.round(it.expected_30d_demand).toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', color: '#F8FAFC' }}>{it.current_stock.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', color: '#A5B4FC' }}>{it.safety_stock}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: '#F43F5E' }}>{it.reorder_point}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: it.suggested_order > 0 ? '#38BDF8' : 'var(--text-muted, #94A3B8)' }}>
                      {it.suggested_order > 0 ? it.suggested_order.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: it.status === 'Replenishment Needed' ? 'rgba(244, 63, 94, 0.15)' : (it.status === 'Excess Stock' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                          color: it.status === 'Replenishment Needed' ? '#F43F5E' : (it.status === 'Excess Stock' ? '#F59E0B' : '#10B981')
                        }}
                      >
                        {it.status_emoji} {it.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', maxWidth: '280px' }}>
                      {it.expiry_risk_alert ? (
                        <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                          {it.expiry_risk_alert.recommendation}
                        </span>
                      ) : (
                        it.reason
                      )}
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
