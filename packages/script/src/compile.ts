import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import type { CompileResult, Diagnostic } from '@hm/contracts';
import { typings } from './typings.js';

const require_ = createRequire(import.meta.url);
/** lib.*.d.ts files ship inside the typescript package; read them from disk. */
const TS_LIB_DIR = path.dirname(require_.resolve('typescript'));

const USER_FILE = 'user.ts';
const AMBIENT_FILE = 'ambient.d.ts';
const DEFAULT_LIB = 'lib.es2022.d.ts';

const OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  lib: [DEFAULT_LIB],
  noEmit: true,
  skipLibCheck: true,
  types: [], // WHY: no @types/node etc. -> `process`, `require` are type errors
};

/** Parsing the ~2 MB of lib.d.ts on every compile is slow; cache per process. */
const libCache = new Map<string, ts.SourceFile | undefined>();
/** The ambient API never changes at runtime, build it once. */
const AMBIENT = typings('Mechanic');

function libPath(fileName: string): string {
  const base = path.basename(fileName);
  return path.join(TS_LIB_DIR, base);
}

function isLib(fileName: string): boolean {
  return path.basename(fileName).startsWith('lib.') && fileName.endsWith('.d.ts');
}

function createHost(source: string): ts.CompilerHost {
  const files = new Map<string, string>([
    [USER_FILE, source],
    [AMBIENT_FILE, AMBIENT],
  ]);
  const readFile = (fileName: string): string | undefined => {
    const own = files.get(path.basename(fileName));
    if (own !== undefined) return own;
    if (!isLib(fileName)) return undefined;
    try {
      return fs.readFileSync(libPath(fileName), 'utf8');
    } catch {
      return undefined;
    }
  };
  return {
    getSourceFile(fileName, languageVersion) {
      if (isLib(fileName)) {
        const key = path.basename(fileName);
        if (!libCache.has(key)) {
          const text = readFile(fileName);
          libCache.set(key, text === undefined ? undefined : ts.createSourceFile(key, text, languageVersion, true));
        }
        return libCache.get(key);
      }
      const text = readFile(fileName);
      return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion, true);
    },
    getDefaultLibFileName: () => DEFAULT_LIB,
    getDefaultLibLocation: () => TS_LIB_DIR,
    writeFile: () => undefined,
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (f) => readFile(f) !== undefined,
    readFile,
  };
}

function toDiagnostic(d: ts.Diagnostic): Diagnostic {
  let line = 1;
  let column = 1;
  if (d.file && d.start !== undefined) {
    const pos = d.file.getLineAndCharacterOfPosition(d.start);
    line = pos.line + 1; // TypeScript is 0-based, editors are 1-based
    column = pos.character + 1;
  }
  return {
    severity: d.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error',
    message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
    line,
    column,
  };
}

function at(file: ts.SourceFile, node: ts.Node, message: string): Diagnostic {
  const pos = file.getLineAndCharacterOfPosition(node.getStart(file));
  return { severity: 'error', message, line: pos.line + 1, column: pos.character + 1 };
}

const BANNED_CALLS = new Set(['require', 'eval', 'Function']);

/**
 * Static deny-list. The sandbox already makes these harmless at runtime, but
 * refusing them at compile time gives the author a useful error instead of a
 * mysterious runtime failure, and keeps scripts single-file + deterministic.
 */
function bannedSyntax(file: ts.SourceFile): Diagnostic[] {
  const out: Diagnostic[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      out.push(at(file, node, 'imports are not allowed in scripts'));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      out.push(at(file, node, 're-exporting from another module is not allowed in scripts'));
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        out.push(at(file, node, 'dynamic import() is not allowed in scripts'));
      } else if (ts.isIdentifier(node.expression) && BANNED_CALLS.has(node.expression.text)) {
        out.push(at(file, node, `${node.expression.text}() is not allowed in scripts`));
      }
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
      out.push(at(file, node, 'new Function() is not allowed in scripts'));
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return out;
}

/** Compile a script. Never throws: problems come back as diagnostics. */
export function compile(source: string): CompileResult {
  let diagnostics: Diagnostic[] = [];
  try {
    const program = ts.createProgram({
      rootNames: [AMBIENT_FILE, USER_FILE],
      options: OPTIONS,
      host: createHost(source),
    });
    const file = program.getSourceFile(USER_FILE);
    if (!file) {
      return { ok: false, diagnostics: [{ severity: 'error', message: 'script source not found', line: 1, column: 1 }], js: '' };
    }
    const syntactic = program.getSyntacticDiagnostics(file).map(toDiagnostic);
    // Semantic errors on a broken parse tree are noise; report syntax first.
    const semantic = syntactic.length > 0 ? [] : program.getSemanticDiagnostics(file).map(toDiagnostic);
    diagnostics = [...syntactic, ...semantic, ...bannedSyntax(file)];
  } catch (err) {
    diagnostics = [{ severity: 'error', message: `compiler failure: ${String(err)}`, line: 1, column: 1 }];
  }

  const ok = !diagnostics.some((d) => d.severity === 'error');
  if (!ok) return { ok: false, diagnostics, js: '' };

  // CommonJS so that `export function f` becomes a property of an `exports`
  // object that the sandbox can read back after evaluating the module.
  const emitted = ts.transpileModule(source, {
    fileName: USER_FILE,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true },
  });
  return { ok: true, diagnostics, js: emitted.outputText };
}
