// doodletheme.ts — goblin racing UI theme: white wall, marker doodles, spray paint, grunge.
// Pure, deterministic, dependency-free.
//
// CONTRAST POLICY (see textPairs):
//  - ink/wall, ink/bg, onAccent on accent/accent2/accent3, ok/wall, danger/wall: WCAG AA 4.5:1.
//  - dim/wall: the documented floor is 3:1 (AA large text), so custom themes may only use dim
//    for large text. All built-in themes still reach at least 4.5:1, so .hint at body size passes AA.

export interface Tokens {
  name: string; bg: string; wall: string; ink: string; dim: string;
  accent: string; accent2: string; accent3: string; ok: string; danger: string;
  line: string; onAccent: string; fontDisplay: string; fontBody: string; fontMono: string;
  radius: number; stroke: number; wobble: number; sprayBlur: number;
}

export type Mood = 'grin' | 'wink' | 'oops' | 'cool';
export const MOODS: readonly Mood[] = ['grin', 'wink', 'oops', 'cool'];

const HEX = /^#[0-9a-fA-F]{6}$/;
const COLOR_KEYS = ['bg', 'wall', 'ink', 'dim', 'accent', 'accent2', 'accent3', 'ok', 'danger', 'line', 'onAccent'] as const;
const FONT_KEYS = ['fontDisplay', 'fontBody', 'fontMono'] as const;

const MARKER = "'Permanent Marker', 'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', cursive";
const HAND = "'Patrick Hand', 'Nunito', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif";
const MONO = "'Share Tech Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const PLAIN = "'Atkinson Hyperlegible', 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export const WHITE_WALL: Tokens = {
  name: 'white-wall', bg: '#f7f5ef', wall: '#fffdf8', ink: '#141414', dim: '#5a5a5a',
  accent: '#b6f000', accent2: '#ff2e88', accent3: '#ff7a00', ok: '#1f7a35', danger: '#d0021b',
  line: '#141414', onAccent: '#141414', fontDisplay: MARKER, fontBody: HAND, fontMono: MONO,
  radius: 14, stroke: 3, wobble: 0.7, sprayBlur: 6,
};
export const NIGHT_WALL: Tokens = {
  name: 'night-wall', bg: '#1b1c1f', wall: '#26282c', ink: '#f4f1e8', dim: '#a9a9a9',
  accent: '#c6ff1a', accent2: '#ff4fa3', accent3: '#ff8c1a', ok: '#5be37d', danger: '#ff6b6b',
  line: '#f4f1e8', onAccent: '#141414', fontDisplay: MARKER, fontBody: HAND, fontMono: MONO,
  radius: 14, stroke: 3, wobble: 0.7, sprayBlur: 8,
};
export const HIGH_CONTRAST: Tokens = {
  name: 'high-contrast', bg: '#ffffff', wall: '#ffffff', ink: '#000000', dim: '#333333',
  accent: '#0033cc', accent2: '#b00060', accent3: '#6a00b0', ok: '#006b1f', danger: '#b00020',
  line: '#000000', onAccent: '#ffffff', fontDisplay: PLAIN, fontBody: PLAIN, fontMono: MONO,
  radius: 6, stroke: 3, wobble: 0, sprayBlur: 0,
};

export const THEMES: Tokens[] = [WHITE_WALL, NIGHT_WALL, HIGH_CONTRAST];
export const DEFAULT_THEME: Tokens = WHITE_WALL;
export function getTheme(name: string): Tokens {
  return THEMES.find((t) => t.name === name) ?? DEFAULT_THEME;
}

/* ---------------- colour maths ---------------- */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
/** WCAG 2.x contrast ratio for #rrggbb colours (NaN if either is not #rrggbb). */
export function contrast(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return NaN;
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function rgba(hex: string, a: number): string {
  const h = HEX.test(hex) ? hex : '#000000';
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export interface TextPair { label: string; fg: string; bg: string; min: number; note: string }
export function textPairs(t: Tokens): TextPair[] {
  const AA = 'WCAG AA normal text (4.5:1)';
  return [
    { label: 'ink on wall', fg: t.ink, bg: t.wall, min: 4.5, note: AA },
    { label: 'ink on bg', fg: t.ink, bg: t.bg, min: 4.5, note: AA },
    { label: 'onAccent on accent', fg: t.onAccent, bg: t.accent, min: 4.5, note: AA },
    { label: 'onAccent on accent2', fg: t.onAccent, bg: t.accent2, min: 4.5, note: AA },
    { label: 'onAccent on accent3', fg: t.onAccent, bg: t.accent3, min: 4.5, note: AA },
    { label: 'ok on wall', fg: t.ok, bg: t.wall, min: 4.5, note: AA },
    { label: 'danger on wall', fg: t.danger, bg: t.wall, min: 4.5, note: AA },
    { label: 'dim on wall', fg: t.dim, bg: t.wall, min: 3,
      note: 'WCAG AA large text (3:1) floor; built-in themes reach 4.5:1 so body-size hints pass too' },
  ];
}

/* ---------------- validation ---------------- */

function describe(v: unknown): string {
  return typeof v === 'string' ? JSON.stringify(v.slice(0, 40)) : typeof v;
}
function num(o: Record<string, unknown>, k: string, lo: number, hi: number, errors: string[], loExclusive = false): void {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${k} must be a finite number (got ${describe(v)})`); return; }
  if ((loExclusive ? v <= lo : v < lo) || v > hi) errors.push(`${k} must be ${loExclusive ? '>' : '>='} ${lo} and <= ${hi} (got ${v})`);
}

export function validateTokens(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) {
      return { ok: false, errors: [`tokens must be a plain object (got ${x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x})`] };
    }
    const o = x as Record<string, unknown>;
    if (typeof o['name'] !== 'string' || o['name'].trim() === '') errors.push('name must be a non-empty string');
    for (const k of COLOR_KEYS) {
      const v = o[k];
      if (typeof v !== 'string' || !HEX.test(v)) errors.push(`${k} must be a #rrggbb colour (got ${describe(v)})`);
    }
    for (const k of FONT_KEYS) {
      const v = o[k];
      if (typeof v !== 'string' || v.trim() === '') errors.push(`${k} must be a non-empty font stack`);
      else if (!v.includes(',')) errors.push(`${k} must list fallback fonts after the main font`);
      else if (/[<>;{}]/.test(v)) errors.push(`${k} contains characters not allowed in a font stack`);
    }
    num(o, 'radius', 0, 64, errors);
    num(o, 'stroke', 0, 16, errors, true);
    num(o, 'wobble', 0, 1, errors);
    num(o, 'sprayBlur', 0, 40, errors);
    if (errors.length === 0) {
      for (const p of textPairs(o as unknown as Tokens)) {
        const c = contrast(p.fg, p.bg);
        if (!(c >= p.min)) errors.push(`${p.label} contrast ${c.toFixed(2)}:1 is below ${p.min}:1 (${p.note})`);
      }
    }
  } catch (e) {
    errors.push(`tokens could not be read: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
  return { ok: errors.length === 0, errors };
}

/* ---------------- CSS ---------------- */

export function themeVars(t: Tokens): Record<string, string> {
  return {
    '--accent': t.accent, '--text': t.ink, '--dim': t.dim, '--panel': t.wall, '--line': t.line,
    '--hm-accent': t.accent, '--hm-text': t.ink, '--hm-dim': t.dim, '--hm-panel': t.wall,
    '--hm-line': t.line, '--hm-ok': t.ok, '--hm-danger': t.danger,
    '--wall': t.wall, '--bg': t.bg, '--ink': t.ink, '--accent2': t.accent2, '--accent3': t.accent3,
    '--on-accent': t.onAccent, '--ok': t.ok, '--danger': t.danger,
    '--radius': `${t.radius}px`, '--stroke': `${t.stroke}px`,
    '--wobble': String(t.wobble), '--spray-blur': `${t.sprayBlur}px`,
    '--font-display': t.fontDisplay, '--font-body': t.fontBody, '--font-mono': t.fontMono,
  };
}

export function themeCss(t: Tokens): string {
  const vars = Object.entries(themeVars(t)).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  const rough = t.wobble >= 0.15;
  const r1 = rough ? '255px 15px 225px 15px/15px 225px 15px 255px' : `${t.radius}px`;
  const r2 = rough ? '15px 225px 15px 255px/255px 15px 225px 15px' : `${t.radius}px`;
  const ink = t.ink;
  const sw = `${t.stroke}px`;
  const tilt = (0.8 + 2 * t.wobble).toFixed(1);
  const halo = (c: string, a: number, at: string, size: string): string =>
    `radial-gradient(circle at ${at}, ${rgba(c, a)} 0, ${rgba(c, a * 0.5)} ${size}, transparent calc(${size} * 2))`;
  return `:root {
${vars}
}
body, .doodle-wall {
  background-color: ${t.bg};
  background-image:
    radial-gradient(circle at 13% 21%, ${rgba(ink, 0.04)} 0 2px, transparent 3px),
    radial-gradient(circle at 71% 83%, ${rgba(ink, 0.035)} 0 1px, transparent 2px),
    repeating-linear-gradient(87deg, ${rgba(ink, 0.018)} 0 1px, transparent 1px 9px),
    repeating-linear-gradient(-3deg, ${rgba(ink, 0.012)} 0 1px, transparent 1px 13px),
    linear-gradient(180deg, transparent 60%, ${rgba(ink, 0.05)});
  color: ${ink};
  font-family: var(--font-body);
}
button {
  font: 600 1.05rem/1.15 var(--font-body);
  color: ${ink};
  background: ${t.wall};
  border: ${sw} solid ${ink};
  border-radius: ${r1};
  padding: 0.6em 1.15em;
  min-height: 44px;
  cursor: pointer;
  box-shadow: 3px 3px 0 0 ${ink};
  transition: transform 0.15s ease;
}
button:hover { transform: translate(-1px, -1px) rotate(-0.6deg); }
button:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 ${ink}; }
button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
button.go {
  position: relative;
  font-family: var(--font-display);
  font-size: 1.3rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${t.onAccent};
  background-color: ${t.accent};
  background-image: radial-gradient(circle at 22% 28%, ${rgba('#ffffff', 0.35)}, transparent 45%);
  padding: 0.7em 1.7em;
  box-shadow: 5px 6px 0 0 ${ink};
}
button.go::after {
  content: '';
  position: absolute;
  inset: -7px;
  border: 2px solid ${ink};
  border-radius: ${r2};
  opacity: 0.55;
  pointer-events: none;
}
button.go:hover { animation: hm-wiggle 0.45s ease-in-out 1; }
@keyframes hm-wiggle {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(-${tilt}deg) scale(1.03); }
  50% { transform: rotate(${tilt}deg) scale(1.03); }
  75% { transform: rotate(-${(Number(tilt) / 2).toFixed(1)}deg) scale(1.02); }
  100% { transform: rotate(0deg); }
}
button.on {
  color: ${t.onAccent};
  background: ${t.accent2};
  box-shadow: inset 0 0 0 3px ${t.wall}, 3px 3px 0 0 ${ink};
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  padding: 0.25em 0.85em;
  border: 2px solid ${ink};
  border-radius: ${r2};
  background: ${halo(t.accent3, 0.22, '50% 50%', '30%')}, ${t.wall};
  color: ${ink};
  font: 600 0.95rem/1.3 var(--font-body);
}
.chip.on { background: ${t.accent}; color: ${t.onAccent}; }
input, select {
  font: 1rem/1.3 var(--font-body);
  color: ${ink};
  background-color: ${t.wall};
  border: ${sw} solid ${ink};
  border-radius: ${r2};
  padding: 0.5em 0.75em;
  min-height: 44px;
}
input::placeholder { color: ${t.dim}; }
select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 2.2em;
  background-image: linear-gradient(45deg, transparent 50%, ${ink} 50%), linear-gradient(135deg, ${ink} 50%, transparent 50%);
  background-position: calc(100% - 1.15em) 55%, calc(100% - 0.8em) 55%;
  background-size: 0.38em 0.38em;
  background-repeat: no-repeat;
}
input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  min-height: 32px;
  padding: 0;
  border: none;
  background: transparent;
}
input[type=range]::-webkit-slider-runnable-track {
  height: ${sw};
  background: ${ink};
  border-radius: 99px;
}
input[type=range]::-moz-range-track { height: ${sw}; background: ${ink}; border-radius: 99px; }
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  margin-top: calc((${sw} - 24px) / 2);
  border-radius: 50%;
  border: 2px solid ${ink};
  background: radial-gradient(circle at 38% 36%, ${rgba('#ffffff', 0.5)} 0 14%, ${t.accent2} 16% 62%, ${rgba(t.accent2, 0.6)} 72%);
  box-shadow: 0 0 0 4px ${rgba(t.accent2, 0.25)}, 0 0 ${t.sprayBlur * 2}px ${rgba(t.accent2, 0.55)};
}
input[type=range]::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid ${ink};
  background: ${t.accent2};
  box-shadow: 0 0 0 4px ${rgba(t.accent2, 0.25)}, 0 0 ${t.sprayBlur * 2}px ${rgba(t.accent2, 0.55)};
}
button:focus-visible, input:focus-visible, select:focus-visible, .chip:focus-visible, a:focus-visible,
input[type=range]:focus-visible {
  outline: 3px solid ${t.accent2};
  outline-offset: 3px;
}
section.rules {
  position: relative;
  color: ${ink};
  background-color: ${t.wall};
  background-image: ${halo(t.accent, 0.3, '100% 0', '18%')}, ${halo(t.accent2, 0.2, '0 100%', '15%')};
  border: ${sw} solid ${ink};
  border-radius: ${r1};
  padding: 1.25rem 1.5rem;
  box-shadow: 0 0 0 5px ${t.wall}, 0 0 0 7px ${rgba(ink, 0.5)};
}
.sound-list { list-style: none; padding: 0; margin: 0; }
.sound-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6em 0.25em;
  border-bottom: 2px dashed ${rgba(ink, 0.35)};
}
.sound-list li:last-child { border-bottom: none; }
.hint { color: ${t.dim}; font: 0.95rem/1.4 var(--font-body); }
.hint::before { content: '→'; margin-right: 0.4em; color: ${ink}; }
.bad {
  color: ${t.danger};
  font-weight: 700;
  background: ${rgba(t.danger, 0.07)};
  border-left: 4px solid ${t.danger};
  border-radius: ${r2};
  padding: 0.2em 0.6em;
}
h3 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: ${ink};
  letter-spacing: 0.02em;
  margin: 0 0 0.6em;
  text-decoration: underline dashed ${t.accent};
  text-decoration-thickness: ${sw};
  text-underline-offset: 0.28em;
}
h3.sub {
  font-family: var(--font-body);
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${t.dim};
  text-decoration-color: ${t.accent2};
  text-decoration-thickness: 2px;
}
.hist {
  font: 0.9rem/1.6em var(--font-mono);
  color: ${ink};
  background: repeating-linear-gradient(0deg, transparent 0 1.6em, ${rgba(ink, 0.08)} 1.6em calc(1.6em + 1px)), ${t.wall};
  border: 2px dashed ${ink};
  border-radius: ${r2};
  padding: 0.75em 1em;
}
.saved {
  display: inline-block;
  font-family: var(--font-display);
  color: ${t.onAccent};
  background: ${t.accent};
  border: 2px solid ${ink};
  border-radius: ${r2};
  padding: 0.15em 0.7em;
  transform: rotate(-2deg);
  box-shadow: 0 0 0 4px ${rgba(t.accent, 0.35)}, 0 0 ${t.sprayBlur * 2}px ${rgba(t.accent, 0.5)};
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  button:hover, button.go:hover { transform: none; }
}
`;
}

/* ---------------- SVG doodles ---------------- */

type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? '0' : String(r);
};
const safe = (c: string, fb: string): string => (HEX.test(c) ? c : fb);

interface Ctx { rng: Rng; ink: string; sw: number; jit: (amp: number) => number; blurId: string | null }
type Doodle = (c: Ctx, R: number, col: string) => string;

const splat: Doodle = (c, R, col) => {
  let s = c.blurId ? `<circle r="${f(R * 0.95)}" fill="${col}" opacity="0.35" filter="url(#${c.blurId})"/>` : '';
  s += `<circle r="${f(R * 0.5)}" fill="${col}"/>`;
  const n = 5 + Math.floor(c.rng() * 4);
  for (let i = 0; i < n; i++) {
    const a = c.rng() * Math.PI * 2;
    const d = R * (0.35 + c.rng() * 0.45);
    s += `<circle cx="${f(Math.cos(a) * d)}" cy="${f(Math.sin(a) * d)}" r="${f(R * (0.1 + c.rng() * 0.18))}" fill="${col}"/>`;
  }
  for (let i = 0; i < 4; i++) {
    const a = c.rng() * Math.PI * 2;
    const d = R * (0.95 + c.rng() * 0.35);
    s += `<circle cx="${f(Math.cos(a) * d)}" cy="${f(Math.sin(a) * d)}" r="${f(R * (0.04 + c.rng() * 0.04))}" fill="${col}"/>`;
  }
  return s;
};

const drip: Doodle = (c, R, col) => {
  let s = `<path d="M ${f(-R)} 0 C ${f(-R)} ${f(-R * 0.45 + c.jit(R))} ${f(R)} ${f(-R * 0.45 + c.jit(R))} ${f(R)} 0 C ${f(R * 0.5)} ${f(R * 0.22)} ${f(-R * 0.5)} ${f(R * 0.22)} ${f(-R)} 0 Z" fill="${col}"/>`;
  const k = 3 + Math.floor(c.rng() * 3);
  for (let i = 0; i < k; i++) {
    const x = -R * 0.7 + (1.4 * R * i) / (k - 1) + c.jit(R);
    const L = R * (0.5 + c.rng() * 1.2);
    s += `<path d="M ${f(x)} 0 L ${f(x + c.jit(R * 0.5))} ${f(L)}" stroke="${col}" stroke-width="${f(c.sw * 1.8)}"/>`;
    s += `<circle cx="${f(x)}" cy="${f(L)}" r="${f(c.sw * 1.4)}" fill="${col}"/>`;
  }
  return s;
};

const star: Doodle = (c, R, col) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = (i % 2 === 0 ? R : R * 0.45) + c.jit(R * 0.6);
    d += `${i === 0 ? 'M' : 'L'} ${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)} `;
  }
  return `<path d="${d}Z" fill="${col}" stroke="${c.ink}" stroke-width="${f(c.sw)}"/>` +
    `<path d="M ${f(R * 1.05)} ${f(-R * 0.9)} l ${f(R * 0.25)} ${f(-R * 0.2)} M ${f(R * 1.1)} ${f(-R * 0.55)} l ${f(R * 0.3)} 0" stroke="${c.ink}" stroke-width="${f(c.sw * 0.8)}"/>`;
};

const arrow: Doodle = (c, R, col) =>
  `<path d="M ${f(-R)} ${f(R * 0.35)} Q ${f(-R * 0.1)} ${f(-R * 0.7 + c.jit(R))} ${f(R * 0.8)} 0" stroke="${col}" stroke-width="${f(c.sw * 1.5)}"/>` +
  `<path d="M ${f(R * 0.42)} ${f(-R * 0.3)} L ${f(R * 0.82)} 0 L ${f(R * 0.36)} ${f(R * 0.24)}" stroke="${c.ink}" stroke-width="${f(c.sw)}"/>`;

const swirl: Doodle = (c, R, col) => {
  const N = 26;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const a = i * 0.5;
    const r = (R * i) / N + c.jit(R * 0.3);
    d += `${i === 0 ? 'M' : 'L'} ${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)} `;
  }
  return `<path d="${d.trim()}" stroke="${col}" stroke-width="${f(c.sw * 1.2)}"/>`;
};

const crown: Doodle = (c, R, col) => {
  const p: [number, number][] = [[-0.8, 0.4], [-0.8, -0.25], [-0.4, 0.1], [0, -0.6], [0.4, 0.1], [0.8, -0.25], [0.8, 0.4]];
  const d = p.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${f(x * R + c.jit(R))} ${f(y * R + c.jit(R))}`).join(' ');
  let s = `<path d="${d} Z" fill="${col}" stroke="${c.ink}" stroke-width="${f(c.sw)}"/>`;
  for (const [x, y] of [[-0.8, -0.25], [0, -0.6], [0.8, -0.25]] as const) {
    s += `<circle cx="${f(x * R)}" cy="${f(y * R - c.sw)}" r="${f(c.sw * 1.1)}" fill="${c.ink}"/>`;
  }
  return s;
};

const scribble: Doodle = (c, R, col) => {
  const loops = 6;
  const dx = (2 * R) / loops;
  let d = `M ${f(-R)} 0`;
  for (let i = 0; i < loops; i++) {
    d += ` Q ${f(-R + dx * i + dx / 2)} ${f((i % 2 === 0 ? -1 : 1) * R * 0.3 + c.jit(R))} ${f(-R + dx * (i + 1))} 0`;
  }
  return `<path d="${d}" stroke="${col}" stroke-width="${f(c.sw * 1.4)}"/>` +
    `<path d="M ${f(-R * 0.9)} ${f(R * 0.32)} L ${f(R * 0.95)} ${f(R * 0.28 + c.jit(R))}" stroke="${c.ink}" stroke-width="${f(c.sw * 0.8)}" stroke-dasharray="${f(c.sw * 3)} ${f(c.sw * 2)}"/>`;
};

function goblinParts(ink: string, mood: Mood, sw: number, skin: string): string {
  const W = '#ffffff';
  const S = `stroke="${ink}" stroke-width="${f(sw)}"`;
  const eye = (x: number, r: number, p: number): string =>
    `<circle cx="${x}" cy="50" r="${r}" fill="${W}" ${S}/><circle cx="${x + 1}" cy="51" r="${p}" fill="${ink}"/>`;
  const eyes: Record<Mood, string> = {
    grin: eye(40, 7, 3) + eye(60, 7, 3),
    wink: `<path d="M 33 51 Q 40 44 47 51" fill="none" ${S}/>` + eye(60, 7, 3),
    oops: eye(40, 9, 2) + eye(60, 9, 2),
    cool: `<path d="M 29 45 H 71 V 49 Q 67 58 58 56 Q 53 53 50 48 Q 47 53 42 56 Q 33 58 29 49 Z" fill="${ink}" ${S}/><path d="M 34 48 L 39 48" stroke="${W}" stroke-width="2"/>`,
  };
  const mouths: Record<Mood, string> = {
    grin: `<path d="M 36 65 Q 50 82 64 65 Z" fill="${W}" ${S}/><path d="M 45 66 L 47 71 L 49 66" fill="none" ${S}/>`,
    wink: `<path d="M 38 67 Q 52 78 63 63" fill="none" ${S}/><path d="M 52 72 L 54 76 L 56 71" fill="${W}" ${S}/>`,
    oops: `<ellipse cx="50" cy="71" rx="5" ry="6.5" fill="${ink}"/><path d="M 78 34 Q 82 42 78 45 Q 74 42 78 34 Z" fill="${W}" ${S}/>`,
    cool: `<path d="M 40 69 Q 52 74 63 65" fill="none" ${S}/>`,
  };
  return `<path d="M 30 46 Q 10 34 1 20 Q 8 46 27 61 Z" fill="${skin}" ${S}/>` +
    `<path d="M 70 46 Q 90 34 99 20 Q 92 46 73 61 Z" fill="${skin}" ${S}/>` +
    `<ellipse cx="50" cy="56" rx="27" ry="29" fill="${skin}" ${S}/>` +
    `<path d="M 23 46 Q 14 40 9 32 M 77 46 Q 86 40 91 32" fill="none" ${S}/>` +
    `<path d="M 44 28 Q 48 18 52 27 Q 55 20 58 29" fill="none" ${S}/>` +
    eyes[mood] + `<path d="M 50 55 Q 55 60 49 62" fill="none" ${S}/>` + mouths[mood];
}

const goblin: Doodle = (c, R, col) => {
  const k = R / 50;
  const mood = MOODS[Math.floor(c.rng() * MOODS.length)] ?? 'grin';
  return `<g transform="translate(${f(-R)},${f(-R)}) scale(${k.toFixed(3)})">${goblinParts(c.ink, mood, c.sw / k, col)}</g>`;
};

const KINDS: Doodle[] = [splat, drip, star, arrow, swirl, crown, goblin, scribble];

/** Deterministic doodle background. Element centres stay outside the middle 55% box. */
export function sprayDecor(seed: number, width: number, height: number, t: Tokens, density = 1): string {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const dens = Number.isFinite(density) && density >= 0 ? density : 1;
  const s32 = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  const rng = mulberry32(s32);
  const wob = Number.isFinite(t.wobble) ? Math.min(1, Math.max(0, t.wobble)) : 0.5;
  const blur = Number.isFinite(t.sprayBlur) && t.sprayBlur > 0 ? t.sprayBlur : 0;
  const blurId = blur > 0 ? `hmb${s32}` : null;
  const ctx: Ctx = {
    rng, ink: safe(t.ink, '#141414'), sw: Number.isFinite(t.stroke) && t.stroke > 0 ? t.stroke : 3,
    jit: (amp) => (rng() - 0.5) * 2 * wob * amp * 0.12, blurId,
  };
  const cols = [safe(t.accent, '#b6f000'), safe(t.accent2, '#ff2e88'), safe(t.accent3, '#ff7a00')];
  const count = Math.max(0, Math.min(120, Math.round((dens * w * h) / 30000)));
  const minDim = Math.min(w, h);
  const cx = w / 2, cy = h / 2, hx = w * 0.275, hy = h * 0.275;
  let body = '';
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, placed = false;
    for (let k = 0; k < 24 && !placed; k++) {
      x = rng() * w;
      y = rng() * h;
      placed = Math.abs(x - cx) >= hx || Math.abs(y - cy) >= hy;
    }
    if (!placed) x = rng() < 0.5 ? rng() * w * 0.2 : w - rng() * w * 0.2;
    const R = minDim * (0.03 + rng() * 0.035);
    const kind = KINDS[Math.floor(rng() * KINDS.length)] ?? splat;
    const col = cols[Math.floor(rng() * cols.length)] ?? cols[0] ?? '#b6f000';
    const rot = kind === drip ? 0 : Math.round((rng() - 0.5) * 60);
    body += `<g class="d" transform="translate(${f(x)},${f(y)}) rotate(${rot})" opacity="0.85">${kind(ctx, R, col)}</g>`;
  }
  const defs = blurId
    ? `<defs><filter id="${blurId}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(blur)}"/></filter></defs>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid slice">${defs}<g fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

export const SVG_URI_PREFIX = 'data:image/svg+xml;utf8,';
export function sprayDataUri(seed: number, width: number, height: number, t: Tokens, density?: number): string {
  const svg = sprayDecor(seed, width, height, t, density);
  return SVG_URI_PREFIX + encodeURIComponent(svg).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export function goblinFace(size: number, t: Tokens, mood: Mood): string {
  const s = Number.isFinite(size) && size > 0 ? size : 64;
  const m: Mood = MOODS.includes(mood) ? mood : 'grin';
  const stroke = Number.isFinite(t.stroke) && t.stroke > 0 ? t.stroke : 3;
  const sw = Math.min(8, Math.max(1.5, (stroke * 100) / s));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 108 108" width="${f(s)}" height="${f(s)}" role="img" aria-label="goblin ${m}"><title>Goblin ${m}</title><g stroke-linecap="round" stroke-linejoin="round">${goblinParts(safe(t.ink, '#141414'), m, sw, safe(t.accent, '#b6f000'))}</g></svg>`;
}