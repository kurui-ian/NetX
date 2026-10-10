import React, { useState } from 'react';
import { Cable, Copy, RefreshCw, Search } from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { Button, EmptyStateBox, StatusBadge } from '../components/ui/Primitives';

export const ConnectionsView: React.FC = () => {
  const { connections, refreshConnectionsAndApps, pushToast } = useNetX();
  const [query, setQuery] = useState('');
  const [protoFilter, setProtoFilter] = useState<'ALL' | 'TCP' | 'UDP'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshConnectionsAndApps();
    setRefreshing(false);
  };

  const filtered = connections.filter((c) => {
    const matchesProto = protoFilter === 'ALL' || c.protocol === protoFilter;
    const matchesQuery =
      c.appName.toLowerCase().includes(query.toLowerCase()) ||
      c.processName.toLowerCase().includes(query.toLowerCase()) ||
      c.remoteHost.toLowerCase().includes(query.toLowerCase()) ||
      c.remoteAddress.toLowerCase().includes(query.toLowerCase()) ||
      c.localAddress.toLowerCase().includes(query.toLowerCase());
    return matchesProto && matchesQuery;
  });

  const copyEndpoint = (endpoint: string) => {
    navigator.clipboard?.writeText(endpoint);
    pushToast(`Copied endpoint: ${endpoint}`, 'info');
  };

  return (
    <div className="page-container">
      <section className="surface-panel" aria-label="Active network connections">
        <div className="surface-panel-header" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 className="surface-panel-title">Active OS Socket Connections</h2>
            <p className="surface-panel-subtitle">
              Live TCP and UDP sockets reported by Windows netstat ({connections.length} active
              external connections).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="search"
                className="input-field"
                style={{ paddingLeft: 30, width: 230 }}
                placeholder="Search host, IP, or process..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search connections"
              />
            </div>

            <div className="segmented-control">
              {(['ALL', 'TCP', 'UDP'] as const).map((proto) => (
                <button
                  key={proto}
                  type="button"
                  className={`segmented-btn ${protoFilter === proto ? 'active' : ''}`}
                  onClick={() => setProtoFilter(proto)}
                >
                  {proto}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              loading={refreshing}
              icon={<RefreshCw size={13} />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyStateBox
            icon={<Cable size={22} />}
            title="No Matching Connections"
            description="No active TCP or UDP endpoints match your current search filter."
            actionLabel="Show All Connections"
            onAction={() => {
              setQuery('');
              setProtoFilter('ALL');
            }}
          />
        ) : (
          <div className="table-wrap">
            <table className="netx-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>PID</th>
                  <th>Protocol</th>
                  <th>Local Socket</th>
                  <th>Remote Endpoint &amp; Host</th>
                  <th>Socket State</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((conn) => (
                  <tr key={conn.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{conn.appName}</div>
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {conn.processName}
                      </div>
                    </td>
                    <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                      {conn.pid}
                    </td>
                    <td>
                      <StatusBadge
                        variant={conn.protocol === 'TCP' ? 'info' : 'neutral'}
                        label={conn.protocol}
                      />
                    </td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {conn.localAddress}
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                        }}
                      >
                        <span className="selectable">{conn.remoteHost}</span>
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
                          onClick={() => copyEndpoint(conn.remoteAddress)}
                          title="Copy remote IP:Port"
                          aria-label={`Copy ${conn.remoteAddress}`}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {conn.remoteAddress}
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        variant={
                          conn.state === 'ESTABLISHED'
                            ? 'success'
                            : conn.state.includes('WAIT')
                            ? 'warning'
                            : 'neutral'
                        }
                        label={conn.state}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
