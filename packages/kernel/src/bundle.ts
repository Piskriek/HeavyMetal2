/**
 * Bundles: the shareable JSON file (one root plus everything it reaches) and the two pure
 * functions that work on it - migrateBundle (upgrade old saves) and hashBundle (identity).
 */
import type { Params, Preset, PresetBundle, PresetKind, SchemaRegistry } from '@hm/contracts';
import { hashPresetContent, hashValue } from './hash';
import { asKernelRegistry, type KernelSchemaRegistry } from './schema-registry';

const migratePreset = (preset: Preset, from: number, to: number, registry: KernelSchemaRegistry): Preset => {
  let params: Params = preset.params;
  let changed = false;
  for (let version = from; version < to; version++) {
    const migrate = registry.getMigration(preset.kind, version);
    if (migrate === undefined) continue; // A version with no migration means "params did not change shape".
    params = migrate(params);
    changed = true;
  }
  if (!changed) return preset;
  return {
    ...preset,
    params,
    hash: hashPresetContent({
      kind: preset.kind,
      name: preset.name,
      params,
      children: preset.children,
      ...(preset.script !== undefined ? { script: preset.script } : {}),
    }),
  };
};

/**
 * Upgrades every preset in a bundle from the schema versions it was exported with to the current ones.
 * Unknown kinds (no schema registered) pass through untouched.
 */
export const migrateBundle = (bundle: PresetBundle, schemas: SchemaRegistry): PresetBundle => {
  const registry = asKernelRegistry(schemas);
  const versions: Record<string, number> = { ...bundle.schemaVersions };

  const presets = bundle.presets.map((preset) => {
    const schema = registry.get(preset.kind as PresetKind);
    if (schema === undefined) return preset;
    const from = bundle.schemaVersions[preset.kind] ?? schema.version;
    if (from > schema.version) {
      throw new Error(
        `Bundle '${bundle.root}' holds '${preset.kind}' at schema version ${from}, but this build only knows version ${schema.version}. Update the app before importing it.`,
      );
    }
    return migratePreset(preset, from, schema.version, registry);
  });

  for (const kind of new Set(presets.map((preset) => preset.kind))) {
    const schema = registry.get(kind as PresetKind);
    if (schema !== undefined) versions[kind] = schema.version;
  }

  return { ...bundle, presets, schemaVersions: versions };
};

/** A stable hash of a bundle's content: independent of the order the presets happen to be listed in. */
export const hashBundle = (bundle: PresetBundle): string => {
  const presets = [...bundle.presets].sort((a, b) => (a.id === b.id ? a.revision - b.revision : a.id < b.id ? -1 : 1));
  return hashValue({
    format: bundle.format,
    version: bundle.version,
    root: bundle.root,
    schemaVersions: bundle.schemaVersions,
    presets: presets.map((preset) => ({
      id: preset.id,
      revision: preset.revision,
      kind: preset.kind,
      name: preset.name,
      hash: preset.hash,
      forkOf: preset.forkOf,
      params: preset.params,
      children: preset.children,
      script: preset.script,
      tags: [...preset.tags],
      tier: preset.tier,
    })),
  });
};
