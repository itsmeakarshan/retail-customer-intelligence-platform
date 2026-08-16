import React, { useEffect, useState } from 'react';
import {
  fetchInventorySummary,
  fetchInventoryRecommendations,
  simulateInventory,
  getInventoryExcelDownloadURL,
  emailInventoryReport
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
  Sliders,
  ShieldAlert,
  Layers,
  FileSpreadsheet,
  Mail,
  Send,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 50;

  // Production Standard: Fixed 95% Service Level (Z-score = 1.645 in standard normal distribution)
  // Provides 95% non-stockout cycle service level without exposing technical Z-scores to users.
  const DEFAULT_SERVICE_LEVEL = 0.95;

  // Simulator state
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');
  const [simProductSearch, setSimProductSearch] = useState<string>('');
  const [simStock, setSimStock] = useState<number>(200);
  const [simLeadTime, setSimLeadTime] = useState<number>(7);
  const [simHoldingPct] = useState<number>(0.20);
  const [simResult, setSimResult] = useState<InventorySimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const simSelectOptions = React.useMemo(() => {
    if (!simProductSearch.trim()) {
      const topItems = items.slice(0, 300);
      if (selectedStockCode && !topItems.some(i => i.stock_code === selectedStockCode)) {
        const current = items.find(i => i.stock_code === selectedStockCode);
        if (current) return [current, ...topItems];
      }
      return topItems;
    }
    const q = simProductSearch.toLowerCase();
    const matches = items.filter(
      i => i.stock_code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    ).slice(0, 300);
    if (selectedStockCode && !matches.some(i => i.stock_code === selectedStockCode)) {
      const current = items.find(i => i.stock_code === selectedStockCode);
      if (current) return [current, ...matches];
    }
    return matches;
  }, [items, simProductSearch, selectedStockCode]);

  // Email Report Modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailRecipient, setEmailRecipient] = useState<string>('akarshanrasyal4@gmail.com');
  const [emailSubject, setEmailSubject] = useState<string>('Retail Inventory Replenishment Report');
  const [emailMessage, setEmailMessage] = useState<string>(
    'Please find attached the latest inventory replenishment report, including forecast demand, stock requirements, reorder points and recommended order quantities.'
  );
  const [emailSending, setEmailSending] = useState<boolean>(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumRes, itemsRes] = await Promise.all([
          fetchInventorySummary(activeDashboardId),
          fetchInventoryRecommendations({ dashboard_id: activeDashboardId })
        ]);
        setSummary(sumRes);
        setItems(itemsRes);

        if (itemsRes.length > 0) {
          const first = itemsRes[0];
          setSelectedStockCode(first.stock_code);
          setSimStock(first.current_stock);
          setSimLeadTime(first.lead_time_days);
          runSimulation(first.stock_code, first.current_stock, first.lead_time_days, 0.20);
        }
      } catch (err) {
        console.error("Failed to load inventory data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  // Reset page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  async function runSimulation(code: string, stock: number, lt: number, hp: number) {
    setSimLoading(true);
    try {
      const res = await simulateInventory(
        {
          stock_code: code,
          current_stock: stock,
          lead_time_days: lt,
          service_level: DEFAULT_SERVICE_LEVEL,
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
    runSimulation(item.stock_code, item.current_stock, item.lead_time_days, simHoldingPct);
  };

  const handleSendEmailReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSending(true);
    setEmailStatusMessage(null);
    try {
      const res = await emailInventoryReport({
        recipient_email: emailRecipient,
        subject: emailSubject,
        message: emailMessage,
        dashboardId: activeDashboardId
      });
      setEmailStatusMessage({
        success: res.success,
        text: res.message || 'Report email processed successfully.'
      });
    } catch (err: any) {
      setEmailStatusMessage({
        success: false,
        text: err.message || 'Failed to dispatch report email.'
      });
    } finally {
      setEmailSending(false);
    }
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
    if (statusFilter === 'expiring') return Boolean(item.expiry_risk_alert && item.expiry_risk_alert.units_at_risk > 0);
    return true;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
        <RefreshCw size={32} className="spin-slow" style={{ margin: '0 auto 16px', color: '#818CF8' }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#F8FAFC' }}>
          Loading Full Retail Inventory Catalogue...
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '6px' }}>
          Analysing demand forecasts, lead times, and replenishment points across all products.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Excel / Email Actions */}
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

        {/* Action Buttons: Excel Export & Email Report */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href={getInventoryExcelDownloadURL(activeDashboardId)}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.25))',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              color: '#34D399',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.1)'
            }}
          >
            <FileSpreadsheet size={16} />
            Download Excel Report
          </a>

          <button
            onClick={() => setIsEmailModalOpen(true)}
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
              cursor: 'pointer'
            }}
          >
            <Mail size={16} />
            Email Stock Report
          </button>
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
            {summary?.products_analysed_display || `${(summary?.total_products_analysed || items.length).toLocaleString()} / ${(summary?.total_products_available || 4631).toLocaleString()}`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '6px' }}>
            {summary?.total_products_analysed?.toLocaleString() || items.length} eligible SKUs ({summary?.excluded_products_count || 268} insufficient history)
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)' }}>Replenishment Needed</span>
            <AlertTriangle size={20} color="#EC4899" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '8px', color: '#EC4899' }}>
            {summary?.replenishment_needed_count?.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#EC4899', marginTop: '6px' }}>
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
            {summary?.high_expiry_risk_count?.toLocaleString() || 0}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>
                  Selected Product:
                </label>
                <span style={{ fontSize: '0.72rem', color: '#818CF8' }}>
                  {items.length.toLocaleString()} SKUs available
                </span>
              </div>
              <input
                type="text"
                placeholder="Search SKU or name to select..."
                value={simProductSearch}
                onChange={(e) => setSimProductSearch(e.target.value)}
                style={{
                  width: '100%',
                  marginBottom: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F8FAFC',
                  fontSize: '0.78rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <select
                value={selectedStockCode}
                onChange={(e) => {
                  const it = items.find(i => i.stock_code === e.target.value);
                  if (it) handleSelectItem(it);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F8FAFC',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                {simSelectOptions.map(it => (
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
                  runSimulation(selectedStockCode, val, simLeadTime, simHoldingPct);
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
                  runSimulation(selectedStockCode, simStock, val, simHoldingPct);
                }}
                style={{ width: '100%', marginTop: '6px', accentColor: '#818CF8' }}
              />
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
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Safety Stock Buffer</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#A5B4FC' }}>
                  {simResult?.safety_stock || 0} units
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)' }}>Reorder Point (ROP)</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#EC4899' }}>
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
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #0F172A)' }}>
              Product Replenishment & Stock Optimization Catalog
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
              Showing {filteredItems.length.toLocaleString()} analysed eligible products. Click any row to populate the Scenario Simulator.
            </p>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--text-muted, #94A3B8)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search across all products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-main, #0F172A)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  width: '230px'
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
                color: 'var(--text-main, #0F172A)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: '#0F172A' }}>All Inventory Statuses ({items.length.toLocaleString()})</option>
              <option value="replenishment" style={{ background: '#0F172A' }}>🌸 Replenishment Needed</option>
              <option value="healthy" style={{ background: '#0F172A' }}>🟢 Healthy Stock</option>
              <option value="excess" style={{ background: '#0F172A' }}>⭐ Excess Stock</option>
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
              {paginatedItems.map((it) => {
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
                    <td style={{ padding: '12px 8px', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main, #0F172A)' }}>
                      {it.description}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#2563EB' }}>{Math.round(it.expected_30d_demand).toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-main, #0F172A)' }}>{it.current_stock.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', color: '#818CF8' }}>{it.safety_stock}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: '#EC4899' }}>{it.reorder_point}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: it.suggested_order > 0 ? '#2563EB' : 'var(--text-muted, #94A3B8)' }}>
                      {it.suggested_order > 0 ? it.suggested_order.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: it.status === 'Replenishment Needed' ? 'rgba(236, 72, 153, 0.15)' : (it.status === 'Excess Stock' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                          color: it.status === 'Replenishment Needed' ? '#EC4899' : (it.status === 'Excess Stock' ? '#D97706' : '#10B981')
                        }}
                      >
                        {it.status === 'Replenishment Needed' ? '🌸' : (it.status === 'Excess Stock' ? '⭐' : '🟢')} {it.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', maxWidth: '300px' }}>
                      {it.expiry_risk_alert && it.expiry_risk_alert.units_at_risk > 0 ? (
                        <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                          {it.expiry_risk_alert.recommendation || `${it.expiry_risk_alert.units_at_risk} units at expiry risk`}
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

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94A3B8)' }}>
            Showing {Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(filteredItems.length, currentPage * itemsPerPage)} of {filteredItems.length.toLocaleString()} products
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: currentPage === 1 ? 'var(--text-muted, #64748B)' : '#F8FAFC',
                fontSize: '0.8rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span style={{ fontSize: '0.82rem', color: '#F8FAFC', padding: '0 8px' }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: currentPage === totalPages ? 'var(--text-muted, #64748B)' : '#F8FAFC',
                fontSize: '0.8rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Email Report Modal */}
      {isEmailModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEmailModalOpen(false);
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#0F172A',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '16px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8' }}>
                  <Mail size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
                    Email Inventory Replenishment Report
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
                    Sends structured Excel (.xlsx) workbook containing all analysed products.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {emailStatusMessage && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: emailStatusMessage.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                  border: `1px solid ${emailStatusMessage.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(236, 72, 153, 0.3)'}`,
                  color: emailStatusMessage.success ? '#34D399' : '#EC4899',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {emailStatusMessage.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{emailStatusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSendEmailReport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Recipient Email Address:
                </label>
                <input
                  type="email"
                  required
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="e.g. manager@retailer.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Email Subject:
                </label>
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Message Note:
                </label>
                <textarea
                  rows={3}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F8FAFC',
                    fontSize: '0.875rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '0.78rem',
                  color: '#6EE7B7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FileSpreadsheet size={16} style={{ flexShrink: 0 }} />
                <span>
                  Attached file: <strong>Retail_Inventory_Replenishment_Report_{activeDashboardId}.xlsx</strong> (Contains full {items.length.toLocaleString()} products)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#CBD5E1',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailSending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: emailSending ? 'not-allowed' : 'pointer'
                  }}
                >
                  {emailSending ? (
                    <>
                      <RefreshCw size={14} className="spin-slow" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Send Email Report
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
