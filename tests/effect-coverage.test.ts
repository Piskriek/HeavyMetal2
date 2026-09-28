/**
 * M01 · T5 — **every painted effect kind can actually happen, and the events that matter are painted.**
 *
 * The effect runtime (T5) has five kinds — explosion, impact, dust, smoke, sparks — each with painted
 * art, a spawn spec and a pool. The renderer is generic over `event.kind`, so a kind with no emitter is
 * not an error anywhere: it is simply a thing the user asked for that never appears on screen. The first
 * half of this suite is the reachability guard against exactly that.
 *
 * The second half is the bug class this sweep kept finding: the engine also carries a **legacy particle
 * list** (`this.emit(...)`, the 2D renderer's sparks) which the 3D renderer does not read at all — so an
 * event that only emits particles is invisible. Three did: the launch kick-off, a shield eating a bump,
 * and the **finish burst**. Each now has a painted sibling, and each is asserted here.
 *
 * The engine cannot be constructed without WebGL, so the assertions are made the way this repo guards
 * its other integration points: by reading the source for the call, and — for reachability — by reading
 * every effect kind's emitter out of the tree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EFFECT_KINDS } from '../src/game/effects/events';
import { EFFECT_SPECS } from '../src/game/effects/pool';
import { EFFECT_SHEETS } from '../src/game/effects/renderer-fx';

const root = fileURLToPath(new URL('../', import.meta.url));

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (path.endsWith('.ts') || path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

test('every effect kind has an emitter, so no kind is art that can never appear', () => {
  const files = sourceFiles(join(root, 'src'));
  const sources = files.map((file) => readFileSync(file, 'utf8')).join('\n');

  for (const kind of EFFECT_KINDS) {
    // Either the engine's own effect queue (`effects.push('impact', …)`) or the sim's fx channel
    // (`fx.effect('explosion', …)`) — both end in the same queue the renderer drains.
    const queue = new RegExp(`push\\(\\s*'${kind}'`);
    const channel = new RegExp(`effect\\(\\s*'${kind}'`);
    assert.ok(
      queue.test(sources) || channel.test(sources),
      `nothing in src/ ever emits a '${kind}' effect: the art and its spec exist, but no event would draw them`,
    );
  }
});

test('the events that were invisible are painted now', () => {
  const engine = readFileSync(join(root, 'src/game/engine.ts'), 'utf8');

  // 1. The launch kick-off: dust.
  assert.match(engine, /this\.effects\.push\('dust', this\.player\.x, this\.player\.y, this\.player\.z, 1\.6, this\.player\.id, this\.tick\)/,
    'the push start throws painted dust');

  // 2. A shield eating a bump: an impact, at the ball that was saved.
  assert.match(engine, /this\.effects\.push\('impact', racer\.x, racer\.y, racer\.z, 0\.7, racer\.id, this\.tick\)/,
    'a shield hold is a visible impact');

  // 3. The finish burst: an explosion over the flag, with smoke under it.
  assert.match(engine, /this\.effects\.push\('explosion', this\.player\.x, this\.y\(FINISH\) - 140, this\.player\.z, 2\.2, this\.player\.id, this\.tick\)/,
    'the finish is an explosion-sized burst');
  assert.match(engine, /this\.effects\.push\('smoke', this\.player\.x, this\.y\(FINISH\) - 140, this\.player\.z, 1\.4, this\.player\.id, this\.tick\)/,
    'with smoke under it');

  // …and the never-drawn legacy 2D particles are gone (M6): the painted effects are the only record.
  assert.doesNotMatch(engine, /this\.emit\(|this\.particles|this\.airSheep|this\.trail\b/,
    'the engine keeps no particle, sheep or trail lists the 3D renderer never reads');
});

test('the engine hands the sim the same queue, so sim-side effects are painted too', () => {
  const engine = readFileSync(join(root, 'src/game/engine.ts'), 'utf8');
  assert.match(engine, /effect: \(kind, x, y, z, scale, racerId\) => engine\.effects\.push\(kind, x, y, z, scale, racerId, engine\.tick\)/,
    'the sim\'s fx channel is wired into the painted queue');
  // The painted runtime itself is `effects/renderer-fx.ts`, and it is generic over the kind — which is
  // exactly why reachability (the first test) is the property worth guarding: a kind nobody emits is
  // not a type error, it is a silence.
  const fx = readFileSync(join(root, 'src/game/effects/renderer-fx.ts'), 'utf8');
  assert.match(fx, /EFFECT_SPECS\[event\.kind\]/,
    'the renderer looks the kind up in the spec table rather than switching on it');
  assert.match(fx, /EFFECT_ART_PATHS|EFFECT_SHEETS/,
    'and its art is the painted sheets');
  const renderer = readFileSync(join(root, 'src/game/renderer-3d.ts'), 'utf8');
  assert.match(renderer, /this\.effects\?\.destroy\(\)|new EffectRenderer/,
    'the 3D renderer owns the painted runtime');
});

test('every effect kind has painted art that ships, and the painted wave is wired to its event', () => {
  // 1. A sheet per kind (or the shared spark points), and the file is really in public/.
  for (const kind of EFFECT_KINDS) {
    const spec = EFFECT_SPECS[kind];
    assert.ok(spec, `${kind} has a spec`);
    if (spec.sheet === 'points') continue;
    const sheet = EFFECT_SHEETS[spec.sheet];
    assert.ok(sheet, `${kind} names a sheet the runtime loads`);
    assert.equal(
      existsSync(join(root, 'public', sheet.url.replace(/^\//, ''))), true,
      `${kind}'s sheet (${sheet.url}) must ship`,
    );
  }

  // 2. Each new kind is emitted where the race already reacts, and nowhere else would do.
  const physics = readFileSync(join(root, 'src/game/sim/racer-physics.ts'), 'utf8');
  const engine = readFileSync(join(root, 'src/game/engine.ts'), 'utf8');
  assert.match(physics, /performBoost[\s\S]{0,900}effect\('boost',/, 'spending a boost charge paints the nitro flame');
  assert.match(physics, /case 'boost':[\s\S]{0,400}effect\('boost-pad',/, 'a boost pad lights up under the ball');
  assert.match(physics, /case 'spring':[\s\S]{0,400}effect\('spring',/, 'a spring throws a painted puff');
  assert.match(physics, /normalSpeed > 420\) ctx\.fx\.effect\('landing',/, 'only a hard landing rings the road');
  assert.match(physics, /edgeSmashVz[\s\S]{0,400}effect\('tree-smash',/, 'the tree line smash is painted');
  assert.match(engine, /pickupCollected[\s\S]{0,400}push\(\s*'pickup'[\s\S]{0,200}powerupTint\(kind\)/,
    'a supply taken bursts in the supply\'s own colour');
  assert.match(engine, /absorbShield[\s\S]{0,600}push\('shield-break'/, 'a shield spent shatters');
});

test('the race draws the painted track art, and nothing is a tinted box any more', () => {
  const view = readFileSync(join(root, 'src/game/obstacle-view.ts'), 'utf8');
  assert.doesNotMatch(view, /BLOCK_COLOURS|wireframe/, 'the interim tinted blocks are gone');
  assert.match(view, /preloadTrackArt/, 'the module preloads its own art');
  const race = readFileSync(join(root, 'src/screens/RaceScreen.tsx'), 'utf8');
  assert.match(race, /preloadTrackArt\(\)/, 'and the race screen calls it before the grid');
  const renderer = readFileSync(join(root, 'src/game/renderer-3d.ts'), 'utf8');
  assert.match(renderer, /shieldBubbleTexture\(\)/, 'the shield wears the painted hex bubble');
  assert.doesNotMatch(renderer, /wireframe: true/, 'and no wireframe sphere is left');
});
