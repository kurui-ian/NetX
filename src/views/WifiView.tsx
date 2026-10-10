import React, { useState } from 'react';
import { Radio, RefreshCw, ShieldCheck, Signal, Wifi } from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { Button, MetricTile, StatusBadge } from '../components/ui/Primitives';

export const WifiView: React.FC = () => {
  const { wifiNetworks, networkInfo, refreshWifi, pushToast } = useNetX();
  const [scanning, setScanning] = useState(false);

  const handleRescan = async () => {
    setScanning(true);
    await refreshWifi();
    setScanning(false);
    pushToast(`Wi-Fi spectrum scan complete (${wifiNetworks.length} BSSIDs detected).`, 'success');
  };

  return (
    <div className="page-container">
      {/* Primary Connected Wi-Fi Telemetry */}
      <section className="metrics-strip" aria-label="Connected Wi-Fi link metrics">
        <MetricTile
          label="Connected SSID"
          value={networkInfo.ssid}
          accentColor="var(--brand-mint)"
          icon={<Wifi size={18} />}
          subtext={`BSSID: ${networkInfo.bssid}`}
        />

        <MetricTile
          label="Signal Quality"
          value={`${networkInfo.signalQuality}%`}
          unit={`(${networkInfo.signalDbm} dBm)`}
          accentColor="var(--series-download)"
          icon={<Signal size={18} />}
          subtext={networkInfo.adapterDescription}
        />

        <MetricTile
          label="PHY Link Speed"
          value={networkInfo.linkSpeedMbps}
          unit="Mbps"
          accentColor="var(--series-upload)"
          icon={<Radio size={18} />}
          subtext={`Band: ${networkInfo.band} · Ch ${networkInfo.channel}`}
        />

        <MetricTile
          label="Wireless Security"
          value={networkInfo.security.split(' ')[0] || 'WPA2'}
          unit={networkInfo.security}
          accentColor="var(--series-ping)"
          icon={<ShieldCheck size={18} />}
          subtext={`MAC: ${networkInfo.mac}`}
        />
      </section>

      {/* Nearby Wireless Access Points Table */}
      <section className="surface-panel" aria-label="Nearby Wi-Fi networks">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Visible Wi-Fi Networks (netsh wlan)</h2>
            <p className="surface-panel-subtitle">
              Real-time wireless access points reported by {networkInfo.adapterDescription}.
            </p>
          </div>

          <Button
            variant="secondary"
            loading={scanning}
            icon={<RefreshCw size={14} />}
            onClick={handleRescan}
          >
            {scanning ? 'Scanning Airwaves...' : 'Rescan Wi-Fi'}
          </Button>
        </div>

        <div className="table-wrap">
          <table className="netx-table">
            <thead>
              <tr>
                <th>Network Name (SSID)</th>
                <th>BSSID (AP MAC)</th>
                <th>Band</th>
                <th>Channel &amp; Radio</th>
                <th>Signal</th>
                <th>Link Rate</th>
                <th>Authentication &amp; Cipher</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wifiNetworks.map((net) => (
                <tr key={net.id}>
                  <td style={{ fontWeight: 650 }}>{net.ssid}</td>
                  <td className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    {net.bssid}
                  </td>
                  <td>
                    <StatusBadge
                      variant={net.band.includes('5') ? 'info' : 'neutral'}
                      label={net.band}
                    />
                  </td>
                  <td className="mono">{net.channel}</td>
                  <td style={{ width: 190 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="progress-track" style={{ height: 8 }}>
                        <div
                          className="progress-fill"
                          style={{ width: `${net.signalQuality}%` }}
                        />
                      </div>
                      <span className="mono" style={{ fontSize: 12, minWidth: 72 }}>
                        {net.signalQuality}% ({net.signalDbm})
                      </span>
                    </div>
                  </td>
                  <td className="mono">{net.linkSpeedMbps} Mbps</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{net.security}</td>
                  <td>
                    {net.connected ? (
                      <StatusBadge variant="success" label="Connected" />
                    ) : (
                      <StatusBadge variant="neutral" label="Visible" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
