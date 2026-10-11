// Dev-only: audition the generated music and sound effects (scripts/runworld-audio.mjs writes public/audio/ and its
// index.json). Each entry plays once or on loop; the owner marks it Keep or Redo, and "Copy verdicts" puts the list
// on the clipboard to paste back. The Moon score scrubber crossfades the seven stage tracks (music-moon-s0..s6) live,
// the way a plot's score is meant to gain fidelity with its stage.
//   /audio.html
import { kv } from '../storage/profile-storage';
interface Entry { readonly id: string; readonly kind: 'music' | 'sfx'; readonly duration: number; readonly text: string; readonly loop: boolean }
type Verdict = 'keep' | 'redo';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const KEY = 'fidelity.audio-verdicts';
const verdicts: Record<string, Verdict> = (() => {
  try { return JSON.parse(kv.get(KEY) ?? '{}') as Record<string, Verdict>; } catch { return {}; }
})();
const save = (): void => kv.set(KEY, JSON.stringify(verdicts));

// per-file levels and loop regions (public/audio/levels.json), the same the game applies
interface Level { readonly gain: number; readonly start?: number; readonly end?: number }
let LEVELS: Record<string, Level> = {};
const gainOf = (id: string): number => 10 ** ((LEVELS[id]?.gain ?? 0) / 20);
const loopRegion = (src: AudioBufferSourceNode, id: string): void => { const l = LEVELS[id]; if (l?.start !== undefined && l.end !== undefined) { src.loopStart = l.start; src.loopEnd = l.end; } };

let ctx: AudioContext | null = null;
const audio = (): AudioContext => (ctx ??= new AudioContext());
const buffers = new Map<string, Promise<AudioBuffer>>();
const load = (id: string): Promise<AudioBuffer> => {
  let p = buffers.get(id);
  if (!p) { p = fetch(`/audio/${id}.mp3`).then((r) => r.arrayBuffer()).then((b) => audio().decodeAudioData(b)); buffers.set(id, p); }
  return p;
};

/** A readable name: "music-moon-s3" is "Moon, stage 3", "sfx-ui-hover" is "UI hover". */
function label(id: string): string {
  const stage = /^music-moon-s(\d)$/.exec(id);
  if (stage) return `Moon, stage ${stage[1]}`;
  const words = id.replace(/^(music|sfx)-/, '').split('-').map((w) => (w === 'ui' ? 'UI' : w));
  const first = words[0] ?? '';
  return [first.charAt(0).toUpperCase() + first.slice(1), ...words.slice(1)].join(' ');
}

// ---- one entry at a time

let current: { li: HTMLLIElement; stop(): void } | null = null;

async function playEntry(e: Entry, li: HTMLLIElement, loop: boolean): Promise<void> {
  current?.stop();
  stopScore();
  const c = audio(), buf = await load(e.id);
  const src = c.createBufferSource(); src.buffer = buf; src.loop = loop;
  loopRegion(src, e.id);
  const level = c.createGain(); level.gain.value = gainOf(e.id);
  src.connect(level).connect(c.destination);
  src.start();
  li.classList.add('playing');
  const playBtn = li.querySelector<HTMLButtonElement>('.play');
  if (playBtn) playBtn.textContent = 'Stop';
  const stop = (): void => {
    try { src.stop(); } catch { /* already ended */ }
    li.classList.remove('playing');
    if (playBtn) playBtn.textContent = 'Play';
    if (current?.li === li) current = null;
  };
  src.onended = () => { if (current?.li === li) stop(); };
  current = { li, stop };
}

function row(e: Entry): HTMLLIElement {
  const li = document.createElement('li');
  const name = document.createElement('div'); name.className = 'name';
  name.textContent = label(e.id);
  const len = document.createElement('span'); len.className = 'len'; len.textContent = `${e.duration} s${e.loop ? ', loops' : ''}`;
  name.appendChild(len);
  const prompt = document.createElement('div'); prompt.className = 'prompt'; prompt.textContent = e.text;
  const ctl = document.createElement('div'); ctl.className = 'ctl';
  const play = document.createElement('button'); play.className = 'play'; play.textContent = 'Play';
  const loop = document.createElement('button'); loop.className = 'quiet'; loop.textContent = 'Loop';
  loop.setAttribute('aria-pressed', String(e.loop));
  const keep = document.createElement('button'); keep.className = 'keep quiet'; keep.textContent = 'Keep';
  const redo = document.createElement('button'); redo.className = 'redo'; redo.textContent = 'Redo';
  const show = (): void => {
    const v = verdicts[e.id];
    keep.setAttribute('aria-pressed', String(v === 'keep'));
    redo.setAttribute('aria-pressed', String(v === 'redo'));
    li.classList.toggle('keep', v === 'keep');
    li.classList.toggle('redo', v === 'redo');
    tally();
  };
  const mark = (v: Verdict): void => { if (verdicts[e.id] === v) delete verdicts[e.id]; else verdicts[e.id] = v; save(); show(); };
  play.addEventListener('click', () => { if (current?.li === li) current.stop(); else void playEntry(e, li, loop.getAttribute('aria-pressed') === 'true'); });
  loop.addEventListener('click', () => loop.setAttribute('aria-pressed', String(loop.getAttribute('aria-pressed') !== 'true')));
  keep.addEventListener('click', () => mark('keep'));
  redo.addEventListener('click', () => mark('redo'));
  ctl.append(play, loop, keep, redo);
  li.append(name, ctl, prompt);
  show();
  return li;
}

// ---- the Moon score: all seven stage tracks running together, crossfaded by the scrubber (equal power)

let score: { gains: (GainNode | null)[]; stop(): void } | null = null;
const scrub = $<HTMLInputElement>('stage');

function stageGain(v: number, i: number): number {
  const d = Math.abs(v - i);
  return d >= 1 ? 0 : Math.cos((d * Math.PI) / 2);
}

function placeHead(): void {
  const v = Number(scrub.value);
  $('head').style.left = `${((v + 0.5) / 7) * 100}%`;
  $('now').innerHTML = `Stage <b>${v.toFixed(1)}</b>`;
  if (score) {
    const t = audio().currentTime;
    score.gains.forEach((g, i) => g?.gain.setTargetAtTime(stageGain(v, i) * gainOf(`music-moon-s${i}`), t, 0.08));
  }
}

function stopScore(): void {
  score?.stop();
  score = null;
  $('score-play').textContent = 'Play score';
}

let scoreLoading = false;
async function playScore(have: Set<string>): Promise<void> {
  if (scoreLoading) return;
  scoreLoading = true;
  const btn = $<HTMLButtonElement>('score-play');
  btn.textContent = 'Loading the score…'; btn.disabled = true;
  current?.stop();
  const c = audio(), t0 = c.currentTime + 0.15, v = Number(scrub.value);
  const sources: AudioBufferSourceNode[] = [];
  const gains = await Promise.all([0, 1, 2, 3, 4, 5, 6].map(async (i) => {
    const id = `music-moon-s${i}`;
    if (!have.has(id)) return null;
    const src = c.createBufferSource(); src.buffer = await load(id); src.loop = true;
    loopRegion(src, id);
    const g = c.createGain(); g.gain.value = stageGain(v, i) * gainOf(id);
    src.connect(g).connect(c.destination);
    sources.push(src);
    return g;
  }));
  scoreLoading = false; btn.disabled = false;
  for (const s of sources) s.start(Math.max(t0, c.currentTime + 0.05));
  score = { gains, stop: () => { for (const s of sources) { try { s.stop(); } catch { /* ended */ } } } };
  $('score-play').textContent = 'Stop score';
}

// ---- verdicts

let all: Entry[] = [];
function tally(): void {
  const kept = all.filter((e) => verdicts[e.id] === 'keep').length;
  const redo = all.filter((e) => verdicts[e.id] === 'redo').length;
  $('tally').innerHTML = `<b>${kept}</b> kept, <b>${redo}</b> to redo, ${all.length - kept - redo} not heard yet`;
}

$('copy').addEventListener('click', () => {
  const pick = (v: Verdict): string => all.filter((e) => verdicts[e.id] === v).map((e) => e.id).join(', ') || 'none';
  const text = `Sound verdicts\nkeep: ${pick('keep')}\nredo: ${pick('redo')}`;
  void navigator.clipboard.writeText(text).then(
    () => { $('copy').textContent = 'Copied'; setTimeout(() => { $('copy').textContent = 'Copy verdicts'; }, 1500); },
    () => { window.prompt('Copy these verdicts:', text); },
  );
});

try {
  all = (await (await fetch('/audio/index.json')).json()) as Entry[];
  try { LEVELS = ((await (await fetch('/audio/levels.json')).json()) as { levels: Record<string, Level> }).levels; } catch { /* no levels yet: play as generated */ }
} catch { all = []; }
const have = new Set(all.map((e) => e.id));
for (const kind of ['music', 'sfx'] as const) {
  const list = $<HTMLUListElement>(kind);
  const entries = all.filter((e) => e.kind === kind);
  if (entries.length === 0) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = 'Nothing generated yet. Run node scripts/runworld-audio.mjs, then reload.';
    list.appendChild(li);
  }
  for (const e of entries) list.appendChild(row(e));
}
[...$('stages').querySelectorAll('span')].forEach((s, i) => s.classList.toggle('missing', !have.has(`music-moon-s${i}`)));
scrub.addEventListener('input', placeHead);
$('score-play').addEventListener('click', () => { if (score) stopScore(); else void playScore(have); });
placeHead();
tally();
(window as unknown as { __audioReady: boolean }).__audioReady = true;

export {};

