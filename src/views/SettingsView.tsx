import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Database,
  Info,
  Laptop,
  Lock,
  Moon,
  Palette,
  Power,
  Sun,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { AppearanceMode } from '../types/netx';
import { Button, StatusBadge, ToggleSwitch } from '../components/ui/Primitives';

type SettingsTab =
  | 'appearance'
  | 'startup'
  | 'notifications'
  | 'monitoring'
  | 'data'
  | 'privacy'
  | 'about';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resolvedTheme,
    networkInfo,
    clearSpeedTestHistory,
    pushToast,
  } = useNetX();

  const [activeCategory, setActiveCategory] = useState<SettingsTab>('appearance');

  const categories: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'startup', label: 'Startup', icon: <Power size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'monitoring', label: 'Monitoring', icon: <Activity size={16} /> },
    { id: 'data', label: 'Data', icon: <Database size={16} /> },
    { id: 'privacy', label: 'Privacy', icon: <Lock size={16} /> },
    { id: 'about', label: 'About', icon: <Info size={16} /> },
  ];

  const appearanceOptions: {
    mode: AppearanceMode;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      mode: 'light',
      title: 'Crystalline Light',
      desc: 'Bright frosted glass canvas with crisp violet and slate accents.',
      icon: <Sun size={18} />,
    },
    {
      mode: 'dark',
      title: 'Cosmic Violet Dark',
      desc: 'Translucent frosted obsidian glass with electric violet glow and ambient depth.',
      icon: <Moon size={18} />,
    },
    {
      mode: 'system',
      title: 'System Dynamic',
      desc: 'Automatically follow your Windows light or dark appearance preference.',
      icon: <Laptop size={18} />,
    },
  ];

  const handleResetAllHistory = async () => {
    clearSpeedTestHistory();
    if (window.netxNative) {
      await window.netxNative.clearUsageHistory();
    }
    pushToast('Local usage and speed test history cleared.', 'info');
  };

  return (
    <div className="page-container">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}
      >
        {/* Left Category List (Section 20) */}
        <nav
          className="surface-panel"
          style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}
          aria-label="Settings categories"
        >
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: isSelected ? 'var(--brand-mint-soft)' : 'transparent',
                  color: isSelected ? 'var(--brand-mint)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 650 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Category Content */}
        <div className="surface-panel">
          {activeCategory === 'appearance' && (
            <section aria-label="Appearance settings">
              <div className="surface-panel-header">
                <div>
                  <h2 className="surface-panel-title">Appearance</h2>
                  <p className="surface-panel-subtitle">
                    Choose how NetX looks. Your preference persists automatically across restarts.
                  </p>
                </div>
                <StatusBadge
                  variant="info"
                  label={`Active: ${resolvedTheme.toUpperCase()}`}
                />
              </div>

              <div
                role="radiogroup"
                aria-label="Theme preference"
                style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}
              >
                {appearanceOptions.map((opt) => {
                  const selected = settings.appearance === opt.mode;
                  return (
                    <label
                      key={opt.mode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: selected
                          ? '2px solid var(--brand-mint)'
                          : '1px solid var(--border-subtle)',
                        background: selected
                          ? 'var(--bg-surface-tinted)'
                          : 'var(--bg-surface-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <input
                          type="radio"
                          name="netx-appearance"
                          checked={selected}
                          onChange={() => {
                            updateSettings({ appearance: opt.mode });
                            pushToast(`Theme set to ${opt.title}.`, 'info');
                          }}
                          style={{ width: 16, height: 16 }}
                        />
                        <div style={{ color: 'var(--brand-mint)' }}>{opt.icon}</div>
                        <div>
                          <div style={{ fontWeight: 650, fontSize: 14 }}>{opt.title}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            {opt.desc}
                          </div>
                        </div>
                      </div>

                      {selected && <StatusBadge variant="success" label="Selected" />}
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {activeCategory === 'startup' && (
            <section aria-label="Startup settings">
              <div className="surface-panel-header">
                <div>
                  <h2 className="surface-panel-title">Startup Behavior</h2>
                  <p className="surface-panel-subtitle">
                    Configure how NetX.exe launches when you sign into Windows.
                  </p>
                </div>
              </div>

              <div className="kv-list">
                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Start with Windows</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Register NetX.exe in Windows Startup items when you sign in.
                    </div>
                  </div>
                  <ToggleSwitch
                    label="Start with Windows"
                    checked={settings.startWithWindows}
                    onChange={(val) => {
                      updateSettings({ startWithWindows: val });
                      pushToast(
                        val
                          ? 'Enabled Start with Windows.'
                          : 'Disabled Start with Windows.',
                        'info'
                      );
                    }}
                  />
                </div>

                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Start minimized</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Launch directly into the Windows system tray without opening the main window.
                    </div>
                  </div>
                  <ToggleSwitch
                    label="Start minimized"
                    checked={settings.startMinimized}
                    onChange={(val) => updateSettings({ startMinimized: val })}
                  />
                </div>
              </div>
            </section>
          )}

          {activeCategory === 'notifications' && (
            <section aria-label="Notification settings">
              <div className="surface-panel-header">
                <div>
                  <h2 className="surface-panel-title">Notifications</h2>
                  <p className="surface-panel-subtitle">
                    Control desktop alerts for connection state changes and bandwidth thresholds.
                  </p>
                </div>
              </div>

              <div className="kv-list">
                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Connection changes</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Notify when your internet connection drops, reconnects, or switches Wi-Fi.
                    </div>
                  </div>
                  <ToggleSwitch
                    label="Connection changes"
                    checked={settings.notifyConnectionChanges}
                    onChange={(val) => updateSettings({ notifyConnectionChanges: val })}
                  />
                </div>

                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Usage alerts</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Alert when monthly data consumption reaches 80% and 100% of your plan cap.
                    </div>
                  </div>
                  <ToggleSwitch
                    label="Usage alerts"
                    checked={settings.notifyUsageAlerts}
                    onChange={(val) => updateSettings({ notifyUsageAlerts: val })}
                  />
                </div>
              </div>
            </section>
          )}

          {activeCategory === 'monitoring' && (
            <section aria-label="Monitoring settings">
              <div className="surface-panel-header">
                <div>
                  <h2 className="surface-panel-title">Telemetry &amp; Monitoring</h2>
                  <p className="surface-panel-subtitle">
                    Customize sampling frequency and network interface selection.
                  </p>
                </div>
              </div>

              <div className="kv-list">
                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Graph &amp; metric refresh rate</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      How often NetX polls your Windows network adapter counters.
                    </div>
                  </div>
                  <select
                    className="select-field"
                    value={settings.refreshIntervalSec}
                    onChange={(e) =>
                      updateSettings({
                        refreshIntervalSec: Number(e.target.value) as 1 | 2 | 5,
                      })
                    }
                    aria-label="Refresh interval"
                  >
                    <option value={1}>Every 1 second (Real-time)</option>
                    <option value={2}>Every 2 seconds (Balanced)</option>
                    <option value={5}>Every 5 seconds (Low power)</option>
                  </select>
                </div>

                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Monitored Network Interface</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Hardware network adapter detected on {networkInfo.hostname}.
                    </div>
                  </div>
                  <select
                    className="select-field"
                    value={settings.preferredInterface}
                    onChange={(e) => updateSettings({ preferredInterface: e.target.value })}
                    aria-label="Preferred network interface"
                  >
                    <option value="Primary Active Interface">
                      Primary ({networkInfo.interfaceName} — {networkInfo.adapterDescription})
                    </option>
                    {networkInfo.adapters.map((ad, idx) => (
                      <option key={idx} value={ad.name}>
                        {ad.name} ({ad.description})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {activeCategory === 'data' && (
            <section aria-label="Data retention settings">
              <div className="surface-panel-header">
                <div>
                  <h2 className="surface-panel-title">Data &amp; History Storage</h2>
                  <p className="surface-panel-subtitle">
                    Manage historical bandwidth retention and monthly data plan thresholds.
                  </p>
                </div>
              </div>

              <div className="kv-list">
                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Keep history for</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Automatically prune older speed tests and bandwidth logs.
                    </div>
                  </div>
                  <select
                    className="select-field"
                    value={settings.historyRetentionDays}
                    onChange={(e) =>
                      updateSettings({
                        historyRetentionDays: Number(e.target.value) as 7 | 30 | 90 | 365,
                      })
                    }
                    aria-label="Keep history for"
                  >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={365}>1 year</option>
                  </select>
                </div>

                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Monthly data allowance (GB)</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Used to calculate your monthly data usage percentage on the Dashboard.
                    </div>
                  </div>
                  <select
                    className="select-field"
                    value={settings.monthlyCapGb}
                    onChange={(e) => updateSettings({ monthlyCapGb: Number(e.target.value) })}
                    aria-label="Monthly data allowance"
                  >
                    <option value={100}>100 GB</option>
                    <option value={250}>250 GB</option>
                    <option value={500}>500 GB</option>
                    <option value={1000}>1000 GB (1 TB)</option>
                  </select>
                </div>

                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Reset stored usage &amp; speed test history</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Clear saved benchmark records and reset local usage counters.
                    </div>
                  </div>
                  <Button variant="danger" size="sm" onClick={handleResetAllHistory}>
                    Reset History
                  </Button>
                </div>
              </div>
            </section>
          )}

          {activeCategory === 'privacy' && (
            <section aria-label="Privacy settings">
              <div className="surface-panel-header">
                <div>
                  <h2 className="surface-panel-title">Privacy &amp; Local Storage</h2>
                  <p className="surface-panel-subtitle">
                    NetX is designed with strict local-first privacy.
                  </p>
                </div>
                <StatusBadge variant="success" label="100% Local" />
              </div>

              <div className="kv-list">
                <div className="kv-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Local-only telemetry database</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      All traffic counters, process names, and LAN scans remain exclusively on{' '}
                      {networkInfo.hostname} (%APPDATA%\NetX) and are never uploaded externally.
                    </div>
                  </div>
                  <ToggleSwitch
                    label="Local-only telemetry"
                    checked={settings.telemetryLocalOnly}
                    onChange={(val) => updateSettings({ telemetryLocalOnly: val })}
                  />
                </div>
              </div>
            </section>
          )}

          {activeCategory === 'about' && (
            <section aria-label="About NetX">
              <div className="surface-panel-header">
                <div>
                  <h2 className="surface-panel-title">About NetX</h2>
                  <p className="surface-panel-subtitle">
                    Native Windows Desktop Network Utility &amp; Telemetry Application
                  </p>
                </div>
                <StatusBadge variant="info" label="v1.0.0 Native .EXE" />
              </div>

              <div className="kv-list">
                <div className="kv-row">
                  <span className="kv-label">Application Binary</span>
                  <span className="kv-value mono">NetX.exe (Win32 x64 Standalone)</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Host Machine</span>
                  <span className="kv-value mono">{networkInfo.hostname}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Active Network Interface</span>
                  <span className="kv-value">{networkInfo.adapterDescription}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Theme Engine</span>
                  <span className="kv-value">Light / Dark / Windows System Auto</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
