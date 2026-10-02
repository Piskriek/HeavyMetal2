export interface Preset {
  id: string;
  kind: string;
  name: string;
  params: Record<string, unknown>;
  plugs: Record<string, string | null>;
}

export interface PlugSpec {
  key: string;
  label: string;
  doc: string;
  accepts: string[];
  multiple: boolean;
  required: boolean;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string' | 'enum' | 'color';
  default: unknown;
  min?: number;
  max?: number;
  options?: string[];
}

export interface KindSpec {
  kind: string;
  label: string;
  plugs: PlugSpec[];
  params: ParamSpec[];
}

export interface Effect {
  type: 'sprite' | 'sound' | 'tool' | 'script' | 'action';
  presetId: string;
}

export type Visibility = 'private' | 'sale' | 'free' | 'friends';

export interface PublishRequest {
  presetId: string;
  visibility: Visibility;
  name: string;
  description: string;
  priceCredits?: number;
  tags?: string[];
}

export interface License {
  use: boolean;
  remix: boolean;
  resell: boolean;
  credit: boolean;
}

function ps(
  key: string,
  label: string,
  doc: string,
  accepts: string[],
  multiple = false,
  required = false,
): PlugSpec {
  return { key, label, doc, accepts, multiple, required };
}

function pr(
  key: string,
  label: string,
  type: ParamSpec['type'],
  defaultValue: unknown,
  extra: Partial<Pick<ParamSpec, 'min' | 'max' | 'options'>> = {},
): ParamSpec {
  return { key, label, type, default: defaultValue, ...extra };
}

export const KINDS: KindSpec[] = [
  {
    kind: 'button',
    label: 'Button',
    plugs: [
      ps('onClick', 'On click', 'Fired when the button is used.', ['action', 'sprite', 'sound', 'tool', 'script']),
      ps('onHover', 'On hover', 'Fired when the cursor hovers the button.', ['sprite', 'sound']),
      ps('onPlace', 'On place', 'Fired when the button is placed in the world.', ['model', 'sprite', 'sound']),
      ps('onDelete', 'On delete', 'Fired when the button is deleted.', ['sprite', 'sound']),
      ps('icon', 'Icon', 'Hotbar icon sprite.', ['sprite']),
    ],
    params: [
      pr('label', 'Label', 'string', 'Button'),
      pr('hotkey', 'Hotkey', 'string', ''),
      pr('cooldownMs', 'Cooldown (ms)', 'number', 0, { min: 0, max: 60000 }),
    ],
  },
  {
    kind: 'tool',
    label: 'Tool',
    plugs: [],
    params: [
      pr('mode', 'Mode', 'enum', 'sculpt', {
        options: ['sculpt', 'brush', 'select', 'place', 'dress', 'delete', 'camera'],
      }),
      pr('size', 'Size', 'number', 1, { min: 0.1, max: 100 }),
      pr('strength', 'Strength', 'number', 1, { min: 0, max: 1 }),
    ],
  },
  {
    kind: 'sprite',
    label: 'Sprite',
    plugs: [],
    params: [
      pr('count', 'Count', 'number', 10, { min: 1, max: 1000 }),
      pr('lifeMs', 'Life (ms)', 'number', 800, { min: 1, max: 10000 }),
      pr('colour', 'Colour', 'color', '#ffffff'),
      pr('size', 'Size', 'number', 1, { min: 0.01, max: 50 }),
      pr('gravity', 'Gravity', 'number', 0, { min: -100, max: 100 }),
      pr('spread', 'Spread', 'number', 1, { min: 0, max: 360 }),
    ],
  },
  {
    kind: 'sound',
    label: 'Sound',
    plugs: [],
    params: [
      pr('volume', 'Volume', 'number', 1, { min: 0, max: 1 }),
      pr('pitch', 'Pitch', 'number', 1, { min: 0.25, max: 4 }),
    ],
  },
  {
    kind: 'model',
    label: 'Model',
    plugs: [],
    params: [pr('scale', 'Scale', 'number', 1, { min: 0.01, max: 100 })],
  },
  {
    kind: 'action',
    label: 'Action',
    plugs: [
      ps('steps', 'Steps', 'Ordered chain of presets to run.', ['action', 'sprite', 'sound', 'tool', 'script'], true),
    ],
    params: [],
  },
  {
    kind: 'script',
    label: 'Script',
    plugs: [],
    params: [pr('code', 'Code', 'string', '')],
  },
  {
    kind: 'hotbar',
    label: 'Hotbar',
    plugs: [ps('slots', 'Slots', 'Button slots (max 9).', ['button'], true)],
    params: [],
  },
  {
    kind: 'skin',
    label: 'Skin',
    plugs: [],
    params: [pr('tint', 'Tint', 'color', '#ffffff')],
  },
  {
    kind: 'activity',
    label: 'Activity',
    plugs: [],
    params: [pr('title', 'Title', 'string', 'Activity')],
  },
];

function getKind(specs: KindSpec[], kind: string): KindSpec | undefined {
  for (const s of specs) {
    if (s.kind === kind) return s;
  }
  return undefined;
}

function byIdMap(library: Preset[]): Map<string, Preset> {
  const m = new Map<string, Preset>();
  for (const p of library) m.set(p.id, p);
  return m;
}

function plugBaseKey(key: string): string {
  const i = key.lastIndexOf('.');
  if (i >= 0 && /^\d+$/.test(key.slice(i + 1))) return key.slice(0, i);
  return key;
}

function findPlugSpec(specs: KindSpec[], kind: string, key: string): PlugSpec | undefined {
  const ks = getKind(specs, kind);
  if (!ks) return undefined;
  const base = plugBaseKey(key);
  for (const p of ks.plugs) {
    if (p.key === base) return p;
  }
  return undefined;
}

function indexedEntries(preset: Preset, key: string): Array<{ k: string; i: number; id: string }> {
  const out: Array<{ k: string; i: number; id: string }> = [];
  const prefix = key + '.';
  for (const [k, v] of Object.entries(preset.plugs)) {
    if (v === null) continue;
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    if (!/^\d+$/.test(rest)) continue;
    out.push({ k, i: Number(rest), id: v });
  }
  out.sort((a, b) => a.i - b.i);
  return out;
}

function getPluggedIds(preset: Preset, key: string): string[] {
  const indexed = indexedEntries(preset, key);
  const ids = indexed.map((x) => x.id);
  const direct = preset.plugs[key];
  if (typeof direct === 'string') return [direct, ...ids];
  return ids;
}

function nextIndex(preset: Preset, key: string): number {
  const used = new Set<number>();
  for (const e of indexedEntries(preset, key)) used.add(e.i);
  let i = 0;
  while (used.has(i)) i += 1;
  return i;
}

function isKnownPlugKey(spec: KindSpec, key: string): boolean {
  for (const p of spec.plugs) {
    if (p.key === key) return true;
    if (p.multiple) {
      const prefix = p.key + '.';
      if (key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length))) return true;
    }
  }
  return false;
}

function createsCycle(parent: Preset, child: Preset, library: Preset[]): boolean {
  if (parent.id === child.id) return true;
  const map = byIdMap(library);
  map.set(child.id, child);
  const seen = new Set<string>();
  const stack: string[] = [];
  for (const v of Object.values(child.plugs)) {
    if (typeof v === 'string') stack.push(v);
  }
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    if (id === parent.id) return true;
    seen.add(id);
    const node = map.get(id);
    if (!node) continue;
    for (const v of Object.values(node.plugs)) {
      if (typeof v === 'string') stack.push(v);
    }
  }
  return false;
}

function isEffectType(k: string): k is Effect['type'] {
  return k === 'sprite' || k === 'sound' || k === 'tool' || k === 'script' || k === 'action';
}

function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v);
}

function paramError(spec: ParamSpec, value: unknown): string | undefined {
  if (spec.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `param out of range: ${spec.key}`;
    if (spec.min !== undefined && value < spec.min) return `param out of range: ${spec.key}`;
    if (spec.max !== undefined && value > spec.max) return `param out of range: ${spec.key}`;
    return undefined;
  }
  if (spec.type === 'boolean') {
    return typeof value === 'boolean' ? undefined : `param out of range: ${spec.key}`;
  }
  if (spec.type === 'string') {
    return typeof value === 'string' ? undefined : `param out of range: ${spec.key}`;
  }
  if (spec.type === 'enum') {
    if (typeof value !== 'string') return `param out of range: ${spec.key}`;
    const opts = spec.options ?? [];
    return opts.indexOf(value) >= 0 ? undefined : `param out of range: ${spec.key}`;
  }
  if (spec.type === 'color') {
    return typeof value === 'string' && isHexColor(value) ? undefined : `param out of range: ${spec.key}`;
  }
  return undefined;
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinAnd(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0] ?? ''} and ${names[1] ?? ''}`;
  const last = names[names.length - 1] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${last}`;
}

function toolLabel(preset: Preset): string {
  const mode = preset.params.mode;
  if (typeof mode === 'string' && mode.length > 0) return `${capitalize(mode)} tool`;
  return `${preset.name} tool`;
}

function cleanName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function hasUrl(text: string): boolean {
  return /https?:\/\//i.test(text) || /\bwww\./i.test(text) || /\.com\b/i.test(text);
}

function findBlocked(text: string, blocked: string[]): string | undefined {
  for (const w of blocked) {
    if (w.length === 0) continue;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, 'i');
    if (re.test(text)) return w;
  }
  return undefined;
}

function visOk(v: string): v is Visibility {
  return v === 'private' || v === 'sale' || v === 'free' || v === 'friends';
}

export function plugPoints(
  kindSpecs: KindSpec[],
  preset: Preset,
): { plug: PlugSpec; filled: string | null }[] {
  const ks = getKind(kindSpecs, preset.kind);
  if (!ks) return [];
  const out: { plug: PlugSpec; filled: string | null }[] = [];
  for (const pl of ks.plugs) {
    const ids = getPluggedIds(preset, pl.key);
    if (pl.multiple) {
      if (ids.length === 0) out.push({ plug: pl, filled: null });
      else for (const id of ids) out.push({ plug: pl, filled: id });
    } else {
      const first = ids[0];
      out.push({ plug: pl, filled: first ?? null });
    }
  }
  return out;
}

export function candidates(plugSpec: PlugSpec, library: Preset[]): Preset[] {
  const accepted = library.filter((p) => plugSpec.accepts.indexOf(p.kind) >= 0);
  accepted.sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return accepted;
}

export function addableKinds(plugSpec: PlugSpec): string[] {
  return plugSpec.accepts.slice();
}

export function canPlug(
  specs: KindSpec[],
  parent: Preset,
  plugKey: string,
  child: Preset,
  library: Preset[],
): { ok: boolean; reason?: string } {
  const ks = getKind(specs, parent.kind);
  if (!ks) return { ok: false, reason: 'unknown kind' };
  const plugSpec = findPlugSpec(specs, parent.kind, plugKey);
  if (!plugSpec) return { ok: false, reason: 'unknown plug' };
  let found = false;
  for (const p of library) {
    if (p.id === child.id) {
      found = true;
      break;
    }
  }
  if (!found) return { ok: false, reason: 'child not in library' };
  if (plugSpec.accepts.indexOf(child.kind) < 0) return { ok: false, reason: 'kind not accepted' };
  if (parent.id === child.id) return { ok: false, reason: 'self plug' };
  if (createsCycle(parent, child, library)) return { ok: false, reason: 'cycle' };
  const filled = getPluggedIds(parent, plugSpec.key);
  if (!plugSpec.multiple && filled.length > 0) return { ok: false, reason: 'already filled' };
  if (parent.kind === 'hotbar' && plugSpec.key === 'slots' && filled.length >= 9) {
    return { ok: false, reason: 'hotbar slots max 9' };
  }
  return { ok: true };
}

export function plug(
  specs: KindSpec[],
  parent: Preset,
  key: string,
  childId: string,
  library: Preset[],
): Preset {
  let child: Preset | undefined;
  for (const p of library) {
    if (p.id === childId) {
      child = p;
      break;
    }
  }
  if (!child) throw new Error('child not in library');
  const check = canPlug(specs, parent, key, child, library);
  if (!check.ok) throw new Error(check.reason ?? 'cannot plug');
  const plugSpec = findPlugSpec(specs, parent.kind, key);
  const plugs: Record<string, string | null> = { ...parent.plugs };
  if (plugSpec && plugSpec.multiple) {
    const idx = nextIndex(parent, plugSpec.key);
    plugs[`${plugSpec.key}.${idx}`] = childId;
  } else {
    plugs[plugSpec ? plugSpec.key : key] = childId;
  }
  return { ...parent, plugs };
}

export function unplug(
  specs: KindSpec[],
  parent: Preset,
  key: string,
  library: Preset[],
): Preset {
  void library;
  const plugs: Record<string, string | null> = { ...parent.plugs };
  const base = plugBaseKey(key);
  const plugSpec = findPlugSpec(specs, parent.kind, base);
  if (key !== base && Object.keys(plugs).indexOf(key) >= 0) {
    plugs[key] = null;
  } else if (plugSpec && plugSpec.multiple) {
    const entries = indexedEntries(parent, base);
    const last = entries[entries.length - 1];
    if (last) plugs[last.k] = null;
  } else {
    plugs[base] = null;
  }
  return { ...parent, plugs };
}

export function validatePreset(
  specs: KindSpec[],
  p: Preset,
  library: Preset[],
): { ok: boolean; errors: string[] } {
  void library;
  const errors: string[] = [];
  const ks = getKind(specs, p.kind);
  if (!ks) {
    errors.push(`unknown kind: ${p.kind}`);
    return { ok: false, errors };
  }
  for (const k of Object.keys(p.plugs)) {
    if (!isKnownPlugKey(ks, k)) errors.push(`unknown plug: ${k}`);
  }
  for (const pl of ks.plugs) {
    if (pl.required && getPluggedIds(p, pl.key).length === 0) {
      errors.push(`required plug empty: ${pl.key}`);
    }
  }
  for (const spec of ks.params) {
    if (!Object.prototype.hasOwnProperty.call(p.params, spec.key)) continue;
    const err = paramError(spec, p.params[spec.key]);
    if (err) errors.push(err);
  }
  return { ok: errors.length === 0, errors };
}

export function resolveClick(specs: KindSpec[], button: Preset, library: Preset[]): Effect[] {
  void specs;
  const map = byIdMap(library);
  const out: Effect[] = [];
  const seen = new Set<string>();
  function walk(id: string): void {
    if (seen.has(id)) return;
    const p = map.get(id);
    if (!p) return;
    if (p.kind === 'action') {
      seen.add(id);
      for (const sid of getPluggedIds(p, 'steps')) walk(sid);
      return;
    }
    if (isEffectType(p.kind)) {
      seen.add(id);
      out.push({ type: p.kind, presetId: id });
    }
  }
  for (const id of getPluggedIds(button, 'onClick')) walk(id);
  return out;
}

export function describe(specs: KindSpec[], preset: Preset, library: Preset[]): string {
  if (preset.kind === 'tool') return toolLabel(preset);
  if (preset.kind !== 'button') return preset.name;
  const effects = resolveClick(specs, preset, library);
  const map = byIdMap(library);
  const parts: string[] = [];
  const play: string[] = [];
  let toolPart: string | undefined;
  for (const e of effects) {
    const p = map.get(e.presetId);
    if (!p) continue;
    if (e.type === 'tool' && toolPart === undefined) toolPart = describe(specs, p, library);
    if (e.type === 'sprite' || e.type === 'sound') play.push(p.name);
  }
  if (toolPart) parts.push(toolPart);
  if (play.length > 0) parts.push(`plays ${joinAnd(play)} on click`);
  if (parts.length === 0) return preset.name;
  return parts.join(', ');
}

export function validatePublish(
  req: PublishRequest,
  opts?: { blocked?: string[] },
): { ok: boolean; errors: string[]; clean: PublishRequest } {
  const errors: string[] = [];
  const name = cleanName(req.name ?? '');
  const description = (req.description ?? '').trim();
  const clean: PublishRequest = {
    presetId: req.presetId,
    visibility: req.visibility,
    name,
    description,
  };
  if (!visOk(req.visibility)) errors.push('invalid visibility');
  if (name.length < 3 || name.length > 40) errors.push('name must be 3..40 characters');
  if (description.length > 400) errors.push('description must be 0..400 characters');
  if (req.visibility === 'sale') {
    const price = req.priceCredits;
    if (price === undefined) errors.push('price required for sale');
    else if (!Number.isInteger(price) || price < 1 || price > 100000) {
      errors.push('price must be an integer 1..100000');
    } else {
      clean.priceCredits = price;
    }
  } else if (req.priceCredits !== undefined) {
    errors.push('price only allowed for sale');
  }
  if (req.tags) {
    clean.tags = req.tags.slice();
    if (req.tags.length > 6) errors.push('max 6 tags');
    for (const tag of req.tags) {
      if (!/^[a-z0-9-]{2,20}$/.test(tag)) errors.push(`invalid tag: ${tag}`);
    }
  }
  const urlFields = [name, description, ...(req.tags ?? [])];
  for (const f of urlFields) {
    if (hasUrl(f)) {
      errors.push('url not allowed');
      break;
    }
  }
  const blocked = opts?.blocked ?? [];
  if (blocked.length > 0) {
    const fields = [name, description, ...(req.tags ?? [])];
    for (const f of fields) {
      const w = findBlocked(f, blocked);
      if (w !== undefined) {
        errors.push(`blocked word: ${w}`);
        break;
      }
    }
  }
  return { ok: errors.length === 0, errors, clean };
}

export function bundleDependencies(specs: KindSpec[], rootId: string, library: Preset[]): string[] {
  const map = byIdMap(library);
  const out: string[] = [];
  const seen = new Set<string>();
  function walk(id: string): void {
    if (seen.has(id)) return;
    const p = map.get(id);
    if (!p) return;
    seen.add(id);
    out.push(id);
    const ks = getKind(specs, p.kind);
    if (!ks) return;
    for (const pl of ks.plugs) {
      for (const cid of getPluggedIds(p, pl.key)) walk(cid);
    }
  }
  walk(rootId);
  return out;
}

export function bundleSize(specs: KindSpec[], rootId: string, library: Preset[]): number {
  const ids = bundleDependencies(specs, rootId, library);
  const map = byIdMap(library);
  const pack: Preset[] = [];
  for (const id of ids) {
    const p = map.get(id);
    if (p) pack.push(p);
  }
  return JSON.stringify(pack).length;
}

export function checkBundleLimit(
  bytes: number,
  limit = 100000,
): { ok: boolean; bytes: number; limit: number } {
  return { ok: bytes <= limit, bytes, limit };
}

export function licenseOf(visibility: Visibility): License {
  if (visibility === 'private') return { use: true, remix: false, resell: false, credit: false };
  if (visibility === 'sale') return { use: true, remix: false, resell: false, credit: false };
  if (visibility === 'free') return { use: true, remix: true, resell: false, credit: true };
  return { use: true, remix: true, resell: false, credit: false };
}