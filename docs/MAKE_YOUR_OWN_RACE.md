# Make your own race

The Goblin Ball Racers game is the **example**, not the point. Everything in it is a preset you can open, change, fork, drive with a
randomizer or share. This page shows how a race is put together and how to make your own kind.

## What a race is made of

A map is one **scene** preset. Everything else hangs off it in named slots:

| Slot | Preset kind | What it controls | Where to edit it |
| --- | --- | --- | --- |
| `terrain` | `terrain` | the island: heights and painted surfaces | Brush, Shape tools |
| `track` (a reference) | `track` | the racing line and its width | Track tool |
| `decor` | `decor` | palms, bushes, rocks | Dress tool |
| `entities` | `entity` | props: cones, barrels, flags | Place tool |
| `rules` | `race` | laps, racers, AI skill, items, boost pads, rumble strips, start line, walls | **Rules** button |
| `sounds` | `sound`, `engine-sound`, `music` | every sound, the engine hum, the music | **Sounds** button |
| `modulators` | `modulator` | drivers that move any variable by themselves | "Drive a setting..." on any selected thing |
| `mechanics` | `mechanic` | small scripts that run every tick | Pro tier |

The look (sky, sun, fog) and time of day are variables on the scene itself. Nothing is hard-coded: if a number changes how the
game feels, it is a variable with a range, a unit and a description.

## Make a race in five minutes

1. Open the Map Maker (`#edit`, or **Map Maker** on the title screen).
2. Shape the island, draw a track, press **Carve into terrain**, then **Dress**.
3. Press **Rules**, then **Customise the race**. Try *Laps 1*, *Racers 4*, *Boost pads 6*, *AI skill 1.4* for a short ruthless sprint.
4. Select a prop, press **Drive a setting...**, pick *Heartbeat* for its size, press **Preview**.
5. Press **Sounds**, edit *Boost*, press **Roll a new one** until it sounds right.
6. Press **Test drive**. The map saves itself; **Share** gives you one line of text to send to a friend.

## The same thing from code

Presets are plain data and every edit is an undoable command, so a race can be built by a script as easily as by hand:

```ts
import { cmd } from '@hm/contracts';
import { createRuntime } from '@hm/engine';

const rt = createRuntime();
const rules = rt.store.put({ kind: 'race', name: 'Sprint', params: { laps: 1, field: 4, boostPads: 6 } });
const scene = rt.store.put({ kind: 'scene', name: 'My race', params: { look: 'sunset-blaze' }, children: { rules: [{ ref: rules.id }] } });
rt.loadScene(scene.id);

rt.commands.execute(cmd.setParam(`${rules.id}.aiSkill`, 1.3, 'Tougher rivals')); // undoable
rt.vars.read(`${rules.id}.laps`);                                               // every variable has a path
```

In the browser console the live runtime is `hm`, and the running race is `hmGame`.

## Drive anything

A **modulator** preset moves a variable on its own while the game runs. It names a target path (`<presetId>.<setting>`,
`entity:<id>/<component>.<field>` or `global:<name>`) and a shape: random, noise, LFO, curve, timeline, step sequence, another
variable, a texture, an expression, or a combination. Time comes from the simulation tick, so a replay moves exactly the same.

```ts
rt.store.put({ id: 'wobble', kind: 'modulator', name: 'Wobble', params: {
  target: `${rules.id}.aiSkill`, mode: 'replace',
  def: JSON.stringify({ kind: 'lfo', wave: 'sine', freqHz: 0.1, out: { min: 0.6, max: 1.4 } }),
} });
rt.commands.execute(cmd.addChild(scene.id, 'modulators', 'wobble'));
```

## Make your own kind of preset

A kind is a schema: its variables, their types, ranges, units and docs. The inspector, search, docs and the Drive panel are all
generated from it.

```ts
import { defineSchema } from '@hm/contracts';

rt.schemas.register(defineSchema({
  kind: 'weather', version: 1, label: 'Weather', doc: 'Rain and wind over the island.', icon: 'cloud',
  variables: [
    { key: 'rain', type: 'number', label: 'Rain', doc: '0 = dry, 1 = downpour.', tier: 'play', default: 0, min: 0, max: 1, step: 0.05 },
  ],
  slots: [],
}));
```

Then read it from a mechanic (a small TypeScript script on a `mechanic` preset, run every tick in a sandbox):

```ts
export function update(ctx: ScriptContext): void {
  const rain = Number(ctx.vars.read('weather-1.rain'));
  for (const id of ctx.world.query('velocity')) {
    const v = ctx.world.get(id, 'velocity');
    if (v) ctx.set(id, 'velocity', { vx: Number(v['vx']) * (1 - 0.01 * rain) });  // wet road, slower balls
  }
}
```

## Make it a different game

The goblin race is built from the same pieces any game uses: a scene, entities with physics, mechanics, an input frame, and
presets for look and sound. To make something else (a marble maze, a derby, a golf course), start a new scene, place entities,
write one mechanic for the rules, and reuse the tools, sounds, drivers and screens as they are. The racing-specific parts
(`@hm/racing`, `@hm/racers`, `@hm/trackgen`, `@hm/goblins`) sit beside the engine, not inside it.
