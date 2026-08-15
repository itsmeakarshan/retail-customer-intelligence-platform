import React, { useEffect, useState } from 'react';
import { fetchCustomers } from '../services/api';
import type { PaginatedCustomers } from '../services/api';
import { Search, Filter, ArrowUpDown, Eye, Info } from 'lucide-react';
import { CustomerDetailModal } from './CustomerDetailModal';

interface CustomerRiskTableProps {
  activeDashboardId?: string;
}

export const CustomerRiskTable: React.FC<CustomerRiskTableProps> = ({ activeDashboardId = 'default' }) => {
  const [data, setData] = useState<PaginatedCustomers | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('revenue_at_risk');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetchCustomers({
          search,
          risk_level: riskFilter || undefined,
          segment: segmentFilter || undefined,
          page,
          limit: 15,
          sort_by: sortBy,
          order: sortOrder,
          dashboard_id: activeDashboardId
        });
        setData(res);
      } catch (err) {
        console.error("Failed to load customer list:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [search, riskFilter, segmentFilter, page, sortBy, sortOrder, activeDashboardId]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search & Filter Header */}
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
          <Search size={18} color="#94A3B8" />
          <input
            type="text"
            placeholder="Search Customer ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFF',
              fontSize: '0.9rem',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Filter size={18} color="#94A3B8" />
          <select
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
            style={{
              background: '#1E293B',
              color: '#FFF',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.85rem'
            }}
          >
            <option value="">All Risk Levels</option>
            <option value="High Risk">High Risk</option>
            <option value="Needs Attention">Needs Attention</option>
            <option value="Low Risk">Low Risk</option>
          </select>

          <select
            value={segmentFilter}
            onChange={(e) => { setSegmentFilter(e.target.value); setPage(1); }}
            style={{
              background: '#1E293B',
              color: '#FFF',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.85rem'
            }}
          >
            <option value="">All Customer Groups</option>
            <option value="High-Value Champions">High-Value Champions</option>
            <option value="High-Value At Risk">High-Value At Risk</option>
            <option value="Active Casuals">Active Casuals</option>
            <option value="Low-Value / Dormant">Low-Value / Dormant</option>
          </select>
        </div>
      </div>

      {/* Customer Risk Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('customer_id')} style={{ cursor: 'pointer' }}>
                  Customer ID <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th>Email Address</th>
                <th>Country</th>
                <th onClick={() => handleSort('recency')} style={{ cursor: 'pointer' }}>
                  Days Inactive <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('monetary')} style={{ cursor: 'pointer' }}>
                  Gross Spend <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('churn_probability')} style={{ cursor: 'pointer' }}>
                  Likelihood of Stopping <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('predicted_future_value')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Expected Spend — Next 30 Days
                    <span title="Estimated 30-day customer spend derived from the ML model." style={{ cursor: 'help' }}><Info size={13} color="#94A3B8" /></span>
                    <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: 2 }} />
                  </span>
                </th>
                <th onClick={() => handleSort('revenue_at_risk')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Company May Lose
                    <span title="Estimated 30-day loss exposure (churn probability × 30-day estimated spend)." style={{ cursor: 'help' }}><Info size={13} color="#FCA5A5" /></span>
                    <ArrowUpDown size={14} style={{ display: 'inline', marginLeft: 2 }} />
                  </span>
                </th>
                <th>Risk Badge</th>
                <th>Customer Group</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading customer records...</td>
                </tr>
              ) : !data || data.customers.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No customers matching criteria.</td>
                </tr>
              ) : (
                data.customers.map((c) => {
                  const fillWidth = Math.round(c.churn_probability * 100);
                  const fillColor = c.churn_probability >= 0.70 ? '#EF4444' : c.churn_probability >= 0.40 ? '#F59E0B' : '#10B981';
                  const riskBadgeText = c.churn_probability >= 0.70 ? 'High Risk' : c.churn_probability >= 0.40 ? 'Needs Attention' : 'Low Risk';
                  const riskClass = c.churn_probability >= 0.70 ? 'risk-high' : c.churn_probability >= 0.40 ? 'risk-medium' : 'risk-low';
                  
                  return (
                    <tr key={c.customer_id} onClick={() => setSelectedCustomerId(c.customer_id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600 }}>#{c.customer_id}</td>
                      <td style={{ color: '#A5B4FC', fontSize: '0.85rem' }}>{c.email || `customer_${c.customer_id}@example.com`}</td>
                      <td>{c.country}</td>
                      <td>{c.recency}d ago</td>
                      <td>&pound;{c.gross_revenue.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="prob-bar-bg" style={{ width: 40, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', display: 'inline-block' }}>
                            <span className="prob-bar-fill" style={{ width: `${fillWidth}%`, height: '100%', background: fillColor, display: 'block' }} />
                          </span>
                          <span>{(c.churn_probability * 100).toFixed(0)}% likely</span>
                        </div>
                      </td>
                      <td>&pound;{c.expected_30d_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontWeight: 700, color: '#FBBF24' }}>&pound;{c.company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td>
                        <span className={`risk-badge ${riskClass}`}>
                          {riskBadgeText}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{c.segment_name}</td>
                      <td>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(c.customer_id); }}
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#818CF8',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Eye size={14} /> Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.total_pages > 1 && (
          <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--bg-card-border)', fontSize: '0.85rem', color: '#94A3B8' }}>
            <span>Showing Page {data.page} of {data.total_pages} ({data.total.toLocaleString()} total customers)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                style={{ padding: '6px 12px', background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 6, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                disabled={page >= data.total_pages}
                onClick={() => setPage(p => Math.min(p + 1, data.total_pages))}
                style={{ padding: '6px 12px', background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 6, cursor: page >= data.total_pages ? 'not-allowed' : 'pointer', opacity: page >= data.total_pages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
};
