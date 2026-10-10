/**
 * Monster Mash Combat & Spawning Subsystem for SetMix.
 * Powered by deterministic @hm/mobsim 30 Hz simulation, @hm/navpath any-angle pathing,
 * and @hm/structure base navigation grid (navgrid.ts).
 * Allows equipping retro weapons, spawning Quake 2 Ogro (3D MD2) and DOOM Demon (2D billboard)
 * mobs that path intelligently around base walls and shelters, shooting them with deterministic shotgun/beam raycasts,
 * triggering recoil, flinches, pain/attack/death sequences, and fidelity stage adaptation.
 */
import * as THREE from 'three';
import { parseMd2, createMd2Mesh, type Md2ParsedModel } from '@hm/shareware';
import { parseWad, extractPatch, extractPlaypal } from '@hm/shareware';
import { createFidelityMobMaterial, type FidelityStage } from '@hm/shareware';
import {
  createSim,
  spawn,
  spawnNear,
  fire as mobsimFire,
  step as mobsimStep,
  hashSim as mobsimHash,
  type Sim,
  type Mob,
  type MobState as MobSimState,
  type Nav,
  DT,
  KINDS,
  type Shot,
} from '@hm/mobsim';
import { navFor } from '../base/navgrid';
import * as S from '@hm/structure';
import type { WeaponStats } from '../base/weapons';

export type MobKind = 'ogro' | 'demon';
export type MobState = 'idle' | 'chase' | 'attack' | 'pain' | 'death';

export interface MobStatus {
  readonly id: number;
  readonly kind: MobKind;
  readonly hp: number;
  readonly maxHp: number;
  readonly state: MobState;
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
}

export interface CombatStats {
  mobsSpawned: number;
  mobsDefeated: number;
  damageDealt: number;
  shotsFired: number;
  pelletsHit: number;
  oreCollected: number;
}

export interface MonsterMashCombatManager {
  isEquipped(): boolean;
  equip(on: boolean): void;
  fire(
    playerPos?: THREE.Vector3 | { x: number; y: number; z: number },
    cameraDir?: THREE.Vector3 | { x: number; y: number; z: number }
  ): { fired: boolean; hits: number; damage: number; killed: number; reason?: string };
  setWeaponStats(stats: WeaponStats | null): void;
  getWeaponStats(): WeaponStats | null;
  setTrigger(held: boolean): void;
  spawnOgro(count?: number, customPos?: { x: number; z: number }): Promise<void>;
  spawnDemon(count?: number, customPos?: { x: number; z: number }): Promise<void>;
  spawnDirect(kind: 'ogro' | 'demon', x: number, z: number): void;
  clearMobs(): void;
  setFidelityStage(stage: number): void;
  getMobList(): readonly MobStatus[];
  getStats(): CombatStats;
  getAmmo(): { current: number; max: number };
  reload(): void;
  update(dt: number, playerPos: THREE.Vector3, isMoving: boolean): void;
  dispose(): void;
  setBase(base: S.Base | null): void;
  setIsOnPlanet(onPlanet: boolean): void;
  getSim(): Sim;
  hashSim(): string;
  resetSim(seed?: number): void;
  getNav(): Nav;
  step(player?: { x: number; z: number }): void;
}

// -----------------------------------------------------------------------------
// Default Retro Combat Shotgun Stats
// -----------------------------------------------------------------------------
const DEFAULT_WEAPON_STATS: WeaponStats = {
  mode: 'semi',
  burst: 1,
  burstGap: 0,
  cooldown: 0.52,
  pellets: 7,
  damage: [20, 29],
  spread: 0.0275,
  range: 60,
  zoom: 1,
  magazine: 8,
};

// -----------------------------------------------------------------------------
// Procedural Web Audio FX Synthesizer
// -----------------------------------------------------------------------------
class CombatAudio {
  private ctx: AudioContext | null = null;

  private init(): AudioContext | null {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      try {
        this.ctx = new AudioContext();
      } catch {
        // audio context blocked or unsupported
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playShotgunBlast(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sub-bass punch (sine drop)
    const osc = ctx.createOscillator();
    const gainOsc = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.28);
    gainOsc.gain.setValueAtTime(0.7, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gainOsc);
    gainOsc.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);

    // High crack / blast noise
    const bufferSize = ctx.sampleRate * 0.18;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(1.2, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // Mechanical pump action (click-clack)
    setTimeout(() => {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(620, t);
      click.frequency.exponentialRampToValueAtTime(180, t + 0.05);
      clickGain.gain.setValueAtTime(0.25, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      click.connect(clickGain);
      clickGain.connect(ctx.destination);
      click.start(t);
      click.stop(t + 0.07);
    }, 180);
  }

  playPainGrunt(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playDeathRoar(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.65);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  playAttackBite(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(75, now + 0.14);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playEquip(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playSpawn(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  playOreChime(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playBeamPulse(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

// -----------------------------------------------------------------------------
// Procedural Tactical Combat Shotgun Viewmodel
// -----------------------------------------------------------------------------
function createShotgunViewmodel(): { group: THREE.Group; flashMesh: THREE.Mesh; flashLight: THREE.PointLight } {
  const group = new THREE.Group();

  const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.3, metalness: 0.85 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.65, metalness: 0.05 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x3d434a, roughness: 0.25, metalness: 0.9 });

  // Main Receiver
  const receiverGeo = new THREE.BoxGeometry(0.07, 0.09, 0.34);
  const receiver = new THREE.Mesh(receiverGeo, gunMetalMat);
  receiver.position.set(0, 0, 0);
  group.add(receiver);

  // Twin Barrels (Double-Barrel / Heavy Combat)
  const barrelGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.48, 16);
  barrelGeo.rotateX(Math.PI / 2);

  const leftBarrel = new THREE.Mesh(barrelGeo, steelMat);
  leftBarrel.position.set(-0.018, 0.022, -0.36);
  group.add(leftBarrel);

  const rightBarrel = new THREE.Mesh(barrelGeo, steelMat);
  rightBarrel.position.set(0.018, 0.022, -0.36);
  group.add(rightBarrel);

  // Ribbed Pump Fore-End Grip
  const pumpGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.22, 12);
  pumpGeo.rotateX(Math.PI / 2);
  const pump = new THREE.Mesh(pumpGeo, darkWoodMat);
  pump.position.set(0, -0.012, -0.26);
  group.add(pump);

  // Stock / Grip
  const gripGeo = new THREE.BoxGeometry(0.055, 0.12, 0.12);
  gripGeo.rotateX(-0.4);
  const grip = new THREE.Mesh(gripGeo, darkWoodMat);
  grip.position.set(0, -0.07, 0.16);
  group.add(grip);

  // Iron Sight Front Bead
  const beadGeo = new THREE.SphereGeometry(0.006, 8, 8);
  const beadMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  const bead = new THREE.Mesh(beadGeo, beadMat);
  bead.position.set(0, 0.042, -0.58);
  group.add(bead);

  // Muzzle Flash Quad
  const flashGeo = new THREE.PlaneGeometry(0.24, 0.24);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffaa22,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.set(0, 0.022, -0.62);
  flashMesh.visible = false;
  group.add(flashMesh);

  // Muzzle Flash Point Light
  const flashLight = new THREE.PointLight(0xff7711, 0, 10);
  flashLight.position.set(0, 0.022, -0.64);
  group.add(flashLight);

  return { group, flashMesh, flashLight };
}

// -----------------------------------------------------------------------------
// Floating Billboard Health Bar
// -----------------------------------------------------------------------------
function createHealthBarCanvas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; mesh: THREE.Mesh; update: (hp: number, max: number, name: string) => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(1.2, 0.3);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthTest: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 999;

  const update = (hp: number, max: number, name: string): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background pill
    ctx.fillStyle = 'rgba(10, 12, 16, 0.75)';
    ctx.roundRect(0, 0, 128, 32, 4);
    ctx.fill();

    // Name text
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#f1f4f5';
    ctx.fillText(name, 6, 12);

    // HP percentage bar
    const pct = Math.max(0, Math.min(1, hp / max));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(6, 16, 116, 10);

    // Bar color
    ctx.fillStyle = pct > 0.5 ? '#10b981' : pct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(6, 16, 116 * pct, 10);

    // HP number
    ctx.font = '9px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(hp)}`, 122, 12);
    ctx.textAlign = 'left';

    texture.needsUpdate = true;
  };

  update(100, 100, 'MOB');
  return { canvas, texture, mesh, update };
}

// -----------------------------------------------------------------------------
// Mob Entity Representation
// -----------------------------------------------------------------------------
interface DemonSprites {
  readonly walk: readonly THREE.Texture[];
  readonly attack: readonly THREE.Texture[];
  readonly pain: readonly THREE.Texture[];
  readonly death: readonly THREE.Texture[];
}

interface MobEntity {
  readonly id: number;
  readonly kind: MobKind;
  group: THREE.Group;
  mesh: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  actions?: Map<string, THREE.AnimationAction>;
  sprites?: DemonSprites;
  animTimer?: number;
  animIndex?: number;
  hp: number;
  maxHp: number;
  state: MobState;
  stateTimer: number;
  speed: number;
  hitRadius: number;
  height: number;
  healthBar: ReturnType<typeof createHealthBarCanvas>;
  material: THREE.Material & { uniforms?: Record<string, { value: any }> };
  painFlash: number;
}

// -----------------------------------------------------------------------------
// Particle Burst Pool
// -----------------------------------------------------------------------------
interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

class ParticleSystem {
  private particles: Particle[] = [];
  private geom: THREE.BufferGeometry;
  private pPos: Float32Array;
  private pCol: Float32Array;
  private mesh: THREE.Points;
  private maxCount = 200;

  constructor(scene: THREE.Scene) {
    this.geom = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.maxCount * 3);
    this.pCol = new Float32Array(this.maxCount * 3);
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.geom.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Points(this.geom, mat);
    scene.add(this.mesh);
  }

  burst(origin: THREE.Vector3, count: number, colorHex: number, speed: number): void {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxCount) this.particles.shift();
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.2,
        (Math.random() - 0.5) * 2
      ).normalize();

      this.particles.push({
        pos: origin.clone(),
        vel: dir.multiplyScalar(speed * (0.5 + Math.random() * 0.8)),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.45,
        color: col.clone(),
        size: 0.12,
      });
    }
  }

  update(dt: number): void {
    let active = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 9.8 * dt; // gravity
      p.pos.addScaledVector(p.vel, dt);

      const alpha = 1 - p.life / p.maxLife;
      this.pPos[active * 3] = p.pos.x;
      this.pPos[active * 3 + 1] = p.pos.y;
      this.pPos[active * 3 + 2] = p.pos.z;

      this.pCol[active * 3] = p.color.r * alpha;
      this.pCol[active * 3 + 1] = p.color.g * alpha;
      this.pCol[active * 3 + 2] = p.color.b * alpha;
      active++;
    }

    // Hide remaining vertices
    for (let i = active; i < this.maxCount; i++) {
      this.pPos[i * 3] = 0;
      this.pPos[i * 3 + 1] = -9999;
      this.pPos[i * 3 + 2] = 0;
    }

    this.geom.attributes.position!.needsUpdate = true;
    this.geom.attributes.color!.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.geom.dispose();
  }
}

// -----------------------------------------------------------------------------
// Main Monster Mash Combat Manager Implementation
// -----------------------------------------------------------------------------
export function createMonsterMashCombat(options: {
  readonly planetScene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly groundHeightAt: (x: number, z: number) => number;
  readonly onOreGathered?: (amount: number) => void;
  readonly initialStage?: number;
  readonly seed?: number;
  readonly initialBase?: S.Base | null;
  readonly isPlanet?: () => boolean;
}): MonsterMashCombatManager {
  const { planetScene, camera, groundHeightAt, onOreGathered } = options;
  const audio = new CombatAudio();
  const particles = new ParticleSystem(planetScene);

  let stage: FidelityStage = (options.initialStage ?? 1) as FidelityStage;
  let equipped = false;
  let currentAmmo = 8;
  let maxAmmo = 8;
  let activeWeaponStats: WeaponStats | null = DEFAULT_WEAPON_STATS;
  let burstRemaining = 0;
  let burstOrigin: THREE.Vector3 | null = null;
  let burstDir: THREE.Vector3 | null = null;
  let triggerHeld = false;

  // Deterministic mob simulation state (@hm/mobsim)
  const initialSeed = options.seed ?? 1337;
  let sim: Sim = createSim(initialSeed);
  let accumulator = 0;
  const prevMobs = new Map<number, { x: number; z: number; state: MobSimState; hp: number }>();

  // Ground navigation grid state (navgrid.ts & @hm/structure)
  let currentBase: S.Base | null = options.initialBase ?? null;
  let isOnPlanet = options.isPlanet ? options.isPlanet() : true;
  let lastPlayerPos = { x: 0, z: 0 };
  let currentNav: Nav = openNav({ x: 0, z: 0 }, 32);
  let lastGridCenter = { x: 0, z: 0 };
  let lastBaseHash = '';
  let lastNavRebuildTime = 0;

  const stats: CombatStats = {
    mobsSpawned: 0,
    mobsDefeated: 0,
    damageDealt: 0,
    shotsFired: 0,
    pelletsHit: 0,
    oreCollected: 0,
  };

  // Viewmodel setup
  const { group: viewmodelGroup, flashMesh, flashLight } = createShotgunViewmodel();
  camera.add(viewmodelGroup);
  viewmodelGroup.visible = false;

  const defaultOffset = new THREE.Vector3(0.24, -0.22, -0.48);
  const recoilOffset = new THREE.Vector3(0, 0, 0);
  let recoilPitch = 0;
  let flashTimer = 0;

  // Cached shareware assets
  let ogroModelCache: Md2ParsedModel | null = null;
  let ogroTextureCache: THREE.Texture | null = null;
  let demonSpritesCache: DemonSprites | null = null;

  // Render views keyed by mob ID
  const mobViews = new Map<number, MobEntity>();

  function openNav(center: { readonly x: number; readonly z: number }, radius = 32, cell = 0.25): Nav {
    const w = Math.ceil((2 * radius) / cell);
    const h = w;
    const originX = center.x - radius;
    const originZ = center.z - radius;
    return {
      originX,
      originZ,
      cell,
      grid: { w, h, blocked: () => false },
    };
  }

  function baseHash(base: S.Base | null): string {
    if (!base) return '';
    let h = `${base.structures.length}:${base.pieces.length}:`;
    for (const p of base.pieces) {
      h += `${p.id},${p.kind},${p.i},${p.j},${p.k},${p.r},${p.open ? 1 : 0};`;
    }
    return h;
  }

  function updateNav(playerPos: { x: number; z: number }, force = false): void {
    const nowSec = performance.now() / 1000;
    if (!isOnPlanet || !currentBase || currentBase.pieces.length === 0) {
      if (force || !currentNav) {
        currentNav = openNav(playerPos, 32);
        lastGridCenter = { x: playerPos.x, z: playerPos.z };
        lastBaseHash = '';
        lastNavRebuildTime = nowSec;
      }
      return;
    }

    const dist = Math.hypot(playerPos.x - lastGridCenter.x, playerPos.z - lastGridCenter.z);
    const bHash = baseHash(currentBase);
    const baseChanged = bHash !== lastBaseHash;

    if (force || ((baseChanged || dist > 12) && (nowSec - lastNavRebuildTime >= 1.0 || !currentNav))) {
      currentNav = navFor(currentBase, playerPos, 32);
      lastGridCenter = { x: playerPos.x, z: playerPos.z };
      lastBaseHash = bHash;
      lastNavRebuildTime = nowSec;
    }
  }

  // Helper to load Ogro assets
  async function loadOgroModel(): Promise<{ model: Md2ParsedModel; texture: THREE.Texture }> {
    if (ogroModelCache && ogroTextureCache) {
      return { model: ogroModelCache, texture: ogroTextureCache };
    }

    const [meshRes, texRes] = await Promise.all([
      fetch('./shareware/ogro.md2'),
      fetch('./shareware/ogrobase.png'),
    ]);

    if (!meshRes.ok || !texRes.ok) {
      throw new Error(`Failed to load Ogro assets: mesh ${meshRes.status}, tex ${texRes.status}`);
    }

    const buffer = await meshRes.arrayBuffer();
    const model = parseMd2(buffer);
    ogroModelCache = model;

    const imgBlob = await texRes.blob();
    const imgUrl = URL.createObjectURL(imgBlob);
    const texture = await new Promise<THREE.Texture>((resolve) => {
      new THREE.TextureLoader().load(imgUrl, (t) => {
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        resolve(t);
      });
    });
    ogroTextureCache = texture;

    return { model, texture };
  }

  // Helper to load full animated DOOM Demon sprite sequences from WAD
  async function loadDemonSprites(): Promise<DemonSprites> {
    if (demonSpritesCache) return demonSpritesCache;

    try {
      const res = await fetch('./shareware/doom1.wad');
      if (!res.ok) throw new Error('Failed to fetch doom1.wad');
      const buf = await res.arrayBuffer();
      const wad = parseWad(buf);
      const pal = extractPlaypal(wad);

      const makeTex = (lump: string): THREE.Texture => {
        const patch = extractPatch(wad, lump, pal);
        const canvas = document.createElement('canvas');
        canvas.width = patch.width;
        canvas.height = patch.height;
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.createImageData(patch.width, patch.height);
        imgData.data.set(patch.data);
        ctx.putImageData(imgData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };

      const walkLumps = ['SARGA1', 'SARGB1', 'SARGC1', 'SARGD1'];
      const attackLumps = ['SARGE1', 'SARGF1', 'SARGG1'];
      const painLumps = ['SARGH1'];
      const deathLumps = ['SARGI0', 'SARGJ0', 'SARGK0', 'SARGL0', 'SARGM0', 'SARGN0'];

      const sprites: DemonSprites = {
        walk: walkLumps.map(makeTex),
        attack: attackLumps.map(makeTex),
        pain: painLumps.map(makeTex),
        death: deathLumps.map(makeTex),
      };

      demonSpritesCache = sprites;
      return sprites;
    } catch (e) {
      console.warn('WAD load failed, generating fallback Demon sprites:', e);
      const makeFallback = (color: string): THREE.Texture => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.fillRect(16, 12, 32, 40);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(20, 20, 8, 8);
        ctx.fillRect(36, 20, 8, 8);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
      };
      const sprites: DemonSprites = {
        walk: [makeFallback('#b91c1c'), makeFallback('#991b1b')],
        attack: [makeFallback('#dc2626'), makeFallback('#ef4444')],
        pain: [makeFallback('#f87171')],
        death: [makeFallback('#450a0a')],
      };
      demonSpritesCache = sprites;
      return sprites;
    }
  }

  function createOgroView(m: Mob): MobEntity | null {
    if (!ogroModelCache || !ogroTextureCache) return null;
    const { mesh, mixer, actions } = createMd2Mesh(ogroModelCache, ogroTextureCache);
    const material = createFidelityMobMaterial({ map: ogroTextureCache, stage });
    mesh.material = material;

    mesh.scale.set(0.045, 0.045, 0.045);
    mesh.rotation.set(0, -Math.PI / 2, 0);
    mesh.position.y = 1.444;

    const group = new THREE.Group();
    group.add(mesh);
    const y = groundHeightAt(m.x, m.z);
    group.position.set(m.x, y, m.z);

    const healthBar = createHealthBarCanvas();
    healthBar.mesh.position.set(0, 4.1, 0);
    group.add(healthBar.mesh);
    healthBar.update(m.hp, KINDS.ogro.hp, `OGRO #${m.id}`);

    planetScene.add(group);

    const runAction = actions.get('run');
    if (runAction && m.state !== 'death') {
      runAction.reset().play();
    }

    const view: MobEntity = {
      id: m.id,
      kind: 'ogro',
      group,
      mesh,
      mixer,
      actions,
      hp: m.hp,
      maxHp: KINDS.ogro.hp,
      state: m.state,
      stateTimer: m.timer,
      speed: KINDS.ogro.speed,
      hitRadius: KINDS.ogro.radius,
      height: KINDS.ogro.height,
      healthBar,
      material,
      painFlash: 0,
    };
    return view;
  }

  function createDemonView(m: Mob): MobEntity | null {
    if (!demonSpritesCache) return null;
    const initialTexture = demonSpritesCache.walk[0]!;
    const material = createFidelityMobMaterial({ map: initialTexture, stage });

    const geo = new THREE.PlaneGeometry(1.8, 2.2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = 1.1;

    const group = new THREE.Group();
    group.add(mesh);
    const y = groundHeightAt(m.x, m.z);
    group.position.set(m.x, y, m.z);

    const healthBar = createHealthBarCanvas();
    healthBar.mesh.position.set(0, 2.3, 0);
    group.add(healthBar.mesh);
    healthBar.update(m.hp, KINDS.demon.hp, `DEMON #${m.id}`);

    planetScene.add(group);

    const view: MobEntity = {
      id: m.id,
      kind: 'demon',
      group,
      mesh,
      sprites: demonSpritesCache,
      animTimer: 0,
      animIndex: 0,
      hp: m.hp,
      maxHp: KINDS.demon.hp,
      state: m.state,
      stateTimer: m.timer,
      speed: KINDS.demon.speed,
      hitRadius: KINDS.demon.radius,
      height: KINDS.demon.height,
      healthBar,
      material,
      painFlash: 0,
    };
    return view;
  }

  function syncMobViews(): void {
    for (const m of sim.mobs) {
      if (!mobViews.has(m.id)) {
        const view = m.kind === 'ogro' ? createOgroView(m) : createDemonView(m);
        if (view) {
          mobViews.set(m.id, view);
          particles.burst(view.group.position, 16, m.kind === 'ogro' ? 0xb46bff : 0xef4444, 4.0);
          audio.playSpawn();
        }
      }
    }
  }

  function setFidelityStage(newStage: number): void {
    stage = Math.max(0, Math.min(4, newStage)) as FidelityStage;
    for (const mob of mobViews.values()) {
      if (mob.material && mob.material.uniforms && mob.material.uniforms['uStage']) {
        mob.material.uniforms['uStage'].value = stage;
      }
    }
  }

  function equip(on: boolean): void {
    equipped = on;
    viewmodelGroup.visible = on;
    if (on) {
      audio.playEquip();
    }
  }

  function isEquipped(): boolean {
    return equipped;
  }

  function setWeaponStats(statsObj: WeaponStats | null): void {
    activeWeaponStats = statsObj ?? DEFAULT_WEAPON_STATS;
    maxAmmo = activeWeaponStats.magazine;
    currentAmmo = Math.min(currentAmmo, maxAmmo);
    if (currentAmmo <= 0) currentAmmo = maxAmmo;
    burstRemaining = 0;
    burstOrigin = null;
    burstDir = null;
  }

  function setTrigger(held: boolean): void {
    triggerHeld = held;
  }

  function getWeaponStats(): WeaponStats | null {
    return activeWeaponStats;
  }

  function getAmmo(): { current: number; max: number } {
    return { current: currentAmmo, max: activeWeaponStats?.magazine ?? maxAmmo };
  }

  function reload(): void {
    currentAmmo = activeWeaponStats?.magazine ?? maxAmmo;
    audio.playEquip();
  }

  async function spawnOgro(count = 1, customPos?: { x: number; z: number }): Promise<void> {
    try {
      await loadOgroModel();
      updateNav(lastPlayerPos, true);
      if (customPos) {
        for (let i = 0; i < count; i++) {
          sim = spawn(sim, currentNav, 'ogro', customPos.x, customPos.z);
        }
      } else {
        sim = spawnNear(sim, currentNav, 'ogro', count, lastPlayerPos.x, lastPlayerPos.z, 7, 11);
      }
      stats.mobsSpawned += count;
      syncMobViews();
    } catch (err) {
      console.error('Failed to spawn Ogro:', err);
    }
  }

  async function spawnDemon(count = 1, customPos?: { x: number; z: number }): Promise<void> {
    try {
      await loadDemonSprites();
      updateNav(lastPlayerPos, true);
      if (customPos) {
        for (let i = 0; i < count; i++) {
          sim = spawn(sim, currentNav, 'demon', customPos.x, customPos.z);
        }
      } else {
        sim = spawnNear(sim, currentNav, 'demon', count, lastPlayerPos.x, lastPlayerPos.z, 7, 11);
      }
      stats.mobsSpawned += count;
      syncMobViews();
    } catch (err) {
      console.error('Failed to spawn Demon:', err);
    }
  }

  function spawnDirect(kind: 'ogro' | 'demon', x: number, z: number): void {
    updateNav(lastPlayerPos, true);
    sim = spawn(sim, currentNav, kind, x, z);
    stats.mobsSpawned++;
    syncMobViews();
  }

  function clearMobs(): void {
    for (const mob of mobViews.values()) {
      planetScene.remove(mob.group);
      mob.material.dispose();
      mob.healthBar.texture.dispose();
    }
    mobViews.clear();
    prevMobs.clear();
    sim = createSim(options.seed ?? 1337);
  }

  function resetSim(seed?: number): void {
    for (const mob of mobViews.values()) {
      planetScene.remove(mob.group);
      mob.material.dispose();
      mob.healthBar.texture.dispose();
    }
    mobViews.clear();
    prevMobs.clear();
    sim = createSim(seed ?? options.seed ?? 1337);
    accumulator = 0;
    currentAmmo = (activeWeaponStats ?? DEFAULT_WEAPON_STATS).magazine;
    burstRemaining = 0;
    burstOrigin = null;
    burstDir = null;
    triggerHeld = false;
    if (!equipped) equip(true);
    updateNav(lastPlayerPos, true);
  }

  function getSim(): Sim {
    return sim;
  }

  function hashSim(): string {
    return mobsimHash(sim);
  }

  function getNav(): Nav {
    return currentNav;
  }

  function setBase(base: S.Base | null): void {
    currentBase = base;
    updateNav(lastPlayerPos, true);
  }

  function setIsOnPlanet(onPlanet: boolean): void {
    if (isOnPlanet !== onPlanet) {
      isOnPlanet = onPlanet;
      updateNav(lastPlayerPos, true);
    }
  }

  function handleShotHitVFX(
    rayOrigin: THREE.Vector3,
    baseDir: THREE.Vector3,
    res: { hits: number; killed: number[] },
    isBeam: boolean
  ): void {
    if (res.hits > 0) {
      for (const m of sim.mobs) {
        if (m.state === 'pain' || res.killed.includes(m.id)) {
          const view = mobViews.get(m.id);
          const pt = view
            ? view.group.position.clone().add(new THREE.Vector3(0, KINDS[m.kind].height * 0.5, 0))
            : new THREE.Vector3(m.x, groundHeightAt(m.x, m.z) + 1, m.z);
          particles.burst(pt, 8, isBeam ? 0x06b6d4 : 0xff3b30, 4.5);
        }
      }
    } else {
      const maxRange = (activeWeaponStats ?? DEFAULT_WEAPON_STATS).range ?? 60;
      for (let d = 2; d < Math.min(45, maxRange); d += 1.2) {
        const pt = rayOrigin.clone().addScaledVector(baseDir, d);
        const gy = groundHeightAt(pt.x, pt.z);
        if (pt.y <= gy) {
          particles.burst(new THREE.Vector3(pt.x, gy + 0.05, pt.z), 3, isBeam ? 0x06b6d4 : 0xf59e0b, 2.5);
          break;
        }
      }
    }
  }

  function processScheduledShots(playerPos: { x: number; z: number }): void {
    if (!equipped) return;
    const currentStats = activeWeaponStats ?? DEFAULT_WEAPON_STATS;

    // 1. Burst follow-up shots on sim clock
    if (burstRemaining > 0 && sim.cooldown <= 0) {
      if (currentAmmo <= 0) {
        burstRemaining = 0;
        burstOrigin = null;
        burstDir = null;
        reload();
        return;
      }

      currentAmmo--;
      stats.shotsFired++;
      burstRemaining--;

      const isLastShot = burstRemaining === 0;
      const shotCooldown = isLastShot ? currentStats.cooldown : currentStats.burstGap;

      const rayOrigin = burstOrigin ? burstOrigin.clone() : new THREE.Vector3(playerPos.x, 1.8, playerPos.z);
      const baseDir = burstDir ? burstDir.clone() : (camera ? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion) : new THREE.Vector3(0, 0, -1));

      const shotConfig: Shot = {
        pellets: currentStats.pellets,
        damage: currentStats.damage,
        spread: currentStats.spread,
        range: currentStats.range,
        cooldown: shotCooldown,
      };

      audio.playShotgunBlast();
      recoilOffset.z = 0.12;
      recoilPitch = 0.06;
      flashTimer = 0.06;
      flashMesh.visible = true;

      const res = mobsimFire(
        sim,
        [rayOrigin.x, rayOrigin.y, rayOrigin.z],
        [baseDir.x, baseDir.y, baseDir.z],
        shotConfig
      );
      sim = res.sim;
      stats.pelletsHit += res.hits;
      stats.damageDealt += res.damage;
      stats.mobsDefeated += res.killed.length;

      handleShotHitVFX(rayOrigin, baseDir, res, false);

      if (res.killed.length > 0) {
        const oreReward = 50 * res.killed.length;
        stats.oreCollected += oreReward;
        onOreGathered?.(oreReward);
        audio.playOreChime();
      }

      if (isLastShot) {
        burstOrigin = null;
        burstDir = null;
      }
      return;
    }

    // 2. Continuous beam while trigger is held
    if (triggerHeld && currentStats.mode === 'beam' && sim.cooldown <= 0 && burstRemaining === 0) {
      if (currentAmmo <= 0) {
        triggerHeld = false;
        reload();
        return;
      }

      currentAmmo--;
      stats.shotsFired++;

      const rayOrigin = camera ? camera.position.clone() : new THREE.Vector3(playerPos.x, 1.8, playerPos.z);
      const baseDir = camera ? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion) : new THREE.Vector3(0, 0, -1);

      const shotConfig: Shot = {
        pellets: 1,
        damage: currentStats.damage,
        spread: 0,
        range: currentStats.range,
        cooldown: currentStats.cooldown,
      };

      audio.playBeamPulse();
      recoilOffset.z = 0.04;
      recoilPitch = 0.02;
      flashTimer = 0.05;
      flashMesh.visible = true;
      flashLight.color.setHex(0x06b6d4);
      flashLight.intensity = 2.5;

      const res = mobsimFire(
        sim,
        [rayOrigin.x, rayOrigin.y, rayOrigin.z],
        [baseDir.x, baseDir.y, baseDir.z],
        shotConfig
      );
      sim = res.sim;
      stats.pelletsHit += res.hits;
      stats.damageDealt += res.damage;
      stats.mobsDefeated += res.killed.length;

      handleShotHitVFX(rayOrigin, baseDir, res, true);

      if (res.killed.length > 0) {
        const oreReward = 50 * res.killed.length;
        stats.oreCollected += oreReward;
        onOreGathered?.(oreReward);
        audio.playOreChime();
      }
    }
  }

  function fire(
    playerPos?: THREE.Vector3 | { x: number; y: number; z: number },
    cameraDir?: THREE.Vector3 | { x: number; y: number; z: number }
  ): { fired: boolean; hits: number; damage: number; killed: number; reason?: string } {
    if (!equipped) {
      return { fired: false, hits: 0, damage: 0, killed: 0 };
    }
    if (sim.cooldown > 0 || burstRemaining > 0) {
      return { fired: false, hits: 0, damage: 0, killed: 0 };
    }

    const currentStats = activeWeaponStats ?? DEFAULT_WEAPON_STATS;

    if (currentAmmo <= 0) {
      reload();
      return { fired: false, hits: 0, damage: 0, killed: 0 };
    }

    currentAmmo--;
    stats.shotsFired++;

    const isBeam = currentStats.mode === 'beam';
    const isBurst = currentStats.mode === 'burst' && currentStats.burst > 1;

    // Audio & Recoil
    if (isBeam) {
      audio.playBeamPulse();
      recoilOffset.z = 0.04;
      recoilPitch = 0.02;
      flashTimer = 0.05;
      flashMesh.visible = true;
      flashLight.color.setHex(0x06b6d4);
      flashLight.intensity = 2.5;
    } else {
      audio.playShotgunBlast();
      recoilOffset.z = 0.14;
      recoilPitch = 0.08;
      flashTimer = 0.07;
      flashMesh.visible = true;
      flashLight.color.setHex(0xff7711);
      flashLight.intensity = 3.5;
    }

    const rayOrigin = playerPos
      ? ('clone' in playerPos ? (playerPos as THREE.Vector3).clone() : new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z))
      : camera.position.clone();
    const baseDir = cameraDir
      ? ('clone' in cameraDir ? (cameraDir as THREE.Vector3).clone().normalize() : new THREE.Vector3(cameraDir.x, cameraDir.y, cameraDir.z).normalize())
      : new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    if (isBurst) {
      burstRemaining = currentStats.burst - 1;
      burstOrigin = rayOrigin.clone();
      burstDir = baseDir.clone();
    }

    const shotCooldown = isBurst ? currentStats.burstGap : currentStats.cooldown;
    const shotConfig: Shot = {
      pellets: isBeam ? 1 : currentStats.pellets,
      damage: currentStats.damage,
      spread: isBeam ? 0 : currentStats.spread,
      range: currentStats.range,
      cooldown: shotCooldown,
    };

    const res = mobsimFire(
      sim,
      [rayOrigin.x, rayOrigin.y, rayOrigin.z],
      [baseDir.x, baseDir.y, baseDir.z],
      shotConfig
    );

    sim = res.sim;
    stats.pelletsHit += res.hits;
    stats.damageDealt += res.damage;
    stats.mobsDefeated += res.killed.length;

    handleShotHitVFX(rayOrigin, baseDir, res, isBeam);

    if (res.killed.length > 0) {
      const oreReward = 50 * res.killed.length;
      stats.oreCollected += oreReward;
      onOreGathered?.(oreReward);
      audio.playOreChime();
    }

    return { fired: true, hits: res.hits, damage: res.damage, killed: res.killed.length };
  }

  function getMobList(): readonly MobStatus[] {
    return sim.mobs.map((m) => {
      const view = mobViews.get(m.id);
      const y = view ? view.group.position.y : groundHeightAt(m.x, m.z);
      return {
        id: m.id,
        kind: m.kind,
        hp: m.hp,
        maxHp: KINDS[m.kind].hp,
        state: m.state,
        pos: { x: m.x, y, z: m.z },
      };
    });
  }

  function getStats(): CombatStats {
    return { ...stats };
  }

  function step(player?: { x: number; z: number }): void {
    const p = player ?? lastPlayerPos;
    lastPlayerPos = p;
    updateNav(p);
    for (const m of sim.mobs) {
      prevMobs.set(m.id, { x: m.x, z: m.z, state: m.state, hp: m.hp });
    }
    sim = mobsimStep(sim, currentNav, p);
    processScheduledShots(p);
  }

  function update(dt: number, playerPos: THREE.Vector3, isMoving: boolean): void {
    particles.update(dt);
    lastPlayerPos = { x: playerPos.x, z: playerPos.z };
    updateNav(lastPlayerPos);

    // Flash light & muzzle quad fade
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flashMesh.visible = false;
        flashLight.intensity = 0;
      }
    }

    // Weapon sway & recoil recovery
    if (equipped) {
      recoilOffset.z = THREE.MathUtils.lerp(recoilOffset.z, 0, Math.min(1, dt * 14));
      recoilPitch = THREE.MathUtils.lerp(recoilPitch, 0, Math.min(1, dt * 16));

      const time = performance.now() * 0.005;
      const swayX = isMoving ? Math.sin(time * 2) * 0.012 : Math.sin(time) * 0.003;
      const swayY = isMoving ? -Math.abs(Math.cos(time * 2)) * 0.01 : Math.cos(time) * 0.003;

      viewmodelGroup.position.set(
        defaultOffset.x + swayX,
        defaultOffset.y + swayY,
        defaultOffset.z + recoilOffset.z
      );
      viewmodelGroup.rotation.set(recoilPitch, -0.06, 0);
    }

    // Advance mob simulation at fixed 30 Hz DT (cap 5 steps a frame)
    accumulator += dt;
    const MAX_STEPS = 5;
    let steps = 0;
    while (accumulator >= DT && steps < MAX_STEPS) {
      for (const m of sim.mobs) {
        prevMobs.set(m.id, { x: m.x, z: m.z, state: m.state, hp: m.hp });
      }
      sim = mobsimStep(sim, currentNav, lastPlayerPos);
      processScheduledShots(lastPlayerPos);
      accumulator -= DT;
      steps++;
    }
    if (steps >= MAX_STEPS) {
      accumulator = 0;
    }

    const alpha = Math.min(1, Math.max(0, accumulator / DT));

    // Ensure any newly appeared mob IDs have views
    syncMobViews();

    // Render each mob interpolated between previous and current state
    for (const m of sim.mobs) {
      const mob = mobViews.get(m.id);
      if (!mob) continue;

      // Animation mixer for 3D MD2 Ogro
      if (mob.mixer) {
        mob.mixer.update(dt);
      }

      // Pain flash fade
      if (mob.painFlash > 0) {
        mob.painFlash -= dt;
      }

      // Interpolate position
      if (m.state === 'death') {
        const cy = groundHeightAt(m.x, m.z);
        mob.group.position.set(m.x, cy, m.z);
      } else {
        const prev = prevMobs.get(m.id) ?? { x: m.x, z: m.z, state: m.state, hp: m.hp };
        const ix = prev.x + (m.x - prev.x) * alpha;
        const iz = prev.z + (m.z - prev.z) * alpha;
        const iy = groundHeightAt(ix, iz);
        mob.group.position.set(ix, iy, iz);
      }

      // Update orientation and billboarding
      if (mob.kind === 'demon') {
        mob.group.rotation.set(0, 0, 0);
        if (m.state === 'death') {
          mob.mesh.rotation.set(-Math.PI / 2, 0, 0);
          mob.mesh.position.y = 0.06;
          mob.healthBar.mesh.visible = false;
        } else {
          mob.mesh.position.y = 1.1;
          const camDx = camera.position.x - mob.group.position.x;
          const camDz = camera.position.z - mob.group.position.z;
          mob.mesh.rotation.set(0, Math.atan2(camDx, camDz), 0);
          mob.healthBar.mesh.quaternion.copy(camera.quaternion);
          mob.healthBar.mesh.visible = true;
        }
      } else {
        if (m.state === 'death') {
          mob.healthBar.mesh.visible = false;
        } else {
          const dx = playerPos.x - mob.group.position.x;
          const dz = playerPos.z - mob.group.position.z;
          const targetYaw = Math.atan2(dx, dz);
          mob.group.rotation.y = THREE.MathUtils.lerp(mob.group.rotation.y, targetYaw, Math.min(1, dt * 8));
          mob.healthBar.mesh.quaternion.copy(camera.quaternion);
          mob.healthBar.mesh.visible = true;
        }
      }

      // Synchronize HP and health bar
      if (mob.hp !== m.hp) {
        mob.hp = m.hp;
        mob.healthBar.update(m.hp, mob.maxHp, `${mob.kind.toUpperCase()} #${mob.id}`);
      }

      // Handle state changes and trigger animations / sounds
      if (mob.state !== m.state) {
        mob.state = m.state;
        mob.animIndex = 0;
        mob.animTimer = 0;

        if (m.state === 'pain') {
          mob.painFlash = 0.15;
          audio.playPainGrunt();
          if (mob.actions) {
            mob.actions.get('run')?.stop();
            mob.actions.get('attack')?.stop();
            const painAction = mob.actions.get('pain_a') ?? mob.actions.get('pain_b');
            if (painAction) {
              painAction.reset();
              painAction.setLoop(THREE.LoopOnce, 1);
              painAction.play();
            }
          }
        } else if (m.state === 'attack') {
          audio.playAttackBite();
          if (mob.actions) {
            mob.actions.get('run')?.stop();
            mob.actions.get('pain_a')?.stop();
            mob.actions.get('attack')?.reset().play();
          }
        } else if (m.state === 'chase') {
          if (mob.actions) {
            mob.actions.get('attack')?.stop();
            mob.actions.get('pain_a')?.stop();
            mob.actions.get('run')?.reset().play();
          }
        } else if (m.state === 'death') {
          audio.playDeathRoar();
          mob.healthBar.mesh.visible = false;
          if (mob.kind === 'demon') {
            mob.mesh.rotation.set(-Math.PI / 2, 0, 0);
            mob.mesh.position.y = 0.06;
          }
          if (mob.actions) {
            mob.actions.get('run')?.stop();
            mob.actions.get('attack')?.stop();
            mob.actions.get('pain_a')?.stop();
            const deathAction = mob.actions.get('death_a');
            if (deathAction) {
              deathAction.reset();
              deathAction.setLoop(THREE.LoopOnce, 1);
              deathAction.clampWhenFinished = true;
              deathAction.play();
            }
          }
          particles.burst(mob.group.position, 24, 0x10b981, 5.0);
        }
      }

      // Update DOOM Demon sprite frames
      if (mob.kind === 'demon' && mob.sprites) {
        let targetTex: THREE.Texture | null = null;
        if (m.state === 'death') {
          mob.animTimer = (mob.animTimer ?? 0) + dt;
          if (mob.animTimer >= 0.14) {
            mob.animTimer = 0;
            if ((mob.animIndex ?? 0) < mob.sprites.death.length - 1) {
              mob.animIndex = (mob.animIndex ?? 0) + 1;
            }
          }
          targetTex = mob.sprites.death[mob.animIndex ?? 0] ?? null;
        } else if (m.state === 'pain') {
          targetTex = mob.sprites.pain[0] ?? null;
        } else if (m.state === 'attack') {
          mob.animTimer = (mob.animTimer ?? 0) + dt;
          if (mob.animTimer >= 0.18) {
            mob.animTimer = 0;
            const prevIdx = mob.animIndex ?? 0;
            mob.animIndex = (prevIdx + 1) % mob.sprites.attack.length;
            if (mob.animIndex === 1) {
              audio.playAttackBite();
            }
          }
          targetTex = mob.sprites.attack[mob.animIndex ?? 0] ?? null;
        } else {
          // Walk / Chase
          mob.animTimer = (mob.animTimer ?? 0) + dt;
          if (mob.animTimer >= 0.16) {
            mob.animTimer = 0;
            mob.animIndex = ((mob.animIndex ?? 0) + 1) % mob.sprites.walk.length;
          }
          targetTex = mob.sprites.walk[mob.animIndex ?? 0] ?? null;
        }

        if (targetTex && mob.mesh.material) {
          const mat = mob.mesh.material as THREE.MeshStandardMaterial & { uniforms?: any };
          if (mat.map !== targetTex) {
            mat.map = targetTex;
          }
          if (mat.uniforms?.uMap) {
            mat.uniforms.uMap.value = targetTex;
          }
        }
      }
    }
  }

  function dispose(): void {
    clearMobs();
    camera.remove(viewmodelGroup);
    particles.dispose(planetScene);
  }

  return {
    isEquipped,
    equip,
    fire,
    spawnOgro,
    spawnDemon,
    spawnDirect,
    clearMobs,
    setFidelityStage,
    getMobList,
    getStats,
    getAmmo,
    reload,
    setWeaponStats,
    getWeaponStats,
    setTrigger,
    update,
    dispose,
    setBase,
    setIsOnPlanet,
    getSim,
    hashSim,
    resetSim,
    getNav,
    step,
  };
}
