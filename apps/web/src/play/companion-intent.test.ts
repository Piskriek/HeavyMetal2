// Plan 48 owner feedback: the companion's spatial understanding is parsed and resolved by pure
// functions, so the exact phrases Piskriek used in the live game are pinned here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompanionIntent, resolveCompanionOrder, type CompanionPlayerPose } from './companion-intent';

const close = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

test('the owner\'s live phrases parse to the right intents', () => {
  assert.equal(parseCompanionIntent('float in front of me').kind, 'hover-front');
  assert.equal(parseCompanionIntent('Hover here').kind, 'hover-here');
  assert.equal(parseCompanionIntent('could you levitate ahead of me please').kind, 'hover-front');
  assert.equal(parseCompanionIntent('come here').kind, 'come-front');
  assert.equal(parseCompanionIntent('in front of me').kind, 'come-front');
  assert.equal(parseCompanionIntent('on my right flank').kind, 'flank-right');
  assert.equal(parseCompanionIntent('take my left side').kind, 'flank-left');
  assert.equal(parseCompanionIntent('stay here').kind, 'hold');
  assert.equal(parseCompanionIntent('hold position').kind, 'hold');
  assert.equal(parseCompanionIntent("don't move").kind, 'hold');
  assert.equal(parseCompanionIntent('follow me').kind, 'follow');
  assert.equal(parseCompanionIntent('back in formation').kind, 'follow');
  assert.equal(parseCompanionIntent('land now').kind, 'ground');
  assert.deepEqual(parseCompanionIntent('go to the gate'), { kind: 'landmark', name: 'gate' });
  assert.deepEqual(parseCompanionIntent('head over to the stargate'), { kind: 'landmark', name: 'gate' });
  assert.deepEqual(parseCompanionIntent('go to the rover'), { kind: 'landmark', name: 'rover' });
  assert.deepEqual(parseCompanionIntent('check the bench'), { kind: 'landmark', name: 'bench' });
  assert.equal(parseCompanionIntent('status report').kind, 'status');
  assert.deepEqual(parseCompanionIntent('hello there'), { kind: 'gesture', gesture: 'wave' });
  assert.deepEqual(parseCompanionIntent('great work out here'), { kind: 'gesture', gesture: 'cheer' });
  assert.equal(parseCompanionIntent('what do you think of the sunset').kind, 'chat');
  assert.equal(parseCompanionIntent('').kind, 'chat');
});

test('hover-front resolves 2.2 m along the player facing, hover on, with spatial confirmation', () => {
  // facing convention: forward = (-sin yaw, -cos yaw); yaw 0 faces -z
  const p: CompanionPlayerPose = { x: 10, z: -4, yaw: 0 };
  const o = resolveCompanionOrder(parseCompanionIntent('float in front of me'), p);
  assert.ok(o.hover);
  assert.ok(o.target && close(o.target.x, 10) && close(o.target.z, -6.2), JSON.stringify(o.target));
  assert.match(o.reply, /Hovering 2\.2 meters ahead at eye level/);

  const turned: CompanionPlayerPose = { x: 0, z: 0, yaw: Math.PI / 2 }; // forward = (-1, 0)
  const o2 = resolveCompanionOrder({ kind: 'hover-front' }, turned);
  assert.ok(o2.target && close(o2.target.x, -2.2) && close(o2.target.z, 0, 1e-9), JSON.stringify(o2.target));
});

test('flanks resolve 2.5 m out and 1.5 m back of the live pose', () => {
  const p: CompanionPlayerPose = { x: 0, z: 0, yaw: 0 }; // fwd (0,-1), right (1,0)
  const r = resolveCompanionOrder({ kind: 'flank-right' }, p);
  assert.ok(r.target && close(r.target.x, 2.5) && close(r.target.z, 1.5), JSON.stringify(r.target));
  const l = resolveCompanionOrder({ kind: 'flank-left' }, p);
  assert.ok(l.target && close(l.target.x, -2.5) && close(l.target.z, 1.5), JSON.stringify(l.target));
});

test('hold stops, follow resumes, landmarks use real coordinates and refuse unknown ones', () => {
  const p: CompanionPlayerPose = { x: 0, z: 0, yaw: 1.3 };
  assert.ok(resolveCompanionOrder({ kind: 'hold' }, p).hold);
  assert.ok(resolveCompanionOrder({ kind: 'follow' }, p).follow);
  const withGate = resolveCompanionOrder({ kind: 'landmark', name: 'gate' }, p, { gate: { x: 40, z: -7 } });
  assert.deepEqual(withGate.target, { x: 40, z: -7 });
  const noRover = resolveCompanionOrder({ kind: 'landmark', name: 'rover' }, p, {});
  assert.equal(noRover.target, null);
  assert.match(noRover.reply, /don't have coordinates/);
});

test('plan 49: kit orders about the pinged thing parse before any movement word', () => {
  // the owner's own words from the live walk-through
  assert.equal(parseCompanionIntent('remove the black and yellow chevrons on the base piece').kind, 'kit-strip-hazard');
  assert.equal(parseCompanionIntent('get rid of those hazard stripes').kind, 'kit-strip-hazard');
  // "on the ground" must not read as a landing order
  assert.equal(parseCompanionIntent('take the stripes off the ground there').kind, 'kit-strip-hazard');
  assert.equal(parseCompanionIntent('put the stripes back').kind, 'kit-restore-hazard');
  assert.equal(parseCompanionIntent('restore the chevrons').kind, 'kit-restore-hazard');
  assert.equal(parseCompanionIntent('save as default').kind, 'kit-save-default');
  assert.equal(parseCompanionIntent('make that the new default').kind, 'kit-save-default');
  assert.equal(parseCompanionIntent('undo that').kind, 'undo');
  assert.equal(parseCompanionIntent('reset the gate').kind, 'kit-reset');
  assert.equal(parseCompanionIntent('what is this').kind, 'ping-what');
  assert.equal(parseCompanionIntent("what's that thing").kind, 'ping-what');
  // the movement orders are unchanged
  assert.equal(parseCompanionIntent('land now').kind, 'ground');
  assert.deepEqual(parseCompanionIntent('go to the gate'), { kind: 'landmark', name: 'gate' });
  // a kit order resolves to no movement: the screen runs it on the last ping
  const o = resolveCompanionOrder({ kind: 'kit-strip-hazard' }, { x: 0, z: 0, yaw: 0 });
  assert.equal(o.target, null);
  assert.equal(o.hover || o.hold || o.follow, false);
});

test('plan 50: the drone\'s orders, finds and edit control parse ahead of the movement words', () => {
  assert.deepEqual(parseCompanionIntent('hold fire'), { kind: 'combat-mode', mode: 'hold-fire' });
  assert.deepEqual(parseCompanionIntent('weapons free'), { kind: 'combat-mode', mode: 'weapons-free' });
  assert.deepEqual(parseCompanionIntent('open fire'), { kind: 'combat-mode', mode: 'weapons-free' });
  assert.deepEqual(parseCompanionIntent('defend me'), { kind: 'combat-mode', mode: 'defend' });
  assert.deepEqual(parseCompanionIntent('cover my left'), { kind: 'cover', side: 'left' });
  assert.deepEqual(parseCompanionIntent('cover my six'), { kind: 'cover', side: 'rear' });
  assert.deepEqual(parseCompanionIntent('kill that'), { kind: 'focus', target: 'ping' });
  assert.deepEqual(parseCompanionIntent('focus the big one'), { kind: 'focus', target: 'biggest' });
  assert.deepEqual(parseCompanionIntent('shoot the nearest'), { kind: 'focus', target: 'nearest' });
  assert.deepEqual(parseCompanionIntent('find me guns'), { kind: 'scout', category: 'weapons' });
  assert.deepEqual(parseCompanionIntent('look for ore'), { kind: 'scout', category: 'resources' });
  assert.deepEqual(parseCompanionIntent('where is the exit'), { kind: 'scout', category: 'exits' });
  assert.equal(parseCompanionIntent('come back').kind, 'recall');
  assert.equal(parseCompanionIntent('keep it').kind, 'keep');
  assert.equal(parseCompanionIntent('undo').kind, 'undo');
  // the movement orders still win their own phrases
  assert.equal(parseCompanionIntent('hold position').kind, 'hold');
  assert.equal(parseCompanionIntent('come here').kind, 'come-front');
  assert.equal(parseCompanionIntent('take my left side').kind, 'flank-left');
  assert.equal(parseCompanionIntent('float in front of me').kind, 'hover-front');
});

test('review fixes: hold and follow words beat find words; only an explicit "keep it" commits', () => {
  assert.equal(parseCompanionIntent('I need you to guard the gate').kind, 'hold');
  assert.equal(parseCompanionIntent('hold here, any monsters coming?').kind, 'hold');
  assert.equal(parseCompanionIntent('looks good').kind === 'keep', false);
  assert.deepEqual(parseCompanionIntent('find me guns'), { kind: 'scout', category: 'weapons' });
});

test('plan 51: the player puts a mimicked mechanic in force by name', () => {
  assert.equal(parseCompanionIntent('apply the mimic').kind, 'mimic-apply');
  assert.equal(parseCompanionIntent('try the mimicked movement').kind, 'mimic-apply');
  assert.equal(parseCompanionIntent('use that mechanic').kind, 'mimic-apply');
  assert.equal(parseCompanionIntent('keep it').kind, 'keep');
});
