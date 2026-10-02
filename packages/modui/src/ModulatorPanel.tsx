import type { CSSProperties, ReactNode } from 'react';
import { CurveEditor } from './CurveEditor';
import { TimelineEditor } from './TimelineEditor';
import { SequenceEditor } from './SequenceEditor';
import { Sparkline } from './Sparkline';
import { C, Num, Row, Sel, Txt, btnStyle, inputStyle, labelStyle } from './fields';
import type { Keyframe, ModulatorDef, Pt, Range } from './types';

export const MOD_KINDS: readonly { kind: ModulatorDef['kind']; label: string }[] = [
  { kind: 'constant', label: 'Constant' },
  { kind: 'random', label: 'Randomizer' },
  { kind: 'noise', label: 'Noise' },
  { kind: 'lfo', label: 'LFO' },
  { kind: 'curve', label: 'Graph (curve)' },
  { kind: 'timeline', label: 'Timeline' },
  { kind: 'sequence', label: 'Step sequencer' },
  { kind: 'stream', label: 'Data stream' },
  { kind: 'expr', label: 'Expression' },
  { kind: 'combine', label: 'Combine' },
];

/** Sensible, valid defaults for every modulator kind. */
export function defaultModulator(kind: ModulatorDef['kind']): ModulatorDef {
  switch (kind) {
    case 'constant': return { kind: 'constant', value: 0.5 };
    case 'random': return { kind: 'random', seed: 1, rateHz: 2, mode: 'smooth', distribution: 'uniform', out: { min: 0, max: 1 } };
    case 'noise': return { kind: 'noise', seed: 1, freqHz: 1, octaves: 3, gain: 0.6, out: { min: 0, max: 1 } };
    case 'lfo': return { kind: 'lfo', wave: 'sine', freqHz: 1, phase: 0, width: 0.5, out: { min: 0, max: 1 } };
    case 'curve': return { kind: 'curve', points: [[0, 0], [0.5, 1], [1, 0]] as const, interpolation: 'linear', input: { source: 'time', loopMs: 2000 }, out: { min: 0, max: 1 } };
    case 'timeline': return { kind: 'timeline', durationMs: 2000, loop: 'loop', keys: [{ timeMs: 0, value: 0 }, { timeMs: 2000, value: 1 }] };
    case 'sequence': return { kind: 'sequence', steps: [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25], rateHz: 4, glideMs: 20, out: { min: 0, max: 1 } };
    case 'stream': return { kind: 'stream', path: 'global:speed', scale: 1, offset: 0, smoothMs: 60, clamp: { min: 0, max: 1 } };
    case 'expr': return { kind: 'expr', source: 't', fallback: 0 };
    case 'texture': return { kind: 'texture', textureId: 'tex:grain', u: defaultModulator('constant'), v: defaultModulator('constant'), out: { min: 0, max: 1 } };
    case 'combine': return { kind: 'combine', op: 'multiply', inputs: [defaultModulator('lfo'), defaultModulator('lfo')], mix: 0.5 };
    default: return { kind: 'constant', value: 0.5 };
  }
}

type Tier = 'play' | 'build' | 'pro';
const MAX_DEPTH = 2; // root + two nested levels = 3 levels of panels
const nestedStyle: CSSProperties = { border: `1px dashed ${C.line}`, borderRadius: 8, padding: 8, display: 'grid', gap: 8 };
const ZERO: Range = { min: 0, max: 1 };

function RangeFields(props: { range: Range; onMin: (v: number) => void; onMax: (v: number) => void }): ReactNode {
  return (
    <>
      <Num field="out.min" label="Out min" value={props.range.min} onChange={props.onMin} />
      <Num field="out.max" label="Out max" value={props.range.max} onChange={props.onMax} />
    </>
  );
}

function Fields(props: { def: ModulatorDef; onChange: (d: ModulatorDef) => void; tier: Tier; depth: number }): ReactNode {
  const { def, onChange, tier, depth } = props;
  const play = tier === 'play';
  switch (def.kind) {
    case 'constant':
      return <Num field="value" label="Value" value={def.value} onChange={(v) => onChange({ ...def, value: v })} />;
    case 'random':
      return (
        <Row>
          <Num field="rateHz" label="Rate Hz" value={def.rateHz} min={0} onChange={(v) => onChange({ ...def, rateHz: v })} />
          <Sel field="mode" label="Mode" value={def.mode} options={['hold', 'smooth']} onChange={(v) => onChange({ ...def, mode: v as 'hold' | 'smooth' })} />
          {play ? null : <Sel field="distribution" label="Distribution" value={def.distribution ?? 'uniform'} options={['uniform', 'gaussian']} onChange={(v) => onChange({ ...def, distribution: v as 'uniform' | 'gaussian' })} />}
          <RangeFields range={def.out} onMin={(v) => onChange({ ...def, out: { ...def.out, min: v } })} onMax={(v) => onChange({ ...def, out: { ...def.out, max: v } })} />
        </Row>
      );
    case 'noise':
      return (
        <Row>
          <Num field="freqHz" label="Freq Hz" value={def.freqHz} min={0} onChange={(v) => onChange({ ...def, freqHz: v })} />
          {play ? null : <Num field="octaves" label="Octaves" value={def.octaves ?? 3} step={1} min={1} max={8} onChange={(v) => onChange({ ...def, octaves: v })} />}
          {play ? null : <Num field="gain" label="Gain" value={def.gain ?? 0.6} onChange={(v) => onChange({ ...def, gain: v })} />}
          <RangeFields range={def.out} onMin={(v) => onChange({ ...def, out: { ...def.out, min: v } })} onMax={(v) => onChange({ ...def, out: { ...def.out, max: v } })} />
        </Row>
      );
    case 'lfo':
      return (
        <Row>
          <Sel field="wave" label="Wave" value={def.wave} options={['sine', 'triangle', 'saw', 'square']} onChange={(v) => onChange({ ...def, wave: v as typeof def.wave })} />
          <Num field="freqHz" label="Freq Hz" value={def.freqHz} min={0} onChange={(v) => onChange({ ...def, freqHz: v })} />
          {play ? null : <Num field="phase" label="Phase" value={def.phase ?? 0} min={0} max={1} onChange={(v) => onChange({ ...def, phase: v })} />}
          {!play && def.wave === 'square' ? <Num field="width" label="Width" value={def.width ?? 0.5} min={0} max={1} onChange={(v) => onChange({ ...def, width: v })} /> : null}
          <RangeFields range={def.out} onMin={(v) => onChange({ ...def, out: { ...def.out, min: v } })} onMax={(v) => onChange({ ...def, out: { ...def.out, max: v } })} />
        </Row>
      );
    case 'curve': {
      const inp = def.input;
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <CurveEditor points={def.points} interpolation={def.interpolation} onChange={(points: readonly Pt[]) => onChange({ ...def, points })} />
          <Row>
            <Sel field="interpolation" label="Interp" value={def.interpolation} options={['linear', 'smooth', 'step']} onChange={(v) => onChange({ ...def, interpolation: v as typeof def.interpolation })} />
            {inp.source === 'time'
              ? <Num field="loopMs" label="Loop ms" value={inp.loopMs} step={10} min={1} onChange={(v) => onChange({ ...def, input: { source: 'time', loopMs: v } })} />
              : <Txt field="path" label="Path" value={inp.path} onChange={(v) => onChange({ ...def, input: { source: 'stream', path: v, in: inp.in } })} />}
            <RangeFields range={def.out} onMin={(v) => onChange({ ...def, out: { ...def.out, min: v } })} onMax={(v) => onChange({ ...def, out: { ...def.out, max: v } })} />
          </Row>
        </div>
      );
    }
    case 'timeline':
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <TimelineEditor keys={def.keys} durationMs={def.durationMs} loop={def.loop} onChange={(keys: readonly Keyframe[]) => onChange({ ...def, keys })} />
          <Row>
            <Num field="durationMs" label="Duration ms" value={def.durationMs} step={100} min={1} onChange={(v) => onChange({ ...def, durationMs: Math.max(1, v) })} />
            <Sel field="loop" label="Loop" value={def.loop} options={['none', 'loop', 'pingpong']} onChange={(v) => onChange({ ...def, loop: v as typeof def.loop })} />
          </Row>
        </div>
      );
    case 'sequence': {
      const out: Range = def.out ?? ZERO;
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <SequenceEditor steps={def.steps} onChange={(steps: readonly number[]) => onChange({ ...def, steps })} />
          <Row>
            <Num field="rateHz" label="Rate Hz" value={def.rateHz} min={0} onChange={(v) => onChange({ ...def, rateHz: v })} />
            {play ? null : <Num field="glideMs" label="Glide ms" value={def.glideMs ?? 0} step={1} min={0} onChange={(v) => onChange({ ...def, glideMs: v })} />}
            {play ? null : <RangeFields range={out} onMin={(v) => onChange({ ...def, out: { ...out, min: v } })} onMax={(v) => onChange({ ...def, out: { ...out, max: v } })} />}
          </Row>
        </div>
      );
    }
    case 'stream':
      return (
        <Row>
          <Txt field="path" label="Path" value={def.path} onChange={(v) => onChange({ ...def, path: v })} />
          {play ? null : <Num field="scale" label="Scale" value={def.scale ?? 1} onChange={(v) => onChange({ ...def, scale: v })} />}
          {play ? null : <Num field="offset" label="Offset" value={def.offset ?? 0} onChange={(v) => onChange({ ...def, offset: v })} />}
          {play ? null : <Num field="smoothMs" label="Smooth ms" value={def.smoothMs ?? 0} step={1} min={0} onChange={(v) => onChange({ ...def, smoothMs: v })} />}
        </Row>
      );
    case 'expr':
      return <Txt field="source" label="Source" value={def.source} onChange={(v) => onChange({ ...def, source: v })} />;
    case 'texture':
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <Txt field="textureId" label="Texture" value={def.textureId} onChange={(v) => onChange({ ...def, textureId: v })} />
          {(['u', 'v'] as const).map((k) => (
            <div key={k} style={nestedStyle}>
              <span style={labelStyle}>{k.toUpperCase()}</span>
              {depth < MAX_DEPTH
                ? <Panel def={def[k]} tier={tier} depth={depth + 1} onChange={(d) => onChange({ ...def, u: k === 'u' ? d : def.u, v: k === 'v' ? d : def.v })} />
                : <em style={{ fontSize: 11, color: C.dim }}>depth limit</em>}
            </div>
          ))}
          <Row>
            <RangeFields range={def.out} onMin={(v) => onChange({ ...def, out: { ...def.out, min: v } })} onMax={(v) => onChange({ ...def, out: { ...def.out, max: v } })} />
          </Row>
        </div>
      );
    case 'combine': {
      const inputs = def.inputs;
      const replace = (i: number, d: ModulatorDef): ModulatorDef => ({ ...def, inputs: inputs.map((x, j) => (j === i ? d : x)) });
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <Row>
            <Sel field="op" label="Op" value={def.op} options={['add', 'multiply', 'min', 'max', 'mix']} onChange={(v) => onChange({ ...def, op: v as typeof def.op })} />
            {def.op === 'mix' ? <Num field="mix" label="Mix" value={def.mix ?? 0.5} min={0} max={1} onChange={(v) => onChange({ ...def, mix: v })} /> : null}
          </Row>
          {inputs.map((input, i) => (
            <div key={i} style={nestedStyle}>
              <Row>
                <span style={labelStyle}>Input {i + 1}</span>
                {inputs.length > 1
                  ? <button type="button" data-action="remove-input" data-index={String(i)} style={btnStyle} onClick={() => onChange({ ...def, inputs: inputs.filter((_, j) => j !== i) })}>Remove</button>
                  : null}
              </Row>
              {depth < MAX_DEPTH
                ? <Panel def={input} tier={tier} depth={depth + 1} onChange={(d) => onChange(replace(i, d))} />
                : <em style={{ fontSize: 11, color: C.dim }}>depth limit</em>}
            </div>
          ))}
          <button type="button" data-action="add-input" style={btnStyle} onClick={() => onChange({ ...def, inputs: [...inputs, defaultModulator('constant')] })}>Add input</button>
        </div>
      );
    }
    default:
      return null;
  }
}

export function Panel(props: { def: ModulatorDef; onChange: (d: ModulatorDef) => void; tier: Tier; depth: number; preview?: readonly number[] }): ReactNode {
  return (
    <section
      data-kit="modulator-panel"
      style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, display: 'grid', gap: 10, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
    >
      {props.depth === 0 && props.preview ? <Sparkline values={props.preview} width={280} height={44} label="Modulator preview" /> : null}
      <label style={labelStyle}>
        <span>Kind</span>
        <select data-field="kind" value={props.def.kind} style={inputStyle} onChange={(e) => props.onChange(defaultModulator(e.target.value as ModulatorDef['kind']))}>
          {MOD_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>{k.label}</option>
          ))}
        </select>
      </label>
      <Fields def={props.def} onChange={props.onChange} tier={props.tier} depth={props.depth} />
    </section>
  );
}

export function ModulatorPanel(props: { def: ModulatorDef; onChange: (def: ModulatorDef) => void; tier: 'play' | 'build' | 'pro'; preview?: readonly number[] }): ReactNode {
  return <Panel def={props.def} onChange={props.onChange} tier={props.tier} depth={0} preview={props.preview} />;
}
