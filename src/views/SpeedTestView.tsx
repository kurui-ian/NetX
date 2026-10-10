import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import {
  Button,
  EmptyStateBox,
  ErrorStateBox,
  StatusBadge,
} from '../components/ui/Primitives';

type TestStage = 'idle' | 'ping' | 'download' | 'upload' | 'complete' | 'error';

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

  const [pingResult, setPingResult] = useState<number | null>(null);
  const [downloadResult, setDownloadResult] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<number | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    if (!window.netxNative) return;
    const unsubscribe = window.netxNative.onSpeedTestProgress((data) => {
      if (data.stage) setStage(data.stage);
      if (typeof data.progress === 'number') setProgress(data.progress);
      if (typeof data.liveValue === 'number') setLiveValue(data.liveValue);
      if (typeof data.pingMs === 'number') setPingResult(data.pingMs);
      if (typeof data.downloadMbps === 'number') setDownloadResult(data.downloadMbps);
    });
    return unsubscribe;
  }, []);

  const startSpeedTest = async () => {
    if (!window.netxNative) return;
    setPingResult(null);
    setDownloadResult(null);
    setUploadResult(null);
    setErrorDetails('');
    setProgress(2);
    setLiveValue(0);
    setStage('ping');

    const res = await window.netxNative.runSpeedTest();
    if (!res || !res.ok) {
      setErrorDetails(res?.error || 'Connection to benchmark server failed.');
      setStage('error');
      return;
    }

    setPingResult(res.pingMs);
    setDownloadResult(res.downloadMbps);
    setUploadResult(res.uploadMbps);
    setProgress(100);
    setStage('complete');

    addSpeedTestRecord({
      server: res.server || networkInfo.ispEdge || 'Cloudflare Speed Edge',
      pingMs: res.pingMs,
      jitterMs: res.jitterMs || 1.0,
      downloadMbps: res.downloadMbps,
      uploadMbps: res.uploadMbps,
      interfaceName: `${networkInfo.interfaceName} (${networkInfo.ssid})`,
    });

    pushToast(
      `Speed test complete: ${res.downloadMbps.toFixed(1)} Mbps down / ${res.uploadMbps.toFixed(1)} Mbps up`,
      'success'
    );
  };

  const isRunning = stage === 'ping' || stage === 'download' || stage === 'upload';

  const getStageLabel = () => {
    if (stage === 'ping') return 'Measuring network ping & jitter...';
    if (stage === 'download') return 'Testing download speed...';
    if (stage === 'upload') return 'Testing upload speed...';
    if (stage === 'complete') return 'Speed Test Complete';
    return 'Check your internet connection.';
  };

  return (
    <div className="page-container">
      {/* Primary Speed Test Stage Card (Section 11) */}
      <section className="surface-panel" aria-label="Speed test runner">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Speed Test</h2>
            <p className="surface-panel-subtitle">
              Target: Cloudflare Global Edge · Interface: {networkInfo.interfaceName} (
              {networkInfo.ssid} · {networkInfo.ipv4})
            </p>
          </div>

          <StatusBadge
            variant={
              stage === 'error'
                ? 'danger'
                : stage === 'complete'
                ? 'success'
                : isRunning
                ? 'info'
                : 'neutral'
            }
            iconStyle={isRunning ? 'spinner' : stage === 'complete' ? 'check' : 'dot'}
            label={
              stage === 'error'
                ? 'Test Failed'
                : stage === 'complete'
                ? 'Complete'
                : isRunning
                ? 'Testing Live...'
                : 'Ready'
            }
          />
        </div>

        {/* Error State (Section 16) */}
        {stage === 'error' ? (
          <ErrorStateBox
            title="Unable to perform speed test."
            explanation="Your internet connection may be unavailable or the benchmark server could not be reached."
            technicalDetails={`Error: ${errorDetails}\nInterface: ${networkInfo.adapterDescription} (${networkInfo.ipv4})`}
            onRetry={startSpeedTest}
            retryLabel="Try Again"
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '24px 16px',
              gap: 24,
            }}
          >
            {/* Status Heading */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: stage === 'complete' ? 20 : 16,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {stage === 'complete' && (
                  <CheckCircle2 size={22} style={{ color: 'var(--status-success)' }} />
                )}
                <span>{getStageLabel()}</span>
              </div>
            </div>

            {/* During Test Live Readout & Progress Bar (Section 11) */}
            {isRunning && (
              <div
                style={{
                  width: '100%',
                  maxWidth: 460,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 24px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="tabular-nums" style={{ fontSize: 42, fontWeight: 800 }}>
                  {stage === 'ping' ? liveValue : liveValue.toFixed(1)}{' '}
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {stage === 'ping' ? 'ms' : 'Mbps'}
                  </span>
                </div>

                <div className="progress-track" aria-label="Speed test progress">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Stage: {stage.toUpperCase()}</span>
                  <span className="mono">{progress}%</span>
                </div>
              </div>
            )}

            {/* 3 Primary Result Pillars: Download, Upload, Ping (Section 11) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 18,
                width: '100%',
                maxWidth: 740,
              }}
            >
              {/* Download */}
              <div
                style={{
                  padding: '20px 22px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    stage === 'download' ? 'var(--bg-surface-tinted)' : 'var(--bg-surface-subtle)',
                  border:
                    stage === 'download'
                      ? '1px solid var(--brand-mint)'
                      : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginBottom: 8,
                  }}
                >
                  <ArrowDown size={15} style={{ color: 'var(--series-download)' }} />
                  <span>Download</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 800 }}>
                  {downloadResult !== null ? (
                    <>
                      {downloadResult.toFixed(1)}{' '}
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                        Mbps
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>

              {/* Upload */}
              <div
                style={{
                  padding: '20px 22px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    stage === 'upload' ? 'var(--bg-surface-tinted)' : 'var(--bg-surface-subtle)',
                  border:
                    stage === 'upload'
                      ? '1px solid var(--brand-amber)'
                      : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginBottom: 8,
                  }}
                >
                  <ArrowUp size={15} style={{ color: 'var(--series-upload)' }} />
                  <span>Upload</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 800 }}>
                  {uploadResult !== null ? (
                    <>
                      {uploadResult.toFixed(1)}{' '}
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                        Mbps
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>

              {/* Ping */}
              <div
                style={{
                  padding: '20px 22px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    stage === 'ping' ? 'var(--bg-surface-tinted)' : 'var(--bg-surface-subtle)',
                  border:
                    stage === 'ping'
                      ? '1px solid var(--series-ping)'
                      : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginBottom: 8,
                  }}
                >
                  <Activity size={15} style={{ color: 'var(--series-ping)' }} />
                  <span>Ping</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 800 }}>
                  {pingResult !== null ? (
                    <>
                      {pingResult}{' '}
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                        ms
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Button: Start Test / Test Again */}
            <div>
              <Button
                variant="primary"
                size="lg"
                loading={isRunning}
                icon={stage === 'complete' ? <RotateCcw size={17} /> : <Play size={17} />}
                onClick={startSpeedTest}
              >
                {stage === 'complete'
                  ? 'Test Again'
                  : isRunning
                  ? 'Testing Connection...'
                  : 'Start Test'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Speed Test History Table & Empty State (Section 9 & Section 15) */}
      <section className="surface-panel" aria-label="Speed test history">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Speed Test History</h2>
            <p className="surface-panel-subtitle">
              Real speed tests recorded on {networkInfo.hostname}.
            </p>
          </div>
          {speedTestHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={clearSpeedTestHistory}
            >
              Clear History
            </Button>
          )}
        </div>

        {speedTestHistory.length === 0 ? (
          <EmptyStateBox
            icon={<Gauge size={24} />}
            title="No Speed Tests Yet"
            description="Run your first speed test to begin building your network history."
            actionLabel="Start Speed Test"
            onAction={startSpeedTest}
          />
        ) : (
          <div className="table-wrap">
            <table className="netx-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Interface</th>
                  <th>Test Server</th>
                  <th>Ping</th>
                  <th>Download</th>
                  <th>Upload</th>
                </tr>
              </thead>
              <tbody>
                {speedTestHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.date}</td>
                    <td>
                      <StatusBadge variant="neutral" label={item.interfaceName} />
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Server size={13} />
                        <span>{item.server}</span>
                      </span>
                    </td>
                    <td className="mono">{item.pingMs} ms</td>
                    <td
                      className="mono"
                      style={{ fontWeight: 700, color: 'var(--series-download)' }}
                    >
                      ↓ {item.downloadMbps.toFixed(1)} Mbps
                    </td>
                    <td
                      className="mono"
                      style={{ fontWeight: 700, color: 'var(--series-upload)' }}
                    >
                      ↑ {item.uploadMbps.toFixed(1)} Mbps
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
