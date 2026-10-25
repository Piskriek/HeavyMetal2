import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { BiomeInput } from '@hm/plotbiome';
import { createPlotBiomeView, MAX_TREE_VARIANTS, treeVariantKey, type TreeVariantSpec } from './plot-biome-view';

/** A flat, wet, healthy 96 m plot: plenty of trees, no water, no machines. */
const input = (): BiomeInput => {
  const n = 96;
  return {
    n, cellM: 1, height: new Float32Array(n * n).fill(10), water: new Uint8Array(n * n), stage: 6,
    s: { pxd: 0.6, vtx: 0.6, lx: 0.7, aq: 0.9 }, machines: [], keepouts: [], seed: 7, tier: 'high',
  };
};
const view = () => {
  const scene = new THREE.Scene();
  const v = createPlotBiomeView(scene, { heightAt: () => 10, tier: 'high' });
  v.build(input());
  v.setStage(6);
  return v;
};
const AUTUMN: TreeVariantSpec = { species: 'oak', params: { height: 12, tint: 1 } };

/** The first tree the beam finds, looking down the x axis at trunk height from the plot's edge row by row. */
const someTree = (v: ReturnType<typeof view>) => {
  for (let z = -45; z <= 45; z += 0.5) {
    const hit = v.treeAt([-60, 11.5, z], [1, 0, 0], 200);
    if (hit) return hit;
  }
  return null;
};

test('the beam finds a tree by its trunk, and a tree grows as its species until a preset is fitted', () => {
  const v = view();
  assert.ok(v.counts().trees > 20, `${v.counts().trees} trees`);
  const hit = someTree(v)!;
  assert.ok(hit, 'a tree on the ray');
  assert.equal(hit.kind, hit.species);
  assert.equal(v.treeAt([-60, 40, 0], [1, 0, 0], 200), null, 'a ray over the crowns finds none');
});

test('fitting a preset regrows that tree only, in its own instanced set, and survives a rebuild', () => {
  const v = view();
  const hit = someTree(v)!;
  const before = v.counts().trees, calls = v.drawCalls();
  assert.equal(v.setTreeOverrides({ [hit.place]: AUTUMN }), 1);
  const again = v.treeAt([-60, 11.5, hit.worldZ], [1, 0, 0], 200)!;
  assert.equal(again.place, hit.place);
  assert.equal(again.kind, treeVariantKey(AUTUMN));
  assert.equal(again.species, 'oak');
  assert.equal(v.counts().trees, before, 'no tree added or lost');
  assert.equal(v.drawCalls(), calls + 1, 'one more draw call: the preset\'s set');
  v.build(input());
  assert.equal(v.treeAt([-60, 11.5, hit.worldZ], [1, 0, 0], 200)?.kind, treeVariantKey(AUTUMN), 'kept over a rebuild');
});

test('trees of the same kind nearby are found together; equal presets share a set; the cap holds', () => {
  const v = view();
  const hit = someTree(v)!;
  const like = v.treesLike(hit.place, 30);
  assert.ok(like.includes(hit.place) && like.length > 1, `${like.length} alike within 30 m`);
  const all: Record<string, TreeVariantSpec> = {};
  for (const p of like) all[p] = AUTUMN;
  assert.equal(v.setTreeOverrides(all), 1, 'one preset, one set, however many trees');
  const many: Record<string, TreeVariantSpec> = {};
  like.slice(0, MAX_TREE_VARIANTS + 2).forEach((p, i) => { many[p] = { species: 'pine', params: { height: 4 + i } }; });
  assert.equal(v.setTreeOverrides(many), Math.min(MAX_TREE_VARIANTS, like.length), 'at most the cap; the rest stay as grown');
  assert.equal(v.setTreeOverrides({}), 0, 'clearing drops every preset set');
});

test('a plot wears its biome preset: the species slots decide what the scattered trees grow as', () => {
  const v = view();
  const before = someTree(v)!;
  assert.ok(before.species !== 'pine' || before.kind === before.species, 'the biome grows its own species until a palette is set');
  // every slot a pine: every tree the beam finds is now a pine, whatever the scatter called it
  const pines: TreeVariantSpec[] = Array.from({ length: 6 }, (_, i) => ({ species: 'pine', params: { height: 6 + i, tint: i % 2 } }));
  assert.equal(v.setSpeciesSlots(pines), 6);
  const seen = new Set<string>();
  for (let z = -45; z <= 45; z += 1) {
    const hit = v.treeAt([-60, 11.5, z], [1, 0, 0], 200);
    if (hit) seen.add(hit.kind);
  }
  assert.ok(seen.size > 0, 'trees are still standing');
  assert.deepEqual([...seen], ['pine']);
  // a palette that names no tree is refused rather than growing ferns, and the plot keeps its own species again
  assert.equal(v.setSpeciesSlots([{ species: 'fern' as TreeVariantSpec['species'], params: {} }]), 0);
  const after = someTree(v)!;
  assert.equal(after.species, after.kind);
  // the slot count is capped at the plot's six presets
  assert.equal(v.setSpeciesSlots(Array.from({ length: 9 }, (_, i) => ({ species: 'oak' as const, params: { height: 4 + i } }))), MAX_TREE_VARIANTS);
});
