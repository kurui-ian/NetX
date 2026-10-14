import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Play,
  Route,
  Search,
  Shield,
  Layers,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Button, EmptyStateBox, StatusBadge, MetricTile } from '../components/ui/Primitives';

type ToolTab = 'ping' | 'route' | 'traceroute' | 'dns' | 'port';

interface PingSummary {
  sent: number;
  received: number;
  lost: number;
  lossPct: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
}

interface RouteEntry {
  destination: string;
  netmask: string;
  gateway: string;
  interfaceIp: string;
  metric: number;
}

export const ToolsView: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolTab>('ping');
  const [target, setTarget] = useState<string>('1.1.1.1');
  const [running, setRunning] = useState<boolean>(false);
  const [showRawConsole, setShowRawConsole] = useState<boolean>(false);

  // Ping Options & Results
  const [pingCount, setPingCount] = useState<number>(4);
  const [pingTimeout, setPingTimeout] = useState<number>(2000);
  const [pingRows, setPingRows] = useState<
    { seq: number; ip: string; bytes: number; ttl: number; timeMs: number; status: string }[]
  >([]);
  const [pingSummary, setPingSummary] = useState<PingSummary | null>(null);

  // Route Table Results & Filter
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [routeSearch, setRouteSearch] = useState<string>('');

  // Traceroute Results
  const [traceRows, setTraceRows] = useState<
    { hop: number; host: string; ip: string; rtt1: string; rtt2: string; rtt3: string }[]
  >([]);

  // DNS Results
  const [dnsRecords, setDnsRecords] = useState<
    { type: string; name: string; value: string; latencyMs: number }[]
  >([]);

  // Port Check Results
  const [portResults, setPortResults] = useState<
    { port: number; service: string; state: string; latency: string }[]
  >([]);

  const [rawOutput, setRawOutput] = useState<string>('');

  const executeTool = async (toolToRun: ToolTab, hostInput?: string) => {
    if (!window.netxNative) return;
    setRunning(true);
    setRawOutput('');

    const cleanHost = (hostInput !== undefined ? hostInput : target).trim() || '1.1.1.1';

    try {
      if (toolToRun === 'ping') {
        const res = await window.netxNative.runTool('ping', cleanHost, {
          count: pingCount,
          timeout: pingTimeout,
        });
        setPingRows(res?.rows || []);
        setPingSummary(res?.summary || null);
        setRawOutput(res?.raw || '');
      } else if (toolToRun === 'route') {
        const res = await window.netxNative.runTool('route', '');
        setRoutes(res?.routes || []);
        setRawOutput(res?.raw || '');
      } else if (toolToRun === 'traceroute') {
        const res = await window.netxNative.runTool('traceroute', cleanHost);
        setTraceRows(res?.rows || []);
        setRawOutput(res?.raw || '');
      } else if (toolToRun === 'dns') {
        const res = await window.netxNative.runTool('dns', cleanHost);
        setDnsRecords(res?.records || []);
      } else if (toolToRun === 'port') {
        const res = await window.netxNative.runTool('port', cleanHost);
        setPortResults(res?.results || []);
      }
    } catch (err) {
      setRawOutput(String(err));
    } finally {
      setRunning(false);
    }
  };

  // Initial load
  useEffect(() => {
    executeTool('ping', '1.1.1.1');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTool(activeTool, target);
  };

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    if (!routeSearch.trim()) return routes;
    const q = routeSearch.toLowerCase();
    return routes.filter(
      (r) =>
        r.destination.toLowerCase().includes(q) ||
        r.gateway.toLowerCase().includes(q) ||
        r.interfaceIp.toLowerCase().includes(q) ||
        r.netmask.toLowerCase().includes(q)
    );
  }, [routes, routeSearch]);

  const getRouteType = (destination: string, netmask: string) => {
    if (destination === '0.0.0.0' && netmask === '0.0.0.0') return 'Default Gateway';
    if (destination.startsWith('127.')) return 'Loopback';
    if (destination.startsWith('224.')) return 'Multicast';
    if (destination === '255.255.255.255') return 'Broadcast';
    if (netmask === '255.255.255.255') return 'Host Route';
    return 'Subnet Route';
  };

  return (
    <div className="view-container">
      {/* 1. Header Banner */}
      <div className="view-header-strip">
        <div className="header-left">
          <div className="header-icon-wrap" style={{ background: 'rgba(167, 139, 250, 0.12)' }}>
            <Layers size={22} style={{ color: 'var(--brand-purple)' }} />
          </div>
          <div>
            <h1 className="view-title">Network Utilities &amp; Diagnostics Suite</h1>
            <p className="view-subtitle">
              Execute real Windows network commands: ICMP ping probe, kernel routing table, hop traceroute, multi-record DNS resolution, and TCP port tester.
            </p>
          </div>
        </div>

        <div className="segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'ping'}
            className={`segmented-btn ${activeTool === 'ping' ? 'active' : ''}`}
            onClick={() => {
              setActiveTool('ping');
              if (target === 'cloudflare.com') setTarget('1.1.1.1');
            }}
          >
            Ping
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'route'}
            className={`segmented-btn ${activeTool === 'route' ? 'active' : ''}`}
            onClick={() => {
              setActiveTool('route');
              if (routes.length === 0) executeTool('route');
            }}
          >
            Route Table
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'traceroute'}
            className={`segmented-btn ${activeTool === 'traceroute' ? 'active' : ''}`}
            onClick={() => setActiveTool('traceroute')}
          >
            Traceroute
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'dns'}
            className={`segmented-btn ${activeTool === 'dns' ? 'active' : ''}`}
            onClick={() => {
              setActiveTool('dns');
              if (target === '1.1.1.1') setTarget('cloudflare.com');
            }}
          >
            DNS Lookup
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'port'}
            className={`segmented-btn ${activeTool === 'port' ? 'active' : ''}`}
            onClick={() => setActiveTool('port')}
          >
            Port Check
          </button>
        </div>
      </div>

      {/* 2. Interactive Controls Card */}
      <div className="card-surface" style={{ marginBottom: 20 }}>
        {activeTool !== 'route' ? (
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
              <input
                type="text"
                className="input-field mono"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target IP address or domain (e.g. 1.1.1.1, 8.8.8.8, cloudflare.com, google.com)"
                aria-label="Target IP or domain"
              />
            </div>

            {/* Configurable Ping Controls */}
            {activeTool === 'ping' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Count:</span>
                  <select
                    value={pingCount}
                    onChange={(e) => setPingCount(parseInt(e.target.value, 10))}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  >
                    <option value={4}>4 Packets</option>
                    <option value={10}>10 Packets</option>
                    <option value={20}>20 Packets</option>
                  </select>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Timeout:</span>
                  <select
                    value={pingTimeout}
                    onChange={(e) => setPingTimeout(parseInt(e.target.value, 10))}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  >
                    <option value={1000}>1000 ms</option>
                    <option value={2000}>2000 ms</option>
                    <option value={3000}>3000 ms</option>
                  </select>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={running}
              icon={
                activeTool === 'ping' ? (
                  <Play size={14} />
                ) : activeTool === 'traceroute' ? (
                  <Route size={14} />
                ) : activeTool === 'dns' ? (
                  <Search size={14} />
                ) : (
                  <Shield size={14} />
                )
              }
            >
              {running
                ? `Running ${activeTool}...`
                : activeTool === 'ping'
                ? `Ping (${pingCount} pkts)`
                : activeTool === 'traceroute'
                ? 'Trace Route'
                : activeTool === 'dns'
                ? 'Lookup DNS'
                : 'Scan TCP Ports'}
            </Button>
          </form>
        ) : (
          /* Routing Table Control Bar */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', width: 280 }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                  }}
                />
                <input
                  type="text"
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  placeholder="Filter destination, gateway, or interface..."
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: 6,
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 12.5,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {routes.length} active Windows kernel routes loaded
              </span>
            </div>

            <Button
              variant="primary"
              loading={running}
              icon={<RotateCcw size={14} />}
              onClick={() => executeTool('route')}
            >
              Refresh Route Table
            </Button>
          </div>
        )}
      </div>

      {/* 3. Tool Specific Output Display */}

      {/* Tab: PING */}
      {activeTool === 'ping' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Strip */}
          {pingSummary && (
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <MetricTile
                label="Packets Sent / Recv"
                value={`${pingSummary.received} / ${pingSummary.sent}`}
                unit="pkts"
                icon={<Activity size={16} />}
              />
              <MetricTile
                label="Packet Loss"
                value={`${pingSummary.lossPct}%`}
                unit="loss"
                accentColor={pingSummary.lossPct > 0 ? 'var(--status-danger)' : 'var(--brand-mint)'}
                icon={pingSummary.lossPct > 0 ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
              />
              <MetricTile
                label="Minimum RTT"
                value={pingSummary.minMs}
                unit="ms"
                subtext="Best probe"
              />
              <MetricTile
                label="Average RTT"
                value={pingSummary.avgMs}
                unit="ms"
                accentColor="var(--brand-mint)"
                subtext="Mean latency"
              />
              <MetricTile
                label="Maximum RTT"
                value={pingSummary.maxMs}
                unit="ms"
                subtext="Worst excursion"
              />
            </div>
          )}

          {pingRows.length === 0 && !running ? (
            <EmptyStateBox
              title="No Ping Results"
              description="Enter a destination hostname or IP and click Ping to execute genuine Windows ICMP probes."
              actionLabel="Ping 1.1.1.1"
              onAction={() => executeTool('ping', '1.1.1.1')}
            />
          ) : (
            <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="netx-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                    <th style={{ padding: '10px 14px', width: 80 }}>Seq</th>
                    <th style={{ padding: '10px 14px' }}>Target</th>
                    <th style={{ padding: '10px 14px' }}>Reply Address</th>
                    <th style={{ padding: '10px 14px', width: 90 }}>Bytes</th>
                    <th style={{ padding: '10px 14px', width: 80 }}>TTL</th>
                    <th style={{ padding: '10px 14px', width: 120 }}>Latency (RTT)</th>
                    <th style={{ padding: '10px 14px', width: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pingRows.map((r) => (
                    <tr key={r.seq} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        #{r.seq}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{target}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{r.ip}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                        {r.bytes ? `${r.bytes} B` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                        {r.ttl || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand-mint)' }}>
                        {r.status === 'Reply' ? `${r.timeMs} ms` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <StatusBadge
                          variant={r.status === 'Reply' ? 'success' : 'danger'}
                          label={r.status}
                          iconStyle="check"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: ROUTING TABLE */}
      {activeTool === 'route' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredRoutes.length === 0 && !running ? (
            <EmptyStateBox
              icon={<Route size={28} />}
              title="No Routes Found"
              description={
                routes.length === 0
                  ? 'Click Refresh Route Table to parse the Windows IPv4 kernel routing table (route print).'
                  : 'No routes match your search keyword.'
              }
              actionLabel={routes.length === 0 ? 'Load Routes' : undefined}
              onAction={routes.length === 0 ? () => executeTool('route') : undefined}
            />
          ) : (
            <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="netx-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                    <th style={{ padding: '10px 14px' }}>Network Destination</th>
                    <th style={{ padding: '10px 14px' }}>Netmask</th>
                    <th style={{ padding: '10px 14px' }}>Gateway</th>
                    <th style={{ padding: '10px 14px' }}>Interface</th>
                    <th style={{ padding: '10px 14px', width: 90 }}>Metric</th>
                    <th style={{ padding: '10px 14px', width: 140 }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((r, i) => {
                    const rType = getRouteType(r.destination, r.netmask);
                    const isDefault = rType === 'Default Gateway';
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isDefault ? 'var(--brand-purple-soft)' : undefined,
                        }}
                      >
                        <td
                          style={{
                            padding: '10px 14px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12.5,
                            fontWeight: isDefault ? 700 : 500,
                            color: isDefault ? 'var(--brand-purple)' : 'var(--text-primary)',
                          }}
                        >
                          {r.destination}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {r.netmask}
                        </td>
                        <td
                          style={{
                            padding: '10px 14px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12.5,
                            fontWeight: isDefault ? 700 : 400,
                            color: r.gateway === 'On-link' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                          }}
                        >
                          {r.gateway}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                          {r.interfaceIp}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                          {r.metric}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: isDefault
                                ? 'rgba(167, 139, 250, 0.2)'
                                : 'var(--bg-surface-2)',
                              color: isDefault ? 'var(--brand-purple)' : 'var(--text-secondary)',
                              border: isDefault ? '1px solid var(--brand-purple)' : '1px solid var(--border-subtle)',
                            }}
                          >
                            {rType}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: TRACEROUTE */}
      {activeTool === 'traceroute' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {traceRows.length === 0 && !running ? (
            <EmptyStateBox
              icon={<Route size={28} />}
              title="Ready for Hop Trace"
              description="Click Trace Route to run Windows tracert.exe and inspect every intermediate routing hop to your target destination."
              actionLabel="Trace 1.1.1.1"
              onAction={() => executeTool('traceroute', target)}
            />
          ) : (
            <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="netx-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                    <th style={{ padding: '10px 14px', width: 70 }}>Hop #</th>
                    <th style={{ padding: '10px 14px' }}>Hop Node / Router IP</th>
                    <th style={{ padding: '10px 14px', width: 110 }}>Probe 1</th>
                    <th style={{ padding: '10px 14px', width: 110 }}>Probe 2</th>
                    <th style={{ padding: '10px 14px', width: 110 }}>Probe 3</th>
                  </tr>
                </thead>
                <tbody>
                  {traceRows.map((h) => (
                    <tr key={h.hop} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                        #{h.hop}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                        {h.ip}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--brand-mint)' }}>
                        {h.rtt1}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--brand-mint)' }}>
                        {h.rtt2}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--brand-mint)' }}>
                        {h.rtt3}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: DNS LOOKUP */}
      {activeTool === 'dns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dnsRecords.length === 0 && !running ? (
            <EmptyStateBox
              icon={<Search size={28} />}
              title="Ready for DNS Query"
              description="Enter a domain name (e.g. cloudflare.com, google.com) and click Lookup DNS to query live A, AAAA, MX, NS, and TXT records."
              actionLabel="Lookup cloudflare.com"
              onAction={() => {
                setTarget('cloudflare.com');
                executeTool('dns', 'cloudflare.com');
              }}
            />
          ) : (
            <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="netx-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                    <th style={{ padding: '10px 14px', width: 110 }}>Record Type</th>
                    <th style={{ padding: '10px 14px', width: 220 }}>Domain Name</th>
                    <th style={{ padding: '10px 14px' }}>Resolved Value</th>
                    <th style={{ padding: '10px 14px', width: 130 }}>Query Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {dnsRecords.map((rec, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <StatusBadge variant="info" label={rec.type} />
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{rec.name}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, wordBreak: 'break-all' }}>
                        {rec.value}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Globe size={13} />
                          <span>{rec.latencyMs} ms</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: PORT CHECK */}
      {activeTool === 'port' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {portResults.length === 0 && !running ? (
            <EmptyStateBox
              icon={<Shield size={28} />}
              title="Ready for TCP Port Scan"
              description="Test standard TCP ports (80, 443, 53, 22, 21, 3389, 8080) against target host with real socket connections."
              actionLabel="Scan Ports"
              onAction={() => executeTool('port', target)}
            />
          ) : (
            <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="netx-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                    <th style={{ padding: '10px 14px', width: 100 }}>Port</th>
                    <th style={{ padding: '10px 14px', width: 180 }}>Service Protocol</th>
                    <th style={{ padding: '10px 14px' }}>Target Host</th>
                    <th style={{ padding: '10px 14px', width: 160 }}>Handshake Latency</th>
                    <th style={{ padding: '10px 14px', width: 140 }}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {portResults.map((p) => (
                    <tr key={p.port} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                        {p.port}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{p.service}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{target}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--brand-mint)' }}>
                        {p.latency}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <StatusBadge
                          variant={p.state === 'Open' ? 'success' : 'neutral'}
                          label={p.state}
                          iconStyle="check"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Raw Console Output Collapsible */}
      {rawOutput && (
        <div className="card-surface" style={{ marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setShowRawConsole((v) => !v)}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <Terminal size={15} style={{ color: 'var(--brand-purple)' }} />
              <span>Raw Windows OS Command Output</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {showRawConsole ? 'Hide Console Output' : 'View Console Output'}
            </span>
          </div>

          {showRawConsole && (
            <pre
              className="tech-details-box selectable"
              style={{
                marginTop: 12,
                background: 'var(--bg-canvas)',
                padding: 12,
                borderRadius: 6,
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
                color: 'var(--brand-mint)',
                maxHeight: 280,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {rawOutput.trim()}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
