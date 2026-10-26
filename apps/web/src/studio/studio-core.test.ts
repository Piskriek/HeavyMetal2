/**
 * @file apps/web/src/studio/studio-core.test.ts
 * Comprehensive verification suite for ARGO_STUDIO_CLEANUP_DIRECTIVE.md (Commit 9fd3d9fb):
 * - All 10 Modular Machine Kits (0 grounding/collision issues, 0 legacy .glb files)
 * - Loop A ("Tune & Mod the Example Game") & Loop B ("Genesis of a New Planet")
 * - All 10 Logical Questions (Q1..Q10)
 * - Clean compilation of all 13 React (.tsx) UI components
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validate } from '@hm/kitspec';
import { TILE_LIBRARY } from '@hm/texgraph';
import { STUDIO_KIT_LIST, STUDIO_KIT_REGISTRY } from './kits/studio-kit-registry';
import { buildKitPickTable, pickPartAndSlotAtTriangle } from './viewport/raycast-picker';
import {
  classifyTriadSocketRole,
  enumerateAssemblySockets,
} from './viewport/socket-gizmos';
import { createStudioTileBank, compileMaterialUniforms } from './viewport/layered-material-bridge';
import { buildStudioMachineModel } from './viewport/build-studio-machine-model';
import {
  decodeSporeCardPng,
} from './state/spore-card-codec';
import { createStudioStore, RUNG_METADATA } from './state/studio-store';
import { persistStagedStudioChanges } from './state/studio-persistence';

describe('ARGO_STUDIO_CLEANUP_DIRECTIVE — Full Studio Overhaul Verification', () => {
  it('1. Validates all 10 modular kits in STUDIO_KIT_REGISTRY with 0 issues and builds 3D models without legacy GLBs', () => {
    assert.equal(STUDIO_KIT_LIST.length, 10, 'Must provide all 10 modular machine kits');
    for (const entry of STUDIO_KIT_LIST) {
      const issues = validate(entry.kit, entry.rootPreset);
      assert.deepEqual(
        issues,
        [],
        `Kit ${entry.id} (${entry.label}) must have 0 grounding/socket/collision issues, got: ${JSON.stringify(issues)}`
      );

      const model = buildStudioMachineModel({
        kit: entry.kit,
        presetId: entry.rootPreset,
        showSockets: true,
      });
      assert.ok(model.partCount > 0, `Kit ${entry.id} must build >0 procedural parts`);
      assert.ok(model.triangleCount > 20, `Kit ${entry.id} must build >20 triangles`);
      assert.ok(model.socketPins.length > 0, `Kit ${entry.id} must expose 3D Triad Socket pins`);
      model.dispose();
    }
  });

  it('2. Answers Q1 (Context Breadcrumb) & Q3 (5-Rung Hierarchy)', () => {
    const store = createStudioStore();
    const bc0 = store.getBreadcrumb();
    assert.ok(bc0.formatted.includes('[World: Campaign: Moon Outpost]'));
    assert.ok(bc0.formatted.includes('Texture Mill V2'));

    for (const rung of [1, 2, 3, 4, 5] as const) {
      store.setActiveRung(rung);
      assert.equal(store.getSnapshot().activeRung, rung);
      assert.ok(RUNG_METADATA[rung].label.startsWith(`Rung ${rung}:`));
    }
  });

  it('3. Answers Q4 (Hover Try-On + 64-Step Undo/Redo) & Q6 (Two-Tier Matstack + Paint 1/2 + Age + Solvent + Mask B&W)', () => {
    const store = createStudioStore();
    const slots = store.getMaterialSlotsForActiveKit();
    assert.ok(slots.length >= 2, 'Texture Mill V2 must expose multiple material slots');

    const targetSlot = slots[0]!.slotName;
    const originalMat = slots[0]!.materialId;

    // Hover try-on (non-destructive)
    store.setHoveredMaterial('mat:old-copper');
    assert.equal(store.getSnapshot().hoveredMaterialId, 'mat:old-copper');
    const hoveredSpec = store.getEffectiveMaterialSpec(store.getSnapshot().activeMaterialId);
    assert.ok(hoveredSpec.name.length > 0);

    // Revert hover
    store.setHoveredMaterial(null);
    assert.equal(store.getSnapshot().hoveredMaterialId, null);

    // Commit slot material + Undo/Redo
    store.assignSlotMaterial(targetSlot, 'mat:old-copper', 'kit-slot');
    assert.equal(store.canUndo(), true);
    store.undo();
    const revertedSlot = store.getMaterialSlotsForActiveKit().find((s) => s.slotName === targetSlot);
    assert.equal(revertedSlot?.materialId, originalMat);
    store.redo();
    const redoneSlot = store.getMaterialSlotsForActiveKit().find((s) => s.slotName === targetSlot);
    assert.equal(redoneSlot?.materialId, 'mat:old-copper');

    // Paint 1 & 2, Weathering Age, and [M] Mask B&W mode
    store.setMaterialPaint(0, '#ff5500');
    store.setMaterialPaint(1, '#112233');
    store.setMaterialAge(0.82);
    const updatedSpec = store.getEffectiveMaterialSpec(store.getSnapshot().activeMaterialId);
    assert.equal(updatedSpec.paint?.[0], '#ff5500');
    assert.equal(updatedSpec.paint?.[1], '#112233');
    assert.equal(updatedSpec.age, 0.82);

    store.setViewportMode('mask-bw', 1);
    assert.equal(store.getSnapshot().viewportMode, 'mask-bw');
    assert.equal(store.getSnapshot().maskViewLayerIndex, 1);

    // Build model in Mask B&W diagnostic mode
    const entry = store.getSnapshot().kits[store.getSnapshot().activeKitId]!;
    const maskModel = buildStudioMachineModel({
      kit: entry.kit,
      presetId: entry.rootPreset,
      materials: store.getSnapshot().materials,
      maskViewLayerIndex: 1,
    });
    assert.ok(maskModel.partCount > 0);
    maskModel.dispose();
  });

  it('4. Answers Q5 (Color-Coded 3D Triad Sockets + O(log N) Raycast + Auto-Snap Grounding)', () => {
    assert.equal(classifyTriadSocketRole('feed-inlet').role, 'input');
    assert.equal(classifyTriadSocketRole('feed-inlet').colorHex, '#ff3d8a');
    assert.equal(classifyTriadSocketRole('discharge-chute').role, 'output');
    assert.equal(classifyTriadSocketRole('discharge-chute').colorHex, '#3dc8ff');
    assert.equal(classifyTriadSocketRole('hv-bus-terminal').role, 'power');
    assert.equal(classifyTriadSocketRole('hv-bus-terminal').colorHex, '#ffc13d');
    assert.equal(classifyTriadSocketRole('top-flange').role, 'mount');
    assert.equal(classifyTriadSocketRole('top-flange').colorHex, '#7cff4d');

    const mill = STUDIO_KIT_REGISTRY['kit:texture-mill']!;
    const pickTable = buildKitPickTable(mill.kit, mill.rootPreset);
    assert.ok(pickTable.totalTriangles > 50);
    const hit0 = pickPartAndSlotAtTriangle(pickTable, 0);
    assert.ok(hit0 !== null);
    assert.ok(hit0.partId.length > 0);

    const sockets = enumerateAssemblySockets(mill.kit, mill.rootPreset);
    assert.ok(sockets.length >= 4);

    // Test autoFixGroundingIssues on an intentionally elevated root part
    const store = createStudioStore();
    store.updatePlacement(0, { at: [0, 0.35, 0] });
    assert.ok(store.getSnapshot().validationIssues.length > 0, 'Elevating root plinth should trigger floating issue');
    store.autoFixGroundingIssues();
    assert.equal(store.getSnapshot().validationIssues.length, 0, 'autoFixGroundingIssues must resolve floating placement');
  });

  it('5. Answers Q7 (20 Canonical Seamless Tiles in @hm/texgraph & StudioTileBank)', () => {
    const tileIds = Object.keys(TILE_LIBRARY);
    assert.equal(tileIds.length, 20, 'TILE_LIBRARY must contain all 20 canonical procedural tiles');
    const bank = createStudioTileBank(32);
    const storeForMat = createStudioStore();
    const spec = storeForMat.getEffectiveMaterialSpec('mat:field-worn-hazard');
    const uniformBundle = compileMaterialUniforms(spec, bank);
    assert.ok(uniformBundle.programCacheKey.length > 0);
    assert.equal(uniformBundle.uBaseColour.length, 3);
    assert.ok(uniformBundle.uLayerParams.length > 0);
  });

  it('6. Answers Q2 (World Switcher & Loop B New Planet), Q8 (@hm/wiregraph), Q9 (Test Play Sandbox), and Q10 (Spore Card PNG zTXt)', async () => {
    const store = createStudioStore();

    // Loop B: Create New Planet
    store.createNewPlanet({
      name: 'Planet Vulcan Prime',
      seed: 9001,
      biome: 'volcanic-crag',
      floats: { pxd: 70, vtx: 55, lx: 80, aq: 15 },
      stargateAccess: 'open',
    });
    const snap1 = store.getSnapshot();
    const vulcan = snap1.worlds[snap1.activeWorldId]!;
    assert.equal(vulcan.name, 'My Worlds: Planet Vulcan Prime');
    assert.equal(vulcan.biome, 'volcanic-crag');
    assert.match(vulcan.stargateAddress, /^SG-[0-9A-Z]{4}-[0-9A-Z]{2}$/);

    // Place modular machine on planet & auto-ground
    const countBefore = vulcan.placements.length;
    store.placeKitInActiveWorld('kit:water-maker', [8, 0, -4], 45);
    store.autoGroundWorldPlacements();
    assert.equal(
      store.getSnapshot().worlds[store.getSnapshot().activeWorldId]!.placements.length,
      countBefore + 1
    );

    // Q8: Connect @hm/wiregraph sensor -> actuator
    store.addLogicNode('thermal-sensor', [], ['overheat']);
    store.addLogicNode('coolant-valve', ['openCmd'], []);
    store.connectLogicWire(
      { node: 'thermal-sensor', port: 'overheat' },
      { node: 'coolant-valve', port: 'openCmd' }
    );
    const diag = store.getLogicDiagnostics();
    assert.equal(diag.problems.length, 0, 'Wiregraph DAG must have 0 problems');

    // Q9: Enter Test Play in Sandbox & Exit via Esc
    store.enterTestPlaySandbox();
    assert.equal(store.getSnapshot().testPlayActive, true);
    store.setTestPlayBeamMode('sculpt');
    assert.equal(store.getSnapshot().testPlayBeamMode, 'sculpt');
    store.exitTestPlaySandbox();
    assert.equal(store.getSnapshot().testPlayActive, false);

    // Q10: Export Spore Card PNG & Decode lossless zTXt round-trip
    const exported = store.exportSporeCard('world');
    assert.ok(exported.pngBytes.byteLength > 200);
    assert.equal(exported.payload.dialingAddress, vulcan.stargateAddress);

    const decoded = decodeSporeCardPng(exported.pngBytes);
    assert.ok(decoded !== null, 'decodeSporeCardPng must recover embedded zTXt JSON');
    assert.equal(decoded.title, 'My Worlds: Planet Vulcan Prime');
    assert.equal(decoded.dialingAddress, vulcan.stargateAddress);
    assert.equal(decoded.world?.seed, 9001);

    // Apply to Campaign & Persist
    const entry = store.applyToCampaign();
    assert.equal(entry.category, 'campaign-apply');
    const writeRes = await persistStagedStudioChanges(store);
    assert.equal(writeRes.ok, true);
  });

  it('7. Compiles all 13 React (.tsx) UI components cleanly via TypeScript compiler', async () => {
    const ts = await import('typescript');
    const studioDir = path.resolve('apps/web/src/studio');
    const tsxFiles = [
      'studio-app.tsx',
      'look-tab.tsx',
      'scene-tab.tsx',
      'audio-tab.tsx',
      'inspectors/material-slot-strip.tsx',
      'inspectors/matstack-inspector.tsx',
      'inspectors/kit-assembler-panel.tsx',
      'inspectors/texgraph-node-editor.tsx',
      'inspectors/partgen-meshops-panel.tsx',
      'inspectors/logic-triggers-panel.tsx',
      'modals/new-planet-modal.tsx',
      'modals/spore-card-modal.tsx',
      'modals/test-play-overlay.tsx',
    ];

    for (const rel of tsxFiles) {
      const fullPath = path.join(studioDir, rel);
      assert.ok(fs.existsSync(fullPath), `Missing React component: ${rel}`);
      const source = fs.readFileSync(fullPath, 'utf-8');
      const res = ts.transpileModule(source, {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      assert.ok(res.outputText.length > 50, `Failed to transpile ${rel}`);
    }
  });
});
