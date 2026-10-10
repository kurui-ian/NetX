import React from 'react';
import {
  Activity,
  AppWindow,
  BarChart3,
  Cable,
  Gauge,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Stethoscope,
  Wifi,
  Wrench,
} from 'lucide-react';
import { useNetX } from '../../context/NetXContext';
import { NavSection } from '../../types/netx';

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
  } = useNetX();

  const activeAppsCount = apps.filter((a) => a.status === 'active').length;

  const primaryNav: NavItemDef[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} className="nav-icon" /> },
    { id: 'speed-test', label: 'Speed Test', icon: <Gauge size={18} className="nav-icon" /> },
    { id: 'data-usage', label: 'Data Usage', icon: <BarChart3 size={18} className="nav-icon" /> },
    {
      id: 'applications',
      label: 'Applications',
      icon: <AppWindow size={18} className="nav-icon" />,
      badge: String(activeAppsCount),
    },
    {
      id: 'connections',
      label: 'Connections',
      icon: <Cable size={18} className="nav-icon" />,
      badge: String(connections.length),
    },
    { id: 'wifi', label: 'Wi-Fi', icon: <Wifi size={18} className="nav-icon" /> },
    { id: 'network', label: 'Network', icon: <Network size={18} className="nav-icon" /> },
    { id: 'tools', label: 'Tools', icon: <Wrench size={18} className="nav-icon" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Stethoscope size={18} className="nav-icon" /> },
  ];

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-left">
          <div className="brand-emblem" aria-hidden="true">
            <Activity size={21} strokeWidth={2.5} />
          </div>
          {!sidebarCollapsed && (
            <div className="brand-text-wrap">
              <span className="brand-title">NETX</span>
              <span className="brand-subtitle">Network Utility</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed((c) => !c)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="sidebar-nav">
        {primaryNav.map((item) => {
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
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-divider" role="separator" />

      {/* Settings Navigation Item */}
      <button
        type="button"
        className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveNav('settings')}
        title={sidebarCollapsed ? 'Settings' : undefined}
        aria-current={activeNav === 'settings' ? 'page' : undefined}
      >
        <Settings size={18} className="nav-icon" />
        {!sidebarCollapsed && <span>Settings</span>}
      </button>

      {/* Live Mini Telemetry Pod (Desktop Utility Enhancement) */}
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
              <span className="pod-rate-val">{currentDownloadMbps.toFixed(2)} Mbps</span>
            </div>
            <div className="pod-rate-item">
              <span className="pod-rate-label">↑ Upload</span>
              <span className="pod-rate-val">{currentUploadMbps.toFixed(2)} Mbps</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
