import type { ReactElement, SVGProps } from 'react';

/**
 * The FIDELITY architectural brand mark: a tactile, zero-glow precision reticle and
 * monogram 'F' bound directly to Rung-1 `UiTokens` (`--ui-ink`, `--ui-accent`, `--ui-line`).
 */
export function FidelityLogo(props: SVGProps<SVGSVGElement> & { readonly size?: number; readonly glow?: boolean }): ReactElement {
  const { size = 44, glow: _glow, className = '', ...rest } = props;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`fidelity-logo ${className}`.trim()}
      {...rest}
    >
      {/* Outer Architectural Bezel */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="4"
        fill="var(--ui-inset, #2a2c27)"
        stroke="var(--ui-line, #4c4f47)"
        strokeWidth="2"
      />

      {/* Precision Calibration Reticle */}
      <circle
        cx="50"
        cy="50"
        r="34"
        stroke="var(--ui-line, #4c4f47)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* Cardinal Calibration Notches */}
      <line x1="50" y1="6" x2="50" y2="14" stroke="var(--ui-accent, #d96b43)" strokeWidth="2.5" />
      <line x1="50" y1="86" x2="50" y2="94" stroke="var(--ui-accent, #d96b43)" strokeWidth="2.5" />
      <line x1="6" y1="50" x2="14" y2="50" stroke="var(--ui-accent, #d96b43)" strokeWidth="2.5" />
      <line x1="86" y1="50" x2="94" y2="50" stroke="var(--ui-accent, #d96b43)" strokeWidth="2.5" />

      {/* Solid Architectural Monogram 'F' */}
      <path
        d="M 32 26 H 70 V 37 H 45 V 46 H 64 V 57 H 45 V 74 H 32 Z"
        fill="var(--ui-ink, #f2f0e8)"
      />

      {/* Tactile Index Pip (Braun / Teenage Engineering Accent) */}
      <rect x="62" y="26" width="8" height="11" fill="var(--ui-accent, #d96b43)" />
    </svg>
  );
}
