import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { Button, StatusBadge } from '../components/ui/Primitives';

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
    label: 'Network adapter',
    detail: 'Verifies local wireless/Ethernet adapter state and IPv4 assignment',
    tech: '',
    state: 'pending',
  },
  {
    id: 'gateway',
    label: 'Gateway',
    detail: 'Pings your local router default gateway for LAN reachability',
    tech: '',
    state: 'pending',
  },
  {
    id: 'dns',
    label: 'DNS',
    detail: 'Tests live domain name resolution against your configured DNS server',
    tech: '',
    state: 'pending',
  },
  {
    id: 'internet',
    label: 'Internet',
    detail: 'Verifies external WAN routing and HTTPS connectivity',
    tech: '',
    state: 'pending',
  },
];

export const DiagnosticsView: React.FC = () => {
  const [phase, setPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [steps, setSteps] = useState<DiagStep[]>(INITIAL_STEPS);
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);

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
      return (
        <Loader2
          size={20}
          className="spin"
          style={{ color: 'var(--brand-mint)', flexShrink: 0 }}
        />
      );
    }
    return <Circle size={19} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
  };

  const hasFailed = steps.some((s) => s.state === 'failed');
  const hasWarning = steps.some((s) => s.state === 'warning');

  return (
    <div className="page-container">
      <section className="surface-panel" aria-label="Network diagnostics">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Network Diagnostics</h2>
            <p className="surface-panel-subtitle">
              Live hardware, gateway, DNS, and WAN reachability tests on your PC.
            </p>
          </div>

          <StatusBadge
            variant={
              phase === 'running'
                ? 'info'
                : phase === 'complete'
                ? hasFailed
                  ? 'danger'
                  : hasWarning
                  ? 'warning'
                  : 'success'
                : 'neutral'
            }
            iconStyle={phase === 'running' ? 'spinner' : phase === 'complete' ? 'check' : 'dot'}
            label={
              phase === 'running'
                ? 'Checking connection...'
                : phase === 'complete'
                ? hasFailed
                  ? 'Issue Detected'
                  : hasWarning
                  ? 'Attention Needed'
                  : 'Healthy'
                : 'Ready'
            }
          />
        </div>

        {/* Guided Diagnostic Container (Section 13) */}
        <div
          style={{
            maxWidth: 660,
            margin: '16px auto',
            padding: '28px 28px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {/* Heading State */}
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 750, color: 'var(--text-primary)' }}>
              {phase === 'idle' && 'Check your connection for common problems.'}
              {phase === 'running' && 'Checking connection...'}
              {phase === 'complete' &&
                (hasFailed
                  ? 'A connection problem was detected.'
                  : hasWarning
                  ? 'Your internet is connected, but latency is elevated.'
                  : 'Connection looks healthy.')}
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 4 }}>
              {phase === 'idle' &&
                'NetX will test your physical network adapter, local router gateway, DNS resolver, and external internet connectivity.'}
              {phase === 'running' &&
                'Executing live OS and network checks across each stage of your connection...'}
              {phase === 'complete' &&
                (hasFailed
                  ? 'Review the failed stage below to see what is preventing normal connectivity.'
                  : 'All four diagnostic stages passed on your active network interface.')}
            </p>
          </div>

          {/* 4 Step Checklist: ✓ Network adapter, ✓ Gateway, ◌ DNS, ○ Internet (Section 13) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step) => (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '13px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border:
                    step.state === 'failed'
                      ? '1px solid var(--status-danger-border)'
                      : step.state === 'warning'
                      ? '1px solid var(--status-warning-border)'
                      : step.state === 'checking'
                      ? '1px solid var(--brand-mint)'
                      : '1px solid var(--border-subtle)',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ marginTop: 1 }}>{renderStepSymbol(step.state)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-primary)' }}>
                      {step.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color:
                          step.state === 'checking'
                            ? 'var(--brand-mint)'
                            : 'var(--text-secondary)',
                        marginTop: 2,
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
              paddingTop: 4,
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
                ? 'Run Again'
                : phase === 'running'
                ? 'Checking Connection...'
                : 'Run Diagnostics'}
            </Button>

            {phase === 'complete' && (
              <Button
                variant="secondary"
                size="sm"
                icon={showTechDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                onClick={() => setShowTechDetails((s) => !s)}
              >
                View technical details
              </Button>
            )}
          </div>

          {phase === 'complete' && showTechDetails && (
            <pre className="tech-details-box selectable">
              {steps.map((s) => `[${s.label.toUpperCase()}]\n${s.tech}`).join('\n\n')}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
};
