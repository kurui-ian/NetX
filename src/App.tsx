import React, { useState, useEffect } from 'react';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { NetXProvider, useNetX } from './context/NetXContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { TelemetryHUD } from './components/layout/TelemetryHUD';
import { MiniMonitor } from './components/layout/MiniMonitor';
import { CommandPalette } from './components/ui/CommandPalette';
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
import { GamingModeView } from './views/GamingModeView';
import { NetworkHistoryView } from './views/NetworkHistoryView';
import { AiAssistantView } from './views/AiAssistantView';

const NetXShell: React.FC = () => {
  const { activeNav, sidebarCollapsed, toasts } = useNetX();

  const [isHudOpen, setIsHudOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('netx-hud-open');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isMiniMonitorOpen, setIsMiniMonitorOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('netx-mini-open');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const [isCommandOpen, setIsCommandOpen] = useState<boolean>(false);

  const toggleHud = () => {
    setIsHudOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('netx-hud-open', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleMiniMonitor = () => {
    setIsMiniMonitorOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('netx-mini-open', String(next));
      } catch {}
      return next;
    });
  };

  // Global hotkeys: Ctrl+K or Cmd+K to open Command Palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const renderActiveView = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardView />;
      case 'ai-assistant':
        return <AiAssistantView />;
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
      case 'gaming':
        return <GamingModeView />;
      case 'tools':
        return <ToolsView />;
      case 'diagnostics':
        return <DiagnosticsView />;
      case 'history':
        return <NetworkHistoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${
        !isHudOpen ? 'hud-collapsed' : ''
      }`}
    >
      {/* 1. Left Navigation Sidebar */}
      <Sidebar />

      {/* 2. Center Main Workspace */}
      <div className="workspace">
        <TopHeader
          onOpenCommandPalette={() => setIsCommandOpen(true)}
          isHudOpen={isHudOpen}
          onToggleHud={toggleHud}
          isMiniMonitorOpen={isMiniMonitorOpen}
          onToggleMiniMonitor={toggleMiniMonitor}
        />
        <main className="main-scroll" id="main-content">
          {renderActiveView()}
        </main>
      </div>

      {/* 3. Right Telemetry & Engine HUD Sidebar (Matching Inspiration Mockup) */}
      <TelemetryHUD isOpen={isHudOpen} onClose={() => setIsHudOpen(false)} />

      {/* 4. Floating Mini Monitor Widget */}
      <MiniMonitor isOpen={isMiniMonitorOpen} onClose={() => setIsMiniMonitorOpen(false)} />

      {/* 5. Global Command Palette Modal (Ctrl + K) */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      {/* 5. Subtle Toast Notifications */}
      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast-item">
              {t.type === 'success' ? (
                <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
              ) : t.type === 'warning' ? (
                <AlertTriangle size={16} style={{ color: 'var(--status-warning)' }} />
              ) : (
                <Info size={16} style={{ color: 'var(--brand-primary)' }} />
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
