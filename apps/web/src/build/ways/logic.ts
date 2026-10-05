import { LOGIC_PRESETS, WIRE_DOS, normalizeRule, ruleSentence } from '@hm/buildkit';
import type { WayCtx, WayHandler, WaySet } from './types';

const snipped = (n: number): string => (n ? (n === 1 ? 'Snip: one cord cut' : `Snip: ${n} cords cut`) : 'No cords there');

const snip = (ctx: WayCtx, n: number): void => { ctx.say(snipped(n)); ctx.fx(n ? 'delete' : 'ui-error', { volume: 0.5 }); };

/** Zone: a trigger box where you point (its size from the slider, enter or leave from the palette). Alt takes the nearest away with its wires. */
const zone: WayHandler = (ctx, { alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at the ground'); return; }
  if (alt) {
    const near = ctx.zoneNear(a);
    if (!near) { ctx.say('No zone there'); return; }
    ctx.removeZone(near.ref);
    ctx.say('Zone taken away, with its wires'); ctx.fx('delete', { volume: 0.5 });
    return;
  }
  ctx.putZone(a, Math.max(0.5, (ctx.drive('zone-size') ?? 4) / 2), 'Zone', ctx.player().palette.zone === 'leave' ? 'leave' : 'enter');
  ctx.save();
  ctx.say('A zone: now take Wire, click it, then click what it acts on'); ctx.fx('place', { volume: 0.5 });
};

/** Wire: click a zone, then the thing or lamp it acts on. Alt takes away the wires of what you point at. */
const wire: WayHandler = (ctx, { alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at the ground'); return; }
  const lamp = ctx.lampNear(a, 2);
  const target = ctx.modelAt(a)?.ref ?? lamp?.ref ?? null;
  if (alt) {
    if (!target) { ctx.say('Point at a wired thing or lamp'); return; }
    const n = ctx.removeWiresTo(target);
    if (!n) { ctx.say('No wires to that'); return; }
    ctx.say(n === 1 ? 'Its wire is off' : `Its ${n} wires are off`); ctx.fx('delete', { volume: 0.5 });
    return;
  }
  const from = ctx.wireFrom();
  if (!from) {
    const near = ctx.zoneNear(a);
    if (!near) { ctx.say(ctx.zoneCount() ? 'Click a zone first (the purple boxes)' : 'Put a zone down first (Zone)'); return; }
    ctx.setWireFrom(near.ref); ctx.say('Now click the thing or lamp it acts on'); ctx.fx('select', { volume: 0.5 });
    return;
  }
  const does = ctx.player().palette.wire ?? 'toggle';
  if (!target) { ctx.say('Click a thing or a lamp (Esc lets go of the wire)'); return; }
  if ((does === 'light-on' || does === 'light-off') && !lamp) { ctx.say('Light on and off need a lamp: click a lamp'); return; }
  ctx.setWireFrom(null);
  ctx.putWire(from, target, does, 'Wire');
  ctx.say(`Wired: walking into the zone does this: ${WIRE_DOS.find((d) => d.id === does)?.name.toLowerCase() ?? does}`); ctx.fx('place', { volume: 0.5 });
};

/** Add rule (and Remove rules, and Alt): the palette's rule on the thing you point at, or on the island for rules that need no thing. */
const rules: WayHandler = (ctx, { id, alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  const thing = a ? ctx.modelAt(a)?.ref ?? null : null;
  if (id === 'logic-remove' || alt) {
    if (!thing) { ctx.say('Point at a thing to take its rules off'); return; }
    const n = ctx.removeRulesOn(thing);
    if (!n) { ctx.say('No rules on that'); return; }
    ctx.say(n === 1 ? 'Its rule is off' : `Its ${n} rules are off`); ctx.fx('delete', { volume: 0.5 });
    return;
  }
  const preset = LOGIC_PRESETS.find((x) => x.id === ctx.player().palette.logic) ?? LOGIC_PRESETS[0]!;
  if (preset.needsThing && !thing) { ctx.say(`${preset.name}: point at a thing you placed`); return; }
  const rule = normalizeRule({ ...preset.rule, thing: preset.needsThing ? thing : '' }, 'new');
  const { id: _new, ...params } = rule;
  ctx.addRule(preset.name, params);
  ctx.say(ruleSentence(rule, thing ? ctx.thingName(thing).toLowerCase() : 'the island'));
  ctx.fx('place', { volume: 0.5 });
};

export const LOGIC_WAYS: WaySet = {
  'logic-zone': zone,
  'logic-wire': wire,
  'logic-attach': rules,
  'logic-remove': rules,
  /** Every rule of the island, in words. */
  'logic-rules': (ctx, { first }) => { if (first) ctx.openWindow('logic', 'Rules'); },
  /** Every zone and wire as a graph. */
  'logic-graph': (ctx, { first }) => { if (first) ctx.openWireGraph(); },

  /** A floor bell that chimes when a goblin steps on it. Alt takes it off. */
  'v3-doorbell': (ctx, { alt, first }) => {
    if (!first) return;
    const a = ctx.aim();
    if (!a) { ctx.say('Point at the ground'); return; }
    if (alt) { ctx.say(ctx.snipAt(a) ? 'Bell taken off' : 'No bell there'); return; }
    const z = ctx.putZone(a, 0.8, 'Doorbell');
    ctx.putWire(z, '', 'sound', 'Doorbell', 'ui-success');
    ctx.say('A doorbell: it chimes when a goblin steps on it'); ctx.fx('place', { volume: 0.5 });
  },

  /** Step-pad to Door (and Switch to Lamp): click the floor for the pad, then what it opens or lights. Alt snips. */
  'v3-cord': (ctx, { alt, first }) => {
    if (!first) return;
    const a = ctx.aim();
    if (!a) { ctx.say('Point at the ground'); return; }
    if (alt) { snip(ctx, ctx.snipAt(a)); return; }
    const does = ctx.player().palette.wire ?? 'toggle';
    const light = does === 'light-on';
    const from = ctx.wireFrom();
    if (!from) {
      ctx.setWireFrom(ctx.putZone(a, 0.9, light ? 'Switch' : 'Step-pad'));
      ctx.say(light ? 'Now click the lamp it lights' : 'Now click the thing it opens'); ctx.fx('place', { volume: 0.5 });
      return;
    }
    const lamp = ctx.lampNear(a, 2);
    const target = light ? lamp?.ref ?? null : ctx.modelAt(a)?.ref ?? lamp?.ref ?? null;
    if (!target) { ctx.say(light ? 'Click a lamp (Esc lets go of the cord)' : 'Click a thing (Esc lets go of the cord)'); return; }
    ctx.setWireFrom(null);
    ctx.putWire(from, target, does, 'Magic cord');
    ctx.say(light ? 'ZAP! Step on the switch to light it' : 'ZAP! Step on the pad to open it'); ctx.fx('place', { volume: 0.6 });
  },

  /** Wire Cutter: snip every cord of the pad, thing or lamp you point at. */
  'v3-cutter': (ctx, { first }) => {
    if (!first) return;
    const a = ctx.aim();
    if (!a) { ctx.say('Point at a pad, a thing or a lamp'); return; }
    snip(ctx, ctx.snipAt(a));
  },
};
