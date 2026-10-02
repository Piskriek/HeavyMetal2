import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import {
  CharacterSelect, DEFAULT_SETTINGS, GoblinFace, IntroOverlay, LoadingScreen, PauseMenu, ResultsScreen, SettingsScreen, StandingsScreen, TIPS, TitleScreen, ScreenStyles,
  adjustStat, budgetLeft, canPause, formatTime, initialFlow, isRacing, ordinal, podiumOrder, reduceFlow, sortStandings, statBars, tipFor, tradeoffText,
  type FlowAction, type FlowState, type RacerCard, type ResultRow, type StandingRow,
} from '../src';

const deepFreeze = <T,>(o: T): T => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
const run = (actions: FlowAction[], s: FlowState = initialFlow()): FlowState => actions.reduce((st, a) => reduceFlow(deepFreeze(st), a), s);
const screens = (actions: FlowAction[]): string[] => { let s = initialFlow(); const out = [s.screen]; for (const a of actions) { s = reduceFlow(deepFreeze(s), a); out.push(s.screen); } return out; };

test('a quick race: title to select to loading to intro to race, pause, resume, finish, results, title', () => {
  const path = screens([
    { type: 'play', mode: 'quick' }, { type: 'selectRacer', id: 'g1' }, { type: 'confirmRacer' }, { type: 'loadProgress', value: 0.5 }, { type: 'loaded' },
    { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'pause' }, { type: 'resume' }, { type: 'finish' }, { type: 'continue' },
  ]);
  assert.deepEqual(path, ['title', 'select', 'select', 'loading', 'loading', 'intro', 'intro', 'intro', 'intro', 'race', 'paused', 'race', 'results', 'title']);
});

test('the race can also start straight from the intro (the game runs the lights)', () => {
  const s = run([{ type: 'play', mode: 'quick' }, { type: 'selectRacer', id: 'a' }, { type: 'confirmRacer' }, { type: 'loaded' }, { type: 'raceStart' }]);
  assert.equal(s.screen, 'race');
  const t = initialFlow();
  assert.equal(reduceFlow(t, { type: 'raceStart' }), t);
});

test('countdown goes 3, 2, 1, 0 (GO) and then the race starts', () => {
  let s = run([{ type: 'play', mode: 'quick' }, { type: 'selectRacer', id: 'a' }, { type: 'confirmRacer' }, { type: 'loaded' }]);
  const seen = [s.countdown];
  while (s.screen === 'intro') { s = reduceFlow(s, { type: 'tickCountdown' }); seen.push(s.countdown); }
  assert.deepEqual(seen, [3, 2, 1, 0, 0]);
  assert.equal(s.screen, 'race');
});

test('a three-race championship goes results, standings, next race, and ends at the title', () => {
  let s = run([{ type: 'play', mode: 'championship', raceCount: 3 }, { type: 'selectRacer', id: 'a' }, { type: 'confirmRacer' }, { type: 'loaded' }]);
  assert.deepEqual([s.raceCount, s.raceIndex, s.mode], [3, 0, 'championship']);
  const raceOnce = (st: FlowState): FlowState => run([{ type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'finish' }, { type: 'continue' }], st);
  s = raceOnce(s); assert.deepEqual([s.screen, s.raceIndex], ['standings', 0]);
  s = run([{ type: 'continue' }], s); assert.deepEqual([s.screen, s.raceIndex], ['loading', 1]);
  s = raceOnce(run([{ type: 'loaded' }], s)); assert.equal(s.screen, 'standings');
  s = run([{ type: 'continue' }], s); assert.deepEqual([s.screen, s.raceIndex], ['loading', 2]);
  s = raceOnce(run([{ type: 'loaded' }], s)); assert.equal(s.screen, 'standings');
  s = run([{ type: 'continue' }], s); assert.deepEqual([s.screen, s.raceIndex], ['title', 0]);
});

test('actions that make no sense are ignored and return the very same object', () => {
  const t = initialFlow();
  for (const a of [{ type: 'confirmRacer' }, { type: 'pause' }, { type: 'resume' }, { type: 'finish' }, { type: 'continue' }, { type: 'loaded' }, { type: 'tickCountdown' }, { type: 'closeSettings' }, { type: 'quit' }, { type: 'restart' }] as FlowAction[]) assert.equal(reduceFlow(t, a), t, a.type);
  const sel = run([{ type: 'play', mode: 'quick' }]);
  assert.equal(reduceFlow(sel, { type: 'confirmRacer' }), sel, 'cannot start without a goblin');
  assert.equal(reduceFlow(sel, { type: 'play', mode: 'quick' }), sel);
});

test('settings return to where they came from, also through pause', () => {
  assert.deepEqual(screens([{ type: 'openSettings' }, { type: 'closeSettings' }]), ['title', 'settings', 'title']);
  let s = run([{ type: 'play', mode: 'quick' }, { type: 'selectRacer', id: 'a' }, { type: 'confirmRacer' }, { type: 'loaded' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'pause' }]);
  s = run([{ type: 'openSettings' }], s); assert.equal(s.screen, 'settings');
  s = run([{ type: 'closeSettings' }], s); assert.equal(s.screen, 'paused');
  s = run([{ type: 'resume' }], s); assert.equal(s.screen, 'race');
});

test('pause restart reloads the same race; quit returns to the title; quick results can restart', () => {
  let s = run([{ type: 'play', mode: 'quick' }, { type: 'selectRacer', id: 'a' }, { type: 'confirmRacer' }, { type: 'loaded' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'pause' }]);
  assert.equal(run([{ type: 'restart' }], s).screen, 'loading');
  assert.equal(run([{ type: 'quit' }], s).screen, 'title');
  s = run([{ type: 'resume' }, { type: 'finish' }], s);
  assert.equal(run([{ type: 'restart' }], s).screen, 'loading');
  const champ = run([{ type: 'play', mode: 'championship' }, { type: 'selectRacer', id: 'a' }, { type: 'confirmRacer' }, { type: 'loaded' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'tickCountdown' }, { type: 'finish' }]);
  assert.equal(reduceFlow(champ, { type: 'restart' }), champ);
});

test('race count: quick is always one, championship defaults to four and is clamped to 1..12; loading progress is clamped', () => {
  assert.equal(run([{ type: 'play', mode: 'quick', raceCount: 9 }]).raceCount, 1);
  assert.equal(run([{ type: 'play', mode: 'championship' }]).raceCount, 4);
  assert.equal(run([{ type: 'play', mode: 'championship', raceCount: 99 }]).raceCount, 12);
  assert.equal(run([{ type: 'play', mode: 'championship', raceCount: -3 }]).raceCount, 1);
  const l = run([{ type: 'play', mode: 'quick' }, { type: 'selectRacer', id: 'a' }, { type: 'confirmRacer' }]);
  assert.equal(run([{ type: 'loadProgress', value: 7 }], l).loadingProgress, 1);
  assert.equal(run([{ type: 'loadProgress', value: -1 }], l).loadingProgress, 0);
  assert.equal(run([{ type: 'loadProgress', value: NaN }], l).loadingProgress, 0);
});

test('canPause and isRacing', () => {
  const at = (screen: FlowState['screen']): FlowState => ({ ...initialFlow(), screen });
  assert.deepEqual((['title', 'select', 'loading', 'intro', 'race', 'paused', 'results'] as const).map((s) => canPause(at(s))), [false, false, false, true, true, false, false]);
  assert.deepEqual((['title', 'intro', 'race', 'paused', 'results'] as const).map((s) => isRacing(at(s))), [false, true, true, true, false]);
});

test('stats: bars, budget, refusing overspend, clamping, trade-off sentences', () => {
  const c = { weight: 5, speed: 5, bounce: 5 };
  assert.deepEqual(statBars(c).map((b) => [b.label, b.value, b.fraction]), [['Weight', 5, 0.5], ['Speed', 5, 0.5], ['Bounce', 5, 0.5]]);
  assert.equal(budgetLeft(c), 0);
  assert.equal(adjustStat(c, 'speed', 1), c, 'no points left');
  assert.deepEqual(adjustStat(c, 'speed', -1), { weight: 5, speed: 4, bounce: 5 });
  assert.equal(adjustStat({ weight: 1, speed: 1, bounce: 1 }, 'weight', -1).weight, 1);
  assert.equal(adjustStat({ weight: 10, speed: 1, bounce: 1 }, 'weight', 1).weight, 10);
  assert.equal(adjustStat({ weight: 4, speed: 4, bounce: 4 }, 'weight', 3).weight, 7);
  assert.equal(adjustStat({ weight: 4, speed: 4, bounce: 4 }, 'weight', 5).weight, 4, 'more than the points left is refused whole');
  assert.equal(budgetLeft({ weight: 9, speed: 9, bounce: 9 }), -12);
  assert.match(tradeoffText({ weight: 8, speed: 3, bounce: 4 }), /Heavy/);
  assert.match(tradeoffText({ weight: 3, speed: 8, bounce: 4 }), /Quick/);
  assert.match(tradeoffText({ weight: 3, speed: 4, bounce: 8 }), /Springy/);
  assert.match(tradeoffText({ weight: 5, speed: 5, bounce: 5 }), /Balanced/);
});

test('formatTime, ordinal, podiumOrder, sortStandings, tipFor', () => {
  assert.deepEqual([0, 61234, 5999, NaN, -1, Infinity].map(formatTime), ['0:00.000', '1:01.234', '0:05.999', '--:--.---', '--:--.---', '--:--.---']);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 111, 0, -2, 1.5].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '111th', '0', '-2', '1.5']);
  const r = (position: number, extra: Partial<ResultRow> = {}): ResultRow => ({ id: `r${position}`, name: `R${position}`, color: '#fff', position, ...extra });
  assert.deepEqual(podiumOrder([r(3), r(1), r(2), r(4)]).map((x) => x.position), [2, 1, 3]);
  assert.deepEqual(podiumOrder([r(1)]).map((x) => x.position), [1]);
  assert.deepEqual(podiumOrder([r(2), r(1)]).map((x) => x.position), [2, 1]);
  assert.deepEqual(podiumOrder([]), []);
  assert.deepEqual(podiumOrder([r(1, { dnf: true }), r(2), r(3)]).map((x) => x.position), [3, 2]);
  const row = (id: string, points: number, wins: number): StandingRow => ({ id, name: id, color: '#fff', points, wins, best: 1 });
  assert.deepEqual(sortStandings([row('b', 10, 0), row('a', 10, 1), row('c', 25, 0), row('d', 10, 0)]).map((x) => x.id), ['c', 'a', 'b', 'd']);
  assert.ok(TIPS.length >= 12);
  assert.equal(tipFor(0), tipFor(TIPS.length));
  assert.equal(tipFor(-1), TIPS[TIPS.length - 1]);
  assert.equal(tipFor(2.7), TIPS[2]);
  assert.equal(typeof tipFor(NaN), 'string');
});

const racers: RacerCard[] = [
  { id: 'g1', name: 'Grubnik', color: '#6fc24a', accent: '#ffd24a', weight: 8, speed: 3, bounce: 4 },
  { id: 'g2', name: 'Zippy', color: '#4aa3c2', accent: '#ff6b5e', weight: 3, speed: 8, bounce: 4, blurb: 'Fast.' },
];

test('every screen renders with its hooks', () => {
  const noop = (): void => {};
  const title = html(h(TitleScreen, { onPlay: noop, onSettings: noop, onEditor: noop }));
  for (const k of ['data-screen="title"', 'data-action="quick"', 'data-action="championship"', 'data-action="settings"', 'data-action="editor"', 'GOBLIN']) assert.ok(title.includes(k), k);
  assert.ok(!html(h(TitleScreen, { onPlay: noop, onSettings: noop })).includes('data-action="editor"'), 'check2');

  const none = html(h(CharacterSelect, { racers, selected: null, onSelect: noop, onConfirm: noop, onBack: noop }));
  assert.ok(none.includes('data-screen="select"') && none.includes('data-racer="g1"') && none.includes('data-racer="g2"'), 'check3');
  assert.match(none, /data-action="confirm"[^>]*disabled/);
  assert.match(none, /aria-disabled="true"/);
  const picked = html(h(CharacterSelect, { racers, selected: 'g2', onSelect: noop, onConfirm: noop, onBack: noop }));
  assert.ok(!/data-action="confirm"[^>]*disabled/.test(picked), 'check4');
  assert.match(picked, /data-racer="g2"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-racer="g2"/);
  const custom = html(h(CharacterSelect, { racers, selected: null, onSelect: noop, onConfirm: noop, onBack: noop, custom: { id: 'me', name: 'Mine', color: '#fff', accent: '#000', weight: 5, speed: 5, bounce: 4 }, onCustomChange: noop }));
  assert.ok(custom.includes('data-stat="weight"') && custom.includes('data-delta="-1"') && custom.includes('1 point left'), 'check5');

  const load = html(h(LoadingScreen, { progress: 0.426 }));
  assert.ok(load.includes('role="progressbar"') && load.includes('aria-valuenow="43"') && load.includes('Loading Basalt Isle'), 'check6');
  assert.ok(html(h(LoadingScreen, { progress: 9 })).includes('aria-valuenow="100"'), 'check7');

  const go = html(h(IntroOverlay, { countdown: 0, trackName: 'Basalt Isle', lap: 1, laps: 3 }));
  assert.ok(go.includes('data-count="0"') && go.includes('GO!') && go.includes('Lap 1 of 3'), 'check8');
  assert.ok(html(h(IntroOverlay, { countdown: 2 })).includes('data-count="2"'), 'check9');

  const pause = html(h(PauseMenu, { onResume: noop, onRestart: noop, onSettings: noop, onQuit: noop }));
  for (const k of ['role="dialog"', 'aria-modal="true"', 'data-action="resume"', 'data-action="restart"', 'data-action="settings"', 'data-action="quit"']) assert.ok(pause.includes(k), k);

  const set = html(h(SettingsScreen, { settings: DEFAULT_SETTINGS, onChange: noop, onClose: noop, onReset: noop }));
  for (const k of ['data-field="master"', 'data-field="sfx"', 'data-field="music"', 'data-field="quality"', 'data-field="reducedMotion"', 'data-action="reset"', 'data-action="close"', '80%']) assert.ok(set.includes(k), k);
  assert.ok(!set.includes('data-field="json"'), 'check12');
  assert.ok(html(h(SettingsScreen, { settings: DEFAULT_SETTINGS, onChange: noop, onClose: noop, tier: 'pro' })).includes('data-field="json"'), 'check13');

  const rows: ResultRow[] = [{ id: 'a', name: 'Ann', color: '#f00', position: 1, timeMs: 61234, isPlayer: true, pointsGained: 25 }, { id: 'b', name: 'Bo', color: '#0f0', position: 2, timeMs: 62000 }, { id: 'c', name: 'Cy', color: '#00f', position: 3, timeMs: 63000 }, { id: 'd', name: 'Di', color: '#ff0', position: 4, dnf: true }];
  const res = html(h(ResultsScreen, { rows, onContinue: noop, onRestart: noop }));
  for (const k of ['data-screen="results"', 'data-podium="1"', 'data-podium="2"', 'data-podium="3"', 'data-me="true"', '1:01.234', 'DNF', '+25', '1st', '2nd']) assert.ok(res.includes(k), k);

  const st: StandingRow[] = [{ id: 'a', name: 'Ann', color: '#f00', points: 40, wins: 1, best: 1 }, { id: 'b', name: 'Bo', color: '#0f0', points: 28, wins: 0, best: 2 }];
  const mid = html(h(StandingsScreen, { rows: st, raceIndex: 1, raceCount: 4, onContinue: noop, playerId: 'b' }));
  assert.ok(mid.includes('Standings after race 2 of 4') && mid.includes('Next race') && mid.includes('-12') && mid.includes('data-me="true"'), 'check15');
  const fin = html(h(StandingsScreen, { rows: st, raceIndex: 3, raceCount: 4, onContinue: noop, final: true }));
  assert.ok(fin.includes('Champion!') && fin.includes('Finish') && fin.includes('Ann'), 'check16');

  assert.ok(html(h(GoblinFace, { color: '#6fc24a', accent: '#ffd24a' })).includes('data-goblin="face"'), 'check17');
  assert.ok(html(h(ScreenStyles)).includes('.hms-btn'), 'check18');
});

test('reduced motion removes the animation class', () => {
  const noop = (): void => {};
  assert.ok(html(h(TitleScreen, { onPlay: noop, onSettings: noop })).includes('hms-motion'));
  assert.ok(!html(h(TitleScreen, { onPlay: noop, onSettings: noop, reducedMotion: true })).includes('hms-motion'));
});
