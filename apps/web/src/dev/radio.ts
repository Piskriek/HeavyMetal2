// Dev-only: audition the mentor's voice the way the game will play it: the clean VO blended with a field-radio
// chain, over a static bed and the music bed, each on its own fader. The music ducks under her while she talks.
// The chain and the default levels come from ../audio/mentor-mix.ts, the same source the game uses.
//   /radio.html
import { MENTOR_MIX, driveCurve, radioBlend } from '../audio/mentor-mix';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const LINES: Record<string, string> = {
  'mentor-act3.mp3': 'Act III: "Stage zero..." (eleven_v3 with tags)',
  'mentor-C.mp3': 'Act II: "Look outside..." (the design preview)',
};
// fader ids on the page, and the mix level each one starts at
const FADERS = { vo: 'voice', blend: 'radio', static: 'static', music: 'music', drive: 'overdrive' } as const;

let ctx: AudioContext | null = null;
let stopPlayback: (() => void) | null = null;
const buffers = new Map<string, AudioBuffer>();

async function buffer(c: AudioContext, name: string): Promise<AudioBuffer> {
  const hit = buffers.get(name);
  if (hit) return hit;
  const b = await c.decodeAudioData(await (await fetch(`/src/dev/tmp/${name}`)).arrayBuffer());
  buffers.set(name, b);
  return b;
}

const fader = (id: keyof typeof FADERS): number => Number($<HTMLInputElement>(id).value) / 100;

async function play(): Promise<void> {
  stopPlayback?.();
  ctx ??= new AudioContext();
  const c = ctx, M = MENTOR_MIX;
  const line = $<HTMLSelectElement>('line').value;
  const [vo, st, mu] = await Promise.all([buffer(c, line), buffer(c, 'bed-static.mp3'), buffer(c, 'bed-music.mp3')]);
  const t0 = c.currentTime + 0.1, lead = 1.6;

  // the voice: the radio band (wet) blended with the clean voice (dry)
  const voSrc = c.createBufferSource(); voSrc.buffer = vo;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = M.band.highpassHz; hp.Q.value = M.band.highpassQ;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = M.band.lowpassHz; lp.Q.value = M.band.lowpassQ;
  const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = M.presence.hz; mid.Q.value = M.presence.q; mid.gain.value = M.presence.gainDb;
  const deHarsh = c.createBiquadFilter(); deHarsh.type = 'peaking'; deHarsh.frequency.value = M.deHarsh.hz; deHarsh.Q.value = M.deHarsh.q; deHarsh.gain.value = M.deHarsh.gainDb;
  const sh = c.createWaveShaper(); sh.curve = driveCurve(fader('drive')) as unknown as Float32Array<ArrayBuffer>; sh.oversample = '4x';
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = M.compressor.thresholdDb; comp.ratio.value = M.compressor.ratio; comp.attack.value = M.compressor.attackS; comp.release.value = M.compressor.releaseS;
  const blend = radioBlend($<HTMLInputElement>('radio').checked ? fader('blend') : 0);
  const wet = c.createGain(), dry = c.createGain(); wet.gain.value = blend.wet; dry.gain.value = blend.dry;
  const voGain = c.createGain(); voGain.gain.value = fader('vo') * M.scale.voice;
  voSrc.connect(hp).connect(lp).connect(mid).connect(deHarsh).connect(sh).connect(comp).connect(wet).connect(voGain);
  voSrc.connect(dry).connect(voGain);
  voGain.connect(c.destination);

  // the static bed, looped, filtered to sit behind the voice
  const stSrc = c.createBufferSource(); stSrc.buffer = st; stSrc.loop = true;
  const stLp = c.createBiquadFilter(); stLp.type = 'lowpass'; stLp.frequency.value = M.staticLowpassHz;
  const stGain = c.createGain(); stGain.gain.value = fader('static') * M.scale.static;
  stSrc.connect(stLp).connect(stGain).connect(c.destination);

  // the music, ducked while she speaks
  const muSrc = c.createBufferSource(); muSrc.buffer = mu; muSrc.loop = true;
  const muGain = c.createGain(), m = fader('music'), duck = m * M.duck.to, end = t0 + lead + vo.duration;
  muGain.gain.setValueAtTime(m, t0);
  muGain.gain.setValueAtTime(m, t0 + lead - M.duck.downS); muGain.gain.linearRampToValueAtTime(duck, t0 + lead);
  muGain.gain.setValueAtTime(duck, end); muGain.gain.linearRampToValueAtTime(m, end + M.duck.upS);
  muSrc.connect(muGain).connect(c.destination);

  muSrc.start(t0); stSrc.start(t0); voSrc.start(t0 + lead);
  const tail = setTimeout(() => stopPlayback?.(), (lead + vo.duration + 4) * 1000);
  $('state').textContent = `playing: ${LINES[line] ?? line} · ${vo.duration.toFixed(1)} s`;
  stopPlayback = () => {
    clearTimeout(tail);
    for (const s of [voSrc, stSrc, muSrc]) { try { s.stop(); } catch { /* already stopped */ } }
    $('state').textContent = 'stopped';
    stopPlayback = null;
  };
}

for (const [file, label] of Object.entries(LINES)) {
  const o = document.createElement('option'); o.value = file; o.textContent = label; $<HTMLSelectElement>('line').appendChild(o);
}
for (const [id, level] of Object.entries(FADERS) as [keyof typeof FADERS, keyof typeof MENTOR_MIX.levels][]) {
  const input = $<HTMLInputElement>(id), out = $(`${id}-v`);
  input.value = String(MENTOR_MIX.levels[level]);
  const show = (): void => { out.textContent = input.value; };
  input.addEventListener('input', show); show();
}
$('play').addEventListener('click', () => { void play(); });
$('stop').addEventListener('click', () => stopPlayback?.());
(window as unknown as { __radioReady: boolean }).__radioReady = true;
