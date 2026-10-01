import type { Issue, Params, PresetId, PresetKind, Ref, Tier, Unsubscribe, Value } from './core';

/** Source code carried by a preset (the "Pro" tier). Compiled in the browser and run in a sandbox (see script.ts). */
export interface ScriptSource {
  readonly language: 'ts';
  readonly source: string;
  /** SCRIPT_API_VERSION it was written against. */
  readonly apiVersion: number;
}

/**
 * THE one node type. A game, a track, a ball, a tool, a mechanic, a material and a UI skin are all presets.
 * A preset is IMMUTABLE: editing makes a new revision of the same id; forking makes a new id that remembers its source.
 */
export interface Preset {
  readonly id: PresetId;
  readonly kind: PresetKind;
  readonly name: string;
  /** 1 for the first version; each edit adds one. */
  readonly revision: number;
  /** Content hash of kind, name, params, children and script (not of meta). Equal hash = equal content. */
  readonly hash: string;
  /** The preset this was forked from. Unset params are inherited from it, then from the schema defaults. */
  readonly forkOf?: Ref;
  /** ONLY the values that differ from what would be inherited. Small on purpose: presets are shared as JSON (RUN UGC is 100 KB). */
  readonly params: Params;
  /** Slot key -> presets held in that slot, in order. */
  readonly children: Readonly<Record<string, readonly Ref[]>>;
  readonly script?: ScriptSource;
  readonly tags: readonly string[];
  /** The simplest UI tier that lists this preset in its browser. A draft that does not say defaults to 'build'. */
  readonly tier: Tier;
  readonly meta: {
    readonly author?: string;
    readonly createdAt: number;
    readonly doc?: string;
    readonly icon?: string;
  };
}

/** What a caller supplies to create or revise a preset. Missing fields default (empty params, no children...). */
export interface PresetDraft {
  /** Omit to create a new preset; give an existing id to add a revision. */
  readonly id?: PresetId;
  readonly kind: PresetKind;
  readonly name: string;
  readonly forkOf?: Ref;
  readonly params?: Params;
  readonly children?: Readonly<Record<string, readonly Ref[]>>;
  readonly script?: ScriptSource;
  readonly tags?: readonly string[];
  readonly tier?: Tier;
  readonly meta?: Partial<Preset['meta']>;
}

/** A preset with its inheritance chain resolved: defaults < fork sources < own params. */
export interface ResolvedPreset {
  readonly preset: Preset;
  readonly params: Params;
  /** The chain that was applied, nearest first (the preset itself, its fork source, ...). */
  readonly chain: readonly Preset[];
}

export interface StoreLimits {
  /** Deepest allowed nesting of children (cycle guard and runtime guard). */
  readonly maxDepth: number;
  /** Most presets reachable from one root. */
  readonly maxNodes: number;
  /** Largest exported bundle in bytes (RUN UGC allows 100_000). */
  readonly maxBundleBytes: number;
}

export type StoreChange =
  | { readonly type: 'put'; readonly preset: Preset }
  | { readonly type: 'remove'; readonly id: PresetId };

/** The file a user shares or publishes: one root and everything it reaches. Plain JSON. */
export interface PresetBundle {
  readonly format: 'hm-bundle';
  readonly version: number;
  readonly root: PresetId;
  readonly presets: readonly Preset[];
  /** Schema version per kind at export time, so import can migrate. */
  readonly schemaVersions: Readonly<Record<string, number>>;
}

export interface ImportReport {
  readonly imported: number;
  readonly skipped: number;
  readonly renamed: Readonly<Record<PresetId, PresetId>>;
  readonly issues: readonly Issue[];
}

export interface PresetFilter {
  readonly kind?: PresetKind;
  readonly tag?: string;
  /** Show presets up to this tier. */
  readonly tier?: Tier;
  /** Case-insensitive match on name, tags and doc. */
  readonly text?: string;
}

/** The preset graph. Content-addressed, copy-on-write, cycle-safe. Port target: the plan zip's graph.ts / authoring.ts. */
export interface PresetStore {
  readonly limits: StoreLimits;
  /** A revision; omit `rev` for the latest. */
  get(id: PresetId, rev?: number): Preset | undefined;
  put(draft: PresetDraft): Preset;
  /** A new preset (new id, revision 1) with `forkOf` set; `patch` overrides fields of the copy. */
  fork(id: PresetId, patch?: Partial<PresetDraft>): Preset;
  /** Removes all revisions. Refuses (throws) if another preset still references it. */
  remove(id: PresetId): void;
  list(filter?: PresetFilter): readonly Preset[];
  resolve(id: PresetId, rev?: number): ResolvedPreset;
  /** Presets whose children reference `id`. */
  dependents(id: PresetId): readonly PresetId[];
  /**
   * Issue codes: about THIS preset only: 'missing-ref' (a child that does not exist), 'slot-kind' (a child of a kind the slot does not take),
   * 'param-range' (outside min/max), 'unknown-param' (a key the schema does not declare). About everything reachable from it:
   * 'cycle', 'depth' (> limits.maxDepth), 'nodes' (> limits.maxNodes).
   */
  validate(id: PresetId): readonly Issue[];
  exportBundle(root: PresetId): PresetBundle;
  importBundle(bundle: PresetBundle, opts?: { readonly onConflict?: 'keep' | 'replace' | 'rename' }): ImportReport;
  subscribe(listener: (change: StoreChange) => void): Unsubscribe;
}

/** Deep-readonly helper used by contracts and tests. */
export type Json = Value;
