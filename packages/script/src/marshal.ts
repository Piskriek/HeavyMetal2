import type { QuickJSContext, QuickJSHandle } from 'quickjs-emscripten';
import type { Rng, ScriptContext, Value } from '@hm/contracts';

/**
 * Everything crossing the WASM boundary is copied as JSON.
 * WHY: a copy can never be a live reference to a host object, so a script can
 * neither keep nor mutate anything that belongs to the host.
 */
export class Marshal {
  private readonly json: QuickJSHandle;
  private readonly parse: QuickJSHandle;
  private readonly stringify: QuickJSHandle;

  constructor(private readonly vm: QuickJSContext) {
    this.json = vm.getProp(vm.global, 'JSON');
    this.parse = vm.getProp(this.json, 'parse');
    this.stringify = vm.getProp(this.json, 'stringify');
  }

  /** Host value -> fresh VM value. Caller owns the returned handle. */
  toVM(value: unknown): QuickJSHandle {
    const vm = this.vm;
    if (value === undefined) return vm.undefined;
    if (value === null) return vm.null;
    if (typeof value === 'number') return vm.newNumber(value);
    if (typeof value === 'string') return vm.newString(value);
    if (typeof value === 'boolean') return value ? vm.true : vm.false;
    let json: string | undefined;
    try {
      json = JSON.stringify(value);
    } catch {
      json = undefined;
    }
    if (json === undefined) return vm.undefined;
    const str = vm.newString(json);
    try {
      return vm.unwrapResult(vm.callFunction(this.parse, this.json, str));
    } finally {
      str.dispose();
    }
  }

  /** VM value -> plain host value. */
  fromVM(handle: QuickJSHandle): Value | undefined {
    const vm = this.vm;
    const type = vm.typeof(handle);
    if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined;
    if (type === 'number') return vm.getNumber(handle);
    if (type === 'string') return vm.getString(handle);
    if (type === 'boolean') return vm.dump(handle) as boolean;
    const result = vm.callFunction(this.stringify, this.json, handle);
    const out = vm.unwrapResult(result);
    try {
      if (vm.typeof(out) !== 'string') return undefined; // undefined / unserialisable
      return JSON.parse(vm.getString(out)) as Value;
    } finally {
      out.dispose();
    }
  }

  dispose(): void {
    this.parse.dispose();
    this.stringify.dispose();
    this.json.dispose();
  }
}

type HostFn = (...args: Value[]) => unknown;

/** Wrap a host function as a VM function; arguments and results are copies. */
function vmFn(vm: QuickJSContext, m: Marshal, name: string, impl: HostFn): QuickJSHandle {
  return vm.newFunction(name, (...handles) => {
    const args = handles.map((h) => m.fromVM(h)) as Value[];
    // Throwing here is turned into a VM exception by quickjs-emscripten,
    // so host failures surface as script errors instead of crashing the host.
    return m.toVM(impl(...args));
  });
}

function withProps(
  vm: QuickJSContext,
  m: Marshal,
  entries: readonly (readonly [string, HostFn])[],
): QuickJSHandle {
  const obj = vm.newObject();
  for (const [name, impl] of entries) {
    const fn = vmFn(vm, m, name, impl);
    vm.setProp(obj, name, fn);
    fn.dispose(); // the object keeps its own reference
  }
  return obj;
}

function rngObject(vm: QuickJSContext, m: Marshal, rng: Rng): QuickJSHandle {
  const obj = withProps(vm, m, [
    ['next', () => rng.next()],
    ['int', (min, max) => rng.int(Number(min), Number(max))],
    ['pick', (items) => rng.pick(items as readonly Value[])],
    ['state', () => rng.state()],
    ['restore', (state) => rng.restore((state as readonly number[]) ?? [])],
  ]);
  // fork() returns another Rng, which is an object with methods and therefore
  // cannot be JSON-copied: mirror it as a nested VM object instead.
  const fork = vm.newFunction('fork', (labelHandle) => {
    const label = labelHandle === undefined ? '' : String(m.fromVM(labelHandle) ?? '');
    return rngObject(vm, m, rng.fork(label));
  });
  vm.setProp(obj, 'fork', fork);
  fork.dispose();
  return obj;
}

/**
 * Build the per-call `ctx` object inside the VM. Caller disposes the handle
 * after the call: nothing survives between calls except script module state.
 */
export function buildCtx(vm: QuickJSContext, m: Marshal, ctx: ScriptContext): QuickJSHandle {
  const obj = vm.newObject();
  const put = (key: string, handle: QuickJSHandle): void => {
    vm.setProp(obj, key, handle);
    handle.dispose();
  };

  put('self', m.toVM({ id: ctx.self.id, params: ctx.self.params }));
  put('tick', m.toVM(ctx.tick));
  put('dt', m.toVM(ctx.dt));

  put('rng', rngObject(vm, m, ctx.rng));

  put(
    'vars',
    withProps(vm, m, [
      ['read', (p) => ctx.vars.read(String(p))],
      ['write', (p, v, s) => ctx.vars.write(String(p), v as Value, s === undefined ? undefined : String(s))],
      ['evaluate', (src, scope) => ctx.vars.evaluate(String(src), scope as Record<string, Value> | undefined)],
    ]),
  );

  put(
    'world',
    withProps(vm, m, [
      ['query', (...components) => ctx.world.query(...components.map((c) => String(c)))],
      ['get', (id, c) => ctx.world.get(Number(id), String(c))],
      ['has', (id, c) => ctx.world.has(Number(id), String(c))],
      ['alive', (id) => ctx.world.alive(Number(id))],
      ['getResource', (name) => ctx.world.getResource(String(name))],
      ['presetOf', (id) => ctx.world.presetOf(Number(id))],
    ]),
  );

  const direct: readonly (readonly [string, HostFn])[] = [
    ['set', (e, c, v) => ctx.set(Number(e), String(c), (v ?? {}) as Record<string, Value>)],
    [
      'spawn',
      (presetId, components) =>
        ctx.spawn(String(presetId), components as Record<string, Record<string, Value>> | undefined),
    ],
    ['despawn', (e) => ctx.despawn(Number(e))],
    ['emit', (name, payload) => ctx.emit(String(name), payload)],
    ['log', (...parts) => ctx.log(...parts)],
  ];
  for (const [name, impl] of direct) {
    const fn = vmFn(vm, m, name, impl);
    vm.setProp(obj, name, fn);
    fn.dispose();
  }
  return obj;
}
