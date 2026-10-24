import React, { useState } from 'react';
import {
  Activity,
  AppWindow,
  ArrowRight,
  BarChart3,
  Cable,
  ChevronDown,
  ChevronRight,
  Gamepad2,
  Gauge,
  History,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Stethoscope,
  Wifi,
  Wrench,
} from 'lucide-react';
import { useNetX } from '../../context/NetXContext';
import { NavSection } from '../../types/netx';
import { NetXGlobeIcon } from '../ui/NetXGlobeIcon';

interface NavItemDef {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const {
    activeNav,
    setActiveNav,
    sidebarCollapsed,
    setSidebarCollapsed,
    currentDownloadMbps,
    currentUploadMbps,
    monitoringPaused,
    networkInfo,
    apps,
    connections,
    speedTestHistory,
    lanDevices,
    networkEvents,
  } = useNetX();

  const [utilitiesOpen, setUtilitiesOpen] = useState<boolean>(true);
  const activeAppsCount = apps.filter((a) => a.status === 'active').length;

  // Primary Core Navigation (Section 3: Overview, Speed Test, Diagnostics, Details, Usage, Reports, AI, Settings)
  const coreNav: NavItemDef[] = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard size={17} className="nav-icon" /> },
    { id: 'speed-test', label: 'Speed Test', icon: <Gauge size={17} className="nav-icon" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Stethoscope size={17} className="nav-icon" /> },
    {
      id: 'network',
      label: 'Connection Details',
      icon: <Network size={17} className="nav-icon" />,
      badge: lanDevices.length > 0 ? String(lanDevices.length) : undefined,
    },
    { id: 'data-usage', label: 'Data Usage', icon: <BarChart3 size={17} className="nav-icon" /> },
    {
      id: 'history',
      label: 'Reports & History',
      icon: <History size={17} className="nav-icon" />,
      badge: networkEvents.length > 0 ? String(networkEvents.length) : undefined,
    },
    {
      id: 'ai-assistant',
      label: 'AI Troubleshooter',
      icon: <Sparkles size={17} className="nav-icon" />,
    },
  ];

  // Advanced Network Utilities (collapsible secondary group)
  const utilityNav: NavItemDef[] = [
    { id: 'wifi', label: 'Wi-Fi Spectrum', icon: <Wifi size={16} className="nav-icon" /> },
    {
      id: 'connections',
      label: 'Active Sockets',
      icon: <Cable size={16} className="nav-icon" />,
      badge: String(connections.length),
    },
    {
      id: 'applications',
      label: 'App Traffic',
      icon: <AppWindow size={16} className="nav-icon" />,
      badge: String(activeAppsCount),
    },
    { id: 'tools', label: 'Network Tools', icon: <Wrench size={16} className="nav-icon" /> },
    { id: 'gaming', label: 'Gaming Stability', icon: <Gamepad2 size={16} className="nav-icon" /> },
  ];

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Brand Header */}
      {!sidebarCollapsed ? (
        <div className="sidebar-brand">
          <div className="sidebar-brand-left">
            <div className="brand-emblem" aria-hidden="true">
              <NetXGlobeIcon size={22} />
            </div>
            <div className="brand-text-wrap">
              <span className="brand-title">NetX</span>
              <span className="brand-subtitle">Network Intelligence</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      ) : (
        <div className="sidebar-brand-collapsed">
          <div className="brand-emblem" aria-hidden="true" title="NetX Network Suite">
            <NetXGlobeIcon size={22} />
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn collapsed-toggle"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>
      )}

      {/* Core Navigation Group */}
      <nav className="sidebar-nav">
        {!sidebarCollapsed && (
          <div className="nav-section-label">CORE SUITE</div>
        )}
        {coreNav.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              {!sidebarCollapsed && (
                <>
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                </>
              )}
            </button>
          );
        })}

        {/* Collapsible Utilities Group */}
        {!sidebarCollapsed ? (
          <div style={{ marginTop: 12 }}>
            <div
              className="nav-section-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => setUtilitiesOpen(!utilitiesOpen)}
            >
              <span>UTILITIES</span>
              {utilitiesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            {utilitiesOpen &&
              utilityNav.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveNav(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.icon}
                    <span className="nav-item-label">{item.label}</span>
                    {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                  </button>
                );
              })}
          </div>
        ) : (
          utilityNav.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveNav(item.id)}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
              </button>
            );
          })
        )}
      </nav>

      {/* Settings Navigation Item */}
      <div className="sidebar-settings-wrap">
        <button
          type="button"
          className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveNav('settings')}
          title={sidebarCollapsed ? 'Settings' : undefined}
          aria-current={activeNav === 'settings' ? 'page' : undefined}
        >
          <Settings size={17} className="nav-icon" />
          {!sidebarCollapsed && <span className="nav-item-label">Settings</span>}
        </button>
      </div>

      {/* Live Mini Telemetry Pod */}
      {!sidebarCollapsed && (
        <div className="sidebar-telemetry-pod" aria-label="Live throughput summary">
          <div className="pod-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className={`pod-live-dot ${monitoringPaused ? 'paused' : ''}`} />
              <span>{monitoringPaused ? 'Monitoring Paused' : 'Live Monitor'}</span>
            </span>
            <span className="mono" style={{ fontSize: 10.5 }}>
              {networkInfo.interfaceName}
            </span>
          </div>
          <div className="pod-rates">
            <div className="pod-rate-item">
              <span className="pod-rate-label">↓ Download</span>
              <span className="pod-rate-val mono">{currentDownloadMbps.toFixed(2)} Mbps</span>
            </div>
            <div className="pod-rate-item">
              <span className="pod-rate-label">↑ Upload</span>
              <span className="pod-rate-val mono">{currentUploadMbps.toFixed(2)} Mbps</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
