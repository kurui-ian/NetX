import React from 'react';
import {
  Activity,
  Check,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
  Radio,
  Server,
  Shield,
  Sparkles,
  Wifi,
  Zap,
} from 'lucide-react';
import { useNetX } from '../../context/NetXContext';

interface TelemetryHUDProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ isOpen, onClose }) => {
  const {
    connected,
    internetReachable,
    networkInfo,
    currentDownloadMbps,
    currentUploadMbps,
    currentPingMs,
    currentJitterMs,
    todayDownloadGb,
    todayUploadGb,
    todayUsageGb,
    connections,
    apps,
    monitoringPaused,
    setMonitoringPaused,
    bandwidthHistory,
    setActiveNav,
  } = useNetX();

  if (!isOpen) return null;

  // Build a smooth SVG path for the wave sparkline based on bandwidthHistory
  const renderSparkline = () => {
    const points = bandwidthHistory.slice(-16);
    if (points.length < 2) {
      return (
        <svg viewBox="0 0 240 50" className="hud-sparkline-svg" aria-hidden="true">
          <path
            d="M 0 35 Q 60 15, 120 30 T 240 25"
            fill="none"
            stroke="url(#sparkline-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    const maxVal = Math.max(...points.map((p) => p.downloadMbps + p.uploadMbps), 10);
    const width = 240;
    const height = 48;
    const step = width / (points.length - 1);

    const coords = points.map((p, idx) => {
      const val = p.downloadMbps + p.uploadMbps;
      const x = idx * step;
      const y = height - (val / maxVal) * (height - 12) - 6;
      return { x, y };
    });

    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const midX = (p0.x + p1.x) / 2;
      pathD += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="hud-sparkline-svg" aria-hidden="true">
        <defs>
          <linearGradient id="hud-spark-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id="hud-spark-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(168, 85, 247, 0.45)" />
            <stop offset="100%" stopColor="rgba(168, 85, 247, 0.0)" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#hud-spark-area)" />
        <path
          d={pathD}
          fill="none"
          stroke="url(#hud-spark-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  return (
    <aside className="telemetry-hud" aria-label="System Telemetry & Engine Overview">
      {/* 1. Model / Engine Hero Card (Direct inspiration from GPT-4o 3D Sphere card) */}
      <div className="hud-card hud-engine-card">
        <div className="hud-engine-header">
          <div className="hud-engine-title-wrap">
            <div className="hud-engine-tag">
              <Sparkles size={13} className="hud-engine-sparkle" />
              <span>NetX Engine v1.0</span>
            </div>
            <p className="hud-engine-sub">
              64-bit Windows hardware telemetry with zero simulation.
            </p>
          </div>
        </div>

        {/* 3D Glass Orbs & Isometric Floating Layers Illustration */}
        <div className="hud-3d-graphic" aria-hidden="true">
          <svg viewBox="0 0 200 130" className="hud-3d-svg">
            <defs>
              <linearGradient id="sphereGrad" x1="30%" y1="20%" x2="70%" y2="90%">
                <stop offset="0%" stopColor="#f3e8ff" />
                <stop offset="40%" stopColor="#c084fc" />
                <stop offset="75%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#3b0764" />
              </linearGradient>
              <linearGradient id="plateGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(192, 132, 252, 0.45)" />
                <stop offset="100%" stopColor="rgba(124, 58, 237, 0.15)" />
              </linearGradient>
              <linearGradient id="plateGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(216, 180, 254, 0.6)" />
                <stop offset="100%" stopColor="rgba(99, 102, 241, 0.2)" />
              </linearGradient>
              <filter id="glowFilter" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Glowing purple ambient aura */}
            <circle cx="100" cy="65" r="45" fill="rgba(168, 85, 247, 0.3)" filter="url(#glowFilter)" />

            {/* Bottom isometric glass plate */}
            <polygon
              points="100,88 158,104 100,120 42,104"
              fill="url(#plateGrad1)"
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth="1"
            />
            <polygon
              points="100,74 152,88 100,102 48,88"
              fill="url(#plateGrad2)"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="1"
            />
            <polygon
              points="100,60 144,72 100,84 56,72"
              fill="url(#plateGrad1)"
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth="1"
            />

            {/* Glossy 3D Purple Floating Sphere */}
            <circle
              cx="100"
              cy="48"
              r="22"
              fill="url(#sphereGrad)"
              filter="drop-shadow(0px 8px 16px rgba(124, 58, 237, 0.6))"
            />
            {/* Sphere Specular Highlight */}
            <ellipse cx="94" cy="40" rx="7" ry="4" fill="rgba(255, 255, 255, 0.85)" transform="rotate(-20 94 40)" />
            <circle cx="98" cy="38" r="2" fill="#ffffff" />
          </svg>
        </div>

        {/* Active link pill */}
        <div className="hud-engine-link-pill">
          <Wifi size={13} className="hud-pill-icon" />
          <span className="hud-pill-text">
            {networkInfo.ssid} • {networkInfo.band !== '—' ? `${networkInfo.band} • ` : ''}
            {networkInfo.linkSpeedMbps ? `${networkInfo.linkSpeedMbps} Mbps` : '1 Gbps Link'}
          </span>
        </div>
      </div>

      {/* 2. Capabilities Checklist (Matches inspiration's Capabilities card) */}
      <div className="hud-card">
        <div className="hud-card-header">
          <span className="hud-card-title">Capabilities</span>
          <span className="hud-badge-online">Active</span>
        </div>

        <div className="hud-capabilities-list">
          <div className="hud-cap-item">
            <span className="hud-cap-check">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="hud-cap-name">64-bit Hardware Bandwidth</span>
          </div>

          <div className="hud-cap-item">
            <span className="hud-cap-check">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="hud-cap-name">Local Subnet ARP Discovery</span>
          </div>

          <div className="hud-cap-item">
            <span className="hud-cap-check">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="hud-cap-name">Cloudflare HTTPS Speed Test</span>
          </div>

          <div className="hud-cap-item">
            <span className="hud-cap-check">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="hud-cap-name">TCP / UDP Socket Mapping</span>
          </div>

          <div className="hud-cap-item">
            <span className="hud-cap-check">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="hud-cap-name">Live ICMP Jitter &amp; Traceroute</span>
          </div>
        </div>
      </div>

      {/* 3. Your Activity / Real-time Telemetry Stats (Matches inspiration's Your Activity) */}
      <div className="hud-card">
        <div className="hud-card-header">
          <span className="hud-card-title">Your Activity</span>
          <span className="hud-card-time">Today</span>
        </div>

        <div className="hud-activity-stats">
          <div className="hud-stat-row">
            <span className="hud-stat-label">Download today</span>
            <span className="hud-stat-val mono">{todayDownloadGb.toFixed(2)} GB</span>
          </div>
          <div className="hud-stat-row">
            <span className="hud-stat-label">Upload today</span>
            <span className="hud-stat-val mono">{todayUploadGb.toFixed(2)} GB</span>
          </div>
          <div className="hud-stat-row">
            <span className="hud-stat-label">Active connections</span>
            <span className="hud-stat-val mono">{connections.length} sockets</span>
          </div>
          <div className="hud-stat-row">
            <span className="hud-stat-label">Gateway latency</span>
            <span className="hud-stat-val mono">{currentPingMs || '—'} ms</span>
          </div>
        </div>

        {/* Ambient Purple Sparkline Wave Chart */}
        <div className="hud-sparkline-wrap" title="Real-time session bandwidth wave">
          {renderSparkline()}
        </div>
      </div>

      {/* 4. Bottom Pro Engine / Live Telemetry Banner (Matches inspiration's upgrade/status bar) */}
      <div className="hud-card hud-status-banner">
        <div className="hud-status-banner-left">
          <div className="hud-status-star">
            <Zap size={14} />
          </div>
          <div className="hud-status-banner-text">
            <span className="hud-status-title">
              {monitoringPaused ? 'Monitoring Paused' : 'Live Telemetry Active'}
            </span>
            <span className="hud-status-sub">
              {monitoringPaused ? 'Click to resume real-time counters' : 'Polling every 1 second'}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="hud-toggle-btn"
          onClick={() => setMonitoringPaused((p) => !p)}
          title={monitoringPaused ? 'Resume live monitoring' : 'Pause live monitoring'}
          aria-label={monitoringPaused ? 'Resume live monitoring' : 'Pause live monitoring'}
        >
          {monitoringPaused ? <Play size={13} /> : <Pause size={13} />}
        </button>
      </div>
    </aside>
  );
};
