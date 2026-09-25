/**
 * C2: the dev server writes an add-only safety copy of the track whenever it grows past the biggest
 * one on disk (scripts/props-safety-copy.ts). Runs against a temporary directory only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { highestSafetyCount, safetyCopyName, writeSafetyCopyIfGrown } from '../scripts/props-safety-copy';

const payload = (count: number) => ({ course: 'ridge', props: Array.from({ length: count }, (_, i) => ({ id: `p${i}` })) });

test('safety copies: a bigger track gets a new numbered copy; the old ones stay', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hm2-safety-'));
  try {
    writeFileSync(join(dir, safetyCopyName(237)), JSON.stringify(payload(237)));
    writeFileSync(join(dir, 'track-props-latest-safeguard.json'), '{}');
    assert.equal(highestSafetyCount(dir), 237);

    const grown = writeSafetyCopyIfGrown(dir, payload(523));
    assert.equal(grown.written, true);
    assert.equal(grown.watermark, 523);
    assert.equal(JSON.parse(readFileSync(join(dir, safetyCopyName(523)), 'utf8')).props.length, 523);
    assert.equal(highestSafetyCount(dir), 523);
    assert.deepEqual(readdirSync(dir).sort(), [safetyCopyName(237), safetyCopyName(523), 'track-props-latest-safeguard.json'].sort());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('safety copies: the same or a smaller track writes nothing and never replaces a copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hm2-safety-'));
  try {
    const original = JSON.stringify(payload(300));
    writeFileSync(join(dir, safetyCopyName(300)), original);
    assert.equal(writeSafetyCopyIfGrown(dir, payload(300)).written, false);
    assert.equal(writeSafetyCopyIfGrown(dir, payload(120)).written, false);
    assert.equal(readFileSync(join(dir, safetyCopyName(300)), 'utf8'), original);
    assert.equal(readdirSync(dir).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('safety copies: a missing directory is created on the first copy', () => {
  const root = mkdtempSync(join(tmpdir(), 'hm2-safety-'));
  try {
    const dir = join(root, 'user_safety_backup');
    assert.equal(highestSafetyCount(dir), 0);
    assert.equal(writeSafetyCopyIfGrown(dir, payload(3)).written, true);
    assert.equal(highestSafetyCount(dir), 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
