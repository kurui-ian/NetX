import React, { useState, useEffect } from 'react';
import { Globe, Play, Route, Search, Shield } from 'lucide-react';
import { Button, EmptyStateBox, StatusBadge } from '../components/ui/Primitives';

type ToolTab = 'ping' | 'traceroute' | 'dns' | 'port';

export const ToolsView: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolTab>('ping');
  const [target, setTarget] = useState<string>('1.1.1.1');
  const [running, setRunning] = useState<boolean>(false);

  const [pingRows, setPingRows] = useState<
    { seq: number; ip: string; bytes: number; ttl: number; timeMs: number; status: string }[]
  >([]);
  const [rawOutput, setRawOutput] = useState<string>('');

  const [traceRows, setTraceRows] = useState<
    { hop: number; host: string; ip: string; rtt1: string; rtt2: string; rtt3: string }[]
  >([]);

  const [dnsRecords, setDnsRecords] = useState<
    { type: string; name: string; value: string; latencyMs: number }[]
  >([]);

  const [portResults, setPortResults] = useState<
    { port: number; service: string; state: string; latency: string }[]
  >([]);

  const executeTool = async (toolToRun: ToolTab, hostInput: string) => {
    if (!window.netxNative) return;
    setRunning(true);
    setRawOutput('');

    const cleanHost = hostInput.trim() || '1.1.1.1';
    const res = await window.netxNative.runTool(toolToRun, cleanHost);

    if (toolToRun === 'ping') {
      setPingRows(res?.rows || []);
      setRawOutput(res?.raw || '');
    } else if (toolToRun === 'traceroute') {
      setTraceRows(res?.rows || []);
      setRawOutput(res?.raw || '');
    } else if (toolToRun === 'dns') {
      setDnsRecords(res?.records || []);
    } else if (toolToRun === 'port') {
      setPortResults(res?.results || []);
    }

    setRunning(false);
  };

  // Run initial ping on first open so the user sees immediate real output
  useEffect(() => {
    executeTool('ping', '1.1.1.1');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTool(activeTool, target);
  };

  return (
    <div className="page-container">
      <section className="surface-panel" aria-label="Network utilities">
        <div className="surface-panel-header" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 className="surface-panel-title">Interactive Network Utilities</h2>
            <p className="surface-panel-subtitle">
              Execute real Windows ping.exe, tracert.exe, DNS resolution, and TCP socket port checks.
            </p>
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

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            className="input-field mono"
            style={{ flex: 1, minWidth: 240 }}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Enter hostname or IP address (e.g. 1.1.1.1, google.com, 192.168.100.1)"
            aria-label="Target hostname or IP address"
          />
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
              ? 'Run Ping'
              : activeTool === 'traceroute'
              ? 'Trace Route'
              : activeTool === 'dns'
              ? 'Lookup DNS'
              : 'Scan Common Ports'}
          </Button>
        </form>

        {/* Tool Results Table */}
        {activeTool === 'ping' && (
          <>
            {pingRows.length === 0 && !running ? (
              <EmptyStateBox
                title="No Ping Results Yet"
                description="Enter an IP address or domain name and click Run Ping to execute Windows ping.exe."
                actionLabel="Ping 1.1.1.1"
                onAction={() => executeTool('ping', '1.1.1.1')}
              />
            ) : (
              <div className="table-wrap">
                <table className="netx-table">
                  <thead>
                    <tr>
                      <th>Sequence</th>
                      <th>Target Host</th>
                      <th>Reply From</th>
                      <th>Bytes</th>
                      <th>TTL</th>
                      <th>Round-Trip Time</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pingRows.map((r) => (
                      <tr key={r.seq}>
                        <td className="mono">#{r.seq}</td>
                        <td style={{ fontWeight: 600 }}>{target}</td>
                        <td className="mono">{r.ip}</td>
                        <td className="mono">{r.bytes} B</td>
                        <td className="mono">{r.ttl || '—'}</td>
                        <td
                          className="mono"
                          style={{ fontWeight: 700, color: 'var(--brand-mint)' }}
                        >
                          {r.status === 'Reply' ? `${r.timeMs} ms` : '—'}
                        </td>
                        <td>
                          <StatusBadge
                            variant={r.status === 'Reply' ? 'success' : 'danger'}
                            label={r.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rawOutput && (
              <pre className="tech-details-box selectable" style={{ marginTop: 14 }}>
                {rawOutput.trim()}
              </pre>
            )}
          </>
        )}

        {activeTool === 'traceroute' && (
          <>
            {traceRows.length === 0 && !running ? (
              <EmptyStateBox
                title="Ready to Trace Route"
                description="Click Trace Route to execute Windows tracert.exe and inspect every network hop to your target."
                actionLabel="Run Traceroute"
                onAction={() => executeTool('traceroute', target)}
              />
            ) : (
              <div className="table-wrap">
                <table className="netx-table">
                  <thead>
                    <tr>
                      <th>Hop</th>
                      <th>Hop IP / Status</th>
                      <th>Probe 1</th>
                      <th>Probe 2</th>
                      <th>Probe 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceRows.map((h) => (
                      <tr key={h.hop}>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {h.hop}
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>
                          {h.ip}
                        </td>
                        <td className="mono">{h.rtt1}</td>
                        <td className="mono">{h.rtt2}</td>
                        <td className="mono">{h.rtt3}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTool === 'dns' && (
          <>
            {dnsRecords.length === 0 && !running ? (
              <EmptyStateBox
                title="Ready for DNS Lookup"
                description="Enter a domain name (e.g. cloudflare.com, google.com) and click Lookup DNS to query live A, AAAA, MX, NS, and TXT records."
                actionLabel="Lookup cloudflare.com"
                onAction={() => {
                  setTarget('cloudflare.com');
                  executeTool('dns', 'cloudflare.com');
                }}
              />
            ) : (
              <div className="table-wrap">
                <table className="netx-table">
                  <thead>
                    <tr>
                      <th>Record Type</th>
                      <th>Domain Name</th>
                      <th>Resolved Value</th>
                      <th>Query Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dnsRecords.map((rec, idx) => (
                      <tr key={idx}>
                        <td>
                          <StatusBadge variant="info" label={rec.type} />
                        </td>
                        <td style={{ fontWeight: 600 }}>{rec.name}</td>
                        <td className="mono selectable">{rec.value}</td>
                        <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
          </>
        )}

        {activeTool === 'port' && (
          <>
            {portResults.length === 0 && !running ? (
              <EmptyStateBox
                title="Ready for TCP Port Scan"
                description="Test common TCP ports (80, 443, 53, 22, 21, 3389, 8080) on the target host."
                actionLabel="Scan Common Ports"
                onAction={() => executeTool('port', target)}
              />
            ) : (
              <div className="table-wrap">
                <table className="netx-table">
                  <thead>
                    <tr>
                      <th>TCP Port</th>
                      <th>Service</th>
                      <th>Target</th>
                      <th>Handshake Latency</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portResults.map((p) => (
                      <tr key={p.port}>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {p.port}
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.service}</td>
                        <td className="mono">{target}</td>
                        <td className="mono">{p.latency}</td>
                        <td>
                          <StatusBadge
                            variant={p.state === 'Open' ? 'success' : 'neutral'}
                            label={p.state}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
