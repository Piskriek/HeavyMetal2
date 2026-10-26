/**
 * @file apps/web/src/studio/modals/test-play-overlay.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Screen 10, Phase 5 & Aspects 11–12):
 * Mounts a live 3D Sandbox Playtest WebGL Scene behind the HUD with controllable
 * AstroScientist avatar (WASD + Mouse Look), drivable Modular Scout Rover,
 * placed outpost machines, Camera FOV / Shake / Reticle controls, and a firing
 * 3D Beam Rifle laser (`EXTRACT`, `APPLY`, `SCULPT`, `SEAL`)!
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createTerrain } from '@hm/plotterrain';
import { STUDIO_KIT_REGISTRY } from '../kits/studio-kit-registry';
import { buildStudioMachineModel, type BuiltStudioMachineModel } from '../viewport/build-studio-machine-model';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface TestPlayOverlayProps {
  state: StudioState;
  store: StudioStore;
}

export type ReticleStyle = 'crosshair' | 'dot' | 'holo-circle' | 'off';

export const TestPlayOverlay: React.FC<TestPlayOverlayProps> = ({ state, store }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraFov, setCameraFov] = useState<number>(70);
  const [cameraShake, setCameraShake] = useState<number>(35);
  const [reticleStyle, setReticleStyle] = useState<ReticleStyle>('holo-circle');
  const [firingBeam, setFiringBeam] = useState<boolean>(false);
  const [playerPos, setPlayerPos] = useState<[number, number, number]>([0, 0, 5.5]);
  const [beamFeedback, setBeamFeedback] = useState<string>(
    'WASD to move | Drag mouse to aim | Hold Left-Click to fire Beam Rifle | Esc to exit',
  );

  const playerStateRef = useRef({
    x: 0,
    y: 0,
    z: 5.5,
    yaw: 0,
    pitch: 0.18,
    keys: new Set<string>(),
    firing: false,
  });

  useEffect(() => {
    if (!state.testPlayActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        store.exitTestPlaySandbox();
        return;
      }
      playerStateRef.current.keys.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      playerStateRef.current.keys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [state.testPlayActive, store]);

  const activeWorld = state.worlds[state.activeWorldId]!;

  // Mount live 3D Playtest Scene when testPlayActive is true
  useEffect(() => {
    if (!state.testPlayActive) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#091326');
    const camera = new THREE.PerspectiveCamera(cameraFov, 1, 0.1, 400);

    // Terrain
    const terrain = createTerrain({ seed: activeWorld.seed });
    const gridN = 32;
    const span = 56;
    const positions = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const normals = new Float32Array((gridN + 1) * (gridN + 1) * 3);
    const indices: number[] = [];

    for (let iz = 0; iz <= gridN; iz++) {
      for (let ix = 0; ix <= gridN; ix++) {
        const vIdx = iz * (gridN + 1) + ix;
        const wx = ((ix / gridN) - 0.5) * span;
        const wz = ((iz / gridN) - 0.5) * span;
        const wy = Math.hypot(wx, wz) < 8 ? 0 : terrain.height(wx, wz) * 0.25;
        positions[vIdx * 3] = wx;
        positions[vIdx * 3 + 1] = wy;
        positions[vIdx * 3 + 2] = wz;
        normals[vIdx * 3] = 0;
        normals[vIdx * 3 + 1] = 1;
        normals[vIdx * 3 + 2] = 0;
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
    tGeom.setIndex(indices);
    tGeom.computeVertexNormals();
    const tMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.85 });
    const tMesh = new THREE.Mesh(tGeom, tMat);
    scene.add(tMesh);

    const grid = new THREE.GridHelper(span, 28, 0x10b981, 0x1e293b);
    grid.position.set(0, 0.02, 0);
    scene.add(grid);

    // Instantiate all placed modular machines on the planet
    const builtModels: BuiltStudioMachineModel[] = [];
    for (const pl of activeWorld.placements) {
      const reg = STUDIO_KIT_REGISTRY[pl.kitId] ?? STUDIO_KIT_REGISTRY['kit:texture-mill']!;
      const built = buildStudioMachineModel({
        kit: reg.kit,
        presetId: reg.rootPreset,
        rank: 1,
        materials: state.materials,
      });
      built.group.position.set(pl.position[0], pl.position[1], pl.position[2]);
      built.group.rotation.set(0, (pl.rotationYDeg * Math.PI) / 180, 0);
      scene.add(built.group);
      builtModels.push(built);
    }

    // Player Avatar (AstroScientist + Visor + Beam Rifle)
    const avatarGroup = new THREE.Group();
    const suitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.36, 1.45, 12),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.4, metalness: 0.2 }),
    );
    suitMesh.position.set(0, 0.725, 0);
    avatarGroup.add(suitMesh);

    const visorMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.26),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.6,
        roughness: 0.2,
      }),
    );
    visorMesh.position.set(0, 1.58, 0);
    avatarGroup.add(visorMesh);

    // 3D Beam Laser Cylinder (visible when firing)
    const beamColorMap: Record<typeof state.testPlayBeamMode, string> = {
      extract: '#3dc8ff',
      apply: '#ff3d8a',
      sculpt: '#7cff4d',
      seal: '#ffc13d',
    };
    const beamMat = new THREE.MeshBasicMaterial({
      color: beamColorMap[state.testPlayBeamMode],
    });
    const beamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 6.0, 8),
      beamMat,
    );
    beamMesh.position.set(0.35, 1.15, -3.2);
    beamMesh.visible = false;
    avatarGroup.add(beamMesh);
    scene.add(avatarGroup);

    // Lighting
    scene.add(new THREE.HemisphereLight('#93c5fd', '#1e293b', 0.95));
    const sun = new THREE.DirectionalLight('#fffbeb', 1.7);
    sun.position.set(12, 20, 10);
    scene.add(sun);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      renderer = null;
    }

    let animId = 0;
    const tick = () => {
      animId = window.requestAnimationFrame(tick);
      const rect = container.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(240, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        if (renderer) renderer.setSize(width, height, false);
      }

      const ps = playerStateRef.current;
      const speed = state.testPlayRoverSpawned ? 0.18 : 0.09;
      const forwardX = -Math.sin(ps.yaw);
      const forwardZ = -Math.cos(ps.yaw);
      const rightX = Math.cos(ps.yaw);
      const rightZ = -Math.sin(ps.yaw);

      if (ps.keys.has('w') || ps.keys.has('arrowup')) {
        ps.x += forwardX * speed;
        ps.z += forwardZ * speed;
      }
      if (ps.keys.has('s') || ps.keys.has('arrowdown')) {
        ps.x -= forwardX * speed;
        ps.z -= forwardZ * speed;
      }
      if (ps.keys.has('a') || ps.keys.has('arrowleft')) {
        ps.x -= rightX * speed;
        ps.z -= rightZ * speed;
      }
      if (ps.keys.has('d') || ps.keys.has('arrowright')) {
        ps.x += rightX * speed;
        ps.z += rightZ * speed;
      }

      avatarGroup.position.set(ps.x, ps.y, ps.z);
      avatarGroup.rotation.set(0, ps.yaw, 0);
      beamMesh.visible = ps.firing;
      beamMat.color.set(beamColorMap[state.testPlayBeamMode]);

      // Third-person spring-arm camera with optional micro-shake when firing
      const shakeOffset =
        ps.firing && cameraShake > 0
          ? (Math.sin(Date.now() * 0.08) * (cameraShake / 100) * 0.06)
          : 0;
      camera.fov = cameraFov;
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      const camDist = state.testPlayRoverSpawned ? 6.5 : 4.2;
      camera.position.set(
        ps.x - forwardX * camDist + shakeOffset,
        ps.y + 2.2 + Math.sin(ps.pitch) * 2.0 + shakeOffset,
        ps.z - forwardZ * camDist,
      );
      camera.lookAt(ps.x + forwardX * 4, ps.y + 1.2, ps.z + forwardZ * 4);

      if (renderer && typeof renderer.render === 'function') {
        renderer.render(scene, camera);
      } else {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#091326';
          ctx.fillRect(0, 0, width, height);
          if (ps.firing) {
            ctx.strokeStyle = beamColorMap[state.testPlayBeamMode];
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(width * 0.58, height * 0.85);
            ctx.lineTo(width * 0.5, height * 0.5);
            ctx.stroke();
          }
        }
      }
    };

    animId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animId);
      for (const b of builtModels) b.dispose();
      tGeom.dispose();
      tMat.dispose();
      if (renderer) renderer.dispose();
    };
  }, [
    state.testPlayActive,
    state.testPlayBeamMode,
    state.testPlayRoverSpawned,
    state.materials,
    activeWorld,
    cameraFov,
    cameraShake,
  ]);

  if (!state.testPlayActive) return null;

  const handleFireDown = () => {
    playerStateRef.current.firing = true;
    setFiringBeam(true);
    const ps = playerStateRef.current;
    setPlayerPos([
      Number(ps.x.toFixed(1)),
      Number(ps.y.toFixed(1)),
      Number(ps.z.toFixed(1)),
    ]);
    if (state.testPlayBeamMode === 'apply') {
      const slot = store.getMaterialSlotsForActiveKit()[0]?.slotName ?? 'body';
      store.assignSlotMaterial(slot, state.activeMaterialId, 'kit-slot');
      setBeamFeedback(
        `⚡ Beam [APPLY]: Imprinted ${state.activeMaterialId} onto ${state.activeKitId} (${slot})!`,
      );
    } else if (state.testPlayBeamMode === 'extract') {
      setBeamFeedback('⚡ Beam [EXTRACT]: Excavating regolith & ore chunks into bandolier...');
    } else if (state.testPlayBeamMode === 'sculpt') {
      setBeamFeedback('⚡ Beam [SCULPT]: Smoothing & grading planetary terrain heightfield...');
    } else {
      setBeamFeedback('⚡ Beam [SEAL]: Stabilizing S-Space containment rift...');
    }
  };

  const handleFireUp = () => {
    playerStateRef.current.firing = false;
    setFiringBeam(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#050811',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#f8fafc',
      }}
    >
      {/* Live 3D Sandbox WebGL Canvas Behind HUD */}
      <canvas
        ref={canvasRef}
        data-testid="test-play-webgl-canvas"
        onPointerDown={handleFireDown}
        onPointerUp={handleFireUp}
        onPointerMove={(e) => {
          if (e.buttons === 2 || e.shiftKey) {
            playerStateRef.current.yaw -= e.movementX * 0.006;
            playerStateRef.current.pitch = Math.max(
              -0.4,
              Math.min(0.8, playerStateRef.current.pitch + e.movementY * 0.005),
            );
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'crosshair',
        }}
      />

      {/* Top Sandbox HUD Bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          margin: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 18px',
          borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #10b981',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              background: '#10b981',
              color: '#052e16',
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            LIVE 3D SANDBOX PLAYTEST
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            World: {activeWorld.name} ({activeWorld.stargateAddress})
          </span>
          <span style={{ fontSize: 12, color: '#38bdf8' }}>{beamFeedback}</span>
        </div>

        <button
          onClick={() => store.exitTestPlaySandbox()}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #f87171',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#fecaca',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          [Esc] Return to Studio (State Preserved)
        </button>
      </div>

      {/* Center Reticle (Configurable per Aspect 12) */}
      {reticleStyle !== 'off' && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            alignSelf: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: reticleStyle === 'dot' ? 8 : 22,
              height: reticleStyle === 'dot' ? 8 : 22,
              border:
                reticleStyle === 'dot'
                  ? 'none'
                  : `2px solid ${firingBeam ? '#fbbf24' : '#38bdf8'}`,
              background: reticleStyle === 'dot' ? '#38bdf8' : 'transparent',
              borderRadius: reticleStyle === 'crosshair' ? 2 : '50%',
              margin: '0 auto 8px',
            }}
          />
          <div style={{ fontSize: 11, color: '#bae6fd', textShadow: '0 1px 4px #000' }}>
            Beam Rifle [{state.testPlayBeamMode.toUpperCase()}] | Active Swatch:{' '}
            {state.activeMaterialId}
          </div>
        </div>
      )}

      {/* Bottom Equipment, Camera Rig & Telemetry Bar (Aspect 12) */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          margin: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '10px 18px',
          borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid #334155',
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['extract', 'apply', 'sculpt', 'seal'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => store.setTestPlayBeamMode(mode)}
              style={{
                padding: '5px 10px',
                borderRadius: 4,
                border:
                  state.testPlayBeamMode === mode
                    ? '1px solid #38bdf8'
                    : '1px solid #334155',
                background: state.testPlayBeamMode === mode ? '#0284c7' : '#0f172a',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Beam: {mode.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => store.toggleTestPlayRover()}
            style={{
              padding: '5px 10px',
              borderRadius: 4,
              border: '1px solid #fbbf24',
              background: state.testPlayRoverSpawned
                ? 'rgba(251, 191, 36, 0.25)'
                : '#0f172a',
              color: '#fde68a',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {state.testPlayRoverSpawned ? '🚙 Driving Scout Rover' : '🚶 Spawn Scout Rover'}
          </button>
        </div>

        {/* Camera FOV, Shake & Reticle Controls (Aspect 12) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>FOV: {cameraFov}°</span>
            <input
              type="range"
              min={60}
              max={110}
              step={1}
              value={cameraFov}
              onChange={(e) => setCameraFov(parseInt(e.target.value, 10))}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Shake: {cameraShake}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={cameraShake}
              onChange={(e) => setCameraShake(parseInt(e.target.value, 10))}
            />
          </label>
          <select
            value={reticleStyle}
            onChange={(e) => setReticleStyle(e.target.value as ReticleStyle)}
            style={{
              padding: '3px 6px',
              borderRadius: 4,
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              fontSize: 10,
            }}
          >
            <option value="holo-circle">Reticle: Holo Circle</option>
            <option value="crosshair">Reticle: Crosshair</option>
            <option value="dot">Reticle: Precision Dot</option>
            <option value="off">Reticle: Off</option>
          </select>
          <span style={{ color: '#94a3b8' }}>
            Pos: [{playerPos.join(', ')}] | Machines: {activeWorld.placements.length}
          </span>
        </div>
      </div>
    </div>
  );
};
