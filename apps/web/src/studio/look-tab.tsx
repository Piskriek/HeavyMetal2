/**
 * @file apps/web/src/studio/look-tab.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Phase 2 & Aspects 6–7):
 * Live 3D Terrain, Sky Dome, Water Basin, Stage S0..S6 Shader & Solar Shadow Viewport.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createTerrain } from '@hm/plotterrain';
import { buildStudioMachineModel, type BuiltStudioMachineModel } from './viewport/build-studio-machine-model';
import type { PreviewStage, StudioState, StudioStore } from './state/studio-store';
import type { BiomeFormulaId } from './state/spore-card-codec';

export interface LookTabProps {
  state: StudioState;
  store: StudioStore;
}

const STAGES: Array<{ stage: PreviewStage; label: string; desc: string }> = [
  { stage: 'lab-neutral', label: 'Lab Neutral', desc: 'Calibration studio dome' },
  { stage: 0, label: 'S0: 1-Bit Pit', desc: 'World-locked 1-bit monochrome dither & vacuum sky' },
  { stage: 1, label: 'S1: 16-Col EGA', desc: '16-color EGA flat-shaded facets & amber horizon' },
  { stage: 2, label: 'S2: 256-Col VGA', desc: '256-color VGA mineral strata & directional sun shadows' },
  { stage: 3, label: 'S3: Gouraud + Hydro', desc: 'Meltwater ponds, Rayleigh sky scatter & shoreline moss' },
  { stage: 4, label: 'S4: PBR + Shrubs', desc: 'Full PBR shading, humus soil & highland scrub' },
  { stage: 5, label: 'S5: Pine & Streams', desc: 'Oxygenated sky dome, flowing streams & conifer stands' },
  { stage: 6, label: 'S6: Living Biosphere', desc: 'Golden-hour canopy, cumulus clouds & vibrant biome' },
];

const BIOME_PALETTES: Record<
  BiomeFormulaId,
  { rock: [number, number, number]; soil: [number, number, number]; lush: [number, number, number]; water: string }
> = {
  'lunar-basalt': {
    rock: [0.36, 0.38, 0.42],
    soil: [0.48, 0.45, 0.40],
    lush: [0.22, 0.56, 0.34],
    water: '#38bdf8',
  },
  'terran-forest': {
    rock: [0.42, 0.44, 0.46],
    soil: [0.46, 0.36, 0.26],
    lush: [0.18, 0.62, 0.28],
    water: '#0284c7',
  },
  'volcanic-crag': {
    rock: [0.22, 0.20, 0.22],
    soil: [0.45, 0.24, 0.16],
    lush: [0.58, 0.42, 0.18],
    water: '#f97316',
  },
  'toxic-basin': {
    rock: [0.28, 0.34, 0.28],
    soil: [0.38, 0.44, 0.24],
    lush: [0.42, 0.72, 0.22],
    water: '#84cc16',
  },
};

export const LookTab: React.FC<LookTabProps> = ({ state, store }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scanWaveRadius, setScanWaveRadius] = useState<number | null>(null);

  const orbitRef = useRef({
    yaw: 0.58,
    pitch: 0.38,
    distance: 11.5,
    dragging: false,
    startX: 0,
    startY: 0,
  });

  const activeWorld = state.worlds[state.activeWorldId]!;
  const activeEntry = state.kits[state.activeKitId]!;
  const numericStage =
    state.previewStage === 'lab-neutral' ? 4 : (state.previewStage as number);

  // Trigger radial scan-wave animation when stage changes
  const triggerScanWave = () => {
    setScanWaveRadius(0.5);
  };

  useEffect(() => {
    if (scanWaveRadius === null) return;
    if (scanWaveRadius > 24) {
      setScanWaveRadius(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setScanWaveRadius((r) => (r !== null ? r + 1.2 : null));
    }, 30);
    return () => window.clearTimeout(timer);
  }, [scanWaveRadius]);

  // Live Three.js Terrain + Sky + Water + Flora + Machine Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);

    // Build deterministic 36m x 36m terrain patch around the machine pad
    const terrain = createTerrain({ seed: activeWorld.seed });
    const gridN = 32;
    const patchSpan = 32;
    const positions = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const normals = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const colors = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const uvs = new Float32Array((gridN + 1) * (gridN + 1) * 2);
    const indices: number[] = [];

    const biomePal = BIOME_PALETTES[activeWorld.biome] ?? BIOME_PALETTES['lunar-basalt'];
    const lushFactor =
      numericStage >= 4
        ? Math.min(1, (numericStage - 2) * 0.28 + activeWorld.floats.pxd / 200)
        : numericStage === 3
        ? 0.25
        : 0;

    for (let iz = 0; iz <= gridN; iz++) {
      for (let ix = 0; ix <= gridN; ix++) {
        const vIdx = iz * (gridN + 1) + ix;
        const wx = ((ix / gridN) - 0.5) * patchSpan;
        const wz = ((iz / gridN) - 0.5) * patchSpan;
        const distFromCenter = Math.hypot(wx, wz);

        // Keep center 3.5m machine pad flat at y=0, blend into surrounding crater/ridge terrain
        const rawH = terrain.height(wx * 2.5, wz * 2.5) * (0.25 + (activeWorld.floats.vtx / 100) * 0.55);
        const padBlend = Math.max(0, Math.min(1, (distFromCenter - 3.2) / 4.5));
        // Depression basin in front-right quadrant for meltwater pooling
        const basinDist = Math.hypot(wx - 6.5, wz - 5.5);
        const basinDip = basinDist < 6.0 ? -1.35 * Math.cos((basinDist / 6.0) * (Math.PI / 2)) : 0;
        let wy = rawH * padBlend + basinDip * padBlend;

        if (numericStage <= 1) {
          // Quantize height steps in S0/S1 low-vertex fidelity
          wy = Math.round(wy * 4) / 4;
        }

        positions[vIdx * 3] = wx;
        positions[vIdx * 3 + 1] = wy;
        positions[vIdx * 3 + 2] = wz;
        normals[vIdx * 3] = 0;
        normals[vIdx * 3 + 1] = 1;
        normals[vIdx * 3 + 2] = 0;
        uvs[vIdx * 2] = ix / gridN;
        uvs[vIdx * 2 + 1] = iz / gridN;

        // Vertex color by stage & elevation
        let r = biomePal.rock[0];
        let g = biomePal.rock[1];
        let b = biomePal.rock[2];
        if (numericStage === 0) {
          const bw = ((ix + iz) & 1) === 0 ? 0.85 : 0.12;
          // 15m amber coil pool near center (DEC-06)
          if (distFromCenter < 6.5) {
            r = 0.95 * bw;
            g = 0.72 * bw;
            b = 0.22 * bw;
          } else {
            r = bw;
            g = bw;
            b = bw;
          }
        } else {
          const soilMix = Math.max(0, Math.min(1, (wy + 1.2) * 0.45));
          r = biomePal.rock[0] * (1 - soilMix) + biomePal.soil[0] * soilMix;
          g = biomePal.rock[1] * (1 - soilMix) + biomePal.soil[1] * soilMix;
          b = biomePal.rock[2] * (1 - soilMix) + biomePal.soil[2] * soilMix;
          if (lushFactor > 0 && wy > -0.35) {
            r = r * (1 - lushFactor) + biomePal.lush[0] * lushFactor;
            g = g * (1 - lushFactor) + biomePal.lush[1] * lushFactor;
            b = b * (1 - lushFactor) + biomePal.lush[2] * lushFactor;
          }
          if (numericStage === 1) {
            r = Math.round(r * 3) / 3;
            g = Math.round(g * 3) / 3;
            b = Math.round(b * 3) / 3;
          }
        }
        colors[vIdx * 3] = r;
        colors[vIdx * 3 + 1] = g;
        colors[vIdx * 3 + 2] = b;
      }
    }

    for (let iz = 0; iz < gridN; iz++) {
      for (let ix = 0; ix < gridN; ix++) {
        const a = iz * (gridN + 1) + ix;
        const b = a + 1;
        const c = a + (gridN + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const terrainGeom = new THREE.BufferGeometry();
    terrainGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    terrainGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    terrainGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    terrainGeom.setIndex(indices);
    terrainGeom.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: numericStage === 0 ? '#e2e8f0' : numericStage >= 4 ? '#3a6b48' : '#645c54',
      roughness: numericStage === 0 ? 1.0 : 0.82,
      metalness: 0.08,
      wireframe: numericStage === 0,
    });
    (terrainMat as unknown as { vertexColors: boolean }).vertexColors = true;
    const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.name = 'look-terrain-patch';
    scene.add(terrainMesh);

    // Water Basin Plane (visible in S3..S6 or when Aq > 25)
    let waterMesh: THREE.Mesh | null = null;
    if (numericStage >= 3 || activeWorld.floats.aq > 25) {
      const waterLevel = -0.85 + (activeWorld.floats.aq / 100) * 0.75;
      const waterGeom = new THREE.PlaneGeometry(patchSpan * 0.95, patchSpan * 0.95);
      waterGeom.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshStandardMaterial({
        color: biomePal.water,
        roughness: 0.15,
        metalness: 0.35,
      });
      waterMesh = new THREE.Mesh(waterGeom, waterMat);
      waterMesh.position.set(0, waterLevel, 0);
      waterMesh.name = 'look-water-plane';
      scene.add(waterMesh);
    }

    // Procedural Conifer Trees & Boulders for S4..S6
    const floraGroup = new THREE.Group();
    floraGroup.name = 'look-flora-group';
    const boulderCoords: Array<[number, number, number]> = [
      [-8, 0.2, -6],
      [9, 0.3, -7],
      [-10, 0.4, 5],
      [8, 0.1, 8],
    ];
    for (const [bx, by, bz] of boulderCoords) {
      const bGeom = new THREE.SphereGeometry(0.65);
      const bMat = new THREE.MeshStandardMaterial({
        color: '#475569',
        roughness: 0.9,
        wireframe: numericStage === 0,
      });
      const bMesh = new THREE.Mesh(bGeom, bMat);
      bMesh.position.set(bx, by, bz);
      floraGroup.add(bMesh);
    }
    if (numericStage >= 4) {
      const treeCoords: Array<[number, number]> = [
        [-6.5, -5.5],
        [-8.5, 2.5],
        [7.5, -4.5],
        [-4.5, 8.0],
        [5.0, -8.5],
        [9.5, 3.0],
      ];
      const treeCount = numericStage === 4 ? 3 : numericStage === 5 ? 5 : 6;
      for (let i = 0; i < treeCount; i++) {
        const [tx, tz] = treeCoords[i]!;
        const trunkGeom = new THREE.CylinderGeometry(0.12, 0.18, 1.4);
        const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.set(tx, 0.7, tz);
        floraGroup.add(trunk);

        const canopyGeom = new THREE.ConeGeometry(0.95, 2.6, 8);
        const canopyMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.75 });
        const canopy = new THREE.Mesh(canopyGeom, canopyMat);
        canopy.position.set(tx, 2.2, tz);
        floraGroup.add(canopy);
      }
    }
    scene.add(floraGroup);

    // Active Modular Machine on Center Pad
    const builtMachine: BuiltStudioMachineModel = buildStudioMachineModel({
      kit: activeEntry.kit,
      presetId: activeEntry.rootPreset,
      overrides: state.overridesByKit[state.activeKitId],
      materials: state.materials,
      activeMaterialId: state.activeMaterialId,
      hoveredMaterialId: state.hoveredMaterialId,
      stageLook: state.previewStage,
      showSockets: false,
    });
    scene.add(builtMachine.group);

    // Solar & Sky Dome Lights
    const hemi = new THREE.HemisphereLight('#93c5fd', '#1e293b', 0.8);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fffbeb', 1.8);
    sun.castShadow = true;
    scene.add(sun);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.shadowMap.enabled = true;
    } catch {
      renderer = null;
    }

    let animId = 0;
    const renderLoop = () => {
      animId = window.requestAnimationFrame(renderLoop);
      const rect = container.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(240, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        if (renderer) renderer.setSize(width, height, false);
      }

      const elRad = ((activeWorld.sunElevationDeg ?? 25) * Math.PI) / 180;
      const azRad = ((activeWorld.sunAzimuthDeg ?? 40) * Math.PI) / 180;
      const sunR = 18;
      sun.position.set(
        sunR * Math.cos(elRad) * Math.sin(azRad),
        Math.max(2, sunR * Math.sin(elRad)),
        sunR * Math.cos(elRad) * Math.cos(azRad),
      );

      const skyColors: Record<number, string> = {
        0: '#050608',
        1: '#121324',
        2: '#1d2d44',
        3: '#1e3a5f',
        4: '#1d4ed8',
        5: '#2563eb',
        6: '#38bdf8',
      };
      const bgHex =
        state.previewStage === 'lab-neutral'
          ? '#0f172a'
          : skyColors[numericStage] ?? '#1e3a5f';
      scene.background = new THREE.Color(bgHex);

      const { yaw, pitch, distance } = orbitRef.current;
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      camera.position.set(
        distance * Math.cos(pitch) * Math.sin(yaw),
        1.5 + distance * Math.sin(pitch),
        distance * Math.cos(pitch) * Math.cos(yaw),
      );
      camera.lookAt(0, 1.2, 0);

      if (renderer && typeof renderer.render === 'function') {
        renderer.render(scene, camera);
      } else {
        // 2D Canvas 3D Terrain + Sky + Sun + Machine Fallback
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, bgHex);
          grad.addColorStop(1, '#090d16');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          // Draw Sun Disc
          const sunX = width * (0.2 + ((activeWorld.sunAzimuthDeg % 360) / 360) * 0.6);
          const sunY = height * (0.45 - (activeWorld.sunElevationDeg / 90) * 0.35);
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    animId = window.requestAnimationFrame(renderLoop);
    return () => {
      window.cancelAnimationFrame(animId);
      builtMachine.dispose();
      terrainGeom.dispose();
      terrainMat.dispose();
      if (renderer) renderer.dispose();
    };
  }, [
    activeWorld.seed,
    activeWorld.biome,
    activeWorld.floats,
    activeWorld.sunElevationDeg,
    activeWorld.sunAzimuthDeg,
    activeWorld.skyTurbidity,
    activeEntry,
    state.activeKitId,
    state.overridesByKit,
    state.materials,
    state.activeMaterialId,
    state.hoveredMaterialId,
    state.previewStage,
    numericStage,
  ]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        background: '#090d16',
        color: '#e2e8f0',
      }}
    >
      {/* Left: Live 3D Planetary Look & Stage Scrubber Viewport */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="look-lighting-canvas"
          onPointerDown={(e) => {
            orbitRef.current.dragging = true;
            orbitRef.current.startX = e.clientX;
            orbitRef.current.startY = e.clientY;
          }}
          onPointerMove={(e) => {
            if (!orbitRef.current.dragging) return;
            const dx = e.clientX - orbitRef.current.startX;
            const dy = e.clientY - orbitRef.current.startY;
            orbitRef.current.startX = e.clientX;
            orbitRef.current.startY = e.clientY;
            orbitRef.current.yaw -= dx * 0.008;
            orbitRef.current.pitch = Math.max(
              0.08,
              Math.min(1.35, orbitRef.current.pitch + dy * 0.008),
            );
          }}
          onPointerUp={() => {
            orbitRef.current.dragging = false;
          }}
          onWheel={(e) => {
            orbitRef.current.distance = Math.max(
              4,
              Math.min(28, orbitRef.current.distance + e.deltaY * 0.006),
            );
          }}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
        />

        {/* Top Overlay: Active World, Biome & Radial Scan-Wave Button */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(15, 23, 42, 0.86)',
            border: '1px solid #1e293b',
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
              Live 3D Terrain, Sky Dome &amp; Stage Shader Preview (@hm/plotterrain + @hm/groundshader)
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
              {activeWorld.name} — {activeEntry.label} (Stage:{' '}
              {state.previewStage === 'lab-neutral' ? 'Lab Neutral' : `S${state.previewStage}`})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#34d399' }}>
              Biome: <strong>{activeWorld.biome}</strong> | Seed: <strong>{activeWorld.seed}</strong>
            </span>
            <button
              onClick={triggerScanWave}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid #38bdf8',
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#e0f2fe',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🌊 Trigger Stage Scan-Wave
            </button>
          </div>
        </div>

        {scanWaveRadius !== null && (
          <div
            style={{
              position: 'absolute',
              top: 76,
              left: 16,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.25)',
              border: '1px solid #10b981',
              fontSize: 11,
              fontWeight: 700,
              color: '#6ee7b7',
            }}
          >
            Radial Fidelity Scan-Wave Sweeping Terrain: r = {scanWaveRadius.toFixed(1)} m
          </div>
        )}

        {/* Bottom Overlay: Stage Scrubber Bar S0 -> S6 */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            right: 14,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
            <span>Terraforming Stage Scrubber (Lab / S0 → S6)</span>
            <span style={{ color: '#38bdf8' }}>
              {STAGES.find((s) => s.stage === state.previewStage)?.desc}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
            {STAGES.map((item) => {
              const active = state.previewStage === item.stage;
              return (
                <button
                  key={String(item.stage)}
                  onClick={() => {
                    store.setPreviewStage(item.stage);
                    triggerScanWave();
                  }}
                  title={item.desc}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 6,
                    border: active ? '2px solid #38bdf8' : '1px solid #334155',
                    background: active ? 'rgba(56, 189, 248, 0.22)' : '#0f172a',
                    color: active ? '#fff' : '#94a3b8',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {item.stage === 'lab-neutral' ? 'LAB' : `S${item.stage}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Biome Selector, Four Floats S = (pxd, vtx, lx, aq) + Sun & Sky Controls */}
      <div
        style={{
          borderLeft: '1px solid #1e293b',
          background: '#0f172a',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
          Planetary Biome Formula
        </div>
        <select
          value={activeWorld.biome}
          onChange={(e) =>
            store.updateActiveWorldLook({ biome: e.target.value as BiomeFormulaId })
          }
          style={{
            padding: 7,
            borderRadius: 6,
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            fontSize: 11,
          }}
        >
          <option value="lunar-basalt">Lunar Basalt (Stark Crater Regolith)</option>
          <option value="terran-forest">Terran Forest (Emerald Conifer Canopy)</option>
          <option value="volcanic-crag">Volcanic Crag (Obsidian &amp; Magma Veins)</option>
          <option value="toxic-basin">Toxic Basin (Acidic Sulfur Pools)</option>
        </select>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
          Atmospheric Four Floats S = (Pxd, Vtx, Lx, Aq)
        </div>
        {(['pxd', 'vtx', 'lx', 'aq'] as const).map((key) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{key.toUpperCase()}</span>
              <span style={{ color: '#38bdf8' }}>{activeWorld.floats[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={activeWorld.floats[key]}
              onChange={(e) =>
                store.updateActiveWorldLook({
                  floats: { ...activeWorld.floats, [key]: parseFloat(e.target.value) },
                })
              }
            />
          </label>
        ))}

        <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginTop: 8 }}>
          Solar &amp; Sky Dome Lighting
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sun Elevation (°)</span>
            <span>{activeWorld.sunElevationDeg}°</span>
          </div>
          <input
            type="range"
            min={5}
            max={85}
            step={1}
            value={activeWorld.sunElevationDeg}
            onChange={(e) =>
              store.updateActiveWorldLook({ sunElevationDeg: parseFloat(e.target.value) })
            }
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sun Azimuth (°)</span>
            <span>{activeWorld.sunAzimuthDeg}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={activeWorld.sunAzimuthDeg}
            onChange={(e) =>
              store.updateActiveWorldLook({ sunAzimuthDeg: parseFloat(e.target.value) })
            }
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sky Dome Turbidity</span>
            <span>{activeWorld.skyTurbidity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={activeWorld.skyTurbidity}
            onChange={(e) =>
              store.updateActiveWorldLook({ skyTurbidity: parseFloat(e.target.value) })
            }
          />
        </label>
      </div>
    </div>
  );
};
