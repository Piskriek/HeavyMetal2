import { TABS, type TabId } from './tabs';
import { TOOLS, type ToolAction, type ToolPreset } from './tools';

/**
 * What the hotbar can select and change, kind by kind (docs/HOTBAR.md section 7; the owner: "make sure the crawler identifies the places
 * where we are lacking the hotbar to edit"). Worked out from the tool presets themselves, so it stays true as tools are added; the screen
 * map prints it with the gaps in red. Pure.
 */
export interface WorldKind { readonly id: string; readonly name: string }
/** Every kind of thing in the world the hotbar should be able to select and change. */
export const WORLD_KINDS: readonly WorldKind[] = [
  { id: 'ground-height', name: 'The ground: its shape' },
  { id: 'ground-surface', name: 'The ground: its surfaces (textures)' },
  { id: 'thing', name: 'A placed thing' },
  { id: 'thing-part', name: "A thing's parts" },
  { id: 'thing-blocks', name: "A thing's blocks (faces, edges, corners)" },
  { id: 'plant', name: 'Plants' },
  { id: 'water', name: 'The sea' },
  { id: 'sky-light', name: 'Sky and light' },
  { id: 'sound', name: 'Sounds' },
  { id: 'track', name: 'The race track' },
  { id: 'race-rules', name: 'Race rules' },
  { id: 'ball-physics', name: "A racing ball's physics" },
  { id: 'avatar', name: 'Your avatar' },
  { id: 'view', name: 'How you move and see' },
];

/** What each tool action selects and changes. */
const ACTS: Readonly<Record<ToolAction, { readonly selects?: readonly string[]; readonly changes?: readonly string[] }>> = {
  inspect: { selects: ['thing'] }, move: { selects: ['thing'], changes: ['thing'] }, turn: { selects: ['thing'], changes: ['thing'] },
  resize: { selects: ['thing'], changes: ['thing'] }, copy: { selects: ['thing'], changes: ['thing'] }, delete: { selects: ['thing'], changes: ['thing'] },
  focus: { selects: ['thing'] }, isolate: { selects: ['thing'] },
  paint: { changes: ['ground-surface'] },
  raise: { changes: ['ground-height'] }, lower: { changes: ['ground-height'] }, smooth: { changes: ['ground-height'] }, flatten: { changes: ['ground-height'] },
  dig: { changes: ['ground-height'] }, mound: { changes: ['ground-height'] }, crater: { changes: ['ground-height'] }, plateau: { changes: ['ground-height'] },
  ridge: { changes: ['ground-height'] }, dune: { changes: ['ground-height'] },
  place: { changes: ['thing'] },
};
/** The tabs that hold presets rather than tools: what picking one of their slots changes today. */
const PRESET_TABS: Readonly<Partial<Record<TabId, readonly string[]>>> = { animate: ['avatar'], sound: ['sound'], lights: ['sky-light'], avatar: ['avatar'], camera: ['view'] };

export interface CoverageRow {
  readonly kind: WorldKind;
  /** Select (F1) can pick it. */
  readonly selectable: boolean;
  /** The tools (or preset tabs) that change it, by tab. */
  readonly changedBy: Readonly<Partial<Record<TabId, readonly string[]>>>;
  /** What is missing, in words, or null when Select can pick it and a tool changes it. */
  readonly gap: string | null;
}

/** The ways of working a tab holds are materials, not ways (every paint tool is one surface): the palette's job (HOTBAR.md section 3). */
export interface DesignGap { readonly id: string; readonly says: string }

export function hotbarCoverage(tools: readonly ToolPreset[] = TOOLS): { readonly rows: readonly CoverageRow[]; readonly design: readonly DesignGap[] } {
  const rows = WORLD_KINDS.map((kind): CoverageRow => {
    const changedBy: Partial<Record<TabId, string[]>> = {};
    let selectable = false;
    for (const t of tools) {
      const a = ACTS[t.action];
      if (t.tab === 'select' && a.selects?.includes(kind.id)) selectable = true;
      if (a.changes?.includes(kind.id)) (changedBy[t.tab] ??= []).push(t.name);
    }
    for (const tab of TABS) { const kinds = PRESET_TABS[tab.id]; if (kinds?.includes(kind.id)) (changedBy[tab.id] ??= []).push(`${tab.label} presets`); }
    const changed = Object.keys(changedBy).length > 0;
    const gap = selectable && changed ? null : !selectable && !changed ? 'Select cannot pick it and no tool changes it' : !selectable ? 'Select cannot pick it' : 'Select picks it but no tool changes it';
    return { kind, selectable, changedBy, gap };
  });
  const design: DesignGap[] = [];
  const paint = tools.filter((t) => t.tab === 'paint');
  if (paint.length && paint.every((t) => t.surface > 0)) design.push({ id: 'paint-materials', says: `Paint holds ${paint.length} surfaces (materials) instead of ways to paint; surfaces belong in the palette` });
  const stamps = tools.filter((t) => t.tab === 'sculpt' && ['mound', 'crater', 'plateau', 'ridge', 'dune'].includes(t.action));
  if (stamps.length) design.push({ id: 'sculpt-shapes', says: `Sculpt mixes ${stamps.length} stamped shapes in with the ways to sculpt; shapes belong in the palette, under one Stamp tool` });
  if (!tools.some((t) => t.tab === 'select' && t.action === 'move')) design.push({ id: 'no-move', says: 'Select has no Move' });
  return { rows, design };
}
