/**
 * @file apps/web/src/studio/scene-tab.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Phase 3 & Aspects 5, 6, 8, 11):
 * Interactive 3D Planetary Outpost Staging Viewport, Terrain Sculpting Brushes,
 * Drag-on-Terrain Machine Placement, Stargate Ring & Game Loop Rules Configurator.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createTerrain } from '@hm/plotterrain';
import { STUDIO_KIT_LIST, STUDIO_KIT_REGISTRY } from './kits/studio-kit-registry';
import { buildStudioMachineModel, type BuiltStudioMachineModel } from './viewport/build-studio-machine-model';
import type { StargateAccessMode } from './state/spore-card-codec';
import type { StudioState, StudioStore } from './state/studio-store';

export interface SceneTabProps {
  state: StudioState;
  store: StudioStore;
}

export type TerrainBrushTool =
  | 'select-move'
  | 'place-kit'
  | 'raise'
  | 'lower'
  | 'flatten'
  | 'smooth';

export type GameLoopMode =
  | 'sandbox-exploration'
  | 'circuit-rally'
  | 'survival-defense'
  | 'eco-terraforming';

export const SceneTab: React.FC<SceneTabProps> = ({ state, store }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [kitToSpawn, setKitToSpawn] = useState<string>(STUDIO_KIT_LIST[0]!.id);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    state.worlds[state.activeWorldId]?.placements[0]?.instanceId ?? null,
  );
  const [activeTool, setActiveTool] = useState<TerrainBrushTool>('select-move');
  const [brushRadius, setBrushRadius] = useState<number>(6.0);
  const [brushStrength, setBrushStrength] = useState<number>(0.45);
  const [showColliders, setShowColliders] = useState<boolean>(false);
  const [scatteredPropCount, setScatteredPropCount] = useState<number>(12);
  const [gameMode, setGameMode] = useState<GameLoopMode>('eco-terraforming');
  const [aggression, setAggression] = useState<'off' | 'calm' | 'normal' | 'hard'>('normal');
  const [targetScore, setTargetScore] = useState<number>(85);

  // User-sculpted height delta map on the 40x40 terrain grid
  const sculptDeltasRef = useRef<Float32Array>(new Float32Array(41 * 41));
  const [sculptRevision, setSculptRevision] = useState<number>(0);

  const orbitRef = useRef({
    yaw: 0.45,
    pitch: 0.65,
    distance: 26,
    target: [0, 0, 0] as [number, number, number],
    dragging: false,
    panning: false,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const activeWorld = state.worlds[state.activeWorldId]!;
  const terrainRef = useRef<THREE.Mesh | null>(null);
  const machineGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const sampleWorldHeight = (wx: number, wz: number): number => {
    const baseTerrain = createTerrain({ seed: activeWorld.seed });
    const gridN = 40;
    const span = 64;
    const gx = Math.max(0, Math.min(gridN, Math.round(((wx / span) + 0.5) * gridN)));
    const gz = Math.max(0, Math.min(gridN, Math.round(((wz / span) + 0.5) * gridN)));
    const delta = sculptDeltasRef.current[gz * (gridN + 1) + gx] ?? 0;
    const distFromGate = Math.hypot(wx, wz + 6);
    const padBlend = Math.max(0, Math.min(1, (distFromGate - 5.0) / 6.0));
    return baseTerrain.height(wx * 1.5, wz * 1.5) * 0.35 * padBlend + delta;
  };

  // Build & render the 3D Planetary Outpost Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090f1d');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.2, 500);
    cameraRef.current = camera;

    const gridN = 40;
    const span = 64;
    const positions = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const normals = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const colors = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const indices: number[] = [];

    for (let iz = 0; iz <= gridN; iz++) {
      for (let ix = 0; ix <= gridN; ix++) {
        const vIdx = iz * (gridN + 1) + ix;
        const wx = ((ix / gridN) - 0.5) * span;
        const wz = ((iz / gridN) - 0.5) * span;
        const wy = sampleWorldHeight(wx, wz);

        positions[vIdx * 3] = wx;
        positions[vIdx * 3 + 1] = wy;
        positions[vIdx * 3 + 2] = wz;
        normals[vIdx * 3] = 0;
        normals[vIdx * 3 + 1] = 1;
        normals[vIdx * 3 + 2] = 0;

        const isSafeDome = Math.hypot(wx, wz + 6) <= 15.0;
        colors[vIdx * 3] = isSafeDome ? 0.28 : 0.22;
        colors[vIdx * 3 + 1] = isSafeDome ? 0.36 : 0.26;
        colors[vIdx * 3 + 2] = isSafeDome ? 0.44 : 0.32;
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

    const tGeom = new THREE.BufferGeometry();
    tGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    tGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tGeom.setIndex(indices);
    tGeom.computeVertexNormals();

    const tMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.85,
      metalness: 0.1,
    });
    (tMat as unknown as { vertexColors: boolean }).vertexColors = true;
    const tMesh = new THREE.Mesh(tGeom, tMat);
    tMesh.name = 'planetary-terrain';
    tMesh.receiveShadow = true;
    terrainRef.current = tMesh;
    scene.add(tMesh);

    // Grid overlay & 15m Twin Gate Coherence Safe Dome Ring (DEC-03 / DEC-06)
    const gridHelper = new THREE.GridHelper(span, 32, 0x38bdf8, 0x1e293b);
    gridHelper.position.set(0, 0.02, 0);
    scene.add(gridHelper);

    const domeRingGeom = new THREE.RingGeometry(14.7, 15.0, 48);
    domeRingGeom.rotateX(-Math.PI / 2);
    const domeRingMat = new THREE.MeshBasicMaterial({ color: '#ffc13d' });
    const domeRing = new THREE.Mesh(domeRingGeom, domeRingMat);
    domeRing.position.set(0, 0.05, -6);
    scene.add(domeRing);

    // Scattered Biome Props (Boulders & Conifers)
    for (let i = 0; i < scatteredPropCount; i++) {
      const angle = (i / Math.max(1, scatteredPropCount)) * Math.PI * 2 + 0.3;
      const rad = 16 + (i % 3) * 5;
      const px = Math.cos(angle) * rad;
      const pz = Math.sin(angle) * rad;
      const py = sampleWorldHeight(px, pz);
      const propGeom =
        i % 2 === 0
          ? new THREE.ConeGeometry(0.85, 2.4, 7)
          : new THREE.SphereGeometry(0.75);
      const propMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? '#15803d' : '#64748b',
        roughness: 0.85,
      });
      const propMesh = new THREE.Mesh(propGeom, propMat);
      propMesh.position.set(px, py + (i % 2 === 0 ? 1.2 : 0.4), pz);
      scene.add(propMesh);
    }

    // Instantiate real 3D modular models for every placed machine in activeWorld.placements!
    const builtDisposers: BuiltStudioMachineModel[] = [];
    machineGroupsRef.current.clear();

    for (const pl of activeWorld.placements) {
      const regEntry =
        STUDIO_KIT_REGISTRY[pl.kitId] ?? STUDIO_KIT_REGISTRY['kit:texture-mill']!;
      const built = buildStudioMachineModel({
        kit: regEntry.kit,
        presetId: regEntry.rootPreset,
        rank: 1,
        materials: state.materials,
        showSockets: false,
        showColliders: showColliders || pl.instanceId === selectedInstanceId,
      });
      builtDisposers.push(built);

      const terrainY = pl.grounded
        ? sampleWorldHeight(pl.position[0], pl.position[2])
        : pl.position[1];
      built.group.position.set(pl.position[0], terrainY, pl.position[2]);
      built.group.rotation.set(0, (pl.rotationYDeg * Math.PI) / 180, 0);
      built.group.userData = {
        ...built.group.userData,
        instanceId: pl.instanceId,
        kitId: pl.kitId,
        label: pl.label,
      };
      scene.add(built.group);
      machineGroupsRef.current.set(pl.instanceId, built.group);
    }

    // Lighting
    const hemi = new THREE.HemisphereLight('#93c5fd', '#1e293b', 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fffbeb', 1.75);
    sun.position.set(16, 24, 14);
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

      const { yaw, pitch, distance, target } = orbitRef.current;
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      camera.position.set(
        target[0] + distance * Math.cos(pitch) * Math.sin(yaw),
        target[1] + distance * Math.sin(pitch),
        target[2] + distance * Math.cos(pitch) * Math.cos(yaw),
      );
      camera.lookAt(target[0], target[1], target[2]);

      if (renderer && typeof renderer.render === 'function') {
        renderer.render(scene, camera);
      } else {
        // 2D Top-Down / Isometric Outpost Radar Fallback
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#090f1d';
          ctx.fillRect(0, 0, width, height);
          const cx = width * 0.5;
          const cy = height * 0.5;
          const scale = Math.min(width, height) / 42;

          // Safe Dome Ring
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy - 6 * scale, 15 * scale, 0, Math.PI * 2);
          ctx.stroke();

          // Placed Machines
          for (const pl of activeWorld.placements) {
            const mx = cx + pl.position[0] * scale;
            const mz = cy + pl.position[2] * scale;
            const isSel = pl.instanceId === selectedInstanceId;
            ctx.fillStyle = isSel ? '#38bdf8' : '#10b981';
            ctx.fillRect(mx - 8, mz - 8, 16, 16);
            ctx.fillStyle = '#f8fafc';
            ctx.font = '10px sans-serif';
            ctx.fillText(pl.label, mx + 10, mz + 4);
          }
        }
      }
    };

    animId = window.requestAnimationFrame(renderLoop);
    return () => {
      window.cancelAnimationFrame(animId);
      for (const b of builtDisposers) b.dispose();
      tGeom.dispose();
      tMat.dispose();
      if (renderer) renderer.dispose();
    };
  }, [
    activeWorld,
    state.materials,
    selectedInstanceId,
    showColliders,
    scatteredPropCount,
    sculptRevision,
  ]);

  // Apply terrain sculpting brush at world (wx, wz)
  const applyTerrainBrushAt = (wx: number, wz: number) => {
    const gridN = 40;
    const span = 64;
    const next = new Float32Array(sculptDeltasRef.current);
    for (let iz = 0; iz <= gridN; iz++) {
      for (let ix = 0; ix <= gridN; ix++) {
        const vx = ((ix / gridN) - 0.5) * span;
        const vz = ((iz / gridN) - 0.5) * span;
        const dist = Math.hypot(vx - wx, vz - wz);
        if (dist > brushRadius) continue;
        const falloff = Math.cos((dist / brushRadius) * (Math.PI / 2));
        const idx = iz * (gridN + 1) + ix;
        const cur = next[idx] ?? 0;
        if (activeTool === 'raise') {
          next[idx] = cur + brushStrength * 0.35 * falloff;
        } else if (activeTool === 'lower') {
          next[idx] = cur - brushStrength * 0.35 * falloff;
        } else if (activeTool === 'flatten') {
          next[idx] = cur * (1 - 0.5 * falloff);
        } else if (activeTool === 'smooth') {
          next[idx] = cur * (1 - 0.25 * falloff);
        }
      }
    }
    sculptDeltasRef.current = next;
    setSculptRevision((r) => r + 1);
  };

  // Raycast click on 3D scene to select/move machine, place kit, or sculpt terrain
  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = orbitRef.current.moved;
    orbitRef.current.dragging = false;
    orbitRef.current.panning = false;
    if (wasMoved || e.button !== 0) return;

    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera) return;

    const rect = canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    if (activeTool === 'select-move') {
      for (const [instId, grp] of machineGroupsRef.current.entries()) {
        const hits = raycaster.intersectObjects(grp.children, false);
        if (hits.length > 0) {
          setSelectedInstanceId(instId);
          return;
        }
      }
    }

    if (terrainRef.current) {
      const tHits = raycaster.intersectObject(terrainRef.current, false);
      const hitPt = tHits[0]?.point;
      if (hitPt) {
        if (activeTool === 'place-kit') {
          store.placeKitInActiveWorld(kitToSpawn, [
            Number(hitPt.x.toFixed(2)),
            0,
            Number(hitPt.z.toFixed(2)),
          ]);
        } else if (
          activeTool === 'raise' ||
          activeTool === 'lower' ||
          activeTool === 'flatten' ||
          activeTool === 'smooth'
        ) {
          applyTerrainBrushAt(hitPt.x, hitPt.z);
        } else if (activeTool === 'select-move' && selectedInstanceId) {
          store.moveWorldPlacement(selectedInstanceId, [
            Number(hitPt.x.toFixed(2)),
            0,
            Number(hitPt.z.toFixed(2)),
          ]);
        }
      }
    }
  };

  const selectedPlacement =
    activeWorld.placements.find((p) => p.instanceId === selectedInstanceId) ??
    activeWorld.placements[0];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 390px',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        background: '#090d16',
        color: '#e2e8f0',
      }}
    >
      {/* Left: Interactive 3D Planetary Outpost Viewport */}
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
          data-testid="scene-layout-canvas"
          onPointerDown={(e) => {
            orbitRef.current.dragging = true;
            orbitRef.current.panning = e.button === 2 || e.shiftKey;
            orbitRef.current.startX = e.clientX;
            orbitRef.current.startY = e.clientY;
            orbitRef.current.moved = false;
          }}
          onPointerMove={(e) => {
            if (!orbitRef.current.dragging) return;
            const dx = e.clientX - orbitRef.current.startX;
            const dy = e.clientY - orbitRef.current.startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) orbitRef.current.moved = true;
            orbitRef.current.startX = e.clientX;
            orbitRef.current.startY = e.clientY;
            if (orbitRef.current.panning) {
              orbitRef.current.target[0] -= dx * 0.03;
              orbitRef.current.target[2] -= dy * 0.03;
            } else {
              orbitRef.current.yaw -= dx * 0.008;
              orbitRef.current.pitch = Math.max(
                0.15,
                Math.min(1.48, orbitRef.current.pitch + dy * 0.008),
              );
            }
          }}
          onPointerUp={handleCanvasPointerUp}
          onWheel={(e) => {
            orbitRef.current.distance = Math.max(
              6,
              Math.min(65, orbitRef.current.distance + e.deltaY * 0.015),
            );
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        />

        {/* Top Bar: Outpost Status & Terrain Sculpting Brush Bar (Aspect 6) */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(13, 19, 31, 0.9)',
            border: '1px solid #1e293b',
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
              3D Planetary Outpost Staging &amp; Terrain Sculptor (0 Legacy .glb Files)
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
              {activeWorld.name} — {activeWorld.placements.length} Modular Machines | Dial:{' '}
              <span style={{ color: '#fbbf24' }}>{activeWorld.stargateAddress}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(
              [
                { id: 'select-move', label: '🖱 Select / Move' },
                { id: 'place-kit', label: '📍 Click-to-Place Kit' },
                { id: 'raise', label: '⛰ Raise Terrain' },
                { id: 'lower', label: '🕳 Lower Terrain' },
                { id: 'flatten', label: '📐 Flatten Pad' },
                { id: 'smooth', label: '🌊 Smooth' },
              ] as Array<{ id: TerrainBrushTool; label: string }>
            ).map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveTool(b.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 5,
                  fontSize: 10,
                  fontWeight: activeTool === b.id ? 700 : 500,
                  border: activeTool === b.id ? '1px solid #38bdf8' : '1px solid #334155',
                  background: activeTool === b.id ? '#0284c7' : '#0f172a',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {b.label}
              </button>
            ))}

            <button
              onClick={() => setShowColliders((c) => !c)}
              style={{
                padding: '4px 8px',
                borderRadius: 5,
                fontSize: 10,
                border: showColliders ? '1px solid #10b981' : '1px solid #334155',
                background: showColliders ? 'rgba(16, 185, 129, 0.2)' : '#0f172a',
                color: showColliders ? '#6ee7b7' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Colliders: {showColliders ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Bottom Overlay: Sculpt Brush Sliders & Camera Top-Down / Iso Toggle */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(13, 19, 31, 0.9)',
            border: '1px solid #1e293b',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Brush Radius: {brushRadius}m</span>
              <input
                type="range"
                min={2}
                max={18}
                step={0.5}
                value={brushRadius}
                onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Strength: {Math.round(brushStrength * 100)}%</span>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={brushStrength}
                onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
              />
            </label>
            <button
              onClick={() => setScatteredPropCount((n) => n + 6)}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: '1px solid #10b981',
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#6ee7b7',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🌲 + Scatter Biome Props ({scatteredPropCount})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                orbitRef.current.pitch = 1.45;
                orbitRef.current.distance = 34;
              }}
              style={{ padding: '4px 8px', borderRadius: 4, background: '#162032', color: '#cbd5e1', border: '1px solid #334155', fontSize: 10, cursor: 'pointer' }}
            >
              Top-Down Map
            </button>
            <button
              onClick={() => {
                orbitRef.current.yaw = 0.45;
                orbitRef.current.pitch = 0.55;
                orbitRef.current.distance = 24;
              }}
              style={{ padding: '4px 8px', borderRadius: 4, background: '#162032', color: '#cbd5e1', border: '1px solid #334155', fontSize: 10, cursor: 'pointer' }}
            >
              3D Iso View
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Outpost Machine Inspector, Kit Spawner, Game Mode & Stargate Access */}
      <div
        style={{
          borderLeft: '1px solid #1e293b',
          background: '#0f172a',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
        }}
      >
        {/* Spawn / Place Modular Kit */}
        <div
          style={{
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
            Place Modular Kit on Planet Terrain
          </div>
          <select
            value={kitToSpawn}
            onChange={(e) => setKitToSpawn(e.target.value)}
            style={{
              padding: 7,
              borderRadius: 6,
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
              fontSize: 11,
            }}
          >
            {STUDIO_KIT_LIST.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} ({k.id})
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                const angle = activeWorld.placements.length * 1.1;
                const rad = 6.5;
                store.placeKitInActiveWorld(
                  kitToSpawn,
                  [
                    Number((Math.cos(angle) * rad).toFixed(1)),
                    0,
                    Number((Math.sin(angle) * rad).toFixed(1)),
                  ],
                  0,
                );
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 6,
                border: 'none',
                background: '#0284c7',
                color: '#fff',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              + Spawn on Pad
            </button>
            <button
              onClick={() => store.autoGroundWorldPlacements()}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.14)',
                color: '#fbbf24',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ⚡ Auto-Ground All
            </button>
          </div>
        </div>

        {/* Selected Machine 3D Transform Sliders */}
        {selectedPlacement && (
          <div
            style={{
              background: '#111827',
              border: '1px solid #38bdf8',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
                Selected: {selectedPlacement.label}
              </span>
              <button
                onClick={() => {
                  store.selectKit(selectedPlacement.kitId);
                  store.setActiveWorkspace('creative-suite');
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: '1px solid #38bdf8',
                  background: 'rgba(56, 189, 248, 0.16)',
                  color: '#e0f2fe',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                Dive Into Kit (R4) →
              </button>
            </div>

            <label style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Position X: {selectedPlacement.position[0].toFixed(1)} m</span>
              <input
                type="range"
                min={-24}
                max={24}
                step={0.5}
                value={selectedPlacement.position[0]}
                onChange={(e) =>
                  store.moveWorldPlacement(
                    selectedPlacement.instanceId,
                    [
                      parseFloat(e.target.value),
                      selectedPlacement.position[1],
                      selectedPlacement.position[2],
                    ],
                    selectedPlacement.rotationYDeg,
                  )
                }
              />
            </label>

            <label style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Position Z: {selectedPlacement.position[2].toFixed(1)} m</span>
              <input
                type="range"
                min={-24}
                max={24}
                step={0.5}
                value={selectedPlacement.position[2]}
                onChange={(e) =>
                  store.moveWorldPlacement(
                    selectedPlacement.instanceId,
                    [
                      selectedPlacement.position[0],
                      selectedPlacement.position[1],
                      parseFloat(e.target.value),
                    ],
                    selectedPlacement.rotationYDeg,
                  )
                }
              />
            </label>

            <label style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Yaw Rotation: {selectedPlacement.rotationYDeg}°</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={15}
                value={selectedPlacement.rotationYDeg}
                onChange={(e) =>
                  store.moveWorldPlacement(
                    selectedPlacement.instanceId,
                    selectedPlacement.position,
                    parseFloat(e.target.value),
                  )
                }
              />
            </label>
          </div>
        )}

        {/* Placed Machines Outliner List */}
        <div
          style={{
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 10,
            maxHeight: 190,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
            Outpost Machine Hierarchy ({activeWorld.placements.length})
          </div>
          {activeWorld.placements.map((m) => {
            const isSel = m.instanceId === selectedPlacement?.instanceId;
            return (
              <div
                key={m.instanceId}
                onClick={() => setSelectedInstanceId(m.instanceId)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '5px 8px',
                  borderRadius: 5,
                  background: isSel ? 'rgba(56, 189, 248, 0.18)' : '#162032',
                  border: isSel ? '1px solid #38bdf8' : '1px solid #243046',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <div>
                  <strong>{m.label}</strong>{' '}
                  <span style={{ fontSize: 9, color: '#94a3b8' }}>
                    [{m.position[0].toFixed(1)}, {m.position[2].toFixed(1)}]
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    store.removeWorldPlacement(m.instanceId);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Aspect 11: Game Loop & Objectives Configurator */}
        <div
          style={{
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
            Game Loop Mode &amp; World Rules (@hm/worldrules)
          </div>
          <select
            value={gameMode}
            onChange={(e) => setGameMode(e.target.value as GameLoopMode)}
            style={{
              padding: 6,
              borderRadius: 5,
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
              fontSize: 11,
            }}
          >
            <option value="eco-terraforming">Eco Terraforming (Reach Stage S6)</option>
            <option value="sandbox-exploration">Sandbox Exploration (Unlimited Resources)</option>
            <option value="survival-defense">Survival Defense (Containment Leak Waves)</option>
            <option value="circuit-rally">Rover Circuit Rally (Checkpoint Time Trial)</option>
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
            <label>
              Leak Aggression
              <select
                value={aggression}
                onChange={(e) =>
                  setAggression(e.target.value as 'off' | 'calm' | 'normal' | 'hard')
                }
                style={{ width: '100%', padding: 4, marginTop: 3, background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4 }}
              >
                <option value="off">Off (Peaceful)</option>
                <option value="calm">Calm</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label>
              Target Fidelity ({targetScore}%)
              <input
                type="range"
                min={25}
                max={100}
                step={5}
                value={targetScore}
                onChange={(e) => setTargetScore(parseInt(e.target.value, 10))}
                style={{ width: '100%', marginTop: 6 }}
              />
            </label>
          </div>
        </div>

        {/* Network Stargate Access Mode */}
        <div
          style={{
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
            Network Stargate Access (@hm/coopnet)
          </div>
          {(['open', 'code-only', 'closed'] as StargateAccessMode[]).map((mode) => (
            <label
              key={mode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                checked={activeWorld.stargateAccess === mode}
                onChange={() => store.updateActiveWorldLook({ stargateAccess: mode })}
              />
              <span>
                <strong>{mode.toUpperCase()}</strong>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
