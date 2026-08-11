import React from 'react';
import { LayoutDashboard, Users, PieChart, TrendingDown, Target, Cpu, Database, Activity, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isBackendHealthy: boolean;
  onOpenAssistant: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isBackendHealthy, onOpenAssistant }) => {
  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'risk', label: 'Customers', icon: Users },
    { id: 'segmentation', label: 'Customer Groups', icon: PieChart },
    { id: 'revenue', label: 'Revenue Risk', icon: TrendingDown },
    { id: 'retention', label: 'Retention Campaigns', icon: Target },
    { id: 'models', label: 'Model Insights', icon: Cpu },
    { id: 'data', label: 'Data Quality', icon: Database },
  ];

  return (
    <header className="navbar glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
      <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Activity className="text-indigo-400" size={28} color="var(--primary-accent)" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 className="nav-brand-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Customer Intelligence</h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Revenue Risk Platform</span>
        </div>
      </div>

      <nav className="nav-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: '1 1 auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', minWidth: '250px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent', color: activeTab === tab.id ? 'var(--primary-accent)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500, transition: 'all 0.2s' }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onOpenAssistant}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, var(--primary-accent), #818CF8)',
            color: '#FFF',
            border: 'none',
            borderRadius: 20,
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(99, 102, 241, 0.4)',
            animation: 'pulse 2s infinite',
            whiteSpace: 'nowrap'
          }}
        >
          <Sparkles size={16} /> Business Copilot ✨
        </button>

        <div className={`badge-status ${isBackendHealthy ? 'badge-ok' : 'badge-error'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: isBackendHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isBackendHealthy ? 'var(--color-emerald)' : 'var(--color-rose)', whiteSpace: 'nowrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isBackendHealthy ? 'var(--color-emerald)' : 'var(--color-rose)' }} />
          {isBackendHealthy ? 'API Online' : 'API Offline'}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
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
