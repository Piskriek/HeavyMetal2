// Runs the RUN.world asset batch in docs/runworld/assets.json, one call at a time, resumable.
//   node scripts/runworld-assets.mjs images [id ...]      clean source image per asset (about 120 credits each)
//   node scripts/runworld-assets.mjs models [id ...]      Hunyuan image-to-3D for every APPROVED image (about 1,013 each)
//   node scripts/runworld-assets.mjs views [id ...]       a 2 x 2 turnaround sheet per approved asset, cropped into
//                                                          views/{front,left,back,right}.png (the multi-view input)
//   node scripts/runworld-assets.mjs status
// Outputs go to zips/runworld/assets/<id>/ (git-ignored): source.png (+ .json with its URL), model.glb.
// An image is approved by creating zips/runworld/assets/<id>/approved (after reviewing source.png).
// Before every billed call it reads the balance and stops when the call would take it under the floor
// (RUNWORLD_FLOOR, default 16000: the narrator's voice reserve stays on this account). Rate limits are retried with
// the server's backoff; QUOTA_EXCEEDED or a policy denial stops the run. Every call is logged to log.jsonl.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RUNDOT = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Rundot', 'rundot.exe');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'zips', 'runworld', 'assets');
const PANELS = path.join(ROOT, 'docs', 'concept', 'setmix', 'panels');
const FLOOR = Number(process.env.RUNWORLD_FLOOR ?? 16000);
const COST = { image: 130, model: 1100 };
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'assets.json'), 'utf8'));
const [cmd, ...only] = process.argv.slice(2);
const pick = (a) => only.length === 0 || only.includes(a.id);

const VIEW = {
  'three-quarter': 'Three-quarter front view from slightly above',
  front: 'Straight-on front view',
  side: 'Straight side view',
  wheel: 'Side view of the wheel, turned a little so the tread and the hub both show',
  part: 'Straight side view, the part lying horizontal',
};
const prompt = (a) => [
  `Product reference render of ${a.subject}, from the reference image.`,
  'The object alone: no person, no ground, no grass, no pad, no walls, no other objects.',
  `${VIEW[a.view] ?? VIEW['three-quarter']}, centred, the whole object in frame with a margin, plain pure white background, soft even studio lighting, no cast shadow, crisp detail.`,
  'Clean painted steel and ceramic with light honest wear, in the same colours as the reference.',
  'Every part is physically attached to the rest: nothing floats, no gaps between parts.',
  // owner: "poly reduce doesnt really work on thin/tube stuff, pieces just turn to artifacts"
  'Chunky, solid game-asset proportions: NO thin wires, NO thin tubes, NO thin rods, NO thin spokes, NO dangling cables; every member is at least 8 cm thick, and cables are thick and run tight against the body.',
  // owner: "the models can have tubing but inset into something solid, cover some things with armor if they wont read well"
  'Any tubing, piping, suspension, axles or undercarriage is set into solid bodies or covered by armour plates, skirts and a solid belly pan; nothing spindly is left exposed.',
  // owner 2026-10-11: "lets opt for square tubing or lights etc where we can" (a box section keeps its shape when
  // reduced; a round one needs many sides or goes lumpy, as the round headlight did at 150 triangles)
  'Square and rectangular box sections wherever the design allows: square tubing, rails, bars and frames, and square or rectangular lights, lamp housings, gauges and housings; round only where the part must be round to work (wheels, tyres, a steering wheel rim, a gun barrel).',
  'NO lettering, NO numbers, NO logos, NO labels on any surface.',
].join(' ');

// the 2 x 2 turnaround sheet (cells: front, left / back, right), for the multi-view shape stage
const SIDES = ['front', 'left', 'back', 'right'];
const turnaround = (a) => [
  `Turnaround reference sheet of ${a.subject}: exactly the object in the reference image, the same design, colours and details.`,
  'Four views of the same object in a 2 by 2 grid of four equal square cells on plain pure white, with wide white space between the cells and nothing crossing from one cell into another:',
  "top-left the straight front view, top-right the straight left side view (the camera on the object's own left), bottom-left the straight back view (the side opposite the front, which looks different from the front), bottom-right the straight right side view.",
  'Every view at eye level: the camera at the height of the middle of the object, looking horizontally, never from above, so the top surface is not seen.',
  'Orthographic, the same scale and the same height in every cell, each view centred in its cell with a margin; soft even studio lighting, no cast shadows, no ground, no text, no labels, no numbers, no grid lines, no borders, no dividing lines.',
].join(' ');

/**
 * Crops the sheet's four cells (inset 3%, past any divider lines the image model drew anyway), trims the white
 * around each view, and pads it square on white with a margin. A left-right symmetric part (`symmetric: true`)
 * takes its right view as the mirror of its left: the image model tends to repeat the left view there.
 */
async function cropViews(sheet, dir, symmetric = false) {
  const sharp = (await import('sharp')).default;
  const { width: w = 0, height: h = 0 } = await sharp(sheet).metadata();
  fs.mkdirSync(dir, { recursive: true });
  const cw = Math.floor(w / 2), ch = Math.floor(h / 2), m = Math.round(0.03 * cw), iw = cw - 2 * m, ih = ch - 2 * m;
  for (const [i, side] of SIDES.entries()) {
    if (symmetric && side === 'right') {
      await sharp(path.join(dir, 'left.png')).flop().png().toFile(path.join(dir, 'right.png'));
      console.log('  right: the left view, mirrored');
      continue;
    }
    const cell = await sharp(sheet).extract({ left: (i % 2) * cw + m, top: Math.floor(i / 2) * ch + m, width: cw - 2 * m, height: ch - 2 * m }).png().toBuffer();
    const { data, info } = await sharp(cell).trim({ background: '#ffffff', threshold: 24 }).png().toBuffer({ resolveWithObject: true });
    const l = -(info.trimOffsetLeft ?? 0), t = -(info.trimOffsetTop ?? 0);
    const touches = l <= 1 || t <= 1 || l + info.width >= iw - 1 || t + info.height >= ih - 1;
    const side2 = Math.round(Math.max(info.width, info.height) * 1.15);
    await sharp(data).extend({
      top: Math.floor((side2 - info.height) / 2), bottom: Math.ceil((side2 - info.height) / 2),
      left: Math.floor((side2 - info.width) / 2), right: Math.ceil((side2 - info.width) / 2),
      background: '#ffffff',
    }).flatten({ background: '#ffffff' }).png().toFile(path.join(dir, `${side}.png`));
    console.log(`  ${side}: ${info.width} x ${info.height} px${touches ? ' (touches the cell edge: check the sheet)' : ''}`);
  }
}

function rundot(args) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = spawnSync(RUNDOT, args, { encoding: 'utf8', env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' }, timeout: 15 * 60 * 1000 });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const wait = /retry in (\d+)/i.exec(out);
    if (r.status !== 0 && wait) { const s = Number(wait[1]) + 3; console.log(`  rate limited, waiting ${s} s`); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000); continue; }
    return { ok: r.status === 0, out };
  }
  return { ok: false, out: 'gave up after repeated rate limits' };
}
function balance() {
  const r = rundot(['credits', '--period', 'today']);
  const m = /Balance:\s*([\d,\s]+)\s*credits/.exec(r.out);
  return m ? Number(m[1].replace(/[^\d]/g, '')) : NaN;
}
const log = (e) => fs.appendFileSync(path.join(OUT, 'log.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...e })}\n`);
function guard(cost, id) {
  const b = balance();
  if (!Number.isFinite(b)) { console.log('could not read the balance; stopping'); process.exit(3); }
  if (b - cost < FLOOR) { console.log(`STOP before ${id}: balance ${b} would go under the floor ${FLOOR}. Switch RUN.world accounts (rundot login), then rerun.`); process.exit(4); }
  return b;
}
function fatal(out) { return /QUOTA_EXCEEDED|AI_POLICY_DENIED|CREDITS_EXHAUSTED/i.test(out); }

fs.mkdirSync(OUT, { recursive: true });
if (cmd === 'status') {
  for (const a of manifest.assets) {
    const d = path.join(OUT, a.id), has = (f) => fs.existsSync(path.join(d, f));
    console.log(`${a.id.padEnd(18)} image ${has('source.png') ? 'yes' : '-  '}  approved ${has('approved') ? 'yes' : '-  '}  model ${has('model.glb') ? 'yes' : '-'}`);
  }
  console.log(`balance ${balance()}, floor ${FLOOR}`);
} else if (cmd === 'images') {
  for (const a of manifest.assets.filter(pick)) {
    const d = path.join(OUT, a.id), png = path.join(d, 'source.png');
    if (fs.existsSync(png)) continue;
    fs.mkdirSync(d, { recursive: true });
    const before = guard(COST.image, a.id);
    console.log(`image ${a.id} (balance ${before})`);
    // a part of a modular set can take an approved sibling's image as its reference (`ref: "asset:<id>"`), so the
    // set matches itself and a concept panel's other parts (the scout's tube cage) do not leak in
    const ref = a.ref?.startsWith('asset:') ? path.join(OUT, a.ref.slice(6), 'source.png') : path.join(PANELS, a.panel);
    const r = rundot(['generate', 'image', '--prompt', prompt(a), '--reference-image', ref, '--aspect-ratio', '1:1', '--out', png, '--json']);
    log({ id: a.id, step: 'image', ok: r.ok && fs.existsSync(png), before, tail: r.out.slice(-300) });
    if (!r.ok) { console.log(`  failed: ${r.out.slice(-300)}`); if (fatal(r.out)) process.exit(5); }
  }
} else if (cmd === 'views') {
  // The multi-view input for the local pipeline's Hunyuan3D-2mv shape stage (owner 2026-10-11: "give the 3d agent
  // more angles to work from"). One turnaround sheet per approved asset, its own source.png as the reference (one
  // image keeps the four views consistent with each other, where four calls drift), cropped into views/<side>.png.
  for (const a of manifest.assets.filter(pick)) {
    const d = path.join(OUT, a.id), sheet = path.join(d, 'views.png');
    if (!fs.existsSync(path.join(d, 'approved'))) continue;
    if (!fs.existsSync(sheet)) {
      const before = guard(COST.image, a.id);
      console.log(`views ${a.id} (balance ${before})`);
      const r = rundot(['generate', 'image', '--prompt', turnaround(a), '--reference-image', path.join(d, 'source.png'), '--aspect-ratio', '1:1', '--out', sheet, '--json']);
      log({ id: a.id, step: 'views', ok: r.ok && fs.existsSync(sheet), before, tail: r.out.slice(-300) });
      if (!r.ok) { console.log(`  failed: ${r.out.slice(-300)}`); if (fatal(r.out)) process.exit(5); continue; }
    }
    await cropViews(sheet, path.join(d, 'views'), a.symmetric === true);
  }
} else if (cmd === 'models') {
  // a provider that runs past the CLI's 600 s timeout still bills the call and the result is lost: stop after two
  // timeouts in a row rather than bleed credits (2026-10-10: Hunyuan slowed past 10 min, three calls lost)
  let timeouts = 0;
  for (const a of manifest.assets.filter(pick)) {
    const d = path.join(OUT, a.id), glb = path.join(d, 'model.glb'), meta = path.join(d, 'source.png.json');
    if (fs.existsSync(glb) || !fs.existsSync(path.join(d, 'approved')) || !fs.existsSync(meta)) continue;
    const url = JSON.parse(fs.readFileSync(meta, 'utf8')).imageUrl;
    const before = guard(COST.model, a.id);
    console.log(`model ${a.id} (balance ${before})`);
    const r = rundot(['game', 'generate-3d', '--image-url', url, '--provider', 'hunyuan3d-v3.1-pro', '--quality', 'standard', '--seed', '7', '--out', glb]);
    const modelUrl = /Model URL:\s*(https:\S+)/.exec(r.out.replace(/\r?\n/g, ''))?.[1] ?? null;
    if (modelUrl) fs.writeFileSync(path.join(d, 'model.json'), JSON.stringify({ modelUrl, imageUrl: url }, null, 2));
    log({ id: a.id, step: 'model', ok: r.ok && fs.existsSync(glb), before, modelUrl, tail: r.out.slice(-300) });
    if (!r.ok) { console.log(`  failed: ${r.out.slice(-300)}`); if (fatal(r.out)) process.exit(5); }
    timeouts = /TaskCanceledException|Timeout/i.test(r.out) ? timeouts + 1 : 0;
    if (timeouts >= 2) { console.log('STOP: two 3D timeouts in a row; the provider is slow. Retry later.'); process.exit(6); }
  }
} else {
  console.log('usage: node scripts/runworld-assets.mjs images|models|status [id ...]');
  process.exit(2);
}
