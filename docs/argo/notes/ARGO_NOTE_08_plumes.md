# ARGO\_NOTE\_08 — Operating-Only Pixel Plumes Spec (`BB-10` / `TICKET-03` Glue)

**Author:** Argo (Creative Lead & PM)  
**Target Sidecar:** Haiku (`xHigh`) / Gemini Flash 3.8  
**Scope:** Wire operating-only pixel plumes across all 11 `MachineKind`s (`@hm/plotsim`) using `inspectMachine(world, env, id)` and `machinePlumeColour(kind)` from `apps/web/src/base/machine-inspect.ts`, fixing unscaled sockets and missing vents in `apps/web/src/play/machine-props.ts`.

---

## 1\. Root-Cause Fixes in `apps/web/src/play/machine-props.ts`

1. **Compute `vent` and `power` AFTER applying `machineSize(kind)` scaling:**  
   - In `machineProp(m, kind, stage, genLevel)`, `findMachineVent()` and socket lookups (`at(p.sockets, 'vent' | 'stack' | 'steam')`) previously ran on unscaled meshes, causing plumes on `4.8 m`–`6.0 m` heavy machines to spawn buried inside the scaled geometry.  
   - Apply the `machineSize(kind)` bounding-box scale to `group` first (or scale socket coordinates by `(scaleXZ, scaleY, scaleXZ)` before adding `RING_TOP_Y = 0.78`), then compute `vent` and `power`.  
2. **Expose non-null `vent` vectors on all 11 `MachineKind`s (including `drill` and `pylon`):**  
   - `drill`: Currently returns `vent: null`. Set `vent: at(p.sockets, 'vent', 'exhaust') ?? findMachineVent(p.group, 0, 0, -0.25)` so operating drills kick up `#ff7b3d` slag sparks.  
   - `pylon`: Currently returns `vent: null`. Set `vent: new THREE.Vector3(...p.top)` so loaded pylons emit subtle `#5ce1e6` corona micro-sparks at the insulator top.  
3. **Gate plume emission & mechanical animation strictly on `inspect.plumeOn`:**  
   - Compute `const inspect = inspectMachine(world, env, id);`  
   - Pass `const run = inspect.plumeOn ? inspect.runPct / 100 : 0;` into `prop.animate(t, run)` and the `@hm/plume` emitter rate (`rate = spec.rate * run * cadence(t)`).  
   - Machines in `'idle'`, `'no-power'`, `'no-feed'`, or `'off'` state have `inspect.plumeOn === false` and must emit **zero** particles (`rate = 0`).

---

## 2\. Per-Kind Plume Look Table (`MachinePlumeSpec`)

Export `MACHINE_PLUME_SPECS` and `machinePlumeSpec(kind: MachineKind): MachinePlumeSpec` (in `apps/web/src/base/machine-inspect.ts` or `apps/web/src/play/machine-props.ts`):

export interface MachinePlumeSpec {

  readonly colour: string;

  readonly rate: number;       // particles/sec at 100% runPct

  readonly speed: number;      // initial upward velocity (m/s)

  readonly spread: number;     // cone half-angle (radians)

  readonly pixelSize: number;  // world-space quad size (m)

  readonly gravity: number;    // m/s^2 (negative \= buoyant lift, positive \= ballistic arc)

  readonly lifetime: number;   // particle lifetime (s)

  readonly cadence: 'continuous' | 'ram-fast' | 'ram-heavy' | 'shimmer' | 'chatter' | 'crackle';

}

| `MachineKind` | `colour` | `rate` (`pt/s`) | `speed` (`m/s`) | `spread` (`rad`) | `pixelSize` (`m`) | `gravity` (`m/s²`) | `lifetime` (`s`) | `cadence` | Visual Silhouette (when `plumeOn === true`) |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| `mill` | `#ff3d8a` | `28` | `2.4` | `0.22` | `0.11` | `-0.4` | `1.8` | `'continuous'` | Steady chimney stream of crisp magenta pixel squares spiraling slightly upward |
| `heavy-mill` | `#ff3d8a` | `64` | `3.6` | `0.30` | `0.16` | `-0.6` | `2.4` | `'continuous'` | Dense twin-stack industrial column of magenta pixel flakes with high thermal lift |
| `press` | `#7cff4d` | `32` | `2.8` | `0.48` | `0.12` | `0.2` | `1.4` | `'ram-fast'` | Rhythmic upward-and-lateral chuffs of green vertex facets synced to `sin(t * 3.1)` ram stroke |
| `heavy-press` | `#7cff4d` | `72` | `4.0` | `0.58` | `0.18` | `0.3` | `1.8` | `'ram-heavy'` | Heavy hydraulic shock-puffs of bright green facets synced to `sin(t * 2.0)` heavy ram |
| `projector` | `#ffc13d` | `26` | `3.4` | `0.14` | `0.10` | `-0.8` | `2.2` | `'shimmer'` | Tight, high-buoyancy vertical beacon stream of glowing amber motes from projector head |
| `heavy-projector` | `#ffc13d` | `60` | `4.8` | `0.18` | `0.16` | `-1.1` | `2.8` | `'shimmer'` | Tall searchlight-column plume of radiant amber motes reaching `8 m+` above the `6.0 m` mast |
| `water` | `#3dc8ff` | `34` | `1.9` | `0.52` | `0.14` | `-0.2` | `2.0` | `'continuous'` | Billowing cyan cryo-vapour mist that rises and softly mushroom-expands |
| `heavy-water` | `#3dc8ff` | `78` | `2.9` | `0.65` | `0.20` | `-0.3` | `2.6` | `'continuous'` | Thick atmospheric condensation geyser of cyan-white droplets with wide canopy spread |
| `drill` | `#ff7b3d` | `30` | `3.2` | `0.62` | `0.09` | `4.5` | `0.9` | `'chatter'` | Ballistic rooster-tail of hot orange slag sparks kicking up and arcing down under gravity |
| `power` | `#b46bff` | `36` | `3.5` | `0.25` | `0.12` | `-0.5` | `1.7` | `'continuous'` | Pressurized vertical Synthesis-Violet ion-steam jet from the `steam` socket |
| `pylon` | `#5ce1e6` | `12` | `1.1` | `0.75` | `0.07` | `1.2` | `0.55` | `'crackle'` | Tight cyan corona-discharge micro-sparks crackling at the `top` insulator under load |

---

## 3\. Cadence Multiplier Function

export function plumeCadenceMultiplier(cadence: MachinePlumeSpec\['cadence'\], t: number): number {

  switch (cadence) {

    case 'continuous':

      return 1.0;

    case 'ram-fast':

      return Math.max(0.15, Math.sin(t \* 3.1));

    case 'ram-heavy':

      return Math.max(0.15, Math.sin(t \* 2.0));

    case 'shimmer':

      return 0.85 \+ 0.15 \* Math.sin(t \* 6.0);

    case 'chatter':

      return 0.7 \+ 0.3 \* Math.sin(t \* 18.0);

    case 'crackle':

      return Math.sin(t \* 14.0) \> 0.4 ? 1.0 : 0.0;

  }

}

---

## 4\. Verification Checklist for Sidecar

- [ ] `npm run typecheck` and `npm test` pass with zero errors.  
- [ ] Placed machines in `'idle'`, `'no-power'`, `'no-feed'`, or `'off'` state emit `0` plume particles.  
- [ ] Operating machines (`inspect.plumeOn === true`) emit particles from their scaled `vent` world position using the exact colour, size, spread, and cadence in `MACHINE_PLUME_SPECS`.