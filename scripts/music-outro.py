"""
Builds the instrumental outro loop for a sung track (the owner, 2026-10-14: after the last line, "popping in the courus
with no vocals after that and loop it").
  tools/python312/python.exe scripts/music-outro.py <song.mp3> <out-dir> [--bpm 120] [--bars 8]
1. Separates the song into vocals and the rest with Demucs (htdemucs, two stems), on the CPU.
2. Finds the beat grid of the backing (onset envelope, tempo near --bpm, the phase that best fits the onsets).
3. Finds where the vocals end, and the last vocal-free bar line after it, which is the switch point.
4. Takes the backing (no vocals) of the last --bars bars before the outro's final lines, and picks the window whose
   seam (end into start) is smoothest, from candidates near the final chorus.
5. Writes <out>/loop.mp3 as that window three times over (A A A). The game loops the middle copy (start = L, end = 2L):
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

# 3. where the vocals are (50 ms RMS, gaps under 0.6 s filled)
win = int(sr * 0.05)
vrms = np.sqrt(np.convolve((vocals.mean(axis=1)) ** 2, np.ones(win) / win, mode='same'))
active = vrms > 0.12 * np.percentile(vrms, 99)
idx = np.flatnonzero(active)
last_vocal = idx[-1] / sr
bar_lines = np.arange(bar0, dur + bar, bar)
switch = float(bar_lines[np.searchsorted(bar_lines, last_vocal + 0.05)])

# 4. the loop window: `bars` bars of backing ending at a bar line before the outro lines; the smoothest seam wins
L = int(round(bars * bar * sr))
outro_start = None
gaps = np.flatnonzero(np.diff(idx) > int(sr * 1.2))
if len(gaps):
    outro_start = idx[gaps[-1] + 1] / sr  # the last vocal phrase group starts after the last long gap
end_limit = outro_start if outro_start else last_vocal
candidates = [t for t in bar_lines if t + bars * bar <= end_limit + 0.01 and t >= end_limit - 3 * bars * bar]
def seam(t):
    a = int(t * sr)
    seg = backing[a : a + L]
    k = int(sr * 0.08)
    return float(np.mean((seg[-k:] - seg[:k]) ** 2)) / (float(np.mean(seg**2)) + 1e-9)
start = min(candidates, key=seam)
loop = backing[int(start * sr) : int(start * sr) + L]

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
    'lastVocal': round(float(last_vocal), 3), 'outroLinesStart': round(float(outro_start), 3) if outro_start else None,
    'switch': round(switch, 4), 'loopSourceStart': round(float(start), 4), 'loopBars': bars,
    'loopRegion': {'start': round(L / sr, 6), 'end': round(2 * L / sr, 6)},
    'seam': round(seam(start), 5), 'duration': round(dur, 3), 'sampleRate': sr,
}
(out_dir / 'outro.json').write_text(json.dumps(info, indent=2))
print(json.dumps(info, indent=2))
