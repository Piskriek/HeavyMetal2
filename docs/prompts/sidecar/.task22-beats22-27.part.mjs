const grantAll = (pairs) => page.evaluate((list) => { for (const [item, n] of list) window.__dev.grant(item, n); }, pairs);
const basePos = () => page.evaluate(() => window.__playScene.debug.position());

await beat('22 F-01: a hardpoint from the Structures tab; the fabricator installed on it from the machine picker', async (row) => {
  await quiet();
  await toPlanet();
  // the fabricator's bill and the hardpoint's are grinding: granted (the install and the pay are the game's own)
  await grantAll([['ore', 240], ['prim-beam', 10], ['prim-column', 4], ['prim-chassis', 6], ['map-basalt', 3]]);
  await placeFromStructures('Hardpoint');
  const hp = await page.evaluate(() => window.hmPlay.base.world().base.pieces.find((p) => p.kind === 'hardpoint')?.id ?? null);
  if (hp !== null) await page.evaluate((id) => window.hmPlay.base.openMachinePicker(id), hp);
  const btn = page.locator('[data-testid="install-btn-fabricator"]');
  const visible = await btn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  if (visible) await btn.click();
  await page.waitForTimeout(700);
  const installed = await page.evaluate(() => window.hmPlay.base.world().machines.some((m) => m.kind === 'fabricator'));
  row.shot = await shot('f01-fabricator');
  await page.keyboard.press('Escape').catch(() => {});
  const cur = await chainCur();
  return { ok: hp !== null && visible && installed && cur === 'F-02', detail: `hardpoint=${hp} button=${visible} fabricator installed=${installed} current=${cur}` };
});

await beat('23 F-02: the scout printed at the fabricator (the print runs its full 120 s as one tick), 200 m driven', async (row) => {
  const fab = await page.evaluate(() => window.hmPlay.base.world().machines.find((m) => m.kind === 'fabricator')?.id ?? null);
  await page.evaluate((id) => {
    window.hmPlay.base.apply({ t: 'craft', at: window.__playScene.debug.position(), machine: id, recipe: 'vehicle-scout' });
    window.hmPlay.base.apply({ t: 'tick', at: window.__playScene.debug.position(), dt: 130, beam: null, power: { [id]: 1 } });
  }, fab);
  const scouts = await page.evaluate(() => window.hmPlay.base.world().vehicles.filter((v) => v.kind === 'scout').length);
  // the drive itself is grinding (200 m at the rover's speed): the metres are counted by the drive; the scout is parked as printed
  await page.evaluate(() => window.hmPlay.grindCount('driven:m', 200));
  const cur = await chainCur();
  row.shot = await shot('f02-scout');
  return { ok: scouts >= 1 && cur === 'F-03', detail: `scouts=${scouts} current=${cur}` };
});

await beat('24 F-03: a weapon bench; the frame and parts forged, a barrel swapped, the gun equipped to the sidearm', async (row) => {
  await grantAll([['ore', 120], ['prim-chassis', 2], ['prim-beam', 2], ['prim-cube', 2], ['prim-column', 2]]);
  await placeFromStructures('Weapon bench');
  const at = await basePos();
  const idxOf = (item) => page.evaluate((it) => window.hmPlay.base.world().player.slots.findIndex((s) => s && s.item === it), item);
  await page.evaluate((p) => {
    const api = window.hmPlay.base;
    api.apply({ t: 'forge', at: p, item: 'wpn-frame' });
    api.apply({ t: 'forge', at: p, item: 'core-semi' });
    api.apply({ t: 'forge', at: p, item: 'barrel-short' });
    api.apply({ t: 'forge', at: p, item: 'barrel-scatter' });
  }, at);
  const frame = await idxOf('wpn-frame');
  await page.evaluate(({ frame, p }) => {
    window.hmPlay.base.apply({ t: 'move', at: p, from: { at: 'inventory', index: frame }, to: { at: 'equipment', slot: 'sidearm' }, n: 1 });
    window.hmPlay.base.apply({ t: 'fit', slot: 'core', item: 'core-semi' });
    window.hmPlay.base.apply({ t: 'fit', slot: 'barrel', item: 'barrel-short' });
    window.hmPlay.base.apply({ t: 'fit', slot: 'barrel', item: 'barrel-scatter' });
  }, { frame, p: at });
  const equipped = await page.evaluate(() => !!window.hmPlay.base.world().equipment.sidearm);
  const monsters = await page.evaluate(() => window.hmPlay.chainState().monstersUnlocked);
  row.shot = await shot('f03-gun');
  const cur = await chainCur();
  return { ok: equipped && cur === 'F-04' && monsters === true, detail: `sidearm=${equipped} current=${cur} monsters unlocked=${monsters}` };
});

await beat('25 F-04 and F-05: stages 2 to 6 (the plot stage is grinding, skipped) unlock the hauler and the crawler', async (row) => {
  const seen = [];
  for (const st of [3, 4, 5, 6]) {
    await page.evaluate((s) => window.__dev.setStage(s), st);
    await page.waitForTimeout(400);
    seen.push(`${st}:${await chainCur()}`);
  }
  row.shot = await shot('stage6-chain-done');
  const cur = await chainCur();
  return { ok: cur === null, detail: `stages ${seen.join(' ')} chain current=${cur}` };
});

await beat('26 a death respawns at the gate; the inventory and the chain are kept (the death source is TASK-23b)', async (row) => {
  await toPlanet();
  const slotsBefore = await slotsJson();
  const chainBefore = JSON.stringify(await chainState());
  await page.evaluate(() => window.hmPlay.die());
  await page.waitForTimeout(800);
  const deaths = (await chainState()).counts.deaths ?? 0;
  const at = await basePos();
  const gate = await page.evaluate(() => window.__playScene.debug.gatePlanet());
  const nearGate = Math.hypot(at.x - gate.x, at.z - gate.z) < 10;
  const kept = (await slotsJson()) === slotsBefore;
  const chainKept = JSON.stringify(await chainState()).replace(/"deaths":\d+/, '') === chainBefore.replace(/"deaths":\d+/, '');
  row.shot = await shot('respawn-at-gate');
  return { ok: deaths === 1 && nearGate && kept && chainKept, detail: `deaths=${deaths} near gate=${nearGate} inventory kept=${kept} chain kept=${chainKept}` };
});

await beat('27 each chain narration line played once; the radio log holds no repeats', async (row) => {
  const want = ['A4-01', 'A4-02', 'A4-03', 'B-01', 'B-04', 'B-06', 'B-05', 'B-07', 'F-01', 'F-02', 'F-03', 'F-04', 'F-05', 'S-2', 'S-3', 'S-4', 'S-5', 'S-6'];
  let heard = [];
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    heard = await page.evaluate(() => window.hmPlay.heard());
    if (want.every((id) => heard.includes(id))) break;
    await page.waitForTimeout(1000);
  }
  const missing = want.filter((id) => !heard.includes(id));
  const repeats = heard.length - new Set(heard).size;
  row.shot = await shot('radio-log');
  return { ok: missing.length === 0 && repeats === 0, detail: `missing=${missing.join(',') || 'none'} repeats=${repeats}` };
});

