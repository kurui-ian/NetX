import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';
import { BandwidthPoint } from '../../types/netx';

/* ============================================================================
   1. Accessible Status Badge (Section 9 & 17: Never color alone)
   ============================================================================ */

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  pulse?: boolean;
  iconStyle?: 'dot' | 'check' | 'spinner';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  iconStyle = 'dot',
}) => {
  const renderSymbol = () => {
    if (iconStyle === 'spinner') {
      return <Loader2 size={12} className="spin" aria-hidden="true" />;
    }
    if (iconStyle === 'check') {
      if (variant === 'success') return <CheckCircle2 size={13} aria-hidden="true" />;
      if (variant === 'warning') return <AlertTriangle size={13} aria-hidden="true" />;
      if (variant === 'danger') return <XCircle size={13} aria-hidden="true" />;
      return <Info size={13} aria-hidden="true" />;
    }
    // Accessible symbol + text (e.g. ● Connected, ▲ Warning, ✕ Offline)
    if (variant === 'success') return <span aria-hidden="true">●</span>;
    if (variant === 'warning') return <span aria-hidden="true">▲</span>;
    if (variant === 'danger') return <span aria-hidden="true">✕</span>;
    if (variant === 'info') return <span aria-hidden="true">◆</span>;
    return <span aria-hidden="true">○</span>;
  };

  return (
    <span className={`status-badge ${variant}`} role="status">
      {renderSymbol()}
      <span>{label}</span>
    </span>
  );
};

/* ============================================================================
   2. Metric Tile (Section 8 & 9: Prominent primary values)
   ============================================================================ */

interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: React.ReactNode;
  icon?: React.ReactNode;
  accentColor?: string;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  unit,
  subtext,
  icon,
  accentColor,
}) => {
  return (
    <div
      className="metric-tile"
      style={accentColor ? { borderTop: `3px solid ${accentColor}` } : undefined}
    >
      <div className="metric-header">
        <span>{label}</span>
        {icon && <span style={{ color: accentColor || 'var(--brand-mint)' }}>{icon}</span>}
      </div>
      <div className="metric-value-row">
        <span className="metric-value selectable">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {subtext && <div className="metric-subtext">{subtext}</div>}
    </div>
  );
};

/* ============================================================================
   3. Reusable Action Button (Section 5, 9, 14)
   ============================================================================ */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const sizeClass = size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : '';
  return (
    <button
      className={`btn btn-${variant} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="spin" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
};

/* ============================================================================
   4. Empty State Component (Section 15: What is missing, why, and next action)
   ============================================================================ */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyStateBox: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="empty-state-box" role="region" aria-label={title}>
      {icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--brand-mint-soft)',
            color: 'var(--brand-mint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
      )}
      <div className="state-title">{title}</div>
      <p className="state-desc">{description}</p>
      {actionLabel && onAction && (
        <div style={{ marginTop: 6 }}>
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   5. Understandable Error State Component (Section 16)
   ============================================================================ */

interface ErrorStateProps {
  title: string;
  explanation: string;
  technicalDetails?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorStateBox: React.FC<ErrorStateProps> = ({
  title,
  explanation,
  technicalDetails,
  onRetry,
  retryLabel = 'Try Again',
}) => {
  const [showTech, setShowTech] = useState(false);

  return (
    <div className="error-state-box" role="alert">
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(201, 59, 59, 0.14)',
          color: 'var(--status-danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertTriangle size={22} />
      </div>
      <div className="state-title">{title}</div>
      <p className="state-desc">{explanation}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {technicalDetails && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTech((s) => !s)}
            icon={showTech ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          >
            View technical details
          </Button>
        )}
      </div>
      {showTech && technicalDetails && (
        <pre className="tech-details-box selectable">{technicalDetails}</pre>
      )}
    </div>
  );
};

/* ============================================================================
   6. Accessible Toggle Switch (Section 20)
   ============================================================================ */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: checked ? 'var(--brand-mint)' : 'var(--text-muted)',
          minWidth: 26,
          textAlign: 'right',
        }}
      >
        {checked ? 'ON' : 'OFF'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="toggle-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
};

/* ============================================================================
   7. Real-Time Dual-Series Bandwidth Activity Graph (Section 7 & 9)
   ============================================================================ */

interface BandwidthGraphProps {
  data: BandwidthPoint[];
  height?: number;
}

export const BandwidthGraph: React.FC<BandwidthGraphProps> = ({ data, height = 210 }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data.length) return null;

  const width = 760;
  const padLeft = 42;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(
    120,
    ...data.map((d) => Math.max(d.downloadMbps, d.uploadMbps))
  );
  const yMax = Math.ceil(maxVal / 40) * 40;

  const getX = (index: number) =>
    padLeft + (index / Math.max(1, data.length - 1)) * plotW;
  const getY = (val: number) => padTop + plotH - (val / yMax) * plotH;

  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    const pts = values.map((v, idx) => ({ x: getX(idx), y: getY(v) }));
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)}`;
    }
    const last = pts[pts.length - 1];
    d += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    return d;
  };

  const dlValues = data.map((d) => d.downloadMbps);
  const ulValues = data.map((d) => d.uploadMbps);

  const dlLine = buildSmoothPath(dlValues);
  const ulLine = buildSmoothPath(ulValues);

  const dlArea = `${dlLine} L ${getX(data.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${padLeft} ${(padTop + plotH).toFixed(1)} Z`;
  const ulArea = `${ulLine} L ${getX(data.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${padLeft} ${(padTop + plotH).toFixed(1)} Z`;

  const yTicks = [0, yMax * 0.5, yMax];
  const hoveredPoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Real-time network download and upload activity graph"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="netxDlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-download)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--series-download)" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="netxUlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-upload)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--series-upload)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal Reference Grid Lines */}
        {yTicks.map((tick, idx) => {
          const y = getY(tick);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--border-subtle)"
                strokeDasharray={idx === 0 ? undefined : '4 4'}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10.5"
                fill="var(--text-muted)"
                fontFamily="var(--font-mono)"
              >
                {Math.round(tick)}
              </text>
            </g>
          );
        })}

        {/* Download Area & Line */}
        <path d={dlArea} fill="url(#netxDlGrad)" />
        <path
          d={dlLine}
          fill="none"
          stroke="var(--series-download)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Upload Area & Line */}
        <path d={ulArea} fill="url(#netxUlGrad)" />
        <path
          d={ulLine}
          fill="none"
          stroke="var(--series-upload)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Time X-Axis Labels */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((idx) => (
          <text
            key={idx}
            x={getX(idx)}
            y={height - 6}
            textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}
            fontSize="10.5"
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
          >
            {data[idx]?.timestamp}
          </text>
        ))}

        {/* Interactive Hover Crosshair */}
        {hoverIndex !== null && hoveredPoint && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={padTop + plotH}
              stroke="var(--border-strong)"
              strokeDasharray="3 3"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(hoveredPoint.downloadMbps)}
              r={4.5}
              fill="var(--series-download)"
              stroke="var(--bg-surface)"
              strokeWidth={2}
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(hoveredPoint.uploadMbps)}
              r={4}
              fill="var(--series-upload)"
              stroke="var(--bg-surface)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Invisible Hover Columns */}
        {data.map((_, idx) => {
          const colW = plotW / data.length;
          return (
            <rect
              key={idx}
              x={getX(idx) - colW / 2}
              y={padTop}
              width={colW}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(idx)}
            />
          );
        })}
      </svg>

      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 16,
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xs)',
            padding: '4px 10px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          <span className="mono" style={{ color: 'var(--text-muted)' }}>
            {hoveredPoint.timestamp}
          </span>
          <span className="mono" style={{ color: 'var(--series-download)', fontWeight: 700 }}>
            ↓ {hoveredPoint.downloadMbps.toFixed(1)} Mbps
          </span>
          <span className="mono" style={{ color: 'var(--series-upload)', fontWeight: 700 }}>
            ↑ {hoveredPoint.uploadMbps.toFixed(1)} Mbps
          </span>
        </div>
      )}
    </div>
  );
};
