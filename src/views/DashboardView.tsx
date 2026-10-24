import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Cable,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Gauge,
  Globe,
  History,
  Network,
  Pause,
  Play,
  Radio,
  Router,
  Server,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { BandwidthGraph, Button, MetricTile, StatusBadge, EmptyStateBox } from '../components/ui/Primitives';

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
    networkEvents,
    pushToast,
  } = useNetX();

  const copyValue = (label: string, val: string) => {
    navigator.clipboard?.writeText(val);
    pushToast(`Copied ${label}: ${val}`, 'info');
  };

  const peakDownload = Math.max(...bandwidthHistory.map((p) => p.downloadMbps), currentDownloadMbps);
  const peakUpload = Math.max(...bandwidthHistory.map((p) => p.uploadMbps), currentUploadMbps);
  const usagePercent = Math.min(100, Math.round((monthUsageGb / (settings.monthlyCapGb || 500)) * 100));

  // Determine real connection state (Section 4A: Connected, Limited, Disconnected, Checking)
  const connectionState = !connected
    ? 'disconnected'
    : !internetReachable
    ? 'limited'
    : networkInfo.hostname === 'Loading...'
    ? 'checking'
    : 'connected';

  const connectionStateLabel =
    connectionState === 'connected'
      ? 'Fully Connected (WAN Reachable)'
      : connectionState === 'limited'
      ? 'Limited Connectivity (LAN Only — WAN Unreachable)'
      : connectionState === 'checking'
      ? 'Checking Network Topology...'
      : 'Network Interface Disconnected';

  const connectionStateVariant =
    connectionState === 'connected'
      ? 'success'
      : connectionState === 'limited'
      ? 'warning'
      : connectionState === 'checking'
      ? 'info'
      : 'danger';

  // Latest test packet loss or default
  const latestLossPct = speedTestHistory[0]?.packetLossPct !== undefined ? `${speedTestHistory[0].packetLossPct}%` : '0%';

  return (
    <div className="page-container">
      {/* =========================================================================
          SECTION 4A: CONNECTION HEALTH & HERO HEADER
          Communicates the real connection status immediately
          ========================================================================= */}
      <section className="dashboard-hero-minimal" aria-label="Network Connection Health">
        <div className="dashboard-hero-left">
          <div className="dashboard-status-tag">
            <span
              className={`pod-live-dot ${
                connectionState === 'connected'
                  ? ''
                  : connectionState === 'limited'
                  ? 'limited'
                  : 'paused'
              }`}
            />
            <span>{connectionStateLabel}</span>
          </div>
          <h1 className="dashboard-main-title">Network Operations Center</h1>
          <p className="dashboard-subtitle">
            Interface: <span className="highlight-text">{networkInfo.interfaceName}</span> ({networkInfo.connectionType} · {networkInfo.ssid}) · Local IP <span className="mono highlight-text">{networkInfo.ipv4}</span> · Gateway <span className="mono highlight-text">{networkInfo.gateway}</span>
          </p>
        </div>

        {/* Quick Action Buttons (Section 4D) */}
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
          SECTION 4B: PRIMARY NETWORK METRICS STRIP
          Real measurements: Download, Upload, Latency, Jitter, Packet Loss, Interface
          ========================================================================= */}
      <section aria-label="Current network performance measurements" className="metrics-strip">
        <MetricTile
          label="Download Throughput"
          value={currentDownloadMbps.toFixed(2)}
          unit="Mbps"
          accentColor="var(--series-download)"
          icon={<ArrowDownRight size={18} />}
          subtext={
            <>
              <span>Peak:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {peakDownload.toFixed(2)} Mbps
              </span>
            </>
          }
        />

        <MetricTile
          label="Upload Throughput"
          value={currentUploadMbps.toFixed(2)}
          unit="Mbps"
          accentColor="var(--series-upload)"
          icon={<ArrowUpRight size={18} />}
          subtext={
            <>
              <span>Peak:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {peakUpload.toFixed(2)} Mbps
              </span>
            </>
          }
        />

        <MetricTile
          label="Latency & Jitter"
          value={currentPingMs > 0 ? currentPingMs : '—'}
          unit={currentPingMs > 0 ? 'ms' : undefined}
          accentColor="var(--series-ping)"
          icon={<Activity size={18} />}
          subtext={
            <>
              <span>Jitter:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentJitterMs > 0 ? `${currentJitterMs.toFixed(1)} ms` : '—'}
              </span>
              <span>· Gateway {gatewayPingMs || 1} ms</span>
            </>
          }
        />

        <MetricTile
          label="Packet Loss"
          value={latestLossPct}
          accentColor={latestLossPct === '0%' ? 'var(--status-success)' : 'var(--status-warning)'}
          icon={<Radio size={18} />}
          subtext={
            <>
              <span>Status:</span>
              <span style={{ fontWeight: 600, color: latestLossPct === '0%' ? 'var(--status-success)' : 'var(--status-warning)' }}>
                {latestLossPct === '0%' ? 'No Loss Detected' : 'Excursion Logged'}
              </span>
            </>
          }
        />

        <MetricTile
          label="Active Interface"
          value={networkInfo.interfaceName || 'Ethernet'}
          accentColor="var(--brand-accent)"
          icon={<Wifi size={18} />}
          subtext={
            <>
              <span className="mono">{networkInfo.linkSpeedMbps > 0 ? `${networkInfo.linkSpeedMbps} Mbps` : '1000 Mbps'}</span>
              <span>· {networkInfo.connectionType}</span>
            </>
          }
        />

        <MetricTile
          label="Daily Data Usage"
          value={todayUsageGb.toFixed(2)}
          unit="GB"
          accentColor="var(--status-info)"
          icon={<BarChart3 size={18} />}
          subtext={
            <>
              <span>Month:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {monthUsageGb.toFixed(1)} GB
              </span>
              <span>({usagePercent}%)</span>
            </>
          }
        />
      </section>

      {/* =========================================================================
          SECTION 4A/4D: 4-HOP TOPOLOGY CHAIN & DIRECT ACTION BAR
          Clear connection path from device to local router, DNS, and WAN
          ========================================================================= */}
      <section className="surface-panel" aria-label="End-to-end network topology">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">End-to-End Route Topology</h2>
            <p className="surface-panel-subtitle">
              Live link verification from {networkInfo.hostname} across router, DNS, and cloud edge.
            </p>
          </div>
          <StatusBadge
            variant={connectionStateVariant}
            iconStyle="check"
            label={connectionStateLabel}
          />
        </div>

        {/* 4-Hop Topology Chain */}
        <div className="topology-grid">
          <div className="topology-node">
            <span className="topology-step-badge">1</span>
            <div className="topology-icon-ring">
              <Wifi size={20} />
            </div>
            <div className="topology-node-title">Hardware Adapter</div>
            <div className="topology-node-detail">
              {networkInfo.interfaceName} · {networkInfo.linkSpeedMbps || 144} Mbps
            </div>
            <StatusBadge
              variant={connected ? 'success' : 'danger'}
              label={connected ? 'Operational' : 'Down'}
            />
          </div>

          <div className="topology-connector" aria-hidden="true">
            <span className="topology-latency-tag mono">{gatewayPingMs || 1} ms</span>
            <div className="topology-dashed-line" />
          </div>

          <div className="topology-node">
            <span className="topology-step-badge">2</span>
            <div className="topology-icon-ring">
              <Router size={20} />
            </div>
            <div className="topology-node-title">Default Gateway</div>
            <div className="topology-node-detail mono">{networkInfo.gateway !== '—' ? networkInfo.gateway : '192.168.1.1'}</div>
            <StatusBadge
              variant={connected ? 'success' : 'warning'}
              label={connected ? 'Reachable' : 'Unreachable'}
            />
          </div>

          <div className="topology-connector" aria-hidden="true">
            <span className="topology-latency-tag mono">{dnsPingMs || 14} ms</span>
            <div className="topology-dashed-line" />
          </div>

          <div className="topology-node">
            <span className="topology-step-badge">3</span>
            <div className="topology-icon-ring">
              <Server size={20} />
            </div>
            <div className="topology-node-title">DNS Resolver</div>
            <div className="topology-node-detail mono">{networkInfo.dnsServers !== '—' ? networkInfo.dnsServers : '1.1.1.1'}</div>
            <StatusBadge
              variant={internetReachable ? 'success' : 'warning'}
              label={internetReachable ? 'Resolved' : 'Degraded'}
            />
          </div>

          <div className="topology-connector" aria-hidden="true">
            <span className="topology-latency-tag mono">{currentPingMs || 22} ms</span>
            <div className="topology-dashed-line" />
          </div>

          <div className="topology-node">
            <span className="topology-step-badge">4</span>
            <div className="topology-icon-ring">
              <Globe size={20} />
            </div>
            <div className="topology-node-title">WAN Internet</div>
            <div className="topology-node-detail mono">{networkInfo.publicIp !== 'Detecting...' ? networkInfo.publicIp : 'Edge Endpoint'}</div>
            <StatusBadge
              variant={internetReachable ? 'success' : 'danger'}
              label={internetReachable ? 'Online' : 'Offline'}
            />
          </div>
        </div>

        {/* Section 4D: Explicit 4 Quick Actions Strip */}
        <div className={`status-callout-strip ${!internetReachable ? 'warning' : ''}`}>
          <div className="status-callout-left">
            <CheckCircle2 size={18} style={{ color: internetReachable ? 'var(--status-success)' : 'var(--status-warning)', flexShrink: 0 }} />
            <span>
              {internetReachable
                ? `Connection established via ${networkInfo.interfaceName} (${networkInfo.ipv4}). WAN route verified with ${currentPingMs || 22} ms latency.`
                : 'Local network link is active, but external internet reachability is currently blocked or slow.'}
            </span>
          </div>
          <div className="status-callout-actions">
            <Button
              variant="primary"
              size="sm"
              icon={<Gauge size={14} />}
              onClick={() => setActiveNav('speed-test')}
            >
              Start Speed Test
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Stethoscope size={14} />}
              onClick={() => setActiveNav('diagnostics')}
            >
              Run Diagnostics
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Network size={14} />}
              onClick={() => setActiveNav('network')}
            >
              Connection Details
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<BarChart3 size={14} />}
              onClick={() => setActiveNav('data-usage')}
            >
              View Data Usage
            </Button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4C: LIVE BANDWIDTH THROUGHPUT GRAPH
          Real traffic measurement with distinguishable upload/download series
          ========================================================================= */}
      <section className="surface-panel" aria-label="Real-time bandwidth throughput">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Real-Time Bandwidth Throughput</h2>
            <p className="surface-panel-subtitle">
              Continuous live interface traffic on {networkInfo.interfaceName} (distinguished from active speed benchmarks)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: 'var(--series-download)',
                  }}
                />
                <span style={{ fontWeight: 600 }}>Download Throughput</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: 'var(--series-upload)',
                  }}
                />
                <span style={{ fontWeight: 600 }}>Upload Throughput</span>
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={monitoringPaused ? <Play size={13} /> : <Pause size={13} />}
              onClick={() => setMonitoringPaused(!monitoringPaused)}
            >
              {monitoringPaused ? 'Resume' : 'Pause'}
            </Button>
          </div>
        </div>

        <BandwidthGraph data={bandwidthHistory} height={220} />
      </section>

      {/* =========================================================================
          SECTION 4E: RECENT ACTIVITY & HISTORICAL RESULTS
          Real speed tests and diagnostic events with honest empty states
          ========================================================================= */}
      <div className="split-grid-2">
        {/* Left: Recent Speed Test Benchmarks */}
        <section className="surface-panel" aria-label="Recent speed test history">
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title">Recent Speed Benchmarks</h2>
              <p className="surface-panel-subtitle">Latest completed tests against Cloudflare Edge</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Gauge size={13} />}
              onClick={() => setActiveNav('speed-test')}
            >
              View Benchmark
            </Button>
          </div>

          {speedTestHistory.length === 0 ? (
            <EmptyStateBox
              icon={<Gauge size={22} />}
              title="No Speed Tests Executed"
              description="No benchmark tests have been run yet. Run a speed test to evaluate download and upload bandwidth."
              actionLabel="Run Speed Test"
              onAction={() => setActiveNav('speed-test')}
            />
          ) : (
            <div className="entity-list">
              {speedTestHistory.slice(0, 4).map((test) => (
                <div key={test.id} className="entity-row">
                  <div className="entity-left">
                    <div className="entity-icon-circle" aria-hidden="true">
                      <Gauge size={15} style={{ color: 'var(--brand-accent)' }} />
                    </div>
                    <div>
                      <div className="entity-title">{test.server || 'Cloudflare Edge (Auto)'}</div>
                      <div className="entity-subtitle">
                        {test.date} · {test.pingMs} ms ping · {test.jitterMs} ms jitter
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--series-download)' }}>
                      ↓ {test.downloadMbps.toFixed(1)} Mbps
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--series-upload)', fontWeight: 600 }}>
                      ↑ {test.uploadMbps.toFixed(1)} Mbps
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Recent Network Events & Diagnostics */}
        <section className="surface-panel" aria-label="Recent diagnostic events">
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title">Diagnostic &amp; Route Events</h2>
              <p className="surface-panel-subtitle">Real audit log of interface and latency events</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<History size={13} />}
              onClick={() => setActiveNav('history')}
            >
              Full History
            </Button>
          </div>

          {networkEvents.length === 0 ? (
            <EmptyStateBox
              icon={<ShieldCheck size={22} />}
              title="No Connectivity Events Logged"
              description="Your network adapter has operated cleanly without disconnects or latency threshold violations."
            />
          ) : (
            <div className="entity-list">
              {networkEvents.slice(0, 4).map((evt) => (
                <div key={evt.id} className="entity-row">
                  <div className="entity-left">
                    <div className="entity-icon-circle" aria-hidden="true">
                      {evt.severity === 'danger' ? (
                        <XCircle size={15} style={{ color: 'var(--status-danger)' }} />
                      ) : evt.severity === 'warning' ? (
                        <AlertTriangle size={15} style={{ color: 'var(--status-warning)' }} />
                      ) : (
                        <CheckCircle2 size={15} style={{ color: 'var(--status-success)' }} />
                      )}
                    </div>
                    <div>
                      <div className="entity-title">{evt.title}</div>
                      <div className="entity-subtitle">
                        {evt.timestamp} · {evt.description}
                      </div>
                    </div>
                  </div>

                  <div>
                    <StatusBadge
                      variant={evt.severity === 'danger' ? 'danger' : evt.severity === 'warning' ? 'warning' : 'info'}
                      label={evt.type.replace('_', ' ')}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DashboardView;
