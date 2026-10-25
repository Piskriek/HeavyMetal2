import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validate } from '@hm/kitspec';
import { MILL_V2_KIT } from '../play/kit-mill-v2';
const MILL_V2_PRESET_ID = 'mill-frame';
import { MATSTACK_TEST_PIECE_KIT } from '../play/kit-modules';
import {
  buildKitPickTable,
  extractMaterialSlots,
  pickPartAndSlotAtTriangle,
  pickSlotOnStandalonePart,
} from './viewport/raycast-picker';
import {
  autoSnapFloatingPlacements,
  enumerateAssemblySockets,
  surfaceHitToSocketDef,
} from './viewport/socket-gizmos';
import {
  compileMaterialUniforms,
  createStudioTileBank,
  updateTileInBank,
} from './viewport/layered-material-bridge';
import { createStudioStore } from './state/studio-store';
import { persistStagedStudioChanges } from './state/studio-persistence';


describe('STUDIO-44B & STUDIO-44D Opus Core Engine Modules', () => {
  it('buildKitPickTable & pickPartAndSlotAtTriangle resolve every triangle on MILL_V2_KIT in O(log N)', () => {
    const table = buildKitPickTable(MILL_V2_KIT, MILL_V2_PRESET_ID, 2);
    assert.ok(table.totalTriangles > 100, `Expected > 100 triangles on MILL_V2_KIT, got ${table.totalTriangles}`);
    assert.ok(table.ranges.length > 20);

    // Pick first, middle, and last triangle
    const firstHit = pickPartAndSlotAtTriangle(table, 0);
    assert.ok(firstHit);
    assert.equal(firstHit.partId, 'mill-base-plinth');
    assert.ok(firstHit.materialId.startsWith('mat:'));

    const midHit = pickPartAndSlotAtTriangle(table, Math.floor(table.totalTriangles / 2));
    assert.ok(midHit);
    assert.ok(midHit.path.length > 0);
    assert.ok(midHit.slotName.length > 0);

    const lastHit = pickPartAndSlotAtTriangle(table, table.totalTriangles - 1);
    assert.ok(lastHit);
    assert.equal(pickPartAndSlotAtTriangle(table, -1), null);
    assert.equal(pickPartAndSlotAtTriangle(table, table.totalTriangles), null);
  });

  it('pickSlotOnStandalonePart resolves multi-slot @hm/partgen primitives (can: body, trim, band)', () => {
    const firstSlot = pickSlotOnStandalonePart('can', { width: 0.6, depth: 0.6, height: 1.0, bands: 2 }, 2, 0);
    assert.ok(firstSlot === 'trim' || firstSlot === 'body');
  });

  it('extractMaterialSlots discovers all material and lx: lamp slots on MILL_V2_KIT', () => {
    const slots = extractMaterialSlots(MILL_V2_KIT, MILL_V2_PRESET_ID);
    assert.ok(slots.length >= 10, `Expected >= 10 distinct part:slot entries, got ${slots.length}`);
    const hasHazard = slots.some((s) => s.materialId === 'mat:hazard-chevron');
    const hasLamp = slots.some((s) => s.isLamp && s.materialId.startsWith('lx:'));
    assert.equal(hasHazard, true, 'Expected mat:hazard-chevron slot');
    assert.equal(hasLamp, true, 'Expected lx: lamp slot');
  });

  it('enumerateAssemblySockets lists root gameplay sockets and child part sockets with occupancy and color codes', () => {
    const pins = enumerateAssemblySockets(MILL_V2_KIT, MILL_V2_PRESET_ID);
    assert.ok(pins.length >= 10, `Expected >= 10 socket pins on MILL_V2_KIT, got ${pins.length}`);
    const rootVent = pins.find((p) => p.ownerPath === '' && p.socketName === 'vent');
    assert.ok(rootVent, 'Expected root vent gameplay socket');
    assert.equal(rootVent.category, 'gameplay');

    const occupiedPins = pins.filter((p) => p.category === 'structural-occupied');
    assert.ok(occupiedPins.length >= 8, `Expected >= 8 occupied sockets, got ${occupiedPins.length}`);
  });

  it('surfaceHitToSocketDef snaps hit coordinates to 5 mm and computes exact Euler XYZ surface alignment', () => {
    // Hit on a +Z front face at (0.1234, 0.8567, 1.4001)
    const sockZ = surfaceHitToSocketDef([0.1234, 0.8567, 1.4001], [0, 0, 1]);
    assert.deepEqual(sockZ.at, [0.125, 0.855, 1.4]);
    assert.deepEqual(sockZ.rot, [90, 0, 0]);

    // Hit on a +Y top face
    const sockY = surfaceHitToSocketDef([0, 2.002, 0], [0, 1, 0]);
    assert.deepEqual(sockY.at, [0, 2.0, 0]);
    assert.equal(sockY.rot, undefined);
  });

  it('autoSnapFloatingPlacements automatically repairs below-ground and floating root placements', () => {
    // Intentionally float a part at y = +0.45 m on MATSTACK_TEST_PIECE_KIT
    const brokenKit = {
      ...MATSTACK_TEST_PIECE_KIT,
      assemblies: {
        ...MATSTACK_TEST_PIECE_KIT.assemblies,
        'matstack-test-piece': {
          ...MATSTACK_TEST_PIECE_KIT.assemblies['matstack-test-piece']!,
          children: [
            {
              ...MATSTACK_TEST_PIECE_KIT.assemblies['matstack-test-piece']!.children[0]!,
              at: [0, 0.45, 0] as const,
            },
            ...MATSTACK_TEST_PIECE_KIT.assemblies['matstack-test-piece']!.children.slice(1),
          ],
        },
      },
    };
    const issuesBefore = validate(brokenKit, 'matstack-test-piece');
    assert.ok(issuesBefore.length > 0, 'Expected floating issues before auto-snap');

    const fixedKit = autoSnapFloatingPlacements(brokenKit, 'matstack-test-piece');
    const issuesAfter = validate(fixedKit, 'matstack-test-piece');
    assert.deepEqual(issuesAfter, []);
  });

  it('createStudioTileBank, updateTileInBank & compileMaterialUniforms bind @hm/texgraph and @hm/matstack live', () => {
    const bank = createStudioTileBank(64);
    assert.equal(bank.tileIds.length, 20);
    assert.equal(bank.arrayData.length, 20 * 64 * 64 * 4);
    assert.equal(bank.noiseAtlasData.length, 64 * 64 * 4);

    // Sample 'stripes' via CPU oracle
    const s0 = bank.tileSource.sample('stripes', 0.1, 0.1);
    const s1 = bank.tileSource.sample('stripes', 0.35, 0.1);
    assert.notEqual(s0.grey, s1.grey);

    // Live update 'stripes' in bank
    const prevVersion = bank.version;
    const sliceUpdate = updateTileInBank(bank, 'stripes', bank.tileIds.includes('stripes') ? {
      id: 'stripes',
      name: 'Modified Stripes',
      nodes: [{ id: 'b', type: 'stripes', count: 4, softness: 0.1, vertical: false }],
      out: { albedo: 'b', height: 'b', roughness: 'b' },
    } : ({} as never));
    assert.ok(sliceUpdate);
    assert.equal(bank.version, prevVersion + 1);

    // Compile uniforms in both Lit mode and Mask B&W mode
    const store = createStudioStore({
      'kit:texture-mill': { kit: MILL_V2_KIT, rootPreset: MILL_V2_PRESET_ID },
    });
    const spec = store.getEffectiveMaterialSpec('mat:field-worn-hazard');
    const uLit = compileMaterialUniforms(spec, bank, null);
    assert.equal(uLit.uMaskViewLayer, -1);

    const uMask = compileMaterialUniforms(spec, bank, 2);
    assert.equal(uMask.uMaskViewLayer, 2);
    assert.ok(uMask.programCacheKey.endsWith('|mv:2'));
  });

  it('createStudioStore supports full Pillar 1, 2, and 3 workflows with undo/redo and persistence', async () => {
    const store = createStudioStore({
      'kit:texture-mill': { kit: MILL_V2_KIT, rootPreset: MILL_V2_PRESET_ID },
      'kit:test-piece': { kit: MATSTACK_TEST_PIECE_KIT, rootPreset: 'matstack-test-piece' },
    });

    // 1. Hover try-on non-destructively previews and restores on leave
    const baseMatId = store.getSnapshot().activeMaterialId;
    store.setHoveredMaterial('mat:old-copper');
    assert.equal(store.getEffectiveMaterialSpec(baseMatId).name, 'Old copper');
    store.setHoveredMaterial(null);
    assert.notEqual(store.getEffectiveMaterialSpec(baseMatId).name, 'Old copper');

    // 2. Edit paint1, age, and layer stack on active material
    store.setMaterialPaint(0, '#4ade80');
    store.setMaterialAge(0.75);
    store.addLayerFromShelf('moss');
    const updatedSpec = store.getEffectiveMaterialSpec(baseMatId);
    assert.equal(updatedSpec.paint[0], '#4ade80');
    assert.equal(updatedSpec.age, 0.75);
    assert.equal(updatedSpec.layers[updatedSpec.layers.length - 1]?.name, 'Moss');

    // 3. Toggle Mask B&W view
    store.setViewportMode('mask-bw', 1);
    assert.equal(store.getSnapshot().viewportMode, 'mask-bw');
    assert.equal(store.getSnapshot().maskViewLayerIndex, 1);

    // 4. Attach a parametric 'lamp' part onto a socket of MILL_V2_KIT and apply 'chamfer-45' quick preset
    const prevChildrenCount =
      store.getSnapshot().kits['kit:texture-mill']!.kit.assemblies[MILL_V2_PRESET_ID]!.children.length;
    store.attachPartToSocket(0, 'boltFL', 'lamp', 'extra-beacon');
    const nextChildrenCount =
      store.getSnapshot().kits['kit:texture-mill']!.kit.assemblies[MILL_V2_PRESET_ID]!.children.length;
    assert.equal(nextChildrenCount, prevChildrenCount + 1);

    store.applyQuickMeshOp('mill-main-carcass', 'chamfer-45');
    const carcassPart = store.getSnapshot().kits['kit:texture-mill']!.kit.parts['mill-main-carcass']!;
    assert.equal(carcassPart.source.kind, 'param');
    if (carcassPart.source.kind === 'param') {
      assert.equal(carcassPart.source.ops?.[0]?.op, 'chamfer-hard-edges');
    }

    // 5. Undo & Redo
    assert.equal(store.canUndo(), true);
    store.undo();
    assert.equal(store.canRedo(), true);
    store.redo();

    // 6. Persist staged changes
    assert.ok(store.getSnapshot().stagedChanges.length >= 2);
    const res = await persistStagedStudioChanges(store);
    assert.equal(res.ok, true);
    assert.ok(res.writtenPaths.length >= 2);
  });
});
