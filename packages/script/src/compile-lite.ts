import { transform } from 'sucrase';
import type { CompileResult, Diagnostic } from '@hm/contracts';

/**
 * The browser-safe compiler: strips TypeScript types with sucrase (small, no Node APIs) and bans imports.
 * It does NOT type-check: that needs the full TypeScript program (`compile.ts`), which the editor loads lazily
 * in Pro builds. A script that fails to type-check there still runs here, so a shipped game never depends on it.
 * Same export as compile.ts, so the host can use either.
 */

const STATIC_IMPORT = /(^|[;\r\n{}])[ \t]*import\s*(?=[\w*{'"])/g;
const DYNAMIC_IMPORT = /(?<![\w$.])import\s*\(/g;

function lineCol(source: string, index: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < index && i < source.length; i++) if (source.charCodeAt(i) === 10) { line++; last = i; }
  return { line, column: index - last };
}

function bannedSyntax(source: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const m of source.matchAll(STATIC_IMPORT)) {
    out.push({ severity: 'error', message: 'imports are not allowed in scripts', ...lineCol(source, m.index + m[1]!.length) });
  }
  for (const m of source.matchAll(DYNAMIC_IMPORT)) {
    out.push({ severity: 'error', message: 'dynamic import() is not allowed in scripts', ...lineCol(source, m.index) });
  }
  return out;
}

export function compile(source: string): CompileResult {
  const banned = bannedSyntax(source);
  if (banned.length > 0) return { ok: false, diagnostics: banned, js: '' };
  try {
    const out = transform(source, { transforms: ['typescript', 'imports'], disableESTransforms: true, filePath: 'user.ts' });
    return { ok: true, diagnostics: [], js: out.code };
  } catch (err) {
    const loc = (err as { loc?: { line?: number; column?: number } }).loc;
    const message = String((err as Error).message ?? err).replace(/\s*\(\d+:\d+\)\s*$/, '');
    return { ok: false, diagnostics: [{ severity: 'error', message, line: loc?.line ?? 1, column: (loc?.column ?? 0) + 1 }], js: '' };
  }
}
