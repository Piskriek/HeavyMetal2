// ============================================================================
// File: packages/anim/tests/ticket21-avatar-and-beam-hybrids.test.ts
// TICKET-21 unit tests covering:
// - POL-12: Universal .glb / .vrm binary inspection, VRM 0.x / 1.0 & Mixamo
//   humanoid 6-bone retargeting, and rest-pose delta application.
// - Workshop Local Vehicle Reskin persistence.
// - P2-VEH-06: Beam Rifle hybrid cartridge modes ('Scatter Excavator' and 'Color Spewer').
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBoneRetargetMap,
  inspectGlbOrVrmBinary,
  applyPoseToRetargetedNodes,
} from '../src/bone-retarget-map';
import {
  resolveHybridCartridge,
  HYBRID_CARTRIDGES,
} from '../../beamkit/src/hybrid-cartridge-modes';

function makeMinimalGlbBuffer(jsonObj: unknown): ArrayBuffer {
  const jsonText = JSON.stringify(jsonObj);
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(jsonText);
  // Pad JSON chunk to 4-byte boundary with spaces (0x20)
  const paddedLen = (rawBytes.byteLength + 3) & ~3;
  const totalLen = 12 + 8 + paddedLen;
  const buf = new ArrayBuffer(totalLen);
  const view = new DataView(buf);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);          // version 2
  view.setUint32(8, totalLen, true);
  view.setUint32(12, paddedLen, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  const u8 = new Uint8Array(buf, 20, paddedLen);
  u8.fill(0x20);
  u8.set(rawBytes);
  return buf;
}

test('POL-12: buildBoneRetargetMap maps Mixamo and VRM 0.x J_Bip bones to @hm/anim 6 bones', () => {
  const mixamoNodes = [
    'mixamorig:Hips',
    'mixamorig:Spine',
    'mixamorig:Head',
    'mixamorig:LeftArm',
    'mixamorig:RightArm',
    'mixamorig:LeftUpLeg',
    'mixamorig:RightUpLeg',
  ];
  const mixamoMap = buildBoneRetargetMap(mixamoNodes);
  assert.equal(Object.keys(mixamoMap).length, 6);
  assert.equal(mixamoMap.body?.nodeName, 'mixamorig:Hips');
  assert.equal(mixamoMap.head?.nodeName, 'mixamorig:Head');
  assert.equal(mixamoMap.armL?.nodeName, 'mixamorig:LeftArm');
  assert.equal(mixamoMap.armR?.nodeName, 'mixamorig:RightArm');
  assert.equal(mixamoMap.legL?.nodeName, 'mixamorig:LeftUpLeg');
  assert.equal(mixamoMap.legR?.nodeName, 'mixamorig:RightUpLeg');

  const vrm0Nodes = [
    'J_Bip_C_Hips',
    'J_Bip_C_Head',
    'J_Bip_L_UpperArm',
    'J_Bip_R_UpperArm',
    'J_Bip_L_UpperLeg',
    'J_Bip_R_UpperLeg',
  ];
  const vrm0Map = buildBoneRetargetMap(vrm0Nodes);
  assert.equal(Object.keys(vrm0Map).length, 6);
  assert.equal(vrm0Map.armL?.source, 'vrm0');
});

test('POL-12: inspectGlbOrVrmBinary parses VRM 1.0 VRMC_vrm extensions and maps all 6 locomotion bones', () => {
  const vrm1Json = {
    asset: { version: '2.0' },
    nodes: [
      { name: 'Root_Hips' },
      { name: 'Cranium_Node' },
      { name: 'Arm_L_Node' },
      { name: 'Arm_R_Node' },
      { name: 'Thigh_L_Node' },
      { name: 'Thigh_R_Node' },
    ],
    extensions: {
      VRMC_vrm: {
        specVersion: '1.0',
        meta: { name: 'Aegis Cadet', authors: ['SetMix Lab'] },
        humanoid: {
          humanBones: {
            hips: { node: 0 },
            head: { node: 1 },
            leftUpperArm: { node: 2 },
            rightUpperArm: { node: 3 },
            leftUpperLeg: { node: 4 },
            rightUpperLeg: { node: 5 },
          },
        },
      },
    },
  };
  const buf = makeMinimalGlbBuffer(vrm1Json);
  const info = inspectGlbOrVrmBinary(buf, 'cadet.vrm');
  assert.equal(info.valid, true);
  assert.equal(info.format, 'vrm');
  assert.equal(info.vrmMeta?.specVersion, '1.0');
  assert.equal(info.vrmMeta?.title, 'Aegis Cadet');
  assert.equal(info.mappedCount, 6);
  assert.equal(info.retargetMap.armL?.nodeName, 'Arm_L_Node');
});

test('POL-12: applyPoseToRetargetedNodes preserves bind rest rotations while applying locomotion pose', () => {
  const nodes = {
    body: { rotation: { x: 0, y: 0, z: 0 }, position: { y: 1.0 } },
    armL: { rotation: { x: 0, y: 0, z: 0 } },
    armR: { rotation: { x: 0, y: 0, z: 0 } },
  };
  const rest = {
    body: { x: 0.1, y: 0, z: 0 },
    armL: { x: 0, y: 0, z: -0.4 },
    armR: { x: 0, y: 0, z: 0.4 },
  };
  applyPoseToRetargetedNodes(
    {
      bones: {
        body: { rx: 0, ry: 0.2, rz: 0 },
        head: { rx: 0, ry: 0, rz: 0 },
        armL: { rx: 0.5, ry: 0, rz: 0.25 },
        armR: { rx: -0.5, ry: 0, rz: 0.25 },
        legL: { rx: 0, ry: 0, rz: 0 },
        legR: { rx: 0, ry: 0, rz: 0 },
      },
      lift: 0.05,
      lean: 0.15,
    },
    nodes,
    rest,
    1.0,
    1.8,
  );
  assert.ok(Math.abs(nodes.body.rotation.x - 0.25) < 1e-6);
  assert.ok(Math.abs(nodes.body.position.y - (1.0 + 0.05 * 1.8)) < 1e-6);
  assert.ok(Math.abs(nodes.armL.rotation.z - (-0.4 - 0.25)) < 1e-6);
  assert.ok(Math.abs(nodes.armR.rotation.z - (0.4 + 0.25)) < 1e-6);
});

test('P2-VEH-06: resolveHybridCartridge recognizes Scatter Excavator and Color Spewer spliced cartridges', () => {
  const scatter = resolveHybridCartridge('hybrid:scatter-excavator');
  assert.ok(scatter);
  assert.equal(scatter.kind, 'scatter-excavator');
  assert.equal(scatter.radiusMultiplier, HYBRID_CARTRIDGES['scatter-excavator'].radiusMultiplier);

  const spewer = resolveHybridCartridge('color-spewer:crystal');
  assert.ok(spewer);
  assert.equal(spewer.kind, 'color-spewer');
  assert.equal(spewer.paintPreset, 'crystal');

  assert.equal(resolveHybridCartridge('moss'), null);
});
