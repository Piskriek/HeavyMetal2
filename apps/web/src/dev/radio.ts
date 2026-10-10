export {};

// Dev-only: audition the mentor's voice the way the game will play it: the clean VO through a field-radio chain,
// over a static bed and the music bed, each on its own fader. The music ducks under her while she talks.
//   /radio.html
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const LINES: Record<string, string> = {
  'mentor-act3.mp3': 'Act III: "Stage zero..." (eleven_v3 with tags)',
  'mentor-C.mp3': 'Act II: "Look outside..." (the design preview)',
};

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

/** A soft clipper: the radio's overdriven speaker. */
function drive(amount: number): Float32Array {
  const n = 1024, k = amount * 40, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; out[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return out;
}

const fader = (id: string): number => Number($<HTMLInputElement>(id).value) / 100;

async function play(): Promise<void> {
  stopPlayback?.();
  ctx ??= new AudioContext();
  const c = ctx;
  const line = $<HTMLSelectElement>('line').value;
  const [vo, st, mu] = await Promise.all([buffer(c, line), buffer(c, 'bed-static.mp3'), buffer(c, 'bed-music.mp3')]);
  const t0 = c.currentTime + 0.1, lead = 1.6;

  // the voice: band-limited like a field radio, a little overdriven, compressed
  const voSrc = c.createBufferSource(); voSrc.buffer = vo;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
  const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1800; mid.Q.value = 0.9; mid.gain.value = 4;
  const sh = c.createWaveShaper(); sh.curve = drive(fader('drive')) as unknown as Float32Array<ArrayBuffer>; sh.oversample = '2x';
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 4;
  const voGain = c.createGain(); voGain.gain.value = fader('vo') * 1.4;
  const radio = $<HTMLInputElement>('radio').checked;
  if (radio) voSrc.connect(hp).connect(lp).connect(mid).connect(sh).connect(comp).connect(voGain);
  else voSrc.connect(voGain);
  voGain.connect(c.destination);

  // the static bed, looped, filtered to sit behind the voice
  const stSrc = c.createBufferSource(); stSrc.buffer = st; stSrc.loop = true;
  const stLp = c.createBiquadFilter(); stLp.type = 'lowpass'; stLp.frequency.value = 5000;
  const stGain = c.createGain(); stGain.gain.value = fader('static') * 0.6;
  stSrc.connect(stLp).connect(stGain).connect(c.destination);

  // the music, ducked while she speaks
  const muSrc = c.createBufferSource(); muSrc.buffer = mu; muSrc.loop = true;
  const muGain = c.createGain(), m = fader('music'), duck = m * 0.45, end = t0 + lead + vo.duration;
  muGain.gain.setValueAtTime(m, t0);
  muGain.gain.setValueAtTime(m, t0 + lead - 0.4); muGain.gain.linearRampToValueAtTime(duck, t0 + lead);
  muGain.gain.setValueAtTime(duck, end); muGain.gain.linearRampToValueAtTime(m, end + 1.2);
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
for (const id of ['vo', 'static', 'music', 'drive']) {
  const input = $<HTMLInputElement>(id), out = $(`${id}-v`);
  const show = (): void => { out.textContent = input.value; };
  input.addEventListener('input', show); show();
}
$('play').addEventListener('click', () => { void play(); });
$('stop').addEventListener('click', () => stopPlayback?.());
(window as unknown as { __radioReady: boolean }).__radioReady = true;
