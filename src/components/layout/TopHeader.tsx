import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  AppWindow,
  Bell,
  Gauge,
  Globe,
  Laptop,
  LayoutGrid,
  Minimize2,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Power,
  Search,
  Settings,
  Sun,
  Wifi,
} from 'lucide-react';
import { useNetX } from '../../context/NetXContext';
import { AppearanceMode, NavSection } from '../../types/netx';
import { StatusBadge } from '../ui/Primitives';

const PAGE_META: Record<NavSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Overview',
    subtitle: 'Real-time connection health, live bandwidth telemetry, and adapter performance.',
  },
  'ai-assistant': {
    title: 'AI Troubleshooter',
    subtitle: 'Automated diagnostic reasoning, root cause analysis, and guided network repair.',
  },
  'speed-test': {
    title: 'Speed Test',
    subtitle: 'Measure download throughput, upload rate, and latency against Cloudflare edge servers.',
  },
  'data-usage': {
    title: 'Data Usage',
    subtitle: 'Track daily, monthly, and process-level bandwidth consumption across your PC.',
  },
  applications: {
    title: 'Applications',
    subtitle: 'Monitor active processes and per-application bandwidth utilization.',
  },
  connections: {
    title: 'Active Sockets',
    subtitle: 'Inspect live TCP and UDP endpoints, remote hostnames, and established connections.',
  },
  wifi: {
    title: 'Wi-Fi Spectrum',
    subtitle: 'Signal quality, wireless link parameters, channel distribution, and nearby access points.',
  },
  network: {
    title: 'Connection Details',
    subtitle: 'Hardware network interface specifications, IPv4/IPv6 routing, and local LAN devices.',
  },
  gaming: {
    title: 'Gaming & Latency Quality',
    subtitle: 'High-frequency jitter analysis, packet loss monitor, and stability scoring.',
  },
  tools: {
    title: 'Network Tools',
    subtitle: 'Interactive Ping, Traceroute, DNS Lookup, and Port Check utilities.',
  },
  diagnostics: {
    title: 'Network Diagnostics',
    subtitle: 'Automated 4-stage health verification: Adapter, Gateway, DNS, and WAN Internet.',
  },
  history: {
    title: 'Reports & History',
    subtitle: 'Audit trail of connectivity events, speed benchmarks, and diagnostic logs.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Display theme, telemetry sampling rates, notifications, and AI configuration.',
  },
};

interface TopHeaderProps {
  onOpenCommandPalette: () => void;
  isHudOpen: boolean;
  onToggleHud: () => void;
  isMiniMonitorOpen?: boolean;
  onToggleMiniMonitor?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenCommandPalette,
  isHudOpen,
  onToggleHud,
  isMiniMonitorOpen = false,
  onToggleMiniMonitor,
}) => {
  const {
    activeNav,
    setActiveNav,
    settings,
    updateSettings,
    connected,
    internetReachable,
    networkInfo,
    currentDownloadMbps,
    currentUploadMbps,
    currentPingMs,
    monitoringPaused,
    setMonitoringPaused,
    pushToast,
  } = useNetX();

  const [trayOpen, setTrayOpen] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setTrayOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const meta = PAGE_META[activeNav] || PAGE_META.dashboard;

  const cycleTheme = () => {
    const order: AppearanceMode[] = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(settings.appearance) + 1) % order.length];
    updateSettings({ appearance: next });
    pushToast(
      `Appearance set to ${next === 'dark' ? 'Dark' : next === 'light' ? 'Light' : 'System'} mode.`,
      'info'
    );
  };

  const getThemeIcon = () => {
    if (settings.appearance === 'light') return <Sun size={15} />;
    if (settings.appearance === 'dark') return <Moon size={15} />;
    return <Laptop size={15} />;
  };

  const connectionStatus = !connected
    ? 'Disconnected'
    : !internetReachable
    ? 'Limited Connectivity'
    : networkInfo.hostname === 'Loading...'
    ? 'Checking Connection'
    : 'Connected';

  const dotState = !connected ? 'offline' : !internetReachable ? 'limited' : 'online';

  return (
    <header className="top-header">
      {/* Left: View Title & Subtitle */}
      <div className="header-title-group">
        <h1 className="header-title">{meta.title}</h1>
        <p className="header-subtitle">{meta.subtitle}</p>
      </div>

      {/* Center: Search & Command Bar (Ctrl + K) */}
      <div className="header-search-wrap" onClick={onOpenCommandPalette} role="search">
        <Search size={15} className="header-search-icon" />
        <span className="header-search-placeholder">Search network tools, commands...</span>
        <kbd className="header-search-kbd">Ctrl K</kbd>
      </div>

      {/* Right: Controls & Actions */}
      <div className="header-controls">
        {/* Quick Speed Test Trigger */}
        <button
          type="button"
          className="header-action-btn"
          onClick={() => setActiveNav('speed-test')}
          title="Run an instant internet speed benchmark"
        >
          <Gauge size={14} />
          <span>Speed Test</span>
        </button>

        {/* Real Connection Status Pill */}
        <div
          className="header-connection-pill"
          aria-label={`Current network status: ${connectionStatus}`}
          onClick={() => setActiveNav('network')}
          role="button"
          tabIndex={0}
          title={`Status: ${connectionStatus} · Click for connection details`}
        >
          <div className={`header-live-dot ${dotState}`} />
          <div className="header-connection-info">
            <span className="header-connection-ssid">
              {networkInfo.ssid && networkInfo.ssid !== 'Disconnected'
                ? networkInfo.ssid
                : networkInfo.interfaceName || connectionStatus}
            </span>
            <span className="header-connection-ip mono">
              {networkInfo.ipv4 !== '—' ? networkInfo.ipv4 : connectionStatus}
            </span>
          </div>
        </div>

        {/* Floating Mini Monitor Toggle Button */}
        {onToggleMiniMonitor && (
          <button
            type="button"
            className={`header-icon-btn ${isMiniMonitorOpen ? 'active' : ''}`}
            onClick={onToggleMiniMonitor}
            title={isMiniMonitorOpen ? 'Hide Mini Monitor' : 'Show Floating Mini Monitor'}
            aria-label={isMiniMonitorOpen ? 'Hide Mini Monitor' : 'Show Floating Mini Monitor'}
          >
            <Minimize2 size={16} />
          </button>
        )}

        {/* HUD Toggle Button */}
        <button
          type="button"
          className={`header-icon-btn ${isHudOpen ? 'active' : ''}`}
          onClick={onToggleHud}
          title={isHudOpen ? 'Collapse Telemetry HUD' : 'Expand Telemetry HUD'}
          aria-label={isHudOpen ? 'Collapse Telemetry HUD' : 'Expand Telemetry HUD'}
        >
          {isHudOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>

        {/* Quick Appearance Mode Button */}
        <button
          type="button"
          className="header-icon-btn"
          onClick={cycleTheme}
          title={`Appearance: ${settings.appearance} (Click to toggle)`}
          aria-label={`Appearance mode: ${settings.appearance}`}
        >
          {getThemeIcon()}
        </button>

        {/* System Tray Menu Control */}
        <div ref={trayRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setTrayOpen((o) => !o)}
            aria-expanded={trayOpen}
            aria-haspopup="menu"
            title="System Tray Quick Menu"
          >
            <Wifi size={16} />
          </button>

          {trayOpen && (
            <div className="tray-popover" role="menu" aria-label="System Tray Menu">
              <div className="tray-popover-header">
                <span className="tray-popover-title">NetX Operations</span>
                <StatusBadge
                  variant={monitoringPaused ? 'warning' : 'success'}
                  label={monitoringPaused ? 'Paused' : 'Active'}
                />
              </div>

              <div className="tray-popover-stats">
                <div className="tray-stat-row">
                  <span className="tray-stat-label">Download:</span>
                  <span className="mono tray-stat-val val-download">
                    {currentDownloadMbps.toFixed(2)} Mbps
                  </span>
                </div>
                <div className="tray-stat-row">
                  <span className="tray-stat-label">Upload:</span>
                  <span className="mono tray-stat-val val-upload">
                    {currentUploadMbps.toFixed(2)} Mbps
                  </span>
                </div>
                <div className="tray-stat-row">
                  <span className="tray-stat-label">Latency:</span>
                  <span className="mono tray-stat-val">
                    {currentPingMs || '—'} ms
                  </span>
                </div>
              </div>

              <div className="tray-divider" />

              <button
                type="button"
                role="menuitem"
                className="tray-menu-item"
                onClick={() => {
                  setActiveNav('dashboard');
                  setTrayOpen(false);
                }}
              >
                <span>Overview Dashboard</span>
                <AppWindow size={14} />
              </button>

              <button
                type="button"
                role="menuitem"
                className="tray-menu-item"
                onClick={() => {
                  setMonitoringPaused((p) => {
                    const next = !p;
                    pushToast(
                      next ? 'Live monitoring paused.' : 'Live monitoring resumed.',
                      'info'
                    );
                    return next;
                  });
                }}
              >
                <span>{monitoringPaused ? 'Resume Monitoring' : 'Pause Monitoring'}</span>
                {monitoringPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>

              <button
                type="button"
                role="menuitem"
                className="tray-menu-item"
                onClick={() => {
                  setActiveNav('speed-test');
                  setTrayOpen(false);
                }}
              >
                <span>Speed Test</span>
                <Gauge size={14} />
              </button>

              <button
                type="button"
                role="menuitem"
                className="tray-menu-item"
                onClick={() => {
                  setActiveNav('settings');
                  setTrayOpen(false);
                }}
              >
                <span>Preferences</span>
                <Settings size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
