import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Gauge,
  Play,
  RotateCcw,
  Server,
  Trash2,
  XCircle,
  Clock,
  Layers,
  TrendingUp,
  DownloadCloud,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import {
  Button,
  EmptyStateBox,
  ErrorStateBox,
  StatusBadge,
} from '../components/ui/Primitives';
import { SpeedTestRecord } from '../types/netx';

type TestStage = 'idle' | 'prep' | 'ping' | 'download' | 'transition' | 'upload' | 'finalizing' | 'complete' | 'cancelled' | 'error';

interface ThroughputPoint {
  sec: number;
  mbps: number;
}

export const SpeedTestView: React.FC = () => {
  const {
    networkInfo,
    speedTestHistory,
    addSpeedTestRecord,
    clearSpeedTestHistory,
    pushToast,
  } = useNetX();

  const [stage, setStage] = useState<TestStage>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [liveValue, setLiveValue] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Ready to benchmark');
  const [selectedServer, setSelectedServer] = useState<string>('Cloudflare Anycast Edge');

  // Test Metrics
  const [pingResult, setPingResult] = useState<number | null>(null);
  const [jitterResult, setJitterResult] = useState<number | null>(null);
  const [lossResult, setLossResult] = useState<number | null>(null);
  const [downloadResult, setDownloadResult] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<number | null>(null);
  const [durationResult, setDurationResult] = useState<number | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');

  // Live Throughput Samples Array for Real-Time Graph
  const [liveSamples, setLiveSamples] = useState<ThroughputPoint[]>([]);

  // History Table Selection for Comparison
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'download' | 'upload' | 'ping'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const isRunning = stage === 'prep' || stage === 'ping' || stage === 'download' || stage === 'transition' || stage === 'upload' || stage === 'finalizing';

  useEffect(() => {
    if (!window.netxNative) return;
    const unsubscribe = window.netxNative.onSpeedTestProgress((data: any) => {
      if (data.stage) setStage(data.stage);
      if (typeof data.progress === 'number') setProgress(data.progress);
      if (typeof data.liveValue === 'number') setLiveValue(data.liveValue);
      if (typeof data.pingMs === 'number') setPingResult(data.pingMs);
      if (typeof data.jitterMs === 'number') setJitterResult(data.jitterMs);
      if (typeof data.packetLossPct === 'number') setLossResult(data.packetLossPct);
      if (typeof data.downloadMbps === 'number') setDownloadResult(data.downloadMbps);
      if (data.status) setStatusText(data.status);
      if (data.server) setSelectedServer(data.server);
      if (Array.isArray(data.samples)) {
        setLiveSamples(data.samples);
      }
    });
    return unsubscribe;
  }, []);

  const startSpeedTest = async () => {
    if (!window.netxNative) return;
    setPingResult(null);
    setJitterResult(null);
    setLossResult(null);
    setDownloadResult(null);
    setUploadResult(null);
    setDurationResult(null);
    setErrorDetails('');
    setProgress(3);
    setLiveValue(0);
    setLiveSamples([]);
    setStage('prep');
    setStatusText('Initializing connection to benchmark server...');

    const res = await window.netxNative.runSpeedTest({ server: selectedServer });

    if (!res || !res.ok) {
      if (res?.cancelled) {
        setStage('cancelled');
        setStatusText('Speed test was cancelled by user.');
        pushToast('Speed test was cancelled.', 'info');
      } else {
        setErrorDetails(res?.error || 'Connection to benchmark server failed.');
        setStage('error');
        setStatusText('Speed test failed.');
      }
      return;
    }

    setPingResult(res.pingMs);
    setJitterResult(res.jitterMs);
    setLossResult(res.packetLossPct ?? 0);
    setDownloadResult(res.downloadMbps);
    setUploadResult(res.uploadMbps);
    setDurationResult(res.durationSec || 22);
    setProgress(100);
    setStage('complete');
    setStatusText('Speed test successfully completed.');

    addSpeedTestRecord({
      server: res.server || selectedServer || 'Cloudflare Anycast Edge',
      pingMs: res.pingMs,
      minPingMs: res.minPingMs,
      maxPingMs: res.maxPingMs,
      jitterMs: res.jitterMs || 1.0,
      packetLossPct: res.packetLossPct ?? 0,
      downloadMbps: res.downloadMbps,
      uploadMbps: res.uploadMbps,
      durationSec: res.durationSec || 22,
      interfaceName: `${networkInfo.interfaceName} (${networkInfo.ssid || 'Active'})`,
      status: 'complete',
    });

    pushToast(
      `Speed test complete: ↓ ${res.downloadMbps.toFixed(1)} Mbps · ↑ ${res.uploadMbps.toFixed(1)} Mbps · ${res.pingMs} ms`,
      'success'
    );
  };

  const handleCancel = async () => {
    if (window.netxNative?.cancelSpeedTest) {
      await window.netxNative.cancelSpeedTest();
    }
    setStage('cancelled');
    setStatusText('Speed test cancelled.');
    pushToast('Speed test cancelled.', 'info');
  };

  // Speedometer Gauge Arc Geometry Calculations
  // Gauge spans 260° (from 140° to 400°).
  const gaugeConfig = useMemo(() => {
    const cx = 130;
    const cy = 130;
    const r = 98;
    const startAngle = 140;
    const endAngle = 400;
    const totalSweep = endAngle - startAngle; // 260 deg

    // Map speed (0 to 500 Mbps default) logarithmically or linearly with soft scaling
    const maxScale = Math.max(100, Math.min(1000, Math.ceil(((liveValue || 10) * 1.3) / 50) * 50));
    const valueRatio = Math.min(1, Math.max(0, liveValue / maxScale));
    const activeAngle = startAngle + valueRatio * totalSweep;

    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
      };
    };

    const describeArc = (x: number, y: number, radius: number, start: number, end: number) => {
      const startPt = polarToCartesian(x, y, radius, end);
      const endPt = polarToCartesian(x, y, radius, start);
      const largeArcFlag = end - start <= 180 ? '0' : '1';
      return ['M', startPt.x, startPt.y, 'A', radius, radius, 0, largeArcFlag, 0, endPt.x, endPt.y].join(' ');
    };

    const trackPath = describeArc(cx, cy, r, startAngle, endAngle);
    const activePath = describeArc(cx, cy, r, startAngle, activeAngle);

    // Graduation ticks at 0%, 25%, 50%, 75%, 100%
    const ticks = [0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
      const ang = startAngle + frac * totalSweep;
      const p1 = polarToCartesian(cx, cy, r - 6, ang);
      const p2 = polarToCartesian(cx, cy, r + 4, ang);
      const labelVal = Math.round(frac * maxScale);
      return { p1, p2, labelVal, ang };
    });

    return { cx, cy, r, trackPath, activePath, ticks, maxScale };
  }, [liveValue]);

  // Sorted History Items
  const sortedHistory = useMemo(() => {
    return [...speedTestHistory].sort((a, b) => {
      let diff = 0;
      if (sortBy === 'download') diff = a.downloadMbps - b.downloadMbps;
      else if (sortBy === 'upload') diff = a.uploadMbps - b.uploadMbps;
      else if (sortBy === 'ping') diff = a.pingMs - b.pingMs;
      else diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortAsc ? diff : -diff;
    });
  }, [speedTestHistory, sortBy, sortAsc]);

  // Comparison pair
  const comparisonPair = useMemo(() => {
    if (selectedHistoryIds.length !== 2) return null;
    const testA = speedTestHistory.find((t) => t.id === selectedHistoryIds[0]);
    const testB = speedTestHistory.find((t) => t.id === selectedHistoryIds[1]);
    if (!testA || !testB) return null;
    return { testA, testB };
  }, [selectedHistoryIds, speedTestHistory]);

  const toggleSelectHistory = (id: string) => {
    setSelectedHistoryIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const exportHistoryCSV = () => {
    if (speedTestHistory.length === 0) return;
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
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NetX-SpeedTest-History-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    pushToast('Exported speed test history to CSV.', 'success');
  };

  return (
    <div className="page-container">
      {/* Primary Speed Test Stage Card */}
      <section className="surface-panel" aria-label="Speed test runner">
        <div className="surface-panel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="surface-panel-title">Internet Speed Benchmark</h2>
            <p className="surface-panel-subtitle">
              Engine: Multi-stream HTTPS Throughput · Target: {selectedServer} · Adapter:{' '}
              {networkInfo.interfaceName} ({networkInfo.ssid || networkInfo.ipv4})
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Server Selector */}
            <select
              className="select-field"
              style={{ fontSize: 12.5, padding: '5px 10px', height: 32 }}
              value={selectedServer}
              disabled={isRunning}
              onChange={(e) => setSelectedServer(e.target.value)}
              aria-label="Measurement server"
            >
              <option value="Cloudflare Anycast Edge">Cloudflare Anycast Global Edge</option>
              <option value="Fast Cloud CDN">High-Capacity CDN Edge</option>
            </select>

            <StatusBadge
              variant={
                stage === 'error'
                  ? 'danger'
                  : stage === 'complete'
                  ? 'success'
                  : stage === 'cancelled'
                  ? 'warning'
                  : isRunning
                  ? 'info'
                  : 'neutral'
              }
              iconStyle={isRunning ? 'spinner' : stage === 'complete' ? 'check' : 'dot'}
              label={
                stage === 'error'
                  ? 'Failed'
                  : stage === 'complete'
                  ? 'Completed'
                  : stage === 'cancelled'
                  ? 'Cancelled'
                  : isRunning
                  ? `Testing (${progress}%)`
                  : 'Ready'
              }
            />
          </div>
        </div>

        {/* Phase Pipeline Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-subtle)',
            flexWrap: 'wrap',
          }}
        >
          {[
            { id: 'prep', label: '1. Prepare' },
            { id: 'ping', label: '2. Latency & Loss' },
            { id: 'download', label: '3. Download' },
            { id: 'upload', label: stage === 'transition' ? '4. Upload (Initializing...)' : '4. Upload' },
            { id: 'complete', label: '5. Results' },
          ].map((step, idx) => {
            const stepOrder = ['prep', 'ping', 'download', 'upload', 'complete'];
            const currentStageKey = stage === 'finalizing' ? 'upload' : stage === 'transition' ? 'upload' : stage;
            const currentIdx = stepOrder.indexOf(currentStageKey);
            const isStepActive = stage === step.id || (stage === 'transition' && step.id === 'upload');
            const isStepDone = stage === 'complete' || currentIdx > idx || (stage === 'transition' && step.id === 'download');

            return (
              <div
                key={step.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 12,
                  fontWeight: isStepActive ? 700 : 500,
                  background: isStepActive
                    ? 'rgba(14, 165, 233, 0.15)'
                    : isStepDone
                    ? 'rgba(52, 211, 153, 0.12)'
                    : 'transparent',
                  color: isStepActive
                    ? 'var(--brand-lilac)'
                    : isStepDone
                    ? 'var(--status-success)'
                    : 'var(--text-muted)',
                  border: isStepActive
                    ? '1px solid var(--border-strong)'
                    : '1px solid transparent',
                  transition: 'all 0.25s ease',
                }}
              >
                {isStepDone ? <CheckCircle2 size={13} style={{ color: 'var(--status-success)' }} /> : null}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Error State */}
        {stage === 'error' ? (
          <ErrorStateBox
            title="Unable to complete speed benchmark."
            explanation="Your internet connection may be offline, congested, or the benchmark edge server timed out."
            technicalDetails={`Error: ${errorDetails}\nAdapter: ${networkInfo.interfaceName} (${networkInfo.ipv4})`}
            onRetry={startSpeedTest}
            retryLabel="Retry Speed Test"
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '28px 16px',
              gap: 24,
            }}
          >
            {/* Speedometer Gauge & Live Display */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                width: 270,
                height: 250,
              }}
            >
              <svg width="270" height="240" viewBox="0 0 260 250" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0ea5e9" />
                    <stop offset="50%" stopColor="#0284c7" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Background Track Arc - Uses CSS token for crisp light & dark themes */}
                <path
                  d={gaugeConfig.trackPath}
                  fill="none"
                  stroke="var(--border-default)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />

                {/* Graduation Ticks - Uses CSS token for crisp contrast in light mode */}
                {gaugeConfig.ticks.map((t, i) => (
                  <line
                    key={i}
                    x1={t.p1.x}
                    y1={t.p1.y}
                    x2={t.p2.x}
                    y2={t.p2.y}
                    stroke="var(--border-strong)"
                    strokeWidth="2"
                  />
                ))}

                {/* Active Glowing Measured Arc */}
                {stage !== 'idle' && (
                  <path
                    d={gaugeConfig.activePath}
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    filter="url(#gaugeGlow)"
                    style={{ transition: 'stroke-dasharray 0.25s ease, d 0.25s ease' }}
                  />
                )}
              </svg>

              {/* Center Typography Readout */}
              <div
                style={{
                  position: 'absolute',
                  top: 75,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {stage === 'ping'
                    ? liveValue.toFixed(0)
                    : stage === 'transition'
                    ? downloadResult?.toFixed(1) ?? liveValue.toFixed(1)
                    : stage === 'complete'
                    ? downloadResult?.toFixed(1) ?? '—'
                    : liveValue > 0
                    ? liveValue.toFixed(1)
                    : '0.0'}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color:
                      stage === 'ping'
                        ? 'var(--series-ping)'
                        : stage === 'transition'
                        ? 'var(--status-success)'
                        : 'var(--brand-lilac)',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {stage === 'ping' ? (
                    'ms (latency)'
                  ) : stage === 'transition' ? (
                    <>
                      <CheckCircle2 size={13} style={{ color: 'var(--status-success)' }} />
                      <span>Download Locked</span>
                    </>
                  ) : (
                    'Mbps'
                  )}
                </div>
              </div>

              {/* Status Subtitle below gauge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: stage === 'transition' ? 'var(--brand-lilac)' : 'var(--text-muted)',
                  textAlign: 'center',
                  maxWidth: 240,
                  lineHeight: 1.3,
                  transition: 'all 0.2s ease',
                }}
              >
                {statusText}
              </div>
            </div>

            {/* Live Progress Bar during active test */}
            {isRunning && (
              <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${progress}%`,
                      transition: 'width 0.3s ease',
                      background: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span>{statusText}</span>
                  <span className="mono">{progress}%</span>
                </div>
              </div>
            )}

            {/* Real-time Throughput Graph (During Download or Upload) */}
            {liveSamples.length > 1 && (
              <div
                style={{
                  width: '100%',
                  maxWidth: 580,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={14} style={{ color: 'var(--brand-lilac)' }} />
                    <span>Real-Time Measured Throughput ({stage.toUpperCase()})</span>
                  </div>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Peak: {Math.max(...liveSamples.map((s) => s.mbps)).toFixed(1)} Mbps
                  </span>
                </div>

                <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                  {liveSamples.slice(-30).map((pt, i) => {
                    const maxVal = Math.max(10, ...liveSamples.map((s) => s.mbps));
                    const heightPct = Math.max(8, Math.round((pt.mbps / maxVal) * 100));
                    return (
                      <div
                        key={i}
                        title={`${pt.sec}s: ${pt.mbps} Mbps`}
                        style={{
                          flex: 1,
                          height: `${heightPct}%`,
                          borderRadius: '2px 2px 0 0',
                          background:
                            stage === 'download'
                              ? 'linear-gradient(180deg, #0ea5e9 0%, rgba(14, 165, 233, 0.2) 100%)'
                              : 'linear-gradient(180deg, #38bdf8 0%, rgba(56, 189, 248, 0.2) 100%)',
                          transition: 'height 0.2s ease',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Primary Result Pillars: Download, Upload, Ping */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
                width: '100%',
                maxWidth: 820,
              }}
            >
              {/* Download Metric Card */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    stage === 'download'
                      ? 'rgba(14, 165, 233, 0.12)'
                      : stage === 'transition'
                      ? 'rgba(52, 211, 153, 0.12)'
                      : 'var(--bg-surface-subtle)',
                  border:
                    stage === 'download'
                      ? '1px solid rgba(14, 165, 233, 0.5)'
                      : stage === 'transition'
                      ? '1px solid rgba(52, 211, 153, 0.5)'
                      : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <ArrowDown size={15} style={{ color: 'var(--series-download)' }} />
                  <span>Download Speed</span>
                  {stage === 'transition' && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--status-success)', marginLeft: 4 }}>
                      ✓ LOCKED
                    </span>
                  )}
                </div>
                <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 800 }}>
                  {downloadResult !== null ? (
                    <>
                      {downloadResult.toFixed(1)}{' '}
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Mbps</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>

              {/* Upload Metric Card */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    stage === 'upload'
                      ? 'rgba(56, 189, 248, 0.12)'
                      : stage === 'transition'
                      ? 'rgba(14, 165, 233, 0.08)'
                      : 'var(--bg-surface-subtle)',
                  border:
                    stage === 'upload'
                      ? '1px solid rgba(56, 189, 248, 0.5)'
                      : stage === 'transition'
                      ? '1px dashed var(--border-strong)'
                      : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                  transition: 'all 0.25s ease',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <ArrowUp size={15} style={{ color: 'var(--series-upload)' }} />
                  <span>Upload Speed</span>
                  {stage === 'transition' && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand-lilac)', marginLeft: 4 }}>
                      • WARMING UP
                    </span>
                  )}
                </div>
                <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 800 }}>
                  {uploadResult !== null ? (
                    <>
                      {uploadResult.toFixed(1)}{' '}
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Mbps</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>

              {/* Latency & Quality Pillar */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: stage === 'ping' ? 'rgba(45, 212, 191, 0.12)' : 'var(--bg-surface-subtle)',
                  border: stage === 'ping' ? '1px solid rgba(45, 212, 191, 0.5)' : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Activity size={15} style={{ color: 'var(--series-ping)' }} />
                  <span>Latency &amp; Stability</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 800 }}>
                  {pingResult !== null ? (
                    <>
                      {pingResult}{' '}
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>ms</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
                {jitterResult !== null && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Jitter: <span className="mono">{jitterResult.toFixed(1)} ms</span> · Loss:{' '}
                    <span className="mono">{lossResult ?? 0}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Execution Buttons: Start / Cancel / Retest */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isRunning ? (
                <Button
                  variant="danger"
                  size="lg"
                  icon={<XCircle size={18} />}
                  onClick={handleCancel}
                >
                  Cancel Test
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  icon={stage === 'complete' ? <RotateCcw size={18} /> : <Play size={18} />}
                  onClick={startSpeedTest}
                >
                  {stage === 'complete' ? 'Test Again' : 'Start Speed Test'}
                </Button>
              )}
            </div>

            {/* Data Consumption Disclaimer Notice */}
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
                maxWidth: 480,
                lineHeight: 1.5,
              }}
            >
              Notice: Speed tests transfer genuine network payloads through your active adapter to
              calculate true throughput. A full benchmark transfers approximately 25–80 MB of data.
            </div>
          </div>
        )}
      </section>

      {/* History Comparison Drawer (When 2 items selected) */}
      {comparisonPair && (
        <section
          className="surface-panel"
          style={{
            border: '1px solid rgba(192, 132, 252, 0.4)',
            background: 'var(--bg-surface-tinted)',
          }}
          aria-label="Comparison drawer"
        >
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={17} style={{ color: 'var(--brand-lilac)' }} />
                <span>Benchmark Comparison</span>
              </h2>
              <p className="surface-panel-subtitle">
                Side-by-side performance contrast between selected tests.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedHistoryIds([])}>
              Close Comparison
            </Button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              padding: 16,
            }}
          >
            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>TEST A · {comparisonPair.testA.date}</div>
              <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600 }}>{comparisonPair.testA.server}</div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div>Download: <span className="mono" style={{ fontWeight: 700, color: 'var(--series-download)' }}>{comparisonPair.testA.downloadMbps.toFixed(1)} Mbps</span></div>
                <div>Upload: <span className="mono" style={{ fontWeight: 700, color: 'var(--series-upload)' }}>{comparisonPair.testA.uploadMbps.toFixed(1)} Mbps</span></div>
                <div>Ping: <span className="mono">{comparisonPair.testA.pingMs} ms</span> (Jitter: {comparisonPair.testA.jitterMs}ms)</div>
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>TEST B · {comparisonPair.testB.date}</div>
              <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600 }}>{comparisonPair.testB.server}</div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div>Download: <span className="mono" style={{ fontWeight: 700, color: 'var(--series-download)' }}>{comparisonPair.testB.downloadMbps.toFixed(1)} Mbps</span></div>
                <div>Upload: <span className="mono" style={{ fontWeight: 700, color: 'var(--series-upload)' }}>{comparisonPair.testB.uploadMbps.toFixed(1)} Mbps</span></div>
                <div>Ping: <span className="mono">{comparisonPair.testB.pingMs} ms</span> (Jitter: {comparisonPair.testB.jitterMs}ms)</div>
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-lilac)' }}>VARIANCE &amp; DELTA</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div>
                  Download Delta:{' '}
                  <span className="mono" style={{ fontWeight: 700, color: comparisonPair.testA.downloadMbps >= comparisonPair.testB.downloadMbps ? 'var(--status-success)' : 'var(--series-upload)' }}>
                    {(comparisonPair.testA.downloadMbps - comparisonPair.testB.downloadMbps > 0 ? '+' : '')}
                    {(comparisonPair.testA.downloadMbps - comparisonPair.testB.downloadMbps).toFixed(1)} Mbps
                  </span>
                </div>
                <div>
                  Upload Delta:{' '}
                  <span className="mono" style={{ fontWeight: 700 }}>
                    {(comparisonPair.testA.uploadMbps - comparisonPair.testB.uploadMbps > 0 ? '+' : '')}
                    {(comparisonPair.testA.uploadMbps - comparisonPair.testB.uploadMbps).toFixed(1)} Mbps
                  </span>
                </div>
                <div>
                  Ping Difference:{' '}
                  <span className="mono">
                    {Math.abs(comparisonPair.testA.pingMs - comparisonPair.testB.pingMs)} ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Speed Test History Table */}
      <section className="surface-panel" aria-label="Speed test history">
        <div className="surface-panel-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="surface-panel-title">Persistent Benchmark History</h2>
            <p className="surface-panel-subtitle">
              Measured tests saved locally on {networkInfo.hostname}. Select 2 items to compare.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {speedTestHistory.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<DownloadCloud size={14} />}
                  onClick={exportHistoryCSV}
                >
                  Export CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={clearSpeedTestHistory}
                >
                  Clear All
                </Button>
              </>
            )}
          </div>
        </div>

        {speedTestHistory.length === 0 ? (
          <EmptyStateBox
            icon={<Gauge size={24} />}
            title="No Speed Tests Recorded"
            description="Run your first speed test above to establish a benchmark of your connection throughput."
            actionLabel="Run First Benchmark"
            onAction={startSpeedTest}
          />
        ) : (
          <div className="table-wrap">
            <table className="netx-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Compare</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortBy === 'date') setSortAsc(!sortAsc);
                      else { setSortBy('date'); setSortAsc(false); }
                    }}
                  >
                    Date &amp; Time {sortBy === 'date' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th>Interface &amp; Endpoint</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortBy === 'ping') setSortAsc(!sortAsc);
                      else { setSortBy('ping'); setSortAsc(false); }
                    }}
                  >
                    Ping / Jitter {sortBy === 'ping' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th>Packet Loss</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortBy === 'download') setSortAsc(!sortAsc);
                      else { setSortBy('download'); setSortAsc(false); }
                    }}
                  >
                    Download {sortBy === 'download' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortBy === 'upload') setSortAsc(!sortAsc);
                      else { setSortBy('upload'); setSortAsc(false); }
                    }}
                  >
                    Upload {sortBy === 'upload' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((item) => {
                  const isChecked = selectedHistoryIds.includes(item.id);
                  return (
                    <tr key={item.id} style={{ background: isChecked ? 'rgba(14, 165, 233, 0.08)' : undefined }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectHistory(item.id)}
                          aria-label={`Select test on ${item.date} for comparison`}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.date}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.server}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.interfaceName}</div>
                      </td>
                      <td className="mono">
                        <div>{item.pingMs} ms</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>±{item.jitterMs} ms</div>
                      </td>
                      <td className="mono">
                        <span style={{ color: (item.packetLossPct ?? 0) > 0 ? 'var(--status-danger)' : 'var(--text-muted)' }}>
                          {item.packetLossPct ?? 0}%
                        </span>
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--series-download)' }}>
                        ↓ {item.downloadMbps.toFixed(1)} Mbps
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--series-upload)' }}>
                        ↑ {item.uploadMbps.toFixed(1)} Mbps
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          <span>{item.durationSec ? `${item.durationSec}s` : '—'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SpeedTestView;
