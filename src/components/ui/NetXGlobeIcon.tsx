import React from 'react';

interface NetXGlobeIconProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export const NetXGlobeIcon: React.FC<NetXGlobeIconProps> = ({
  size = 24,
  className = '',
  glow = true,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible', display: 'inline-block', verticalAlign: 'middle' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="netxGlobeStroke" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="35%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {glow && (
          <filter id="globeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Subtle ambient cyan glow */}
      {glow && (
        <circle cx="50" cy="50" r="42" fill="rgba(14, 165, 233, 0.12)" filter="blur(8px)" />
      )}

      <g stroke="url(#netxGlobeStroke)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" filter={glow ? 'url(#globeGlow)' : undefined}>
        {/* Outer Circular Boundary */}
        <circle cx="50" cy="50" r="43" />

        {/* Vertical Center Axis Line */}
        <line x1="50" y1="7" x2="50" y2="93" />

        {/* Horizontal Equator Line */}
        <line x1="7" y1="50" x2="93" y2="50" />

        {/* Longitudinal Elliptical Curve - West */}
        <path d="M 50 7 C 21 23, 21 77, 50 93" />

        {/* Longitudinal Elliptical Curve - East */}
        <path d="M 50 7 C 79 23, 79 77, 50 93" />

        {/* Latitudinal Curve - Northern Hemisphere */}
        <path d="M 14.5 30 C 30 42, 70 42, 85.5 30" />

        {/* Latitudinal Curve - Southern Hemisphere */}
        <path d="M 14.5 70 C 30 58, 70 58, 85.5 70" />
      </g>
    </svg>
  );
};

export default NetXGlobeIcon;
