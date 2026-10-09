# Prompt for the Arena AIs: character moves, made from a handful of numbers

Copy everything below the line into the Arena chat as one message. It is self-contained: no files, links or secrets.

---

You are making the animations for the characters of a stylised 3D island game: chunky voxel goblins (and other avatars) that walk around islands, race in glass balls, build with tools and celebrate. The feel we want is **Warcraft-style cartoon**: big readable poses, a bit of swagger and bounce, goblin mischief; every move readable from 20 metres away; nothing stiff, nothing realistic-mocap.

There are no keyframes or files. Every move is a **preset**: about a dozen numbers that the game turns into a pose at any moment. A character has six parts: body, head, two arms, two legs. You write presets as JSON in the exact format below.

## The format

```json
{
  "id": "walk",
  "name": "Walk",
  "style": "walk",
  "cadence": 0.95,
  "legSwing": 32,
  "armSwing": 28,
  "armRaise": 0,
  "bob": 0.025,
  "lean": 4,
  "headNod": 3,
  "sway": 3,
  "twist": 6,
  "duration": 1,
  "loop": true
}
```

| field | what it does | range |
|---|---|---|
| `id` | the move's name (lowercase, dashes) | |
| `name` | what players see, sentence case, 1 to 3 words | |
| `style` | the kind of move; it decides how the numbers are used | `"idle"`, `"walk"`, `"run"`, `"waddle"`, `"jump"`, `"fall"`, `"swing"`, `"wave"`, `"dance"`, `"cheer"` |
| `cadence` | cycles per second (a walk cycle is two steps) | 0 to 4 |
| `legSwing` | degrees the legs swing forward and back | 0 to 80 |
| `armSwing` | degrees the arms swing | 0 to 120 |
| `armRaise` | degrees the arms are held up or out (180 is straight up) | 0 to 170 |
| `bob` | how far the body bounces, as a share of the character's height | 0 to 0.15 |
| `lean` | degrees the body leans forward (negative: back) | -45 to 45 |
| `headNod` | degrees the head nods | -45 to 45 |
| `sway` | degrees the body rocks side to side | -45 to 45 |
| `twist` | degrees the shoulders twist against the hips | -45 to 45 |
| `duration` | seconds a one-off move lasts (ignored when `loop` is true) | 0.2 to 8 |
| `loop` | repeats forever (walks, idles) or plays once (a swing, a cheer) | true / false |

How each style uses the numbers (a number a style does not list does nothing for it):

- `idle` (loop): `bob` (breathing rise), `armSwing` (arms drift out), `headNod`, `sway`, at `cadence`. No lean, legs or twist.
- `walk`, `run`, `waddle` (loop): legs and arms swing in opposition by `legSwing` and `armSwing`; `armRaise` holds the arms out and forward; `bob` bounces twice a cycle; `lean`, `headNod`, `sway`, `twist`.
- `jump` (once): over `duration` the arms rise to `armRaise` and out by `armSwing`, the legs tuck by `legSwing`, the body lifts by `bob` and leans by `lean`.
- `fall` (loop): arms out by `armRaise` (flapping a little with `armSwing`), legs kicking by `legSwing`, `lean`.
- `swing` (once): the right arm winds up overhead (`armRaise`), strikes down (`armSwing`) and returns; the shoulders twist (`twist`) and the body leans into the strike (`lean`).
- `wave` (once): the right arm rises out to `armRaise` and waves by `armSwing` at `cadence`; the head tilts (`headNod`) and the body rocks (`sway`).
- `dance` (once): the arms and legs take turns with the beat (`armRaise`, `armSwing`, `legSwing`), with `bob`, `sway`, `twist` and `headNod`.
- `cheer` (once): both arms up to `armRaise`, pumping by `armSwing`, bouncing by `bob`, head back by `headNod`.

Our current presets, for scale: Breathe (idle: cadence 0.45, armSwing 3, bob 0.008, headNod 3, sway 1.5), Walk (above), Run (cadence 1.45, legSwing 50, armSwing 52, armRaise 18, bob 0.045, lean 14, twist 10), Goblin waddle (cadence 0.85, legSwing 24, armSwing 18, armRaise 22, bob 0.03, lean 8, headNod 6, sway 10), Tool swing (armSwing 70, armRaise 110, lean 8, twist 18, duration 0.45, once), Cheer (cadence 2.6, armSwing 25, armRaise 160, bob 0.05, headNod 10, duration 1.5, once).

## What to make (36 presets)

- **Standing** (`idle`, loop): calm breathing, bored goblin (slow sway, head nods off), eager (bouncy, ready to go), tired (slow, heavy nods, little sway), mischievous (quick shifty sway, nods).
- **Walking** (`walk` or `waddle`, loop): proud strut, sneaky tiptoe (small swings, low lean, slow), happy skip (high bob), heavy stomp (big legSwing, low cadence), tired trudge, classic goblin waddle with attitude.
- **Running** (`run`, loop): sprint, panicked flail (big arm swings, upright), cocky jog.
- **Air** (`jump` once, `fall` loop): big jump, little hop, falling flail, falling calm (arms out like a skydiver).
- **Tools** (`swing`, once): hammer smash (big wind-up), paint flick (quick, small), shovel dig (low, leaning), wand tap (tiny, precise), throw (overhead).
- **Greetings** (`wave`, once): friendly wave, big two-arm wave (high armRaise, wide armSwing), shy wave (small, low), salute (short, sharp).
- **Celebrate** (`cheer` or `dance`, once): victory cheer, fist pump, goblin jig, silly dance, smug shimmy (small bob, big twist), crowd-pleaser (long, big).
- **Moods** (any style that fits, once or loop): laugh (cheer with small arm raise and fast bob), sulk (idle: slow, deep nods, no sway), shrug (wave, both shoulders: armRaise 40, short duration).

## What to send back

1. One JSON array of the 36 presets (unique ids).
2. One line per preset on what you were going for.

Double-check before you answer: every field present; `style` one of the ten; every number inside its range; loops have `loop: true`, one-off moves `loop: false` with a `duration`. Invalid presets are thrown away.
