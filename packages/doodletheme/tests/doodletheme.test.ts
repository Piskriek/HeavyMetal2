import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, themeVars, themeCss, sprayDecor, sprayDataUri, goblinFace, contrast,
  validateTokens, textPairs, MOODS, SVG_URI_PREFIX, type Tokens,
} from '../src';

function wellFormed(svg: string): void {
  assert.ok(svg.startsWith('<svg'), 'starts with <svg');
  assert.ok(svg.endsWith('</svg>'), 'ends with </svg>');
  assert.equal(svg.match(/<svg\b/g)?.length, 1, 'exactly one svg element');
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'has xmlns');
  assert.match(svg, /viewBox="[^"]+"/);
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/g;
  const stack: string[] = [];
  let last = 0;
  let rootClosed = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const gap = svg.slice(last, m.index);
    assert.ok(!/[<>]/.test(gap), `stray markup near offset ${last}`);
    assert.ok(!rootClosed, 'content after root closed');
    const closing = (m[1] ?? '') === '/';
    const name = m[2] ?? '';
    const selfClosing = (m[4] ?? '') === '/';
    if (closing) {
      assert.equal(stack.pop(), name, `mismatched </${name}>`);
      if (stack.length === 0) rootClosed = true;
    } else if (!selfClosing) {
      stack.push(name);
    } else {
      assert.ok(stack.length > 0, 'self-closing element outside root');
    }
    last = m.index + m[0].length;
  }
  assert.equal(svg.slice(last), '');
  assert.equal(stack.length, 0, 'all tags closed');
  assert.ok(rootClosed);
  assert.equal((svg.match(/</g) ?? []).length, (svg.match(re) ?? []).length, 'every < is a tag');
}

const first = THEMES[0];

test('three named themes, white-wall default', () => {
  assert.deepEqual(THEMES.map((t) => t.name), ['white-wall', 'night-wall', 'high-contrast']);
  assert.equal(first?.name, 'white-wall');
});

test('every theme is valid', () => {
  for (const t of THEMES) {
    const r = validateTokens(t);
    assert.deepEqual(r.errors, [], t.name);
    assert.equal(r.ok, true);
    for (const f of [t.fontDisplay, t.fontBody, t.fontMono]) assert.ok(f.split(',').length >= 3, `${t.name} fallbacks`);
  }
});

test('text pairs meet AA as documented', () => {
  for (const t of THEMES) {
    const pairs = textPairs(t);
    assert.ok(pairs.length >= 6);
    for (const p of pairs) {
      const c = contrast(p.fg, p.bg);
      assert.ok(c >= p.min, `${t.name}: ${p.label} ${c.toFixed(2)} < ${p.min}`);
      assert.ok(p.note.length > 0);
    }
    assert.ok(contrast(t.ink, t.wall) >= 4.5);
    assert.ok(contrast(t.ink, t.bg) >= 4.5);
    for (const a of [t.accent, t.accent2, t.accent3]) assert.ok(contrast(t.onAccent, a) >= 4.5, `${t.name} onAccent/${a}`);
    assert.ok(contrast(t.dim, t.wall) >= 3, `${t.name} dim large-text floor`);
    assert.ok(contrast(t.dim, t.wall) >= 4.5, `${t.name} built-in dim reaches 4.5`);
  }
});

test('themeVars has all required names with non-empty values', () => {
  const required = [
    '--accent', '--text', '--dim', '--panel', '--line', '--hm-accent', '--hm-text', '--hm-dim',
    '--hm-panel', '--hm-line', '--hm-ok', '--hm-danger', '--wall', '--bg', '--ink', '--accent2',
    '--accent3', '--radius', '--stroke', '--font-display', '--font-body', '--font-mono',
  ];
  for (const t of THEMES) {
    const v = themeVars(t);
    for (const k of required) assert.ok(k in v, `${t.name} missing ${k}`);
    for (const [k, val] of Object.entries(v)) {
      assert.equal(typeof val, 'string', k);
      assert.ok(val.trim().length > 0, `${k} empty`);
    }
  }
});

test('themeCss covers selectors, no imports or remote urls', () => {
  const selectors = [
    'button', 'button.go', 'button.on', '.chip', 'input', 'select', 'input[type=range]',
    'section.rules', '.sound-list li', '.hint', '.bad', 'h3', 'h3.sub', '.hist', '.saved',
  ];
  for (const t of THEMES) {
    const css = themeCss(t);
    for (const s of selectors) assert.ok(css.includes(s), `${t.name} css missing ${s}`);
    assert.ok(!css.includes('@import'));
    assert.ok(!css.includes('url(http'));
    assert.ok(css.includes('prefers-reduced-motion: reduce'));
    assert.ok(css.includes(`outline: 3px solid ${t.accent2}`));
    assert.equal((css.match(/{/g) ?? []).length, (css.match(/}/g) ?? []).length, 'balanced braces');
  }
  assert.ok(first && themeCss(first).includes('255px 15px 225px 15px/15px 225px 15px 255px'));
});

test('sprayDecor is deterministic, seed-sensitive, well-formed, small', () => {
  for (const t of THEMES) {
    for (const seed of [1, 42, 9999]) {
      const a = sprayDecor(seed, 1200, 800, t);
      assert.equal(a, sprayDecor(seed, 1200, 800, t));
      wellFormed(a);
      assert.ok(a.length < 40 * 1024, `${t.name} ${seed}: ${a.length} bytes`);
    }
    assert.notEqual(sprayDecor(1, 1200, 800, t), sprayDecor(2, 1200, 800, t));
  }
});

test('sprayDecor keeps the centre clear', () => {
  for (const t of THEMES) {
    for (const [w, h] of [[1200, 800], [400, 900], [1920, 1080]] as const) {
      for (let seed = 0; seed < 8; seed++) {
        const svg = sprayDecor(seed, w, h, t, 1.5);
        const re = /class="d" transform="translate\((-?[\d.]+),(-?[\d.]+)\)/g;
        let n = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(svg)) !== null) {
          n++;
          const x = Number(m[1]);
          const y = Number(m[2]);
          const inside = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7;
          assert.ok(!inside, `element at ${x},${y} inside centre of ${w}x${h}`);
        }
        assert.ok(n > 0, 'has doodles');
      }
    }
  }
});

test('sprayDecor survives odd inputs', () => {
  const t = first as Tokens;
  wellFormed(sprayDecor(NaN, -5, 0, t, -1));
  wellFormed(sprayDecor(3.7, 300, 200, t, 0));
});

test('sprayDataUri decodes back to the svg and is css-safe', () => {
  for (const t of THEMES) {
    const uri = sprayDataUri(7, 1200, 800, t);
    assert.ok(uri.startsWith(SVG_URI_PREFIX));
    assert.ok(uri.startsWith('data:image/svg+xml;utf8,'));
    const rest = uri.slice(SVG_URI_PREFIX.length);
    assert.ok(!/["'()#<>\s]/.test(rest), 'no raw unsafe characters');
    assert.equal(decodeURIComponent(rest), sprayDecor(7, 1200, 800, t));
  }
});

test('goblinFace works for all moods', () => {
  const outs = new Set<string>();
  for (const t of THEMES) {
    for (const mood of MOODS) {
      const s = goblinFace(96, t, mood);
      wellFormed(s);
      assert.ok(s.includes(mood));
      outs.add(s);
    }
  }
  assert.equal(outs.size, THEMES.length * MOODS.length);
});

test('contrast', () => {
  assert.ok(Math.abs(contrast('#ffffff', '#000000') - 21) < 1e-9);
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 1e-9);
  assert.ok(Math.abs(contrast('#777777', '#777777') - 1) < 1e-9);
  assert.ok(Number.isNaN(contrast('red', '#000000')));
});

test('validateTokens rejects junk without throwing', () => {
  const base = first as Tokens;
  const junk: unknown[] = [
    null, undefined, 42, 'theme', [], {}, { name: 'x' },
    { ...base, accent: 'red' },
    { ...base, wobble: 2 },
    { ...base, stroke: 0 },
    { ...base, fontBody: 'Nunito' },
    { ...base, name: '' },
    { ...base, ink: base.wall },
    { ...base, onAccent: '#ffffff' },
    new Proxy({}, { get() { throw new Error('boom'); } }),
  ];
  for (const j of junk) {
    const r = validateTokens(j);
    assert.equal(r.ok, false);
    assert.ok(r.errors.length > 0);
    for (const e of r.errors) assert.ok(typeof e === 'string' && e.length > 5);
  }
  assert.match(validateTokens({ ...base, accent: 'red' }).errors.join('\n'), /accent/);
});