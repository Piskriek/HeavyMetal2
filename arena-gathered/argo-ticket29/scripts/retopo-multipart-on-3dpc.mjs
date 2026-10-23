#!/usr/bin/env node
/**
 * TICKET-29 — Batch Auditor & 3dpc (192.168.0.8) / Local Dispatcher for Fused Multi-Part Low-Poly GLBs
 *
 * Usage:
 *   node scripts/retopo-multipart-on-3dpc.mjs --audit
 *   node scripts/retopo-multipart-on-3dpc.mjs --fix-top 5 --target-tris 900
 *   node scripts/retopo-multipart-on-3dpc.mjs --ai-holopart --host 192.168.0.8 --asset fabricator
 *
 * Modes:
 *   1. --audit: Scans apps/web/public/models/**/*.glb, parses binary GLB POSITION + INDICES
 *      buffers, and ranks every single-mesh model that has multiple fused parts + cross-part webbing.
 *   2. --fix-top N: Runs our deterministic part-split + planar hard-surface retopologizer
 *      (via headless Blender on 3dpc/local or pure TS fallback + gltfpack) on the N worst assets.
 *   3. --ai-holopart: Dispatches NVIDIA PartField + Tripo HoloPart + MeshAnything V2 on 3dpc
 *      (192.168.0.8) against apps/web/public/hd/<asset>.glb to regenerate clean artist-topology parts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Lightweight zero-dependency GLB binary POSITION + INDICES extractor for auditing single-mesh assets.
 */
export function extractPrimaryMeshFromGlbBuffer(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) {
    throw new Error('Not a valid binary GLB file');
  }
  const jsonChunkLen = view.getUint32(12, true);
  const jsonStr = new TextDecoder().decode(
    new Uint8Array(buffer.buffer, buffer.byteOffset + 20, jsonChunkLen),
  );
  const gltf = JSON.parse(jsonStr);

  const binChunkOffset = 20 + jsonChunkLen + 8;
  const meshes = gltf.meshes ?? [];
  const accessors = gltf.accessors ?? [];
  const bufferViews = gltf.bufferViews ?? [];

  let primitiveCount = 0;
  for (const m of meshes) {
    primitiveCount += (m.primitives ?? []).length;
  }

  const firstPrim = meshes[0]?.primitives?.[0];
  if (!firstPrim) {
    return { primitiveCount: 0, positions: new Float32Array(0), indices: new Uint32Array(0) };
  }

  function readAccessorAsFloat32(accIdx) {
    const acc = accessors[accIdx];
    const bv = bufferViews[acc.bufferView];
    const byteOffset = binChunkOffset + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const count = acc.count * 3;
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = view.getFloat32(byteOffset + i * 4, true);
    }
    return out;
  }

  function readAccessorAsIndices(accIdx, vertCount) {
    if (accIdx === undefined) {
      const seq = new Uint32Array(vertCount);
      for (let i = 0; i < vertCount; i++) seq[i] = i;
      return seq;
    }
    const acc = accessors[accIdx];
    const bv = bufferViews[acc.bufferView];
    const byteOffset = binChunkOffset + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const out = new Uint32Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
      if (acc.componentType === 5123) {
        out[i] = view.getUint16(byteOffset + i * 2, true);
      } else if (acc.componentType === 5125) {
        out[i] = view.getUint32(byteOffset + i * 4, true);
      } else {
        out[i] = view.getUint8(byteOffset + i);
      }
    }
    return out;
  }

  const positions = readAccessorAsFloat32(firstPrim.attributes.POSITION);
  const indices = readAccessorAsIndices(firstPrim.indices, positions.length / 3);
  return { primitiveCount, positions, indices };
}

export function build3dpcHoloPartCommand(host, hdGlbPath, outLowGlbPath, targetTris = 900) {
  return [
    `ssh ${host}`,
    `"cd ~/retopo-pipeline &&`,
    `python3 run_partfield_segment.py --input ${hdGlbPath} --out /tmp/segmented.glb &&`,
    `python3 run_holopart_complete.py --input /tmp/segmented.glb --out /tmp/completed_parts.glb &&`,
    `python3 run_meshanything_v2_per_part.py --input /tmp/completed_parts.glb --target-tris ${targetTris} --out ${outLowGlbPath} &&`,
    `gltfpack -i ${outLowGlbPath} -o ${outLowGlbPath} -cc"`,
  ].join(' ');
}
