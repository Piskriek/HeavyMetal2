/**
 * Monster Mash Combat & Spawning Subsystem for SetMix.
 * Allows equipping retro weapons (Shotgun), spawning shareware mobs (Quake 2 Ogro & DOOM Demon)
 * onto the planet surface, shooting them with hitscan raycasts, triggering recoil, pain flinches,
 * death animations, particle impacts, and fidelity stage adaptation.
 */
import * as THREE from 'three';
import { parseMd2, createMd2Mesh, type Md2ParsedModel } from '@hm/shareware';
import { parseWad, extractPatch, extractPlaypal } from '@hm/shareware';
import { createFidelityMobMaterial, type FidelityStage } from '@hm/shareware';

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
  fire(playerPos?: THREE.Vector3, cameraDir?: THREE.Vector3): { fired: boolean; hits: number; damage: number; killed: number };
  spawnOgro(count?: number, customPos?: { x: number; z: number }): Promise<void>;
  spawnDemon(count?: number, customPos?: { x: number; z: number }): Promise<void>;
  clearMobs(): void;
  setFidelityStage(stage: number): void;
  getMobList(): readonly MobStatus[];
  getStats(): CombatStats;
  getAmmo(): { current: number; max: number };
  reload(): void;
  update(dt: number, playerPos: THREE.Vector3, isMoving: boolean): void;
  dispose(): void;
}

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
interface MobEntity {
  readonly id: number;
  readonly kind: MobKind;
  group: THREE.Group;
  mesh: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  actions?: Map<string, THREE.AnimationAction>;
  hp: number;
  maxHp: number;
  state: MobState;
  stateTimer: number;
  speed: number;
  hitRadius: number;
  height: number;
  healthBar: ReturnType<typeof createHealthBarCanvas>;
  material: THREE.ShaderMaterial;
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
}): MonsterMashCombatManager {
  const { planetScene, camera, groundHeightAt, onOreGathered } = options;
  const audio = new CombatAudio();
  const particles = new ParticleSystem(planetScene);

  let stage: FidelityStage = (options.initialStage ?? 1) as FidelityStage;
  let equipped = false;
  let currentAmmo = 8;
  const maxAmmo = 8;
  let cooldownTimer = 0;
  let nextMobId = 1;

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

  // Cached assets
  let ogroModelCache: Md2ParsedModel | null = null;
  let ogroTextureCache: THREE.Texture | null = null;
  let demonTextureCache: THREE.Texture | null = null;

  const mobs: MobEntity[] = [];

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

  // Helper to load DOOM Demon sprite from WAD
  async function loadDemonTexture(): Promise<THREE.Texture> {
    if (demonTextureCache) return demonTextureCache;

    try {
      const res = await fetch('./shareware/doom1.wad');
      if (!res.ok) throw new Error('Failed to fetch doom1.wad');
      const buf = await res.arrayBuffer();
      const wad = parseWad(buf);
      const pal = extractPlaypal(wad);
      const patch = extractPatch(wad, 'SARGA1', pal);

      const canvas = document.createElement('canvas');
      canvas.width = patch.width;
      canvas.height = patch.height;
      const ctx = canvas.getContext('2d')!;
      const imgData = ctx.createImageData(patch.width, patch.height);
      imgData.data.set(patch.data);
      ctx.putImageData(imgData, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      demonTextureCache = texture;
      return texture;
    } catch (e) {
      console.warn('WAD load failed, generating fallback Demon sprite:', e);
      // Fallback procedural retro monster sprite
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(16, 12, 32, 40);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(20, 20, 8, 8); // eye
      ctx.fillRect(36, 20, 8, 8); // eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(24, 38, 16, 6); // fangs
      const texture = new THREE.CanvasTexture(canvas);
      demonTextureCache = texture;
      return texture;
    }
  }

  function setFidelityStage(newStage: number): void {
    stage = Math.max(0, Math.min(4, newStage)) as FidelityStage;
    for (const mob of mobs) {
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

  function getAmmo(): { current: number; max: number } {
    return { current: currentAmmo, max: maxAmmo };
  }

  function reload(): void {
    currentAmmo = maxAmmo;
    audio.playEquip();
  }

  async function spawnOgro(count = 1, customPos?: { x: number; z: number }): Promise<void> {
    try {
      const { model, texture } = await loadOgroModel();

      for (let i = 0; i < count; i++) {
        const mobId = nextMobId++;
        const { mesh, mixer, actions } = createMd2Mesh(model, texture);

        const material = createFidelityMobMaterial({ map: texture, stage });
        mesh.material = material;

        // Scale Ogro to ~2.2m tall
        mesh.scale.set(0.045, 0.045, 0.045);
        mesh.rotateX(-Math.PI / 2); // Quake coordinate alignment

        const group = new THREE.Group();
        group.add(mesh);

        // Position on planet ground
        let x = 0, z = 0;
        if (customPos) {
          x = customPos.x + (Math.random() - 0.5) * 4;
          z = customPos.z + (Math.random() - 0.5) * 4;
        } else {
          // Spawn in front of player
          const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          x = camera.position.x + camDir.x * (7 + Math.random() * 4) + (Math.random() - 0.5) * 5;
          z = camera.position.z + camDir.z * (7 + Math.random() * 4) + (Math.random() - 0.5) * 5;
        }
        const y = groundHeightAt(x, z);
        group.position.set(x, y, z);

        // Health bar
        const healthBar = createHealthBarCanvas();
        healthBar.mesh.position.set(0, 2.3, 0);
        group.add(healthBar.mesh);
        healthBar.update(100, 100, `OGRO #${mobId}`);

        planetScene.add(group);

        const entity: MobEntity = {
          id: mobId,
          kind: 'ogro',
          group,
          mesh,
          mixer,
          actions,
          hp: 100,
          maxHp: 100,
          state: 'chase',
          stateTimer: 0,
          speed: 2.8,
          hitRadius: 0.9,
          height: 2.2,
          healthBar,
          material,
          painFlash: 0,
        };

        // Start run animation
        actions.get('run')?.play();
        mobs.push(entity);
        stats.mobsSpawned++;

        // Particles & Audio
        particles.burst(group.position, 16, 0xb46bff, 4.0);
        audio.playSpawn();
      }
    } catch (err) {
      console.error('Failed to spawn Ogro:', err);
    }
  }

  async function spawnDemon(count = 1, customPos?: { x: number; z: number }): Promise<void> {
    try {
      const texture = await loadDemonTexture();

      for (let i = 0; i < count; i++) {
        const mobId = nextMobId++;
        const material = createFidelityMobMaterial({ map: texture, stage });

        const geo = new THREE.PlaneGeometry(1.8, 2.2);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.y = 1.1;

        const group = new THREE.Group();
        group.add(mesh);

        let x = 0, z = 0;
        if (customPos) {
          x = customPos.x + (Math.random() - 0.5) * 4;
          z = customPos.z + (Math.random() - 0.5) * 4;
        } else {
          const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          x = camera.position.x + camDir.x * (8 + Math.random() * 3) + (Math.random() - 0.5) * 4;
          z = camera.position.z + camDir.z * (8 + Math.random() * 3) + (Math.random() - 0.5) * 4;
        }
        const y = groundHeightAt(x, z);
        group.position.set(x, y, z);

        const healthBar = createHealthBarCanvas();
        healthBar.mesh.position.set(0, 2.3, 0);
        group.add(healthBar.mesh);
        healthBar.update(80, 80, `DEMON #${mobId}`);

        planetScene.add(group);

        const entity: MobEntity = {
          id: mobId,
          kind: 'demon',
          group,
          mesh,
          hp: 80,
          maxHp: 80,
          state: 'chase',
          stateTimer: 0,
          speed: 3.2,
          hitRadius: 0.85,
          height: 2.0,
          healthBar,
          material,
          painFlash: 0,
        };

        mobs.push(entity);
        stats.mobsSpawned++;

        particles.burst(group.position, 16, 0xef4444, 4.0);
        audio.playSpawn();
      }
    } catch (err) {
      console.error('Failed to spawn Demon:', err);
    }
  }

  function clearMobs(): void {
    for (const mob of mobs) {
      planetScene.remove(mob.group);
      mob.material.dispose();
      mob.healthBar.texture.dispose();
    }
    mobs.length = 0;
  }

  function fire(
    playerPos?: THREE.Vector3,
    cameraDir?: THREE.Vector3
  ): { fired: boolean; hits: number; damage: number; killed: number } {
    if (!equipped || cooldownTimer > 0) {
      return { fired: false, hits: 0, damage: 0, killed: 0 };
    }

    if (currentAmmo <= 0) {
      reload();
      return { fired: false, hits: 0, damage: 0, killed: 0 };
    }

    currentAmmo--;
    stats.shotsFired++;
    cooldownTimer = 0.52; // Cooldown between shotgun blasts

    // Audio & Recoil
    audio.playShotgunBlast();
    recoilOffset.z = 0.14;
    recoilPitch = 0.08;
    flashTimer = 0.07;
    flashMesh.visible = true;
    flashLight.intensity = 3.5;

    let hits = 0;
    let totalDamage = 0;
    let killed = 0;

    // Shotgun fires 7 pellets in tight spread cone
    const PELLET_COUNT = 7;
    const raycaster = new THREE.Raycaster();
    const rayOrigin = playerPos?.clone() ?? camera.position.clone();
    const baseDir = cameraDir?.clone() ?? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    for (let p = 0; p < PELLET_COUNT; p++) {
      const spreadX = (Math.random() - 0.5) * 0.055;
      const spreadY = (Math.random() - 0.5) * 0.055;
      const pelletDir = baseDir.clone()
        .addScaledVector(camRight, spreadX)
        .addScaledVector(camUp, spreadY)
        .normalize();

      raycaster.set(rayOrigin, pelletDir);
      let closestHit: { mob: MobEntity; dist: number; point: THREE.Vector3 } | null = null;

      for (const mob of mobs) {
        if (mob.state === 'death') continue;

        // Bounding sphere hit test for performance and reliable registration
        const mobCenter = mob.group.position.clone().add(new THREE.Vector3(0, mob.height * 0.5, 0));
        const rayPoint = new THREE.Vector3();
        raycaster.ray.closestPointToPoint(mobCenter, rayPoint);
        const distToRay = rayPoint.distanceTo(mobCenter);

        if (distToRay <= mob.hitRadius) {
          const hitDist = rayOrigin.distanceTo(rayPoint);
          if (hitDist < 60 && (!closestHit || hitDist < closestHit.dist)) {
            closestHit = { mob, dist: hitDist, point: rayPoint };
          }
        }
      }

      if (closestHit) {
        hits++;
        stats.pelletsHit++;
        const pelletDmg = 20 + Math.floor(Math.random() * 10);
        totalDamage += pelletDmg;
        stats.damageDealt += pelletDmg;

        const mob = closestHit.mob;
        mob.hp = Math.max(0, mob.hp - pelletDmg);
        mob.painFlash = 0.15;
        mob.healthBar.update(mob.hp, mob.maxHp, `${mob.kind.toUpperCase()} #${mob.id}`);

        // Blood / spark burst at hit point
        particles.burst(closestHit.point, 6, 0xff3b30, 4.5);

        if (mob.hp <= 0 && mob.state !== 'death') {
          // Death!
          mob.state = 'death';
          mob.stateTimer = 0;
          killed++;
          stats.mobsDefeated++;
          audio.playDeathRoar();

          if (mob.actions) {
            mob.actions.get('run')?.stop();
            mob.actions.get('attack')?.stop();
            const deathAction = mob.actions.get('death_a');
            if (deathAction) {
              deathAction.reset();
              deathAction.setLoop(THREE.LoopOnce, 1);
              deathAction.clampWhenFinished = true;
              deathAction.play();
            }
          }

          // Ore loot reward
          const oreReward = 50;
          stats.oreCollected += oreReward;
          onOreGathered?.(oreReward);
          audio.playOreChime();
          particles.burst(mob.group.position, 24, 0x10b981, 5.0);
        } else if (mob.state !== 'death') {
          // Flinch / Pain
          mob.state = 'pain';
          mob.stateTimer = 0.32;
          audio.playPainGrunt();
          if (mob.actions) {
            const painAction = mob.actions.get('pain_a');
            if (painAction) {
              painAction.reset();
              painAction.setLoop(THREE.LoopOnce, 1);
              painAction.play();
            }
          }
          // Pushback away from blast
          mob.group.position.addScaledVector(pelletDir, 0.45);
        }
      } else {
        // Check ground impact
        for (let d = 2; d < 45; d += 0.8) {
          const pt = rayOrigin.clone().addScaledVector(pelletDir, d);
          const gy = groundHeightAt(pt.x, pt.z);
          if (pt.y <= gy) {
            particles.burst(new THREE.Vector3(pt.x, gy + 0.05, pt.z), 3, 0xf59e0b, 2.5);
            break;
          }
        }
      }
    }

    return { fired: true, hits, damage: totalDamage, killed };
  }

  function getMobList(): readonly MobStatus[] {
    return mobs.map((m) => ({
      id: m.id,
      kind: m.kind,
      hp: m.hp,
      maxHp: m.maxHp,
      state: m.state,
      pos: { x: m.group.position.x, y: m.group.position.y, z: m.group.position.z },
    }));
  }

  function getStats(): CombatStats {
    return { ...stats };
  }

  function update(dt: number, playerPos: THREE.Vector3, isMoving: boolean): void {
    particles.update(dt);

    if (cooldownTimer > 0) {
      cooldownTimer = Math.max(0, cooldownTimer - dt);
    }

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

    // Update active mobs
    for (let i = mobs.length - 1; i >= 0; i--) {
      const mob = mobs[i]!;

      // Animation mixer
      if (mob.mixer) {
        mob.mixer.update(dt);
      }

      // Billboard orientation for Demon sprite and Health Bars
      mob.healthBar.mesh.quaternion.copy(camera.quaternion);
      if (mob.kind === 'demon') {
        mob.mesh.quaternion.copy(camera.quaternion);
      }

      // Pain flash fade
      if (mob.painFlash > 0) {
        mob.painFlash -= dt;
      }

      if (mob.state === 'death') {
        mob.stateTimer += dt;
        // Keep dead corpse on ground
        continue;
      }

      const dx = playerPos.x - mob.group.position.x;
      const dz = playerPos.z - mob.group.position.z;
      const dist = Math.hypot(dx, dz);

      if (mob.state === 'pain') {
        mob.stateTimer -= dt;
        if (mob.stateTimer <= 0) {
          mob.state = 'chase';
          mob.actions?.get('run')?.play();
        }
      } else if (mob.state === 'chase') {
        // Rotate towards player
        const targetYaw = Math.atan2(dx, dz);
        mob.group.rotation.y = THREE.MathUtils.lerp(mob.group.rotation.y, targetYaw, Math.min(1, dt * 8));

        if (dist > 2.0) {
          // Walk towards player
          const moveSpeed = mob.speed * dt;
          mob.group.position.x += Math.sin(targetYaw) * moveSpeed;
          mob.group.position.z += Math.cos(targetYaw) * moveSpeed;
          mob.group.position.y = groundHeightAt(mob.group.position.x, mob.group.position.z);
        } else {
          // Attack range
          mob.state = 'attack';
          mob.actions?.get('run')?.stop();
          mob.actions?.get('attack')?.play();
        }
      } else if (mob.state === 'attack') {
        if (dist > 2.5) {
          mob.state = 'chase';
          mob.actions?.get('attack')?.stop();
          mob.actions?.get('run')?.play();
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
    clearMobs,
    setFidelityStage,
    getMobList,
    getStats,
    getAmmo,
    reload,
    update,
    dispose,
  };
}
