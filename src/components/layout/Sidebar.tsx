import React from 'react';
import {
  Activity,
  AppWindow,
  ArrowRight,
  BarChart3,
  Cable,
  CheckCircle2,
  Clock,
  Gamepad2,
  Gauge,
  History,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
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

  const activeAppsCount = apps.filter((a) => a.status === 'active').length;

  const primaryNav: NavItemDef[] = [
    { id: 'dashboard', label: 'Home', icon: <LayoutDashboard size={18} className="nav-icon" /> },
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
    { id: 'wifi', label: 'Wi-Fi Spectrum', icon: <Wifi size={18} className="nav-icon" /> },
    {
      id: 'network',
      label: 'Network & LAN',
      icon: <Network size={18} className="nav-icon" />,
      badge: lanDevices.length > 0 ? String(lanDevices.length) : undefined,
    },
    { id: 'gaming', label: 'Gaming & Quality', icon: <Gamepad2 size={18} className="nav-icon" /> },
    { id: 'tools', label: 'Tools', icon: <Wrench size={18} className="nav-icon" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Stethoscope size={18} className="nav-icon" /> },
    {
      id: 'history',
      label: 'Event History',
      icon: <History size={18} className="nav-icon" />,
      badge: networkEvents.length > 0 ? String(networkEvents.length) : undefined,
    },
  ];

  // Dynamic Recent Activity items (mirrors "Recent Chats" in inspiration)
  const recentActivities = [
    {
      id: 'rec-1',
      title: speedTestHistory.length > 0
        ? `Speed: ${speedTestHistory[0].downloadMbps.toFixed(0)} Mbps down`
        : 'Speed Benchmark',
      time: 'Today',
      nav: 'speed-test' as NavSection,
    },
    {
      id: 'rec-2',
      title: lanDevices.length > 0
        ? `Subnet: ${lanDevices.length} LAN devices`
        : 'ARP Subnet Scan',
      time: 'Today',
      nav: 'network' as NavSection,
    },
    {
      id: 'rec-3',
      title: networkInfo.ssid !== 'Detecting...'
        ? `Wi-Fi: ${networkInfo.ssid}`
        : 'Wireless Link State',
      time: 'Active',
      nav: 'wifi' as NavSection,
    },
    {
      id: 'rec-4',
      title: 'Health Diagnostics',
      time: 'Today',
      nav: 'diagnostics' as NavSection,
    },
  ];

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-left">
          <div className="brand-emblem" aria-hidden="true">
            <NetXGlobeIcon size={24} />
          </div>
          {!sidebarCollapsed && (
            <div className="brand-text-wrap">
              <span className="brand-title">NetX</span>
              <span className="brand-subtitle">Telemetry &amp; Utility</span>
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
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                </>
              )}
            </button>
          );
        })}
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
          <Settings size={18} className="nav-icon" />
          {!sidebarCollapsed && <span className="nav-item-label">Settings</span>}
        </button>
      </div>

      {/* Recent Activity Section (Inspired directly by "Recent Chats" in inspiration mockup) */}
      {!sidebarCollapsed && (
        <div className="sidebar-recent-section">
          <div className="sidebar-recent-header">
            <span className="sidebar-recent-title">Recent Activity</span>
            <Sparkles size={13} className="sidebar-recent-sparkle" />
          </div>

          <div className="sidebar-recent-list">
            {recentActivities.map((rec) => (
              <div
                key={rec.id}
                className="sidebar-recent-item"
                onClick={() => setActiveNav(rec.nav)}
                role="button"
                tabIndex={0}
              >
                <span className="recent-item-title">{rec.title}</span>
                <span className="recent-item-time">{rec.time}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="sidebar-view-all-btn"
            onClick={() => setActiveNav('data-usage')}
          >
            <span>View all activity</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

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
