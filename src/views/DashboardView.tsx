import React from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  Gauge,
  Globe,
  Pause,
  Play,
  Router,
  Server,
  Stethoscope,
  Wifi,
  Sparkles,
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
    speedTestHistory,
    pushToast,
  } = useNetX();

  const copyValue = (label: string, val: string) => {
    navigator.clipboard?.writeText(val);
    pushToast(`Copied ${label}: ${val}`, 'info');
  };

  const peakDownload = Math.max(...bandwidthHistory.map((p) => p.downloadMbps), currentDownloadMbps);
  const peakUpload = Math.max(...bandwidthHistory.map((p) => p.uploadMbps), currentUploadMbps);
  const usagePercent = Math.min(100, Math.round((monthUsageGb / settings.monthlyCapGb) * 100));

  return (
    <div className="page-container">
      {/* =========================================================================
          MINIMAL LIVE NETWORK HUB HEADER
          Clean greeting, active interface pill, and direct benchmark actions
          ========================================================================= */}
      <section className="dashboard-hero-minimal" aria-label="Network Operations Status">
        <div className="dashboard-hero-left">
          <div className="dashboard-status-tag">
            <span className={`pod-live-dot ${!connected ? 'paused' : ''}`} />
            <span>{connected ? 'Live Hardware Telemetry Active' : 'Network Disconnected'}</span>
          </div>
          <h1 className="dashboard-main-title">Network Operations Center</h1>
          <p className="dashboard-subtitle">
            Adapter: <span className="highlight-text">{networkInfo.interfaceName}</span> ({networkInfo.ssid}) · Local IP <span className="mono highlight-text">{networkInfo.ipv4}</span> · Gateway <span className="mono highlight-text">{networkInfo.gateway}</span>
          </p>
        </div>

        <div className="dashboard-hero-actions">
          <Button
            variant="primary"
            icon={<Gauge size={15} />}
            onClick={() => setActiveNav('speed-test')}
          >
            Start Speed Test
          </Button>
          <Button
            variant="secondary"
            icon={<Stethoscope size={15} />}
            onClick={() => setActiveNav('diagnostics')}
          >
            Run Diagnostics
          </Button>
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
          AI-POWERED NETWORK OPERATIONS & TELEMETRY SUMMARY
          ========================================================================= */}
      <section
        className="surface-panel"
        style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(99, 102, 241, 0.02))',
          borderColor: 'rgba(124, 58, 237, 0.25)',
          padding: '18px 22px',
          marginBottom: '16px',
        }}
        aria-label="AI Network Telemetry Summary"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)' }}>
              <Sparkles size={17} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  AI Network Operations Summary
                </h2>
                <span className="badge-modern" style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent-purple)', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  Live Intelligence
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Synthesized from hardware adapter counters, 4-hop topology, and edge benchmarks
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />}
            onClick={() => setActiveNav('ai-assistant')}
            style={{ fontWeight: 600 }}
          >
            Ask NetX AI Assistant
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {/* Tile 1: Connectivity & Route Health */}
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
              Route &amp; Interface Health
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {connected && internetReachable ? '🟢 Route Fully Operational' : '⚠️ Connectivity Interrupted'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Connected via {networkInfo.interfaceName} ({networkInfo.ssid !== 'Disconnected' ? networkInfo.ssid : 'Ethernet'}) · Gateway RTT {gatewayPingMs || 1} ms
            </div>
          </div>

          {/* Tile 2: Speed Benchmark vs Traffic Throughput */}
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
              Benchmark vs Live Throughput
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {speedTestHistory.length > 0 ? (
                <>↓ {speedTestHistory[0].downloadMbps.toFixed(1)} Mbps · ↑ {speedTestHistory[0].uploadMbps.toFixed(1)} Mbps</>
              ) : (
                'No benchmark run today'
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Live Traffic: ↓ {currentDownloadMbps.toFixed(2)} Mbps · ↑ {currentUploadMbps.toFixed(2)} Mbps
            </div>
          </div>

          {/* Tile 3: Latency & Real-Time Stability */}
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
              Interactive Suitability
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {currentPingMs > 0 && currentPingMs < 45 && currentJitterMs < 8
                ? '🟢 Competitive Gaming & 4K Ready'
                : currentPingMs <= 90
                ? '🟡 Good for Video Calls & Browsing'
                : '🟠 Latency Elevated / Jitter Detected'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Idle Ping: {currentPingMs || '—'} ms (Jitter: {currentJitterMs.toFixed(1)} ms) · DNS {dnsPingMs || 12} ms
            </div>
          </div>
        </div>
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
    </div>
  );
};
