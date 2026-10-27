/**
 * Overwatch, the in-game AI companion (Plan 48), as a drone (Plan 50). The body is the `DRONE_KIT` (kit-drone.ts): a
 * square-section quad drone with visible rotors, so its hovering is believable, and a violet lens at the nose. It always
 * flies (it lands only when told to), glides straight at its mark, leans into its travel, and its rotors spin on their own
 * pivots. This file is the body and the flight: the fast combat brain is companion-combat.ts (the scene steps it and hands
 * this body a station, an aim and its shots), and the slow brain is whatever AI is on the Neural Bridge.
 */
import * as THREE from 'three';
import { AVATAR_LIGHT_LAYER } from '../avatar/scientist/scientist-model';
import { buildKitPreset } from './kit-build';
import { DRONE_CENTRE_Y, DRONE_KIT, DRONE_MUZZLE, DRONE_NOZZLES, DRONE_ROTOR_PIVOTS, isDroneRotor } from './kit-drone';
import { DEFAULT_COMBAT_ORDERS, type CombatOrders } from './companion-combat';

export type CompanionBehaviorState = 'idle' | 'follow' | 'goto' | 'gesture' | 'hover' | 'guard' | 'engage';

export interface CompanionCommand {
  readonly action: 'follow' | 'goto' | 'say' | 'gesture' | 'hover-at' | 'hold' | 'ground' | 'land';
  readonly target?: { readonly x: number; readonly z: number };
  readonly text?: string;
  readonly gesture?: 'wave' | 'cheer' | 'point';
}

export interface CompanionState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly state: CompanionBehaviorState;
  /** True while the companion holds at the player's eye level ("float in front of me") instead of its cruise height. */
  readonly hover: boolean;
  /** True once it has set down on its skids ("land"); the next move order takes off again. */
  readonly landed: boolean;
  readonly speech: string | null;
}

export interface CompanionEntity {
  readonly group: THREE.Group;
  getState: () => CompanionState;
  say: (text: string, durationSec?: number) => void;
  followPlayer: () => void;
  goto: (x: number, z: number) => void;
  /** Floats to (x, z) at eye level and faces the player on arrival (owner feedback: "float in front of me"). */
  hoverAt: (x: number, z: number) => void;
  /** Floats in place at eye level, facing the player. */
  hoverHold: () => void;
  /** Guard: holds station where it is at cruise height and watches the player. */
  holdPosition: () => void;
  /** Sets down on its skids where it is. */
  ground: () => void;
  playGesture: (gesture: 'wave' | 'cheer' | 'point') => void;
  executeCommand: (cmd: CompanionCommand) => void;
  /** The standing combat orders the fast brain follows (Plan 50): mode, focus target and cover side. */
  getCombatOrders: () => CombatOrders;
  setCombatOrders: (orders: Partial<CombatOrders>) => void;
  /**
   * The fast brain's hold on the body, once a frame while it fights: the station to fly to (or null to fly its normal
   * order), and the yaw to aim at (or null). A station puts the drone in the `engage` state until it is released.
   */
  setCombat: (station: { readonly x: number; readonly z: number } | null, aimYaw: number | null) => void;
  /** Shows a shot: the muzzle flash and a tracer to `to` (world space). */
  showShot: (to: { readonly x: number; readonly y: number; readonly z: number }, hit: boolean) => void;
  /** The muzzle in world space (where a shot leaves from). */
  muzzle: () => THREE.Vector3;
  /** Which propulsion module it flies on: rotors in air (the lab), thrusters in vacuum (the Moon). */
  setEnvironment: (env: 'air' | 'vacuum') => void;
  step: (
    dt: number,
    player: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number },
    floorHeight: (x: number, z: number) => number
  ) => void;
  dispose: () => void;
}

const COMPANION_NAME = 'Overwatch';
const COMPANION_ROLE = 'Co-Builder';
const VIOLET_AURA = '#b84dff';

/** Creates a 3D billboard canvas sprite showing the companion's nameplate and live speech bubble. */
function createNameplateSprite(): {
  readonly sprite: THREE.Sprite;
  readonly update: (speech: string | null) => void;
  readonly dispose: () => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.2, 0.6, 1);
  sprite.position.set(0, 0.62, 0);
  sprite.layers.enable(AVATAR_LIGHT_LAYER);

  const draw = (speech: string | null): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If companion is speaking, draw floating speech bubble
    if (speech) {
      ctx.fillStyle = 'rgba(15, 10, 25, 0.88)';
      ctx.strokeStyle = VIOLET_AURA;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(16, 16, 480, 130, 16);
      ctx.fill();
      ctx.stroke();

      // Text styling
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Simple word wrapping
      const words = speech.split(' ');
      let line = '';
      const lines: string[] = [];
      for (const w of words) {
        const testLine = line + (line ? ' ' : '') + w;
        if (ctx.measureText(testLine).width > 440) {
          lines.push(line);
          line = w;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);

      const startY = 80 - ((lines.length - 1) * 26) / 2;
      lines.slice(0, 4).forEach((l, idx) => {
        ctx.fillText(l, 256, startY + idx * 26);
      });
    }

    // Nameplate Badge (drawn at bottom)
    const badgeY = speech ? 180 : 120;
    ctx.fillStyle = 'rgba(10, 14, 28, 0.85)';
    ctx.strokeStyle = 'rgba(184, 77, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(86, badgeY, 340, 46, 23);
    ctx.fill();
    ctx.stroke();

    // Glowing Violet Indicator Orb
    ctx.fillStyle = VIOLET_AURA;
    ctx.beginPath();
    ctx.arc(114, badgeY + 23, 7, 0, Math.PI * 2);
    ctx.fill();

    // Name + Role Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(COMPANION_NAME, 132, badgeY + 28);

    ctx.fillStyle = VIOLET_AURA;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`· ${COMPANION_ROLE}`, 132 + ctx.measureText(COMPANION_NAME).width + 6, badgeY + 28);

    texture.needsUpdate = true;
  };

  draw(null);

  return {
    sprite,
    update: draw,
    dispose: () => {
      material.dispose();
      texture.dispose();
    },
  };
}

/** The skids' height above the ground while cruising: the hull's middle just under the player's eye line, in view, not in the way. */
export const DRONE_CRUISE_ALT_M = 1.2;
/** The skids' height for "float in front of me": the lens at the player's eye level (1.68 m). */
export const DRONE_HOVER_ALT_M = 1.68 - DRONE_CENTRE_Y - 0.06;
/** Formation: ahead and to the right, about 28 degrees off the aim: in view (clear of the HUD's right-hand column), outside the 15 degree keep-out cone. */
export const DRONE_FOLLOW_RIGHT_M = 1.1;
export const DRONE_FOLLOW_AHEAD_M = 2.1;
const MAX_SPEED = 7.0;
const ACCEL = 4.0;

/** The drone's own look: steel and gunmetal, dark rotors, the Ray-7 violet lens and nav lamps lit. */
function droneMaterials(): Record<string, THREE.MeshStandardMaterial> {
  return {
    gunmetal: new THREE.MeshStandardMaterial({ color: '#4b525b', metalness: 0.7, roughness: 0.38 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#2b3038', metalness: 0.6, roughness: 0.5 }),
    rotor: new THREE.MeshStandardMaterial({ color: '#1b1e23', metalness: 0.3, roughness: 0.6 }),
    violet: new THREE.MeshStandardMaterial({ color: '#2a0f3d', emissive: VIOLET_AURA, emissiveIntensity: 2.0, roughness: 0.3 }),
  };
}

/**
 * Spawns Overwatch: the drone body, its nameplate and speech, formation flight and the hooks the combat brain drives.
 * Async for its callers' sake (the body is code now, so it is ready at once).
 */
export async function createCompanionEntity(
  initialPos = { x: 0, y: 0, z: 0, yaw: 0 }
): Promise<CompanionEntity> {
  const holder = new THREE.Group();
  holder.name = 'companion-holder';
  holder.position.set(initialPos.x, initialPos.y, initialPos.z);

  // 1. The body: the kit without its blades, then each blade on its own pivot so it can spin
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
  const materials = droneMaterials();
  for (const m of Object.values(materials)) keep(m);
  const body = new THREE.Group();
  body.name = 'companion-drone';
  holder.add(body);
  // the air module (rotors) and the vacuum module (thrusters with plumes); the scene says which world it is in
  const airBody = new THREE.Group();
  airBody.name = 'drone-air';
  const vacuumBody = new THREE.Group();
  vacuumBody.name = 'drone-vacuum';
  body.add(airBody, vacuumBody);
  const airFrame = buildKitPreset(DRONE_KIT, 'drone', { materials, gen: () => null, maxRank: 2, skip: isDroneRotor, keep });
  if (airFrame) airBody.add(airFrame.group);
  const vacuumFrame = buildKitPreset(DRONE_KIT, 'drone-vacuum', { materials, gen: () => null, maxRank: 2, keep });
  if (vacuumFrame) vacuumBody.add(vacuumFrame.group);
  const rotors: THREE.Group[] = [];
  for (const pivot of DRONE_ROTOR_PIVOTS) {
    const p = new THREE.Group();
    p.position.set(pivot.at[0], pivot.at[1], pivot.at[2]);
    const blade = buildKitPreset(DRONE_KIT, 'drone-rotor', { materials, gen: () => null, maxRank: 2, keep });
    if (blade) p.add(blade.group);
    airBody.add(p);
    rotors.push(p);
  }
  // a pixel plume under each nozzle: three stacked squares that flicker, shown only while the thrusters fire
  const plumeMat = keep(new THREE.MeshBasicMaterial({ color: '#c99bff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  const plumeGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const plumes: THREE.Mesh[] = [];
  for (const n of DRONE_NOZZLES) {
    for (let k = 0; k < 3; k++) {
      const q = new THREE.Mesh(plumeGeo, plumeMat);
      const s = 0.05 - k * 0.012;
      q.scale.set(s, s, s);
      q.position.set(n.at[0], n.at[1] - 0.03 - k * 0.045, n.at[2]);
      vacuumBody.add(q);
      plumes.push(q);
    }
  }
  let environment: 'air' | 'vacuum' = 'air';
  const setEnvironment = (env: 'air' | 'vacuum'): void => {
    environment = env;
    airBody.visible = env === 'air';
    vacuumBody.visible = env === 'vacuum';
  };
  setEnvironment('air');
  const muzzleLocal = new THREE.Vector3(DRONE_MUZZLE[0], DRONE_MUZZLE[1], DRONE_MUZZLE[2]);

  // 2. Shots: a muzzle flash on the barrel and a tracer in the world, both brief
  const flashMat = keep(new THREE.MeshBasicMaterial({ color: '#f0d4ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const flash = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 0.06, 0.06)), flashMat);
  flash.position.copy(muzzleLocal);
  body.add(flash);
  const tracerMat = keep(new THREE.MeshBasicMaterial({ color: VIOLET_AURA, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const tracer = new THREE.Mesh(keep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5)), tracerMat);
  tracer.name = 'companion-tracer';
  tracer.visible = false;
  tracer.frustumCulled = false;
  let shotAge = Infinity;

  // 3. Nameplate / speech, just above the drone
  const nameplate = createNameplateSprite();
  holder.add(nameplate.sprite);

  // Companion state
  let state: CompanionBehaviorState = 'follow';
  let hoverMode = false;
  let landed = false;
  let speechText: string | null = null;
  let speechTimerSec = 0;
  let targetCoord: { x: number; z: number } | null = null;
  let currentYaw = initialPos.yaw;
  let altitude = DRONE_CRUISE_ALT_M;
  const velocity = new THREE.Vector2(0, 0);
  let gesture: { kind: 'wave' | 'cheer' | 'point'; t: number; resume: CompanionBehaviorState } | null = null;
  let combatStation: { x: number; z: number } | null = null;
  let aimYaw: number | null = null;
  let orders: CombatOrders = { ...DEFAULT_COMBAT_ORDERS };
  let clock = 0;

  const say = (text: string, durationSec = 5.0): void => {
    speechText = text;
    speechTimerSec = durationSec;
    nameplate.update(speechText);
  };
  const takeOff = (): void => { landed = false; };
  const followPlayer = (): void => { takeOff(); state = 'follow'; hoverMode = false; targetCoord = null; };
  const goto = (x: number, z: number): void => { takeOff(); state = 'goto'; hoverMode = false; targetCoord = { x, z }; };
  const hoverAt = (x: number, z: number): void => { takeOff(); state = 'goto'; hoverMode = true; targetCoord = { x, z }; };
  const hoverHold = (): void => { takeOff(); state = 'hover'; hoverMode = true; targetCoord = null; };
  const holdPosition = (): void => { takeOff(); state = 'guard'; hoverMode = false; targetCoord = null; };
  const ground = (): void => {
    hoverMode = false;
    landed = true;
    targetCoord = null;
    if (state !== 'gesture') state = 'guard';
  };
  const playGesture = (kind: 'wave' | 'cheer' | 'point'): void => {
    gesture = { kind, t: 0, resume: state === 'gesture' ? 'follow' : state };
    state = 'gesture';
  };
  const executeCommand = (cmd: CompanionCommand): void => {
    if (cmd.text) say(cmd.text);
    if (cmd.action === 'follow') followPlayer();
    else if (cmd.action === 'goto' && cmd.target) goto(cmd.target.x, cmd.target.z);
    else if (cmd.action === 'hover-at' && cmd.target) hoverAt(cmd.target.x, cmd.target.z);
    else if (cmd.action === 'hover-at') hoverHold();
    else if (cmd.action === 'hold') holdPosition();
    else if (cmd.action === 'ground' || cmd.action === 'land') ground();
    else if (cmd.action === 'gesture' && cmd.gesture) playGesture(cmd.gesture);
  };
  /** What the drone was doing when a fight took it (it goes back to that after). */
  let engageFrom: CompanionBehaviorState = 'follow';
  const setCombat = (station: { readonly x: number; readonly z: number } | null, yaw: number | null): void => {
    // a landed drone neither turns nor fights
    aimYaw = landed ? null : yaw;
    // the fight only moves a drone that is flying formation: a hold, a hover or an errand keeps its place and fires from there
    const free = state === 'follow' || state === 'idle' || state === 'engage';
    if (station && !landed && free) {
      combatStation = { x: station.x, z: station.z };
      if (state !== 'engage') {
        engageFrom = state;
        state = 'engage';
      }
      return;
    }
    if (!station) {
      combatStation = null;
      if (state === 'engage') state = engageFrom;
      else if (gesture && gesture.resume === 'engage') gesture.resume = engageFrom;
    }
  };
  const muzzle = (): THREE.Vector3 => {
    holder.updateMatrixWorld(true);
    return body.localToWorld(muzzleLocal.clone());
  };
  const showShot = (to: { readonly x: number; readonly y: number; readonly z: number }, hit: boolean): void => {
    const from = muzzle();
    const parent = holder.parent;
    if (parent && tracer.parent !== parent) parent.add(tracer);
    const d = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
    const len = Math.max(0.05, d.length());
    tracer.position.copy(from);
    tracer.lookAt(to.x, to.y, to.z);
    tracer.scale.set(hit ? 0.03 : 0.018, hit ? 0.03 : 0.018, len);
    tracer.visible = true;
    shotAge = 0;
  };

  const yawTo = (target: number, rate: number, dt: number): void => {
    const diff = Math.atan2(Math.sin(target - currentYaw), Math.cos(target - currentYaw));
    currentYaw += diff * Math.min(1.0, dt * rate);
  };

  const step = (
    dt: number,
    player: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number },
    floorHeight: (x: number, z: number) => number
  ): void => {
    clock += dt;
    if (speechText) {
      speechTimerSec -= dt;
      if (speechTimerSec <= 0) {
        speechText = null;
        nameplate.update(null);
      }
    }

    // 1. Where to fly: the combat station, the order's mark, or the formation point off the player's right shoulder
    const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw), rightZ = -Math.sin(player.yaw);
    let dest: { x: number; z: number } | null = null;
    let stop = 0.2;
    if (state === 'engage' && combatStation) dest = combatStation;
    else if (state === 'follow') {
      dest = { x: player.x + rightX * DRONE_FOLLOW_RIGHT_M + fwdX * DRONE_FOLLOW_AHEAD_M, z: player.z + rightZ * DRONE_FOLLOW_RIGHT_M + fwdZ * DRONE_FOLLOW_AHEAD_M };
      stop = 0.35;
    } else if (state === 'goto' && targetCoord) {
      dest = targetCoord;
      stop = hoverMode ? 0.12 : 0.3;
    }

    // 2. Glide: velocity eases toward a capped speed at the mark, so it arrives without overshoot (landed: it stays put)
    let desiredX = 0, desiredZ = 0;
    if (dest && !landed) {
      const dx = dest.x - holder.position.x, dz = dest.z - holder.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > stop) {
        const speed = Math.min(MAX_SPEED, dist * 2.2);
        desiredX = (dx / dist) * speed;
        desiredZ = (dz / dist) * speed;
      } else if (state === 'goto') {
        state = hoverMode ? 'hover' : 'idle';
      }
    }
    const k = Math.min(1, dt * ACCEL);
    velocity.x += (desiredX - velocity.x) * k;
    velocity.y += (desiredZ - velocity.y) * k;
    holder.position.x += velocity.x * dt;
    holder.position.z += velocity.y * dt;
    const speed = velocity.length();

    // 3. Facing: the aim while it fights, its travel while it moves fast, else the player
    const toPlayer = Math.atan2(player.x - holder.position.x, player.z - holder.position.z);
    if (aimYaw !== null) yawTo(aimYaw, 10, dt);
    else if (speed > 0.8) yawTo(Math.atan2(velocity.x, velocity.y), 6, dt);
    else if (!landed) yawTo(toPlayer, state === 'guard' ? 3 : 5, dt);
    holder.rotation.y = currentYaw;

    // 4. Height: cruise, eye level for a hover order, the ground once landed; a slow bob while it holds still
    const altTarget = landed ? 0 : hoverMode ? DRONE_HOVER_ALT_M : DRONE_CRUISE_ALT_M;
    altitude += (altTarget - altitude) * Math.min(1, dt * 3.5);
    if (Math.abs(altitude - altTarget) < 0.005) altitude = altTarget;
    const bob = !landed && speed < 0.3 ? 0.025 * Math.sin(clock * Math.PI * 1.2) : 0;
    holder.position.y = floorHeight(holder.position.x, holder.position.z) + altitude + bob;

    // 5. The body leans into its travel (nose down going forward, banked into a sideways move) and gestures on top
    const fwdSpeed = velocity.x * Math.sin(currentYaw) + velocity.y * Math.cos(currentYaw);
    const sideSpeed = velocity.x * Math.cos(currentYaw) - velocity.y * Math.sin(currentYaw);
    let pitch = THREE.MathUtils.clamp(fwdSpeed * 0.06, -0.35, 0.35);
    let roll = THREE.MathUtils.clamp(-sideSpeed * 0.06, -0.35, 0.35);
    let spin = 0;
    if (gesture) {
      gesture.t += dt;
      const g = gesture;
      if (g.kind === 'wave') roll += 0.35 * Math.sin(g.t * Math.PI * 4.4);
      else if (g.kind === 'cheer') spin = Math.min(1, g.t / 0.8) * Math.PI * 2;
      else pitch += 0.35 * Math.sin(Math.min(1, g.t / 0.7) * Math.PI);
      const length = g.kind === 'wave' ? 0.9 : g.kind === 'cheer' ? 0.8 : 0.7;
      if (g.t >= length) {
        state = g.resume === 'gesture' ? 'follow' : g.resume;
        gesture = null;
        spin = 0;
      }
    }
    body.rotation.set(pitch, spin, roll, 'YXZ');

    // 6. Rotors: full speed in the air, spun down on the ground (alternate pairs turn opposite ways)
    const flying = !(landed && altitude < 0.02);
    const rpm = flying ? 42 : 0;
    if (environment === 'air') rotors.forEach((r, i) => { r.rotation.y += dt * rpm * (i === 0 || i === 3 ? 1 : -1); });
    else {
      // the plumes burn harder while it climbs or moves, and go out once it has landed
      const thrust = flying ? Math.min(1, 0.55 + speed * 0.08 + Math.max(0, altTarget - altitude) * 0.6) : 0;
      plumes.forEach((q, i) => {
        q.visible = thrust > 0;
        const flicker = 0.8 + 0.2 * Math.sin(clock * 37 + i * 1.7);
        const s = (0.05 - (i % 3) * 0.012) * thrust * flicker;
        q.scale.set(s, s * 1.3, s);
      });
    }

    // 7. The last shot's flash and tracer fade
    if (shotAge < 1) {
      shotAge += dt;
      flashMat.opacity = Math.max(0, 1 - shotAge / 0.06);
      tracerMat.opacity = Math.max(0, 0.9 * (1 - shotAge / 0.09));
      if (shotAge >= 0.09) tracer.visible = false;
    }
  };

  const getState = (): CompanionState => ({
    x: holder.position.x,
    y: holder.position.y,
    z: holder.position.z,
    yaw: currentYaw,
    state,
    hover: hoverMode,
    landed,
    speech: speechText,
  });

  const dispose = (): void => {
    nameplate.dispose();
    tracer.removeFromParent();
    for (const o of owned) o.dispose();
    holder.removeFromParent();
  };

  return {
    group: holder,
    getState,
    say,
    followPlayer,
    goto,
    hoverAt,
    hoverHold,
    holdPosition,
    ground,
    playGesture,
    executeCommand,
    getCombatOrders: () => orders,
    setCombatOrders: (next) => { orders = { ...orders, ...next }; },
    setCombat,
    showShot,
    muzzle,
    setEnvironment,
    step,
    dispose,
  };
}
