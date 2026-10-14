import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileCode,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { Button, StatusBadge, MetricTile } from '../components/ui/Primitives';

type StepState = 'pending' | 'checking' | 'passed' | 'warning' | 'failed';

interface DiagStep {
  id: 'adapter' | 'gateway' | 'dns' | 'internet';
  label: string;
  detail: string;
  tech: string;
  state: StepState;
}

const INITIAL_STEPS: DiagStep[] = [
  {
    id: 'adapter',
    label: 'Network Adapter & Link',
    detail: 'Verifies local wireless/Ethernet hardware adapter state and valid IPv4 assignment',
    tech: '',
    state: 'pending',
  },
  {
    id: 'gateway',
    label: 'Default Gateway Reachability',
    detail: 'Pings local router default gateway over LAN for baseline local connectivity',
    tech: '',
    state: 'pending',
  },
  {
    id: 'dns',
    label: 'DNS Resolution Integrity',
    detail: 'Tests live domain name resolution against configured primary and public DNS resolvers',
    tech: '',
    state: 'pending',
  },
  {
    id: 'internet',
    label: 'External WAN & Edge Routing',
    detail: 'Verifies public IP reachability, WAN routing, and HTTPS edge handshakes',
    tech: '',
    state: 'pending',
  },
];

export const DiagnosticsView: React.FC = () => {
  const {
    networkInfo,
    currentDownloadMbps,
    currentUploadMbps,
    currentPingMs,
    currentJitterMs,
    gatewayPingMs,
    dnsPingMs,
    speedTestHistory,
    networkEvents,
    pushToast,
  } = useNetX();

  const [phase, setPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [steps, setSteps] = useState<DiagStep[]>(INITIAL_STEPS);
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const runDiagnostics = async () => {
    if (!window.netxNative) return;
    setShowTechDetails(false);
    setPhase('running');
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, state: 'pending', tech: '' })));

    const stepIds: DiagStep['id'][] = ['adapter', 'gateway', 'dns', 'internet'];

    for (let i = 0; i < stepIds.length; i++) {
      const id = stepIds[i];
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, state: 'checking' } : s))
      );

      const res = await window.netxNative.runDiagnosticStep(id);

      setSteps((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const nextState: StepState = !res?.passed
            ? 'failed'
            : res?.warning
            ? 'warning'
            : 'passed';
          return {
            ...s,
            state: nextState,
            detail: res?.detail || s.detail,
            tech: res?.tech || '',
          };
        })
      );
    }

    setPhase('complete');
  };

  const scorecard = useMemo(() => {
    const passed = steps.filter((s) => s.state === 'passed').length;
    const warnings = steps.filter((s) => s.state === 'warning').length;
    const failed = steps.filter((s) => s.state === 'failed').length;
    return { passed, warnings, failed, total: steps.length };
  }, [steps]);

  // Compile full sanitized diagnostic report
  const compileReportData = () => {
    return {
      application: 'NetX Network Utility & Internet Analytics Suite',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      networkOverview: {
        interfaceName: networkInfo.interfaceName,
        localIp: networkInfo.ipv4,
        macAddress: networkInfo.mac,
        gatewayIp: networkInfo.gateway,
        dnsServerIp: networkInfo.dnsServers,
        publicIp: networkInfo.publicIp,
        isp: networkInfo.ispEdge,
        wifiSsid: networkInfo.ssid,
        wifiBssid: networkInfo.bssid,
        wifiSignalQuality: `${networkInfo.signalQuality}%`,
      },
      currentTelemetrySnapshot: {
        downloadMbps: Math.round(currentDownloadMbps * 100) / 100,
        uploadMbps: Math.round(currentUploadMbps * 100) / 100,
        pingMs: currentPingMs,
        jitterMs: currentJitterMs,
        gatewayPingMs,
        dnsPingMs,
      },
      diagnosticAuditSteps: steps.map((s) => ({
        step: s.label,
        status: s.state.toUpperCase(),
        summary: s.detail,
        technicalProbeOutput: s.tech,
      })),
      recentSpeedBenchmarks: speedTestHistory.slice(0, 3).map((st) => ({
        date: st.date,
        server: st.server,
        downloadMbps: st.downloadMbps,
        uploadMbps: st.uploadMbps,
        pingMs: st.pingMs,
        jitterMs: st.jitterMs,
        packetLossPct: st.packetLossPct,
      })),
      recentIncidents: networkEvents.slice(0, 5).map((e) => ({
        timestamp: e.timestamp,
        severity: e.severity,
        type: e.type,
        title: e.title,
        description: e.description,
        evidence: e.evidence,
      })),
    };
  };

  // Compile formatted text report
  const compileTextReport = (data: ReturnType<typeof compileReportData>) => {
    const lines: string[] = [];
    lines.push('================================================================');
    lines.push('               NETX COMPREHENSIVE DIAGNOSTIC REPORT             ');
    lines.push('================================================================');
    lines.push(`Generated: ${data.timestamp}`);
    lines.push(`Application: ${data.application} v${data.version}`);
    lines.push('');
    lines.push('--- NETWORK INTERFACE & ADAPTER CONFIGURATION ---');
    lines.push(`Primary Adapter:   ${data.networkOverview.interfaceName}`);
    lines.push(`Local IPv4:        ${data.networkOverview.localIp}`);
    lines.push(`Hardware MAC:      ${data.networkOverview.macAddress}`);
    lines.push(`Default Gateway:   ${data.networkOverview.gatewayIp}`);
    lines.push(`DNS Server:        ${data.networkOverview.dnsServerIp}`);
    lines.push(`Public WAN IP:     ${data.networkOverview.publicIp} (${data.networkOverview.isp})`);
    if (data.networkOverview.wifiSsid !== 'Detecting...') {
      lines.push(`Wi-Fi SSID:        ${data.networkOverview.wifiSsid}`);
      lines.push(`Wi-Fi BSSID:       ${data.networkOverview.wifiBssid}`);
      lines.push(`Signal Strength:   ${data.networkOverview.wifiSignalQuality}`);
    }
    lines.push('');
    lines.push('--- REAL-TIME TELEMETRY SNAPSHOT ---');
    lines.push(`Live Throughput:   ↓ ${data.currentTelemetrySnapshot.downloadMbps} Mbps / ↑ ${data.currentTelemetrySnapshot.uploadMbps} Mbps`);
    lines.push(`Latency / Jitter:  ${data.currentTelemetrySnapshot.pingMs} ms (Jitter: ${data.currentTelemetrySnapshot.jitterMs} ms)`);
    lines.push(`Gateway Latency:   ${data.currentTelemetrySnapshot.gatewayPingMs} ms`);
    lines.push(`DNS Query Latency: ${data.currentTelemetrySnapshot.dnsPingMs} ms`);
    lines.push('');
    lines.push('--- DIAGNOSTIC STEP VERIFICATIONS ---');
    data.diagnosticAuditSteps.forEach((s, idx) => {
      lines.push(`[Step ${idx + 1}] ${s.step}: [${s.status}]`);
      lines.push(`  Detail: ${s.summary}`);
      if (s.technicalProbeOutput) {
        lines.push(`  Evidence: ${s.technicalProbeOutput.replace(/\r?\n/g, '\n    ')}`);
      }
      lines.push('');
    });
    if (data.recentSpeedBenchmarks.length > 0) {
      lines.push('--- RECENT SPEED BENCHMARKS ---');
      data.recentSpeedBenchmarks.forEach((b) => {
        lines.push(`  * ${b.date} | Endpoint: ${b.server} | ↓ ${b.downloadMbps} Mbps | ↑ ${b.uploadMbps} Mbps | Ping ${b.pingMs}ms | Loss: ${b.packetLossPct || 0}%`);
      });
      lines.push('');
    }
    if (data.recentIncidents.length > 0) {
      lines.push('--- RECENT DETECTED NETWORK INCIDENTS ---');
      data.recentIncidents.forEach((e) => {
        lines.push(`  * [${e.timestamp}] [${e.severity.toUpperCase()}] ${e.title} - ${e.description}`);
        if (e.evidence) lines.push(`    Evidence: ${e.evidence}`);
      });
      lines.push('');
    }
    lines.push('================================================================');
    lines.push('                 END OF NETX DIAGNOSTIC AUDIT                   ');
    lines.push('================================================================');
    return lines.join('\r\n');
  };

  const handleExport = async (format: 'json' | 'txt') => {
    setExporting(true);
    try {
      const data = compileReportData();
      const content = format === 'json' ? data : compileTextReport(data);

      if (window.netxNative?.exportDiagnosticReport) {
        const res = await window.netxNative.exportDiagnosticReport(content, format);
        if (res?.ok && res.filePath) {
          pushToast(`Saved report to ${res.filePath.split('\\').pop()}`, 'success');
          setExporting(false);
          return;
        } else if (res?.cancelled) {
          setExporting(false);
          return;
        }
      }

      // Browser Blob fallback
      const blob = new Blob(
        [typeof content === 'string' ? content : JSON.stringify(content, null, 2)],
        { type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8;' }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `netx-diagnostic-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      pushToast(`Exported diagnostic report (.${format})`, 'success');
    } catch (err) {
      pushToast(`Failed to export report: ${String(err)}`, 'warning');
    } finally {
      setExporting(false);
    }
  };

  const renderStepSymbol = (state: StepState) => {
    if (state === 'passed') {
      return <CheckCircle2 size={20} style={{ color: 'var(--status-success)', flexShrink: 0 }} />;
    }
    if (state === 'warning') {
      return <AlertTriangle size={20} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />;
    }
    if (state === 'failed') {
      return <XCircle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0 }} />;
    }
    if (state === 'checking') {
      return <Loader2 size={20} className="spin" style={{ color: 'var(--brand-mint)', flexShrink: 0 }} />;
    }
    return <Circle size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />;
  };

  return (
    <div className="view-container">
      {/* 1. Header Banner */}
      <div className="view-header-strip">
        <div className="header-left">
          <div className="header-icon-wrap" style={{ background: 'rgba(167, 139, 250, 0.12)' }}>
            <Stethoscope size={22} style={{ color: 'var(--brand-purple)' }} />
          </div>
          <div>
            <h1 className="view-title">Automated Network Health &amp; Diagnostics</h1>
            <p className="view-subtitle">
              Verify local interface binding, default gateway reachability, DNS query resolution, and external WAN routing.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileCode size={14} />}
            loading={exporting}
            onClick={() => handleExport('json')}
          >
            Export JSON
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText size={14} />}
            loading={exporting}
            onClick={() => handleExport('txt')}
          >
            Export Report (TXT)
          </Button>
        </div>
      </div>

      {/* 2. Scorecard Grid if completed */}
      {phase === 'complete' && (
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
          <MetricTile
            label="Tests Passed"
            value={`${scorecard.passed} / ${scorecard.total}`}
            unit="steps"
            accentColor="var(--status-success)"
            icon={<CheckCircle2 size={16} />}
            subtext="Healthy path components"
          />
          <MetricTile
            label="Warnings Detected"
            value={scorecard.warnings}
            unit="warnings"
            accentColor={scorecard.warnings > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)'}
            icon={<AlertTriangle size={16} />}
            subtext="Minor degradation"
          />
          <MetricTile
            label="Critical Failures"
            value={scorecard.failed}
            unit="failures"
            accentColor={scorecard.failed > 0 ? 'var(--status-danger)' : 'var(--text-tertiary)'}
            icon={<XCircle size={16} />}
            subtext="Connectivity blocked"
          />
          <MetricTile
            label="Overall Status"
            value={scorecard.failed > 0 ? 'Degraded' : scorecard.warnings > 0 ? 'Notice' : 'Optimal'}
            accentColor={scorecard.failed > 0 ? 'var(--status-danger)' : scorecard.warnings > 0 ? 'var(--status-warning)' : 'var(--brand-mint)'}
            icon={<Stethoscope size={16} />}
            subtext="Path audit result"
          />
        </div>
      )}

      {/* 3. Diagnostic Checklist Panel */}
      <section className="card-surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((step) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 8,
                background: 'var(--bg-surface-2)',
                border:
                  step.state === 'failed'
                    ? '1px solid var(--status-danger)'
                    : step.state === 'warning'
                    ? '1px solid var(--status-warning)'
                    : step.state === 'checking'
                    ? '1px solid var(--brand-purple)'
                    : '1px solid var(--border-subtle)',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ marginTop: 2 }}>{renderStepSymbol(step.state)}</div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--text-primary)' }}>
                    {step.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color:
                        step.state === 'checking'
                          ? 'var(--brand-purple)'
                          : 'var(--text-secondary)',
                      marginTop: 3,
                    }}
                  >
                    {step.state === 'checking'
                      ? `Testing ${step.label.toLowerCase()}...`
                      : step.detail}
                  </div>
                </div>
              </div>

              <div>
                {step.state === 'passed' && <StatusBadge variant="success" label="Passed" />}
                {step.state === 'warning' && <StatusBadge variant="warning" label="Warning" />}
                {step.state === 'failed' && <StatusBadge variant="danger" label="Failed" />}
                {step.state === 'checking' && (
                  <StatusBadge variant="info" iconStyle="spinner" label="Checking" />
                )}
                {step.state === 'pending' && <StatusBadge variant="neutral" label="Pending" />}
              </div>
            </div>
          ))}
        </div>

        {/* Action Row & Optional Technical Details */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button
            variant="primary"
            size="lg"
            loading={phase === 'running'}
            icon={phase === 'complete' ? <RotateCcw size={16} /> : <Play size={16} />}
            onClick={runDiagnostics}
          >
            {phase === 'complete'
              ? 'Run Diagnostics Again'
              : phase === 'running'
              ? 'Analyzing Network Path...'
              : 'Run Diagnostics'}
          </Button>

          {phase === 'complete' && (
            <Button
              variant="secondary"
              size="sm"
              icon={showTechDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              onClick={() => setShowTechDetails((s) => !s)}
            >
              {showTechDetails ? 'Hide technical logs' : 'View technical probe logs'}
            </Button>
          )}
        </div>

        {phase === 'complete' && showTechDetails && (
          <pre
            className="tech-details-box selectable"
            style={{
              marginTop: 16,
              background: 'var(--bg-canvas)',
              padding: 14,
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--brand-mint)',
              whiteSpace: 'pre-wrap',
              border: '1px solid var(--border-subtle)',
              maxHeight: 300,
              overflowY: 'auto',
            }}
          >
            {steps
              .filter((s) => s.tech)
              .map((s) => `[${s.label.toUpperCase()}]\n${s.tech}`)
              .join('\n\n')}
          </pre>
        )}
      </section>
    </div>
  );
};
