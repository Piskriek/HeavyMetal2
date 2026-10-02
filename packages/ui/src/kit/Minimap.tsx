import type { CSSProperties, ReactElement } from 'react';

export interface Bounds {
  minX: number;
  minZ: number;
  w: number;
  h: number;
}

export interface MinimapRacer {
  id: string;
  x: number;
  z: number;
  color: string;
  me?: boolean;
}

export interface MinimapProps {
  track: readonly (readonly [number, number])[];
  racers: readonly MinimapRacer[];
  size?: number;
}

export function fitBounds(points: readonly (readonly [number, number])[], pad: number): Bounds {
  if (points.length === 0) return { minX: 0, minZ: 0, w: 1, h: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    const [x, z] = point;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const w = maxX - minX;
  const h = maxZ - minZ;
  const side = Math.max(w, h);
  const grow = (side > 0 ? side : 1) * pad;
  return { minX: minX - grow, minZ: minZ - grow, w: w + grow * 2, h: h + grow * 2 };
}

const shell: CSSProperties = {
  borderRadius: 14,
  background: 'rgba(12,16,21,0.72)',
  border: '1px solid var(--hm-line, #26303b)',
};

export function Minimap(props: MinimapProps): ReactElement {
  const size = props.size ?? 160;
  const bounds = fitBounds(props.track, 0.08);
  const span = Math.max(bounds.w, bounds.h);
  const track = props.track.map(([x, z]) => `${x} ${z}`).join(' L ');
  const d = track === '' ? '' : `M ${track} Z`;
  const racers = [...props.racers].sort((a, b) => Number(a.me === true) - Number(b.me === true));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${bounds.minX} ${bounds.minZ} ${bounds.w} ${bounds.h}`}
      data-kit="minimap"
      style={shell}
    >
      <rect
        x={bounds.minX}
        y={bounds.minZ}
        width={bounds.w}
        height={bounds.h}
        rx={span * 0.05}
        fill="rgba(12,16,21,0.55)"
      />
      <path
        data-minimap="track"
        d={d}
        fill="none"
        stroke="var(--hm-text, #dde6ee)"
        strokeWidth={span * 0.035}
        strokeLinejoin="round"
      />
      {racers.map((racer) => (
        <circle
          key={racer.id}
          data-racer={racer.id}
          cx={racer.x}
          cy={racer.z}
          r={racer.me === true ? span * 0.075 : span * 0.045}
          fill={racer.color}
          stroke={racer.me === true ? 'var(--hm-accent, #ffd24a)' : 'rgba(0,0,0,0.55)'}
          strokeWidth={racer.me === true ? span * 0.02 : span * 0.012}
        />
      ))}
    </svg>
  );
}
