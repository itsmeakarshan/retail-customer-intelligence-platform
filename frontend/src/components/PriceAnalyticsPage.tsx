import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  fetchPriceElasticityProducts,
  optimizeProductPrice
} from '../services/api';
import type {
  PriceElasticityItem,
  PriceOptimizationResult
} from '../services/api';
import {
  PoundSterling,
  TrendingUp,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  BarChart3,
  ArrowRight,
  X,
  Check
} from 'lucide-react';

interface PriceAnalyticsPageProps {
  activeDashboardId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const PriceAnalyticsPage: React.FC<PriceAnalyticsPageProps> = ({
  activeDashboardId = 'default'
}) => {
  const [products, setProducts] = useState<PriceElasticityItem[]>([]);
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Business Inputs
  const [unitCostInput, setUnitCostInput] = useState<string>(''); // starts empty
  const [objective, setObjective] = useState<'profit' | 'revenue'>('profit');

  // Optimisation state
  const [optResult, setOptResult] = useState<PriceOptimizationResult | null>(null);
  const [costError, setCostError] = useState<string | null>(null);

  // Collapsible Technical Model Details
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initial load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const prodsRes = await fetchPriceElasticityProducts({
          dashboard_id: activeDashboardId
          // limit omitted to fetch all products across complete population
        });
        setProducts(prodsRes);

        if (prodsRes.length > 0) {
          // Select first product with valid elasticity if available, or first product
          const preferred = prodsRes.find(p => p.elasticity !== null && p.elasticity !== undefined) || prodsRes[0];
          setSelectedStockCode(preferred.stock_code);
          runOptimization(preferred.stock_code, 'profit', undefined);
        }
      } catch (err) {
        console.error("Failed to load price analytics products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDashboardId]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.stock_code === selectedStockCode) || null;
  }, [products, selectedStockCode]);

  // Population stats
  const eligibleProductsCount = useMemo(() => {
    return products.filter(p => (p.sample_size || 0) >= 5).length;
  }, [products]);

  const excludedProductsCount = useMemo(() => {
    return products.filter(p => (p.sample_size || 0) < 5).length;
  }, [products]);

  // Search across the COMPLETE product population
  const searchResults = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) {
      // Default initial view: top 40 products by volume
      return {
        items: products.slice(0, 40),
        totalMatches: products.length,
        isSearch: false
      };
    }
    const matches = products.filter(p =>
      p.stock_code.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
    return {
      items: matches.slice(0, 60), // Render top 60 matching items for optimal DOM speed
      totalMatches: matches.length,
      isSearch: true
    };
  }, [products, productSearch]);

  async function runOptimization(code: string, obj: 'profit' | 'revenue', cost?: number) {
    if (!code) return;
    setCostError(null);

    // If profit objective is selected but cost is missing/invalid
    if (obj === 'profit' && (cost === undefined || cost === null || isNaN(cost) || cost < 0)) {
      setCostError("Enter your business Unit Cost (£) to calculate profit-maximising price.");
    }

    try {
      const res = await optimizeProductPrice(
        {
          stock_code: code,
          objective: obj,
          unit_cost: cost !== undefined && cost >= 0 ? cost : undefined
        },
        activeDashboardId
      );
      setOptResult(res);
    } catch (err) {
      console.error("Price optimisation error:", err);
    }
  }

  const handleSelectProduct = (code: string) => {
    setSelectedStockCode(code);
    setIsDropdownOpen(false);
    setProductSearch('');
    const cost = unitCostInput !== '' ? Number(unitCostInput) : undefined;
    runOptimization(code, objective, cost);
  };

  const handleUnitCostChange = (val: string) => {
    setUnitCostInput(val);
    setCostError(null);
    const num = val !== '' ? Number(val) : undefined;
    if (num !== undefined && (isNaN(num) || num < 0)) {
      setCostError("Unit cost must be a non-negative number.");
      return;
    }
    if (selectedStockCode) {
      runOptimization(selectedStockCode, objective, num);
    }
  };

  const handleObjectiveChange = (newObj: 'profit' | 'revenue') => {
    setObjective(newObj);
    const cost = unitCostInput !== '' ? Number(unitCostInput) : undefined;
    runOptimization(selectedStockCode, newObj, cost);
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>
        Loading Complete Product Population &amp; Pricing Engine ({products.length > 0 ? products.length : '4,631'} products)...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.15)', color: '#EAB308' }}>
              <PoundSterling size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #F8FAFC)' }}>
              Pricing &amp; Profit Optimisation
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)' }}>
            Use historical demand behaviour, price elasticity and your unit cost to identify a profitable selling price.
          </p>
        </div>
      </div>

      {/* TOP SECTION: 1. SELECT PRODUCT & REAL HISTORICAL BASELINE */}
      <div className="glass-card" style={{ padding: '22px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: '#EAB308', color: '#0F172A', fontWeight: 800, fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px' }}>
              STEP 1
            </span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              Select Product
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
            <span style={{ color: '#38BDF8', fontWeight: 600 }}>
              {eligibleProductsCount.toLocaleString()} products available for analysis
            </span>
            <span style={{ color: 'var(--text-muted, #64748B)' }}>
              ({products.length.toLocaleString()} total catalog | {excludedProductsCount} excluded with &lt;5 orders)
            </span>
          </div>
        </div>

        {/* Searchable Product Combobox across Complete Population */}
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 600 }}>
            Search &amp; Select Product (Search all {products.length.toLocaleString()} items by StockCode or Name):
          </label>

          <div
            onClick={() => {
              setIsDropdownOpen(true);
              searchInputRef.current?.focus();
            }}
            style={{
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.75)',
              border: isDropdownOpen ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'text',
              boxShadow: isDropdownOpen ? '0 0 0 2px rgba(56, 189, 248, 0.2)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Search size={18} color="var(--text-muted, #94A3B8)" style={{ marginRight: '8px', flexShrink: 0 }} />

            <input
              ref={searchInputRef}
              type="text"
              placeholder={selectedProduct ? `${selectedProduct.stock_code} — ${selectedProduct.description}` : "Type StockCode or Description to search all 4,631 products..."}
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                if (!isDropdownOpen) setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#F8FAFC',
                fontSize: '0.9rem',
                outline: 'none',
                padding: '4px 0'
              }}
            />

            {productSearch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProductSearch('');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94A3B8)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <X size={16} />
              </button>
            )}

            <div style={{ marginLeft: '8px', color: 'var(--text-muted, #94A3B8)', cursor: 'pointer', display: 'flex' }}>
              {isDropdownOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          {/* Quick Suggestion Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-muted, #64748B)' }}>Quick test:</span>
            {[
              { code: '85123A', label: '85123A (Hanging Heart)' },
              { code: '85099B', label: '85099B (Jumbo Bag)' },
              { code: '22423', label: '22423 (Regency Teapot)' },
              { code: '47566', label: '47566 (Party Bunting)' },
              { code: '35999', label: '35999 (Catalog End Item)' }
            ].map(item => (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelectProduct(item.code)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: selectedStockCode === item.code ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.05)',
                  border: selectedStockCode === item.code ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                  color: selectedStockCode === item.code ? '#38BDF8' : 'var(--text-muted, #94A3B8)',
                  cursor: 'pointer',
                  fontSize: '0.72rem'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Search Results Dropdown Panel */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '6px',
                background: '#0F172A',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '10px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                zIndex: 50,
                maxHeight: '340px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Dropdown Header */}
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '0.72rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-muted, #94A3B8)',
                  position: 'sticky',
                  top: 0,
                  backdropFilter: 'blur(8px)',
                  zIndex: 2
                }}
              >
                <span>
                  {searchResults.isSearch
                    ? `Found ${searchResults.totalMatches} products matching "${productSearch}"`
                    : `Top Products (Type above to search all ${products.length.toLocaleString()} items)`}
                </span>
                <span>{searchResults.items.length} shown</span>
              </div>

              {/* Product items list */}
              {searchResults.items.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #94A3B8)', fontSize: '0.85rem' }}>
                  No products found matching "{productSearch}".
                </div>
              ) : (
                searchResults.items.map(p => {
                  const isSelected = p.stock_code === selectedStockCode;
                  return (
                    <div
                      key={p.stock_code}
                      onClick={() => handleSelectProduct(p.stock_code)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: isSelected ? '#38BDF8' : '#FDE047', fontSize: '0.85rem' }}>
                            {p.stock_code}
                          </span>
                          <span style={{ fontSize: '0.82rem', color: '#F8FAFC', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)' }}>
                          Hist. Selling Price: £{p.avg_price.toFixed(2)} | Volume: {p.total_quantity.toLocaleString()} units ({p.sample_size} orders)
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: p.is_statistically_eligible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: p.is_statistically_eligible ? '#10B981' : '#F59E0B'
                          }}
                        >
                          {p.is_statistically_eligible ? `β = ${p.elasticity?.toFixed(2)}` : (p.sample_size >= 5 ? 'Fixed Price' : '<5 Orders')}
                        </span>
                        {isSelected && <Check size={16} color="#38BDF8" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Real Historical Product Baseline Card */}
        {selectedProduct && (
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FDE047' }}>
                  {selectedProduct.stock_code} — {selectedProduct.description}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
                  Source: Real historical transactions from dataset
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                {selectedProduct.category}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginTop: '14px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Historical Average Selling Price
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                  £{selectedProduct.avg_price.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)' }}>
                  Customer-facing selling price
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Historical Units Sold
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                  {selectedProduct.total_quantity.toLocaleString()} units
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)' }}>
                  Total historical volume
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Historical Transactions
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                  {selectedProduct.sample_size} orders
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)' }}>
                  Across {selectedProduct.distinct_prices} distinct price level(s)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Price Elasticity
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: selectedProduct.elasticity !== null && selectedProduct.elasticity !== undefined ? '#38BDF8' : 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
                  {selectedProduct.elasticity !== null && selectedProduct.elasticity !== undefined ? `β = ${selectedProduct.elasticity.toFixed(2)}` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)' }}>
                  {selectedProduct.is_statistically_eligible ? 'Eligible for optimisation' : 'Insufficient price variation'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MIDDLE SECTION: 2. BUSINESS INPUTS & OBJECTIVE & OPTIMISATION */}
      <div className="glass-card" style={{ padding: '22px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#EAB308', color: '#0F172A', fontWeight: 800, fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px' }}>
            STEP 2
          </span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Enter Business Unit Cost &amp; Objective
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Unit Cost Input */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: '#F8FAFC', fontWeight: 700 }}>
                  Unit Cost (£)
                </label>
                <span style={{ fontSize: '0.7rem', color: '#EAB308', background: 'rgba(234, 179, 8, 0.12)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  Business Input
                </span>
              </div>
              <p style={{ margin: '4px 0 10px 0', fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', lineHeight: '1.4' }}>
                Enter your actual cost per unit. This value is not available in the historical transaction dataset.
              </p>
            </div>

            <div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted, #94A3B8)', fontSize: '0.95rem', fontWeight: 600 }}>£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.0"
                  value={unitCostInput}
                  onChange={(e) => handleUnitCostChange(e.target.value)}
                  placeholder="Enter cost (e.g. 0.38)"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 28px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: costError ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.15)',
                    color: '#F8FAFC',
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', marginTop: '6px' }}>
                Selling Price (£{selectedProduct?.avg_price.toFixed(2) || '0.00'}) = Customer Price | Unit Cost = What business pays
              </div>
            </div>
          </div>

          {/* Pricing Objective Selector */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#F8FAFC', fontWeight: 700 }}>
                Optimise For
              </label>
              <p style={{ margin: '4px 0 10px 0', fontSize: '0.75rem', color: 'var(--text-muted, #94A3B8)', lineHeight: '1.4' }}>
                Select whether to maximise total net profit earnings or gross sales volume.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                onClick={() => handleObjectiveChange('profit')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: objective === 'profit' ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                  background: objective === 'profit' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: objective === 'profit' ? '#10B981' : '#F8FAFC', fontWeight: 700, fontSize: '0.9rem' }}>
                  <TrendingUp size={16} />
                  Maximum Profit
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)', marginTop: '4px', lineHeight: '1.3' }}>
                  Maximises (Price - Cost) × Qty. Requires unit cost.
                </div>
              </div>

              <div
                onClick={() => handleObjectiveChange('revenue')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: objective === 'revenue' ? '2px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                  background: objective === 'revenue' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: objective === 'revenue' ? '#38BDF8' : '#F8FAFC', fontWeight: 700, fontSize: '0.9rem' }}>
                  <BarChart3 size={16} />
                  Maximum Revenue
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)', marginTop: '4px', lineHeight: '1.3' }}>
                  Maximises Price × Qty. Expands top-line volume.
                </div>
              </div>
            </div>
          </div>
        </div>

        {costError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#FCA5A5', fontSize: '0.8rem' }}>
            <AlertCircle size={16} />
            <span>{costError}</span>
          </div>
        )}
      </div>

      {/* RESULTS & COMPARISON SECTION */}
      {optResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* If product has insufficient price variation */}
          {!optResult.is_statistically_eligible ? (
            <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FDE047', fontWeight: 800, fontSize: '1.05rem' }}>
                <AlertCircle size={22} />
                <span>Price Optimisation Unavailable for This Product</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', lineHeight: '1.45' }}>
                This product does not have enough reliable historical price variation to estimate price sensitivity. The transaction history shows a single fixed shelf price. Historical pricing and sales volume remain available above.
              </p>
            </div>
          ) : (
            <>
              {/* RECOMMENDED PRICE CARD */}
              <div
                className="glass-card"
                style={{
                  padding: '26px',
                  borderRadius: '16px',
                  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.8) 100%)',
                  border: '2px solid rgba(234, 179, 8, 0.4)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#EAB308', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      RECOMMENDED SELLING PRICE ({optResult.objective.toUpperCase()} OPTIMISED)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginTop: '6px' }}>
                      <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#F8FAFC' }}>
                        £{optResult.recommended_price.toFixed(2)}
                      </div>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: optResult.price_change_pct >= 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(236, 72, 153, 0.18)',
                          color: optResult.price_change_pct >= 0 ? '#10B981' : '#EC4899'
                        }}
                      >
                        {optResult.price_change_pct >= 0 ? '+' : ''}{optResult.price_change_pct.toFixed(1)}% vs Historical Avg (£{optResult.historical_avg_price.toFixed(2)})
                      </span>
                    </div>
                    {optResult.boundary_note && (
                      <div style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '6px' }}>
                        ⚠️ {optResult.boundary_note}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                      Elasticity Response
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                      β = {optResult.elasticity_used.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Key Projections Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)' }}>Expected 30-Day Demand</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38BDF8', marginTop: '3px' }}>
                      {Math.round(optResult.expected_30d_quantity).toLocaleString()} units
                    </div>
                    <div style={{ fontSize: '0.72rem', color: optResult.quantity_change_pct >= 0 ? '#10B981' : '#EC4899', marginTop: '2px' }}>
                      {optResult.quantity_change_pct >= 0 ? '+' : ''}{optResult.quantity_change_pct.toFixed(1)}% volume
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)' }}>Expected 30-Day Revenue</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', marginTop: '3px' }}>
                      £{optResult.expected_30d_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: optResult.revenue_difference >= 0 ? '#10B981' : '#EC4899', marginTop: '2px' }}>
                      {optResult.revenue_difference >= 0 ? '+' : ''}£{optResult.revenue_difference.toFixed(2)} ({optResult.revenue_diff_pct.toFixed(1)}%)
                    </div>
                  </div>

                  {optResult.expected_30d_cost !== null && optResult.expected_30d_cost !== undefined && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)' }}>Expected 30-Day Cost</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-muted, #94A3B8)', marginTop: '3px' }}>
                        £{optResult.expected_30d_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                        @ £{optResult.unit_cost?.toFixed(2)} unit cost
                      </div>
                    </div>
                  )}

                  {optResult.expected_30d_profit !== null && optResult.expected_30d_profit !== undefined && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>Expected 30-Day Profit</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', marginTop: '3px' }}>
                        £{optResult.expected_30d_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: (optResult.profit_difference || 0) >= 0 ? '#10B981' : '#EC4899', marginTop: '2px' }}>
                        {(optResult.profit_difference || 0) >= 0 ? '+' : ''}£{(optResult.profit_difference || 0).toFixed(2)} vs baseline
                      </div>
                    </div>
                  )}

                  {optResult.profit_margin_pct !== null && optResult.profit_margin_pct !== undefined && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)' }}>Profit Margin</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FDE047', marginTop: '3px' }}>
                        {optResult.profit_margin_pct.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                        Net margin percentage
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SIDE-BY-SIDE COMPARISON TABLE */}
              <div className="glass-card" style={{ padding: '22px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
                  Decision Comparison: Historical Baseline vs Recommended Price
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted, #94A3B8)' }}>
                        <th style={{ padding: '10px 12px' }}>Metric</th>
                        <th style={{ padding: '10px 12px' }}>Historical Baseline</th>
                        <th style={{ padding: '10px 12px', color: '#FDE047' }}>Recommended ({optResult.objective.toUpperCase()})</th>
                        <th style={{ padding: '10px 12px' }}>Difference / Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F8FAFC' }}>Selling Price</td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>£{optResult.historical_avg_price.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F8FAFC' }}>£{optResult.recommended_price.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: optResult.price_change_pct >= 0 ? '#10B981' : '#EC4899' }}>
                          {optResult.price_change_pct >= 0 ? '+' : ''}{optResult.price_change_pct.toFixed(1)}%
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F8FAFC' }}>Expected 30-Day Demand</td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{Math.round(optResult.baseline_30d_quantity).toLocaleString()} units</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#38BDF8' }}>{Math.round(optResult.expected_30d_quantity).toLocaleString()} units</td>
                        <td style={{ padding: '10px 12px', color: optResult.quantity_change_pct >= 0 ? '#10B981' : '#EC4899' }}>
                          {optResult.quantity_change_pct >= 0 ? '+' : ''}{optResult.quantity_change_pct.toFixed(1)}% volume
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F8FAFC' }}>Expected 30-Day Revenue</td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>£{optResult.baseline_30d_revenue.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F8FAFC' }}>£{optResult.expected_30d_revenue.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: optResult.revenue_difference >= 0 ? '#10B981' : '#EC4899' }}>
                          {optResult.revenue_difference >= 0 ? '+' : ''}£{optResult.revenue_difference.toFixed(2)} ({optResult.revenue_diff_pct.toFixed(1)}%)
                        </td>
                      </tr>
                      {optResult.baseline_30d_cost !== null && optResult.expected_30d_cost !== null && (
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F8FAFC' }}>Expected 30-Day Cost</td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>£{optResult.baseline_30d_cost?.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>£{optResult.expected_30d_cost?.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted, #64748B)' }}>
                            Based on £{optResult.unit_cost?.toFixed(2)} unit cost
                          </td>
                        </tr>
                      )}
                      {optResult.baseline_30d_profit !== null && optResult.expected_30d_profit !== null && (
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(16, 185, 129, 0.05)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10B981' }}>Expected 30-Day Profit</td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>£{optResult.baseline_30d_profit?.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#10B981' }}>£{optResult.expected_30d_profit?.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: (optResult.profit_difference || 0) >= 0 ? '#10B981' : '#EC4899' }}>
                            {(optResult.profit_difference || 0) >= 0 ? '+' : ''}£{(optResult.profit_difference || 0).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {optResult.baseline_profit_margin_pct !== null && optResult.profit_margin_pct !== null && (
                        <tr>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F8FAFC' }}>Profit Margin (%)</td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{optResult.baseline_profit_margin_pct?.toFixed(1)}%</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#FDE047' }}>{optResult.profit_margin_pct?.toFixed(1)}%</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted, #94A3B8)' }}>
                            {((optResult.profit_margin_pct || 0) - (optResult.baseline_profit_margin_pct || 0)) >= 0 ? '+' : ''}{((optResult.profit_margin_pct || 0) - (optResult.baseline_profit_margin_pct || 0)).toFixed(1)}%
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}



      {/* HOW THIS WORKS & DATA TRANSPARENCY CARD */}
      <div className="glass-card" style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FDE047', fontWeight: 700, fontSize: '0.95rem' }}>
          <Info size={18} />
          <span>How This Pricing Decision Engine Works</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', margin: '14px 0', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.75rem', color: '#F8FAFC' }}>
          <span style={{ fontWeight: 700, color: '#EAB308' }}>REAL HISTORICAL DATA</span>
          <ArrowRight size={14} color="var(--text-muted, #64748B)" />
          <span>Historical Price + Qty</span>
          <ArrowRight size={14} color="var(--text-muted, #64748B)" />
          <span>Statistical Log-Log Elasticity</span>
          <ArrowRight size={14} color="var(--text-muted, #64748B)" />
          <span>Candidate Price Grid (50% - 150%)</span>
          <ArrowRight size={14} color="var(--text-muted, #64748B)" />
          <span>Revenue / Profit Evaluation</span>
          <ArrowRight size={14} color="var(--text-muted, #64748B)" />
          <span style={{ fontWeight: 700, color: '#10B981' }}>OPTIMAL RECOMMENDED PRICE</span>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)', lineHeight: '1.5' }}>
          • <strong>Real Historical Data:</strong> Historical prices and transaction volumes come directly from original transactions. No unit costs exist in the raw dataset.<br />
          • <strong>Business Unit Cost:</strong> Provided by you to simulate profit margin. Never fabricated by the system.<br />
          • <strong>Non-Causal Estimations:</strong> Price recommendations are mathematical estimates based on historical price-demand relationships. Historical elasticity represents statistical association and does not guarantee future customer behaviour.
        </div>
      </div>

      {/* COLLAPSIBLE TECHNICAL & MODEL DETAILS */}
      <div className="glass-card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={() => setShowTechDetails(!showTechDetails)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            color: '#F8FAFC',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#818CF8" />
            <span>Technical Econometric &amp; Model Details (Data Science View)</span>
          </div>
          {showTechDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showTechDetails && selectedProduct && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '0.8rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>Econometric Model</div>
              <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: '2px' }}>Log-Log OLS with Month &amp; DOW Controls</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>Elasticity Coefficient (β)</div>
              <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: '2px' }}>
                {selectedProduct.elasticity !== null && selectedProduct.elasticity !== undefined ? selectedProduct.elasticity.toFixed(3) : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>Standard Error (SE)</div>
              <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: '2px' }}>
                {selectedProduct.se !== null && selectedProduct.se !== undefined ? selectedProduct.se.toFixed(3) : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>95% Confidence Interval</div>
              <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: '2px' }}>
                {selectedProduct.ci_lower !== null && selectedProduct.ci_lower !== undefined && selectedProduct.ci_upper !== null && selectedProduct.ci_upper !== undefined
                  ? `[${selectedProduct.ci_lower.toFixed(2)}, ${selectedProduct.ci_upper.toFixed(2)}]`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>p-Value</div>
              <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: '2px' }}>
                {selectedProduct.p_value !== null && selectedProduct.p_value !== undefined ? selectedProduct.p_value.toFixed(4) : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>R-Squared (R²)</div>
              <div style={{ color: '#F8FAFC', fontWeight: 600, marginTop: '2px' }}>
                {selectedProduct.r_squared !== null && selectedProduct.r_squared !== undefined ? selectedProduct.r_squared.toFixed(2) : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>Status &amp; Diagnostics</div>
              <div style={{ color: selectedProduct.is_statistically_eligible ? '#10B981' : '#F59E0B', fontWeight: 600, marginTop: '2px' }}>
                {selectedProduct.status}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: 'var(--text-muted, #94A3B8)' }}>Interpretation</div>
              <div style={{ color: 'var(--text-muted, #CBD5E1)', marginTop: '2px', fontStyle: 'italic' }}>
                "{selectedProduct.interpretation}"
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
