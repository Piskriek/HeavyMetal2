/**
 * PLAN-43 (logic): 5-rung wiregraph presets. Pure deterministic TS.
 * Rung1 sensor, Rung2 logic node, Rung3 actuator, Rung4 WireGraphSpec,
 * Rung5 WIREGRAPH_SHELF. No Date.now/Math.random/DOM/I-O.
 */
export interface ParamDescriptor { readonly key: string; readonly label: string; readonly min: number; readonly max: number; readonly step: number; readonly defaultValue: number; readonly unit?: string; readonly group?: string }
export interface ParamSchema { readonly id: string; readonly version: number; readonly params: readonly ParamDescriptor[] }
const p = (key: string, label: string, min: number, max: number, step: number, defaultValue: number, unit?: string, group = 'Logic'): ParamDescriptor => ({ key, label, min, max, step, defaultValue, ...(unit ? { unit } : {}), group });
export const WIREGRAPH_PARAM_SCHEMA: ParamSchema = { id: 'hm.wiregraph.preset', version: 1, params: [
  p('proximityRadiusM', 'Proximity radius', 0, 30, 0.5, 4, 'm', 'Sensor'), p('threshold', 'Threshold', -1000, 1000, 1, 1, '', 'Sensor'),
  p('delayMs', 'Delay', 0, 60000, 50, 500, 'ms'), p('counterTarget', 'Counter target', 1, 1000, 1, 3, '', 'Counter'),
  p('stage', 'Stage reached', 0, 6, 1, 6, '', 'Sensor'), p('brownoutBelow', 'Brownout below', 0, 1, 0.01, 0.25, 'ratio', 'Sensor'),
]};
export type LogicParamSchema = ParamSchema;
export const LOGIC_PRESET_SCHEMA = WIREGRAPH_PARAM_SCHEMA;

export type TriggerSensorKind = 'proximity' | 'stage-reached' | 'cardinal-threshold' | 'power-brownout' | 'leak-active' | 'hopper-low';
export type LogicNodeKind = 'and' | 'or' | 'not' | 'delay' | 'latch' | 'counter' | 'threshold';
/** plan 51 wave 3 adds the reflex slot's four: the suit's shield pulsed, the drone's fire overclocked, an instant reload, a chained arc zap. */
export type ActuatorKind = 'toggle-machine' | 'open-door' | 'fire-turret' | 'set-lamp-lx' | 'play-sound' | 'dial-gate' | 'lock-iris' | 'turret-track' | 'spawn-monster' | 'pulse-shield' | 'overclock-fire' | 'reload-weapon' | 'arc-chain';
export interface SensorSpec { readonly id: string; readonly kind: TriggerSensorKind; readonly threshold?: number; readonly target?: string }
export interface LogicNodeSpec { readonly id: string; readonly kind: LogicNodeKind; readonly inputs: readonly string[]; readonly delayMs?: number; readonly counterTarget?: number; readonly threshold?: number; readonly resetInput?: string }
export interface ActuatorSpec { readonly id: string; readonly kind: ActuatorKind; readonly input: string; readonly target: string; readonly value?: number }
export interface WireGraphSpec { readonly id: string; readonly name: string; readonly sensors: readonly SensorSpec[]; readonly nodes: readonly LogicNodeSpec[]; readonly actuators: readonly ActuatorSpec[] }
export type WireGraphPreset = WireGraphSpec;

export const SENSOR_KINDS: readonly TriggerSensorKind[] = ['proximity', 'stage-reached', 'cardinal-threshold', 'power-brownout', 'leak-active', 'hopper-low'];
export const LOGIC_NODE_KINDS: readonly LogicNodeKind[] = ['and', 'or', 'not', 'delay', 'latch', 'counter', 'threshold'];
export const ACTUATOR_KINDS: readonly ActuatorKind[] = ['toggle-machine', 'open-door', 'fire-turret', 'set-lamp-lx', 'play-sound', 'dial-gate', 'lock-iris', 'turret-track', 'spawn-monster', 'pulse-shield', 'overclock-fire', 'reload-weapon', 'arc-chain'];

/** Sensors are numeric: proximity/stage/cardinal pass the reading through; brownout/leak/hopper are 1 when active (reading >= threshold, default 1; brownout: reading <= threshold). */
export function evaluateSensor(spec: SensorSpec, reading: number): number {
  if (!Number.isFinite(reading)) return 0; const t = spec.threshold ?? 1;
  switch (spec.kind) { case 'power-brownout': case 'hopper-low': return reading <= t ? 1 : 0; default: return reading; }
}
export const isSensorActive = (spec: SensorSpec, reading: number): boolean => {
  const v = evaluateSensor(spec, reading); return spec.kind === 'power-brownout' ? v === 1 : v >= (spec.threshold ?? 1);
};

const STATEFUL: ReadonlySet<string> = new Set(['delay', 'latch', 'counter']);
export function validateWireGraph(graph: WireGraphSpec): string[] {
  const e: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(graph.id)) e.push(`id must be a lowercase slug, got "${graph.id}"`);
  if (!graph.name?.trim()) e.push('name must not be empty');
  const ids = new Map<string, string>();
  const reg = (id: string, what: string): void => { if (!id) e.push(`${what} has an empty id`); else if (ids.has(id)) e.push(`duplicate id "${id}" (${ids.get(id)} and ${what})`); else ids.set(id, what); };
  for (const s of graph.sensors) { reg(s.id, 'sensor'); if (!SENSOR_KINDS.includes(s.kind)) e.push(`sensor "${s.id}" has unknown kind "${s.kind}"`); }
  for (const n of graph.nodes) { reg(n.id, 'node'); if (!LOGIC_NODE_KINDS.includes(n.kind)) e.push(`node "${n.id}" has unknown kind "${n.kind}"`);
    const arity: Record<LogicNodeKind, [number, number]> = { and: [1, 99], or: [1, 99], not: [1, 1], delay: [1, 1], latch: [1, 1], counter: [1, 1], threshold: [1, 1] };
    const [lo, hi] = arity[n.kind]; if (n.inputs.length < lo || n.inputs.length > hi) e.push(`node "${n.id}" (${n.kind}) expects ${lo === hi ? lo : `${lo}+`} input(s), got ${n.inputs.length}`);
    if (n.kind === 'delay' && (n.delayMs === undefined || !(n.delayMs >= 0))) e.push(`delay node "${n.id}" needs delayMs >= 0`);
    if (n.kind === 'counter' && (n.counterTarget === undefined || !(n.counterTarget >= 1))) e.push(`counter node "${n.id}" needs counterTarget >= 1`);
    if (n.kind === 'threshold' && n.threshold === undefined) e.push(`threshold node "${n.id}" needs a threshold`);
    for (const i of n.inputs) if (!ids.has(i)) e.push(`node "${n.id}" references unknown input "${i}"`);
    if (n.resetInput !== undefined && !ids.has(n.resetInput)) e.push(`node "${n.id}" references unknown resetInput "${n.resetInput}"`); }
  for (const a of graph.actuators) { reg(a.id, 'actuator'); if (!ACTUATOR_KINDS.includes(a.kind)) e.push(`actuator "${a.id}" has unknown kind "${a.kind}"`);
    if (!ids.has(a.input)) e.push(`actuator "${a.id}" references unknown input "${a.input}"`); if (!a.target) e.push(`actuator "${a.id}" needs a target`); }
  // Combinational-cycle guard: cycles are illegal unless broken by a stateful node (delay/latch/counter).
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n])); const visiting = new Set<string>(); const done = new Set<string>(); let cycle = '';
  const visit = (id: string, path: string[]): void => { if (cycle) return; if (done.has(id)) return;
    if (visiting.has(id)) { const loop = [...path.slice(path.indexOf(id)), id];
      if (!loop.some((x) => STATEFUL.has(nodeById.get(x)?.kind ?? ''))) cycle = `combinational loop (infinite cycle) detected: ${loop.join(' -> ')}`; return; }
    const n = nodeById.get(id); if (!n) return; visiting.add(id);
    for (const i of n.inputs) visit(i, [...path, id]); if (n.resetInput) visit(n.resetInput, [...path, id]); visiting.delete(id); done.add(id); };
  for (const n of graph.nodes) visit(n.id, []); if (cycle) e.push(cycle);
  return e;
}
export const validateWiregraph = validateWireGraph;

export interface WireGraphState { readonly elapsedMs: number; readonly values: Readonly<Record<string, number>>; readonly previous: Readonly<Record<string, number>>; readonly latchState: Readonly<Record<string, boolean>>; readonly counterState: Readonly<Record<string, number>>; readonly delayQueue: Readonly<Record<string, readonly { readonly readyMs: number; readonly value: number }[]>> }
export const createWireGraphState = (): WireGraphState => ({ elapsedMs: 0, values: {}, previous: {}, latchState: {}, counterState: {}, delayQueue: {} });
export const initialWireGraphState = createWireGraphState;
export interface ActuatorOutput { readonly actuatorId: string; readonly kind: ActuatorKind; readonly target: string; readonly value: number }
export interface WireGraphResult { readonly state: WireGraphState; readonly values: Readonly<Record<string, number>>; readonly outputs: readonly ActuatorOutput[] }

/** Evaluate sensors -> logic nodes (topological order) -> actuators for one fixed dt step. Readings are keyed by sensor id. */
export function evaluateWireGraph(graph: WireGraphSpec, state: WireGraphState, readings: Readonly<Record<string, number | boolean>>, dtMs: number): WireGraphResult {
  const problems = validateWireGraph(graph); if (problems.length) throw new Error(problems.join('; '));
  const dt = Number.isFinite(dtMs) ? Math.min(60000, Math.max(0, dtMs)) : 0; const elapsedMs = state.elapsedMs + dt;
  const values: Record<string, number> = {}; const latchState: Record<string, boolean> = { ...state.latchState };
  const counterState: Record<string, number> = { ...state.counterState }; const delayQueue: Record<string, { readyMs: number; value: number }[]> = {};
  for (const s of graph.sensors) { const raw = readings[s.id]; values[s.id] = evaluateSensor(s, typeof raw === 'boolean' ? (raw ? 1 : 0) : (raw ?? 0)); }
  // Topological order via repeated resolution (graph is validated acyclic for combinational paths; stateful nodes read previous-step inputs if cyclic).
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n])); const pending = new Set(graph.nodes.map((n) => n.id)); const val = (id: string): number => values[id] ?? state.previous[id] ?? 0;
  let guard = 0;
  while (pending.size && guard++ <= graph.nodes.length + 1) {
    for (const n of graph.nodes) { if (!pending.has(n.id)) continue;
      if (!n.inputs.every((i) => !nodeById.has(i) || values[i] !== undefined || !pending.has(i))) continue;
      const ins = n.inputs.map(val); let out = 0;
      switch (n.kind) {
        case 'and': out = ins.every((v) => v > 0) ? 1 : 0; break; case 'or': out = ins.some((v) => v > 0) ? 1 : 0; break;
        case 'not': out = (ins[0] ?? 0) > 0 ? 0 : 1; break; case 'threshold': out = (ins[0] ?? 0) >= (n.threshold ?? 0) ? 1 : 0; break;
        case 'latch': { const reset = n.resetInput ? val(n.resetInput) > 0 : false; let cur = latchState[n.id] ?? false; if (reset) cur = false; else if ((ins[0] ?? 0) > 0) cur = true; latchState[n.id] = cur; out = cur ? 1 : 0; break; }
        case 'counter': { const curIn = (ins[0] ?? 0) > 0; const prevIn = (state.values[n.inputs[0] ?? ''] ?? 0) > 0; let c = counterState[n.id] ?? 0; if (n.resetInput && val(n.resetInput) > 0) c = 0; else if (curIn && !prevIn) c += 1; counterState[n.id] = c; out = c >= (n.counterTarget ?? 1) ? 1 : 0; break; }
        case 'delay': { const q = [...(state.delayQueue[n.id] ?? [])]; q.push({ readyMs: elapsedMs + (n.delayMs ?? 0), value: ins[0] ?? 0 }); const ready = q.filter((q2) => q2.readyMs <= elapsedMs); out = ready.length ? (ready[ready.length - 1]?.value ?? 0) : 0; delayQueue[n.id] = q.filter((q2) => q2.readyMs > elapsedMs); break; }
      }
      values[n.id] = out; pending.delete(n.id); } }
  for (const id of pending) values[id] = state.previous[id] ?? 0; // stateful cycle: hold previous value
  const outputs: ActuatorOutput[] = [];
  for (const a of graph.actuators) { const v = values[a.input] ?? 0; values[a.id] = v; if (v > 0) outputs.push({ actuatorId: a.id, kind: a.kind, target: a.target, value: a.value ?? v }); }
  const next: WireGraphState = { elapsedMs, values, previous: state.values, latchState, counterState, delayQueue };
  return { state: next, values, outputs };
}
export const stepWireGraph = evaluateWireGraph;

const g = (id: string, name: string, sensors: SensorSpec[], nodes: LogicNodeSpec[], actuators: ActuatorSpec[]): WireGraphSpec => ({ id, name, sensors, nodes, actuators });
export const WIREGRAPH_SHELF: Readonly<Record<string, WireGraphSpec>> = Object.freeze({
  'auto-airlock': g('auto-airlock', 'Auto Airlock', [{ id: 'prox', kind: 'proximity', threshold: 1 }], [{ id: 'open-delay', kind: 'delay', inputs: ['prox'], delayMs: 250 }], [{ id: 'door', kind: 'open-door', input: 'open-delay', target: 'airlock-door' }, { id: 'chime', kind: 'play-sound', input: 'open-delay', target: 'sfx-door' }]),
  'brownout-load-shedder': g('brownout-load-shedder', 'Brownout Load Shedder', [{ id: 'power', kind: 'power-brownout', threshold: 0.25 }], [{ id: 'shed', kind: 'latch', inputs: ['power'] }], [{ id: 'machine-off', kind: 'toggle-machine', input: 'shed', target: 'nonessential-machines', value: 0 }, { id: 'lamp', kind: 'set-lamp-lx', input: 'shed', target: 'warning-lamp', value: 40 }]),
  'leak-perimeter-alarm': g('leak-perimeter-alarm', 'Leak Perimeter Alarm', [{ id: 'leak', kind: 'leak-active', threshold: 1 }, { id: 'prox', kind: 'proximity', threshold: 1 }], [{ id: 'alarm', kind: 'latch', inputs: ['leak'] }, { id: 'near-and-leak', kind: 'and', inputs: ['leak', 'prox'] }], [{ id: 'lamp', kind: 'set-lamp-lx', input: 'alarm', target: 'perimeter-lamp', value: 120 }, { id: 'siren', kind: 'play-sound', input: 'near-and-leak', target: 'sfx-alarm' }, { id: 'turret', kind: 'fire-turret', input: 'near-and-leak', target: 'perimeter-turret' }]),
  // plan 43's Stargate rule: the iris is shut unless the plot is listed open or the visitor's code is accepted, and the
  // ramp door opens exactly when the iris does. No `if` in the game decides this; the gate evaluates this graph.
  'stargate-iris-lock': g('stargate-iris-lock', 'Stargate Iris Lock',
    [{ id: 'privacy-open', kind: 'cardinal-threshold', threshold: 1 }, { id: 'privacy-closed', kind: 'cardinal-threshold', threshold: 1 }, { id: 'code', kind: 'cardinal-threshold', threshold: 1 }],
    [{ id: 'asked', kind: 'or', inputs: ['privacy-open', 'code'] }, { id: 'not-closed', kind: 'not', inputs: ['privacy-closed'] }, { id: 'admit', kind: 'and', inputs: ['asked', 'not-closed'] }, { id: 'shut', kind: 'not', inputs: ['admit'] }],
    [{ id: 'iris', kind: 'lock-iris', input: 'shut', target: 'stargate-iris' }, { id: 'door', kind: 'open-door', input: 'admit', target: 'stargate-ramp-door' }]),
  // plan 43's perimeter turret: it tracks what comes within reach and fires while the target holds, on one graph
  'perimeter-turret': g('perimeter-turret', 'Perimeter Turret',
    [{ id: 'prox', kind: 'proximity', threshold: 1 }],
    [{ id: 'hold', kind: 'delay', inputs: ['prox'], delayMs: 400 }],
    [{ id: 'track', kind: 'turret-track', input: 'prox', target: 'perimeter-turret' }, { id: 'fire', kind: 'fire-turret', input: 'hold', target: 'perimeter-turret' }]),
  // plan 43's monster spawner: a stage gate and a proximity trip, counted, so a nest spawns on a beat rather than a stream
  'nest-spawner': g('nest-spawner', 'Nest Spawner',
    [{ id: 'stage', kind: 'stage-reached', threshold: 3 }, { id: 'prox', kind: 'proximity', threshold: 1 }],
    [{ id: 'armed', kind: 'and', inputs: ['stage', 'prox'] }, { id: 'beat', kind: 'counter', inputs: ['armed'], counterTarget: 4 }],
    [{ id: 'spawn', kind: 'spawn-monster', input: 'beat', target: 'nest', value: 1 }]),
  // plan 51 wave 3's Mimic Reflex Slot: a bridged game's events, by class (the sensor's target is `class:<name>`), drive
  // live reflexes on the suit and the drone while the bridge is live. Values are durations in ms or a chain length.
  'mimic-reflex': g('mimic-reflex', 'Mimic Reflex Slot',
    [{ id: 'threat', kind: 'cardinal-threshold', threshold: 1, target: 'class:threat' }, { id: 'mobility', kind: 'cardinal-threshold', threshold: 1, target: 'class:mobility' },
      { id: 'outcome', kind: 'cardinal-threshold', threshold: 1, target: 'class:outcome' }, { id: 'objective', kind: 'cardinal-threshold', threshold: 1, target: 'class:objective' },
      { id: 'harm', kind: 'cardinal-threshold', threshold: 1, target: 'class:harm' }],
    [{ id: 'pressure', kind: 'or', inputs: ['threat', 'objective', 'harm'] }],
    [{ id: 'shield', kind: 'pulse-shield', input: 'pressure', target: 'player-suit', value: 4000 },
      { id: 'overclock', kind: 'overclock-fire', input: 'pressure', target: 'drone', value: 4000 },
      { id: 'reload', kind: 'reload-weapon', input: 'mobility', target: 'player-weapon' },
      { id: 'arc', kind: 'arc-chain', input: 'outcome', target: 'drone', value: 3 }]),
  'stage6-earth-beacon': g('stage6-earth-beacon', 'Stage-6 Earth Beacon', [{ id: 'stage', kind: 'stage-reached', threshold: 6 }, { id: 'charge', kind: 'cardinal-threshold', threshold: 100 }], [{ id: 'both', kind: 'and', inputs: ['stage', 'charge'] }, { id: 'pulses', kind: 'counter', inputs: ['both'], counterTarget: 3 }], [{ id: 'gate', kind: 'dial-gate', input: 'pulses', target: 'earth-gate' }, { id: 'beacon', kind: 'set-lamp-lx', input: 'both', target: 'beacon-lamp', value: 200 }]),
});
export const serializeWireGraph = (graph: WireGraphSpec): string => JSON.stringify(graph);
export function parseWireGraph(json: string): WireGraphSpec | null { try { const v = JSON.parse(json) as WireGraphSpec; return v && typeof v === 'object' && validateWireGraph(v).length === 0 ? v : null; } catch { return null; } }
/* Cartridge hook (`logic:<presetId>`, Beam Rifle Apply mode). */
export const logicCartridgeId = (presetId: string): string => `logic:${presetId}`;
export function resolveLogicCartridge(cartridgeId: string): WireGraphSpec | null { if (!cartridgeId.startsWith('logic:')) return null; return WIREGRAPH_SHELF[cartridgeId.slice(6)] ?? null; }
export const parseLogicCartridgeId = resolveLogicCartridge;
export function applyLogicCartridge<T extends object>(target: T, cartridgeId: string): (T & { readonly logic: WireGraphSpec; readonly logicPresetId: string }) | null { const logic = resolveLogicCartridge(cartridgeId); if (!logic) return null; return { ...target, logic, logicPresetId: logic.id }; }
export const applyLogicPreset = applyLogicCartridge;

/**
 * Plan 51: a custom logic graph as a share code (`logicc:` + the graph's JSON, URI-encoded), for graphs the harness
 * induces from an observed game. `logic:<id>` still names a shelf graph. Decoding validates the graph, so a malformed or
 * hostile code yields null.
 */
export const encodeLogicCode = (graph: WireGraphSpec): string => `logicc:${encodeURIComponent(serializeWireGraph(graph))}`;
export function decodeLogicCode(code: string): WireGraphSpec | null {
  if (code.startsWith('logic:')) return resolveLogicCartridge(code);
  if (!code.startsWith('logicc:') || code.length > 16384) return null;
  try { return parseWireGraph(decodeURIComponent(code.slice('logicc:'.length))); } catch { return null; }
}
