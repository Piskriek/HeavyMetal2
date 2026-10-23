import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  growTree,
  TREE_PARAM_SPECS,
  FOLIAGE_SPECIES_PRESETS,
  resolveTreeSliderParams,
  buildDilatedSprigAtlas,
} from '../src/index';

describe('TICKET-31: @hm/treegen species presets, sliders, spherized normals, wind & dilated sprig atlas', () => {
  it('preserves deterministic growTree geometry and adds spherizedNormal, faceNormal, windAndAo, and atlasUv', () => {
    const t1 = growTree({ species: 'oak', seed: 202, height: 8.5, detail: 1 });
    const t2 = growTree({ species: 'oak', seed: 202, height: 8.5, detail: 1 });

    assert.equal(t1.triangles, t2.triangles);
    assert.equal(t1.branches.length, t2.branches.length);
    assert.ok(t1.triangles <= 2000);

    const sphNor = t1.leaves.getAttribute('spherizedNormal');
    const faceNor = t1.leaves.getAttribute('faceNormal');
    const windAo = t1.leaves.getAttribute('windAndAo');
    const atlasUv = t1.leaves.getAttribute('atlasUv');
    const barkWind = t1.bark.getAttribute('windAndAo');

    assert.ok(sphNor !== undefined && sphNor.count > 0);
    assert.ok(faceNor !== undefined && faceNor.count === sphNor.count);
    assert.ok(windAo !== undefined && windAo.count === sphNor.count);
    assert.ok(atlasUv !== undefined && atlasUv.count === sphNor.count);
    assert.ok(barkWind !== undefined && barkWind.count > 0);

    // Bark windAndAo.w is -1.0, leaf windAndAo.w is > 0:
    assert.equal(barkWind.getW(0), -1);
    assert.ok(windAo.getW(0) > 0);
  });

  it('exposes TREE_PARAM_SPECS slider schema and FOLIAGE_SPECIES_PRESETS that scale crown & height', () => {
    assert.ok(TREE_PARAM_SPECS.length >= 7);
    assert.ok(FOLIAGE_SPECIES_PRESETS.pine !== undefined);
    assert.ok(FOLIAGE_SPECIES_PRESETS.oak !== undefined);
    assert.ok(FOLIAGE_SPECIES_PRESETS.birch !== undefined);

    const narrow = growTree({
      species: 'oak',
      seed: 202,
      height: 8.5,
      detail: 1,
      sliders: resolveTreeSliderParams({ height: 8.5, crownSpread: 0.6 }),
    });
    const wide = growTree({
      species: 'oak',
      seed: 202,
      height: 8.5,
      detail: 1,
      sliders: resolveTreeSliderParams({ height: 8.5, crownSpread: 1.5 }),
    });
    assert.ok(wide.radius > narrow.radius * 1.35, `Expected wide.radius (${wide.radius}) > narrow.radius (${narrow.radius}) * 1.35`);
  });

  it('builds an edge-dilated 2x2 botanical sprig atlas without black/white transparent fringes', () => {
    const atlas = buildDilatedSprigAtlas(64);
    assert.equal(atlas.size, 64);
    assert.equal(atlas.rgba.length, 64 * 64 * 4);

    let opaqueCount = 0;
    let dilatedTransparentCount = 0;
    for (let i = 0; i < atlas.rgba.length; i += 4) {
      const g = atlas.rgba[i + 1] ?? 0;
      const a = atlas.rgba[i + 3] ?? 0;
      if (a === 255) opaqueCount++;
      else if (g > 80) dilatedTransparentCount++;
    }
    assert.ok(opaqueCount > 300);
    assert.ok(dilatedTransparentCount > 1000);
  });
});
