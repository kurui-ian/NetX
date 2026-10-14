import React, { useState } from 'react';
import {
  Activity,
  AppWindow,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Cable,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  Gauge,
  Globe,
  Pause,
  Play,
  Radio,
  Router,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Terminal,
  Wifi,
  Zap,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { BandwidthGraph, Button, MetricTile, StatusBadge } from '../components/ui/Primitives';

export const DashboardView: React.FC = () => {
  const {
    setActiveNav,
    connected,
    internetReachable,
    networkInfo,
    bandwidthHistory,
    currentDownloadMbps,
    currentUploadMbps,
    currentPingMs,
    currentJitterMs,
    gatewayPingMs,
    dnsPingMs,
    todayUsageGb,
    monthUsageGb,
    monthDownloadGb,
    monthUploadGb,
    settings,
    monitoringPaused,
    setMonitoringPaused,
    apps,
    connections,
    pushToast,
  } = useNetX();

  const [commandInput, setCommandInput] = useState('');

  const copyValue = (label: string, val: string) => {
    navigator.clipboard?.writeText(val);
    pushToast(`Copied ${label}: ${val}`, 'info');
  };

  const peakDownload = Math.max(...bandwidthHistory.map((p) => p.downloadMbps), currentDownloadMbps);
  const peakUpload = Math.max(...bandwidthHistory.map((p) => p.uploadMbps), currentUploadMbps);
  const usagePercent = Math.min(100, Math.round((monthUsageGb / settings.monthlyCapGb) * 100));

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim().toLowerCase();
    if (!cmd) return;

    if (cmd.includes('speed') || cmd.includes('bench')) {
      setActiveNav('speed-test');
      pushToast('Navigating to Speed Test...', 'info');
    } else if (cmd.includes('wifi') || cmd.includes('signal') || cmd.includes('ssid')) {
      setActiveNav('wifi');
      pushToast('Navigating to Wi-Fi Spectrum...', 'info');
    } else if (cmd.includes('lan') || cmd.includes('arp') || cmd.includes('device') || cmd.includes('subnet')) {
      setActiveNav('network');
      pushToast('Navigating to Local Network & Subnet...', 'info');
    } else if (cmd.includes('diag') || cmd.includes('health') || cmd.includes('check')) {
      setActiveNav('diagnostics');
      pushToast('Navigating to Guided Diagnostics...', 'info');
    } else if (cmd.includes('ping') || cmd.includes('trace') || cmd.includes('dns') || cmd.includes('port') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cmd)) {
      setActiveNav('tools');
      pushToast(`Opening Network Tools for "${cmd}"...`, 'info');
    } else if (cmd.includes('app') || cmd.includes('process')) {
      setActiveNav('applications');
      pushToast('Navigating to Applications...', 'info');
    } else if (cmd.includes('conn') || cmd.includes('socket')) {
      setActiveNav('connections');
      pushToast('Navigating to Active Connections...', 'info');
    } else if (cmd.includes('usage') || cmd.includes('data') || cmd.includes('byte')) {
      setActiveNav('data-usage');
      pushToast('Navigating to Data Usage...', 'info');
    } else if (cmd.includes('setting') || cmd.includes('theme') || cmd.includes('dark')) {
      setActiveNav('settings');
      pushToast('Navigating to Settings...', 'info');
    } else {
      setActiveNav('tools');
      pushToast(`Opening Network Tools for "${cmd}"...`, 'info');
    }
    setCommandInput('');
  };

  return (
    <div className="page-container">
      {/* =========================================================================
          HERO SECTION (Direct Inspiration from the Mockup)
          Atmospheric title, frosted glass command prompt bar, suggestion pills,
          and 4 glass quick-launch cards
          ========================================================================= */}
      <section className="hero-section" aria-label="Command & Network Overview">
        <div className="hero-header-wrap">
          <h1 className="hero-title">What can I monitor for you today?</h1>
          <p className="hero-subtitle">
            Connected to <span className="hero-highlight">{networkInfo.ssid}</span> · Local IP <span className="mono hero-highlight">{networkInfo.ipv4}</span> · 64-bit hardware telemetry
          </p>
        </div>

        {/* Frosted Glass Prompt / Command Input */}
        <form className="hero-command-bar" onSubmit={handleCommandSubmit}>
          <div className="hero-command-left-icon">
            <Terminal size={17} />
          </div>
          <input
            type="text"
            className="hero-command-input"
            placeholder="Type a command, IP address, or utility (e.g. speed test, 1.1.1.1, scan wifi, arp sweep)..."
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
          />
          <button type="submit" className="hero-command-btn" title="Run command">
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Suggestion Pills */}
        <div className="hero-pills-row">
          <button
            type="button"
            className="hero-pill"
            onClick={() => setActiveNav('speed-test')}
          >
            <Gauge size={13} className="hero-pill-icon" />
            <span>Speed Benchmark</span>
          </button>
          <button
            type="button"
            className="hero-pill"
            onClick={() => setActiveNav('wifi')}
          >
            <Wifi size={13} className="hero-pill-icon" />
            <span>Wi-Fi Spectrum</span>
          </button>
          <button
            type="button"
            className="hero-pill"
            onClick={() => setActiveNav('network')}
          >
            <Radio size={13} className="hero-pill-icon" />
            <span>Subnet ARP Sweep</span>
          </button>
          <button
            type="button"
            className="hero-pill"
            onClick={() => setActiveNav('diagnostics')}
          >
            <Stethoscope size={13} className="hero-pill-icon" />
            <span>Guided Diagnostics</span>
          </button>
          <button
            type="button"
            className="hero-pill"
            onClick={() => setActiveNav('data-usage')}
          >
            <BarChart3 size={13} className="hero-pill-icon" />
            <span>Data Usage</span>
          </button>
        </div>

        {/* 4 Frosted Launch Cards (Exact mirror of the 4 starter cards in the inspo image) */}
        <div className="hero-cards-grid">
          <div
            className="hero-launch-card"
            onClick={() => setActiveNav('dashboard')}
            role="button"
            tabIndex={0}
          >
            <div className="launch-card-content">
              <span className="launch-card-title">Live Bandwidth</span>
              <span className="launch-card-sub">64-bit hardware counters</span>
              <div className="launch-card-metric mono">
                ↓ {currentDownloadMbps.toFixed(1)} / ↑ {currentUploadMbps.toFixed(1)} Mbps
              </div>
            </div>
            <div className="launch-card-icon-wrap icon-purple">
              <Activity size={18} />
            </div>
          </div>

          <div
            className="hero-launch-card"
            onClick={() => setActiveNav('speed-test')}
            role="button"
            tabIndex={0}
          >
            <div className="launch-card-content">
              <span className="launch-card-title">Speed Benchmark</span>
              <span className="launch-card-sub">Cloudflare HTTPS engine</span>
              <div className="launch-card-metric mono">
                {currentPingMs || '—'} ms ping · {currentJitterMs.toFixed(1)} ms jitter
              </div>
            </div>
            <div className="launch-card-icon-wrap icon-cyan">
              <Gauge size={18} />
            </div>
          </div>

          <div
            className="hero-launch-card"
            onClick={() => setActiveNav('connections')}
            role="button"
            tabIndex={0}
          >
            <div className="launch-card-content">
              <span className="launch-card-title">Active Sockets</span>
              <span className="launch-card-sub">TCP / UDP process mapping</span>
              <div className="launch-card-metric mono">
                {connections.length} active sockets · {apps.length} apps
              </div>
            </div>
            <div className="launch-card-icon-wrap icon-indigo">
              <Cable size={18} />
            </div>
          </div>

          <div
            className="hero-launch-card"
            onClick={() => setActiveNav('diagnostics')}
            role="button"
            tabIndex={0}
          >
            <div className="launch-card-content">
              <span className="launch-card-title">Guided Diagnostics</span>
              <span className="launch-card-sub">Automated health audit</span>
              <div className="launch-card-metric">
                {connected && internetReachable ? 'All 4 hops healthy' : 'Inspect connection'}
              </div>
            </div>
            <div className="launch-card-icon-wrap icon-mint">
              <ShieldCheck size={18} />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRIMARY PERFORMANCE METRICS AT A GLANCE
          ========================================================================= */}
      <section aria-label="Current network performance metrics" className="metrics-strip">
        <MetricTile
          label="Download Speed"
          value={currentDownloadMbps.toFixed(2)}
          unit="Mbps"
          accentColor="var(--series-download)"
          icon={<ArrowDownRight size={18} />}
          subtext={
            <>
              <span>Peak session:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {peakDownload.toFixed(2)} Mbps
              </span>
            </>
          }
        />

        <MetricTile
          label="Upload Speed"
          value={currentUploadMbps.toFixed(2)}
          unit="Mbps"
          accentColor="var(--series-upload)"
          icon={<ArrowUpRight size={18} />}
          subtext={
            <>
              <span>Peak session:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {peakUpload.toFixed(2)} Mbps
              </span>
            </>
          }
        />

        <MetricTile
          label="Ping Latency"
          value={currentPingMs || '—'}
          unit="ms"
          accentColor="var(--series-ping)"
          icon={<Activity size={18} />}
          subtext={
            <>
              <span>Jitter:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentJitterMs.toFixed(1)} ms
              </span>
              <span>· Gateway {gatewayPingMs} ms</span>
            </>
          }
        />

        <MetricTile
          label="Data Usage"
          value={todayUsageGb.toFixed(2)}
          unit="GB today"
          accentColor="var(--brand-mint-bright)"
          icon={<BarChart3 size={18} />}
          subtext={
            <>
              <span>This month:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {monthUsageGb.toFixed(2)} GB
              </span>
              <span>({usagePercent}%)</span>
            </>
          }
        />
      </section>

      {/* =========================================================================
          CONNECTION PATH & HEALTH (4-HOP REAL TOPOLOGY)
          ========================================================================= */}
      <section className="surface-panel" aria-label="Connection topology and quick actions">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Connection Path &amp; Health</h2>
            <p className="surface-panel-subtitle">
              Live end-to-end verification from {networkInfo.hostname} to the internet.
            </p>
          </div>
          <StatusBadge
            variant={connected && internetReachable ? 'success' : 'warning'}
            iconStyle="check"
            label={connected && internetReachable ? 'All Hops Healthy' : 'Checking Path'}
          />
        </div>

        {/* 4-Hop Topology Chain */}
        <div className="topology-grid">
          <div className="topology-node">
            <span className="topology-step-badge">1</span>
            <div className="topology-icon-ring">
              <Wifi size={22} />
            </div>
            <div className="topology-node-title">{networkInfo.interfaceName} Adapter</div>
            <div className="topology-node-detail">
              {networkInfo.ssid} · {networkInfo.linkSpeedMbps} Mbps
            </div>
            <StatusBadge
              variant={connected ? 'success' : 'danger'}
              label={connected ? 'Active' : 'Down'}
            />
          </div>

          <div className="topology-connector" aria-hidden="true">
            <span className="topology-latency-tag">{gatewayPingMs} ms</span>
            <div className="topology-dashed-line" />
          </div>

          <div className="topology-node">
            <span className="topology-step-badge">2</span>
            <div className="topology-icon-ring">
              <Router size={22} />
            </div>
            <div className="topology-node-title">Local Gateway</div>
            <div className="topology-node-detail mono">{networkInfo.gateway}</div>
            <StatusBadge
              variant={connected ? 'success' : 'warning'}
              label={connected ? 'Online' : 'Unreachable'}
            />
          </div>

          <div className="topology-connector" aria-hidden="true">
            <span className="topology-latency-tag">{dnsPingMs} ms</span>
            <div className="topology-dashed-line" />
          </div>

          <div className="topology-node">
            <span className="topology-step-badge">3</span>
            <div className="topology-icon-ring">
              <Server size={22} />
            </div>
            <div className="topology-node-title">DNS Resolver</div>
            <div className="topology-node-detail mono">{networkInfo.dnsServers}</div>
            <StatusBadge
              variant={internetReachable ? 'success' : 'warning'}
              label={internetReachable ? 'Resolved' : 'Slow'}
            />
          </div>

          <div className="topology-connector" aria-hidden="true">
            <span className="topology-latency-tag">{currentPingMs} ms</span>
            <div className="topology-dashed-line" />
          </div>

          <div className="topology-node">
            <span className="topology-step-badge amber">4</span>
            <div className="topology-icon-ring amber">
              <Globe size={22} />
            </div>
            <div className="topology-node-title">Internet</div>
            <div className="topology-node-detail mono">{networkInfo.publicIp}</div>
            <StatusBadge
              variant={internetReachable ? 'success' : 'danger'}
              label={internetReachable ? 'Connected' : 'Offline'}
            />
          </div>
        </div>

        {/* Integrated Status Callout & Quick Actions Bar */}
        <div className={`status-callout-strip ${!internetReachable ? 'warning' : ''}`}>
          <div className="status-callout-left">
            <CheckCircle2 size={18} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            <span>
              {internetReachable
                ? `Connected to ${networkInfo.ssid} (${networkInfo.ipv4}) via ${networkInfo.adapterDescription}. Ping latency is ${currentPingMs} ms.`
                : 'Your adapter is active, but external internet reachability is limited.'}
            </span>
          </div>
          <div className="status-callout-actions">
            <Button
              variant="primary"
              icon={<Gauge size={14} />}
              onClick={() => setActiveNav('speed-test')}
            >
              Start Speed Test
            </Button>
            <Button
              variant="secondary"
              icon={<Stethoscope size={14} />}
              onClick={() => setActiveNav('diagnostics')}
            >
              Run Diagnostics
            </Button>
            <Button
              variant="secondary"
              icon={<BarChart3 size={14} />}
              onClick={() => setActiveNav('data-usage')}
            >
              View Data Usage
            </Button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          REAL-TIME NETWORK ACTIVITY GRAPH & MONTHLY DATA SUMMARY
          ========================================================================= */}
      <div className="split-grid-asymmetric">
        <section className="surface-panel" aria-label="Real-time network activity">
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title">Network Activity</h2>
              <p className="surface-panel-subtitle">
                Live bandwidth throughput on {networkInfo.interfaceName} (Mbps)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: 'var(--series-download)',
                    }}
                  />
                  <span>Download</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: 'var(--series-upload)',
                    }}
                  />
                  <span>Upload</span>
                </span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={monitoringPaused ? <Play size={13} /> : <Pause size={13} />}
                onClick={() => setMonitoringPaused((p) => !p)}
              >
                {monitoringPaused ? 'Resume' : 'Pause'}
              </Button>
            </div>
          </div>

          <BandwidthGraph data={bandwidthHistory} height={215} />
        </section>

        {/* Data Usage Overview Card */}
        <section
          className="surface-panel"
          aria-label="Data usage summary"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div className="surface-panel-header">
              <div>
                <h2 className="surface-panel-title">Data Usage</h2>
                <p className="surface-panel-subtitle">Real system adapter byte counters</p>
              </div>
              <StatusBadge variant="info" label={`${usagePercent}% of Cap`} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                padding: '12px 14px',
                background: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Today&apos;s Usage</div>
                <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 750 }}>
                  {todayUsageGb.toFixed(2)}{' '}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    GB
                  </span>
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>This Month</div>
                <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 750 }}>
                  {monthUsageGb.toFixed(2)}{' '}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    GB
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>Monthly allowance progress</span>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {monthUsageGb.toFixed(2)} / {settings.monthlyCapGb} GB
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${usagePercent}%` }} />
              </div>
            </div>

            <div className="kv-list">
              <div className="kv-row" style={{ padding: '7px 2px' }}>
                <span className="kv-label">Downloaded (Recorded)</span>
                <span className="kv-value mono">{monthDownloadGb.toFixed(2)} GB</span>
              </div>
              <div className="kv-row" style={{ padding: '7px 2px' }}>
                <span className="kv-label">Uploaded (Recorded)</span>
                <span className="kv-value mono">{monthUploadGb.toFixed(2)} GB</span>
              </div>
            </div>
          </div>

          <div className="panel-footer-link">
            <button
              type="button"
              className="link-btn"
              onClick={() => setActiveNav('data-usage')}
            >
              <span>View Detailed Data Usage</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </section>
      </div>

      {/* =========================================================================
          TWO-COLUMN BOTTOM DETAILS: REAL NETWORK STATUS + REAL ACTIVE APPLICATIONS
          ========================================================================= */}
      <div className="split-grid-2">
        {/* Left: Real Network Status Key-Value List */}
        <section className="surface-panel" aria-label="Connection and network status">
          <div className="surface-panel-header">
            <h2 className="surface-panel-title">
              <Wifi size={17} style={{ color: 'var(--brand-mint)' }} />
              <span>Connection Status</span>
            </h2>
            <StatusBadge
              variant={connected ? 'success' : 'danger'}
              label={connected ? 'Connected' : 'Disconnected'}
            />
          </div>

          <div className="kv-list">
            <div className="kv-row">
              <span className="kv-label">Connected Network (SSID)</span>
              <span className="kv-value">
                {networkInfo.ssid} ({networkInfo.security})
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Connection Type</span>
              <span className="kv-value">{networkInfo.connectionType}</span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Local IPv4 Address</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.ipv4}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    border: 'none',
                    padding: 3,
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                  onClick={() => copyValue('Local IPv4', networkInfo.ipv4)}
                  title="Copy IPv4 address"
                  aria-label="Copy IPv4 address"
                >
                  <Copy size={13} />
                </button>
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Public IPv4 Address</span>
              <span className="kv-value mono">{networkInfo.publicIp}</span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Default Gateway / DNS</span>
              <span className="kv-value mono">
                {networkInfo.gateway} / {networkInfo.dnsServers}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Adapter Hardware</span>
              <span className="kv-value" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {networkInfo.adapterDescription}
              </span>
            </div>
          </div>

          <div className="panel-footer-link">
            <button type="button" className="link-btn" onClick={() => setActiveNav('network')}>
              <span>View Network &amp; Adapter Details</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </section>

        {/* Right: Real Active Applications */}
        <section className="surface-panel" aria-label="Active applications bandwidth">
          <div className="surface-panel-header">
            <h2 className="surface-panel-title">
              <Cpu size={17} style={{ color: 'var(--brand-mint)' }} />
              <span>Active Applications</span>
            </h2>
            <StatusBadge
              variant="neutral"
              label={`${apps.filter((a) => a.status === 'active').length} Active`}
            />
          </div>

          <div className="entity-list">
            {apps.slice(0, 5).map((app) => (
              <div key={app.id} className="entity-row">
                <div className="entity-left">
                  <div className="entity-icon-circle" aria-hidden="true">
                    <Activity size={16} />
                  </div>
                  <div>
                    <div className="entity-title">{app.name}</div>
                    <div className="entity-subtitle">
                      {app.processName} (PID {app.pid}) · {app.connectionsCount} sockets
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      className="mono"
                      style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--series-download)' }}
                    >
                      ↓ {app.downloadMbps.toFixed(2)} Mbps
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ↑ {app.uploadMbps.toFixed(2)} Mbps
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="panel-footer-link">
            <button
              type="button"
              className="link-btn"
              onClick={() => setActiveNav('applications')}
            >
              <span>View All Applications</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </section>
      </div>

      {/* =========================================================================
          BOTTOM SECURITY & DIAGNOSTICS CALLOUT STRIP
          ========================================================================= */}
      <section
        className="surface-panel"
        style={{
          background: 'var(--bg-surface-tinted)',
          borderColor: 'var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 22px',
        }}
        aria-label="Network security and diagnostics status"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>
              {networkInfo.security} Wireless Security · Signal {networkInfo.signalQuality}% (
              {networkInfo.signalDbm} dBm)
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Connected to BSSID {networkInfo.bssid} on {networkInfo.band} (Channel{' '}
              {networkInfo.channel}).
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          icon={<Stethoscope size={15} />}
          onClick={() => setActiveNav('diagnostics')}
        >
          Verify Network Health
        </Button>
      </section>
    </div>
  );
};
