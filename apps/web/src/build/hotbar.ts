import type { BurstDef } from '@hm/render';

/**
 * The hotbar and the creative inventory. A hotbar slot holds a "button": what it does (a tool), the sprite it plays and the sound it makes.
 * Every use is satisfying by default. These are plain data today; the plug system (button presets with attributes) replaces the literals.
 */
export type ToolKind = 'sculpt' | 'dig' | 'paint' | 'flatten' | 'smooth' | 'place' | 'pick' | 'delete';
export type SpriteId = 'dust' | 'sparkle' | 'debris' | 'pop' | 'leaf' | 'splash';
export type SoundId = 'sculpt-tick' | 'paint-tick' | 'place' | 'delete' | 'select' | 'snap' | 'ui-success';

export interface HotItem {
  readonly id: string;
  readonly label: string;
  readonly kind: ToolKind;
  /** exact lucide-react icon name */
  readonly icon: string;
  readonly sprite: SpriteId;
  readonly sound: SoundId;
  /** brush radius in metres (tools) */
  readonly size: number;
  /** voxel model id for `place` */
  readonly model?: string;
  /** painted surface for `paint` */
  readonly surface?: number;
  readonly doc: string;
  /** brush strength 0..1 (tools); the tool's own default when left out */
  readonly strength?: number;
  /** what the left and right mouse buttons do with this item, in words for the screen */
  readonly left?: string;
  readonly right?: string;
}

export type SpriteDef = Omit<BurstDef, 'position' | 'normal'>;
export const SPRITES: Readonly<Record<SpriteId, SpriteDef>> = {
  dust: { count: 26, colors: ['#e3d3ad', '#cdbb93', '#f3e8cc'], size: 1.1, lifeMs: 650, speed: 3.2, spread: 0.9, gravity: -0.6 },
  sparkle: { count: 22, colors: ['#ffe7a1', '#ffb86b', '#ffffff'], size: 0.7, lifeMs: 800, speed: 4.2, spread: 1, gravity: 3, additive: true },
  debris: { count: 18, colors: ['#8a6a46', '#6e5a3e', '#a58760'], size: 0.55, lifeMs: 900, speed: 5.2, spread: 0.7, gravity: 14 },
  pop: { count: 30, colors: ['#ff2e88', '#ffd24a', '#7bd88f', '#6ab7ff'], size: 0.8, lifeMs: 700, speed: 6, spread: 1, gravity: 6 },
  leaf: { count: 20, colors: ['#5fa05a', '#7fc06a', '#3f7a42'], size: 0.7, lifeMs: 1100, speed: 3.6, spread: 1, gravity: 2.5 },
  splash: { count: 24, colors: ['#bfe7f2', '#8fd0e4', '#ffffff'], size: 0.8, lifeMs: 700, speed: 4.6, spread: 0.85, gravity: 12 },
};

export const INVENTORY: readonly HotItem[] = [
  { id: 'pick', label: 'Pick', kind: 'pick', icon: 'MousePointer2', sprite: 'pop', sound: 'select', size: 1, doc: 'Look at something: its name and what it is made of.' },
  { id: 'paint', label: 'Paint', kind: 'paint', icon: 'Brush', sprite: 'sparkle', sound: 'paint-tick', size: 4, surface: 4, doc: 'Paint the ground with grass.' },
  { id: 'sculpt', label: 'Raise', kind: 'sculpt', icon: 'Mountain', sprite: 'dust', sound: 'sculpt-tick', size: 5, doc: 'Pull the ground up. Shift lowers it.' },
  { id: 'flatten', label: 'Flatten', kind: 'flatten', icon: 'Minus', sprite: 'dust', sound: 'sculpt-tick', size: 6, doc: 'Make the ground level with where you point.' },
  { id: 'smooth', label: 'Smooth', kind: 'smooth', icon: 'Waves', sprite: 'sparkle', sound: 'sculpt-tick', size: 6, doc: 'Soften bumps.' },
  { id: 'dig', label: 'Dig', kind: 'dig', icon: 'Shovel', sprite: 'debris', sound: 'delete', size: 4, doc: 'Dig the ground away.' },
  { id: 'barrel', label: 'Barrel', kind: 'place', icon: 'Package', sprite: 'pop', sound: 'place', size: 1, model: 'barrel', doc: 'Place a voxel barrel.' },
  { id: 'palm', label: 'Palm', kind: 'place', icon: 'TreePalm', sprite: 'leaf', sound: 'place', size: 1, model: 'palm', doc: 'Plant a voxel palm.' },
  { id: 'rock', label: 'Rock', kind: 'place', icon: 'Gem', sprite: 'debris', sound: 'place', size: 1, model: 'rock', doc: 'Drop a mossy rock.' },
  { id: 'trophy', label: 'Trophy', kind: 'place', icon: 'Trophy', sprite: 'sparkle', sound: 'ui-success', size: 1, model: 'trophy', doc: 'Put a golden trophy down.' },
  { id: 'plinth', label: 'Plinth', kind: 'place', icon: 'Square', sprite: 'dust', sound: 'place', size: 1, model: 'statue-plinth', doc: 'A plinth for a statue.' },
  { id: 'goblin', label: 'Goblin', kind: 'place', icon: 'Smile', sprite: 'pop', sound: 'ui-success', size: 1, model: 'goblin', doc: 'Place a goblin statue.' },
];

const byId = (id: string): HotItem | null => INVENTORY.find((i) => i.id === id) ?? null;
export const DEFAULT_HOTBAR: readonly (string | null)[] = ['pick', 'paint', 'sculpt', 'flatten', 'smooth', 'dig', 'barrel', 'palm', null];
const KEY = 'hm.hotbar.v1';
const KINDS: readonly string[] = ['sculpt', 'dig', 'paint', 'flatten', 'smooth', 'place', 'pick', 'delete'];

/** Items made from catalog tools carry their own size, surface and model, so they are saved whole; plain inventory items are saved by id. */
function revive(x: unknown): HotItem | null {
  if (typeof x === 'string') return byId(x);
  if (x === null || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || typeof o['label'] !== 'string' || typeof o['icon'] !== 'string' || !KINDS.includes(String(o['kind'])) || !Number.isFinite(Number(o['size']))) return null;
  const base = byId(String(o['id'])) ?? INVENTORY.find((i) => i.kind === o['kind']) ?? INVENTORY[0]!;
  return { ...base, ...(o as unknown as HotItem) };
}

export function loadHotbar(): (HotItem | null)[] {
  let raw: readonly unknown[] = DEFAULT_HOTBAR;
  try { const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown; if (Array.isArray(parsed) && parsed.length === 9) raw = parsed; } catch { /* defaults */ }
  return raw.map(revive);
}
export function saveHotbar(slots: readonly (HotItem | null)[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(slots.map((s) => (s ? (s.id.includes('.') ? s : s.id) : null)))); } catch { /* storage unavailable */ }
}
