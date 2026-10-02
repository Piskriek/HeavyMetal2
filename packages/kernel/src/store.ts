/**
 * The preset store: the content-addressed, copy-on-write preset graph.
 * Immutable revisions, pinned fork chains, indexed lookups (list/dependents never scan everything).
 */
import {
  hardLimits,
  visibleAt,
  type ImportReport,
  type Issue,
  type Params,
  type Preset,
  type PresetBundle,
  type PresetDraft,
  type PresetFilter,
  type PresetId,
  type PresetSchema,
  type PresetStore,
  type Ref,
  type ResolvedPreset,
  type SchemaRegistry,
  type StoreChange,
  type StoreLimits,
  type Unsubscribe,
} from '@hm/contracts';
import { migrateBundle } from './bundle';
import { hashPresetContent } from './hash';

/** Options for {@link createPresetStore}. `now` and `newId` are injected so logic stays pure. */
export interface PresetStoreOptions {
  readonly schemas: SchemaRegistry;
  readonly limits?: Partial<StoreLimits>;
  readonly now?: () => number;
  readonly newId?: () => string;
}

const DEFAULT_LIMITS: StoreLimits = { maxDepth: 12, maxNodes: 5000, maxBundleBytes: 100_000 };

interface Entry {
  readonly revs: Map<number, Preset>;
  latest: number;
  /** Insertion order, so list() is deterministic without sorting. */
  readonly order: number;
}

const copyChildren = (children: Readonly<Record<string, readonly Ref[]>> | undefined): Record<string, readonly Ref[]> => {
  const out: Record<string, readonly Ref[]> = {};
  for (const [slot, refs] of Object.entries(children ?? {})) {
    out[slot] = refs.map((ref) => (ref.rev === undefined ? { ref: ref.ref } : { ref: ref.ref, rev: ref.rev }));
  }
  return out;
};

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/** Creates an empty preset store backed by the given schema registry. */
export const createPresetStore = (opts: PresetStoreOptions): PresetStore => {
  const schemas = opts.schemas;
  const limits: StoreLimits = { ...DEFAULT_LIMITS, ...opts.limits };
  const now = opts.now ?? ((): number => 0);
  let autoId = 0;
  const newId = opts.newId ?? ((): string => `preset-${++autoId}`);

  const entries = new Map<PresetId, Entry>();
  const byKind = new Map<string, Set<PresetId>>();
  const byTag = new Map<string, Set<PresetId>>();
  const dependentsIdx = new Map<PresetId, Set<PresetId>>();
  const listeners: ((change: StoreChange) => void)[] = [];
  let orderCounter = 0;

  const addTo = (index: Map<string, Set<PresetId>>, key: string, id: PresetId): void => {
    const set = index.get(key);
    if (set === undefined) index.set(key, new Set([id]));
    else set.add(id);
  };
  const removeFrom = (index: Map<string, Set<PresetId>>, key: string, id: PresetId): void => {
    const set = index.get(key);
    if (set === undefined) return;
    set.delete(id);
    if (set.size === 0) index.delete(key);
  };

  const indexPreset = (preset: Preset, add: boolean): void => {
    const apply = add ? addTo : removeFrom;
    apply(byKind, preset.kind, preset.id);
    for (const tag of preset.tags) apply(byTag, tag, preset.id);
    for (const refs of Object.values(preset.children)) {
      for (const ref of refs) apply(dependentsIdx, ref.ref, preset.id);
    }
  };

  const notify = (change: StoreChange): void => {
    for (const listener of [...listeners]) listener(change);
  };

  const get = (id: PresetId, rev?: number): Preset | undefined => {
    const entry = entries.get(id);
    if (entry === undefined) return undefined;
    return entry.revs.get(rev ?? entry.latest);
  };

  /** Writes a fully built preset, keeping the indexes of the LATEST revision correct. */
  const commit = (preset: Preset): void => {
    let entry = entries.get(preset.id);
    if (entry === undefined) {
      entry = { revs: new Map(), latest: 0, order: orderCounter++ };
      entries.set(preset.id, entry);
    }
    const previousLatest = entry.revs.get(entry.latest);
    if (previousLatest !== undefined) indexPreset(previousLatest, false);
    entry.revs.set(preset.revision, preset);
    if (preset.revision > entry.latest) entry.latest = preset.revision;
    const latest = entry.revs.get(entry.latest);
    if (latest !== undefined) indexPreset(latest, true);
    notify({ type: 'put', preset });
  };

  const build = (id: PresetId, revision: number, draft: PresetDraft): Preset => {
    if (typeof draft.kind !== 'string' || draft.kind.length === 0) {
      throw new Error(`Cannot put preset '${id}': 'kind' is required. Give the kind a schema was registered for.`);
    }
    const params: Params = { ...(draft.params ?? {}) };
    const children = copyChildren(draft.children);
    const content = {
      kind: draft.kind,
      name: draft.name,
      params,
      children,
      ...(draft.script !== undefined ? { script: draft.script } : {}),
    };
    return {
      id,
      kind: draft.kind,
      name: draft.name,
      revision,
      hash: hashPresetContent(content),
      ...(draft.forkOf !== undefined ? { forkOf: draft.forkOf } : {}),
      params,
      children,
      ...(draft.script !== undefined ? { script: draft.script } : {}),
      tags: [...(draft.tags ?? [])],
      tier: draft.tier ?? 'build',
      meta: { ...draft.meta, createdAt: draft.meta?.createdAt ?? now() },
    };
  };

  const put = (draft: PresetDraft): Preset => {
    const id = draft.id ?? newId();
    const entry = entries.get(id);
    const preset = build(id, entry === undefined ? 1 : entry.latest + 1, draft);
    commit(preset);
    return preset;
  };

  const fork = (id: PresetId, patch?: Partial<PresetDraft>): Preset => {
    const source = get(id);
    if (source === undefined) {
      throw new Error(`Cannot fork '${id}': no such preset. Check the id or put the preset first.`);
    }
    // A fork keeps only its own overrides: everything else is inherited from the pinned source revision.
    const script = patch?.script ?? source.script;
    const draft: PresetDraft = {
      kind: patch?.kind ?? source.kind,
      name: patch?.name ?? source.name,
      forkOf: { ref: source.id, rev: source.revision },
      params: patch?.params ?? {},
      children: patch?.children ?? source.children,
      ...(script !== undefined ? { script } : {}),
      tags: patch?.tags ?? source.tags,
      tier: patch?.tier ?? source.tier,
      ...(patch?.meta !== undefined ? { meta: patch.meta } : {}),
    };
    const preset = build(patch?.id ?? newId(), 1, draft);
    commit(preset);
    return preset;
  };

  const dependents = (id: PresetId): readonly PresetId[] =>
    [...(dependentsIdx.get(id) ?? [])].filter((other) => other !== id);

  const remove = (id: PresetId): void => {
    const entry = entries.get(id);
    if (entry === undefined) throw new Error(`Cannot remove '${id}': no such preset.`);
    const users = dependents(id);
    if (users.length > 0) {
      throw new Error(
        `Cannot remove '${id}': it is still held by ${users.join(', ')}. Remove those children first (or remove the holders).`,
      );
    }
    const latest = entry.revs.get(entry.latest);
    if (latest !== undefined) indexPreset(latest, false);
    entries.delete(id);
    notify({ type: 'remove', id });
  };

  const latestOf = (id: PresetId): Preset | undefined => get(id);

  const list = (filter?: PresetFilter): readonly Preset[] => {
    // Start from the smallest index the filter allows: never a full scan when kind/tag is given.
    let ids: Iterable<PresetId>;
    const kindSet = filter?.kind === undefined ? undefined : byKind.get(filter.kind) ?? new Set<PresetId>();
    const tagSet = filter?.tag === undefined ? undefined : byTag.get(filter.tag) ?? new Set<PresetId>();
    if (kindSet !== undefined && tagSet !== undefined) ids = kindSet.size <= tagSet.size ? kindSet : tagSet;
    else ids = kindSet ?? tagSet ?? entries.keys();

    const text = filter?.text?.toLowerCase();
    const out: Preset[] = [];
    for (const id of ids) {
      const preset = latestOf(id);
      if (preset === undefined) continue;
      if (filter?.kind !== undefined && preset.kind !== filter.kind) continue;
      if (filter?.tag !== undefined && !preset.tags.includes(filter.tag)) continue;
      if (filter?.tier !== undefined && !visibleAt(preset.tier, filter.tier)) continue;
      if (text !== undefined) {
        const haystack = `${preset.name}\n${preset.tags.join(' ')}\n${preset.meta.doc ?? ''}`.toLowerCase();
        if (!haystack.includes(text)) continue;
      }
      out.push(preset);
    }
    out.sort((a, b) => (entries.get(a.id)?.order ?? 0) - (entries.get(b.id)?.order ?? 0));
    return out;
  };

  const defaultsCache = new Map<string, { schema: PresetSchema; defaults: Params }>();
  const defaultsFor = (kind: string): Params => {
    const schema = schemas.get(kind);
    if (schema === undefined) return {};
    const cached = defaultsCache.get(kind);
    if (cached !== undefined && cached.schema === schema) return cached.defaults;
    const defaults: Record<string, Params[string]> = {};
    for (const variable of schema.variables) defaults[variable.key] = variable.default;
    defaultsCache.set(kind, { schema, defaults });
    return defaults;
  };

  const resolve = (id: PresetId, rev?: number): ResolvedPreset => {
    const preset = get(id, rev);
    if (preset === undefined) {
      throw new Error(`Cannot resolve '${id}'${rev === undefined ? '' : ` revision ${rev}`}: no such preset.`);
    }
    const chain: Preset[] = [preset];
    const seen = new Set<string>([`${preset.id}@${preset.revision}`]);
    let current = preset;
    while (current.forkOf !== undefined) {
      const source = get(current.forkOf.ref, current.forkOf.rev);
      if (source === undefined) {
        throw new Error(
          `Cannot resolve '${id}': its fork source '${current.forkOf.ref}' is missing. Import the source preset or clear forkOf.`,
        );
      }
      const key = `${source.id}@${source.revision}`;
      if (seen.has(key)) {
        throw new Error(`Cannot resolve '${id}': its fork chain loops at '${key}'. Fork chains must not be circular.`);
      }
      seen.add(key);
      chain.push(source);
      current = source;
    }
    let params: Params = { ...defaultsFor(preset.kind) };
    for (let i = chain.length - 1; i >= 0; i--) params = { ...params, ...chain[i]!.params };
    return { preset, params, chain };
  };

  const checkOwn = (preset: Preset, issues: Issue[]): void => {
    const schema = schemas.get(preset.kind);
    if (schema === undefined) {
      issues.push({
        severity: 'warning',
        code: 'unknown-kind',
        message: `No schema is registered for kind '${preset.kind}'. Register one before using this preset.`,
        presetId: preset.id,
      });
    } else {
      for (const [key, value] of Object.entries(preset.params)) {
        const def = schema.variables.find((variable) => variable.key === key);
        if (def === undefined) {
          issues.push({
            severity: 'error',
            code: 'unknown-param',
            message: `'${key}' is not a variable of '${preset.kind}'. Remove it or declare it in the schema.`,
            presetId: preset.id,
            path: key,
          });
          continue;
        }
        if (typeof value === 'number') {
          const { lo, hi } = hardLimits(def);
          if (value < lo || value > hi) {
            issues.push({
              severity: 'error',
              code: 'param-range',
              message: `'${key}' is ${value} but must be between ${lo === -Infinity ? '-inf' : lo} and ${hi === Infinity ? '+inf' : hi}.`,
              presetId: preset.id,
              path: key,
            });
          }
        }
      }
    }
    for (const [slotKey, refs] of Object.entries(preset.children)) {
      const slot = schema?.slots.find((candidate) => candidate.key === slotKey);
      if (schema !== undefined && slot === undefined) {
        issues.push({
          severity: 'error',
          code: 'slot-kind',
          message: `'${preset.kind}' has no slot '${slotKey}'. Use one of: ${schema.slots.map((s) => s.key).join(', ') || '(none)'}.`,
          presetId: preset.id,
          path: slotKey,
        });
      }
      refs.forEach((ref, index) => {
        const child = get(ref.ref, ref.rev);
        if (child === undefined) {
          issues.push({
            severity: 'error',
            code: 'missing-ref',
            message: `Child '${ref.ref}' in slot '${slotKey}' does not exist. Import it or remove the reference.`,
            presetId: preset.id,
            path: `${slotKey}[${index}]`,
          });
          return;
        }
        if (slot !== undefined && !slot.kinds.includes(child.kind)) {
          issues.push({
            severity: 'error',
            code: 'slot-kind',
            message: `Slot '${slotKey}' takes ${slot.kinds.join(' or ')}, but '${child.id}' is a '${child.kind}'.`,
            presetId: preset.id,
            path: `${slotKey}[${index}]`,
          });
        }
      });
    }
  };

  const checkGraph = (root: Preset, issues: Issue[]): void => {
    const minDepth = new Map<PresetId, number>();
    const flags = { cycle: false, depth: false, nodes: false };
    const visited = new Set<PresetId>();
    const walk = (preset: Preset, path: Set<PresetId>, depth: number): void => {
      if (path.has(preset.id)) {
        if (!flags.cycle) {
          flags.cycle = true;
          issues.push({
            severity: 'error',
            code: 'cycle',
            message: `'${preset.id}' contains itself through its children. Break the loop: a preset may not hold an ancestor.`,
            presetId: preset.id,
          });
        }
        return;
      }
      if (depth > limits.maxDepth) {
        if (!flags.depth) {
          flags.depth = true;
          issues.push({
            severity: 'error',
            code: 'depth',
            message: `Nesting is deeper than ${limits.maxDepth} levels at '${preset.id}'. Flatten the tree.`,
            presetId: preset.id,
          });
        }
        return;
      }
      const seenAt = minDepth.get(preset.id);
      if (seenAt !== undefined && seenAt <= depth) return; // Already explored at least this far up: nothing new below.
      minDepth.set(preset.id, depth);
      visited.add(preset.id);
      if (visited.size > limits.maxNodes) {
        if (!flags.nodes) {
          flags.nodes = true;
          issues.push({
            severity: 'error',
            code: 'nodes',
            message: `More than ${limits.maxNodes} presets are reachable from '${root.id}'. Split it into smaller bundles.`,
            presetId: root.id,
          });
        }
        return;
      }
      path.add(preset.id);
      for (const refs of Object.values(preset.children)) {
        for (const ref of refs) {
          const child = get(ref.ref, ref.rev);
          if (child !== undefined) walk(child, path, depth + 1);
        }
      }
      path.delete(preset.id);
    };
    walk(root, new Set(), 1);
  };

  const validate = (id: PresetId): readonly Issue[] => {
    const preset = get(id);
    if (preset === undefined) throw new Error(`Cannot validate '${id}': no such preset.`);
    const issues: Issue[] = [];
    checkOwn(preset, issues);
    checkGraph(preset, issues);
    return issues;
  };

  const exportBundle = (root: PresetId): PresetBundle => {
    const rootPreset = get(root);
    if (rootPreset === undefined) throw new Error(`Cannot export '${root}': no such preset.`);
    const collected = new Map<string, Preset>();
    const stack: Preset[] = [rootPreset];
    while (stack.length > 0) {
      const preset = stack.pop() as Preset;
      const key = `${preset.id}@${preset.revision}`;
      if (collected.has(key)) continue;
      collected.set(key, preset);
      for (const refs of Object.values(preset.children)) {
        for (const ref of refs) {
          const child = get(ref.ref, ref.rev);
          if (child !== undefined) stack.push(child);
        }
      }
      if (preset.forkOf !== undefined) {
        const source = get(preset.forkOf.ref, preset.forkOf.rev);
        if (source !== undefined) stack.push(source);
      }
    }
    const presets = [...collected.values()].sort((a, b) =>
      a.id === b.id ? a.revision - b.revision : a.id < b.id ? -1 : 1,
    );
    const schemaVersions: Record<string, number> = {};
    for (const preset of presets) {
      const schema = schemas.get(preset.kind);
      if (schema !== undefined) schemaVersions[preset.kind] = schema.version;
    }
    const bundle: PresetBundle = { format: 'hm-bundle', version: 1, root, presets, schemaVersions };
    const bytes = byteLength(JSON.stringify(bundle));
    if (bytes > limits.maxBundleBytes) {
      throw new Error(
        `Bundle for '${root}' is ${bytes} bytes, over the limit of ${limits.maxBundleBytes} bytes. Remove presets, shorten names or raise limits.maxBundleBytes.`,
      );
    }
    return bundle;
  };

  const importBundle = (
    bundle: PresetBundle,
    options?: { readonly onConflict?: 'keep' | 'replace' | 'rename' },
  ): ImportReport => {
    const migrated = migrateBundle(bundle, schemas);
    const onConflict = options?.onConflict ?? 'keep';
    const issues: Issue[] = [];
    const renamed: Record<PresetId, PresetId> = {};

    if (onConflict === 'rename') {
      for (const preset of migrated.presets) {
        if (renamed[preset.id] !== undefined) continue;
        let fresh = newId();
        while (entries.has(fresh) || Object.values(renamed).includes(fresh)) fresh = newId();
        renamed[preset.id] = fresh;
      }
    }
    const remap = (ref: Ref): Ref => {
      const target = renamed[ref.ref];
      if (target === undefined) return ref;
      return ref.rev === undefined ? { ref: target } : { ref: target, rev: ref.rev };
    };

    const ordered = [...migrated.presets].sort((a, b) =>
      a.id === b.id ? a.revision - b.revision : a.id < b.id ? -1 : 1,
    );
    const createdHere = new Set<PresetId>();
    let imported = 0;
    let skipped = 0;
    for (const preset of ordered) {
      if (schemas.get(preset.kind) === undefined) {
        issues.push({
          severity: 'warning',
          code: 'unknown-kind',
          message: `Imported '${preset.id}' of kind '${preset.kind}' without a registered schema. Install the pack that defines it.`,
          presetId: preset.id,
        });
      }
      const targetId = renamed[preset.id] ?? preset.id;
      if (entries.has(targetId) && !createdHere.has(targetId) && onConflict === 'keep') {
        skipped++;
        continue;
      }
      const children = copyChildren(preset.children);
      for (const [slot, refs] of Object.entries(children)) children[slot] = refs.map(remap);
      const forkOf = preset.forkOf === undefined ? undefined : remap(preset.forkOf);
      const content = {
        kind: preset.kind,
        name: preset.name,
        params: { ...preset.params },
        children,
        ...(preset.script !== undefined ? { script: preset.script } : {}),
      };
      commit({
        ...preset,
        id: targetId,
        ...(forkOf !== undefined ? { forkOf } : {}),
        params: content.params,
        children,
        tags: [...preset.tags],
        hash: hashPresetContent(content),
      });
      createdHere.add(targetId);
      imported++;
    }
    return { imported, skipped, renamed, issues };
  };

  const subscribe = (listener: (change: StoreChange) => void): Unsubscribe => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  };

  return { limits, get, put, fork, remove, list, resolve, dependents, validate, exportBundle, importBundle, subscribe };
};
