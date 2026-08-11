import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { CustomerRiskTable } from './components/CustomerRiskTable';
import { SegmentationPage } from './components/SegmentationPage';
import { RevenueRiskPage } from './components/RevenueRiskPage';
import { RetentionCampaignsPage } from './components/RetentionCampaignsPage';
import { ModelPerformancePage } from './components/ModelPerformancePage';
import { DataQualityPage } from './components/DataQualityPage';
import { BusinessAssistantDrawer } from './components/BusinessAssistantDrawer';
import { fetchHealth } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetchHealth();
        setIsBackendHealthy(res.status === 'ok');
      } catch (err) {
        setIsBackendHealthy(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container" style={{ minHeight: '100vh', background: 'var(--bg-dark, #0B0F17)', color: 'var(--text-main, #F8FAFC)', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isBackendHealthy={isBackendHealthy}
        onOpenAssistant={() => setIsAssistantOpen(true)}
      />

      <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {activeTab === 'dashboard' && (
          <ExecutiveDashboard
            onNavigateToRisk={() => setActiveTab('risk')}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === 'risk' && <CustomerRiskTable />}
        {activeTab === 'segmentation' && <SegmentationPage />}
        {activeTab === 'revenue' && <RevenueRiskPage />}
        {activeTab === 'retention' && <RetentionCampaignsPage onOpenCopilot={() => setIsAssistantOpen(true)} />}
        {activeTab === 'models' && <ModelPerformancePage />}
        {activeTab === 'data' && <DataQualityPage />}
      </main>

      <BusinessAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onOpen={() => setIsAssistantOpen(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}

export default App;
