import React, { useState } from 'react';
import {
  Copy,
  Gamepad2,
  Laptop,
  Monitor,
  RefreshCw,
  Router,
  Smartphone,
  Tv,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { Button, StatusBadge } from '../components/ui/Primitives';
import { LanDeviceItem } from '../types/netx';

export const NetworkView: React.FC = () => {
  const { lanDevices, networkInfo, refreshLan, pushToast } = useNetX();
  const [scanningLan, setScanningLan] = useState(false);

  const handleLanScan = async () => {
    setScanningLan(true);
    await refreshLan(true);
    setScanningLan(false);
    pushToast(`LAN ARP & subnet scan complete on ${networkInfo.ipv4}.`, 'success');
  };

  const renderDeviceIcon = (type: LanDeviceItem['type']) => {
    if (type === 'phone') return <Smartphone size={17} />;
    if (type === 'laptop') return <Laptop size={17} />;
    if (type === 'tv') return <Tv size={17} />;
    if (type === 'console') return <Gamepad2 size={17} />;
    if (type === 'router') return <Router size={17} />;
    return <Monitor size={17} />;
  };

  const copyText = (label: string, val: string) => {
    if (!val || val === '—' || val === 'Detecting...') return;
    navigator.clipboard?.writeText(val);
    pushToast(`Copied ${label}: ${val}`, 'info');
  };

  return (
    <div className="page-container">
      {/* Top Split: Real Adapter Hardware & IPv4/IPv6 Configuration */}
      <div className="split-grid-2">
        <section className="surface-panel" aria-label="Primary network adapter configuration">
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title">Primary Network Interface</h2>
              <p className="surface-panel-subtitle">
                {networkInfo.adapterDescription} · {networkInfo.hostname}
              </p>
            </div>
            <StatusBadge
              variant="success"
              label={`Up · ${networkInfo.linkSpeedMbps > 0 ? networkInfo.linkSpeedMbps : 1000} Mbps`}
            />
          </div>

          <div className="kv-list">
            <div className="kv-row">
              <span className="kv-label">Interface Name</span>
              <span className="kv-value">{networkInfo.interfaceName}</span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Physical Address (MAC)</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.mac}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ border: 'none', padding: 3, cursor: 'pointer', display: 'inline-flex' }}
                  onClick={() => copyText('MAC Address', networkInfo.mac)}
                  title="Copy MAC address"
                >
                  <Copy size={12} />
                </button>
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">DHCP Server</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.dhcpServer}
                {networkInfo.dhcpServer !== '—' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ border: 'none', padding: 3, cursor: 'pointer', display: 'inline-flex' }}
                    onClick={() => copyText('DHCP Server', networkInfo.dhcpServer)}
                    title="Copy DHCP server"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">IPv4 Address / Subnet</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.ipv4} / {networkInfo.subnet}
                {networkInfo.ipv4 !== '—' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ border: 'none', padding: 3, cursor: 'pointer', display: 'inline-flex' }}
                    onClick={() => copyText('IPv4 Address', networkInfo.ipv4)}
                    title="Copy IPv4 address"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Link-Local IPv6</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.ipv6}
                {networkInfo.ipv6 !== '—' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ border: 'none', padding: 3, cursor: 'pointer', display: 'inline-flex' }}
                    onClick={() => copyText('IPv6 Address', networkInfo.ipv6)}
                    title="Copy IPv6 address"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </span>
            </div>
          </div>
        </section>

        <section className="surface-panel" aria-label="Routing and DNS configuration">
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title">Gateway, DNS &amp; Public Network</h2>
              <p className="surface-panel-subtitle">Live upstream routing and WAN address</p>
            </div>
            <StatusBadge variant="info" label={networkInfo.ispEdge || 'Active WAN'} />
          </div>

          <div className="kv-list">
            <div className="kv-row">
              <span className="kv-label">Default Gateway</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.gateway}
                {networkInfo.gateway !== '—' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ border: 'none', padding: 3, cursor: 'pointer', display: 'inline-flex' }}
                    onClick={() => copyText('Default Gateway', networkInfo.gateway)}
                    title="Copy Gateway IP"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">DNS Servers</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.dnsServers}
                {networkInfo.dnsServers !== '—' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ border: 'none', padding: 3, cursor: 'pointer', display: 'inline-flex' }}
                    onClick={() => copyText('DNS Servers', networkInfo.dnsServers)}
                    title="Copy DNS Servers"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Public IPv4 Address</span>
              <span
                className="kv-value mono"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {networkInfo.publicIp}
                {networkInfo.publicIp !== '—' && networkInfo.publicIp !== 'Detecting...' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ border: 'none', padding: 3, cursor: 'pointer', display: 'inline-flex' }}
                    onClick={() => copyText('Public IP', networkInfo.publicIp)}
                    title="Copy Public IP"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Connected SSID / BSSID</span>
              <span className="kv-value mono">
                {networkInfo.ssid} ({networkInfo.bssid})
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Wireless Band &amp; Channel</span>
              <span className="kv-value">
                {networkInfo.band} · Channel {networkInfo.channel}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Connected LAN Devices Table (Real ARP & Subnet Sweep) */}
      <section className="surface-panel" aria-label="Connected LAN devices">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Discovered LAN Devices (ARP Table)</h2>
            <p className="surface-panel-subtitle">
              Active unicast hosts on your local subnet ({lanDevices.length} nodes discovered)
            </p>
          </div>

          <Button
            variant="primary"
            loading={scanningLan}
            icon={<RefreshCw size={14} />}
            onClick={handleLanScan}
          >
            {scanningLan ? 'Scanning Subnet...' : 'Scan LAN'}
          </Button>
        </div>

        <div className="table-wrap">
          <table className="netx-table">
            <thead>
              <tr>
                <th>Device / Node</th>
                <th>IPv4 Address</th>
                <th>Physical MAC Address</th>
                <th>Hardware Vendor</th>
                <th>Discovery Type</th>
                <th>Ping RTT</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lanDevices.map((dev) => (
                <tr key={dev.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="entity-icon-circle" aria-hidden="true">
                        {renderDeviceIcon(dev.type)}
                      </div>
                      <div style={{ fontWeight: 650 }}>
                        {dev.name}
                        {dev.isCurrentDevice && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              color: 'var(--brand-accent)',
                              fontWeight: 700,
                            }}
                          >
                            • This PC
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {dev.ip}
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ border: 'none', padding: 2, cursor: 'pointer', display: 'inline-flex' }}
                        onClick={() => copyText('Device IP', dev.ip)}
                        title="Copy IP"
                      >
                        <Copy size={11} />
                      </button>
                    </span>
                  </td>
                  <td className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {dev.mac}
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ border: 'none', padding: 2, cursor: 'pointer', display: 'inline-flex' }}
                        onClick={() => copyText('Device MAC', dev.mac)}
                        title="Copy MAC"
                      >
                        <Copy size={11} />
                      </button>
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{dev.vendor}</td>
                  <td>
                    <StatusBadge variant="neutral" label={dev.connectionBand} />
                  </td>
                  <td className="mono">{dev.pingMs} ms</td>
                  <td>
                    <StatusBadge
                      variant={dev.status === 'online' ? 'success' : 'warning'}
                      label={dev.status === 'online' ? 'Online' : 'Idle'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* All Installed Hardware Network Adapters on This PC */}
      {networkInfo.adapters.length > 0 && (
        <section className="surface-panel" aria-label="All hardware network interfaces">
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title">All Hardware Network Adapters</h2>
              <p className="surface-panel-subtitle">
                Network interfaces reported by Windows ipconfig /all on {networkInfo.hostname}.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="netx-table">
              <thead>
                <tr>
                  <th>Adapter Name</th>
                  <th>Hardware Description</th>
                  <th>MAC Address</th>
                  <th>IPv4 Address</th>
                  <th>Default Gateway</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {networkInfo.adapters.map((ad, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 650 }}>{ad.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{ad.description}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {ad.mac}
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ border: 'none', padding: 2, cursor: 'pointer', display: 'inline-flex' }}
                          onClick={() => copyText('Adapter MAC', ad.mac)}
                          title="Copy MAC"
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>
                    <td className="mono">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {ad.ipv4}
                        {ad.ipv4 !== '—' && (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ border: 'none', padding: 2, cursor: 'pointer', display: 'inline-flex' }}
                            onClick={() => copyText('Adapter IPv4', ad.ipv4)}
                            title="Copy IPv4"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </span>
                    </td>
                    <td className="mono">{ad.gateway}</td>
                    <td>
                      <StatusBadge
                        variant={ad.status === 'Up' ? 'success' : 'neutral'}
                        label={ad.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default NetworkView;
