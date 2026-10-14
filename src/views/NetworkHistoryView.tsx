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
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { NetworkEventItem } from '../types/netx';
import { Button, StatusBadge, MetricTile, EmptyStateBox } from '../components/ui/Primitives';

type SeverityFilter = 'all' | 'danger' | 'warning' | 'info';
type TypeFilter = 'all' | 'disconnect' | 'reconnect' | 'latency_spike' | 'packet_loss' | 'threshold' | 'adapter_change' | 'info';

export const NetworkHistoryView: React.FC = () => {
  const { networkEvents, clearNetworkEvents, pushToast, networkInfo } = useNetX();

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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

  // Statistics
  const stats = useMemo(() => {
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

  // Handle Export CSV
  const handleExportCSV = () => {
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

  // Handle Export JSON
  const handleExportJSON = () => {
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

  const handleClear = () => {
    if (networkEvents.length === 0) return;
    if (window.confirm('Clear all recorded network event history? This action cannot be undone.')) {
      clearNetworkEvents();
      setSelectedEventId(null);
      pushToast('Network event log cleared', 'info');
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
        return <CheckCircle2 size={16} style={{ color: 'var(--brand-mint)' }} />;
      case 'latency_spike':
        return <Zap size={16} style={{ color: 'var(--status-warning)' }} />;
      case 'threshold':
        return <ShieldAlert size={16} style={{ color: 'var(--status-warning)' }} />;
      case 'adapter_change':
        return <Radio size={16} style={{ color: 'var(--brand-purple)' }} />;
      default:
        return <Info size={16} style={{ color: 'var(--brand-purple)' }} />;
    }
  };

  const selectedEvent = useMemo(() => {
    return networkEvents.find((e) => e.id === selectedEventId) || null;
  }, [networkEvents, selectedEventId]);

  return (
    <div className="view-container">
      {/* 1. Header Banner */}
      <div className="view-header-strip">
        <div className="header-left">
          <div className="header-icon-wrap" style={{ background: 'rgba(167, 139, 250, 0.12)' }}>
            <History size={22} style={{ color: 'var(--brand-purple)' }} />
          </div>
          <div>
            <h1 className="view-title">Network Incident &amp; Event History</h1>
            <p className="view-subtitle">
              Continuous audit trail of connectivity drops, latency spikes, threshold alarms, and adapter state transitions.
            </p>
          </div>
        </div>

        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--brand-mint)',
                boxShadow: '0 0 6px var(--brand-mint)',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Detector Active on</span>
            <strong style={{ color: 'var(--text-primary)' }}>{networkInfo.interfaceName || 'Primary Adapter'}</strong>
          </div>

          <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={14} />} onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" icon={<FileCode size={14} />} onClick={handleExportJSON}>
            Export JSON
          </Button>
          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={handleClear}>
            Clear Log
          </Button>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20 }}>
        <MetricTile
          label="Total Events Logged"
          value={stats.total}
          unit="events"
          icon={<History size={16} />}
          subtext="Retained locally (up to 100)"
        />
        <MetricTile
          label="Critical Failures"
          value={stats.danger}
          unit="events"
          icon={<XCircle size={16} />}
          accentColor="var(--status-danger)"
          subtext="Disconnects & drops"
        />
        <MetricTile
          label="Warning Alerts"
          value={stats.warning}
          unit="events"
          icon={<AlertTriangle size={16} />}
          accentColor="var(--status-warning)"
          subtext="Latency & usage spikes"
        />
        <MetricTile
          label="Disconnect Incidents"
          value={stats.disconnects}
          unit="drops"
          icon={<Radio size={16} />}
          subtext="Interface / gateway outages"
        />
        <MetricTile
          label="Latency Spikes"
          value={stats.latencySpikes}
          unit="spikes"
          icon={<Zap size={16} />}
          subtext="Ping excursions > 180ms"
        />
      </div>

      {/* 3. Filters and Search */}
      <div
        className="card-surface"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: 260 }}>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by keyword or evidence..."
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: 6,
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 12.5,
              }}
            />
          </div>

          {/* Severity Pills */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginRight: 4 }}>Severity:</span>
            {(['all', 'danger', 'warning', 'info'] as SeverityFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverityFilter(s)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  fontSize: 11.5,
                  cursor: 'pointer',
                  border: '1px solid',
                  background: severityFilter === s ? 'var(--brand-purple)' : 'transparent',
                  borderColor: severityFilter === s ? 'var(--brand-purple)' : 'var(--border-subtle)',
                  color: severityFilter === s ? '#ffffff' : 'var(--text-secondary)',
                  textTransform: 'capitalize',
                  fontWeight: severityFilter === s ? 600 : 400,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Type Filter Select */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
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
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Showing <strong>{filteredEvents.length}</strong> of <strong>{networkEvents.length}</strong> entries
        </div>
      </div>

      {/* 4. Events Table & Inspection Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedEvent ? '1fr 360px' : '1fr', gap: 16 }}>
        {/* Table View */}
        <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: '40px 20px' }}>
              <EmptyStateBox
                icon={<History size={28} />}
                title="No Network Incidents Recorded"
                description={
                  networkEvents.length === 0
                    ? 'NetX has not detected any network drops or threshold excursions during this session.'
                    : 'No logged incidents match your active filters or search keyword.'
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
            </div>
          ) : (
            <div className="table-responsive">
              <table className="netx-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                    <th style={{ padding: '10px 14px', width: 90 }}>Time</th>
                    <th style={{ padding: '10px 14px', width: 100 }}>Severity</th>
                    <th style={{ padding: '10px 14px', width: 40 }}></th>
                    <th style={{ padding: '10px 14px' }}>Incident / Event</th>
                    <th style={{ padding: '10px 14px' }}>Description</th>
                    <th style={{ padding: '10px 14px', width: 220 }}>Technical Evidence</th>
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
                          background: isSelected ? 'var(--brand-purple-soft)' : undefined,
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background 0.15s ease',
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                          {evt.timestamp}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{getSeverityBadge(evt.severity)}</td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>{getTypeIcon(evt.type)}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {evt.title}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {evt.description}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {evt.evidence ? (
                            <span
                              style={{
                                display: 'inline-block',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-tertiary)',
                                background: 'var(--bg-surface-2)',
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: '1px solid var(--border-subtle)',
                              }}
                              title={evt.evidence}
                            >
                              {evt.evidence}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
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

        {/* Selected Event Details Inspector */}
        {selectedEvent && (
          <div
            className="card-surface"
            style={{
              padding: 18,
              border: '1px solid var(--brand-purple)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>
                  Event Details
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {getSeverityBadge(selectedEvent.severity)}
              <span
                style={{
                  fontSize: 11.5,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'var(--bg-surface-2)',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                }}
              >
                {selectedEvent.type.replace('_', ' ')}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                {selectedEvent.timestamp}
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Summary Description:</div>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                {selectedEvent.description}
              </p>
            </div>

            {selectedEvent.evidence && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 6 }}>Telemetry Evidence / Probe Data:</div>
                <pre
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    padding: 10,
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--brand-mint)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                >
                  {selectedEvent.evidence}
                </pre>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 'auto' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Event ID: {selectedEvent.id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
