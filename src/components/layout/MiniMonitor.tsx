import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  ArrowUpRight,
  ChevronUp,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { useNetX } from '../../context/NetXContext';

interface MiniMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MiniMonitor: React.FC<MiniMonitorProps> = ({ isOpen, onClose }) => {
  const {
    connected,
    currentDownloadMbps,
    currentUploadMbps,
    currentPingMs,
    networkInfo,
    bandwidthHistory,
    setActiveNav,
    pushToast,
  } = useNetX();

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('netx-mini-pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: Math.max(20, window.innerWidth - 320), y: Math.max(20, window.innerHeight - 220) };
  });

  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false);
  const [isDesktopMiniMode, setIsDesktopMiniMode] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try {
      localStorage.setItem('netx-mini-pos', JSON.stringify(position));
    } catch {}
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const nextX = Math.min(
        Math.max(10, e.clientX - dragOffsetRef.current.x),
        window.innerWidth - 300
      );
      const nextY = Math.min(
        Math.max(10, e.clientY - dragOffsetRef.current.y),
        window.innerHeight - 180
      );
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const toggleAlwaysOnTop = async () => {
    if (window.netxNative?.setAlwaysOnTop) {
      const next = !isAlwaysOnTop;
      const res = await window.netxNative.setAlwaysOnTop(next);
      if (res?.ok) {
        setIsAlwaysOnTop(next);
        pushToast(next ? 'Window pinned Always on Top' : 'Always on Top unpinned', 'info');
      }
    } else {
      setIsAlwaysOnTop((prev) => !prev);
    }
  };

  const toggleDesktopMini = async () => {
    if (window.netxNative?.toggleMiniMode) {
      const next = !isDesktopMiniMode;
      const res = await window.netxNative.toggleMiniMode(next);
      if (res?.ok) {
        setIsDesktopMiniMode(next);
        pushToast(next ? 'Entered Desktop Mini Window' : 'Restored standard window', 'info');
      }
    }
  };

  if (!isOpen) return null;

  // Mini sparkline path
  const points = bandwidthHistory.slice(-12);
  const maxVal = Math.max(...points.map((p) => p.downloadMbps + p.uploadMbps), 5);
  const sparkWidth = 260;
  const sparkHeight = 36;
  const step = points.length > 1 ? sparkWidth / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const val = p.downloadMbps + p.uploadMbps;
    const x = i * step;
    const y = sparkHeight - (val / maxVal) * (sparkHeight - 8) - 4;
    return { x, y };
  });

  const sparkPath =
    coords.length > 1
      ? coords.reduce((acc, c, idx) => (idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`), '')
      : `M 0 ${sparkHeight / 2} L ${sparkWidth} ${sparkHeight / 2}`;

  return (
    <div
      className="netx-mini-monitor"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 284,
        zIndex: 9999,
        background: 'rgba(16, 12, 34, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(167, 139, 250, 0.35)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(167, 139, 250, 0.15)',
        color: '#ffffff',
        overflow: 'hidden',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      {/* Mini Monitor Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: connected ? 'var(--brand-mint)' : 'var(--status-danger)',
              boxShadow: connected ? '0 0 6px var(--brand-mint)' : '0 0 6px var(--status-danger)',
            }}
          />
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            NetX Mini
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={toggleAlwaysOnTop}
            title={isAlwaysOnTop ? 'Unpin Always-on-Top' : 'Pin Always-on-Top'}
            style={{
              background: 'transparent',
              border: 'none',
              color: isAlwaysOnTop ? 'var(--brand-purple)' : 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isAlwaysOnTop ? <Pin size={13} /> : <PinOff size={13} />}
          </button>

          <button
            type="button"
            onClick={toggleDesktopMini}
            title={isDesktopMiniMode ? 'Restore Full Window' : 'Minimize to Desktop Widget'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isDesktopMiniMode ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNav('dashboard');
              onClose();
            }}
            title="Open Dashboard"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowUpRight size={13} />
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close Mini Monitor"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Mini Monitor Body */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>↓</span>
            <span
              style={{
                fontSize: 20,
                fontFamily: 'var(--font-mono)',
                fontWeight: 750,
                color: '#ffffff',
                letterSpacing: -0.5,
              }}
            >
              {currentDownloadMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' }}>Mbps</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>↑</span>
            <span
              style={{
                fontSize: 16,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--brand-purple)',
              }}
            >
              {currentUploadMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.5)' }}>Mbps</span>
          </div>
        </div>

        {/* Live Sparkline */}
        <div style={{ margin: '6px 0', height: sparkHeight, width: '100%', position: 'relative' }}>
          <svg viewBox={`0 0 ${sparkWidth} ${sparkHeight}`} style={{ width: '100%', height: '100%' }}>
            <path d={sparkPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Footer Sub-strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.65)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: 6,
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Zap size={11} style={{ color: 'var(--brand-mint)' }} />
            <span>{currentPingMs || '—'} ms</span>
          </div>

          <div
            style={{
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
            }}
            title={networkInfo.interfaceName}
          >
            {networkInfo.interfaceName}
          </div>
        </div>
      </div>
    </div>
  );
};
