import React from 'react';
import {
  LayoutDashboard,
  Users,
  PieChart,
  TrendingDown,
  Target,
  Cpu,
  Database,
  Activity,
  Sparkles,
  Package,
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Boxes,
  PoundSterling
} from 'lucide-react';

export interface DashboardItem {
  id: string;
  name: string;
}

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isBackendHealthy: boolean;
  onOpenAssistant: () => void;
  onOpenNewDashboard: () => void;
  dashboards: DashboardItem[];
  activeDashboardId: string;
  onSelectDashboard: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isBackendHealthy: _isBackendHealthy,
  onOpenAssistant,
  onOpenNewDashboard,
  dashboards,
  activeDashboardId,
  onSelectDashboard
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, isAction: false },
    { id: 'risk', label: 'Customers', icon: Users, isAction: false },
    { id: 'segmentation', label: 'Customer Groups', icon: PieChart, isAction: false },
    { id: 'revenue', label: 'Revenue Risk', icon: TrendingDown, isAction: false },
    { id: 'forecasting', label: 'Demand Forecasting', icon: TrendingUp, isAction: false },
    { id: 'inventory', label: 'Inventory Optimisation', icon: Boxes, isAction: true },
    { id: 'pricing', label: 'Price Analytics', icon: PoundSterling, isAction: false },
    { id: 'expiry', label: 'Expiry Products', icon: Package, isAction: true },
    { id: 'retention', label: 'Retention Campaigns', icon: Target, isAction: true },
    { id: 'models', label: 'Model Insights', icon: Cpu, isAction: false },
    { id: 'monitoring', label: 'Monitoring', icon: Activity, isAction: false },
    { id: 'data', label: 'Data Quality', icon: Database, isAction: false },
  ];

  const activeIndex = dashboards.findIndex(d => d.id === activeDashboardId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentDash = dashboards[currentIndex] || dashboards[0];

  const handlePrevDashboard = () => {
    if (currentIndex > 0) {
      onSelectDashboard(dashboards[currentIndex - 1].id);
    }
  };

  const handleNextDashboard = () => {
    if (currentIndex < dashboards.length - 1) {
      onSelectDashboard(dashboards[currentIndex + 1].id);
    }
  };

  const mainTabs = tabs.slice(0, 9);
  const systemTabs = tabs.slice(9);

  return (
    <header className="navbar glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 24px' }}>
      {/* ROW 1: BRAND + MAIN BUSINESS TABS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={28} color="var(--primary-accent)" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="nav-brand-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Customer Intelligence</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Revenue Risk Platform</span>
          </div>
        </div>

        <nav className="nav-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: '1 1 auto', justifyContent: 'space-between' }}>
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isAction = tab.isAction;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '1 1 auto',
                  gap: '6px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: isAction
                    ? (isActive ? '1px solid #818CF8' : '1px solid rgba(99, 102, 241, 0.4)')
                    : (isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent'),
                  background: isActive
                    ? (isAction ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(79, 70, 229, 0.15))' : 'rgba(99, 102, 241, 0.15)')
                    : (isAction ? 'rgba(99, 102, 241, 0.08)' : 'transparent'),
                  color: isActive
                    ? '#F8FAFC'
                    : (isAction ? '#A5B4FC' : 'var(--text-muted)'),
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: isAction ? 700 : 500,
                  fontSize: '0.825rem',
                  boxShadow: isAction && isActive ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={15} color={isAction ? (isActive ? '#A5B4FC' : '#818CF8') : undefined} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ROW 2: FAR LEFT = LAST 3 TABS (Model Insights, Monitoring, Data Quality) | FAR RIGHT = ACTIVE DASHBOARD & CONTROLS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        {/* FAR LEFT: LAST 3 BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {systemTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#F8FAFC' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={15} color={isActive ? '#818CF8' : undefined} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* FAR RIGHT: DASHBOARD SWITCHER & ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onOpenNewDashboard}
            title="Create New Dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#A5B4FC',
              border: '1px solid rgba(129, 140, 248, 0.4)',
              borderRadius: 20,
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={15} /> New Dashboard
          </button>

          <button
            onClick={onOpenAssistant}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              background: 'linear-gradient(135deg, var(--primary-accent), #818CF8)',
              color: '#FFF',
              border: 'none',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(99, 102, 241, 0.4)',
              animation: 'pulse 2s infinite',
              whiteSpace: 'nowrap'
            }}
          >
            <Sparkles size={15} /> Business Copilot ✨
          </button>

          {/* Dashboard Switcher Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--bg-card-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}>
            <button
              onClick={handlePrevDashboard}
              disabled={currentIndex === 0}
              title="Previous Dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: currentIndex === 0 ? 'transparent' : 'rgba(37, 99, 235, 0.15)',
                border: currentIndex === 0 ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(37, 99, 235, 0.3)',
                color: currentIndex === 0 ? 'var(--text-muted, #64748B)' : '#2563EB',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === 0 ? 0.35 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={14} />
            </button>

            <span
              title={currentDash?.name || 'Customer Intelligence'}
              style={{
                color: 'var(--text-main, #F8FAFC)',
                fontWeight: 700,
                fontSize: '0.825rem',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                padding: '0 2px'
              }}
            >
              Active Dashboard {currentIndex + 1}
            </span>

            <button
              onClick={handleNextDashboard}
              disabled={currentIndex === dashboards.length - 1}
              title="Next Dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: currentIndex === dashboards.length - 1 ? 'transparent' : 'rgba(37, 99, 235, 0.15)',
                border: currentIndex === dashboards.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(37, 99, 235, 0.3)',
                color: currentIndex === dashboards.length - 1 ? 'var(--text-muted, #64748B)' : '#2563EB',
                cursor: currentIndex === dashboards.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === dashboards.length - 1 ? 0.35 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        .nav-tabs::-webkit-scrollbar { display: none; }
      `}} />
    </header>
  );
};
