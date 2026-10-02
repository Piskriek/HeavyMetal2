import { useEffect, useState, type ReactElement } from 'react';
import { SFX, type SfxId } from '@hm/audio';
import { poseAt, stickFigure, type AnimPreset } from '@hm/anim';
import { recolour, type AvatarLook } from '@hm/avatarlook';
import type { SpritePreset } from '@hm/buildkit';
import type { VoxelModel } from '@hm/voxel';
import { MODELS } from '@hm/voxelart';
import { NATURE_MODELS } from '@hm/voxelnature';
import { renderThumb } from '../avatar/thumbs';
import type { Preview } from './catalog';
import { iconByName } from './icons';

/**
 * Previews: every preset shows what it is instead of a word. Ground shows its blocks, things show a thumbnail rendered from the model,
 * lights show their sky, animations play as a little stick goblin, sounds show their shape, activities show their planet, looks show the
 * goblin wearing them.
 */
const THUMB = 96; // one size for every thumbnail: the shared offscreen renderer is rebuilt when the size changes

const modelCache = new Map<string, VoxelModel>();
export function voxelModelById(id: string): VoxelModel | null {
  const hit = modelCache.get(id);
  if (hit) return hit;
  const e = MODELS.find((m) => m.id === id) ?? NATURE_MODELS.find((m) => m.id === id);
  if (!e) return null;
  const m = e.build() as unknown as VoxelModel;
  modelCache.set(id, m);
  return m;
}

export function goblinWearing(look: AvatarLook): VoxelModel | null {
  const g = voxelModelById('goblin');
  return g ? { ...g, palette: recolour(g.palette as unknown as { name: string; color: [number, number, number] }[], look) as unknown as VoxelModel['palette'] } : null;
}

const thumb = (m: VoxelModel | null, yaw = 35): string => {
  if (!m) return '';
  try { return renderThumb(m, THUMB, yaw); } catch { return ''; }
};

/** A shared animation clock for every animated preview on screen (one requestAnimationFrame, not one per card). */
const tickers = new Set<(t: number) => void>();
let rafId = 0;
const loop = (now: number): void => { for (const f of tickers) f(now / 1000); rafId = tickers.size ? requestAnimationFrame(loop) : 0; };
function useClock(on: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const f = (s: number): void => setT(s);
    tickers.add(f);
    if (!rafId) rafId = requestAnimationFrame(loop);
    return () => { tickers.delete(f); };
  }, [on]);
  return t;
}

function AnimPreview({ anim, size }: { readonly anim: AnimPreset; readonly size: number }): ReactElement {
  const t = useClock(true);
  const span = anim.loop ? 1e9 : anim.duration + 0.5;
  const fig = stickFigure(poseAt(anim, anim.loop ? t : t % span));
  return (
    <svg viewBox="0 0 1 1" width={size} height={size} className="pv-anim" aria-hidden="true">
      <line x1="0.1" y1="0.92" x2="0.9" y2="0.92" className="ground" />
      {fig.segments.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className={s.bone} />)}
      <circle cx={fig.head.x} cy={fig.head.y} r={fig.head.r} />
    </svg>
  );
}

function SoundPreview({ id, size }: { readonly id: SfxId; readonly size: number }): ReactElement {
  const r = SFX[id];
  const total = Math.max(1, r.durationMs);
  const hue = (f: number): number => Math.round(220 - Math.min(1, Math.log2(Math.max(40, f) / 40) / 8) * 200);
  return (
    <svg viewBox="0 0 100 60" width={size} height={size * 0.6} className="pv-sound" aria-hidden="true">
      <line x1="0" y1="58" x2="100" y2="58" />
      {r.layers.map((l, i) => {
        const d = l.delayMs ?? 0;
        const x0 = (d / total) * 100, x1 = ((d + l.attackMs) / total) * 100, x2 = Math.min(100, ((d + l.attackMs + l.decayMs) / total) * 100);
        const top = 58 - Math.min(1, l.gain * 2.4) * 54;
        return <polygon key={i} points={`${x0},58 ${x1},${top} ${x2},58`} style={{ fill: `hsl(${hue(l.freq[0])} 70% 55% / .55)` }} />;
      })}
    </svg>
  );
}

/** A sprite burst, looping: bits fly out of the ground in their three colours, fall (or float) and fade. Same numbers as in the world. */
function SpritePreview({ s, size }: { readonly s: SpritePreset; readonly size: number }): ReactElement {
  const t = useClock(true);
  const life = s.lifeMs / 1000, period = life + 0.45, k = (t % period) / life;
  const n = Math.min(48, s.count);
  const dots: ReactElement[] = [];
  if (k <= 1) {
    for (let i = 0; i < n; i++) {
      const r1 = Math.sin(i * 12.9898) * 43758.5453, r2 = Math.sin(i * 78.233) * 12345.678;
      const u = r1 - Math.floor(r1), v = r2 - Math.floor(r2);
      const ang = -Math.PI / 2 + (u - 0.5) * Math.PI * s.spread;
      const sp = 0.55 + v * 0.45;
      const x = 0.5 + Math.cos(ang) * sp * k * 0.42;
      const y = 0.86 + Math.sin(ang) * sp * k * 0.62 + (s.gravity / Math.max(1, s.speed)) * k * k * 0.12;
      const r = Math.max(0.012, Math.min(0.06, s.size * 0.035)) * (1 - k * 0.6);
      dots.push(<circle key={i} cx={x} cy={y} r={r} style={{ fill: [s.colorA, s.colorB, s.colorC][i % 3], opacity: 1 - k * 0.7 }} />);
    }
  }
  return (
    <svg viewBox="0 0 1 1" width={size} height={size} className={`pv-sprite${s.glow ? ' glow' : ''}`} aria-hidden="true">
      <line x1="0.12" y1="0.88" x2="0.88" y2="0.88" className="ground" />
      {dots}
    </svg>
  );
}

function ShakePreview({ amp, size }: { readonly amp: number; readonly size: number }): ReactElement {
  const t = useClock(true);
  const w = Math.sin(t * 40) * Math.min(0.12, amp * 0.6) * Math.max(0, 1 - (t % 1.2) / 0.7);
  return (
    <svg viewBox="0 0 1 1" width={size} height={size} className="pv-shake" aria-hidden="true">
      <rect x={0.2 + w} y={0.28 + w * 0.6} width="0.6" height="0.44" />
      <line x1={0.32 + w} y1={0.5} x2={0.68 + w} y2={0.5} />
    </svg>
  );
}

export function PresetPreview({ p, size = 48 }: { readonly p: Preview; readonly size?: number }): ReactElement {
  switch (p.kind) {
    case 'icon': { const I = iconByName(p.icon); return <span className="pv-icon" style={{ width: size, height: size }}><I size={Math.round(size * 0.45)} strokeWidth={1.5} /></span>; }
    case 'swatch':
      return <span className="pv-swatch" style={{ width: size, height: size }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ background: p.colors[i % p.colors.length] }} />)}</span>;
    case 'model': { const src = thumb(voxelModelById(p.model)); return src ? <img className="pv-img" alt="" width={size} height={size} src={src} /> : <span className="pv-icon" style={{ width: size, height: size }} />; }
    case 'sky':
      return <span className="pv-sky" style={{ width: size, height: size, background: `linear-gradient(180deg, ${p.top} 0%, ${p.horizon} 62%, ${p.ground} 100%)` }}><b style={{ background: p.sun }} /></span>;
    case 'anim': return <AnimPreview anim={p.anim} size={size} />;
    case 'sound': return <SoundPreview id={p.id} size={size} />;
    case 'planet':
      return (
        <svg viewBox="0 0 40 40" width={size} height={size} className="pv-planet" aria-hidden="true">
          <circle cx="20" cy="20" r="11" style={{ fill: `hsl(${p.hue} 65% 58%)` }} />
          {p.ring ? <ellipse cx="20" cy="20" rx="18" ry="5" transform="rotate(-18 20 20)" style={{ fill: 'none', stroke: `hsl(${(p.hue + 40) % 360} 60% 45%)`, strokeWidth: 1.6 }} /> : null}
        </svg>
      );
    case 'sprite': return <SpritePreview s={p.sprite} size={size} />;
    case 'shake': return <ShakePreview amp={p.amp} size={size} />;
    case 'look': { const src = thumb(goblinWearing(p.look), 20); return src ? <img className="pv-img" alt="" width={size} height={size} src={src} /> : <span className="pv-icon" style={{ width: size, height: size }} />; }
  }
}
