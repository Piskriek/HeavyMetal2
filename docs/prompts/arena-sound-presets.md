# Prompt for the Arena AIs: game sounds, made from math

Copy everything below the line into the Arena chat as one message. It is self-contained: no files, links or secrets.

---

You are making the sound effects for a stylised 3D island game: goblins racing in glass balls, players building their own islands with brushes and tools. The feel we want is **Warcraft-style cartoon punch**: every sound is short, chunky and readable over music; it says what happened in one beat (a pickup is bright and rising, a crash is a thump with crunch, a tool tick is soft and dry); warm and playful, never harsh, shrill or realistic-recorded.

There are no audio files. Every sound is a **recipe**: a few synthesiser layers that the game plays live with the browser's Web Audio API (oscillators and filtered noise with an attack/decay envelope). You write recipes as JSON in the exact format below.

## The format

```json
{
  "id": "boost",
  "durationMs": 400,
  "category": "race",
  "layers": [
    { "wave": "sawtooth", "freq": [140, 600], "gain": 0.3, "attackMs": 30, "decayMs": 370 },
    { "wave": "noise", "freq": [200, 200], "gain": 0.25, "attackMs": 20, "decayMs": 380,
      "filter": { "type": "bandpass", "freq": [800, 3200], "q": 1.5 } }
  ]
}
```

(That is our current boost: correct format, a bit thin. Do better.)

| field | what it is |
|---|---|
| `id` | the sound's name (lists below) |
| `durationMs` | total length, at least every layer's `delayMs + attackMs + decayMs`, at most **1600** |
| `category` | `"race"`, `"editor"` or `"ui"` |
| `layers` | 1 to **6** layers, all playing together |
| layer `wave` | `"sine"`, `"square"`, `"sawtooth"`, `"triangle"` or `"noise"` |
| layer `freq` | `[start, end]` in Hz; the pitch glides exponentially from start to end over the layer (ignored for `noise`: use a filter to shape noise) |
| layer `gain` | 0 to 1 (the layers add up: keep the **sum of all gains at or under 0.9** so nothing clips) |
| layer `attackMs`, `decayMs` | the envelope: rise to `gain` in `attackMs`, then fall to silence over `decayMs` (both at least 1) |
| layer `delayMs` (optional) | starts the layer later: arpeggios, echoes, a crunch after a thump |
| layer `detune` (optional) | cents, -1200 to 1200: thicken a layer against another |
| layer `filter` (optional) | `{ "type": "lowpass" \| "highpass" \| "bandpass", "freq": [start, end], "q": 0.1 to 20 }`; the cutoff glides from start to end |

Hard rules: frequencies 20 to 12000 Hz; no layer longer than the sound; the loudest moment never above the sum-of-gains limit; nothing above 9 kHz louder than gain 0.15 (it hurts on laptop speakers).

## What to make

For each sound below, **three variants** with ids `<id>-a`, `<id>-b`, `<id>-c` (the game picks one at random each time so repeats do not grate: same character, slightly different pitch, timing or layering).

**Race** (`"race"`): `countdown-beep` (3, 2, 1), `go` (the start), `boost`, `jump`, `item-pickup`, `hit-wall` (a glass ball into a wall), `hit-racer` (two balls), `splash` (into water), `lap`, `finish`, `respawn`, `oil` (an oil slick), `shockwave`, `freeze`.

**Building** (`"editor"`): `paint-tick` (a brush dab, plays many times a second: very soft and short), `sculpt-tick` (the ground moving, also repeats: soft, earthy), `place` (a thing set down), `delete`, `undo`, `redo`, `snap`, `select`, `tool-switch`, `save`; and new ones for the ways to sculpt: `sculpt-grab` (pulling ground, a stretchy creak), `sculpt-clay` (soft slap), `sculpt-crease` (a sharp scrape), `sculpt-stamp` (a heavy thump), `sculpt-terrace` (stony clicks), `sculpt-erode` (a trickle).

**Interface** (`"ui"`): `ui-click`, `ui-hover` (barely there), `ui-toggle`, `ui-error` (a gentle "no", not an alarm), `ui-success`.

## Tricks that give the cartoon punch in this format

- **A body and a click**: a low sine or triangle thump (60 to 200 Hz, fast attack, 80 to 200 ms decay) plus a very short high click or filtered-noise tick on top (attack 1 ms, decay 10 to 30 ms).
- **Rising is good, falling is bad**: pickups and successes glide up (or arpeggiate up with `delayMs`), errors and crashes glide down.
- **Crunch**: a `noise` layer through a `bandpass` whose cutoff falls (for example 3000 to 600 Hz) over 100 to 200 ms, starting 10 to 20 ms after the thump.
- **Glass ball**: a short `sine` around 1800 to 2600 Hz with a fast decay, slightly detuned against a second one, for a glassy ring on hits.
- **Repeating ticks** must stay under 60 ms and quiet (sum of gains 0.25 or less), or they become a buzz when dragged.

## What to send back

1. One JSON array with every recipe (all ids above, three variants each).
2. One line per sound on what you were going for.

Double-check before you answer: every `id` exactly as listed plus `-a`, `-b`, `-c`; `durationMs` covers every layer and is at most 1600; 1 to 6 layers; the gains add up to 0.9 or less; every number inside its range. Invalid recipes are thrown away.
