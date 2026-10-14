"""
Builds the instrumental outro loop for a sung track (the owner, 2026-10-14: after the last line, "popping in the courus
with no vocals after that and loop it").
  tools/python312/python.exe scripts/music-outro.py <song.mp3> <out-dir> [--bpm 120] [--bars 8]  (the stems are cached in <out-dir>/separated)
1. Separates the song into vocals and the rest with Demucs (htdemucs, two stems), on the CPU.
2. Finds the beat grid of the backing (onset envelope, tempo near --bpm, the phase that best fits the onsets).
3. Finds where she last sings, in 100 ms frames against a low threshold (an outro spoken or sung softly over a fading
   backing is a fifth of the chorus level, which a per-bar "is she singing" test missed: 2026-10-14, "Sector Four" was
   cut), and the first bar line after it, which is the switch point.
4. Picks the loop from the last loud stretch of backing (the final chorus): for each bar-aligned start, the true length
   of --bars bars there is found by cross-correlating the audio around the start with the audio around the end (the
   generated track drifts a few ms in tempo, so the average grid is not sample-exact), and the start whose
   continuation best matches its own start wins. The wrap is crossfaded over 150 ms with the gain law for the measured
   correlation, so the level neither dips nor bumps.
5. Writes <out>/loop.mp3 as that loop three times over (A A A). The game loops the middle copy (start = L, end = 2L):
   any window one period long inside a periodic signal is a full period, so the loop stays seamless whatever delay or
   padding the MP3 decoder adds. It also writes <out>/outro.json (the switch time in the song, the loop region, the
   tempo) and <out>/preview.mp3 (the song to the switch, then the loop twice, faded), for a listen.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

args = sys.argv[1:]
song_path, out_dir = Path(args[0]), Path(args[1])
bpm_hint = float(args[args.index('--bpm') + 1]) if '--bpm' in args else 120.0
bars = int(args[args.index('--bars') + 1]) if '--bars' in args else 8
out_dir.mkdir(parents=True, exist_ok=True)

# 1. separation (Demucs reads the WAV we write; soundfile decodes the MP3, so no ffmpeg is needed)
audio, sr = sf.read(str(song_path), dtype='float32', always_2d=True)
wav = out_dir / 'song.wav'
sf.write(str(wav), audio, sr)
sep_root = out_dir / 'separated'
stems = sep_root / 'htdemucs' / 'song'
if not (stems / 'no_vocals.wav').exists():
    subprocess.run([sys.executable, '-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', str(sep_root), str(wav)], check=True)
vocals, _ = sf.read(str(stems / 'vocals.wav'), dtype='float32', always_2d=True)
backing, _ = sf.read(str(stems / 'no_vocals.wav'), dtype='float32', always_2d=True)
n = min(len(audio), len(vocals), len(backing))
audio, vocals, backing = audio[:n], vocals[:n], backing[:n]
dur = n / sr

# 2. the beat grid from the backing's onsets (spectral flux, 10 ms hops)
hop = int(sr * 0.01)
mono = backing.mean(axis=1)
frames = np.lib.stride_tricks.sliding_window_view(mono, 2048)[::hop]
spec = np.abs(np.fft.rfft(frames * np.hanning(2048), axis=1))
flux = np.maximum(np.diff(np.log1p(spec), axis=0), 0).sum(axis=1)
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = sr / hop
best = None
for bpm in np.arange(bpm_hint * 0.9, bpm_hint * 1.1, 0.05):
    period = fps * 60.0 / bpm
    for phase in np.arange(0, period, 0.5):
        idx = (phase + period * np.arange(int((len(flux) - phase) / period))).astype(int)
        score = flux[idx].mean()
        if best is None or score > best[0]:
            best = (score, bpm, phase / fps)
_, bpm, beat0 = best
beat = 60.0 / bpm
bar = beat * 4

# downbeat: of the four beat phases, the one where the low band (the kick) hits hardest
low = spec[:, 1 : int(2048 * 150 / sr)].sum(axis=1)
def strength(t0):
    ts = np.arange(t0, dur - 0.1, bar)
    return np.mean([low[min(len(low) - 1, int(t * fps))] for t in ts])
bar0 = max((beat0 + k * beat for k in range(4)), key=strength)

# 3. where she last sings: 100 ms frames, against a twentieth of the chorus level (bars of vocals, loudest 30%)
bar_lines = np.arange(bar0, dur, bar)
vmono = vocals.mean(axis=1)
bar_rms = np.array([np.sqrt(np.mean(vmono[int(t * sr) : int((t + bar) * sr)] ** 2) + 1e-12) for t in bar_lines])
chorus_level = float(np.median(np.sort(bar_rms)[int(len(bar_rms) * 0.7) :]))
fr = int(sr * 0.1)
frame_rms = np.sqrt(np.mean(vmono[: len(vmono) // fr * fr].reshape(-1, fr) ** 2, axis=1))
active = np.flatnonzero(frame_rms > max(0.004, 0.05 * chorus_level))
last_vocal = float((active[-1] + 1) * fr / sr)
switch = float(bar_lines[np.searchsorted(bar_lines, last_vocal + 0.1)]) if last_vocal + 0.1 < bar_lines[-1] else dur

# 4. the loop, from the last loud stretch of backing (bars at 75% of the 90th-percentile level or more)
bmono = backing.mean(axis=1)
b_rms = np.array([np.sqrt(np.mean(bmono[int(t * sr) : int((t + bar) * sr)] ** 2) + 1e-12) for t in bar_lines])
loud_bar = b_rms >= 0.75 * float(np.percentile(b_rms, 90))
W, R = int(0.5 * sr), int(0.05 * sr)
def align(t):
    """The sample-exact length of `bars` bars from t, and how well the audio after it matches the audio at t."""
    a, L0 = int(t * sr), int(round(bars * bar * sr))
    x, y = bmono[a - W : a + W], bmono[a + L0 - W - R : a + L0 + W + R]
    m = len(x) + len(y)
    c = np.fft.irfft(np.fft.rfft(y, m) * np.conj(np.fft.rfft(x, m)), m)[: len(y) - len(x) + 1]
    cs = np.concatenate([[0.0], np.cumsum(y.astype(np.float64) ** 2)])
    ncc = c / (np.sqrt(cs[len(x) :] - cs[: -len(x)] + 1e-12) * np.sqrt(np.sum(x.astype(np.float64) ** 2) + 1e-12))
    k = int(np.argmax(ncc))
    return L0 + k - R, float(ncc[k])
def fits(i):  # the bar before, the loop's bars and the bar after are all loud
    return i >= 1 and i + bars < len(bar_lines) and bool(loud_bar[i - 1 : i + bars + 1].all())
idx = [i for i in range(len(bar_lines)) if fits(i) and bar_lines[i] + bars * bar <= last_vocal]
runs = np.split(np.array(idx), np.flatnonzero(np.diff(idx) > 1) + 1) if idx else []
final = list(runs[-1]) if runs else []
scored = [(align(float(bar_lines[i])), float(bar_lines[i])) for i in final]
(L, rho), start = max(scored, key=lambda r: r[0][1])
a = int(start * sr)
loop = backing[a : a + L].copy()
X = int(sr * 0.15)  # the wrap: the loop's last 150 ms blends into what precedes its start in the song
th = np.linspace(0, np.pi / 2, X)[:, None]
g_in, g_out = np.sin(th), np.cos(th)
norm = np.sqrt(1 + 2 * max(0.0, rho) * g_in * g_out)
loop[L - X :] = (backing[a + L - X : a + L] * g_out + backing[a - X : a] * g_in) / norm

# 5. outputs
import lameenc
def mp3(path, data):
    enc = lameenc.Encoder()
    enc.set_bit_rate(192); enc.set_in_sample_rate(sr); enc.set_channels(2); enc.set_quality(2)
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2').tobytes()
    path.write_bytes(enc.encode(pcm) + enc.flush())
mp3(out_dir / 'loop.mp3', np.concatenate([loop, loop, loop]))
fade = np.linspace(1, 0, int(sr * 4))[:, None]
tail = np.concatenate([loop, loop])
tail[-len(fade):] *= fade
xf = int(sr * 0.05)
head = audio[: int(switch * sr)].copy()
head[-xf:] *= np.linspace(1, 0, xf)[:, None]
tail[:xf] *= np.linspace(0, 1, xf)[:, None]
mp3(out_dir / 'preview.mp3', np.concatenate([head, tail]))
info = {
    'bpm': round(float(bpm), 3), 'bar': round(bar, 5), 'firstDownbeat': round(float(bar0), 4),
    'lastVocal': round(last_vocal, 3), 'switch': round(switch, 4), 'loopSourceStart': round(start, 4), 'loopBars': bars,
    'loopSamples': int(L), 'loopRegion': {'start': round(L / sr, 6), 'end': round(2 * L / sr, 6)},
    'seamCorrelation': round(rho, 4), 'duration': round(dur, 3), 'sampleRate': sr,
}
(out_dir / 'outro.json').write_text(json.dumps(info, indent=2))
print(json.dumps(info, indent=2))
