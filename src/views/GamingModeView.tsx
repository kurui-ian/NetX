import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Gamepad2,
  Activity,
  Zap,
  ShieldAlert,
  Play,
  Square,
  RotateCcw,
  DownloadCloud,
  CheckCircle2,
  Info,
  Clock,
  Crosshair,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { Button, StatusBadge, MetricTile } from '../components/ui/Primitives';

interface LatencySample {
  time: string;
  ms: number;
  lost: boolean;
}

interface GamingSessionSummary {
  id: string;
  target: string;
  startTime: string;
  durationSec: number;
  packetsSent: number;
  packetsLost: number;
  lossPct: number;
  minPing: number;
  avgPing: number;
  maxPing: number;
  p99Ping: number;
  jitter: number;
  grade: string;
  score: number;
}

export const GamingModeView: React.FC = () => {
  const { networkInfo, pushToast } = useNetX();

  const [target, setTarget] = useState<string>('1.1.1.1');
  const [customHost, setCustomHost] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const [activeMonitoring, setActiveMonitoring] = useState<boolean>(true);
  const [history, setHistory] = useState<LatencySample[]>([]);

  // Gaming Session Recorder
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const sessionStartTimeRef = useRef<number>(0);
  const sessionSamplesRef = useRef<LatencySample[]>([]);
  const [sessionSummary, setSessionSummary] = useState<GamingSessionSummary | null>(null);

  const activeHost = isCustom && customHost.trim() ? customHost.trim() : target;

  // Real-time ping polling loop (1-second interval)
  useEffect(() => {
    if (!activeMonitoring || !window.netxNative) return;

    let mounted = true;
    const ticker = setInterval(async () => {
      try {
        const start = Date.now();
        // Use netxNative tool runner for 1 packet ping
        const res = await window.netxNative?.runTool('ping', activeHost);
        const elapsed = Date.now() - start;

        if (!mounted) return;

        let rtt = 0;
        let isLost = true;

        if (res && res.rows && res.rows.length > 0) {
          const firstReply = res.rows.find((r: any) => r.status === 'Reply');
          if (firstReply) {
            rtt = firstReply.timeMs || 1;
            isLost = false;
          }
        }

        const sample: LatencySample = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          ms: isLost ? 0 : rtt,
          lost: isLost,
        };

        setHistory((prev) => [...prev.slice(-59), sample]);

        if (isRecording) {
          sessionSamplesRef.current.push(sample);
        }
      } catch {
        // ignore
      }
    }, 1200);

    return () => {
      mounted = false;
      clearInterval(ticker);
    };
  }, [activeMonitoring, activeHost, isRecording]);

  // Real-time statistics calculations
  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        currentPing: 0,
        avgPing: 0,
        minPing: 0,
        maxPing: 0,
        p99Ping: 0,
        jitter: 0,
        lossPct: 0,
        spikesCount: 0,
        score: 100,
        grade: 'A+',
      };
    }

    const validPings = history.filter((s) => !s.lost).map((s) => s.ms);
    const lostCount = history.filter((s) => s.lost).length;
    const lossPct = Math.round((lostCount / history.length) * 100);

    const currentPing = history[history.length - 1].lost ? 0 : history[history.length - 1].ms;
    const avgPing = validPings.length > 0 ? Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length) : 0;
    const minPing = validPings.length > 0 ? Math.min(...validPings) : 0;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 0;

    const sorted = [...validPings].sort((a, b) => a - b);
    const p99Idx = Math.max(0, Math.floor(sorted.length * 0.99));
    const p99Ping = sorted.length > 0 ? sorted[p99Idx] : 0;

    // Jitter calculation
    let jitterSum = 0;
    for (let i = 1; i < validPings.length; i++) {
      jitterSum += Math.abs(validPings[i] - validPings[i - 1]);
    }
    const jitter = validPings.length > 1 ? Math.round((jitterSum / (validPings.length - 1)) * 10) / 10 : 0;

    // Spikes count (ping > 120ms or > 2.5x average)
    const baseline = Math.max(25, avgPing * 2.2);
    const spikesCount = validPings.filter((ms) => ms > baseline && ms > 80).length;

    // Stability Score calculation
    let calcScore = 100;
    calcScore -= lossPct * 3.5;
    calcScore -= Math.min(30, jitter * 2.5);
    calcScore -= Math.min(30, Math.max(0, avgPing - 30) * 0.5);
    calcScore -= Math.min(20, spikesCount * 3);
    const finalScore = Math.max(0, Math.min(100, Math.round(calcScore)));

    let grade = 'A+';
    if (finalScore >= 92) grade = 'A+ (Optimal)';
    else if (finalScore >= 82) grade = 'A (Excellent)';
    else if (finalScore >= 70) grade = 'B (Good)';
    else if (finalScore >= 55) grade = 'C (Fair)';
    else grade = 'D (Unstable)';

    return {
      currentPing,
      avgPing,
      minPing,
      maxPing,
      p99Ping,
      jitter,
      lossPct,
      spikesCount,
      score: finalScore,
      grade,
    };
  }, [history]);

  // Session Start / Stop handler
  const handleToggleSession = () => {
    if (!isRecording) {
      sessionStartTimeRef.current = Date.now();
      sessionSamplesRef.current = [];
      setIsRecording(true);
      setSessionSummary(null);
      pushToast(`Gaming session recording started against ${activeHost}.`, 'info');
    } else {
      setIsRecording(false);
      const durationSec = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
      const sessionSamples = [...sessionSamplesRef.current];

      const validPings = sessionSamples.filter((s) => !s.lost).map((s) => s.ms);
      const lost = sessionSamples.filter((s) => s.lost).length;
      const lossPct = sessionSamples.length > 0 ? Math.round((lost / sessionSamples.length) * 100) : 0;

      const avg = validPings.length > 0 ? Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length) : 0;
      const min = validPings.length > 0 ? Math.min(...validPings) : 0;
      const max = validPings.length > 0 ? Math.max(...validPings) : 0;

      const sorted = [...validPings].sort((a, b) => a - b);
      const p99 = sorted.length > 0 ? sorted[Math.max(0, Math.floor(sorted.length * 0.99))] : 0;

      let jSum = 0;
      for (let i = 1; i < validPings.length; i++) {
        jSum += Math.abs(validPings[i] - validPings[i - 1]);
      }
      const jit = validPings.length > 1 ? Math.round((jSum / (validPings.length - 1)) * 10) / 10 : 0;

      let sScore = 100 - lossPct * 3.5 - Math.min(30, jit * 2.5) - Math.min(30, Math.max(0, avg - 30) * 0.5);
      const finalScore = Math.max(0, Math.min(100, Math.round(sScore)));

      let gGrade = 'A+';
      if (finalScore >= 92) gGrade = 'A+ (Optimal)';
      else if (finalScore >= 82) gGrade = 'A (Excellent)';
      else if (finalScore >= 70) gGrade = 'B (Good)';
      else if (finalScore >= 55) gGrade = 'C (Fair)';
      else gGrade = 'D (Unstable)';

      const summary: GamingSessionSummary = {
        id: `sess-${Date.now()}`,
        target: activeHost,
        startTime: new Date(sessionStartTimeRef.current).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationSec,
        packetsSent: sessionSamples.length,
        packetsLost: lost,
        lossPct,
        minPing: min,
        avgPing: avg,
        maxPing: max,
        p99Ping: p99,
        jitter: jit,
        grade: gGrade,
        score: finalScore,
      };

      setSessionSummary(summary);
      pushToast(`Session recorded (${durationSec}s). Score: ${finalScore}/100`, 'success');
    }
  };

  const exportSessionCSV = () => {
    if (!sessionSummary) return;
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Target Host', sessionSummary.target],
      ['Start Time', sessionSummary.startTime],
      ['Duration (s)', sessionSummary.durationSec],
      ['Packets Sent', sessionSummary.packetsSent],
      ['Packets Lost', sessionSummary.packetsLost],
      ['Packet Loss (%)', sessionSummary.lossPct],
      ['Min Ping (ms)', sessionSummary.minPing],
      ['Avg Ping (ms)', sessionSummary.avgPing],
      ['Max Ping (ms)', sessionSummary.maxPing],
      ['p99 Latency (ms)', sessionSummary.p99Ping],
      ['Jitter (ms)', sessionSummary.jitter],
      ['Stability Score', sessionSummary.score],
      ['Grade', sessionSummary.grade],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(',')).map(c => `"${c}"`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NetX-GamingSession-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    pushToast('Exported gaming session report to CSV.', 'success');
  };

  return (
    <div className="page-container">
      {/* Header & Target Selector */}
      <section className="surface-panel" aria-label="Gaming mode monitor">
        <div className="surface-panel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="surface-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Gamepad2 size={20} style={{ color: 'var(--brand-lilac)' }} />
              <span>Network Quality &amp; Gaming Mode</span>
            </h2>
            <p className="surface-panel-subtitle">
              High-frequency ICMP latency, jitter, packet loss, and connection stability telemetry for competitive gaming.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Target Select */}
            <select
              className="select-field"
              value={isCustom ? 'custom' : target}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustom(true);
                } else {
                  setIsCustom(false);
                  setTarget(e.target.value);
                }
              }}
              style={{ fontSize: 12.5, height: 32 }}
              aria-label="Latency target"
            >
              <option value="1.1.1.1">Cloudflare Edge (1.1.1.1)</option>
              <option value="8.8.8.8">Google DNS (8.8.8.8)</option>
              {networkInfo.gateway && networkInfo.gateway !== '—' && (
                <option value={networkInfo.gateway}>Local Gateway ({networkInfo.gateway})</option>
              )}
              <option value="custom">Custom Server / Game IP...</option>
            </select>

            {isCustom && (
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 104.16.132.229 or game.server"
                value={customHost}
                onChange={(e) => setCustomHost(e.target.value)}
                style={{ width: 180, height: 32, fontSize: 12 }}
              />
            )}

            <Button
              variant={isRecording ? 'danger' : 'primary'}
              size="sm"
              icon={isRecording ? <Square size={14} /> : <Play size={14} />}
              onClick={handleToggleSession}
            >
              {isRecording ? 'End Session' : 'Record Session'}
            </Button>
          </div>
        </div>

        {/* Real-time Metric Tiles */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>CURRENT PING</div>
              <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
                {stats.currentPing} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>ms</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Min: {stats.minPing}ms · Max: {stats.maxPing}ms
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>JITTER (VARIANCE)</div>
              <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: stats.jitter > 10 ? 'var(--brand-amber)' : 'var(--brand-mint)' }}>
                ±{stats.jitter} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>ms</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                p99 Latency: {stats.p99Ping}ms
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>PACKET LOSS</div>
              <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: stats.lossPct > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                {stats.lossPct} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Spikes: {stats.spikesCount} detected
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>NETX STABILITY SCORE</div>
              <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: 'var(--brand-lilac)' }}>
                {stats.score} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>/ 100</span>
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: stats.score >= 80 ? 'var(--status-success)' : 'var(--brand-amber)', marginTop: 2 }}>
                {stats.grade}
              </div>
            </div>
          </div>

          {/* Real-time Latency Timeline Graph (Last 60 seconds) */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={15} style={{ color: 'var(--series-ping)' }} />
                <span>Real-Time Latency Timeline (Target: {activeHost})</span>
              </div>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {history.length} samples recorded · Avg: {stats.avgPing} ms
              </span>
            </div>

            <div style={{ height: 110, display: 'flex', alignItems: 'flex-end', gap: 3, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
              {history.map((s, idx) => {
                const maxVal = Math.max(100, ...history.map((h) => h.ms));
                const heightPct = s.lost ? 100 : Math.max(8, Math.min(100, Math.round((s.ms / maxVal) * 100)));
                return (
                  <div
                    key={idx}
                    title={`${s.time}: ${s.lost ? 'PACKET LOST' : `${s.ms} ms`}`}
                    style={{
                      flex: 1,
                      height: `${heightPct}%`,
                      borderRadius: '2px 2px 0 0',
                      background: s.lost
                        ? 'var(--status-danger)'
                        : s.ms > 100
                        ? 'var(--brand-amber)'
                        : 'linear-gradient(180deg, #c084fc 0%, rgba(192, 132, 252, 0.25) 100%)',
                      transition: 'height 0.2s ease',
                    }}
                  />
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              <span>60s ago</span>
              <span>30s ago</span>
              <span>Now (Live ICMP)</span>
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic' }}>
            <Info size={13} style={{ color: 'var(--brand-lilac)' }} />
            <span>
              NetX Stability Score is an estimate evaluated from packet consistency, latency variance, and probe timeouts.
              Measurements reflect true network latency to {activeHost}.
            </span>
          </div>
        </div>
      </section>

      {/* Gaming Session Summary Report Card (When a session is finished) */}
      {sessionSummary && (
        <section className="surface-panel" aria-label="Gaming session summary">
          <div className="surface-panel-header">
            <div>
              <h2 className="surface-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} style={{ color: 'var(--status-success)' }} />
                <span>Gaming Session Performance Summary</span>
              </h2>
              <p className="surface-panel-subtitle">
                Target: {sessionSummary.target} · Duration: {sessionSummary.durationSec}s · Started: {sessionSummary.startTime}
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<DownloadCloud size={14} />}
              onClick={exportSessionCSV}
            >
              Export Report
            </Button>
          </div>

          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>SESSION GRADE</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: 'var(--brand-mint)' }}>
                {sessionSummary.grade} ({sessionSummary.score}/100)
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>AVERAGE LATENCY</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {sessionSummary.avgPing} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ms</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Range: {sessionSummary.minPing}ms – {sessionSummary.maxPing}ms
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>JITTER / VARIANCE</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                ±{sessionSummary.jitter} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ms</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                p99 Latency: {sessionSummary.p99Ping}ms
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL PACKETS</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {sessionSummary.packetsSent} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>probes</span>
              </div>
              <div style={{ fontSize: 11, color: sessionSummary.lossPct > 0 ? 'var(--status-danger)' : 'var(--text-muted)' }}>
                Lost: {sessionSummary.packetsLost} ({sessionSummary.lossPct}%)
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default GamingModeView;
