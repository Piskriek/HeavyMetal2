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
  return {
    paths: { dataDir, registryFile },
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

