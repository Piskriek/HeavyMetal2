/**
 * Pure logic for the build-mode interface: what a tool says about itself on screen, and the held-Tab preset palette.
 * No DOM, no clock, no randomness: the island feeds it key and wheel events and draws what it answers.
 */

/* ------------------------------ the palette (hold Tab) ------------------------------ */

export interface PaletteItem { readonly id: string; readonly label: string }
export interface PaletteCategory { readonly id: string; readonly label: string; readonly items: readonly PaletteItem[] }
export interface PaletteChoice { readonly category: string; readonly id: string }

/**
 * The preset palette. Hold Tab to open it, turn the wheel to move through the items of the open category, press a category key to switch
 * category, let go of Tab to keep the highlighted item (Esc while holding puts the old one back). It never takes the pointer: the world stays live.
 */
export class PaletteWheel {
  private openNow = false;
  private cat = 0;
  private index: number[];
  private before: { cat: number; index: number[] } | null = null;
  private chosen: PaletteChoice | null = null;

  constructor(readonly categories: readonly PaletteCategory[], initial?: PaletteChoice) {
    this.index = categories.map(() => 0);
    if (initial) this.select(initial);
    this.chosen = this.current();
  }

  get isOpen(): boolean { return this.openNow; }
  get categoryIndex(): number { return this.cat; }
  get itemIndex(): number { return this.index[this.cat] ?? 0; }

  /** What is highlighted now (null when there are no items at all). */
  current(): PaletteChoice | null {
    const c = this.categories[this.cat];
    const item = c?.items[this.index[this.cat] ?? 0];
    return c && item ? { category: c.id, id: item.id } : null;
  }

  /** The last choice that was kept (what tools use). */
  get choice(): PaletteChoice | null { return this.chosen; }

  select(choice: PaletteChoice): boolean {
    const ci = this.categories.findIndex((c) => c.id === choice.category);
    if (ci < 0) return false;
    const ii = this.categories[ci]!.items.findIndex((i) => i.id === choice.id);
    if (ii < 0) return false;
    this.cat = ci;
    this.index[ci] = ii;
    if (!this.openNow) this.chosen = this.current();
    return true;
  }

  press(): void {
    if (this.openNow) return;
    this.openNow = true;
    this.before = { cat: this.cat, index: [...this.index] };
  }

  /** dir > 0 moves forward, < 0 back; wraps. Ignored while closed. */
  wheel(dir: number): void {
    if (!this.openNow || dir === 0 || !Number.isFinite(dir)) return;
    const items = this.categories[this.cat]?.items.length ?? 0;
    if (items === 0) return;
    this.index[this.cat] = ((this.index[this.cat] ?? 0) + (dir > 0 ? 1 : -1) + items) % items;
  }

  /** Move to the next (dir > 0) or previous category. */
  switchCategory(dir: number): void {
    if (!this.openNow || dir === 0 || this.categories.length === 0) return;
    this.cat = (this.cat + (dir > 0 ? 1 : -1) + this.categories.length) % this.categories.length;
  }

  /** Tab let go: keep what is highlighted. Returns it. */
  release(): PaletteChoice | null {
    if (!this.openNow) return this.chosen;
    this.openNow = false;
    this.before = null;
    this.chosen = this.current();
    return this.chosen;
  }

  /** Esc while holding: close and put the old choice back. */
  cancel(): void {
    if (!this.openNow) return;
    this.openNow = false;
    if (this.before) { this.cat = this.before.cat; this.index = this.before.index; }
    this.before = null;
  }
}

/* ------------------------------ what a tool says about itself ------------------------------ */

export interface ToolSayInput {
  readonly setLabel: string;
  readonly subName: string;
  readonly doc: string;
  readonly primary: string;
  readonly secondary: string;
  /** Whether the sub-tool does something in the world yet. */
  readonly wired: boolean;
}
export interface ToolSay { readonly title: string; readonly line: string; readonly left: string; readonly right: string; readonly note: string | null }

/** The words shown on screen while a tool is in hand: its name, what it is for, and what each mouse button does. Controls themselves live in Settings. */
export function describeTool(t: ToolSayInput): ToolSay {
  const clean = (s: string): string => s.trim().replace(/\s+/g, ' ');
  return {
    title: `${clean(t.setLabel)}: ${clean(t.subName)}`,
    line: clean(t.doc),
    left: clean(t.primary) || 'Use',
    right: clean(t.secondary) || 'Nothing yet',
    note: t.wired ? null : 'This tool is not built into the island yet. It is in the list so you can see what is coming.',
  };
}

/* ------------------------------ a small recent-tools list ------------------------------ */

/** The last few distinct tools used, newest first (for a quick-switch row). */
export function pushRecent(list: readonly string[], id: string, max = 6): string[] {
  const next = [id, ...list.filter((x) => x !== id)];
  return next.slice(0, Math.max(1, max));
}

export * from './tabs';
export * from './tools';
export * from './plugs';
export * from './coverage';
export * from './logic';
export * from './effects';
export * from './sounds';
export * from './characters';
export * from './physics';
