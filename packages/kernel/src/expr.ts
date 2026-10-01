/**
 * The expression language: small, safe, no host access. Numbers (1, 1.5, .5, 1e3), strings ('a' or "a"), true/false/null,
 * + - * / % ^ (^ is right-associative and binds tighter than unary minus), comparisons (< <= > >= == !=, strict), && || ! (short-circuit),
 * ternary a ? b : c, parentheses, identifiers read from the scope, and `$path` reads (a `$` plus [A-Za-z0-9_.:/]; a hyphen belongs to
 * the path only between two letters/digits, so write `$a - 1` with spaces). `+` also joins strings. Only the listed functions exist;
 * their argument counts are checked when compiling. There are no loops, no property access, no assignment, and no eval: the source is
 * parsed into a tree and the tree is walked.
 */
export type ExprValue = number | string | boolean | null | readonly ExprValue[];
export interface ExprIssue { readonly message: string; readonly position: number }
export interface CompiledExpression {
  readonly ok: boolean;
  readonly issues: readonly ExprIssue[];
  /** The $paths the expression reads, without the $, unique, in order of first appearance. */
  readonly reads: readonly string[];
  /** Throws an Error with a clear message on a runtime error (unknown identifier, division by zero, wrong types). */
  evaluate(scope?: Readonly<Record<string, ExprValue>>, read?: (path: string) => ExprValue | undefined): ExprValue;
}

const MAX_SOURCE = 2000;
const MAX_DEPTH = 50;

type Node =
  | { t: 'lit'; v: ExprValue }
  | { t: 'id'; name: string; at: number }
  | { t: 'path'; path: string; at: number }
  | { t: 'un'; op: '-' | '!'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node; at: number }
  | { t: 'cond'; c: Node; a: Node; b: Node }
  | { t: 'call'; fn: string; args: Node[]; at: number };

interface Tok { k: 'num' | 'str' | 'id' | 'path' | 'op' | 'end'; v: string; at: number }

/** name -> [min args, max args (Infinity = any)] */
const FUNCTIONS: Record<string, readonly [number, number]> = {
  min: [1, Infinity], max: [1, Infinity], clamp: [3, 3], lerp: [3, 3], mix: [3, 3], abs: [1, 1], floor: [1, 1], ceil: [1, 1], round: [1, 1],
  sqrt: [1, 1], sin: [1, 1], cos: [1, 1], sign: [1, 1], atan2: [2, 2], pow: [2, 2], smoothstep: [3, 3], vec3: [3, 3],
};

class CompileError extends Error {
  constructor(message: string, readonly position: number) { super(message); }
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isAlpha = (c: string): boolean => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isPathChar = (c: string): boolean => isDigit(c) || isAlpha(c) || c === '.' || c === ':' || c === '/';
const isAlnum = (c: string | undefined): boolean => c !== undefined && (isDigit(c) || isAlpha(c));

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    const at = i;
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      let j = i;
      while (isDigit(src[j] ?? '')) j++;
      if (src[j] === '.') { j++; while (isDigit(src[j] ?? '')) j++; }
      if ((src[j] === 'e' || src[j] === 'E') && (isDigit(src[j + 1] ?? '') || ((src[j + 1] === '-' || src[j + 1] === '+') && isDigit(src[j + 2] ?? '')))) {
        j += 2;
        while (isDigit(src[j] ?? '')) j++;
      }
      out.push({ k: 'num', v: src.slice(i, j), at }); i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) j++;
        s += src[j]; j++;
      }
      if (j >= src.length) throw new CompileError('unterminated string: add the closing quote', at);
      out.push({ k: 'str', v: s, at }); i = j + 1; continue;
    }
    if (c === '$') {
      let j = i + 1;
      while (j < src.length) {
        const d = src[j] as string;
        if (isPathChar(d) || (d === '-' && isAlnum(src[j - 1]) && isAlnum(src[j + 1]))) j++; else break;
      }
      if (j === i + 1) throw new CompileError('a $ must be followed by a variable path, for example $racer1.weight', at);
      out.push({ k: 'path', v: src.slice(i + 1, j), at }); i = j; continue;
    }
    if (isAlpha(c)) {
      let j = i;
      while (isAlnum(src[j])) j++;
      out.push({ k: 'id', v: src.slice(i, j), at }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { out.push({ k: 'op', v: two, at }); i += 2; continue; }
    if ('+-*/%^<>!?:(),'.includes(c)) { out.push({ k: 'op', v: c, at }); i++; continue; }
    if (c === '.') throw new CompileError('property access is not allowed in expressions', at);
    throw new CompileError(`unexpected character '${c}'`, at);
  }
  out.push({ k: 'end', v: '', at: src.length });
  return out;
}

const BINARY: Record<string, readonly [number, boolean]> = {
  '||': [1, false], '&&': [2, false], '==': [3, false], '!=': [3, false], '<': [4, false], '<=': [4, false], '>': [4, false], '>=': [4, false],
  '+': [5, false], '-': [5, false], '*': [6, false], '/': [6, false], '%': [6, false], '^': [8, true],
};

function parse(toks: Tok[], reads: string[]): Node {
  let p = 0;
  let depth = 0;
  const peek = (): Tok => toks[p] as Tok;
  const next = (): Tok => toks[p++] as Tok;
  const expectOp = (v: string): void => {
    const t = next();
    if (t.k !== 'op' || t.v !== v) throw new CompileError(`expected '${v}'${t.k === 'end' ? ' but the expression ended' : ` but found '${t.v}'`}`, t.at);
  };
  const enter = (at: number): void => { if (++depth > MAX_DEPTH) throw new CompileError(`expression is nested deeper than ${MAX_DEPTH} levels`, at); };

  function expression(minPrec: number): Node {
    enter(peek().at);
    let left = unary();
    for (;;) {
      const t = peek();
      if (t.k === 'op' && t.v === '?' && minPrec <= 0) {
        next();
        const a = expression(0);
        expectOp(':');
        const b = expression(0);
        left = { t: 'cond', c: left, a, b };
        continue;
      }
      const info = t.k === 'op' ? BINARY[t.v] : undefined;
      if (!info || info[0] < minPrec) break;
      next();
      const right = expression(info[1] ? info[0] : info[0] + 1);
      left = { t: 'bin', op: t.v, a: left, b: right, at: t.at };
    }
    depth--;
    return left;
  }
  function unary(): Node {
    const t = peek();
    if (t.k === 'op' && (t.v === '-' || t.v === '!')) {
      next();
      // unary minus binds looser than ^, so -2^2 = -(2^2)
      return { t: 'un', op: t.v, a: t.v === '-' ? expression(7) : unary() };
    }
    return primary();
  }
  function primary(): Node {
    const t = next();
    if (t.k === 'num') return { t: 'lit', v: Number(t.v) };
    if (t.k === 'str') return { t: 'lit', v: t.v };
    if (t.k === 'path') { if (!reads.includes(t.v)) reads.push(t.v); return { t: 'path', path: t.v, at: t.at }; }
    if (t.k === 'id') {
      if (t.v === 'true') return { t: 'lit', v: true };
      if (t.v === 'false') return { t: 'lit', v: false };
      if (t.v === 'null') return { t: 'lit', v: null };
      const n = peek();
      if (n.k === 'op' && n.v === '(') {
        next();
        const spec = FUNCTIONS[t.v];
        if (!spec) throw new CompileError(`unknown function '${t.v}'`, t.at);
        const args: Node[] = [];
        if (!(peek().k === 'op' && peek().v === ')')) {
          for (;;) {
            args.push(expression(0));
            if (peek().k === 'op' && peek().v === ',') { next(); continue; }
            break;
          }
        }
        expectOp(')');
        if (args.length < spec[0] || args.length > spec[1]) throw new CompileError(`${t.v}() takes ${spec[0] === spec[1] ? spec[0] : `at least ${spec[0]}`} argument(s), got ${args.length}`, t.at);
        return { t: 'call', fn: t.v, args, at: t.at };
      }
      return { t: 'id', name: t.v, at: t.at };
    }
    if (t.k === 'op' && t.v === '(') {
      const inner = expression(0);
      expectOp(')');
      return inner;
    }
    throw new CompileError(t.k === 'end' ? 'the expression ended too early' : `unexpected '${t.v}'`, t.at);
  }

  const root = expression(0);
  const rest = peek();
  if (rest.k !== 'end') throw new CompileError(`unexpected '${rest.v}'`, rest.at);
  return root;
}

const num = (v: ExprValue, what: string): number => {
  if (typeof v !== 'number') throw new Error(`${what} needs a number, got ${JSON.stringify(v)}`);
  return v;
};

function run(n: Node, scope: Readonly<Record<string, ExprValue>>, read: ((path: string) => ExprValue | undefined) | undefined): ExprValue {
  switch (n.t) {
    case 'lit': return n.v;
    case 'id': {
      if (!(n.name in scope)) throw new Error(`unknown name '${n.name}': pass it in the scope`);
      return scope[n.name] as ExprValue;
    }
    case 'path': {
      const v = read ? read(n.path) : undefined;
      if (v === undefined) throw new Error(`variable '${n.path}' has no value`);
      return v;
    }
    case 'un': {
      const v = run(n.a, scope, read);
      return n.op === '-' ? -num(v, 'unary minus') : !v;
    }
    case 'cond': return run(n.c, scope, read) ? run(n.a, scope, read) : run(n.b, scope, read);
    case 'call': return call(n.fn, n.args.map((a) => run(a, scope, read)));
    case 'bin': {
      if (n.op === '&&') { const l = run(n.a, scope, read); return l ? run(n.b, scope, read) : l; }
      if (n.op === '||') { const l = run(n.a, scope, read); return l ? l : run(n.b, scope, read); }
      const l = run(n.a, scope, read);
      const r = run(n.b, scope, read);
      switch (n.op) {
        case '+': return typeof l === 'string' || typeof r === 'string' ? `${String(l)}${String(r)}` : num(l, '+') + num(r, '+');
        case '-': return num(l, '-') - num(r, '-');
        case '*': return num(l, '*') * num(r, '*');
        case '/': if (num(r, '/') === 0) throw new Error('division by zero'); return num(l, '/') / (r as number);
        case '%': if (num(r, '%') === 0) throw new Error('division by zero (in %)'); return num(l, '%') % (r as number);
        case '^': return Math.pow(num(l, '^'), num(r, '^'));
        case '==': return JSON.stringify(l) === JSON.stringify(r);
        case '!=': return JSON.stringify(l) !== JSON.stringify(r);
        case '<': return num(l, '<') < num(r, '<');
        case '<=': return num(l, '<=') <= num(r, '<=');
        case '>': return num(l, '>') > num(r, '>');
        default: return num(l, '>=') >= num(r, '>=');
      }
    }
  }
}

function call(fn: string, a: ExprValue[]): ExprValue {
  const x = (i: number): number => num(a[i] as ExprValue, `${fn}()`);
  switch (fn) {
    case 'min': return Math.min(...a.map((_, i) => x(i)));
    case 'max': return Math.max(...a.map((_, i) => x(i)));
    case 'clamp': return Math.min(Math.max(x(0), x(1)), x(2));
    case 'lerp': case 'mix': return x(0) + (x(1) - x(0)) * x(2);
    case 'abs': return Math.abs(x(0));
    case 'floor': return Math.floor(x(0));
    case 'ceil': return Math.ceil(x(0));
    case 'round': return Math.round(x(0));
    case 'sqrt': if (x(0) < 0) throw new Error('sqrt of a negative number'); return Math.sqrt(x(0));
    case 'sin': return Math.sin(x(0));
    case 'cos': return Math.cos(x(0));
    case 'sign': return Math.sign(x(0));
    case 'atan2': return Math.atan2(x(0), x(1));
    case 'pow': return Math.pow(x(0), x(1));
    case 'smoothstep': { const t = Math.min(Math.max((x(2) - x(0)) / (x(1) - x(0)), 0), 1); return t * t * (3 - 2 * t); }
    default: return [x(0), x(1), x(2)];
  }
}

/** Compiles an expression. Never throws: a bad source gives ok=false and issues. */
export function compileExpression(source: string): CompiledExpression {
  const reads: string[] = [];
  const fail = (e: unknown): CompiledExpression => ({
    ok: false, reads: [], issues: [{ message: e instanceof Error ? e.message : String(e), position: e instanceof CompileError ? e.position : 0 }],
    evaluate: () => { throw new Error('this expression did not compile'); },
  });
  if (source.length > MAX_SOURCE) return fail(new CompileError(`expression is longer than ${MAX_SOURCE} characters`, MAX_SOURCE));
  try {
    const tree = parse(tokenize(source), reads);
    return { ok: true, issues: [], reads, evaluate: (scope = {}, read) => run(tree, scope, read) };
  } catch (e) {
    return fail(e);
  }
}
