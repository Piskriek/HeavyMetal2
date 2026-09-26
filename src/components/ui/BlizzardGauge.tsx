import { useId, type ReactElement } from 'react';

/**
 * TICKET-02: engraved, tactile gauges in the molten orange/gold family.
 * - `arc`: circular 270° meter with an embossed needle (loadout ratings).
 * - `dial`: tachometer-style speedometer with tick marks and a digital readout.
 * - `meter`: horizontal engraved progress meter (drill-down breakdowns).
 * Value changes animate smoothly via CSS transitions on dash-offset/rotation.
 */
export interface BlizzardGaugeProps {
  value: number;
  max?: number;
  label?: string;
  unit?: string;
  variant?: 'arc' | 'dial' | 'meter';
  size?: number;
  /** Dial-only override for the digital readout (defaults to the rounded value). */
  readout?: string | number;
  title?: string;
  className?: string;
}

const TAU = Math.PI * 2;
/** Gauge angles are measured clockwise from 12 o'clock. */
function point(center: number, radius: number, angleDeg: number) {
  const rad = (angleDeg / 360) * TAU;
  return { x: center + radius * Math.sin(rad), y: center - radius * Math.cos(rad) };
}
function arcPath(center: number, radius: number, startDeg: number, endDeg: number) {
  const start = point(center, radius, startDeg);
  const end = point(center, radius, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The painted arc needle uses the same 270° sweep as the original gauge. */
export function arcGaugeNeedleAngle(value: number, max = 10): number {
  const fraction = clamp(value / max, 0, 1);
  return 135 + fraction * 270;
}

/** Shared molten fill shared by every gauge variant. */
function MoltenGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#8a3d16" />
      <stop offset="38%" stopColor="#e07a2b" />
      <stop offset="72%" stopColor="#f2b34c" />
      <stop offset="100%" stopColor="#ffe49a" />
    </linearGradient>
  );
}
function MetalGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f4e3b6" />
      <stop offset="45%" stopColor="#b09055" />
      <stop offset="100%" stopColor="#5d4523" />
    </linearGradient>
  );
}
function FaceGradient({ id }: { id: string }) {
  return (
    <radialGradient id={id} cx="0.5" cy="0.38" r="0.75">
      <stop offset="0%" stopColor="#243323" />
      <stop offset="62%" stopColor="#14201a" />
      <stop offset="100%" stopColor="#0a120d" />
    </radialGradient>
  );
}

function ArcGauge({ value, max = 10, label, title, size = 106 }: BlizzardGaugeProps) {
  const needleDeg = arcGaugeNeedleAngle(value, max);
  return (
    <figure className="blizzard-gauge blizzard-arc-painted" title={title}>
      <div
        className="painted-arc-gauge"
        style={{ width: size, height: size }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label ?? title}
      >
        <img className="painted-arc-face" src="/art/ui/icons/ui-gauge-arc-face.png" alt="" draggable={false} />
        <img
          className="painted-arc-needle"
          src="/art/ui/icons/ui-gauge-needle.png"
          alt=""
          draggable={false}
          style={{ transform: `translate(-50%, -100%) rotate(${needleDeg}deg)` }}
        />
        <span className="painted-arc-readout" aria-hidden="true">
          {value}<small> / {max}</small>
        </span>
      </div>
      {label && <figcaption className="gauge-caption">{label}</figcaption>}
    </figure>
  );
}

function DialGauge({ value, max = 360, label, unit, readout, title, size = 132, gradientIds }: BlizzardGaugeProps & { gradientIds: { molten: string; metal: string; face: string } }) {
  const fraction = clamp(value / max, 0, 1);
  const needleDeg = 135 + fraction * 270;
  const center = 100;
  const majorTicks: ReactElement[] = [];
  const minorTicks: ReactElement[] = [];
  const labels: ReactElement[] = [];
  for (let mark = 0; mark <= max; mark += 20) {
    const angle = 135 + (mark / max) * 270;
    const major = mark % 80 === 0 || mark === max;
    const outer = point(center, 86, angle);
    const inner = point(center, major ? 76 : 80.5, angle);
    const tick = <line key={mark} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className={`dial-tick ${major ? 'major' : ''} ${mark >= max * 0.83 ? 'redline' : ''}`} />;
    (major ? majorTicks : minorTicks).push(tick);
    if (mark % 80 === 0 || mark === max) {
      const at = point(center, 66, angle);
      labels.push(<text key={`label-${mark}`} x={at.x} y={at.y + 3} textAnchor="middle" className="dial-number">{mark}</text>);
    }
  }
  const redlineStart = 135 + 0.83 * 270;
  return (
    <figure className="blizzard-gauge blizzard-dial" title={title}>
      <svg viewBox="0 0 200 200" width={size} height={size} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label ?? 'Speed'}>
        <circle cx={center} cy={center} r={96} className="gauge-bezel" />
        <circle cx={center} cy={center} r={91} fill={`url(#${gradientIds.face})`} className="gauge-face" />
        <path d={arcPath(center, 83.5, 135, 405)} className="gauge-track" />
        <path d={arcPath(center, 83.5, redlineStart, 405)} className="dial-redline" />
        <path d={arcPath(center, 83.5, 135, 405)} pathLength={100} className="gauge-value-arc" stroke={`url(#${gradientIds.molten})`} style={{ strokeDasharray: 100, strokeDashoffset: 100 - fraction * 100 }} />
        {minorTicks}{majorTicks}{labels}
        <g className="gauge-needle dial-needle" style={{ transform: `rotate(${needleDeg}deg)` }}>
          <line x1={center} y1={center + 14} x2={center} y2={26} stroke={`url(#${gradientIds.metal})`} strokeWidth={4.6} strokeLinecap="round" />
          <line x1={center} y1={center + 14} x2={center} y2={26} className="gauge-needle-glint" />
        </g>
        <circle cx={center} cy={center} r={11} className="gauge-cap" />
        <circle cx={center} cy={center} r={5} fill={`url(#${gradientIds.metal})`} />
      </svg>
      <div className="dial-readout" aria-hidden="true">
        <strong>{readout ?? Math.round(value)}</strong>
        {unit && <small>{unit}</small>}
      </div>
      {label && <figcaption className="gauge-caption dial-caption">{label}</figcaption>}
    </figure>
  );
}

function MeterBar({ value, max, label, title }: BlizzardGaugeProps) {
  const percent = clamp(value / (max ?? 10), 0, 1) * 100;
  return (
    <div className="blizzard-meter" title={title}>
      <div className="blizzard-meter-track" role="meter" aria-valuemin={0} aria-valuemax={max ?? 10} aria-valuenow={value} aria-label={label ?? title}>
        <span className="blizzard-meter-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function BlizzardGauge(props: BlizzardGaugeProps) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientIds = { molten: `molten-${id}`, metal: `metal-${id}`, face: `face-${id}` };
  if (props.variant === 'meter') return <MeterBar {...props} />;
  if (props.variant !== 'dial') return <ArcGauge {...props} />;
  return (
    <>
      {/* Gradient defs are emitted once per dial; ids are stable per component instance. */}
      <svg width="0" height="0" className="gauge-defs" aria-hidden="true" focusable="false">
        <defs>
          <MoltenGradient id={gradientIds.molten} />
          <MetalGradient id={gradientIds.metal} />
          <FaceGradient id={gradientIds.face} />
        </defs>
      </svg>
      <DialGauge {...props} gradientIds={gradientIds} />
    </>
  );
}
