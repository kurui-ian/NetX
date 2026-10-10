import React from 'react';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { NetXProvider, useNetX } from './context/NetXContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { DashboardView } from './views/DashboardView';
import { SpeedTestView } from './views/SpeedTestView';
import { DataUsageView } from './views/DataUsageView';
import { ApplicationsView } from './views/ApplicationsView';
import { ConnectionsView } from './views/ConnectionsView';
import { WifiView } from './views/WifiView';
import { NetworkView } from './views/NetworkView';
import { ToolsView } from './views/ToolsView';
import { DiagnosticsView } from './views/DiagnosticsView';
import { SettingsView } from './views/SettingsView';

const NetXShell: React.FC = () => {
  const { activeNav, sidebarCollapsed, toasts } = useNetX();

  const renderActiveView = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardView />;
      case 'speed-test':
        return <SpeedTestView />;
      case 'data-usage':
        return <DataUsageView />;
      case 'applications':
        return <ApplicationsView />;
      case 'connections':
        return <ConnectionsView />;
      case 'wifi':
        return <WifiView />;
      case 'network':
        return <NetworkView />;
      case 'tools':
        return <ToolsView />;
      case 'diagnostics':
        return <DiagnosticsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />

      <div className="workspace">
        <TopHeader />
        <main className="main-scroll" id="main-content">
          {renderActiveView()}
        </main>
      </div>

      {/* Subtle Toast Notifications */}
      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast-item">
              {t.type === 'success' ? (
                <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
              ) : t.type === 'warning' ? (
                <AlertTriangle size={16} style={{ color: 'var(--status-warning)' }} />
              ) : (
                <Info size={16} style={{ color: 'var(--brand-mint)' }} />
              )}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <NetXProvider>
      <NetXShell />
    </NetXProvider>
  );
};

export default App;
