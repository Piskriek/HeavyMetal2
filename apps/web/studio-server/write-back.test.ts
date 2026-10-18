import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BodyTooLarge, MAX_BODY, handleStudioRequest, type Request, type StudioPaths } from './write-back';

const IDS = { 'scout-body': {}, 'hauler-body': {} };

function setup(): { paths: StudioPaths; dir: string; file: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-wb-'));
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(dataDir);
  const registryFile = path.join(dir, 'registry.json');
  fs.writeFileSync(registryFile, JSON.stringify(IDS));
  const audioLevelsFile = path.join(dir, 'levels.json');
  fs.writeFileSync(audioLevelsFile, JSON.stringify({ about: 'audio levels', levels: {} }));
  const manifestFile = path.join(dir, 'assets.json');
  fs.writeFileSync(manifestFile, JSON.stringify({ assets: [{ id: 'scout-body', file: 'scout.glb' }, { id: 'hauler-body', file: 'hauler.glb' }] }));
  return {
    paths: { dataDir, registryFile, audioLevelsFile, manifestFile },
    dir,
    file: path.join(dataDir, 'asset-tweaks.json'),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function req(over: Partial<Request> & { body?: string } = {}): Request {
  const body = over.body ?? '{}';
  return {
    method: 'POST',
    path: '/__studio/data/asset-tweaks',
    host: 'localhost:5173',
    origin: undefined,
    contentType: 'application/json',
    readBody: async () => body,
    ...over,
  };
}

test('GET of a file that does not exist yet is an empty object', async () => {
  const s = setup();
  try {
    const r = await handleStudioRequest(req({ method: 'GET', readBody: async () => '' }), s.paths);
    assert.equal(r?.status, 200);
    assert.equal(r?.body, '{}');
  } finally { s.cleanup(); }
});

test('POST writes the canonical file and GET reads it back', async () => {
  const s = setup();
  try {
    const body = JSON.stringify({ 'scout-body': { offset: [0.1, 0, -0.2], tint: '#ff8800', metalness: 0.4 } });
    const r = await handleStudioRequest(req({ body }), s.paths);
    assert.equal(r?.status, 200, r?.body);
    const text = fs.readFileSync(s.file, 'utf8');
    assert.equal(text, `${JSON.stringify(JSON.parse(body), null, 2)}\n`);
    const back = await handleStudioRequest(req({ method: 'GET', readBody: async () => '' }), s.paths);
    assert.deepEqual(JSON.parse(back?.body ?? 'null'), JSON.parse(body));
    assert.deepEqual(fs.readdirSync(s.paths.dataDir), ['asset-tweaks.json'], 'no temp file is left behind');
  } finally { s.cleanup(); }
});

test('neutral values are left out of the file', async () => {
  const s = setup();
  try {
    const body = JSON.stringify({ 'scout-body': { offset: [0, 0, 0], scale: 1, yaw: 0, tint: '', metalness: -1, emissiveIntensity: 0 }, 'hauler-body': { yaw: 90 } });
    const r = await handleStudioRequest(req({ body }), s.paths);
    assert.equal(r?.status, 200, r?.body);
    assert.deepEqual(JSON.parse(fs.readFileSync(s.file, 'utf8')), { 'hauler-body': { yaw: 90 } });
  } finally { s.cleanup(); }
});

test('names outside the allowlist never reach the disk', async () => {
  const s = setup();
  try {
    for (const name of ['other', '..', '..%2fasset-tweaks', 'ASSET-TWEAKS', 'asset-tweaks.json', 'asset_tweaks', '%2e%2e']) {
      const r = await handleStudioRequest(req({ path: `/__studio/data/${name}` }), s.paths);
      assert.equal(r?.status, 404, `name ${name}`);
    }
    assert.equal(fs.existsSync(s.file), false);
    // a path that is not the Studio's is not ours to answer
    assert.equal(await handleStudioRequest(req({ path: '/elsewhere' }), s.paths), null);
  } finally { s.cleanup(); }
});

test('requests must come from localhost', async () => {
  const s = setup();
  try {
    const body = '{}';
    assert.equal((await handleStudioRequest(req({ host: 'evil.example' , body }), s.paths))?.status, 403);
    assert.equal((await handleStudioRequest(req({ origin: 'https://evil.example', body }), s.paths))?.status, 403);
    assert.equal((await handleStudioRequest(req({ origin: 'http://localhost:5173', body }), s.paths))?.status, 200);
  } finally { s.cleanup(); }
});

test('a POST must be JSON, valid, and within the schema', async () => {
  const s = setup();
  try {
    assert.equal((await handleStudioRequest(req({ contentType: 'text/plain' }), s.paths))?.status, 415);
    assert.equal((await handleStudioRequest(req({ body: '{not json' }), s.paths))?.status, 422);
    assert.equal((await handleStudioRequest(req({ body: '[]' }), s.paths))?.status, 422);
    assert.equal((await handleStudioRequest(req({ body: '{"ghost-asset":{"yaw":1}}' }), s.paths))?.status, 422);
    assert.equal((await handleStudioRequest(req({ body: '{"scout-body":{"shell":1}}' }), s.paths))?.status, 422);
    assert.equal((await handleStudioRequest(req({ body: '{"scout-body":{"yaw":500}}' }), s.paths))?.status, 422);
    assert.equal((await handleStudioRequest(req({ body: '{"scout-body":{"tint":"red"}}' }), s.paths))?.status, 422);
    assert.equal((await handleStudioRequest(req({ body: '{"Scout-Body":{"yaw":1}}' }), s.paths))?.status, 422);
    assert.equal(fs.existsSync(s.file), false, 'nothing is written for a refused body');
  } finally { s.cleanup(); }
});

test('a body over 2 MB is refused with 413', async () => {
  const s = setup();
  try {
    const r = await handleStudioRequest(req({ readBody: async () => { throw new BodyTooLarge('too large'); } }), s.paths);
    assert.equal(r?.status, 413);
    assert.ok(MAX_BODY === 2 * 1024 * 1024);
    assert.equal(fs.existsSync(s.file), false);
  } finally { s.cleanup(); }
});

test('scene-layouts write-back: GET empty, POST valid layouts, read back, and reject invalid', async () => {
  const s = setup();
  const layoutsFile = path.join(s.paths.dataDir, 'scene-layouts.json');
  try {
    // GET of missing file returns 200 with '{}'
    const getEmpty = await handleStudioRequest(req({ method: 'GET', path: '/__studio/data/scene-layouts', readBody: async () => '' }), s.paths);
    assert.equal(getEmpty?.status, 200);
    assert.equal(getEmpty?.body, '{}');

    // POST valid scene layout
    const validDoc = {
      'Outpost Alpha': {
        name: 'Outpost Alpha',
        items: [
          { id: 'scout-1', assetId: 'scout-body', t: { offset: [1.2345, 0, -2.5], yaw: 45, scale: 1 } },
        ],
      },
    };
    const postRes = await handleStudioRequest(
      req({ path: '/__studio/data/scene-layouts', body: JSON.stringify(validDoc) }),
      s.paths
    );
    assert.equal(postRes?.status, 200);
    assert.ok(fs.existsSync(layoutsFile));

    // GET reads it back
    const getBack = await handleStudioRequest(req({ method: 'GET', path: '/__studio/data/scene-layouts', readBody: async () => '' }), s.paths);
    assert.equal(getBack?.status, 200);
    const readBack = JSON.parse(String(getBack?.body));
    assert.equal(readBack['Outpost Alpha']?.name, 'Outpost Alpha');
    assert.equal(readBack['Outpost Alpha']?.items[0]?.id, 'scout-1');
    assert.deepEqual(readBack['Outpost Alpha']?.items[0]?.t?.offset, [1.235, 0, -2.5]);

    // Rejects unknown asset
    const badAsset = await handleStudioRequest(
      req({
        path: '/__studio/data/scene-layouts',
        body: JSON.stringify({
          'Bad': { name: 'Bad', items: [{ id: 'x', assetId: 'ghost-asset', t: { offset: [0, 0, 0], yaw: 0, scale: 1 } }] },
        }),
      }),
      s.paths
    );
    assert.equal(badAsset?.status, 422);

    // Rejects duplicate item id
    const dupItem = await handleStudioRequest(
      req({
        path: '/__studio/data/scene-layouts',
        body: JSON.stringify({
          'Dup': {
            name: 'Dup',
            items: [
              { id: 'dup', assetId: 'scout-body', t: { offset: [0, 0, 0], yaw: 0, scale: 1 } },
              { id: 'dup', assetId: 'hauler-body', t: { offset: [1, 0, 0], yaw: 0, scale: 1 } },
            ],
          },
        }),
      }),
      s.paths
    );
    assert.equal(dupItem?.status, 422);
  } finally { s.cleanup(); }
});

test('levels write-back: GET empty/initial, POST valid audio levels, and reject invalid', async () => {
  const s = setup();
  try {
    const getRes = await handleStudioRequest(req({ method: 'GET', path: '/__studio/data/levels', readBody: async () => '' }), s.paths);
    assert.equal(getRes?.status, 200);
    assert.ok(getRes?.body.includes('audio levels'));

    // POST valid levels
    const validLevels = {
      about: 'audio levels',
      levels: {
        'ambient/wind': { gain: 0.75 },
        'engine/rev': { gain: 1.2 },
      },
    };
    const postRes = await handleStudioRequest(
      req({ path: '/__studio/data/levels', body: JSON.stringify(validLevels) }),
      s.paths
    );
    assert.equal(postRes?.status, 200);

    const getBack = await handleStudioRequest(req({ method: 'GET', path: '/__studio/data/levels', readBody: async () => '' }), s.paths);
    assert.equal(getBack?.status, 200);
    const readBack = JSON.parse(String(getBack?.body));
    assert.equal(readBack.levels['ambient/wind']?.gain, 0.75);

    // Rejects invalid levels (non-numeric gain)
    const badRes = await handleStudioRequest(
      req({ path: '/__studio/data/levels', body: JSON.stringify({ levels: { 'engine/rev': { gain: 'loud' } } }) }),
      s.paths
    );
    assert.equal(badRes?.status, 422);
  } finally { s.cleanup(); }
});

test('asset-flags write-back: POST patches assets in manifest, GET reads manifest back, and rejects bad flags', async () => {
  const s = setup();
  try {
    // Valid patch: add fix flags, reach, hold, lumOk to scout-body
    const patch = {
      'scout-body': {
        fix: ['fix: mirror-z', 'reach: 3'],
        reach: 3,
        hold: true,
        lumOk: true,
      },
    };
    const postRes = await handleStudioRequest(
      req({ path: '/__studio/data/asset-flags', body: JSON.stringify(patch) }),
      s.paths
    );
    assert.equal(postRes?.status, 200);

    // Read back manifest file
    const manifest = JSON.parse(fs.readFileSync(s.paths.manifestFile!, 'utf8'));
    const scout = manifest.assets.find((a: any) => a.id === 'scout-body');
    assert.deepEqual(scout.fix, ['mirror-z']);
    assert.equal(scout.reach, 3);
    assert.equal(scout.hold, true);
    assert.equal(scout.lumOk, true);

    // Unknown asset rejected
    const badRes = await handleStudioRequest(
      req({ path: '/__studio/data/asset-flags', body: JSON.stringify({ 'ghost-asset': { hold: true } }) }),
      s.paths
    );
    assert.equal(badRes?.status, 422);
  } finally { s.cleanup(); }
});

test('sockets write-back: POST valid sockets, GET reads back, and rejects bad socket data', async () => {
  const s = setup();
  try {
    const sockets = {
      'scout-body': [
        { kind: 'mount', pos: [0, 0.5, -1.2], normal: [0, 1, 0] },
        { kind: 'exhaust', pos: [0, 0.2, 1.5], normal: [0, 0, 1] },
      ],
    };
    const postRes = await handleStudioRequest(
      req({ path: '/__studio/data/sockets', body: JSON.stringify(sockets) }),
      s.paths
    );
    assert.equal(postRes?.status, 200);

    const getRes = await handleStudioRequest(req({ method: 'GET', path: '/__studio/data/sockets', readBody: async () => '' }), s.paths);
    assert.equal(getRes?.status, 200);
    const readBack = JSON.parse(String(getRes?.body));
    assert.equal(readBack['scout-body']?.length, 2);
    assert.equal(readBack['scout-body'][0].kind, 'mount');

    // Rejects invalid socket kind
    const badKind = await handleStudioRequest(
      req({ path: '/__studio/data/sockets', body: JSON.stringify({ 'scout-body': [{ kind: 'laser', pos: [0, 0, 0], normal: [0, 1, 0] }] }) }),
      s.paths
    );
    assert.equal(badKind?.status, 422);
  } finally { s.cleanup(); }
});

test('monster-tweaks write-back: POST valid remapStrength, GET reads back, and rejects out-of-range', async () => {
  const s = setup();
  try {
    const tweaks = {
      'ogro': { remapStrength: 0.35 },
      'demon': { remapStrength: 0.15 },
    };
    const postRes = await handleStudioRequest(
      req({ path: '/__studio/data/monster-tweaks', body: JSON.stringify(tweaks) }),
      s.paths
    );
    assert.equal(postRes?.status, 200);

    const getRes = await handleStudioRequest(req({ method: 'GET', path: '/__studio/data/monster-tweaks', readBody: async () => '' }), s.paths);
    assert.equal(getRes?.status, 200);
    const readBack = JSON.parse(String(getRes?.body));
    assert.equal(readBack['ogro']?.remapStrength, 0.35);

    // Rejects out of range remapStrength (> 1 or < 0)
    const badRange = await handleStudioRequest(
      req({ path: '/__studio/data/monster-tweaks', body: JSON.stringify({ 'ogro': { remapStrength: 1.5 } }) }),
      s.paths
    );
    assert.equal(badRange?.status, 422);
  } finally { s.cleanup(); }
});


