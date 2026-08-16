import React, { useState, useEffect, useRef } from 'react';
import {
  fetchExpiryDashboard,
  fetchExpiryProductsFiltered,
  fetchExpiryProductDetail,
  updateClearancePrice,
  bulkUpdateClearancePrice,
  fetchLabelData
} from '../services/api';
import type {
  ExpiryDashboardData,
  ExpiryProduct,
  ExpiryProductDetailData
} from '../services/api';
import {
  Package,
  Clock,
  AlertTriangle,
  Tag,
  Search,
  Printer,
  Save,
  TrendingUp,
  CheckSquare,
  Square,
  RefreshCw
} from 'lucide-react';

import { RecommendedActionCard } from './RecommendedActionCard';

export const ExpiryProductsPage: React.FC<{ activeDashboardId?: string; onNavigateTab?: (tab: string) => void }> = ({ activeDashboardId = 'default' }) => {
  const [dashboard, setDashboard] = useState<ExpiryDashboardData | null>(null);
  const [products, setProducts] = useState<ExpiryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProds, setLoadingProds] = useState(false);

  // Filters State
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bulk Selection State
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [bulkDiscount, setBulkDiscount] = useState<number>(20);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Product Detail Modal State
  const [detailProduct, setDetailProduct] = useState<ExpiryProductDetailData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Print Label Modal State
  const [labelData, setLabelData] = useState<any | null>(null);
  const [isLabelOpen, setIsLabelOpen] = useState(false);

  // Discount Overrides State per row { [stock_code]: discount_percent }
  const [discountOverrides, setDiscountOverrides] = useState<{ [key: string]: number }>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      const dbData = await fetchExpiryDashboard(activeDashboardId);
      setDashboard(dbData);
    } catch (err) {
      console.error("Failed to load expiry dashboard KPIs:", err);
    }
  };

  const loadProductsData = async () => {
    setLoadingProds(true);
    try {
      const prodList = await fetchExpiryProductsFiltered(
        filterPeriod,
        selectedStatus,
        searchQuery,
        150,
        activeDashboardId
      );
      setProducts(prodList);

      // Initialize discount overrides from backend values
      const initialOverrides: { [key: string]: number } = {};
      prodList.forEach(p => {
        initialOverrides[p.stock_code] = p.clearance_discount;
      });
      setDiscountOverrides(initialOverrides);
    } catch (err) {
      console.error("Error loading expiry products:", err);
    } finally {
      setLoadingProds(false);
    }
  };

  const isFirstRender = useRef(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadDashboardData(), loadProductsData()]);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadProductsData();
  }, [filterPeriod, selectedStatus, searchQuery]);

  const handleStatusChartClick = (category: string) => {
    if (category.includes("Healthy")) {
      setSelectedStatus("Healthy");
    } else if (category.includes("Expiring Soon")) {
      setSelectedStatus("Expiring Soon");
    } else if (category.includes("Expired")) {
      setSelectedStatus("Expired");
    } else {
      setSelectedStatus("all");
    }
  };

  const handleToggleSelectProduct = (code: string) => {
    if (selectedCodes.includes(code)) {
      setSelectedCodes(selectedCodes.filter(c => c !== code));
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  const handleSelectAllCurrent = () => {
    const currentCodes = products.map(p => p.stock_code);
    const allSelected = currentCodes.every(c => selectedCodes.includes(c));
    if (allSelected) {
      setSelectedCodes(selectedCodes.filter(c => !currentCodes.includes(c)));
    } else {
      setSelectedCodes(Array.from(new Set([...selectedCodes, ...currentCodes])));
    }
  };

  const handleDiscountChange = (code: string, val: number) => {
    setDiscountOverrides(prev => ({ ...prev, [code]: val }));
  };

  const handleSavePrice = async (p: ExpiryProduct) => {
    const disc = discountOverrides[p.stock_code] ?? p.clearance_discount;
    setSavingCode(p.stock_code);
    try {
      const res = await updateClearancePrice(p.stock_code, disc);
      setToastMsg(`✅ ${res.message}`);
      await loadDashboardData();
      await loadProductsData();
    } catch (err) {
      setToastMsg(`❌ Failed to update price for ${p.stock_code}`);
    } finally {
      setSavingCode(null);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleApplyBulkDiscount = async () => {
    if (selectedCodes.length === 0) return;
    try {
      const res = await bulkUpdateClearancePrice(selectedCodes, bulkDiscount);
      setToastMsg(`✅ ${res.message}`);
      setIsBulkModalOpen(false);
      setSelectedCodes([]);
      await loadDashboardData();
      await loadProductsData();
    } catch (err) {
      setToastMsg(`❌ Failed bulk clearance update.`);
    } finally {
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleOpenDetail = async (code: string) => {
    try {
      const detail = await fetchExpiryProductDetail(code);
      setDetailProduct(detail);
      setIsDetailOpen(true);
    } catch (err) {
      console.error("Failed to load product detail:", err);
    }
  };

  const handleOpenPrintLabel = async (code: string) => {
    try {
      const label = await fetchLabelData(code);
      setLabelData(label);
      setIsLabelOpen(true);
    } catch (err) {
      console.error("Failed to load label data:", err);
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
        Loading Expiry Products Dashboard & Inventory Intelligence...
      </div>
    );
  }

  const kpis = dashboard?.kpis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: '#0F172A',
          border: '1px solid #6366F1',
          color: '#F8FAFC',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          {toastMsg}
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '24px 28px', borderLeft: '4px solid #F59E0B', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(18, 24, 38, 0.8))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Package color="#F59E0B" size={28} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Expiry Products
              </h2>
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.95rem', margin: 0 }}>
              Identify products approaching expiry, protect margins, and turn ageing stock into actionable promotions.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '8px 14px', borderRadius: '10px', fontSize: '0.78rem', color: '#CBD5E1' }}>
            🧪 <strong>Demo Data Notice:</strong> Expiry dates are synthetic demonstration enrichments.
          </div>
        </div>
      </div>

      <RecommendedActionCard
        title="Expiry & Clearance Optimization"
        subtitle={kpis && kpis.expiring_this_month > 0
          ? `Found ${kpis.expiring_this_month} products expiring within 30 days totaling £${kpis.stock_value_at_risk.toLocaleString()} at-risk stock value.`
          : `No product expiry information identified in this uploaded dataset. Expiry analysis requires the ExpiryWithinDays column.`
        }
        metricLabel="At-Risk Stock Value"
        metricValue={kpis ? `£${kpis.stock_value_at_risk.toLocaleString()}` : "N/A"}
        recommendedAction="Apply clearance pricing or targeted flash promotions to reduce potential inventory loss before expiration."
        buttonText={kpis && kpis.expiring_this_month > 0 ? "Review Clearance Products" : undefined}
        onActionClick={kpis && kpis.expiring_this_month > 0 ? () => window.scrollTo({ top: 900, behavior: 'smooth' }) : undefined}
        type={kpis && kpis.expiring_this_month > 0 ? "warning" : "info"}
      />

      {/* Top Business KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
        <div className="glass-card metric-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>📦 Products Tracked</span>
            <Package size={20} color="#818CF8" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F8FAFC' }}>
            {kpis?.products_tracked.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>Active store catalog items</div>
        </div>

        <div className="glass-card metric-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>⏰ Expiring This Month</span>
            <Clock size={20} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F59E0B' }}>
            {kpis?.expiring_this_month.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>Require immediate clearance action</div>
        </div>

        <div className="glass-card metric-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>⚠️ Already Expired</span>
            <AlertTriangle size={20} color="#EC4899" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#EC4899' }}>
            {kpis?.already_expired.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>Items past expiration date</div>
        </div>

        <div className="glass-card metric-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>💷 Stock Value at Risk</span>
            <Tag size={20} color="#10B981" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10B981' }}>
            £{kpis?.potential_clearance_value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>Recoverable promo revenue</div>
        </div>
      </div>

      {/* CHARTS SECTION 1: Line Chart & Donut Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

        {/* Line Chart: Products Approaching Expiry */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              Products Approaching Expiry
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Upcoming product expiry volume over time.
            </p>
          </div>

          <div style={{ flex: 1, minHeight: '220px', position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {dashboard?.timeline.map((pt) => {
              const maxProds = Math.max(...(dashboard?.timeline.map(t => t.products_expiring) || [1]));
              const heightPct = maxProds > 0 ? (pt.products_expiring / maxProds) * 100 : 10;

              return (
                <div key={pt.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div
                    title={`${pt.month_label}: ${pt.products_expiring} products expiring | £${pt.estimated_stock_value.toLocaleString()} stock value | ${pt.total_units} units`}
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${Math.max(heightPct, 8)}%`,
                      background: 'linear-gradient(180deg, #F59E0B, rgba(245, 158, 11, 0.2))',
                      borderRadius: '6px 6px 0 0',
                      cursor: 'pointer',
                      transition: 'height 0.3s ease',
                      position: 'relative'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '8px' }}>{pt.month_label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Donut Chart: Expiry Status Distribution */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              Expiry Status
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Click a segment to filter the product table below.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dashboard?.status_distribution.map((dist) => (
              <div
                key={dist.category}
                onClick={() => handleStatusChartClick(dist.category)}
                style={{
                  padding: '12px 16px',
                  background: selectedStatus.toLowerCase().includes(dist.category.toLowerCase().split(' ')[1] || 'xyz') ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F8FAFC' }}>
                    {dist.category} ({dist.status_label})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                    {dist.products_count} products • {dist.total_units} units
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#F8FAFC' }}>
                    £{dist.stock_value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#818CF8', fontWeight: 600 }}>
                    {dist.percentage}% of stock
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CHARTS SECTION 2: Stock Value by Expiry Period Bar Chart */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: '#F8FAFC' }}>
          Stock Value by Expiry Period
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: '20px' }}>
          Estimated inventory value grouped by days remaining until synthetic expiry.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
          {dashboard?.value_by_period.map((valP) => (
            <div key={valP.period} style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600, marginBottom: '4px' }}>
                {valP.period}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: valP.period === 'Expired' ? '#EC4899' : valP.period === 'Within 7 Days' ? '#F59E0B' : '#F8FAFC' }}>
                £{valP.stock_value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                {valP.products_count} products ({valP.total_units} units)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PRODUCT TABLE & FILTERS SECTION */}
      <div className="glass-card" style={{ padding: '24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={22} color="#F59E0B" /> Products Needing Action ({products.length})
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Manage clearance pricing, override discounts, and print store labels.
            </p>
          </div>

          {/* Bulk Action Toolbar */}
          {selectedCodes.length > 0 && (
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '10px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#FDE047', fontWeight: 700 }}>
                Selected: {selectedCodes.length} products
              </span>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.82rem', background: '#F59E0B', border: 'none' }}
              >
                Set Clearance Discount &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>

          {/* Period Filter Buttons */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Products' },
              { id: 'week', label: 'Expiring This Week' },
              { id: 'month', label: 'Expiring This Month' },
              { id: 'next30', label: 'Next 30 Days' },
              { id: 'next60', label: 'Next 60 Days' },
              { id: 'expired', label: 'Already Expired' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterPeriod(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: filterPeriod === tab.id ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.1)',
                  background: filterPeriod === tab.id ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  color: filterPeriod === tab.id ? '#FDE047' : '#94A3B8',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search product name or stock code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Product Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <button onClick={handleSelectAllCurrent} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F59E0B' }}>
                    {products.length > 0 && products.every(p => selectedCodes.includes(p.stock_code)) ? (
                      <CheckSquare size={18} />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th>Product</th>
                <th>Stock Code</th>
                <th>Units Available</th>
                <th>Unit Price</th>
                <th>Stock Value</th>
                <th>Days Until Expiry</th>
                <th>Expiry Status</th>
                <th>Recommended Discount</th>
                <th>Clearance Price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingProds ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>Loading product inventory...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>No products match the selected filters.</td>
                </tr>
              ) : (
                products.map((p) => {
                  const isChecked = selectedCodes.includes(p.stock_code);
                  const currentDisc = discountOverrides[p.stock_code] ?? p.clearance_discount;
                  const calculatedClrPrice = p.unit_price * (1.0 - currentDisc / 100.0);
                  const isExpired = p.expiry_days_remaining < 0;

                  return (
                    <tr key={p.stock_code} style={{ background: isChecked ? 'rgba(245, 158, 11, 0.08)' : 'transparent' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectProduct(p.stock_code)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: '#F8FAFC', maxWidth: '200px' }}>
                        <button
                          onClick={() => handleOpenDetail(p.stock_code)}
                          style={{ background: 'none', border: 'none', color: '#F8FAFC', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', padding: 0, fontWeight: 700, fontSize: '0.9rem' }}
                        >
                          {p.description}
                        </button>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: '#94A3B8', fontSize: '0.85rem' }}>{p.stock_code}</td>
                      <td style={{ fontWeight: 600 }}>{p.units_available} units</td>
                      <td>£{p.unit_price.toFixed(2)}</td>
                      <td style={{ fontWeight: 700 }}>£{p.stock_value.toFixed(2)}</td>
                      <td style={{ fontWeight: 600, color: isExpired ? '#EC4899' : p.expiry_days_remaining <= 7 ? '#F59E0B' : '#34D399' }}>
                        {p.days_remaining_label}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isExpired ? 'rgba(239, 68, 68, 0.15)' : p.expiry_days_remaining <= 30 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isExpired ? '#FCA5A5' : p.expiry_days_remaining <= 30 ? '#FDE047' : '#34D399'
                        }}>
                          {isExpired ? '🔴 Expired' : p.expiry_days_remaining <= 30 ? '🟡 Expiring Soon' : '🟢 Healthy'}
                        </span>
                      </td>

                      {/* Recommended & Editable Discount */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <select
                            value={currentDisc}
                            onChange={(e) => handleDiscountChange(p.stock_code, Number(e.target.value))}
                            style={{ padding: '4px 6px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#F8FAFC', fontSize: '0.8rem' }}
                          >
                            <option value={0}>0% (No discount)</option>
                            <option value={10}>10% off</option>
                            <option value={20}>20% off</option>
                            <option value={25}>25% off</option>
                            <option value={30}>30% off</option>
                            <option value={40}>40% off</option>
                            <option value={50}>50% off</option>
                          </select>
                        </div>
                      </td>

                      {/* Calculated Clearance Price */}
                      <td style={{ fontWeight: 800, color: '#10B981' }}>
                        £{calculatedClrPrice.toFixed(2)}
                      </td>

                      {/* Actions: Save Price, Print Label */}
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleSavePrice(p)}
                            disabled={savingCode === p.stock_code}
                            title="Save Clearance Price"
                            style={{ padding: '6px 10px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '6px', color: '#A5B4FC', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {savingCode === p.stock_code ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                            Save
                          </button>

                          <button
                            onClick={() => handleOpenPrintLabel(p.stock_code)}
                            title="Print Price Label"
                            style={{ padding: '6px 10px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '6px', color: '#34D399', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Printer size={14} /> Label
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* BULK DISCOUNT CONFIRMATION MODAL */}
      {isBulkModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px', background: '#0B0F17', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 12px 0', color: '#F8FAFC' }}>
              Bulk Clearance Price Update
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#94A3B8', marginBottom: '20px' }}>
              You are about to update clearance prices for <strong>{selectedCodes.length}</strong> selected products.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, marginBottom: '8px' }}>
                Clearance Discount Percent (%)
              </label>
              <select
                value={bulkDiscount}
                onChange={(e) => setBulkDiscount(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC' }}
              >
                <option value={10}>10% Clearance Discount</option>
                <option value={20}>20% Clearance Discount</option>
                <option value={25}>25% Clearance Discount</option>
                <option value={30}>30% Clearance Discount</option>
                <option value={40}>40% Clearance Discount</option>
                <option value={50}>50% Clearance Discount</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkDiscount}
                style={{ flex: 2, padding: '12px', background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                Apply to {selectedCodes.length} Products
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT DETAIL MODAL */}
      {isDetailOpen && detailProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '28px', background: '#0B0F17', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Product Detail: {detailProduct.description}
              </h3>
              <button onClick={() => setIsDetailOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Stock Code</span>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{detailProduct.stock_code}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Units Available</span>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{detailProduct.units_available} units</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Original Unit Price</span>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>£{detailProduct.unit_price.toFixed(2)}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Clearance Price</span>
                <div style={{ fontWeight: 800, color: '#10B981' }}>£{detailProduct.clearance_price.toFixed(2)} ({detailProduct.clearance_discount}% off)</div>
              </div>
            </div>

            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#818CF8" /> Sales History
            </h4>

            {detailProduct.monthly_sales.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>No historical sales record for this item.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {detailProduct.monthly_sales.map(m => (
                  <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <span>{m.month}</span>
                    <span><strong>{m.units_sold} units sold</strong> (£{m.revenue.toLocaleString()})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRINTABLE PRICE LABEL MODAL */}
      {isLabelOpen && labelData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card printable-label-card" style={{ width: '100%', maxWidth: '420px', padding: '28px', background: '#FFFFFF', color: '#000000', borderRadius: '16px', boxShadow: '0 25px 60px rgba(0,0,0,0.8)', border: '3px dashed #000000' }}>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #DDD', paddingBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 700 }}>Printable Label Preview</span>
              <button onClick={() => setIsLabelOpen(false)} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 800 }}>
                ✕
              </button>
            </div>

            {/* LABEL CONTENT TO PRINT */}
            <div id="printable-label-content" style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: '#4F46E5', marginBottom: '4px' }}>
                {labelData.store_name}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#DC2626', marginBottom: '12px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
                {labelData.title}
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 800, margin: '12px 0 6px 0', lineHeight: 1.3 }}>
                {labelData.product_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#555', fontFamily: 'monospace', marginBottom: '16px' }}>
                Stock Code: {labelData.stock_code}
              </div>

              <div style={{ background: '#FEF2F2', border: '2px solid #DC2626', borderRadius: '12px', padding: '16px', margin: '16px 0' }}>
                <div style={{ fontSize: '0.9rem', textDecoration: 'line-through', color: '#666' }}>
                  WAS: {labelData.was_price}
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#DC2626', margin: '4px 0' }}>
                  NOW: {labelData.now_price}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                  SAVE {labelData.savings_percent}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#333', marginTop: '12px' }}>
                Expiry Horizon: {labelData.days_remaining_label}
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => setIsLabelOpen(false)}
                style={{ flex: 1, padding: '12px', background: '#E2E8F0', color: '#1E293B', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>

              <button
                onClick={handleTriggerPrint}
                style={{ flex: 2, padding: '12px', background: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Printer size={18} /> Print Label Now
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT MEDIA STYLING RULE */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-label-content, #printable-label-content * {
            visibility: visible;
          }
          #printable-label-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

    </div>
  );
};
