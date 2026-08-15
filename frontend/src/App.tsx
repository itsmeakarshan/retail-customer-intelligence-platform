import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import type { DashboardItem } from './components/Header';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { CustomerRiskTable } from './components/CustomerRiskTable';
import { SegmentationPage } from './components/SegmentationPage';
import { RevenueRiskPage } from './components/RevenueRiskPage';
import { RetentionCampaignsPage } from './components/RetentionCampaignsPage';
import { ExpiryProductsPage } from './components/ExpiryProductsPage';
import { DemandForecastingPage } from './components/DemandForecastingPage';
import { InventoryOptimisationPage } from './components/InventoryOptimisationPage';
import { PriceAnalyticsPage } from './components/PriceAnalyticsPage';
import { MonitoringPage } from './components/MonitoringPage';
import { UploadPage } from './components/UploadPage';
import { ModelPerformancePage } from './components/ModelPerformancePage';
import { DataQualityPage } from './components/DataQualityPage';
import { BusinessAssistantDrawer } from './components/BusinessAssistantDrawer';
import { NewDashboardModal } from './components/NewDashboardModal';
import { fetchHealth } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isNewDashboardModalOpen, setIsNewDashboardModalOpen] = useState(false);

  // Multi-Dashboard State Registry
  const [dashboards, setDashboards] = useState<DashboardItem[]>([
    { id: 'default', name: 'Customer Intelligence (Default)' }
  ]);
  const [activeDashboardId, setActiveDashboardId] = useState('default');

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

  const handleDashboardCreated = (newSessionId: string, fileName: string) => {
    const dashNum = dashboards.length + 1;
    const newDash: DashboardItem = {
      id: newSessionId,
      name: `Dashboard ${dashNum}: ${fileName}`
    };
    setDashboards(prev => [...prev, newDash]);
    setActiveDashboardId(newSessionId);
    setActiveTab('dashboard');
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', background: 'var(--bg-dark, #0B0F17)', color: 'var(--text-main, #F8FAFC)', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isBackendHealthy={isBackendHealthy}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenNewDashboard={() => setIsNewDashboardModalOpen(true)}
        dashboards={dashboards}
        activeDashboardId={activeDashboardId}
        onSelectDashboard={(id) => setActiveDashboardId(id)}
      />

      <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {activeTab === 'dashboard' && (
          <ExecutiveDashboard
            onNavigateToRisk={() => setActiveTab('risk')}
            onNavigateTab={(tab) => setActiveTab(tab)}
            activeDashboardId={activeDashboardId}
          />
        )}
        {activeTab === 'risk' && <CustomerRiskTable activeDashboardId={activeDashboardId} />}
        {activeTab === 'segmentation' && <SegmentationPage activeDashboardId={activeDashboardId} onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'revenue' && <RevenueRiskPage activeDashboardId={activeDashboardId} onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'forecasting' && <DemandForecastingPage activeDashboardId={activeDashboardId} onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'inventory' && <InventoryOptimisationPage activeDashboardId={activeDashboardId} onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'pricing' && <PriceAnalyticsPage activeDashboardId={activeDashboardId} onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'expiry' && <ExpiryProductsPage activeDashboardId={activeDashboardId} onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'retention' && <RetentionCampaignsPage onOpenCopilot={() => setIsAssistantOpen(true)} activeDashboardId={activeDashboardId} />}
        {activeTab === 'models' && <ModelPerformancePage />}
        {activeTab === 'monitoring' && <MonitoringPage activeDashboardId={activeDashboardId} onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'data' && <DataQualityPage />}
        {activeTab === 'upload' && <UploadPage />}
      </main>

      <BusinessAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onOpen={() => setIsAssistantOpen(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        activeDashboardId={activeDashboardId}
      />

      <NewDashboardModal
        isOpen={isNewDashboardModalOpen}
        onClose={() => setIsNewDashboardModalOpen(false)}
        onDashboardCreated={handleDashboardCreated}
      />
    </div>
  );
}

export default App;
