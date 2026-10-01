import {
  ScriptError,
  SCRIPT_INTERFACES,
  type CompileResult,
  type LoadedScript,
  type Preset,
  type ScriptContext,
  type ScriptHost,
  type ScriptLimits,
  type ScriptSource,
  type Value,
} from '@hm/contracts';
import { compile } from './compile.js';
import { Sandbox } from './sandbox.js';
import { typings } from './typings.js';

const DEFAULT_LIMITS: ScriptLimits = { callBudgetMs: 100, opBudget: 2_000_000 };

/** Mutable implementation of the readonly LoadedScript contract. */
class Script<T = unknown> implements LoadedScript<T> {
  faulted = false;
  lastError: string | undefined;

  constructor(
    readonly presetId: string,
    readonly instance: T,
    readonly iface: string,
    readonly sandbox: Sandbox,
  ) {}
}

function firstError(result: CompileResult): string {
  const d = result.diagnostics.find((x) => x.severity === 'error') ?? result.diagnostics[0];
  return d ? `${d.message} (line ${d.line}, column ${d.column})` : 'compile failed';
}

class Host implements ScriptHost {
  readonly limits: ScriptLimits;
  private readonly scripts = new Set<Script<unknown>>();
  private disposed = false;

  constructor(limits?: Partial<ScriptLimits>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  compile(source: string): CompileResult {
    return compile(source);
  }

  typings(iface: string): string {
    return typings(iface);
  }

  load<T = unknown>(preset: Preset, iface: string): LoadedScript<T> {
    const members = SCRIPT_INTERFACES[iface];
    if (!members) throw new ScriptError(`unknown script interface '${iface}'`);
    if (!preset.script) throw new ScriptError(`preset '${preset.id}' has no script`);
    return this.instantiate<T>(preset.id, iface, preset.script.source, members);
  }

  private instantiate<T>(presetId: string, iface: string, source: string, members: readonly string[]): Script<T> {
    const result = compile(source);
    if (!result.ok) throw new ScriptError(`compile error: ${firstError(result)}`, result.diagnostics[0]?.line);

    // One runtime + context per script: no shared state, no shared prototypes.
    const sandbox = new Sandbox(result.js, this.limits);
    const exported = sandbox.exportedMembers(members);
    const instance = Object.freeze({ iface, members: exported }) as unknown as T;
    const script = new Script<T>(presetId, instance, iface, sandbox);
    if (sandbox.initError) {
      script.faulted = true;
      script.lastError = sandbox.initError;
    }
    this.scripts.add(script as Script<unknown>);
    return script;
  }

  call(
    script: LoadedScript,
    member: string,
    ctx: ScriptContext,
    ...args: Value[]
  ): { readonly ok: boolean; readonly value?: Value; readonly error?: string } {
    if (!(script instanceof Script)) return { ok: false, error: 'unknown script: it was not loaded by this host' };
    if (this.disposed) return { ok: false, error: 'script host is disposed' };
    if (script.faulted) return { ok: false, error: 'script is faulted: reload it' };

    const members = SCRIPT_INTERFACES[script.iface] ?? [];
    if (!members.includes(member)) {
      return { ok: false, error: `'${member}' is not a member of interface '${script.iface}'` };
    }
    // A member the script does not implement is a successful no-op.
    if (!script.sandbox.hasMember(member)) return { ok: true, value: undefined };

    const out = script.sandbox.call(member, ctx, args);
    if (!out.ok) {
      script.faulted = true;
      script.lastError = out.error;
    }
    return out;
  }

  reload(script: LoadedScript, source: ScriptSource): LoadedScript {
    if (!(script instanceof Script)) throw new ScriptError('unknown script: it was not loaded by this host');
    const iface = script.iface;
    const members = SCRIPT_INTERFACES[iface] ?? [];
    // Compile first: a broken edit must leave the running script untouched.
    const fresh = this.instantiate(script.presetId, iface, source.source, members);
    this.scripts.delete(script as Script<unknown>);
    script.sandbox.dispose();
    return fresh;
  }

  dispose(): void {
    this.disposed = true;
    for (const script of this.scripts) script.sandbox.dispose();
    this.scripts.clear();
  }
}

export function createScriptHost(opts?: { limits?: Partial<ScriptLimits> }): ScriptHost {
  return new Host(opts?.limits);
}
