import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toStorageKey,
  bigStoreName,
  readRegistry,
  writeRegistry,
  activeProfile,
  listProfiles,
  createProfile,
  renameProfile,
  deleteProfile,
  switchProfile,
  kv,
  REGISTRY_KEY,
  MAIN_PROFILE_ID,
  type ProfileRegistry,
} from './profile-storage';

// In-memory Storage mock for testing
class MockStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
}

function setupMockStorage(initial: Record<string, string> = {}): MockStorage {
  const mock = new MockStorage();
  for (const [k, v] of Object.entries(initial)) mock.setItem(k, v);
  (globalThis as unknown as { localStorage: Storage }).localStorage = mock;
  return mock;
}

test('toStorageKey: main maps to legacy un-prefixed keys; other profiles map to hm.p.<id>.<key>', () => {
  assert.equal(toStorageKey('hm.setmix.play', 'main'), 'hm.setmix.play');
  assert.equal(toStorageKey('hm.profile.v2', 'main'), 'hm.profile.v2');
  assert.equal(toStorageKey('hm.settings', 'main'), 'hm.settings');
  assert.equal(toStorageKey('hm.islands.v1', 'main'), 'hm.islands.v1');

  assert.equal(toStorageKey('hm.setmix.play', 'custom123'), 'hm.p.custom123.hm.setmix.play');
  assert.equal(toStorageKey('hm.profile.v2', 'custom123'), 'hm.p.custom123.hm.profile.v2');
  assert.equal(toStorageKey('hm.settings', 'custom123'), 'hm.p.custom123.hm.settings');

  // Registry key itself is never prefixed
  assert.equal(toStorageKey(REGISTRY_KEY, 'custom123'), REGISTRY_KEY);
});

test('bigStoreName: main maps to hm-store; other profiles to hm-store.<id>', () => {
  assert.equal(bigStoreName('main'), 'hm-store');
  assert.equal(bigStoreName('test_1'), 'hm-store.test_1');
});

test('registry defaults and listing', () => {
  setupMockStorage();
  const reg = readRegistry();
  assert.equal(reg.v, 1);
  assert.equal(reg.active, MAIN_PROFILE_ID);
  assert.equal(reg.list.length, 1);
  assert.equal(reg.list[0]?.id, MAIN_PROFILE_ID);
  assert.equal(reg.list[0]?.name, 'Main');

  const active = activeProfile();
  assert.equal(active.id, MAIN_PROFILE_ID);
  assert.equal(active.name, 'Main');

  const list = listProfiles();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, MAIN_PROFILE_ID);
});

test('createProfile: adds entry and copies device settings from active profile', () => {
  const mock = setupMockStorage();
  // Set some device settings in Main
  const mainProfileData = {
    quality: 'ultra',
    fpsTarget: 60,
    graphics: { ditherDistance: 50 },
    gpu: 'fast',
    controls: { sensitivity: 2, invertY: true, fov: 90 },
    // non-device fields
    credits: 500,
    name: 'Player 1',
  };
  mock.setItem('hm.profile.v2', JSON.stringify(mainProfileData));
  mock.setItem('hm.settings', JSON.stringify({ master: 0.8, sfx: 0.5, music: 0 }));

  const created = createProfile('Beta Tester');
  assert.ok(created.id.startsWith('p_'));
  assert.equal(created.name, 'Beta Tester');

  const list = listProfiles();
  assert.equal(list.length, 2);
  assert.ok(list.some((p) => p.id === created.id));

  // Check device settings copied to new profile's keys
  const newProfileKey = toStorageKey('hm.profile.v2', created.id);
  const newProfileRaw = mock.getItem(newProfileKey);
  assert.ok(newProfileRaw, 'copied profile exists');
  const parsed = JSON.parse(newProfileRaw!) as Record<string, unknown>;
  assert.equal(parsed.quality, 'ultra');
  assert.equal(parsed.fpsTarget, 60);
  assert.equal(parsed.gpu, 'fast');
  assert.deepEqual(parsed.controls, { sensitivity: 2, invertY: true, fov: 90 });
  // non-device fields should NOT be copied
  assert.equal(parsed.credits, undefined);
  assert.equal(parsed.name, undefined);

  // Sound settings copied
  const newSettingsKey = toStorageKey('hm.settings', created.id);
  const newSettingsRaw = mock.getItem(newSettingsKey);
  assert.ok(newSettingsRaw, 'copied settings exists');
  assert.deepEqual(JSON.parse(newSettingsRaw!), { master: 0.8, sfx: 0.5, music: 0 });
});

test('renameProfile: updates the profile name in registry', () => {
  setupMockStorage();
  const created = createProfile('Original Name');
  renameProfile(created.id, 'New Name');

  const list = listProfiles();
  const found = list.find((p) => p.id === created.id);
  assert.equal(found?.name, 'New Name');
});

test('switchProfile: updates active profile and lastUsed', () => {
  setupMockStorage();
  const created = createProfile('Other');
  switchProfile(created.id);
  assert.equal(activeProfile().id, created.id);
  const reg: ProfileRegistry = readRegistry();
  assert.equal(reg.active, created.id);
});

test('deleteProfile: Main cannot be deleted; deleting active switches to Main', () => {
  const mock = setupMockStorage();
  const beta = createProfile('Beta');
  const gamma = createProfile('Gamma');

  // Cannot delete main
  assert.equal(deleteProfile(MAIN_PROFILE_ID), false);
  assert.ok(listProfiles().some((p) => p.id === MAIN_PROFILE_ID));

  // Write some keys for beta and gamma
  mock.setItem(toStorageKey('hm.setmix.play', beta.id), 'beta-save');
  mock.setItem(toStorageKey('hm.island.1', beta.id), 'beta-island');
  mock.setItem(toStorageKey('hm.setmix.play', gamma.id), 'gamma-save');
  mock.setItem('hm.setmix.play', 'main-save');

  // Delete non-active profile gamma
  assert.equal(deleteProfile(gamma.id), true);
  assert.equal(listProfiles().some((p) => p.id === gamma.id), false);
  assert.equal(mock.getItem(toStorageKey('hm.setmix.play', gamma.id)), null);
  // Beta and Main keys must remain intact
  assert.equal(mock.getItem(toStorageKey('hm.setmix.play', beta.id)), 'beta-save');
  assert.equal(mock.getItem('hm.setmix.play'), 'main-save');

  // Now make beta active and delete it
  const reg = readRegistry();
  writeRegistry({ ...reg, active: beta.id });
  assert.equal(activeProfile().id, beta.id);

  assert.equal(deleteProfile(beta.id), true);
  assert.equal(listProfiles().some((p) => p.id === beta.id), false);
  // Active switched to Main
  assert.equal(activeProfile().id, MAIN_PROFILE_ID);
  // Beta keys removed
  assert.equal(mock.getItem(toStorageKey('hm.setmix.play', beta.id)), null);
  assert.equal(mock.getItem(toStorageKey('hm.island.1', beta.id)), null);
  // Main keys untouched
  assert.equal(mock.getItem('hm.setmix.play'), 'main-save');
});

test('kv: operates in active profile namespace', () => {
  const mock = setupMockStorage();
  // Active is Main
  kv.set('test.key', 'value-main');
  assert.equal(kv.get('test.key'), 'value-main');
  assert.equal(mock.getItem('test.key'), 'value-main');

  // Create and switch active to beta
  const beta = createProfile('Beta');
  const reg = readRegistry();
  writeRegistry({ ...reg, active: beta.id });

  // In Beta
  assert.equal(kv.get('test.key'), null);
  kv.set('test.key', 'value-beta');
  assert.equal(kv.get('test.key'), 'value-beta');
  assert.equal(mock.getItem(toStorageKey('test.key', beta.id)), 'value-beta');
  assert.equal(mock.getItem('test.key'), 'value-main', 'main unchanged');

  kv.remove('test.key');
  assert.equal(kv.get('test.key'), null);
  assert.equal(mock.getItem('test.key'), 'value-main', 'main still unchanged');
});

test('scanner: no source file in apps/web/src other than profile-storage.ts touches localStorage directly', () => {
  const srcDir = fileURLToPath(new URL('../', import.meta.url));

  function scanDir(dir: string): string[] {
    const violations: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        violations.push(...scanDir(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        // Skip profile-storage.ts itself and any test files
        if (entry.name === 'profile-storage.ts' || entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
          continue;
        }
        // Read file
        const content = fs.readFileSync(fullPath, 'utf8');
        // Strip multi-line comments, single-line comments, and string literals
        const cleanContent = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*/g, '')
          .replace(/'(?:[^'\\]|\\.)*'/g, "''")
          .replace(/"(?:[^"\\]|\\.)*"/g, '""')
          .replace(/`(?:[^`\\]|\\.)*`/g, '``');

        // Match actual property access or usage of localStorage object
        const lines = cleanContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (/\b(window\.)?localStorage\b/.test(line)) {
            // Exceptions: platform/storage-shim.ts installs the shim property
            if (fullPath.includes(path.join('platform', 'storage-shim.ts'))) continue;
            violations.push(`${path.relative(srcDir, fullPath)}:${i + 1}: ${line.trim()}`);
          }
        }
      }
    }
    return violations;
  }

  const violations = scanDir(srcDir);
  assert.deepEqual(violations, [], `Direct localStorage calls found in:\n${violations.join('\n')}`);
});
