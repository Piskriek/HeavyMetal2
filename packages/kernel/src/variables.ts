/**
 * The variable system: one address space for every tunable thing.
 * A VarPath is either "<presetId>.<param key>" (split at the FIRST dot, so param keys may be dotted)
 * or "<scheme>:<rest>" routed to a registered provider. Reads see live bindings first, then the
 * resolved preset param (schema defaults < fork chain < own params); a stored {expr} value is
 * evaluated on read. Bindings are overlays: they are never stored as revisions.
 */
import type {
  CompiledExpr,
  EventBus,
  Issue,
  PresetStore,
  SchemaRegistry,
  Unsubscribe,
  Value,
  VariableDef,
  VariableHit,
  VariableProvider,
  VariableSystem,
  VarPath,
} from '@hm/contracts';
import { compileExpression, type CompiledExpression, type ExprValue } from './expr';
import { stableStringify } from './hash';

/** Options for {@link createVariableSystem}. `compile` is injectable so tests can supply a fake compiler. */
export interface VariableSystemOptions {
  readonly store: PresetStore;
  readonly schemas: SchemaRegistry;
  readonly events: EventBus;
  readonly compile?: (source: string) => CompiledExpression;
}

interface Binding {
  readonly reads: readonly string[];
  readonly evaluate: () => Value | undefined;
}

type Observer = (value: Value | undefined, previous: Value | undefined) => void;

const isExprRecord = (value: Value | undefined): value is { readonly expr: string } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { expr?: unknown }).expr === 'string';

/** Converts a stored Value into something the expression evaluator accepts, or explains why it cannot. */
const toExprValue = (value: Value | undefined, where: string): ExprValue | undefined => {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => toExprValue(item as Value, where) ?? null);
  throw new Error(
    `Cannot use '${where}' in an expression: it holds an object. Expressions read numbers, strings, booleans, null and lists.`,
  );
};

/** Creates the variable system over a preset store, its schemas and an event bus. */
export const createVariableSystem = (opts: VariableSystemOptions): VariableSystem => {
  const { store, schemas, events } = opts;
  const compileSource = opts.compile ?? compileExpression;

  const providers = new Map<string, VariableProvider>();
  const bindings = new Map<VarPath, Binding>();
  const observers = new Map<VarPath, Set<Observer>>();
  const lastValues = new Map<VarPath, Value | undefined>();
  const compiled = new Map<string, CompiledExpression>();
  // WHY a stack: a binding or expression that reads itself must fail loudly instead of recursing forever.
  const readStack: VarPath[] = [];

  const getCompiled = (source: string): CompiledExpression => {
    const hit = compiled.get(source);
    if (hit !== undefined) return hit;
    const made = compileSource(source);
    compiled.set(source, made);
    return made;
  };

  const routeProvider = (path: VarPath): { provider: VariableProvider; rest: string } | undefined => {
    const colon = path.indexOf(':');
    if (colon <= 0) return undefined;
    const provider = providers.get(path.slice(0, colon));
    if (provider === undefined) return undefined;
    return { provider, rest: path.slice(colon + 1) };
  };

  const routePreset = (path: VarPath): { readonly id: string; readonly key: string } | undefined => {
    const dot = path.indexOf('.');
    if (dot <= 0 || dot === path.length - 1) return undefined;
    return { id: path.slice(0, dot), key: path.slice(dot + 1) };
  };

  const explain = (source: string, issues: readonly { message: string; position: number }[]): string =>
    `Cannot evaluate expression '${source}': ${issues.map((i) => `${i.message} (at ${i.position})`).join('; ')}. Fix the expression.`;

  const runCompiled = (expression: CompiledExpression, source: string, scope?: Readonly<Record<string, Value>>): Value => {
    if (!expression.ok) throw new Error(explain(source, expression.issues));
    const converted: Record<string, ExprValue> = {};
    for (const [key, value] of Object.entries(scope ?? {})) {
      const asExpr = toExprValue(value, key);
      if (asExpr !== undefined) converted[key] = asExpr;
    }
    return expression.evaluate(converted, (path) => toExprValue(read(path), path)) as Value;
  };

  const readUnguarded = (path: VarPath): Value | undefined => {
    const binding = bindings.get(path);
    if (binding !== undefined) return binding.evaluate();
    const viaProvider = routeProvider(path);
    if (viaProvider !== undefined) return viaProvider.provider.read(viaProvider.rest);
    const target = routePreset(path);
    if (target === undefined) return undefined;
    if (store.get(target.id) === undefined) return undefined;
    const value = store.resolve(target.id).params[target.key];
    if (isExprRecord(value)) return runCompiled(getCompiled(value.expr), value.expr);
    return value;
  };

  const read = (path: VarPath): Value | undefined => {
    if (readStack.includes(path)) {
      throw new Error(`Cannot read '${path}': it depends on itself (a binding cycle). Remove one of the bindings.`);
    }
    readStack.push(path);
    try {
      return readUnguarded(path);
    } finally {
      readStack.pop();
    }
  };

  const same = (a: Value | undefined, b: Value | undefined): boolean =>
    a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));

  /** Every path whose value may have changed because `path` changed (bindings that read it, transitively). */
  const affected = (path: VarPath): readonly VarPath[] => {
    const out: VarPath[] = [path];
    const seen = new Set<VarPath>([path]);
    for (let i = 0; i < out.length; i++) {
      const current = out[i] as VarPath;
      for (const [target, binding] of bindings) {
        if (!seen.has(target) && binding.reads.includes(current)) {
          seen.add(target);
          out.push(target);
        }
      }
    }
    return out;
  };

  const currentValue = (path: VarPath): Value | undefined => {
    try {
      return read(path);
    } catch (thrown) {
      // Never swallow: observers keep working, but the failure is published on the bus.
      events.emit('error', thrown instanceof Error ? thrown : new Error(String(thrown)));
      return undefined;
    }
  };

  const touch = (path: VarPath): void => {
    for (const changed of affected(path)) {
      const listeners = observers.get(changed);
      if (listeners === undefined || listeners.size === 0) continue;
      const next = currentValue(changed);
      const previous = lastValues.get(changed);
      if (same(next, previous)) continue;
      lastValues.set(changed, next);
      for (const listener of [...listeners]) listener(next, previous);
    }
  };

  const write = (path: VarPath, value: Value, source?: string): void => {
    const viaProvider = routeProvider(path);
    if (viaProvider !== undefined) {
      viaProvider.provider.write(viaProvider.rest, value);
    } else {
      const target = routePreset(path);
      if (target === undefined) {
        throw new Error(
          `Cannot write '${path}': it is not a variable path. Use '<presetId>.<param key>' or '<scheme>:<rest>' with a registered provider.`,
        );
      }
      const preset = store.get(target.id);
      if (preset === undefined) {
        throw new Error(`Cannot write '${path}': preset '${target.id}' does not exist. Create it first.`);
      }
      store.put({
        id: preset.id,
        kind: preset.kind,
        name: preset.name,
        ...(preset.forkOf !== undefined ? { forkOf: preset.forkOf } : {}),
        params: { ...preset.params, [target.key]: value },
        children: preset.children,
        ...(preset.script !== undefined ? { script: preset.script } : {}),
        tags: preset.tags,
        tier: preset.tier,
        meta: preset.meta,
      });
    }
    events.emit('variable:changed', { path, value, source: source ?? 'write' });
    touch(path);
  };

  const refuseCycle = (target: VarPath, reads: readonly string[]): void => {
    const queue = [...reads];
    const seen = new Set<string>(reads);
    while (queue.length > 0) {
      const path = queue.shift() as string;
      if (path === target) {
        throw new Error(
          `Cannot bind '${target}': the source reads '${target}' again, which is a cycle. Bind to a value that does not depend on the target.`,
        );
      }
      const binding = bindings.get(path);
      if (binding === undefined) continue;
      for (const next of binding.reads) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  };

  const bind = (target: VarPath, source: VarPath | { readonly expr: string }): Unsubscribe => {
    let binding: Binding;
    if (typeof source === 'string') {
      binding = { reads: [source], evaluate: () => read(source) };
    } else {
      const expression = getCompiled(source.expr);
      if (!expression.ok) throw new Error(explain(source.expr, expression.issues));
      binding = { reads: [...expression.reads], evaluate: () => runCompiled(expression, source.expr) };
    }
    refuseCycle(target, binding.reads);
    bindings.set(target, binding);
    touch(target);
    return () => {
      if (bindings.get(target) !== binding) return;
      bindings.delete(target);
      touch(target);
    };
  };

  const observe = (path: VarPath, listener: Observer): Unsubscribe => {
    const set = observers.get(path) ?? new Set<Observer>();
    if (set.size === 0) {
      observers.set(path, set);
      lastValues.set(path, currentValue(path));
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        observers.delete(path);
        lastValues.delete(path);
      }
    };
  };

  const compile = (source: string): CompiledExpr => {
    const expression = getCompiled(source);
    const issues: readonly Issue[] = expression.issues.map((issue) => ({
      severity: 'error' as const,
      code: 'expr',
      message: issue.message,
      path: String(issue.position),
    }));
    return {
      source,
      ok: expression.ok,
      issues,
      reads: expression.reads,
      evaluate: (scope?: Readonly<Record<string, Value>>): Value => runCompiled(expression, source, scope),
    };
  };

  const evaluate = (source: string, scope?: Readonly<Record<string, Value>>): Value =>
    runCompiled(getCompiled(source), source, scope);

  const describe = (path: VarPath): (VariableDef & { readonly owner: string }) | undefined => {
    const viaProvider = routeProvider(path);
    if (viaProvider !== undefined) {
      const def = viaProvider.provider.describe(viaProvider.rest);
      return def === undefined ? undefined : { ...def, owner: viaProvider.provider.scheme };
    }
    const target = routePreset(path);
    if (target === undefined) return undefined;
    const preset = store.get(target.id);
    if (preset === undefined) return undefined;
    const schema = schemas.get(preset.kind);
    const def = schema?.variables.find((variable) => variable.key === target.key);
    return def === undefined ? undefined : { ...def, owner: preset.id };
  };

  function* all(): Iterable<VarPath> {
    for (const preset of store.list()) {
      const schema = schemas.get(preset.kind);
      if (schema === undefined) continue;
      for (const variable of schema.variables) yield `${preset.id}.${variable.key}`;
    }
    for (const provider of providers.values()) {
      for (const rest of provider.all()) yield `${provider.scheme}:${rest}`;
    }
  }

  const search = (query: string, limit = 50): readonly VariableHit[] => {
    const needle = query.toLowerCase();
    const hits: VariableHit[] = [];
    for (const path of all()) {
      if (hits.length >= limit) break;
      const def = describe(path);
      if (def === undefined) continue;
      const haystack = `${path}\n${def.label}\n${def.doc}`.toLowerCase();
      if (!haystack.includes(needle)) continue;
      const owner = store.get(def.owner);
      hits.push({ path, def, ownerLabel: owner?.name ?? def.owner, value: currentValue(path) });
    }
    return hits;
  };

  const registerProvider = (provider: VariableProvider): Unsubscribe => {
    providers.set(provider.scheme, provider);
    return () => {
      if (providers.get(provider.scheme) === provider) providers.delete(provider.scheme);
    };
  };

  return { read, write, bind, observe, compile, evaluate, describe, search, all, registerProvider };
};
