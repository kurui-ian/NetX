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
    title: 'Network Overview',
    subtitle: 'Real-time connection status, throughput performance, and telemetry.',
  },
  'speed-test': {
    title: 'Speed Test',
    subtitle: 'Measure your download speed, upload speed, and network latency.',
  },
  'data-usage': {
    title: 'Data Usage',
    subtitle: 'Track daily, weekly, and monthly bandwidth consumption across your PC.',
  },
  applications: {
    title: 'Applications',
    subtitle: 'Monitor active processes and per-application bandwidth usage.',
  },
  connections: {
    title: 'Active Connections',
    subtitle: 'Inspect live TCP and UDP endpoints and remote hostnames.',
  },
  wifi: {
    title: 'Wi-Fi Environment',
    subtitle: 'Signal quality, wireless link parameters, and nearby access points.',
  },
  network: {
    title: 'Local Network & Adapters',
    subtitle: 'Connected LAN devices on your subnet and local network interface hardware.',
  },
  gaming: {
    title: 'Gaming & Latency Quality',
    subtitle: 'High-frequency ping tracking, jitter analysis, packet loss monitor, and stability scoring.',
  },
  tools: {
    title: 'Network Tools',
    subtitle: 'Interactive Ping, Traceroute, DNS Lookup, and Port Check utilities.',
  },
  diagnostics: {
    title: 'Network Diagnostics',
    subtitle: 'Automated step-by-step connection health verification and troubleshooting.',
  },
  history: {
    title: 'Incident & Event History',
    subtitle: 'Audit trail of connectivity drops, latency excursions, and interface state changes.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Configure appearance, startup behavior, notifications, and data retention.',
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

  const meta = PAGE_META[activeNav];

  const cycleTheme = () => {
    const order: AppearanceMode[] = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(settings.appearance) + 1) % order.length];
    updateSettings({ appearance: next });
    pushToast(
      `Appearance set to ${next === 'dark' ? 'Cosmic Dark' : next.charAt(0).toUpperCase() + next.slice(1)} mode.`,
      'info'
    );
  };

  const getThemeIcon = () => {
    if (settings.appearance === 'light') return <Sun size={15} />;
    if (settings.appearance === 'dark') return <Moon size={15} />;
    return <Laptop size={15} />;
  };

  return (
    <header className="top-header">
      {/* Left: View Title & Subtitle */}
      <div className="header-title-group">
        <h1 className="header-title">{meta.title}</h1>
        <p className="header-subtitle">{meta.subtitle}</p>
      </div>

      {/* Center: Search & Command Bar (Matches Search ChatGPT ⌘K in inspiration) */}
      <div className="header-search-wrap" onClick={onOpenCommandPalette} role="search">
        <Search size={15} className="header-search-icon" />
        <span className="header-search-placeholder">Search NetX or jump to tool...</span>
        <kbd className="header-search-kbd">Ctrl K</kbd>
      </div>

      {/* Right: Controls & Actions */}
      <div className="header-controls">
        {/* Quick Action Pill Button: + Speed Test (Matches + New Chat in inspiration) */}
        <button
          type="button"
          className="header-action-btn"
          onClick={() => setActiveNav('speed-test')}
          title="Run a quick Cloudflare Speed Test"
        >
          <Plus size={14} strokeWidth={2.6} />
          <span>Speed Test</span>
        </button>

        {/* Real Connection Status Pill */}
        <div
          className="header-connection-pill"
          aria-label="Current network connection"
          onClick={() => setActiveNav('wifi')}
          role="button"
          tabIndex={0}
          title="Click to view Wi-Fi spectrum and link details"
        >
          <div className={`header-live-dot ${connected ? 'online' : 'offline'}`} />
          <div className="header-connection-info">
            <span className="header-connection-ssid">{networkInfo.ssid}</span>
            <span className="header-connection-ip mono">{networkInfo.ipv4}</span>
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
          title={`Appearance: ${settings.appearance} (Click to switch)`}
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
                <span className="tray-popover-title">NetX Pro Engine</span>
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
                  setActiveNav('settings');
                  setTrayOpen(false);
                }}
              >
                <span>Settings</span>
                <Settings size={14} />
              </button>

              <button
                type="button"
                role="menuitem"
                className="tray-menu-item tray-exit"
                onClick={() => {
                  if (window.netxNative) {
                    window.netxNative.quitApp();
                  }
                }}
              >
                <span>Exit NetX</span>
                <Power size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
