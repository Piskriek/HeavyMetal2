import * as THREE from 'three';
import { SovereignHarness } from './harness/SovereignHarness';
import { FractalCameraController } from './camera/FractalCameraController';
import { FractalStreamBridge } from './stream/FractalStreamBridge';
import type { IRungNode } from './rungs/RungTypes';
import { Rung7Gateway } from './rungs/Rung7Gateway';
import { Rung6Space } from './rungs/Rung6Space';
import { Rung5World } from './rungs/Rung5World';
import { Rung4Assembly } from './rungs/Rung4Assembly';
import { Rung3Vessel } from './rungs/Rung3Vessel';
import { Rung2Parts } from './rungs/Rung2Parts';
import { Rung1Atoms } from './rungs/Rung1Atoms';
import './style.css';

// DOM Mount
const viewport = document.getElementById('viewport');
if (!viewport) throw new Error('Missing #viewport element');

// 1. Scene, Renderer, Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080c);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 1e7);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
viewport.appendChild(renderer.domElement);

// 2. Lighting Rig
const ambientLight = new THREE.AmbientLight(0x334455, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffaed, 2.0);
sunLight.position.set(2000, 4000, 2000);
scene.add(sunLight);

// 3. Sovereign Reality Harness
const harness = new SovereignHarness();
const streamBridge = new FractalStreamBridge(harness);

// 4. Instantiate Hierarchical Rungs (Gateway down to Atoms)
const rung7 = new Rung7Gateway();
const rung6 = new Rung6Space();
const rung5 = new Rung5World();
const rung4 = new Rung4Assembly();
const rung3 = new Rung3Vessel();
const rung2 = new Rung2Parts();
const rung1 = new Rung1Atoms();

// Fractal Scene Graph Nesting:
// Gateway (D7) -> Space (D6) -> World (D5) -> Assembly (D4) -> Vessel (D3) -> Parts (D2) -> Atoms (D1)
scene.add(rung7);
scene.add(rung6);
scene.add(rung5);
scene.add(rung4);
scene.add(rung3);
rung3.add(rung2);
rung3.add(rung1);

const rungs: IRungNode[] = [rung7, rung6, rung5, rung4, rung3, rung2, rung1];

// 5. Fractal Camera Controller
const cameraController = new FractalCameraController(camera, viewport, rungs);

// Focus Target in world coordinates (defaults to Vessel origin)
const focusTarget = new THREE.Vector3(0, 0.5, 0);

// 6. HUD UI Elements
const hudActiveRung = document.getElementById('hud-active-rung');
const hudDensity = document.getElementById('hud-density');
const hudDistance = document.getElementById('hud-distance');
const hudCoherence = document.getElementById('hud-coherence');
const hudStrain = document.getElementById('hud-strain');
const hudReserve = document.getElementById('hud-reserve');
const hudAwareness = document.getElementById('hud-awareness');
const hudFloats = document.getElementById('hud-floats');
const hudGraduation = document.getElementById('hud-graduation');
const hudViewMode = document.getElementById('hud-view-mode');
const hudToast = document.getElementById('hud-toast');

// Rung Jump Buttons
document.querySelectorAll<HTMLButtonElement>('[data-rung]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const r = parseInt(btn.dataset.rung || '6', 10);
    cameraController.setRung(r);
  });
});

// Window Resize Handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 7. Render Loop
let lastTime = performance.now();

function animate(now: number): void {
  requestAnimationFrame(animate);

  const dt = Math.min(0.05, (now - lastTime) * 0.001);
  lastTime = now;
  const time = now * 0.001;

  // Poll Stream Bridge
  streamBridge.pollBridge();

  // Step Sovereign Harness Physics ODE
  const externalAttractor = {
    x: Math.sin(time * 0.6) * 0.25,
    y: 0.0,
    z: Math.cos(time * 0.4) * 0.35,
  };
  const telemetry = harness.step(dt, externalAttractor);

  // Focus target shifts with vehicle displacement
  focusTarget.set(telemetry.q[0], telemetry.q[1] + 0.5, telemetry.q[2]);

  // Update Camera Controller
  const camState = cameraController.update(dt, focusTarget);

  // Update Rung Nodes with live telemetry
  for (const rung of rungs) {
    rung.update(time, dt, telemetry);
  }

  // Render Frame
  renderer.render(scene, camera);

  // Update Telemetry HUD
  if (hudActiveRung) hudActiveRung.textContent = `RUNG ${camState.activeRungIndex} (${rungs[7 - camState.activeRungIndex]?.rungName || ''})`;
  if (hudDensity) hudDensity.textContent = camState.activeDensity;
  if (hudDistance) {
    const d = camState.distanceM;
    hudDistance.textContent = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : d >= 1 ? `${d.toFixed(2)} m` : `${(d * 100).toFixed(1)} cm`;
  }
  if (hudCoherence) {
    hudCoherence.textContent = (telemetry.coherence * 100).toFixed(1) + '%';
    hudCoherence.style.color = telemetry.coherence >= 0.95 ? '#facc15' : '#38bdf8';
  }
  if (hudStrain) hudStrain.textContent = `${telemetry.strainJoules.toFixed(3)} J`;
  if (hudReserve) hudReserve.textContent = `${telemetry.reserveJoules.toFixed(2)} J`;
  if (hudAwareness) hudAwareness.textContent = `${(telemetry.awareness * 100).toFixed(1)}%`;
  if (hudFloats) {
    const [p, v, l, a] = telemetry.fourFloats;
    hudFloats.textContent = `P:${p.toFixed(2)} V:${v.toFixed(2)} L:${l.toFixed(2)} A:${a.toFixed(2)}`;
  }
  if (hudGraduation) {
    hudGraduation.textContent = telemetry.graduated ? 'GRADUATED (N -> N+1)' : 'INCARNATE (N)';
    hudGraduation.className = telemetry.graduated ? 'badge graduated' : 'badge';
  }
  if (hudViewMode) {
    hudViewMode.textContent = `VIEW: ${camState.activeViewMode.name.toUpperCase()}`;
    hudViewMode.style.borderColor = camState.isAutoTour ? '#facc15' : '#38bdf8';
    hudViewMode.style.color = camState.isAutoTour ? '#facc15' : '#38bdf8';
  }
  if (hudToast) {
    if (camState.toastMessage) {
      hudToast.textContent = camState.toastMessage;
      hudToast.style.display = 'block';
    } else {
      hudToast.style.display = 'none';
    }
  }
}

requestAnimationFrame(animate);
