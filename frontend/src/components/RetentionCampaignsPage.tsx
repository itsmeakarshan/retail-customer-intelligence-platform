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
  Sparkles,
  ShieldCheck,
  CheckCircle,
  UserCheck,
  Mail,
  RefreshCw,
  Gift,
  XCircle,
  Search
} from 'lucide-react';

import { RecommendedActionCard } from './RecommendedActionCard';

export const RetentionCampaignsPage: React.FC<{ onOpenCopilot?: () => void; activeDashboardId?: string }> = ({ onOpenCopilot, activeDashboardId = 'default' }) => {
  const [summary, setSummary] = useState<RetentionSummary | null>(null);
  const [recommended, setRecommended] = useState<RecommendedCampaign[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<ExpiryProduct[]>([]);
  const [targetCustomers, setTargetCustomers] = useState<any[]>([]);
  void targetCustomers;
  void expiringProducts;
  const [emailStatus, setEmailStatus] = useState<EmailStatusResponse | null>(null);
  const [emailRecipient, setEmailRecipient] = useState<string>('akarshanrasyal4@gmail.com');
  const [loading, setLoading] = useState(true);

  // Customer ID Selection Table State
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [custPage, setCustPage] = useState(1);
  const [custTotalPages, setCustTotalPages] = useState(1);
  const [custTotal, setCustTotal] = useState(0);
  void custTotal;
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [searchId, setSearchId] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [loadingCust, setLoadingCust] = useState(false);
  const [hoveredSegIndex, setHoveredSegIndex] = useState<number | null>(null);

  // Campaign Form State
  const [campaignName, setCampaignName] = useState('VIP Retention Campaign');
  const [targetGroup, setTargetGroup] = useState('At-Risk VIP Customers');
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
      const [sumData, recData, prodData, custData, statusData] = await Promise.all([
        fetchRetentionSummary(activeDashboardId),
        fetchRecommendedCampaigns(activeDashboardId),
        fetchExpiryProducts('Expiring Soon'),
        fetchExpiryCustomers(),
        fetchEmailStatus()
      ]);
      setSummary(sumData);
      setRecommended(recData);
      setExpiringProducts(prodData);
      setTargetCustomers(custData);
      setEmailStatus(statusData);
      if (statusData?.demo_recipient) {
        setEmailRecipient(statusData.demo_recipient);
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
  }, [activeDashboardId]);

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
      val: acc.val + (c.expected_30d_revenue || (c.predicted_future_value / 3.0) || 0),
      risk: acc.risk + (c.company_may_lose_30d || (c.revenue_at_risk / 3.0) || 0)
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
        message: message,
        recipient_email: emailRecipient
      });
      setPreviewData(prev);
      setTestResult(null);
      setIsPreviewOpen(true);
    } catch (err: any) {
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
        discount_percent: discountPercent,
        recipient_email: emailRecipient
      });

      setTestResult({
        status: res.status,
        message: res.message,
        message_id: res.message_id
      });

      try {
        await createCampaign({
          campaign_name: campaignName,
          target_group: targetGroup,
          target_product_code: selectedProductCode || undefined,
          offer_type: offerType,
          discount_percent: discountPercent,
          subject: subject,
          message: message
        });
      } catch (campErr) {
        console.warn("Notice: Campaign logged with error:", campErr);
      }
    } catch (err: any) {
      setTestResult({
        status: 'Failed',
        message: err.message || '⚠️ Connection error communicating with backend Brevo service.'
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Send size={24} color="#818CF8" />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
                Retention Campaigns & Customer Outreach
              </h2>
            </div>
            <span style={{ fontSize: '0.82rem', background: emailStatus?.configured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: emailStatus?.configured ? '#34D399' : '#FDE047', border: emailStatus?.configured ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)', padding: '6px 14px', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginTop: 8 }}>
              <ShieldCheck size={16} />
              {emailStatus?.configured ? `Brevo API Configured (${emailStatus.demo_recipient})` : "Email Service Not Configured"}
            </span>

            {onOpenCopilot && (
              <button onClick={onOpenCopilot} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 8 }}>
                <Sparkles size={16} color="#818CF8" />
                Ask Assistant
              </button>
            )}
          </div>
        </div>
      </div>

      <RecommendedActionCard
        title="High-Priority Retention Action"
        subtitle={`Identified ${summary?.customers_needing_attention || 0} high-risk accounts requiring re-engagement.`}
        metricLabel="Target At-Risk Accounts"
        metricValue={`${summary?.customers_needing_attention || 0} Customers`}
        recommendedAction="Launch automated winback offers with personalized discount codes."
        buttonText="Select Target Accounts Below"
        onActionClick={() => window.scrollTo({ top: 900, behavior: 'smooth' })}
        type="info"
      />

      {/* Top Business KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card metric-card" style={{ minHeight: '135px', padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Needs Attention</span>
            <AlertTriangle size={18} color="#EC4899" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EC4899' }}>
            {summary?.customers_needing_attention.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>Accounts showing reduced activity</div>
        </div>

        <div className="glass-card metric-card" style={{ minHeight: '135px', padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>At-Risk VIP Customers</span>
            <UserCheck size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F59E0B' }}>
            {summary?.high_value_customers_at_risk.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>VIP customers requiring retention</div>
        </div>

        <div className="glass-card metric-card" style={{ minHeight: '135px', padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Company May Lose</span>
            <PoundSterling size={18} color="#818CF8" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818CF8' }}>
            £{(summary?.company_may_lose_30d || (summary?.potential_revenue_at_risk ? summary.potential_revenue_at_risk / 3.0 : 0)).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#818CF8', fontWeight: 600, marginTop: '6px' }}>
            ↓ {summary?.loss_percentage_30d ? summary.loss_percentage_30d.toFixed(1) : '25.8'}% of expected 30-day revenue
          </div>
        </div>
      </div>

      {/* Interactive Retention Targets Donut Chart */}
      {(() => {
        const donutR = 75;
        const circumference = 2 * Math.PI * donutR;
        const hvRisk = summary?.high_value_customers_at_risk || 0;
        const totalAttention = summary?.customers_needing_attention || 1;
        const otherAttention = Math.max(0, totalAttention - hvRisk);

        const items = [
          { name: 'At-Risk VIP Customers', value: hvRisk, pct: hvRisk / totalAttention, color: '#F59E0B' },
          { name: 'Standard Accounts at Risk', value: otherAttention, pct: otherAttention / totalAttention, color: '#EC4899' }
        ];

        const segGapPx = 14;
        const totalSegGap = items.length * segGapPx;
        const availSegCircumference = Math.max(0, circumference - totalSegGap);

        let currentSegOffset = 0;
        const styledItems = items.map((item, idx) => {
          const rawLen = item.pct * availSegCircumference;
          const dashLength = Math.max(1, rawLen);
          const offset = currentSegOffset;
          currentSegOffset += dashLength + segGapPx;
          return {
            ...item,
            id: idx,
            pctDisplay: (item.pct * 100).toFixed(1),
            dashLength,
            offset
          };
        });

        return (
          <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                  Retention Priority Share
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94A3B8)', margin: '4px 0 0 0' }}>
                  Share of at-risk accounts by VIP tier priority.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
              {/* Donut Canvas */}
              <div style={{ position: 'relative', width: '190px', height: '190px', flexShrink: 0, margin: '0 auto' }}>
                <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}>
                  <circle cx="110" cy="110" r="75" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
                  {styledItems.map((seg, i) => (
                    <circle
                      key={i}
                      cx="110"
                      cy="110"
                      r="75"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={hoveredSegIndex === i ? "18" : "14"}
                      strokeLinecap="round"
                      strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
                      strokeDashoffset={-seg.offset}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: hoveredSegIndex === i ? `drop-shadow(0 0 12px ${seg.color})` : 'none'
                      }}
                      onMouseEnter={() => setHoveredSegIndex(i)}
                      onMouseLeave={() => setHoveredSegIndex(null)}
                    />
                  ))}
                </svg>

                {/* Center Donut Label */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #94A3B8)' }}>
                    At Risk
                  </span>
                  <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.02em', marginTop: '2px' }}>
                    {summary?.customers_needing_attention.toLocaleString()}
                  </span>
                </div>

                {/* Floating Dark Tooltip Box */}
                {hoveredSegIndex !== null && styledItems[hoveredSegIndex] && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '100%',
                    transform: 'translate(10px, -50%)',
                    background: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    color: '#F8FAFC',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.7), 0 0 20px rgba(236,72,153,0.25)',
                    zIndex: 30,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: styledItems[hoveredSegIndex].color }}>
                      {styledItems[hoveredSegIndex].name}
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                      {styledItems[hoveredSegIndex].value.toLocaleString()} <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 400 }}>({styledItems[hoveredSegIndex].pctDisplay}%)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Legend Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: '180px' }}>
                {styledItems.map((seg, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredSegIndex(i)}
                    onMouseLeave={() => setHoveredSegIndex(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: hoveredSegIndex === i ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, boxShadow: `0 0 6px ${seg.color}` }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #F8FAFC)' }}>
                        {seg.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: seg.color }}>
                      {seg.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Summary Stats Split into 2 Columns */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '16px',
              marginTop: '16px'
            }}>
              <div style={{ textAlign: 'center', paddingRight: '12px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F59E0B' }}>
                  {hvRisk.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                  High-Priority VIP Accounts
                </div>
              </div>

              <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '12px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EC4899' }}>
                  {otherAttention.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', fontWeight: 500 }}>
                  Standard At Risk Accounts
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                  Target: {rec.target_group} ({rec.customer_count} accounts • Company May Lose: £{rec.company_may_lose_30d ? rec.company_may_lose_30d.toLocaleString() : rec.potential_revenue_at_risk.toLocaleString()} • ↓ {rec.loss_percentage_30d ? rec.loss_percentage_30d.toFixed(1) : '25.8'}%)
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
              Select Specific Customers to Target
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
              Check boxes to pick customer accounts for offer targeting. Total Selected: {selectedCustomerIds.length} | Expected 30d Spend: £{selectedMetrics.val.toLocaleString('en-GB', { maximumFractionDigits: 0 })} | Company May Lose: £{selectedMetrics.risk.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search Customer ID..."
                value={searchId}
                onChange={(e) => { setSearchId(e.target.value); setCustPage(1); }}
                style={{ padding: '8px 12px 8px 32px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.85rem', width: '180px' }}
              />
            </div>

            <select
              value={selectedSegment}
              onChange={(e) => { setSelectedSegment(e.target.value); setCustPage(1); }}
              style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.85rem' }}
            >
              <option value="all">All Groups</option>
              <option value="Top VIP Customers">Top VIP Customers</option>
              <option value="At-Risk VIP Customers">At-Risk VIP Customers</option>
              <option value="Active Customers">Active Customers</option>
              <option value="Inactive / Dormant Customers">Inactive / Dormant Customers</option>
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
        </div>

        {/* Customer Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={customerList.length > 0 && customerList.every(c => selectedCustomerIds.includes(c.customer_id))}
                    onChange={handleSelectAllCurrentPage}
                  />
                </th>
                <th>Customer ID</th>
                <th>Customer Group</th>
                <th>Attention Level</th>
                <th>Expected Spend — Next 30 Days</th>
                <th>Company May Lose</th>
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
                  const exp30 = c.expected_30d_revenue || (c.predicted_future_value / 3.0);
                  const lose30 = c.company_may_lose_30d || (c.revenue_at_risk / 3.0);

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
                      <td>£{exp30.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
                      <td style={{ color: '#FCA5A5', fontWeight: 600 }}>£{lose30.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
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
              Recipient Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. akarshanrasyal4@gmail.com"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
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
                <span><strong>BREVO READY:</strong> Live test email will be sent via Brevo to: <strong>{emailRecipient}</strong>.</span>
              </div>
            ) : (
              <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', fontSize: '0.82rem', color: '#FDE047', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#F59E0B" />
                <span><strong>🧪 DEMO MODE:</strong> Email service not configured yet. Add <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px' }}>BREVO_API_KEY</code> to <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px' }}>.env</code> to enable live delivery.</span>
              </div>
            )}

            {/* Editable recipient field inside modal */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600, marginBottom: '4px' }}>
                Send Test Email To:
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="Enter recipient email..."
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', color: '#F8FAFC', fontSize: '0.88rem' }}
              />
            </div>

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
