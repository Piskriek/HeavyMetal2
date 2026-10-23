import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  emptyField,
  apply,
  revert,
  encodeField,
  decodeField,
  type Field,
  type Rules,
  type BrushKind,
  type Patch,
} from './index';

/* ------------------------------ game setup ------------------------------ */

const SIZE = 96;
const CELL = 1; // metres
const EXTENT = SIZE * CELL;
const PX = 6; // screen pixels per cell
const RULES: Rules = { maxDepth: 6, maxHeight: 4, orePerCubicMetre: 0.5, ratePerSecond: 3 };
const START_ORE = 220;

/** The base terrain the game computes: gentle deterministic dunes. */
const base = (x: number, z: number): number =>
  10 +
  2.1 * Math.sin(x * 0.052 + 1.7) +
  1.6 * Math.cos(z * 0.047 - 0.6) +
  1.1 * Math.sin((x + z) * 0.083 + 0.4) +
  0.5 * Math.sin(x * 0.19) * Math.cos(z * 0.17);

/** Protected cells: the gate pad and the extractor machine never change. */
const PAD = { x0: 6, z0: 64, x1: 24, z1: 86 }; // cells
const MACHINE = { cx: 76, cz: 18, r: 7 }; // cells
const isProtected = (i: number): boolean => {
  const x = i % SIZE;
  const z = Math.floor(i / SIZE);
  if (x >= PAD.x0 && x <= PAD.x1 && z >= PAD.z0 && z <= PAD.z1) return true;
  const dx = x - MACHINE.cx;
  const dz = z - MACHINE.cz;
  return dx * dx + dz * dz <= MACHINE.r * MACHINE.r;
};

interface PresetDef {
  readonly id: string;
  readonly label: string;
  readonly rgb: readonly [number, number, number];
}
const PRESETS: readonly PresetDef[] = [
  { id: 'mud', label: 'Mud', rgb: [122, 85, 58] },
  { id: 'moss', label: 'Moss', rgb: [96, 148, 72] },
  { id: 'road', label: 'Road', rgb: [142, 140, 148] },
  { id: 'ash', label: 'Ash', rgb: [68, 64, 72] },
];
const presetRGB = new Map<string, readonly [number, number, number]>(PRESETS.map((p) => [p.id, p.rgb]));

const TOOLS: readonly { kind: BrushKind; label: string; icon: string; hint: string }[] = [
  { kind: 'carve', label: 'Carve', icon: '⛏', hint: 'dig the ground away — the rock becomes ore' },
  { kind: 'raise', label: 'Raise', icon: '⛰', hint: 'build ground up out of ore' },
  { kind: 'smooth', label: 'Smooth', icon: '〰', hint: 'even out bumps; volume is conserved' },
  { kind: 'flatten', label: 'Flatten', icon: '▭', hint: 'move heights toward the target level' },
  { kind: 'paint', label: 'Paint', icon: '🖌', hint: 'lay the cartridge preset onto the ground' },
  { kind: 'erase', label: 'Erase', icon: '◌', hint: 'take the paint off' },
];

/* ------------------------------- rendering ------------------------------ */

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function renderField(
  ctx: CanvasRenderingContext2D,
  off: CanvasRenderingContext2D,
  field: Field,
  cursor: { x: number; z: number; r: number } | null
): void {
  const img = off.createImageData(SIZE, SIZE);
  const d = img.data;
  const h = (x: number, z: number): number => {
    const cx = Math.min(SIZE - 1, Math.max(0, x));
    const cz = Math.min(SIZE - 1, Math.max(0, z));
    return base((cx + 0.5) * CELL, (cz + 0.5) * CELL) + (field.delta[cz * SIZE + cx] ?? 0);
  };
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      const i = z * SIZE + x;
      const height = h(x, z);
      const delta = field.delta[i] ?? 0;
      // elevation ramp: deep teal rock -> dusty ground -> pale ridge
      const t = Math.min(1, Math.max(0, (height - 4) / 12));
      let r: number, g: number, b: number;
      if (t < 0.5) {
        const u = t / 0.5;
        r = lerp(38, 128, u); g = lerp(66, 108, u); b = lerp(84, 84, u);
      } else {
        const u = (t - 0.5) / 0.5;
        r = lerp(128, 212, u); g = lerp(108, 196, u); b = lerp(84, 168, u);
      }
      if (delta < -0.05) { // carved: raw rock
        const u = Math.min(1, -delta / RULES.maxDepth);
        r = lerp(r, 70, u * 0.7); g = lerp(g, 58, u * 0.7); b = lerp(b, 66, u * 0.7);
      }
      // paint tint
      const pid = field.paint[i] ?? '';
      const amt = field.amount[i] ?? 0;
      const rgb = presetRGB.get(pid);
      if (rgb !== undefined && amt > 0) {
        r = lerp(r, rgb[0], amt * 0.85);
        g = lerp(g, rgb[1], amt * 0.85);
        b = lerp(b, rgb[2], amt * 0.85);
      }
      // hillshade: light from the north-west
      const sx = h(x + 1, z) - h(x - 1, z);
      const sz = h(x, z + 1) - h(x, z - 1);
      const shade = Math.min(1.45, Math.max(0.35, 1 - sx * 0.55 - sz * 0.45));
      r *= shade; g *= shade; b *= shade;
      // protected pad overlay
      if (isProtected(i)) {
        const stripe = ((x + z) & 7) < 2 ? 1 : 0;
        r = lerp(r, 232, 0.28 + stripe * 0.2);
        g = lerp(g, 176, 0.28 + stripe * 0.2);
        b = lerp(b, 60, 0.22 + stripe * 0.18);
      }
      const o = i * 4;
      d[o] = Math.min(255, r); d[o + 1] = Math.min(255, g); d[o + 2] = Math.min(255, b); d[o + 3] = 255;
    }
  }
  off.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, SIZE * PX, SIZE * PX);
  ctx.drawImage(off.canvas, 0, 0, SIZE, SIZE, 0, 0, SIZE * PX, SIZE * PX);

  if (cursor !== null) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc((cursor.x / CELL) * PX, (cursor.z / CELL) * PX, (cursor.r / CELL) * PX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect((cursor.x / CELL) * PX - 1.5, (cursor.z / CELL) * PX - 1.5, 3, 3);
  }
}

/* --------------------------------- app ---------------------------------- */

interface Stroke {
  readonly patches: Patch[];
  oreDelta: number;
}

export default function App(): JSX.Element {
  const [tool, setTool] = useState<BrushKind>('carve');
  const [preset, setPreset] = useState<string>('mud');
  const [radius, setRadius] = useState(9);
  const [strength, setStrength] = useState(0.8);
  const [level, setLevel] = useState(10);
  const [ore, setOre] = useState(START_ORE);
  const [undoCount, setUndoCount] = useState(0);
  const [share, setShare] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const fieldRef = useRef<Field>(emptyField(SIZE, CELL));
  const oreRef = useRef(START_ORE);
  const undoRef = useRef<Stroke[]>([]);
  const strokeRef = useRef<Stroke | null>(null);
  const cursorRef = useRef<{ x: number; z: number; r: number } | null>(null);
  const lastT = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offRef = useRef<CanvasRenderingContext2D | null>(null);
  const toolRef = useRef(tool);
  const presetRef = useRef(preset);
  const radiusRef = useRef(radius);
  const strengthRef = useRef(strength);
  const levelRef = useRef(level);
  toolRef.current = tool; presetRef.current = preset; radiusRef.current = radius;
  strengthRef.current = strength; levelRef.current = level;

  const draw = useCallback((): void => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    if (offRef.current === null) {
      const oc = document.createElement('canvas');
      oc.width = SIZE; oc.height = SIZE;
      offRef.current = oc.getContext('2d');
    }
    if (offRef.current !== null) renderField(ctx, offRef.current, fieldRef.current, cursorRef.current);
  }, []);

  useEffect(() => { draw(); }, [draw]);

  const stamp = useCallback((wx: number, wz: number, dt: number): void => {
    const kind = toolRef.current;
    try {
      const r = apply(
        fieldRef.current,
        base,
        {
          kind,
          x: wx,
          z: wz,
          radius: radiusRef.current,
          strength: strengthRef.current,
          dt,
          preset: kind === 'paint' ? presetRef.current : undefined,
          level: kind === 'flatten' ? levelRef.current : undefined,
        },
        RULES,
        oreRef.current,
        isProtected
      );
      if (r.changed.length === 0 && r.ore === 0) return;
      fieldRef.current = r.field;
      oreRef.current = Math.max(0, oreRef.current + r.ore);
      if (strokeRef.current !== null) {
        strokeRef.current.patches.push(r.undo);
        strokeRef.current.oreDelta += r.ore;
      }
      setOre(oreRef.current);
    } catch {
      /* invalid op (e.g. zero radius) — ignore in the preview */
    }
  }, []);

  const toWorld = useCallback((e: { clientX: number; clientY: number }): { x: number; z: number } => {
    const canvas = canvasRef.current;
    if (canvas === null) return { x: 0, z: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * EXTENT,
      z: ((e.clientY - rect.top) / rect.height) * EXTENT,
    };
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeRef.current = { patches: [], oreDelta: 0 };
    lastT.current = performance.now();
    const { x, z } = toWorld(e);
    cursorRef.current = { x, z, r: radiusRef.current };
    stamp(x, z, 1 / 60);
    draw();
  }, [toWorld, stamp, draw]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const { x, z } = toWorld(e);
    cursorRef.current = { x, z, r: radiusRef.current };
    if (strokeRef.current !== null) {
      const now = performance.now();
      const dt = Math.min(0.08, Math.max(0.001, (now - lastT.current) / 1000));
      lastT.current = now;
      stamp(x, z, dt);
    }
    draw();
  }, [toWorld, stamp, draw]);

  const endStroke = useCallback((): void => {
    const s = strokeRef.current;
    strokeRef.current = null;
    if (s !== null && s.patches.length > 0) {
      undoRef.current.push(s);
      if (undoRef.current.length > 64) undoRef.current.shift();
      setUndoCount(undoRef.current.length);
    }
    draw();
  }, [draw]);

  const onPointerLeave = useCallback((): void => {
    cursorRef.current = null;
    draw();
  }, [draw]);

  const undo = useCallback((): void => {
    const s = undoRef.current.pop();
    if (s === undefined) return;
    let f = fieldRef.current;
    for (let i = s.patches.length - 1; i >= 0; i--) f = revert(f, s.patches[i]!);
    fieldRef.current = f;
    oreRef.current = Math.max(0, oreRef.current - s.oreDelta);
    setOre(oreRef.current);
    setUndoCount(undoRef.current.length);
    draw();
  }, [draw]);

  const reset = useCallback((): void => {
    fieldRef.current = emptyField(SIZE, CELL);
    oreRef.current = START_ORE;
    undoRef.current = [];
    setOre(START_ORE);
    setUndoCount(0);
    setShare('');
    setNote(null);
    draw();
  }, [draw]);

  const exportCode = useCallback((): void => {
    const code = encodeField(fieldRef.current);
    setShare(code);
    setNote(`exported ${code.length} chars`);
    void navigator.clipboard?.writeText(code).catch(() => undefined);
  }, []);

  const importCode = useCallback((): void => {
    const f = decodeField(share.trim());
    if (f === null || f.size !== SIZE) {
      setNote('that code is junk — refused');
      return;
    }
    fieldRef.current = f;
    undoRef.current = [];
    setUndoCount(0);
    setNote('field imported');
    draw();
  }, [share, draw]);

  const toolHint = useMemo(() => TOOLS.find((t) => t.kind === tool)?.hint ?? '', [tool]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-300">@hm/terrainbrush</h1>
            <p className="text-xs text-zinc-400">extraction-beam preview · {SIZE}×{SIZE} cells · {CELL} m cells</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2">
            <span className="text-lg">⬙</span>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-300/70">ore</div>
              <div className="tabular-nums text-lg font-bold text-amber-300">{ore.toFixed(1)} t</div>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row">
          {/* controls */}
          <aside className="w-full shrink-0 space-y-5 lg:w-64">
            <section>
              <h2 className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">beam mode</h2>
              <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2">
                {TOOLS.map((t) => (
                  <button
                    key={t.kind}
                    onClick={() => setTool(t.kind)}
                    className={`rounded-md border px-2 py-2 text-xs transition ${
                      tool === t.kind
                        ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="mr-1">{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 min-h-8 text-[11px] leading-snug text-zinc-500">{toolHint}</p>
            </section>

            {tool === 'paint' && (
              <section>
                <h2 className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">cartridge</h2>
                <div className="flex gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      title={p.label}
                      className={`flex-1 rounded-md border px-1 py-2 text-[10px] ${
                        preset === p.id ? 'border-white/80' : 'border-zinc-800 hover:border-zinc-600'
                      }`}
                      style={{ backgroundColor: `rgb(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]})` }}
                    >
                      <span className="rounded bg-black/40 px-1">{p.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tool === 'flatten' && (
              <section>
                <h2 className="mb-2 flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                  <span>target level</span><span className="text-zinc-300">{level.toFixed(1)} m</span>
                </h2>
                <input type="range" min={5} max={16} step={0.1} value={level}
                  onChange={(e) => setLevel(Number(e.target.value))} className="w-full accent-emerald-400" />
              </section>
            )}

            <section>
              <h2 className="mb-2 flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                <span>radius</span><span className="text-zinc-300">{radius.toFixed(0)} m</span>
              </h2>
              <input type="range" min={2} max={24} step={1} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-emerald-400" />
              <h2 className="mb-2 mt-3 flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                <span>strength</span><span className="text-zinc-300">{Math.round(strength * 100)}%</span>
              </h2>
              <input type="range" min={0.05} max={1} step={0.05} value={strength}
                onChange={(e) => setStrength(Number(e.target.value))} className="w-full accent-emerald-400" />
            </section>

            <section className="flex gap-2">
              <button onClick={undo} disabled={undoCount === 0}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs hover:border-zinc-500 disabled:opacity-40">
                ↩ Undo ({undoCount})
              </button>
              <button onClick={reset}
                className="flex-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 hover:border-rose-400">
                Reset plot
              </button>
            </section>

            <section>
              <h2 className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">share code (base64url)</h2>
              <textarea
                value={share}
                onChange={(e) => setShare(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder="export the field, or paste a code here…"
                className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 p-2 text-[10px] text-zinc-300 outline-none focus:border-emerald-500/50"
              />
              <div className="mt-1.5 flex gap-2">
                <button onClick={exportCode}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs hover:border-zinc-500">Export</button>
                <button onClick={importCode}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs hover:border-zinc-500">Import</button>
              </div>
              {note !== null && <p className="mt-1 text-[10px] text-emerald-400/80">{note}</p>}
            </section>
          </aside>

          {/* the plot */}
          <main className="min-w-0 flex-1">
            <div className="relative inline-block overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-black/60">
              <canvas
                ref={canvasRef}
                width={SIZE * PX}
                height={SIZE * PX}
                className="block h-auto w-full max-w-[576px] cursor-crosshair touch-none select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                onPointerLeave={onPointerLeave}
              />
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-2 py-1 text-[10px] text-zinc-300">
                drag to sculpt · hazard stripes are protected (gate pad &amp; extractor)
              </div>
            </div>
            <p className="mt-3 max-w-[576px] text-[11px] leading-relaxed text-zinc-500">
              Carving sells the dug rock as ore at {RULES.orePerCubicMetre} t/m³; raising buys it back at the
              same price and stops when the ore runs out. Smoothing conserves volume exactly. Flattening cuts
              and fills toward the target level. Every stroke is a pure <code className="text-zinc-400">apply()</code> on
              an immutable field, and Undo replays the returned patches through <code className="text-zinc-400">revert()</code>.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
