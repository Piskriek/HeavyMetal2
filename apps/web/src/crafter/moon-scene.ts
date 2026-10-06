// The Resolution Crafter's 3D view: the world (crafter/world.ts) with an orbit camera round your plot's centre, low enough
// to see across the plains to the horizon.
// The screen tells it which looks to show and where the wave front is.
import * as THREE from 'three';
import type { StageLook } from './looks';
import { createCreatures, type Creatures, type Herd } from './creatures';
import { drop, planetHeight } from './planet';
import { createWorld, type Neighbour } from './world';

/** What the screen needs from the scene. */
export interface MoonScene {
  /** Lays out the planet round your plot (once, before the first look): the plains' look and the neighbours. */
  setPlanet(base: StageLook, neighbours: readonly Neighbour[]): void;
  /** Shows a look at once, everywhere (the first look, or after a wave settles). */
  show(look: StageLook): void;
  /** The look the next wave carries out from your plot's centre. */
  setTarget(look: StageLook): void;
  /** Where the front is (metres from your plot's centre); call every frame while a wave runs. */
  setFront(radius: number): void;
  /** The wave has crossed the whole moon: its look becomes the moon's look. */
  settle(): void;
  /** Draws one frame. */
  frame(now: number, dt: number): void;
  /** `covered` is how many pixels the console covers at the bottom: the view centres on what is left above it. */
  resize(width: number, height: number, pixelRatio: number, covered?: number): void;
  dispose(): void;
}

export interface MoonSceneOptions {
  readonly canvas: HTMLCanvasElement;
  /** Metres between grid points: 1 on Potato and Low, 0.5 above. */
  readonly gridSpacing: number;
  readonly antialias: boolean;
  readonly powerPreference: WebGLPowerPreference;
  readonly reducedMotion: boolean;
}

/** Builds the scene on a canvas. Throws if WebGL is not available (the screen says so in plain words). */
export function createMoonScene(o: MoonSceneOptions): MoonScene {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: o.antialias, powerPreference: o.powerPreference });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 9000);
  const world = createWorld(scene, { gridSpacing: o.gridSpacing, reducedMotion: o.reducedMotion });

  // ---- animals: once your plot is alive (stage 5 on) a herd grazes on it, crystal tortoises by the lake, mantas overhead
  const ground = (x: number, z: number): number => planetHeight(x, z) - drop(x, z);
  const HERDS: readonly Herd[] = [
    { id: 'MOON_STRIDER', x: -34, z: -26, count: 7, roam: 12 },
    { id: 'CRYSTAL_TORTOISE', x: 20, z: -30, count: 2, roam: 6 },
    { id: 'SKY_MANTA', x: 0, z: 0, count: 2, roam: 40 },
  ];
  let animals: Creatures | null = null, pendingStage = 0;
  const animalsFor = (stage: number): void => {
    if (stage >= 5 && !animals) animals = createCreatures(scene, HERDS, ground, o.reducedMotion);
    if (stage < 5 && animals) { animals.dispose(); animals = null; }
  };

  // ---- the camera: drag to look round, wheel to come closer; it starts low, looking out over the plains
  const orbit = { yaw: 0.85, pitch: 0.13, distance: 58, idle: 0 };
  const target = new THREE.Vector3(0, world.peakY + 3.5, 0);
  let dragging: { x: number; y: number } | null = null;
  const onDown = (ev: PointerEvent): void => { dragging = { x: ev.clientX, y: ev.clientY }; orbit.idle = 0; o.canvas.setPointerCapture(ev.pointerId); };
  const onMove = (ev: PointerEvent): void => {
    if (!dragging) return;
    orbit.yaw -= (ev.clientX - dragging.x) * 0.005;
    orbit.pitch = Math.max(0.02, Math.min(1.25, orbit.pitch + (ev.clientY - dragging.y) * 0.004));
    dragging = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (): void => { dragging = null; };
  const onWheel = (ev: WheelEvent): void => { ev.preventDefault(); orbit.idle = 0; orbit.distance = Math.max(14, Math.min(150, orbit.distance * (1 + Math.sign(ev.deltaY) * 0.08))); };
  o.canvas.addEventListener('pointerdown', onDown);
  o.canvas.addEventListener('pointermove', onMove);
  o.canvas.addEventListener('pointerup', onUp);
  o.canvas.addEventListener('pointercancel', onUp);
  o.canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    show: (look) => { world.show(look); animalsFor(look.stage); },
    setTarget: (look) => { world.setTarget(look); pendingStage = look.stage; },
    setFront: (radius) => world.setFront(radius),
    settle: () => { world.settle(); if (pendingStage) animalsFor(pendingStage); },
    setPlanet: (base, neighbours) => world.setPlanet(base, neighbours),
    frame(now, dt) {
      if (!o.reducedMotion && !dragging) { orbit.idle += dt; if (orbit.idle > 5) orbit.yaw += dt * 0.035; }
      const cp = Math.cos(orbit.pitch);
      camera.position.set(target.x + Math.sin(orbit.yaw) * cp * orbit.distance, target.y + Math.sin(orbit.pitch) * orbit.distance, target.z + Math.cos(orbit.yaw) * cp * orbit.distance);
      // never under the ground: a low orbit rides over a ridge
      const ground = planetHeight(camera.position.x, camera.position.z) - drop(camera.position.x, camera.position.z) + 1.6;
      if (camera.position.y < ground) camera.position.y = ground;
      camera.lookAt(target);
      world.update(now, dt, camera.position);
      animals?.update(now, dt);
      renderer.render(scene, camera);
    },
    resize(width, height, pixelRatio, covered = 0) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      // draw the bottom of a taller picture, so the camera's centre sits in the middle of the part the console leaves open
      const inset = Math.max(0, Math.min(height * 0.6, covered)), open = Math.max(1, height - inset);
      // the open part shows 48 degrees top to bottom (62 on a portrait screen, for more of the moon); the field of view
      // is set for the whole taller picture so that the open part comes out at that
      const openFov = width / open < 0.9 ? 62 : 48;
      camera.fov = (2 * Math.atan(Math.tan((openFov * Math.PI) / 360) * ((height + inset) / open)) * 180) / Math.PI;
      camera.aspect = width / Math.max(1, height + inset);
      camera.setViewOffset(width, height + inset, 0, inset, width, height);
      camera.updateProjectionMatrix();
    },
    dispose() {
      o.canvas.removeEventListener('pointerdown', onDown);
      o.canvas.removeEventListener('pointermove', onMove);
      o.canvas.removeEventListener('pointerup', onUp);
      o.canvas.removeEventListener('pointercancel', onUp);
      o.canvas.removeEventListener('wheel', onWheel);
      animals?.dispose();
      world.dispose();
      renderer.dispose();
    },
  };
}
