"""
Speeds a track up, two ways, for the owner to hear (2026-10-14, "Four Floats" v4b at "about 1.2x speed"):
  tools/python312/python.exe scripts/music-speed.py <in.mp3> <factor> <out-stem>
- <out-stem>-tempo.mp3: faster, same pitch (Rubber Band through pedalboard's time_stretch, high quality, formants kept).
- <out-stem>-speed.mp3: faster and higher, like a playback-speed control (a resample; the pitch rises 12*log2(factor)
  semitones, about 3.2 at 1.2x).
"""
import sys

import lameenc
import numpy as np
import pedalboard
import soundfile as sf
import torch
import torchaudio.functional as AF

src, factor, stem = sys.argv[1], float(sys.argv[2]), sys.argv[3]
audio, sr = sf.read(src, dtype='float32', always_2d=True)  # (samples, channels)


def mp3(path, data):
    enc = lameenc.Encoder()
    enc.set_bit_rate(192); enc.set_in_sample_rate(sr); enc.set_channels(data.shape[1]); enc.set_quality(2)
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2').tobytes()
    with open(path, 'wb') as f:
        f.write(enc.encode(pcm) + enc.flush())


tempo = pedalboard.time_stretch(np.ascontiguousarray(audio.T), sr, stretch_factor=factor, high_quality=True, preserve_formants=True).T
mp3(f'{stem}-tempo.mp3', tempo)
speed = AF.resample(torch.from_numpy(np.ascontiguousarray(audio.T)), orig_freq=int(round(sr * factor)), new_freq=sr).numpy().T
mp3(f'{stem}-speed.mp3', speed)
print(f'in {len(audio) / sr:.2f} s -> tempo {len(tempo) / sr:.2f} s, speed {len(speed) / sr:.2f} s (pitch +{12 * np.log2(factor):.2f} st)')
