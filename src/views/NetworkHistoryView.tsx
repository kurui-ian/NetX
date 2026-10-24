import React, { useState, useMemo } from 'react';
import {
  History,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Info,
  Download,
  Trash2,
  Search,
  Filter,
  ShieldAlert,
  Zap,
  Activity,
  Radio,
  FileSpreadsheet,
  FileCode,
  Gauge,
  ArrowDown,
  ArrowUp,
  RotateCcw,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { NetworkEventItem, SpeedTestRecord } from '../types/netx';
import { Button, StatusBadge, MetricTile, EmptyStateBox } from '../components/ui/Primitives';

type SeverityFilter = 'all' | 'danger' | 'warning' | 'info';
type TypeFilter = 'all' | 'disconnect' | 'reconnect' | 'latency_spike' | 'packet_loss' | 'threshold' | 'adapter_change' | 'info';
type HistoryTab = 'incidents' | 'speedtests';

export const NetworkHistoryView: React.FC = () => {
  const { networkEvents, clearNetworkEvents, speedTestHistory, clearSpeedTestHistory, pushToast, networkInfo, setActiveNav } = useNetX();

  const [activeTab, setActiveTab] = useState<HistoryTab>('incidents');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSpeedTestId, setSelectedSpeedTestId] = useState<string | null>(null);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return networkEvents.filter((evt) => {
      if (severityFilter !== 'all' && evt.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && evt.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = evt.title.toLowerCase().includes(q);
        const matchDesc = evt.description.toLowerCase().includes(q);
        const matchEvidence = (evt.evidence || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchEvidence) return false;
      }
      return true;
    });
  }, [networkEvents, severityFilter, typeFilter, searchQuery]);

  // Filtered Speed Tests
  const filteredSpeedTests = useMemo(() => {
    return speedTestHistory.filter((test) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchServer = test.server.toLowerCase().includes(q);
        const matchInterface = test.interfaceName.toLowerCase().includes(q);
        const matchDate = test.date.toLowerCase().includes(q);
        if (!matchServer && !matchInterface && !matchDate) return false;
      }
      return true;
    });
  }, [speedTestHistory, searchQuery]);

  // Event Statistics
  const eventStats = useMemo(() => {
    let danger = 0;
    let warning = 0;
    let info = 0;
    let disconnects = 0;
    let latencySpikes = 0;

    networkEvents.forEach((e) => {
      if (e.severity === 'danger') danger++;
      if (e.severity === 'warning') warning++;
      if (e.severity === 'info') info++;
      if (e.type === 'disconnect') disconnects++;
      if (e.type === 'latency_spike') latencySpikes++;
    });

    return { danger, warning, info, disconnects, latencySpikes, total: networkEvents.length };
  }, [networkEvents]);

  // Speed Test Statistics
  const speedStats = useMemo(() => {
    if (speedTestHistory.length === 0) {
      return { total: 0, avgDown: 0, avgUp: 0, maxDown: 0, avgPing: 0 };
    }
    const total = speedTestHistory.length;
    const avgDown = speedTestHistory.reduce((a, b) => a + b.downloadMbps, 0) / total;
    const avgUp = speedTestHistory.reduce((a, b) => a + b.uploadMbps, 0) / total;
    const maxDown = Math.max(...speedTestHistory.map((s) => s.downloadMbps));
    const avgPing = Math.round(speedTestHistory.reduce((a, b) => a + b.pingMs, 0) / total);
    return { total, avgDown, avgUp, maxDown, avgPing };
  }, [speedTestHistory]);

  // Handle Export Events CSV
  const handleExportEventsCSV = () => {
    if (networkEvents.length === 0) {
      pushToast('No event log entries to export', 'warning');
      return;
    }

    const headers = ['Timestamp', 'Severity', 'Event Type', 'Title', 'Description', 'Technical Evidence'];
    const rows = networkEvents.map((e) => [
      `"${e.timestamp}"`,
      `"${e.severity}"`,
      `"${e.type}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${(e.evidence || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `netx-incident-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast(`Exported ${networkEvents.length} events to CSV`, 'success');
  };

  // Handle Export Speed Tests CSV
  const handleExportSpeedCSV = () => {
    if (speedTestHistory.length === 0) {
      pushToast('No speed test records to export', 'warning');
      return;
    }
    const headers = ['Date', 'Interface', 'Server', 'Ping (ms)', 'Jitter (ms)', 'Packet Loss (%)', 'Download (Mbps)', 'Upload (Mbps)', 'Duration (s)'];
    const rows = speedTestHistory.map((t) => [
      `"${t.date}"`,
      `"${t.interfaceName}"`,
      `"${t.server}"`,
      t.pingMs,
      t.jitterMs,
      t.packetLossPct ?? 0,
      t.downloadMbps.toFixed(2),
      t.uploadMbps.toFixed(2),
      t.durationSec ?? 0,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `netx-speedtest-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast(`Exported ${speedTestHistory.length} speed test records to CSV`, 'success');
  };

  // Handle Export Events JSON
  const handleExportEventsJSON = () => {
    if (networkEvents.length === 0) {
      pushToast('No event log entries to export', 'warning');
      return;
    }

    const jsonContent = JSON.stringify(networkEvents, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `netx-incident-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast(`Exported ${networkEvents.length} events to JSON`, 'success');
  };

  const handleClearEvents = () => {
    if (networkEvents.length === 0) return;
    if (window.confirm('Clear all recorded network event history? This action cannot be undone.')) {
      clearNetworkEvents();
      setSelectedEventId(null);
      pushToast('Network event log cleared', 'info');
    }
  };

  const handleClearSpeed = () => {
    if (speedTestHistory.length === 0) return;
    if (window.confirm('Clear all recorded speed test history? This action cannot be undone.')) {
      clearSpeedTestHistory();
      setSelectedSpeedTestId(null);
      pushToast('Speed test history cleared', 'info');
    }
  };

  const getSeverityBadge = (sev: NetworkEventItem['severity']) => {
    switch (sev) {
      case 'danger':
        return <StatusBadge variant="danger" label="Critical" iconStyle="check" />;
      case 'warning':
        return <StatusBadge variant="warning" label="Warning" iconStyle="check" />;
      default:
        return <StatusBadge variant="info" label="Notice" iconStyle="check" />;
    }
  };

  const getTypeIcon = (type: NetworkEventItem['type']) => {
    switch (type) {
      case 'disconnect':
        return <XCircle size={16} style={{ color: 'var(--status-danger)' }} />;
      case 'reconnect':
        return <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />;
      case 'latency_spike':
        return <Zap size={16} style={{ color: 'var(--status-warning)' }} />;
      case 'threshold':
        return <ShieldAlert size={16} style={{ color: 'var(--status-warning)' }} />;
      case 'adapter_change':
        return <Radio size={16} style={{ color: 'var(--brand-accent)' }} />;
      default:
        return <Info size={16} style={{ color: 'var(--brand-accent)' }} />;
    }
  };

  const selectedEvent = useMemo(() => {
    return networkEvents.find((e) => e.id === selectedEventId) || null;
  }, [networkEvents, selectedEventId]);

  const selectedSpeedTest = useMemo(() => {
    return speedTestHistory.find((t) => t.id === selectedSpeedTestId) || null;
  }, [speedTestHistory, selectedSpeedTestId]);

  return (
    <div className="page-container">
      {/* 1. Header & Tab Switcher */}
      <div className="surface-panel" style={{ marginBottom: 16 }}>
        <div className="surface-panel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-accent)' }}>
              <History size={18} />
            </div>
            <div>
              <h1 className="surface-panel-title">Reports &amp; Historical Telemetry</h1>
              <p className="surface-panel-subtitle">
                Audit trail of connection events, latency excursions, and Cloudflare speed benchmarks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Segmented Mode Control */}
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${activeTab === 'incidents' ? 'active' : ''}`}
                onClick={() => { setActiveTab('incidents'); setSearchQuery(''); }}
              >
                Network Incidents ({networkEvents.length})
              </button>
              <button
                type="button"
                className={`segmented-btn ${activeTab === 'speedtests' ? 'active' : ''}`}
                onClick={() => { setActiveTab('speedtests'); setSearchQuery(''); }}
              >
                Speed Benchmarks ({speedTestHistory.length})
              </button>
            </div>

            {activeTab === 'incidents' ? (
              <>
                <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={13} />} onClick={handleExportEventsCSV}>
                  CSV
                </Button>
                <Button variant="secondary" size="sm" icon={<FileCode size={13} />} onClick={handleExportEventsJSON}>
                  JSON
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={handleClearEvents}>
                  Clear
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={13} />} onClick={handleExportSpeedCSV}>
                  CSV
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={handleClearSpeed}>
                  Clear
                </Button>
                <Button variant="primary" size="sm" icon={<Gauge size={13} />} onClick={() => setActiveNav('speed-test')}>
                  Run Test
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Strip */}
      {activeTab === 'incidents' ? (
        <section className="metrics-strip" aria-label="Incident metrics">
          <MetricTile
            label="Total Incidents"
            value={eventStats.total}
            unit="events"
            icon={<History size={16} />}
            subtext="Session audit log"
          />
          <MetricTile
            label="Critical Failures"
            value={eventStats.danger}
            unit="drops"
            icon={<XCircle size={16} />}
            accentColor="var(--status-danger)"
            subtext="Connection losses"
          />
          <MetricTile
            label="Warning Alerts"
            value={eventStats.warning}
            unit="events"
            icon={<AlertTriangle size={16} />}
            accentColor="var(--status-warning)"
            subtext="Latency excursions"
          />
          <MetricTile
            label="Disconnects"
            value={eventStats.disconnects}
            unit="events"
            icon={<Radio size={16} />}
            subtext="Interface drops"
          />
        </section>
      ) : (
        <section className="metrics-strip" aria-label="Speed test metrics">
          <MetricTile
            label="Tests Executed"
            value={speedStats.total}
            unit="benchmarks"
            icon={<Gauge size={16} />}
            subtext="Stored on this PC"
          />
          <MetricTile
            label="Avg Download"
            value={speedStats.avgDown.toFixed(1)}
            unit="Mbps"
            accentColor="var(--series-download)"
            icon={<ArrowDown size={16} />}
            subtext={`Peak: ${speedStats.maxDown.toFixed(1)} Mbps`}
          />
          <MetricTile
            label="Avg Upload"
            value={speedStats.avgUp.toFixed(1)}
            unit="Mbps"
            accentColor="var(--series-upload)"
            icon={<ArrowUp size={16} />}
            subtext="Throughput average"
          />
          <MetricTile
            label="Avg Latency"
            value={speedStats.avgPing > 0 ? speedStats.avgPing : '—'}
            unit={speedStats.avgPing > 0 ? 'ms' : undefined}
            accentColor="var(--series-ping)"
            icon={<Activity size={16} />}
            subtext="Cloudflare edge idle"
          />
        </section>
      )}

      {/* 3. Search Bar & Filters */}
      <div className="surface-panel" style={{ padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 280 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'incidents' ? 'Filter by keyword or evidence...' : 'Filter by server or interface...'}
                className="input-field"
                style={{ paddingLeft: 30 }}
              />
            </div>

            {activeTab === 'incidents' && (
              <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginRight: 4 }}>Severity:</span>
                  {(['all', 'danger', 'warning', 'info'] as SeverityFilter[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverityFilter(s)}
                      className={`btn-ghost ${severityFilter === s ? 'active' : ''}`}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11.5,
                        textTransform: 'capitalize',
                        background: severityFilter === s ? 'var(--brand-primary)' : 'transparent',
                        color: severityFilter === s ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Type:</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    className="select-field"
                    style={{ fontSize: 11.5, padding: '3px 8px', height: 28 }}
                  >
                    <option value="all">All Types</option>
                    <option value="disconnect">Disconnects</option>
                    <option value="reconnect">Reconnects</option>
                    <option value="latency_spike">Latency Spikes</option>
                    <option value="threshold">Threshold Alerts</option>
                    <option value="adapter_change">Adapter Changes</option>
                    <option value="info">System Info</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing <strong>{activeTab === 'incidents' ? filteredEvents.length : filteredSpeedTests.length}</strong> records
          </div>
        </div>
      </div>

      {/* 4. Table & Inspection Drawer */}
      {activeTab === 'incidents' ? (
        <div style={{ display: 'grid', gridTemplateColumns: selectedEvent ? '1fr 340px' : '1fr', gap: 16 }}>
          <div className="surface-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredEvents.length === 0 ? (
              <EmptyStateBox
                icon={<History size={26} />}
                title="No Network Incidents Recorded"
                description={
                  networkEvents.length === 0
                    ? 'NetX has not detected any network drops or latency threshold excursions during this session.'
                    : 'No logged incidents match your active filters or search query.'
                }
                actionLabel={networkEvents.length > 0 ? 'Reset Filters' : undefined}
                onAction={
                  networkEvents.length > 0
                    ? () => {
                        setSeverityFilter('all');
                        setTypeFilter('all');
                        setSearchQuery('');
                      }
                    : undefined
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="netx-table">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Time</th>
                      <th style={{ width: 110 }}>Severity</th>
                      <th style={{ width: 40 }}></th>
                      <th>Incident Title</th>
                      <th>Description</th>
                      <th style={{ width: 220 }}>Technical Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((evt) => {
                      const isSelected = selectedEventId === evt.id;
                      return (
                        <tr
                          key={evt.id}
                          onClick={() => setSelectedEventId((prev) => (prev === evt.id ? null : evt.id))}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'var(--bg-surface-elevated)' : undefined,
                          }}
                        >
                          <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {evt.timestamp}
                          </td>
                          <td>{getSeverityBadge(evt.severity)}</td>
                          <td style={{ textAlign: 'center' }}>{getTypeIcon(evt.type)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evt.title}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{evt.description}</td>
                          <td>
                            {evt.evidence ? (
                              <span
                                className="mono"
                                style={{
                                  display: 'inline-block',
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: 11,
                                  color: 'var(--text-muted)',
                                  background: 'var(--bg-surface-subtle)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  border: '1px solid var(--border-subtle)',
                                }}
                                title={evt.evidence}
                              >
                                {evt.evidence}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Event Details Drawer */}
          {selectedEvent && (
            <div className="surface-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incident Audit</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 0 0' }}>{selectedEvent.title}</h3>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setSelectedEventId(null)}
                  style={{ border: 'none', padding: 4 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {getSeverityBadge(selectedEvent.severity)}
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {selectedEvent.timestamp}
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Description</div>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{selectedEvent.description}</p>
              </div>

              {selectedEvent.evidence && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Technical Evidence</div>
                  <pre
                    className="mono"
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      padding: 8,
                      borderRadius: 6,
                      fontSize: 11,
                      color: 'var(--brand-accent)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                    }}
                  >
                    {selectedEvent.evidence}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Speed Benchmarks Table */
        <div style={{ display: 'grid', gridTemplateColumns: selectedSpeedTest ? '1fr 340px' : '1fr', gap: 16 }}>
          <div className="surface-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredSpeedTests.length === 0 ? (
              <EmptyStateBox
                icon={<Gauge size={26} />}
                title="No Speed Benchmark Sessions"
                description={
                  speedTestHistory.length === 0
                    ? 'No internet speed tests have been executed on this machine yet.'
                    : 'No speed test records match your search filter.'
                }
                actionLabel="Run Speed Benchmark"
                onAction={() => setActiveNav('speed-test')}
              />
            ) : (
              <div className="table-wrap">
                <table className="netx-table">
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Date &amp; Time</th>
                      <th>Endpoint Server</th>
                      <th>Interface</th>
                      <th style={{ textAlign: 'right' }}>Download</th>
                      <th style={{ textAlign: 'right' }}>Upload</th>
                      <th style={{ textAlign: 'right' }}>Ping</th>
                      <th style={{ textAlign: 'right' }}>Jitter</th>
                      <th style={{ textAlign: 'right' }}>Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSpeedTests.map((test) => {
                      const isSelected = selectedSpeedTestId === test.id;
                      return (
                        <tr
                          key={test.id}
                          onClick={() => setSelectedSpeedTestId((prev) => (prev === test.id ? null : test.id))}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'var(--bg-surface-elevated)' : undefined,
                          }}
                        >
                          <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {test.date}
                          </td>
                          <td style={{ fontWeight: 600 }}>{test.server || 'Cloudflare Edge'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{test.interfaceName}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--series-download)' }}>
                            ↓ {test.downloadMbps.toFixed(1)} Mbps
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--series-upload)' }}>
                            ↑ {test.uploadMbps.toFixed(1)} Mbps
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>{test.pingMs} ms</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{test.jitterMs} ms</td>
                          <td className="mono" style={{ textAlign: 'right', color: (test.packetLossPct ?? 0) > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                            {test.packetLossPct ?? 0}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Speed Test Details Drawer */}
          {selectedSpeedTest && (
            <div className="surface-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Benchmark Session</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 0 0' }}>{selectedSpeedTest.server}</h3>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setSelectedSpeedTestId(null)}
                  style={{ border: 'none', padding: 4 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DOWNLOAD</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--series-download)' }}>
                    {selectedSpeedTest.downloadMbps.toFixed(1)} Mbps
                  </div>
                </div>

                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>UPLOAD</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--series-upload)' }}>
                    {selectedSpeedTest.uploadMbps.toFixed(1)} Mbps
                  </div>
                </div>
              </div>

              <div className="kv-list" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <div className="kv-row">
                  <span className="kv-label">Date &amp; Time</span>
                  <span className="kv-value mono">{selectedSpeedTest.date}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Interface</span>
                  <span className="kv-value">{selectedSpeedTest.interfaceName}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Idle Latency</span>
                  <span className="kv-value mono">{selectedSpeedTest.pingMs} ms</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Jitter</span>
                  <span className="kv-value mono">{selectedSpeedTest.jitterMs} ms</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Packet Loss</span>
                  <span className="kv-value mono">{selectedSpeedTest.packetLossPct ?? 0}%</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Duration</span>
                  <span className="kv-value mono">{selectedSpeedTest.durationSec || 22}s</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <Button variant="primary" style={{ width: '100%' }} icon={<Gauge size={14} />} onClick={() => setActiveNav('speed-test')}>
                  Run New Benchmark
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkHistoryView;
