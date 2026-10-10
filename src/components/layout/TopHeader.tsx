import React, { useState, useRef, useEffect } from 'react';
import {
  AppWindow,
  Globe,
  Laptop,
  Moon,
  Pause,
  Play,
  Power,
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
    subtitle: 'Real-time connection status, throughput performance, and data consumption.',
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
  tools: {
    title: 'Network Tools',
    subtitle: 'Interactive Ping, Traceroute, DNS Lookup, and Port Check utilities.',
  },
  diagnostics: {
    title: 'Network Diagnostics',
    subtitle: 'Automated step-by-step connection health verification and troubleshooting.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Configure appearance, startup behavior, notifications, and data retention.',
  },
};

export const TopHeader: React.FC = () => {
  const {
    activeNav,
    setActiveNav,
    settings,
    updateSettings,
    connected,
    networkInfo,
    currentDownloadMbps,
    currentUploadMbps,
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
    const order: AppearanceMode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(settings.appearance) + 1) % order.length];
    updateSettings({ appearance: next });
    pushToast(
      `Appearance set to ${next.charAt(0).toUpperCase() + next.slice(1)} mode.`,
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
      <div className="header-title-group">
        <h1 className="header-title">{meta.title}</h1>
        <p className="header-subtitle">{meta.subtitle}</p>
      </div>

      <div className="header-controls">
        {/* Real Connection Status Pill */}
        <div className="header-connection-pill" aria-label="Current network connection">
          <Globe size={16} style={{ color: 'var(--brand-mint)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              {networkInfo.ssid}
            </span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
              {networkInfo.ipv4}
            </span>
          </div>
          <StatusBadge
            variant={connected ? 'success' : 'danger'}
            label={connected ? 'Connected' : 'Offline'}
          />
        </div>

        {/* Quick Appearance Mode Button (Section 4) */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={cycleTheme}
          title="Switch Appearance (Light / Dark / System)"
          aria-label={`Appearance mode: ${settings.appearance}`}
        >
          {getThemeIcon()}
          <span style={{ textTransform: 'capitalize' }}>{settings.appearance}</span>
        </button>

        {/* System Tray Menu Control (Section 21) */}
        <div ref={trayRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setTrayOpen((o) => !o)}
            aria-expanded={trayOpen}
            aria-haspopup="menu"
            title="System Tray Quick Menu"
          >
            <Wifi size={14} style={{ color: 'var(--brand-mint)' }} />
            <span>Tray</span>
          </button>

          {trayOpen && (
            <div className="tray-popover" role="menu" aria-label="System Tray Menu">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: '0.05em' }}>
                  NETX
                </span>
                <StatusBadge
                  variant={monitoringPaused ? 'warning' : 'success'}
                  label={monitoringPaused ? 'Paused' : 'Active'}
                />
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Download:</span>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--series-download)' }}>
                    {currentDownloadMbps.toFixed(2)} Mbps
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Upload:</span>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--series-upload)' }}>
                    {currentUploadMbps.toFixed(2)} Mbps
                  </span>
                </div>
              </div>

              <div
                style={{
                  height: 1,
                  background: 'var(--border-subtle)',
                  margin: '2px 0',
                }}
              />

              <button
                type="button"
                role="menuitem"
                className="tray-menu-item"
                onClick={() => {
                  setActiveNav('dashboard');
                  setTrayOpen(false);
                }}
              >
                <span>Open NetX</span>
                <AppWindow size={14} style={{ color: 'var(--text-muted)' }} />
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
                {monitoringPaused ? (
                  <Play size={14} style={{ color: 'var(--brand-mint)' }} />
                ) : (
                  <Pause size={14} style={{ color: 'var(--text-muted)' }} />
                )}
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
                <Settings size={14} style={{ color: 'var(--text-muted)' }} />
              </button>

              <button
                type="button"
                role="menuitem"
                className="tray-menu-item"
                style={{ color: 'var(--status-danger)' }}
                onClick={() => {
                  if (window.netxNative) {
                    window.netxNative.quitApp();
                  }
                }}
              >
                <span>Exit</span>
                <Power size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
