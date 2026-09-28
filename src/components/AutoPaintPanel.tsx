/**
 * AutoPaint — the panel behind the easy paint buttons.
 *
 * One row of presets (asphalt highway, rally stage, stadium circuit, mine works, dirt & wear only) for
 * the "just dress the road" case, and a single-rule mode for when you want control: pick a rule, its
 * sliders and checkboxes appear from the rule's own parameter schema, pick a stretch (whole road · this
 * stage · around the camera), and the coverage bar shows what the pass *would* do before you commit —
 * the preview runs the same code on a scratch copy of the mask, so the numbers are honest, not estimated.
 *
 * Every pass is one undo step and a recorded job, so a paint can be re-run after the road changes, and
 * "Clear road paint" is never destructive: undo brings the passes back.
 *
 * It drives any `AutoPaint` runner: the island road's (Island panel, drawn by the terrain) or a course's
 * road ribbon (`RoadSurfacePaint.auto`). Road lines are off by default; the switch only shows where the
 * lines can be drawn (`linesAvailable`), which is the road ribbon, not the island terrain.
 */
import { useEffect, useMemo, useState } from 'react';
import { Paintbrush, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { PAINT_PRESETS } from '../game/surface/paint-rules';
import { AutoPaint, type PaintSpan } from '../game/surface/auto-paint';
import { SURFACE_TABLE, surfaceDefinition } from '../game/surface/surface-table';
import type { TrackStageId } from '../game/track-space';

type SpanChoice = 'track' | 'stage' | 'camera';

interface Props {
  auto: AutoPaint;
  /** Optional: where the camera is along the road, for the "this stage" and "around the camera" stretches. */
  locate?: () => { s: number; stage: TrackStageId } | null;
  /** Runs after a pass, for owners that save by hand (the island saves through its runner). */
  onPainted?: () => void;
  /** Show the Road lines switch (only where lane lines can be drawn). */
  linesAvailable?: boolean;
  /** Surfaces offered in the rule's surface pickers (default: all of them). */
  surfaces?: readonly number[];
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label title={hint} className="grid grid-cols-[96px_1fr] items-center gap-2 text-[11px] text-zinc-400"><span className="truncate">{label}</span>{children}</label>;
}

export function AutoPaintPanel({ auto, locate, onPainted, linesAvailable = false, surfaces }: Props) {
  const [ruleId, setRuleId] = useState('carriageway');
  const [spanChoice, setSpanChoice] = useState<SpanChoice>('track');
  const [stored, setStored] = useState<Record<string, Record<string, number>>>({});
  const [version, bump] = useState(0);

  useEffect(() => auto.onChange(() => bump((n) => n + 1)), [auto]);

  // Road lines are opt-in: the Markings rule only appears once they are switched on.
  const rules = auto.rules().filter((r) => auto.lines || r.id !== 'markings');
  const rule = rules.find((r) => r.id === ruleId) ?? rules[0];
  const params = { ...defaultsOf(rule), ...stored[rule.id] };
  const here = spanChoice === 'track' ? null : locate?.() ?? null;
  const span: PaintSpan = !here
    ? { s0: 0, s1: auto.field.length }
    : spanChoice === 'camera' ? AutoPaint.windowAround(here.s, 4000, auto.field.length) : auto.spanForStage(here.stage);

  /** The preview is the real code on a scratch mask, so the count cannot lie about the click. */
  const preview = useMemo(
    () => auto.runRule(rule, params, span, { preview: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auto, rule.id, JSON.stringify(params), span.s0, span.s1, version],
  );
  const stats = useMemo(() => auto.stats(), [auto, version]);
  const painted = stats.reduce((n, c) => n + c.texels, 0);
  const done = () => onPainted?.();
  const setParam = (key: string, value: number) =>
    setStored((all) => ({ ...all, [rule.id]: { ...defaultsOf(rule), ...all[rule.id], [key]: value } }));
  const offered = SURFACE_TABLE.filter((s) => !surfaces || surfaces.includes(s.id));
  const button = 'flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:cursor-default disabled:opacity-40';

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1">
        {PAINT_PRESETS.map((p) => (
          <button key={p.id} title={p.blurb} onClick={() => { auto.runPreset(p.id, span); done(); }}
            className="cursor-pointer rounded border border-zinc-700 px-1.5 py-1 text-left text-[11px] text-zinc-200 hover:border-amber-400 hover:text-amber-100">
            {p.name}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 border-t border-zinc-800 pt-2">
        <Row label="Rule">
          <select value={rule.id} onChange={(e) => setRuleId(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-xs text-zinc-200">
            {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Row>
        <p className="text-[10px] leading-snug text-zinc-500">{rule.blurb}</p>
        {rule.params.filter((spec) => auto.lines || spec.key !== 'markings').map((spec) => (
          <Row key={spec.key} label={spec.bool || spec.surface ? spec.label : `${spec.label} ${Number(params[spec.key]).toFixed(spec.step >= 1 ? 0 : 2)}`} hint={spec.hint}>
            {spec.surface ? (
              <select value={params[spec.key]} onChange={(e) => setParam(spec.key, Number(e.target.value))} className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-xs text-zinc-200">
                {offered.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : spec.bool ? (
              <input type="checkbox" checked={!!params[spec.key]} onChange={(e) => setParam(spec.key, e.target.checked ? 1 : 0)} className="h-3.5 w-3.5 accent-amber-500" />
            ) : (
              <input type="range" min={spec.min} max={spec.max} step={spec.step} value={params[spec.key]} onChange={(e) => setParam(spec.key, Number(e.target.value))} className="accent-amber-500" />
            )}
          </Row>
        ))}
        <Row label="Stretch">
          <select value={spanChoice} onChange={(e) => setSpanChoice(e.target.value as SpanChoice)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-xs text-zinc-200">
            <option value="track">Whole road</option>
            {locate && <option value="stage">This stage</option>}
            {locate && <option value="camera">Near the camera (8,000 units)</option>}
          </select>
        </Row>
        {linesAvailable && (
          <label className="flex items-center gap-2 text-[11px] text-zinc-400" title="Lane lines on the road. Off by default.">
            <input type="checkbox" checked={auto.lines} onChange={(e) => { auto.lines = e.target.checked; bump((n) => n + 1); }} className="h-3.5 w-3.5 accent-amber-500" />
            Road lines
          </label>
        )}
        <CoverageBar cover={preview.coverage} />
        <p className="text-[10px] text-zinc-500">
          {preview.rows ? `This pass paints ${(preview.rows * auto.field.step).toLocaleString()} of ${Math.round(span.s1 - span.s0).toLocaleString()} units of road.` : 'This pass would paint nothing here.'}
        </p>
        <button onClick={() => { auto.runRule(rule, params, span); done(); }}
          className="flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-amber-500/60 bg-amber-950/40 py-1 text-[11px] text-amber-200 hover:border-amber-400">
          <Paintbrush size={12} />Paint {rule.name.toLowerCase()}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <button className={button} disabled={!auto.canUndo()} onClick={() => { auto.undo(); done(); }}><Undo2 size={12} />Undo</button>
        <button className={button} disabled={!auto.jobs.length} title="Paint every recorded pass again (after the road has changed)" onClick={() => { auto.replay(); done(); }}><RefreshCw size={12} />Re-run</button>
        <button className={`${button} hover:border-red-500`} disabled={!painted && !auto.jobs.length} onClick={() => { if (confirm('Take all auto paint off this road? Undo brings it back.')) { auto.resetToFactory(); done(); } }}><Trash2 size={12} />Clear</button>
      </div>
      <p className="text-[10px] leading-snug text-zinc-500">
        {auto.jobs.length ? `${auto.jobs.length} pass${auto.jobs.length === 1 ? '' : 'es'} on this road. ` : 'No passes yet. '}
        Each pass is one undo step and is saved with the road, so Re-run repaints it after the road changes.
      </p>
    </div>
  );
}

function defaultsOf(rule: { params: readonly { key: string; default: number }[] }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of rule.params) out[spec.key] = spec.default;
  return out;
}

function CoverageBar({ cover }: { cover: { id: number; name: string; texels: number; share: number }[] }) {
  const total = Math.max(1, cover.reduce((n, c) => n + c.texels, 0));
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-sm border border-zinc-700 bg-zinc-950">
        {cover.map((c) => (
          <div key={c.id} title={`${c.name}: ${Math.round(c.share * 100)}%`} style={{ width: `${(c.texels / total) * 100}%`, background: surfaceDefinition(c.id).swatch }} />
        ))}
      </div>
      {cover.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-zinc-500">
          {cover.slice(0, 5).map((c) => <span key={c.id}>{c.name} {Math.round((c.texels / total) * 100)}%</span>)}
        </div>
      )}
    </div>
  );
}

export default AutoPaintPanel;
