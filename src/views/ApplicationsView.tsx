import React, { useState } from 'react';
import { Activity, AppWindow, RefreshCw, Search } from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { Button, EmptyStateBox, MetricTile, StatusBadge } from '../components/ui/Primitives';

export const ApplicationsView: React.FC = () => {
  const { apps, currentDownloadMbps, currentUploadMbps, refreshConnectionsAndApps } = useNetX();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshConnectionsAndApps();
    setRefreshing(false);
  };

  const filtered = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.processName.toLowerCase().includes(search.toLowerCase()) ||
      String(app.pid).includes(search);
    if (!matchesSearch) return false;
    if (statusFilter === 'active') return app.status === 'active';
    if (statusFilter === 'idle') return app.status !== 'active';
    return true;
  });

  const activeCount = apps.filter((a) => a.status === 'active').length;
  const totalSockets = apps.reduce((acc, a) => acc + a.connectionsCount, 0);

  return (
    <div className="page-container">
      <section className="metrics-strip" aria-label="Application traffic summary">
        <MetricTile
          label="Active Processes"
          value={activeCount}
          unit={`of ${apps.length}`}
          accentColor="var(--brand-mint)"
          icon={<AppWindow size={18} />}
          subtext="Processes with ESTABLISHED sockets"
        />
        <MetricTile
          label="Download Throughput"
          value={currentDownloadMbps.toFixed(2)}
          unit="Mbps"
          accentColor="var(--series-download)"
          icon={<Activity size={18} />}
          subtext="Real-time inbound adapter rate"
        />
        <MetricTile
          label="Upload Throughput"
          value={currentUploadMbps.toFixed(2)}
          unit="Mbps"
          accentColor="var(--series-upload)"
          icon={<Activity size={18} />}
          subtext="Real-time outbound adapter rate"
        />
        <MetricTile
          label="Open OS Sockets"
          value={totalSockets}
          unit="handles"
          accentColor="var(--series-ping)"
          subtext="Live TCP & UDP endpoints"
        />
      </section>

      <section className="surface-panel" aria-label="Applications table">
        <div className="surface-panel-header" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 className="surface-panel-title">Network Activity by Windows Process</h2>
            <p className="surface-panel-subtitle">
              Live processes from Windows tasklist &amp; netstat with active network handles.
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
                style={{ paddingLeft: 30, width: 220 }}
                placeholder="Filter process or PID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Filter applications"
              />
            </div>

            <div className="segmented-control">
              {(['all', 'active', 'idle'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`segmented-btn ${statusFilter === tab ? 'active' : ''}`}
                  onClick={() => setStatusFilter(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
            icon={<AppWindow size={22} />}
            title="No Matching Applications"
            description="No active Windows processes match your current filter criteria."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearch('');
              setStatusFilter('all');
            }}
          />
        ) : (
          <div className="table-wrap">
            <table className="netx-table">
              <thead>
                <tr>
                  <th>Application / Process</th>
                  <th>PID</th>
                  <th>Memory</th>
                  <th>Status</th>
                  <th>Download Rate</th>
                  <th>Upload Rate</th>
                  <th>Sockets</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 650 }}>{app.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <span className="mono">{app.processName}</span> · {app.category}
                      </div>
                    </td>
                    <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                      {app.pid}
                    </td>
                    <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                      {app.memMb ? `${app.memMb} MB` : '—'}
                    </td>
                    <td>
                      <StatusBadge
                        variant={
                          app.status === 'active'
                            ? 'success'
                            : app.status === 'idle'
                            ? 'warning'
                            : 'neutral'
                        }
                        label={
                          app.status === 'active'
                            ? 'Active'
                            : app.status === 'idle'
                            ? 'Listening'
                            : 'Background'
                        }
                      />
                    </td>
                    <td
                      className="mono"
                      style={{
                        fontWeight: 700,
                        color:
                          app.downloadMbps > 0 ? 'var(--series-download)' : 'var(--text-muted)',
                      }}
                    >
                      ↓ {app.downloadMbps.toFixed(2)} Mbps
                    </td>
                    <td
                      className="mono"
                      style={{
                        fontWeight: 700,
                        color: app.uploadMbps > 0 ? 'var(--series-upload)' : 'var(--text-muted)',
                      }}
                    >
                      ↑ {app.uploadMbps.toFixed(2)} Mbps
                    </td>
                    <td className="mono">{app.connectionsCount}</td>
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
