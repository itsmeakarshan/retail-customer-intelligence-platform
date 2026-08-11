import React, { useState, useEffect } from 'react';
import {
  fetchRetentionSummary,
  fetchRecommendedCampaigns,
  fetchExpiryProducts,
  fetchExpiryCustomers,
  fetchRetentionCustomers,
  createCampaign,
  previewEmail,
  sendTestEmail,
  fetchCampaignHistory,
  fetchEmailStatus
} from '../services/api';
import type {
  RetentionSummary,
  RecommendedCampaign,
  ExpiryProduct,
  EmailPreviewResponse,
  EmailStatusResponse,
  EmailTestResponse
} from '../services/api';
import {
  Send,
  AlertTriangle,
  PoundSterling,
  Package,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  Clock,
  UserCheck,
  Mail,
  RefreshCw,
  Gift,
  XCircle,
  Search,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';

export const RetentionCampaignsPage: React.FC<{ onOpenCopilot?: () => void }> = ({ onOpenCopilot }) => {
  const [summary, setSummary] = useState<RetentionSummary | null>(null);
  const [recommended, setRecommended] = useState<RecommendedCampaign[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<ExpiryProduct[]>([]);
  const [targetCustomers, setTargetCustomers] = useState<any[]>([]);
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  void targetCustomers;
  void campaignHistory;
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Customer ID Selection Table State
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [custPage, setCustPage] = useState(1);
  const [custTotalPages, setCustTotalPages] = useState(1);
  const [custTotal, setCustTotal] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [searchId, setSearchId] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [loadingCust, setLoadingCust] = useState(false);

  // Campaign Form State
  const [campaignName, setCampaignName] = useState('VIP Retention Campaign');
  const [targetGroup, setTargetGroup] = useState('High-Value At Risk');
  const [subject, setSubject] = useState("We'd love to see you again 🎁");
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  const [offerType] = useState('Percentage Off');
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [message, setMessage] = useState('We miss your visits! Enjoy an exclusive discount on your next order as a thank you for being a valued customer.');

  // Email Preview Modal State
  const [previewData, setPreviewData] = useState<EmailPreviewResponse | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; message: string; message_id?: string } | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [sumData, recData, prodData, custData, histData, statusData] = await Promise.all([
        fetchRetentionSummary(),
        fetchRecommendedCampaigns(),
        fetchExpiryProducts('Expiring Soon'),
        fetchExpiryCustomers(),
        fetchCampaignHistory(),
        fetchEmailStatus()
      ]);
      setSummary(sumData);
      setRecommended(recData);
      setExpiringProducts(prodData);
      setTargetCustomers(custData);
      setCampaignHistory(histData.campaigns || []);
      setAuditLogs(histData.audit_logs || []);
      setEmailStatus(statusData);
      if (custData && histData) {
        // Log telemetry
      }
    } catch (err) {
      console.error("Failed to load retention campaign data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    setLoadingCust(true);
    try {
      const res = await fetchRetentionCustomers(
        custPage,
        8,
        selectedSegment,
        selectedRisk,
        selectedProductCode || undefined,
        searchId
      );
      setCustomerList(res.customers || []);
      setCustTotalPages(res.total_pages || 1);
      setCustTotal(res.total || 0);
    } catch (err) {
      console.error("Error loading customer list:", err);
    } finally {
      setLoadingCust(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [custPage, selectedSegment, selectedRisk, selectedProductCode, searchId]);

  const handleSelectRecommendation = (rec: RecommendedCampaign) => {
    setCampaignName(rec.campaign_name.replace(/^[^\w\s]+\s*/, ''));
    setTargetGroup(rec.target_group);
    if (rec.target_product_code) setSelectedProductCode(rec.target_product_code);
    setDiscountPercent(rec.suggested_discount);
    setSubject(`Special Offer for You 🎁`);
    setMessage(rec.suggested_message);
    window.scrollTo({ top: 600, behavior: 'smooth' });
  };

  const handleToggleCustomer = (cid: string) => {
    if (selectedCustomerIds.includes(cid)) {
      setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== cid));
    } else {
      setSelectedCustomerIds([...selectedCustomerIds, cid]);
    }
  };

  const handleSelectAllCurrentPage = () => {
    const pageIds = customerList.map(c => c.customer_id);
    const allSelected = pageIds.every(id => selectedCustomerIds.includes(id));
    if (allSelected) {
      setSelectedCustomerIds(selectedCustomerIds.filter(id => !pageIds.includes(id)));
    } else {
      const newSelected = new Set([...selectedCustomerIds, ...pageIds]);
      setSelectedCustomerIds(Array.from(newSelected));
    }
  };

  const selectedMetrics = customerList
    .filter(c => selectedCustomerIds.includes(c.customer_id))
    .reduce((acc, c) => ({
      val: acc.val + (c.predicted_future_value || 0),
      risk: acc.risk + (c.revenue_at_risk || 0)
    }), { val: 0, risk: 0 });

  const handlePreview = async () => {
    try {
      const prev = await previewEmail({
        campaign_name: campaignName,
        target_group: targetGroup,
        selected_customer_ids: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        target_product_code: selectedProductCode || undefined,
        discount_percent: discountPercent,
        subject: subject,
        message: message
      });
      setPreviewData(prev);
      setTestResult(null);
      setIsPreviewOpen(true);
    } catch (err) {
      console.error("Failed to generate email preview:", err);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res: EmailTestResponse = await sendTestEmail({
        campaign_name: campaignName,
        target_group: targetGroup,
        subject: subject,
        message: message,
        selected_customer_ids: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        discount_percent: discountPercent
      });
      
      await createCampaign({
        campaign_name: campaignName,
        target_group: targetGroup,
        target_product_code: selectedProductCode || undefined,
        offer_type: offerType,
        discount_percent: discountPercent,
        subject: subject,
        message: message
      });

      setTestResult({
        status: res.status,
        message: res.message,
        message_id: res.message_id
      });

      fetchCampaignHistory().then(hist => {
        setCampaignHistory(hist.campaigns || []);
        setAuditLogs(hist.audit_logs || []);
      });
    } catch (err) {
      setTestResult({
        status: 'Failed',
        message: '⚠️ Connection error communicating with backend Brevo service.'
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
        Loading Retention Campaigns & Email Integration...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Banner */}
      <div className="glass-card" style={{ padding: '24px 28px', borderLeft: '4px solid #6366F1', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(18, 24, 38, 0.8))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Mail color="#6366F1" size={26} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Retention Campaigns & Email Marketing
              </h2>
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.92rem', margin: 0 }}>
              Select targeted customers needing attention, craft personalized retention offers, and send real test emails via Brevo.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', background: emailStatus?.configured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: emailStatus?.configured ? '#34D399' : '#FDE047', border: emailStatus?.configured ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)', padding: '6px 14px', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} />
              {emailStatus?.configured ? `Brevo API Configured (${emailStatus.demo_recipient})` : "Email Service Not Configured"}
            </span>

            {onOpenCopilot && (
              <button onClick={onOpenCopilot} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#818CF8" />
                Ask Assistant
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top Business KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Needs Attention</span>
            <AlertTriangle size={18} color="#EF4444" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>
            {summary?.customers_needing_attention.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Accounts showing reduced activity</div>
        </div>

        <div className="glass-card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>High-Value At Risk</span>
            <UserCheck size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F59E0B' }}>
            {summary?.high_value_customers_at_risk.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Top tier historical spenders</div>
        </div>

        <div className="glass-card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Revenue at Risk</span>
            <PoundSterling size={18} color="#818CF8" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818CF8' }}>
            £{summary?.potential_revenue_at_risk.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Total potential revenue exposure</div>
        </div>

        <div className="glass-card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Expiring Products</span>
            <Package size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>
            {summary?.products_expiring_soon}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Items nearing synthetic expiry</div>
        </div>
      </div>

      {/* Recommended Campaigns */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} color="#818CF8" /> Recommended Retention Actions
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {recommended.map((rec) => (
            <div key={rec.id} style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC', marginBottom: '6px' }}>
                  {rec.campaign_name}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: '10px' }}>
                  {rec.reason}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#818CF8', fontWeight: 600 }}>
                  Target: {rec.target_group} ({rec.customer_count} accounts • £{rec.potential_revenue_at_risk.toLocaleString()} risk)
                </div>
              </div>
              <button
                onClick={() => handleSelectRecommendation(rec)}
                className="btn-secondary"
                style={{ marginTop: '14px', width: '100%', textAlign: 'center', fontSize: '0.82rem', padding: '8px' }}
              >
                Use Template &rarr;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Selection & Search Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="#818CF8" /> Select Targeted Customers ({custTotal.toLocaleString()} available)
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Filter accounts, check specific Customer IDs, and generate personalized email offers.
            </p>
          </div>

          {selectedCustomerIds.length > 0 && (
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '10px', padding: '6px 14px', fontSize: '0.82rem', color: '#A5B4FC', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Selected: <strong>{selectedCustomerIds.length}</strong> customers</span>
              <span>Value: <strong>£{selectedMetrics.val.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong></span>
              <span>Risk: <strong>£{selectedMetrics.risk.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong></span>
              <button onClick={() => setSelectedCustomerIds([])} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by Customer ID (e.g. 13085)..."
              value={searchId}
              onChange={(e) => { setSearchId(e.target.value); setCustPage(1); }}
              style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.85rem' }}
            />
          </div>

          <select
            value={selectedSegment}
            onChange={(e) => { setSelectedSegment(e.target.value); setCustPage(1); }}
            style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.85rem' }}
          >
            <option value="all">All Customer Groups</option>
            <option value="High-Value At Risk">High-Value At Risk</option>
            <option value="Active Casuals">Active Casuals</option>
            <option value="Loyal Regulars">Loyal Regulars</option>
            <option value="High-Risk Lost">High-Risk Lost</option>
          </select>

          <select
            value={selectedRisk}
            onChange={(e) => { setSelectedRisk(e.target.value); setCustPage(1); }}
            style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.85rem' }}
          >
            <option value="all">All Attention Levels</option>
            <option value="high">Needs Attention (High)</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Risk</option>
          </select>
        </div>

        {/* Customer Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <button onClick={handleSelectAllCurrentPage} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8' }}>
                    {customerList.length > 0 && customerList.every(c => selectedCustomerIds.includes(c.customer_id)) ? (
                      <CheckSquare size={18} />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th>Customer ID</th>
                <th>Customer Group</th>
                <th>Attention Level</th>
                <th>Customer Value</th>
                <th>Revenue at Risk</th>
                <th>Synthetic Email (Demo)</th>
              </tr>
            </thead>
            <tbody>
              {loadingCust ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>Loading customer list...</td>
                </tr>
              ) : customerList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>No customers match the current search filters.</td>
                </tr>
              ) : (
                customerList.map((c) => {
                  const isChecked = selectedCustomerIds.includes(c.customer_id);
                  const isHighRisk = c.churn_probability >= 0.70;
                  return (
                    <tr key={c.customer_id} style={{ background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'transparent' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCustomer(c.customer_id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: '#F8FAFC' }}>Customer #{c.customer_id}</td>
                      <td>{c.segment_name}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isHighRisk ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isHighRisk ? '#FCA5A5' : '#FDE047'
                        }}>
                          {isHighRisk ? 'Needs Attention' : 'Medium Priority'}
                        </span>
                      </td>
                      <td>£{c.predicted_future_value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
                      <td style={{ color: '#FCA5A5', fontWeight: 600 }}>£{c.revenue_at_risk.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
                      <td style={{ fontSize: '0.8rem', color: '#94A3B8' }}>customer_{c.customer_id}@example.com</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '0.82rem', color: '#94A3B8' }}>
          <span>Page {custPage} of {custTotalPages}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={custPage <= 1}
              onClick={() => setCustPage(p => p - 1)}
              className="btn-secondary"
              style={{ padding: '4px 12px', fontSize: '0.8rem' }}
            >
              &larr; Previous
            </button>
            <button
              disabled={custPage >= custTotalPages}
              onClick={() => setCustPage(p => p + 1)}
              className="btn-secondary"
              style={{ padding: '4px 12px', fontSize: '0.8rem' }}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Campaign Form & Customizer */}
      <div className="glass-card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Gift color="#10B981" size={24} /> Create Personalized Retention Offer
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>
              Email Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>
              Target Product (Optional)
            </label>
            <select
              value={selectedProductCode}
              onChange={(e) => setSelectedProductCode(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC' }}
            >
              <option value="">No specific product requirement</option>
              {expiringProducts.map(p => (
                <option key={p.stock_code} value={p.stock_code}>
                  {p.description} (Expiring in {p.expiry_days_remaining}d)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>
              Discount Offer ({discountPercent}%)
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366F1' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>
            Personalized Email Message
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.9rem', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={handlePreview}
            className="btn-primary"
            style={{ padding: '12px 24px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Mail size={18} />
            Preview Email Offer ({selectedCustomerIds.length > 0 ? `${selectedCustomerIds.length} Selected` : 'Demo Account'})
          </button>
        </div>
      </div>

      {/* Campaign History & Audit Log */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="#818CF8" /> Email Campaign Delivery Audit Log
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>Campaign Name</th>
                <th>Subject</th>
                <th>Reach</th>
                <th>Delivery Mode</th>
                <th>Real Recipient</th>
                <th>Brevo Message ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: '#94A3B8' }}>No email delivery history yet.</td>
                </tr>
              ) : (
                auditLogs.map((log) => {
                  const isAccepted = log.status?.includes("Accepted");
                  const isFailed = log.status?.includes("Failed");
                  return (
                    <tr key={log.id}>
                      <td>#{log.id}</td>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{log.campaign_name}</td>
                      <td style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>{log.subject}</td>
                      <td>{log.customer_count} cust</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          {log.delivery_mode}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#F8FAFC' }}>{log.recipient}</td>
                      <td style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                        {log.provider_message_id ? log.provider_message_id.slice(0, 20) + '...' : '-'}
                      </td>
                      <td>
                        <span className={`badge-status ${isAccepted ? 'badge-ok' : isFailed ? 'badge-error' : ''}`} style={{ background: isAccepted ? 'rgba(16, 185, 129, 0.15)' : isFailed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: isAccepted ? '#34D399' : isFailed ? '#FCA5A5' : '#FDE047' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Test Preview Modal */}
      {isPreviewOpen && previewData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '580px', padding: '28px', background: '#0B0F17', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.3)', boxShadow: '0 25px 60px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail color="#818CF8" size={24} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                  Email Offer Preview
                </h3>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}>
                ✕
              </button>
            </div>

            {/* Configured vs Not Configured Banner */}
            {emailStatus?.configured ? (
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', fontSize: '0.82rem', color: '#34D399', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} />
                <span><strong>BREVO READY:</strong> Real test email will deliver ONLY to shopkeeper recipient: <strong>{previewData.demo_recipient}</strong>.</span>
              </div>
            ) : (
              <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', fontSize: '0.82rem', color: '#FDE047', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#F59E0B" />
                <span><strong>🧪 DEMO MODE:</strong> Email service not configured yet. Add <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px' }}>BREVO_API_KEY</code> to <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px' }}>.env</code> to enable live delivery.</span>
              </div>
            )}

            {/* HTML Email Mock Box */}
            <div dangerouslySetInnerHTML={{ __html: previewData.formatted_html_preview }} style={{ marginBottom: '20px' }} />

            {/* Result Toast */}
            {testResult && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                lineHeight: 1.4,
                marginBottom: '16px',
                background: testResult.status === 'Accepted by Brevo' ? 'rgba(16, 185, 129, 0.15)' : testResult.status === 'Failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: testResult.status === 'Accepted by Brevo' ? '1px solid rgba(16, 185, 129, 0.3)' : testResult.status === 'Failed' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                color: testResult.status === 'Accepted by Brevo' ? '#34D399' : testResult.status === 'Failed' ? '#FCA5A5' : '#FDE047'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {testResult.status === 'Accepted by Brevo' ? <CheckCircle size={16} /> : testResult.status === 'Failed' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                  Status: {testResult.status}
                </div>
                <div>{testResult.message}</div>
                {testResult.message_id && (
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8 }}>Brevo ID: {testResult.message_id}</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setIsPreviewOpen(false)}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              
              <button
                onClick={handleSendTestEmail}
                disabled={sendingTest}
                style={{ flex: 2, padding: '12px', background: emailStatus?.configured ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {sendingTest ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                Send Test Email ({emailStatus?.configured ? 'Via Brevo' : 'Check Status'})
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
