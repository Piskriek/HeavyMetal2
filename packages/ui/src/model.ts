import { visibleAt, type ChildSlot, type Params, type PresetSchema, type Ref, type Tier, type Value, type ValueType, type VariableDef } from '@hm/contracts';

/** How a row is drawn. Chosen from the variable's type and limits, never from its name. */
export type Control = 'slider' | 'number' | 'toggle' | 'text' | 'select' | 'color' | 'vector' | 'ref' | 'expr' | 'curve' | 'asset' | 'list';

export interface InspectorRow {
  readonly key: string;
  readonly label: string;
  readonly doc: string;
  readonly type: ValueType;
  readonly control: Control;
  readonly tier: Tier;
  /** What is shown: the resolved value, else the schema default. */
  readonly value: Value;
  /** True only when the preset itself stores this key (not inherited, not default). */
  readonly overridden: boolean;
  /** The formula text when the stored value is `{ expr }`. */
  readonly expression?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly options?: readonly string[];
}

export interface InspectorGroup { readonly name: string; readonly rows: readonly InspectorRow[] }

export interface InspectorSlot {
  readonly key: string;
  readonly label: string;
  readonly doc: string;
  readonly kinds: readonly string[];
  readonly min: number;
  readonly max: number | null;
  readonly children: readonly Ref[];
}

export interface InspectorModel { readonly groups: readonly InspectorGroup[]; readonly slots: readonly InspectorSlot[] }

export interface InspectorInput {
  readonly schema: PresetSchema;
  /** The preset's own stored params. */
  readonly params: Params;
  /** Effective values (defaults < inherited < own). */
  readonly resolved: Params;
  readonly tier: Tier;
  readonly search?: string;
  readonly children?: Readonly<Record<string, readonly Ref[]>>;
}

const isExpr = (v: Value | undefined): v is { readonly expr: string } =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && typeof (v as { expr?: unknown }).expr === 'string';

function controlFor(def: VariableDef, stored: Value | undefined): Control {
  if (isExpr(stored) || def.type === 'expr') return 'expr';
  switch (def.type) {
    case 'number': case 'int': return def.min !== undefined && def.max !== undefined ? 'slider' : 'number';
    case 'boolean': return 'toggle';
    case 'string': return 'text';
    case 'enum': return 'select';
    case 'color': return 'color';
    case 'vec2': case 'vec3': case 'quat': return 'vector';
    case 'ref': return 'ref';
    case 'curve': return 'curve';
    case 'asset': return 'asset';
    default: return 'list';
  }
}

function matches(def: VariableDef, search: string): boolean {
  const q = search.toLowerCase();
  return def.key.toLowerCase().includes(q) || def.label.toLowerCase().includes(q) || def.doc.toLowerCase().includes(q);
}

/** Turns a schema plus a preset's values into what the inspector draws: tier-filtered, searched, grouped. Pure. */
export function buildInspectorModel(input: InspectorInput): InspectorModel {
  const { schema, params, resolved, tier } = input;
  const search = input.search?.trim() ?? '';
  const order: string[] = [];
  const byGroup = new Map<string, InspectorRow[]>();
  for (const def of schema.variables) {
    if (!visibleAt(def.tier, tier) || (search && !matches(def, search))) continue;
    const stored = params[def.key];
    const shown = resolved[def.key];
    const row: InspectorRow = {
      key: def.key, label: def.label, doc: def.doc, type: def.type, control: controlFor(def, stored), tier: def.tier,
      value: shown !== undefined ? shown : def.default,
      overridden: Object.prototype.hasOwnProperty.call(params, def.key),
      ...(isExpr(stored) ? { expression: stored.expr } : {}),
      ...(def.min !== undefined ? { min: def.min } : {}), ...(def.max !== undefined ? { max: def.max } : {}),
      ...(def.step !== undefined ? { step: def.step } : {}), ...(def.unit !== undefined ? { unit: def.unit } : {}),
      ...(def.options !== undefined ? { options: def.options } : {}),
    };
    const name = def.group ?? 'General';
    if (!byGroup.has(name)) { byGroup.set(name, []); order.push(name); }
    byGroup.get(name)!.push(row);
  }
  // "General" (the ungrouped rows) always comes last
  const names = [...order.filter((n) => n !== 'General'), ...order.filter((n) => n === 'General')];
  const slots = schema.slots
    .filter((s: ChildSlot) => visibleAt(s.tier, tier) && tier !== 'play')
    .map((s: ChildSlot): InspectorSlot => ({ key: s.key, label: s.label, doc: s.doc, kinds: s.kinds, min: s.min, max: s.max, children: input.children?.[s.key] ?? [] }));
  return { groups: names.map((name) => ({ name, rows: byGroup.get(name)! })), slots };
}
