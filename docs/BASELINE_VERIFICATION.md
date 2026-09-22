# T00 — Baseline Verification Log

> Historical document recovered from the earlier workspace export. It is not
> current verification. See [T02_RECOVERY.md](T02_RECOVERY.md) for this recovery,
> missing snapshot payloads, test results, and outstanding limitations.

Every command below was executed in this checkout on 2026-09-22 (Node v22.22.3, npm
10.9.8, Linux sandbox) after `npm ci`. Raw logs were kept during the run; the summaries
and exit codes are quoted verbatim.

**Regression scope of this branch:** `git diff --name-only 08ebf4d 94dc206` lists only
`package.json`, `scripts/check.mjs`, `scripts/protect-baseline.mjs` and
`tests/protect-baseline.test.ts`. No `src/**` or `public/**` byte changed, so every
failure below is either pre-existing content drift or an environment limitation — none is
a regression from this ticket.

---

## 1. Install

| Command | Exit | Result |
| :--- | ---: | :--- |
| `npm ci --no-audit --no-fund` | 0 | `added 131 packages in 7s` |

## 2. Type check + unit suites

| Command | Exit | Result |
| :--- | ---: | :--- |
| `npm run check` | 0 | `tsc --noEmit` clean; **78 tests, 78 pass, 0 fail, 0 skipped** (1.95 s); TAP written to `tests/artifacts/latest-test-run.tap` |

Suites executed by `scripts/check.mjs`: `session-save`, `camera-decal`,
`ticket05-backdrop`, `multi-select-grouping`, `track-props-backup` and the new
`protect-baseline` (20 of the 78 tests). `tests/protect-baseline.test.ts` alone:
`# tests 20 / # pass 20 / # fail 0`.

## 3. Production build

| Command | Exit | Result |
| :--- | ---: | :--- |
| `npm run build` | 0 | 2,345 modules transformed in 5.95 s; `dist/index.html 1,444.64 kB │ gzip: 397.96 kB` |

## 4. Discovered verification scripts

| Command | Exit | Result |
| :--- | ---: | :--- |
| `node scripts/check-edge-magenta.mjs` | **1** | `PNG audit: 397 files (259 runtime, 113 source sheets, 25 legacy)`; **13 runtime sprites flagged** for "stale colour in transparent fringe". Report: `tests/artifacts/edge-magenta-report.json` (174,410 bytes) |
| `node scripts/generate-stylized-track-textures.mjs --check` | **1** | `Texture generation failed: public/textures/grass-fringe.png: expected 1024×256, got 512×256` |

The 13 flagged sprites (all `holes=0 spill=0 tb=0`, i.e. only the fringe check fails):
`decal-blizzard-dirt-patch` (8,690 px), `decal-blizzard-gravel-earth` (9,155),
`decal-blizzard-rock-crag` (35,975), `decal-blizzard-stone-slab` (14,127), `decal-cracks`
(35,975), `decal-hazard-stripes` (9,719), `decal-oil-spill` (8,690),
`decal-panel-reinforced-wood` (26,976), `decal-panel-scrap-steel` (9,719),
`decal-panel-wood-planks` (9,826), `decal-pothole` (9,155), `decal-tire-skid` (9,826),
`grass-fringe` (4).

## 5. Browser suites (real headless Chromium over the built `dist/`)

| Command | Exit | Result |
| :--- | ---: | :--- |
| `node tests/ui-frame-check.mjs` | 0 | **24 ok, 0 not ok** (frames at 3840×2160, 578×760, …) |
| `node tests/ticket05-visual.mjs` | 0 | **29 ok, 0 not ok** — menu backdrops, ambient engine, reduced motion, vault round-result |
| `node tests/browser-recovery.mjs` | **1** | `page.waitForFunction: Timeout 20000ms exceeded` at `tests/browser-recovery.mjs:123` (waiting for `.game-stage.status-ready` after Enter the Cup) |
| `node tests/art-check.mjs` | **1** | `page.waitForFunction: Timeout 30000ms exceeded` at `tests/art-check.mjs:175` (after the loadout/course screenshots were captured) |
| `node tests/ticket02-visual.mjs` | **1** | 4 ok, then `not ok - escape closes the drawer`, then a 20 s `waitForFunction` crash |
| `node tests/ticket07-visual.mjs` | **1** | `not ok - script completed :: TimeoutError: page.waitForFunction: Timeout 20000ms exceeded` |

### 5.1 Root cause of the race-suite timeouts: no WebGL in this sandbox

The bundled `@sparticuz/chromium` headless shell cannot create a GL context here, and the
race screen requires one (`new THREE.WebGLRenderer` at `src/game/renderer-3d.ts:1657`).
Measured directly, not inferred:

```js
canvas.getContext('webgl2') || canvas.getContext('webgl')  // → null
```

Reproduce with `node scripts/probe-webgl.mjs` (exits 1 when no configuration has WebGL):

| Probe configuration | WebGL |
| :--- | :--- |
| Repo launch args + `--disable-gpu` (the suites' configuration) | no |
| Repo launch args + `--disable-gpu` + SwiftShader libs extracted | no |
| Repo launch args + SwiftShader libs, no `--disable-gpu` | no |
| ↑ + `--use-gl=angle --use-angle=swiftshader` | no |
| ↑ + `--use-gl=swiftshader --enable-unsafe-swiftshader` | no |
| ↑ + `--use-angle=vulkan --use-vulkan=swiftshader --enable-features=Vulkan` | no |
| ↑ + `--headless=new` | no |

Seven launch configurations, zero contexts. The main menu does render (`BODY_TEXT` shows
New Game / 3D Map Editor / Settings / How to Play / Hall of Chaos; screenshot `tests/artifacts/diagnose-home.png`, captured by a throw-away diagnostic script
that was not kept), which is consistent with "everything before the 3D stage works,
everything that enters a race cannot".

**Classification:** the four failing suites are *environment-blocked*, not regressions.
They cannot be used as baseline evidence in this sandbox; they must be re-run where WebGL
is available (the ticket's T12 acceptance keeps "Protected bytes verified unchanged against
a real baseline" blocked for the same reason). `ticket02`'s `escape closes the drawer`
failure is recorded as an observed pre-existing content/UI failure; it appears before the
suite reaches the race.

## 6. Deliberately not executed

- `npm run fix:edges`, `art:textures`, `balance:art`, `seamless:sky` — these rewrite art
  (`public/**`, `src/game/art-manifest.json`). T00 must not change bytes it is meant to
  protect.
- The 13 Windows-only scripts listed in `BASELINE_INVENTORY.md` §1.2 (hard-coded `msedge.exe`).

## 7. What this does and does not prove

- Proven here: the toolchain installs, type checks, the 78 unit tests pass, the
  production build succeeds, two browser suites pass in full, and the race-side browser
  suites and two art checks fail for reasons documented above.
- Not proven here: frame pacing, gameplay balance, touch ergonomics, accessibility
  conformance, and any claim about the user's real authored decoration bytes (§3 of
  `BASELINE_INVENTORY.md`).
