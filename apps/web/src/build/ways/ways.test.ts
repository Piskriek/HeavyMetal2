import test from 'node:test';
import assert from 'node:assert/strict';
import { V3_TABS } from '@hm/buildkit';
import { runWay, wayIndex, type WayAim, type WayCtx } from './index';
import { FUNNY } from './sound';

/** A fake island: records what the ways asked for. */
function fakeCtx(opts: { aim?: WayAim | null; wire?: string; logic?: string; zoneWhen?: string; underThing?: boolean; model?: string | null; lamp?: string | null; zone?: string | null; zones?: number; wiresTo?: number; rulesOn?: number; nearest?: number; lampSlots?: number; sound?: string; effect?: string; lamp_?: string; walks?: boolean; flies?: number; char?: string; brain?: string; physMat?: string; full?: string; snips?: number; random?: number } = {}) {
  const log: string[] = [];
  let from: string | null = null;
  let zones = 0;
  let walkPts: [number, number][] | null = null;
  let slow = false;
  const palette: Record<string, string> = {};
  if (opts.wire) palette['wire'] = opts.wire;
  if (opts.logic) palette['logic'] = opts.logic;
  if (opts.zoneWhen) palette['zone'] = opts.zoneWhen;
  if (opts.sound) palette['sound'] = opts.sound;
  if (opts.effect) palette['effects'] = opts.effect;
  if (opts.lamp_) palette["lamp"] = opts.lamp_;
  if (opts.brain) palette["characters"] = opts.brain;
  if (opts.physMat) palette["physics"] = opts.physMat;
  const ctx: WayCtx = {
    player: () => ({ palette }) as never,
    aim: () => (opts.aim === undefined ? { point: [1, 2, 3], normal: [0, 1, 0] } : opts.aim),
    say: (t) => log.push(`say:${t}`),
    fx: (s) => log.push(`fx:${s}`),
    burst: (s, n, at) => log.push(`burst:${s}:${n}:${at.join(',')}`),
    shake: (p) => log.push(`shake:${p}`),
    random: () => opts.random ?? 0,
    setTimeOfDay: (h, l) => log.push(`time:${h}:${l}`),
    openLayers: () => log.push('open:layers'),
    openWireGraph: () => log.push('open:graph'),
    tourEvent: (e) => log.push(`tour:${e}`),
    modelAt: () => (opts.model ? { ref: opts.model } : null),
    lampNear: () => (opts.lamp ? { ref: opts.lamp } : null),
    putZone: (_a, half, label, when) => { zones++; log.push(`zone:${half}:${label}${when ? `:${when}` : ''}`); return `zone-${zones}`; },
    putWire: (f, t, does, label) => log.push(`wire:${f}->${t}:${does}:${label}`),
    snipAt: () => opts.snips ?? 0,
    zoneNear: () => (opts.zone ? { ref: opts.zone } : null),
    zoneCount: () => opts.zones ?? 0,
    removeZone: (ref) => log.push(`remove-zone:${ref}`),
    removeWiresTo: (ref) => { log.push(`remove-wires:${ref}`); return opts.wiresTo ?? 0; },
    addRule: (name, params) => log.push(`rule:${name}:${String(params['thing'] ?? '')}`),
    removeRulesOn: (thing) => { log.push(`remove-rules:${thing}`); return opts.rulesOn ?? 0; },
    openWindow: (id) => log.push(`open:${id}`),
    placeChild: (list, kind, prefix, name, params) => { log.push(`place:${list}:${kind}:${name}:${JSON.stringify(params)}`); return `${prefix}-1`; },
    removeNearest: (list, _a, within) => { log.push(`remove:${list}:${within}`); return (opts.nearest ?? 0) > 0; },
    previewSound: (w) => log.push(`preview:${w}`),
    soundName: (w) => `Sound ${w}`,
    effectOnce: (k, at) => log.push(`once:${k}:${at.join(',')}`),
    lampSlots: () => opts.lampSlots ?? 8,
    walk: {
      drawing: () => walkPts !== null,
      start: (t) => { walkPts = []; log.push(`walk-start:${t}`); },
      push: (p) => { walkPts?.push([p[0], p[1]]); log.push(`walk-push:${p.join(',')}`); },
      pop: () => { walkPts?.pop(); log.push('walk-pop'); },
      last: () => walkPts?.[walkPts.length - 1] ?? null,
      lay: () => { walkPts = null; log.push('walk-lay'); },
      stop: (t) => { log.push(`walk-stop:${t}`); return opts.walks ?? false; },
    },
    camera: {
      photo: () => log.push('photo'),
      toggleSlowMo: () => { slow = !slow; return slow; },
      orbit: (t, s) => log.push(`orbit:${t ?? 'me'}:${s}`),
    },
    physics: {
      swing: (_at, p) => { log.push(`swing:${p}`); return opts.flies ?? 0; },
      setMaterial: (t, m) => log.push(`material:${t}:${m}`),
      drop: (t, h) => { log.push(`drop:${t}:${h}`); return true; },
    },
    chars: {
      near: () => (opts.char ? { index: 0, ref: opts.char } : null),
      remove: (c) => log.push(`char-remove:${c.ref}`),
      setBrain: (c, b, l) => log.push(`char-brain:${c.ref}:${b}:${l}`),
      spawn: (_a, b, l) => log.push(`char-spawn:${b}:${l}`),
    },
    thingName: () => 'Barrel',
    drive: (name) => (name === 'zone-size' ? 6 : null),
    save: () => log.push('save'),
    overBudget: (kind) => (opts.full === kind ? `full of ${kind}` : null),
    wireFrom: () => from,
    setWireFrom: (id) => { from = id; },
    carveUnder: (add, size) => { if (!opts.underThing) return false; log.push(`carve:${add}:${size}`); return true; },
    sculptGround: (add, _now, first) => { log.push(`ground:${add}:${first}`); return true; },
    toolSize: () => 2,
    memo: new Map(),
  };
  return { ctx, log, from: () => from };
}
const use = (id: string, alt = false, first = true) => ({ id, alt, now: 0, first });

/** Every bind in the V3 spec, wherever it sits (buttons, presets, sub-tools). */
function binds(x: unknown, out: { way: string; todo: boolean }[] = []): { way: string; todo: boolean }[] {
  if (Array.isArray(x)) { for (const y of x) binds(y, out); return out; }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const b = o['bind'] as { way?: unknown; todo?: unknown } | undefined;
    if (b && typeof b.way === 'string') out.push({ way: b.way, todo: b.todo === true });
    for (const v of Object.values(o)) binds(v, out);
  }
  return out;
}

test('every way id lives in one tab file', () => {
  assert.ok(wayIndex().size >= 11);
});

test('every working V3 button the island handles itself has a handler', () => {
  const ids = wayIndex();
  const missing = binds(V3_TABS).filter((b) => !b.todo && (b.way.startsWith('v3-') || b.way === 'logic-graph') && !ids.has(b.way)).map((b) => b.way);
  assert.deepEqual([...new Set(missing)], []);
});

test('an unknown way is not handled', () => {
  const { ctx } = fakeCtx();
  assert.equal(runWay(ctx, use('raise')), false);
});

test('noon and night set the time of day', () => {
  const f = fakeCtx();
  assert.equal(runWay(f.ctx, use('v3-noon')), true);
  runWay(f.ctx, use('v3-night'));
  assert.ok(f.log.includes('time:12:Noon') && f.log.includes('time:22:Night'));
  const g = fakeCtx();
  runWay(g.ctx, use('v3-noon', false, false));
  assert.deepEqual(g.log, [], 'a held click does it once');
});

test('funny sounds pick from the list and burst stars above the aim', () => {
  const f = fakeCtx({ random: 0.999 });
  runWay(f.ctx, use('v3-funny'));
  assert.ok(f.log.includes(`fx:${FUNNY[FUNNY.length - 1]}`));
  assert.ok(f.log.includes('burst:stars:12:1,3,3'));
});

test('the roar shakes and says ROAR', () => {
  const f = fakeCtx({ aim: null });
  runWay(f.ctx, use('v3-roar'));
  assert.ok(f.log.includes('shake:rumble') && f.log.includes('say:ROAR!'));
  assert.ok(!f.log.some((l) => l.startsWith('burst')), 'no aim, no burst');
});

test('the cord: first click a pad, second click wires it to the thing', () => {
  const f = fakeCtx({ model: 'door' });
  runWay(f.ctx, use('v3-cord'));
  assert.equal(f.from(), 'zone-1');
  runWay(f.ctx, use('v3-cord'));
  assert.equal(f.from(), null);
  assert.ok(f.log.includes('wire:zone-1->door:toggle:Magic cord'));
});

test('the light cord needs a lamp and keeps the pad until one is clicked', () => {
  const f = fakeCtx({ wire: 'light-on', model: 'door' });
  runWay(f.ctx, use('v3-cord'));
  runWay(f.ctx, use('v3-cord'));
  assert.equal(f.from(), 'zone-1', 'a thing is not a lamp');
  assert.ok(f.log.some((l) => l.startsWith('say:Click a lamp')));
});

test('cutter and Alt snip', () => {
  const f = fakeCtx({ snips: 2 });
  runWay(f.ctx, use('v3-cutter'));
  runWay(f.ctx, use('v3-cord', true));
  assert.equal(f.log.filter((l) => l === 'say:Snip: 2 cords cut').length, 2);
  const g = fakeCtx({ snips: 0 });
  runWay(g.ctx, use('v3-cutter'));
  assert.ok(g.log.includes('say:No cords there') && g.log.includes('fx:ui-error'));
});

test('the doorbell is a zone wired to a chime', () => {
  const f = fakeCtx();
  runWay(f.ctx, use('v3-doorbell'));
  assert.ok(f.log.includes('zone:0.8:Doorbell') && f.log.includes('wire:zone-1->:sound:Doorbell'));
});

test('clay on a thing carves once; on the ground it keeps brushing', () => {
  const t = fakeCtx({ underThing: true });
  runWay(t.ctx, use('v3-clay-plump'));
  runWay(t.ctx, use('v3-clay-plump', false, false));
  assert.deepEqual(t.log, ['carve:true:2'], 'a stroke on a thing stays one carve');
  const g = fakeCtx();
  runWay(g.ctx, use('v3-clay-scoop'));
  runWay(g.ctx, use('v3-clay-scoop', false, false));
  assert.deepEqual(g.log, ['ground:false:true', 'tour:used-sculpt', 'ground:false:false']);
  const alt = fakeCtx({ underThing: true });
  runWay(alt.ctx, use('v3-clay-scoop', true));
  assert.deepEqual(alt.log, ['carve:true:2'], 'Alt on Scoop adds');
});

test('hierarchy and the wire graph open their windows', () => {
  const f = fakeCtx();
  runWay(f.ctx, use('v3-hierarchy'));
  runWay(f.ctx, use('logic-graph'));
  assert.deepEqual(f.log, ['open:layers', 'open:graph']);
});

test('logic zone: size from the slider, enter or leave from the palette, Alt takes the nearest away', () => {
  const f = fakeCtx({ zoneWhen: 'leave' });
  runWay(f.ctx, use('logic-zone'));
  assert.ok(f.log.includes('zone:3:Zone:leave') && f.log.includes('save'));
  const g = fakeCtx({ zone: 'zone-a' });
  runWay(g.ctx, use('logic-zone', true));
  assert.ok(g.log.includes('remove-zone:zone-a'));
  const h = fakeCtx();
  runWay(h.ctx, use('logic-zone', true));
  assert.ok(h.log.includes('say:No zone there'));
});

test('logic wire: a zone first, then a thing; light wires need a lamp', () => {
  const none = fakeCtx({ zones: 0 });
  runWay(none.ctx, use('logic-wire'));
  assert.ok(none.log.includes('say:Put a zone down first (Zone)'));
  const f = fakeCtx({ zone: 'zone-a', model: 'door' });
  runWay(f.ctx, use('logic-wire'));
  assert.equal(f.from(), 'zone-a');
  runWay(f.ctx, use('logic-wire'));
  assert.ok(f.log.includes('wire:zone-a->door:toggle:Wire'));
  const lamp = fakeCtx({ zone: 'zone-a', model: 'door', wire: 'light-on' });
  runWay(lamp.ctx, use('logic-wire'));
  runWay(lamp.ctx, use('logic-wire'));
  assert.ok(lamp.log.includes('say:Light on and off need a lamp: click a lamp'));
  assert.equal(lamp.from(), 'zone-a', 'keeps the zone until a lamp is clicked');
  const off = fakeCtx({ model: 'door', wiresTo: 2 });
  runWay(off.ctx, use('logic-wire', true));
  assert.ok(off.log.includes('say:Its 2 wires are off'));
});

test('rules: the palette rule on the thing, Alt or Remove takes them off, Rules opens the window', () => {
  const f = fakeCtx({ model: 'barrel', logic: 'touch-spin' });
  runWay(f.ctx, use('logic-attach'));
  assert.ok(f.log.includes('rule:Touch: spin:barrel'));
  const nothing = fakeCtx({ model: null, logic: 'touch-spin' });
  runWay(nothing.ctx, use('logic-attach'));
  assert.ok(nothing.log.includes('say:Touch: spin: point at a thing you placed'));
  const off = fakeCtx({ model: 'barrel', rulesOn: 1 });
  runWay(off.ctx, use('logic-remove'));
  runWay(off.ctx, use('logic-attach', true));
  assert.equal(off.log.filter((l) => l === 'say:Its rule is off').length, 2);
  const w = fakeCtx();
  runWay(w.ctx, use('logic-rules'));
  assert.deepEqual(w.log, ['open:logic']);
});

test('every bound way on a migrated tab has a handler (the Sun and sky ways stay in the island for now)', () => {
  const ids = wayIndex();
  const stay = new Set(['light-look', 'light-sun']);
  const migrated = new Set(['effects', 'sound', 'logic', 'physics', 'characters']);
  const tabOf = (x: unknown, out: { tab: string; way: string; todo: boolean }[] = []): typeof out => {
    if (Array.isArray(x)) { for (const y of x) tabOf(y, out); return out; }
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      const b = o['bind'] as { tab?: unknown; way?: unknown; todo?: unknown } | undefined;
      if (b && typeof b.way === 'string' && typeof b.tab === 'string') out.push({ tab: b.tab, way: b.way, todo: b.todo === true });
      for (const v of Object.values(o)) tabOf(v, out);
    }
    return out;
  };
  const missing = tabOf(V3_TABS).filter((b) => !b.todo && (migrated.has(b.tab) || (b.tab === 'lights' && !stay.has(b.way)) || b.way.startsWith('anim-') || b.way.startsWith('cam-')) && !ids.has(b.way)).map((b) => `${b.tab}:${b.way}`);
  assert.deepEqual([...new Set(missing)], []);
});

test('sound: play previews, place puts a spot (an ambience is a zone), Alt takes the nearest away', () => {
  const play = fakeCtx({ sound: 'jump' });
  runWay(play.ctx, use('sound-play'));
  assert.deepEqual(play.log, ['preview:jump', 'say:Sound jump']);
  const spot = fakeCtx({ sound: 'jump' });
  runWay(spot.ctx, use('sound-place'));
  const placed = spot.log.find((l) => l.startsWith('place:soundscape:sound-spot:Sound jump:'))!;
  assert.ok(placed, 'a one-shot spot');
  assert.deepEqual(JSON.parse(placed.slice(placed.indexOf('{'))), { what: 'jump', x: 1, y: 2, z: 3, size: 10, volume: 0.8, every: 4, on: true });
  const amb = fakeCtx({ sound: 'forest-birds' });
  runWay(amb.ctx, use('sound-place'));
  assert.ok(amb.log.some((l) => l.includes('"size":8')), 'an ambience is an 8 m zone');
  const gone = fakeCtx({ nearest: 1 });
  runWay(gone.ctx, use('sound-place', true));
  assert.ok(gone.log.includes('remove:soundscape:4') && gone.log.includes('say:Sound taken away'));
  const list = fakeCtx();
  runWay(list.ctx, use('sound-list'));
  assert.deepEqual(list.log, ['open:soundscape']);
});

test('effects: place with the slider scale, play once, remove the nearest', () => {
  const f = fakeCtx({ effect: 'campfire' });
  runWay(f.ctx, use('effects-place'));
  assert.ok(f.log.some((l) => l.startsWith('place:effects:effect:') && l.includes('"scale":1')));
  const once = fakeCtx({ effect: 'campfire' });
  runWay(once.ctx, use('effects-once'));
  assert.deepEqual(once.log, ['once:campfire:1,2,3', 'fx:select']);
  const none = fakeCtx({ nearest: 0 });
  runWay(none.ctx, use('effects-remove'));
  assert.ok(none.log.includes('say:No effect near there'));
});

test('lamps: the palette lamp at its height, Potato says lamps are not lit, Alt removes', () => {
  const f = fakeCtx({ lamp_: 'campfire' });
  runWay(f.ctx, use('light-lamp'));
  const placed = f.log.find((l) => l.startsWith('place:lamps:lamp:'))!;
  assert.ok(placed && JSON.parse(placed.slice(placed.indexOf('{'))).y === 2.4, 'a campfire sits 0.4 m up');
  const potato = fakeCtx({ lampSlots: 0 });
  runWay(potato.ctx, use('light-lamp'));
  assert.ok(potato.log.some((l) => l.endsWith('(lamps are not lit on Potato graphics)')));
  const gone = fakeCtx({ nearest: 1 });
  runWay(gone.ctx, use('light-lamp-remove'));
  assert.ok(gone.log.includes('say:Lamp taken away'));
});

test('animate: pick the walker, click points, the last again lays it; Alt drops a point; Stop', () => {
  const f = fakeCtx({ model: 'barrel' });
  runWay(f.ctx, use('anim-path'));
  assert.ok(f.log.includes('walk-start:barrel'));
  runWay(f.ctx, use('anim-path'));
  runWay(f.ctx, use('anim-path', true));
  runWay(f.ctx, use('anim-path'));
  runWay(f.ctx, use('anim-path'));
  assert.deepEqual(f.log.filter((l) => l.startsWith('walk-')), ['walk-start:barrel', 'walk-push:1,3', 'walk-pop', 'walk-push:1,3', 'walk-lay']);
  const none = fakeCtx({ model: null });
  runWay(none.ctx, use('anim-path'));
  assert.ok(none.log.includes('say:Click the thing that should walk'));
  const stop = fakeCtx({ model: 'barrel', walks: true });
  runWay(stop.ctx, use('anim-stop'));
  assert.ok(stop.log.includes('say:It stays put now'));
});

test('camera: photo, slow motion toggles, orbit round the thing or you for the slider time', () => {
  const f = fakeCtx({ model: 'barrel' });
  runWay(f.ctx, use('cam-photo'));
  runWay(f.ctx, use('cam-slowmo'));
  runWay(f.ctx, use('cam-slowmo'));
  runWay(f.ctx, use('cam-orbit'));
  assert.ok(f.log.includes('photo') && f.log.includes('say:Slow motion') && f.log.includes('say:Back to speed'));
  assert.ok(f.log.includes('orbit:barrel:8') && f.log.includes('say:Flying round Barrel (Esc stops)'));
  const me = fakeCtx({ aim: null });
  runWay(me.ctx, use('cam-orbit'));
  assert.ok(me.log.includes('orbit:me:8'));
});

test('physics: give the material (Alt wood), drop, hammer', () => {
  const f = fakeCtx({ model: 'barrel', physMat: 'ice' });
  runWay(f.ctx, use('phys-give'));
  assert.ok(f.log.includes('material:barrel:ice') && f.log.includes('say:Barrel is slippery ice now: Drop shows how it lands'));
  runWay(f.ctx, use('phys-give', true));
  assert.ok(f.log.includes('material:barrel:wood'));
  runWay(f.ctx, use('phys-drop', true));
  assert.ok(f.log.includes('drop:barrel:6'));
  const h = fakeCtx({ flies: 2 });
  runWay(h.ctx, use('phys-hammer'));
  assert.ok(h.log.includes('swing:4') && h.log.includes('say:Bonk! 2 things fly'));
});

test('characters: spawn with the palette brain, change the nearest, Alt on Spawn removes', () => {
  const f = fakeCtx({ brain: 'wander' });
  runWay(f.ctx, use('chars-spawn'));
  assert.ok(f.log.includes('char-spawn:wander:Character: Wander'));
  const c = fakeCtx({ brain: 'wander', char: 'char-1' });
  runWay(c.ctx, use('chars-change'));
  assert.ok(c.log.includes('char-brain:char-1:wander:Behaves: Wander'));
  runWay(c.ctx, use('chars-spawn', true));
  assert.ok(c.log.includes('char-remove:char-1'));
  const none = fakeCtx();
  runWay(none.ctx, use('chars-remove'));
  assert.ok(none.log.includes('say:Point at a character'));
});

test('over budget: lamps, effects, sounds and characters are refused with the sentence, nothing placed', () => {
  for (const [id, kind] of [['light-lamp', 'lamps'], ['effects-place', 'effects'], ['sound-place', 'sounds'], ['chars-spawn', 'characters']] as const) {
    const f = fakeCtx({ full: kind });
    runWay(f.ctx, use(id));
    assert.ok(f.log.includes(`say:full of ${kind}`) && f.log.includes('fx:ui-error'), id);
    assert.ok(!f.log.some((l) => l.startsWith('place:') || l.startsWith('char-spawn')), `${id} placed nothing`);
  }
  const ok = fakeCtx({ full: 'effects' });
  runWay(ok.ctx, use('light-lamp'));
  assert.ok(ok.log.some((l) => l.startsWith('place:lamps')), 'another kind being full does not stop lamps');
});
