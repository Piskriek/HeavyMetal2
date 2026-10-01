/**
 * The schema registry: the single place that knows what a kind of preset is made of.
 * Everything else (inspector, validation, defaults, migrations) is generated from these declarations.
 */
import {
  visibleAt,
  type Params,
  type PresetKind,
  type PresetSchema,
  type SchemaRegistry,
  type Tier,
  type VariableDef,
} from '@hm/contracts';

/** Upgrades the params of one preset by exactly one schema version. */
export type MigrateFn = (params: Params) => Params;

/** The registry as the kernel uses it: the public contract plus read access to registered migrations. */
export interface KernelSchemaRegistry extends SchemaRegistry {
  /** The migration registered for `kind` that upgrades params from `fromVersion` to `fromVersion + 1`. */
  getMigration(kind: PresetKind, fromVersion: number): MigrateFn | undefined;
}

/** Narrows a contract registry to the kernel one, with a clear error if it came from somewhere else. */
export const asKernelRegistry = (registry: SchemaRegistry): KernelSchemaRegistry => {
  const candidate = registry as Partial<KernelSchemaRegistry>;
  if (typeof candidate.getMigration !== 'function') {
    throw new Error(
      'This SchemaRegistry does not expose getMigration(). Create registries with createSchemaRegistry() from @hm/kernel so migrations can be read.',
    );
  }
  return registry as KernelSchemaRegistry;
};

const checkVariable = (schema: PresetSchema, variable: VariableDef, problems: string[]): void => {
  const where = `variable '${variable.key}'`;
  if (variable.type === 'enum' && (variable.options === undefined || variable.options.length === 0)) {
    problems.push(`${where} is an 'enum' but has no options: add options: ['a', 'b', ...].`);
  }
  if (variable.type === 'ref' && (variable.refKinds === undefined || variable.refKinds.length === 0)) {
    problems.push(`${where} is a 'ref' but has no refKinds: list the kinds it may point at.`);
  }
  if (variable.type === 'list' && variable.itemType === undefined) {
    problems.push(`${where} is a 'list' but has no itemType: say what the items are.`);
  }
  const { min, max } = variable;
  if (min !== undefined && max !== undefined && min > max) {
    problems.push(`${where} has min ${min} greater than max ${max}: swap them.`);
  }
  if (typeof variable.default === 'number') {
    if (min !== undefined && variable.default < min) {
      problems.push(`${where} has default ${variable.default} below min ${min}: raise the default or lower min.`);
    }
    if (max !== undefined && variable.default > max) {
      problems.push(`${where} has default ${variable.default} above max ${max}: lower the default or raise max.`);
    }
  }
  if (variable.key.length === 0) problems.push(`${schema.kind} has a variable with an empty key: give it a key.`);
};

const checkSchema = (schema: PresetSchema): void => {
  const problems: string[] = [];
  const seenVariables = new Set<string>();
  for (const variable of schema.variables) {
    if (seenVariables.has(variable.key)) {
      problems.push(`variable '${variable.key}' is declared twice: keys must be unique inside a kind.`);
    }
    seenVariables.add(variable.key);
    checkVariable(schema, variable, problems);
  }
  const seenSlots = new Set<string>();
  for (const slot of schema.slots) {
    if (seenSlots.has(slot.key)) problems.push(`slot '${slot.key}' is declared twice: slot keys must be unique.`);
    seenSlots.add(slot.key);
    if (slot.kinds.length === 0) problems.push(`slot '${slot.key}' accepts no kinds: list at least one kind.`);
    if (slot.max !== null && slot.min > slot.max) {
      problems.push(`slot '${slot.key}' has min ${slot.min} greater than max ${slot.max}: swap them.`);
    }
  }
  if (!Number.isInteger(schema.version) || schema.version < 1) {
    problems.push(`version must be a whole number of at least 1, got ${String(schema.version)}.`);
  }
  if (problems.length > 0) {
    throw new Error(`Cannot register schema '${schema.kind}': ${problems.join(' ')}`);
  }
};

/** Creates an empty schema registry. */
export const createSchemaRegistry = (): KernelSchemaRegistry => {
  const schemas = new Map<PresetKind, PresetSchema>();
  // key: `${kind}@${fromVersion}` -> one-step migration.
  const migrations = new Map<string, MigrateFn>();

  const registry: KernelSchemaRegistry = {
    register(schema: PresetSchema): void {
      checkSchema(schema);
      schemas.set(schema.kind, schema);
    },
    get(kind: PresetKind): PresetSchema | undefined {
      return schemas.get(kind);
    },
    kinds(): readonly PresetKind[] {
      return [...schemas.keys()];
    },
    variablesFor(kind: PresetKind, tier: Tier): readonly VariableDef[] {
      const schema = schemas.get(kind);
      if (schema === undefined) return [];
      return schema.variables.filter((variable) => visibleAt(variable.tier, tier));
    },
    registerMigration(kind: PresetKind, fromVersion: number, migrate: MigrateFn): void {
      if (!Number.isInteger(fromVersion) || fromVersion < 1) {
        throw new Error(
          `Cannot register a migration for '${kind}': fromVersion must be a whole number of at least 1, got ${String(fromVersion)}.`,
        );
      }
      migrations.set(`${kind}@${fromVersion}`, migrate);
    },
    getMigration(kind: PresetKind, fromVersion: number): MigrateFn | undefined {
      return migrations.get(`${kind}@${fromVersion}`);
    },
  };
  return registry;
};
