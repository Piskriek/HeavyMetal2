import type { QuickJSContext, QuickJSHandle, QuickJSRuntime } from 'quickjs-emscripten';
import { loadQuickJS } from './quickjs-loader.js';
import type { ScriptContext, ScriptLimits, Value } from '@hm/contracts';
import { buildCtx, Marshal } from './marshal.js';

/**
 * Top-level await: the WASM module is loaded once when this module is imported,
 * so `createScriptHost()` itself can stay synchronous.
 */
const QuickJS = await loadQuickJS();

const MEMORY_LIMIT = 16 * 1024 * 1024;
const STACK_LIMIT = 512 * 1024;

/**
 * QuickJS calls the interrupt handler once every N "operations" (backward jumps
 * and function calls). N is a build constant of the engine, so we measure it
 * once: the op budget is then an instruction count, identical on every machine,
 * instead of a wall-clock guess.
 */
function measureInterruptGranularity(): number {
  const iterations = 1_000_000;
  const runtime = QuickJS.newRuntime();
  let calls = 0;
  runtime.setInterruptHandler(() => {
    calls += 1;
    return false;
  });
  const context = runtime.newContext();
  const result = context.evalCode(`let s = 0; for (let i = 0; i < ${iterations}; i++) { s += i; } s`);
  if (result.error) result.error.dispose();
  else result.value.dispose();
  context.dispose();
  runtime.dispose();
  return calls > 0 ? Math.max(1, Math.round(iterations / calls)) : 10_000;
}

export const OPS_PER_INTERRUPT = measureInterruptGranularity();

class Budget {
  private ops = 0;
  private deadline = Number.POSITIVE_INFINITY;
  reason: string | undefined;

  constructor(private readonly limits: ScriptLimits) {}

  begin(): void {
    this.ops = 0;
    this.reason = undefined;
    this.deadline = Date.now() + this.limits.callBudgetMs;
  }

  /** Returns true to interrupt the VM. */
  onInterrupt(): boolean {
    this.ops += OPS_PER_INTERRUPT;
    if (this.ops > this.limits.opBudget) {
      this.reason = `op budget exceeded (limit ${this.limits.opBudget} ops)`;
      return true;
    }
    if (Date.now() > this.deadline) {
      this.reason = `time budget exceeded (limit ${this.limits.callBudgetMs}ms)`;
      return true;
    }
    return false;
  }
}

/**
 * Hardening prelude, evaluated before the script module.
 * Everything here removes a source of non-determinism or of host access.
 */
const PRELUDE = `(function () {
  'use strict';
  Math.random = function random() {
    throw new Error('Math.random is disabled: use ctx.rng');
  };
  var deniedDate = function Date() {
    throw new Error('Date is disabled: use ctx.tick');
  };
  globalThis.Date = deniedDate;
  // Frozen builtins: a script cannot booby-trap the prototypes another script
  // (or the marshalling code) relies on.
  [
    Object.prototype,
    Array.prototype,
    Function.prototype,
    String.prototype,
    Number.prototype,
    Boolean.prototype,
  ].forEach(function (p) { Object.freeze(p); });
})();`;

/** Wrap CommonJS output so the module's exports object becomes the eval result. */
function moduleWrapper(js: string): string {
  return `(function () { var exports = {}; var module = { exports: exports };\n${js}\nreturn module.exports; })()`;
}

export interface CallOutcome {
  readonly ok: boolean;
  readonly value?: Value;
  readonly error?: string;
}

export class Sandbox {
  private readonly runtime: QuickJSRuntime;
  private readonly context: QuickJSContext;
  private readonly marshal: Marshal;
  private readonly budget: Budget;
  private exports: QuickJSHandle | undefined;
  private disposed = false;
  readonly initError: string | undefined;

  constructor(js: string, limits: ScriptLimits) {
    this.budget = new Budget(limits);
    this.runtime = QuickJS.newRuntime();
    this.runtime.setMemoryLimit(MEMORY_LIMIT);
    this.runtime.setMaxStackSize(STACK_LIMIT);
    this.runtime.setInterruptHandler(() => this.budget.onInterrupt());
    this.context = this.runtime.newContext();
    this.marshal = new Marshal(this.context);

    this.budget.begin();
    const prelude = this.context.evalCode(PRELUDE, 'prelude.js');
    if (prelude.error) {
      this.initError = this.describe(prelude.error);
      prelude.error.dispose();
      return;
    }
    prelude.value.dispose();

    const mod = this.context.evalCode(moduleWrapper(js), 'script.js');
    if (mod.error) {
      this.initError = this.describe(mod.error);
      mod.error.dispose();
      return;
    }
    this.exports = mod.value;
  }

  /** Names of the interface members the script actually exports. */
  exportedMembers(members: readonly string[]): string[] {
    if (!this.exports) return [];
    return members.filter((name) => {
      const handle = this.context.getProp(this.exports as QuickJSHandle, name);
      const isFn = this.context.typeof(handle) === 'function';
      handle.dispose();
      return isFn;
    });
  }

  hasMember(name: string): boolean {
    return this.exportedMembers([name]).length === 1;
  }

  call(member: string, ctx: ScriptContext, args: readonly Value[]): CallOutcome {
    if (this.disposed || !this.exports) return { ok: false, error: this.initError ?? 'script is not loaded' };
    const fn = this.context.getProp(this.exports, member);
    const handles: QuickJSHandle[] = [fn];
    try {
      if (this.context.typeof(fn) !== 'function') return { ok: true, value: undefined };
      const ctxHandle = buildCtx(this.context, this.marshal, ctx);
      handles.push(ctxHandle);
      const argHandles = args.map((a) => this.marshal.toVM(a));
      handles.push(...argHandles);

      this.budget.begin();
      const result = this.context.callFunction(fn, this.context.undefined, [ctxHandle, ...argHandles]);
      if (result.error) {
        const error = this.budget.reason ?? this.describe(result.error);
        result.error.dispose();
        return { ok: false, error };
      }
      try {
        return { ok: true, value: this.marshal.fromVM(result.value) };
      } finally {
        result.value.dispose();
      }
    } catch (err) {
      // e.g. a marshalling failure or a fatal engine error: never propagate.
      return { ok: false, error: this.budget.reason ?? String(err) };
    } finally {
      for (const h of handles) {
        try {
          h.dispose();
        } catch {
          /* already disposed by a failed call */
        }
      }
    }
  }

  private readStringProp(handle: QuickJSHandle, key: string): string | undefined {
    const prop = this.context.getProp(handle, key);
    try {
      return this.context.typeof(prop) === 'string' ? this.context.getString(prop) : undefined;
    } finally {
      prop.dispose();
    }
  }

  /**
   * WHY not JSON: an Error has no enumerable properties, so it would serialise
   * to `{}`. Read name/message directly, fall back to the thrown value.
   */
  private describe(error: QuickJSHandle): string {
    try {
      const message = this.readStringProp(error, 'message');
      if (message !== undefined) {
        const name = this.readStringProp(error, 'name');
        return name ? `${name}: ${message}` : message;
      }
      const value = this.marshal.fromVM(error);
      return value === undefined ? `script threw ${this.context.typeof(error)}` : JSON.stringify(value);
    } catch {
      return 'unknown script error';
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.exports?.dispose();
      this.marshal.dispose();
      this.context.dispose();
      this.runtime.dispose();
    } catch {
      /* disposing a VM that already died is not an error for the host */
    }
  }
}
