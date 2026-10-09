import type { ReactElement, SVGProps } from 'react';

/**
 * The FIDELITY brand mark: A unified, optically balanced scientific emblem.
 * Features a circular particle containment ring with precision cardinal reticle marks,
 * integrated with a bold, architectural monogram 'F' formed from solid quantum strata.
 */
export function FidelityLogo(props: SVGProps<SVGSVGElement> & { readonly size?: number; readonly glow?: boolean }): ReactElement {
  const { size = 52, glow = true, className = '', ...rest } = props;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`fidelity-logo ${glow ? 'glow' : ''} ${className}`}
      {...rest}
    >
      <defs>
        <linearGradient id="fid-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="60%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#00c8e0" />
        </linearGradient>
        <linearGradient id="fid-f-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#b4f4ff" />
        </linearGradient>
        <filter id="fid-glow-filter" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Precision Particle Containment Outer Ring */}
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke="url(#fid-ring-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        filter={glow ? 'url(#fid-glow-filter)' : undefined}
      />

      {/* Concentric Thin Calibration Reticle */}
      <circle
        cx="50"
        cy="50"
        r="47.5"
        stroke="rgba(0, 229, 255, 0.35)"
        strokeWidth="1"
        strokeDasharray="3 5"
      />

      {/* Cardinal Calibration Notches */}
      <line x1="50" y1="1" x2="50" y2="7" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="93" x2="50" y2="99" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" />
      <line x1="1" y1="50" x2="7" y2="50" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" />
      <line x1="93" y1="50" x2="99" y2="50" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" />

      {/* Unified, Solid Monogram 'F' (Optically Centered) */}
      <g filter={glow ? 'url(#fid-glow-filter)' : undefined}>
        {/* Main Solid 'F' Silhouette */}
        <path
          d="
            M 30 25
            H 72
            L 62 37
            H 44
            V 46
            H 65
            L 55 57
            H 44
            V 75
            H 30
            Z
          "
          fill="url(#fid-f-grad)"
        />

        {/* High-Tech Substrate Inset Track (Cyan Core) */}
        <path
          d="
            M 34 29
            H 66
            L 60 35
            H 40
            V 50
            H 59
            L 53 55
            H 40
            V 71
            H 34
            Z
          "
          fill="#00e5ff"
          opacity="0.35"
        />

        {/* Precision Substrate Strata Accent Slice */}
        <line x1="44" y1="37" x2="44" y2="75" stroke="#00e5ff" strokeWidth="1.5" opacity="0.6" />
        <rect x="67" y="25" width="4" height="4" fill="#00e5ff" opacity="0.9" />
      </g>
    </svg>
  );
}
