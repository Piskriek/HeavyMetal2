import { useId, type ReactElement } from 'react';

/**
 * TICKET-02: engraved, tactile gauges in the molten orange/gold family.
 * - `arc`: circular 270° meter (loadout ratings) — WIRE-4: a painted face and needle sprite.
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

/* ───────────── The painted arc gauge (WIRE-4) ─────────────
   The face and the needle are hand-painted PNGs, not SVG strokes. Both sprites were measured off the
   finished art, and the numbers below are those measurements, so the needle turns about the hub the
   painter put at the bottom of its sprite and lands on the ticks the face prints:

   - ui-gauge-arc-face.png (256²) is drawn over the whole 120-unit viewBox; its dial centre is the
     image centre, i.e. (60, 60). Its 270° tick arc runs from the lower left (≈210°), over the top,
     to the lower right (≈150°), with the last third painted as the orange danger band — the same
     lower-left → top → lower-right sweep the cockpit's needleAngle() uses. The old SVG version
     started at 135° (lower right), which against this face would read backwards: 0 in the danger
     band, max in the middle of it. The start moves to 225° so the needle agrees with its own
     painted ticks; the sweep (270°, clockwise) is unchanged.
   - ui-gauge-needle.png (53×256) points straight up with its hub at (26, 230). It is scaled so the
     hub sits exactly on the dial centre and the blade tip stops 36 units out — as far as the old
     SVG needle reached — leaving the painted ticks clear of the blade. */

export const ARC_FACE_URL = '/art/ui/icons/ui-gauge-arc-face.png';
export const ARC_NEEDLE_URL = '/art/ui/icons/ui-gauge-needle.png';
/** The 120-unit viewBox the arc gauge is drawn in; its centre is the dial centre. */
export const ARC_VIEWBOX = 120;
/** Where the needle rests (lower left) and how far it sweeps (clockwise, over the top). */
export const ARC_START_DEG = 225;
export const ARC_SWEEP_DEG = 270;
/** The painted face, drawn over the whole viewBox. */
export const ARC_FACE_RECT = { x: 0, y: 0, w: ARC_VIEWBOX, h: ARC_VIEWBOX };
/** The needle sprite's hub centre, measured in its own pixels. */
export const ARC_NEEDLE_HUB = { x: 26, y: 230 };
/** The blade tip's row in the sprite (the top of the painted blade). */
export const ARC_NEEDLE_TIP_Y = 1;
/** How far the blade tip reaches from the dial centre, in viewBox units (the old needle reached 36). */
export const ARC_NEEDLE_TIP_RADIUS = 36;
const needleScale = ARC_NEEDLE_TIP_RADIUS / (ARC_NEEDLE_HUB.y - ARC_NEEDLE_TIP_Y);
const NEEDLE_SPRITE_W = 53;
const NEEDLE_SPRITE_H = 256;
/** The drawn needle: hub on (60, 60), tip 36 units up, in the 120-unit viewBox. */
export const ARC_NEEDLE_RECT = {
  x: ARC_VIEWBOX / 2 - ARC_NEEDLE_HUB.x * needleScale,
  y: ARC_VIEWBOX / 2 - ARC_NEEDLE_HUB.y * needleScale,
  w: NEEDLE_SPRITE_W * needleScale,
  h: NEEDLE_SPRITE_H * needleScale,
};

/** The arc gauge's needle angle: 0 rests at the lower left, the max lands at the end of the painted
 *  danger band, over the same 270° sweep (angles clockwise from 12 o'clock, as the CSS rotation). */
export function arcNeedleAngle(value: number, max?: number): number {
  const fraction = clamp(value / (max ?? 10), 0, 1);
  return ARC_START_DEG + fraction * ARC_SWEEP_DEG;
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

function ArcGauge({ value, max, label, title, size = 106 }: BlizzardGaugeProps) {
  const needleDeg = arcNeedleAngle(value, max);
  const centre = ARC_VIEWBOX / 2;
  return (
    <figure className="blizzard-gauge" title={title}>
      <svg viewBox={`0 0 ${ARC_VIEWBOX} ${ARC_VIEWBOX}`} width={size} height={size} role="meter" aria-valuemin={0} aria-valuemax={max ?? 10} aria-valuenow={value} aria-label={label ?? title}>
        {/* The painted face carries its own brass bezel, ticks and orange danger band. */}
        <image href={ARC_FACE_URL} x={ARC_FACE_RECT.x} y={ARC_FACE_RECT.y} width={ARC_FACE_RECT.w} height={ARC_FACE_RECT.h} />
        {/* The painted needle, turned about the hub the sprite paints at its bottom centre. */}
        <g className="gauge-needle arc-needle" style={{ transform: `rotate(${needleDeg}deg)` }}>
          <image href={ARC_NEEDLE_URL} x={ARC_NEEDLE_RECT.x} y={ARC_NEEDLE_RECT.y} width={ARC_NEEDLE_RECT.w} height={ARC_NEEDLE_RECT.h} />
        </g>
        <text x={centre} y={96} textAnchor="middle" className="gauge-value-text">
          {value}<tspan className="gauge-value-max"> / {max ?? 10}</tspan>
        </text>
      </svg>
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
  return (
    <>
      {/* Gradient defs are emitted once per gauge; ids are stable per component instance. */}
      <svg width="0" height="0" className="gauge-defs" aria-hidden="true" focusable="false">
        <defs>
          <MoltenGradient id={gradientIds.molten} />
          <MetalGradient id={gradientIds.metal} />
          <FaceGradient id={gradientIds.face} />
        </defs>
      </svg>
      {props.variant === 'dial' ? <DialGauge {...props} gradientIds={gradientIds} /> : <ArcGauge {...props} />}
    </>
  );
}
