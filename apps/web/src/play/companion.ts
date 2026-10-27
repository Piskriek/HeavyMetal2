import * as THREE from 'three';
import { createScientistInstance, AVATAR_LIGHT_LAYER } from '../avatar/scientist/scientist-model';
import { loadScientistAnimations } from '../avatar/scientist/anims-loader';
import { loadRifleAnimations } from '../avatar/astro/rifle-clips';
import { createScientistAnimator, type ScientistAnimator, type OneShotKind } from '../avatar/scientist/animator';

export type CompanionBehaviorState = 'idle' | 'follow' | 'goto' | 'gesture';

export interface CompanionCommand {
  readonly action: 'follow' | 'goto' | 'say' | 'gesture';
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
  readonly speech: string | null;
}

export interface CompanionEntity {
  readonly group: THREE.Group;
  getState: () => CompanionState;
  say: (text: string, durationSec?: number) => void;
  followPlayer: () => void;
  goto: (x: number, z: number) => void;
  playGesture: (gesture: 'wave' | 'cheer' | 'point') => void;
  executeCommand: (cmd: CompanionCommand) => void;
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
  sprite.scale.set(2.4, 1.2, 1);
  sprite.position.set(0, 2.25, 0);
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

/**
 * Spawns the autonomous In-Game AI Companion with real locomotion,
 * speech bubble billboard, and formation follow AI.
 */
export async function createCompanionEntity(
  initialPos = { x: 0, y: 0, z: 0, yaw: 0 }
): Promise<CompanionEntity> {
  const holder = new THREE.Group();
  holder.name = 'companion-holder';
  holder.position.set(initialPos.x, initialPos.y, initialPos.z);
  holder.rotation.y = initialPos.yaw;

  // 1. Instance character mesh with Ray-7 Violet Visor
  const { group: characterMesh } = await createScientistInstance(VIOLET_AURA, 'high');
  holder.add(characterMesh);

  // 2. Load animations
  const [clips, rifleClips] = await Promise.all([loadScientistAnimations(), loadRifleAnimations()]);
  const allClips = new Map([...clips, ...rifleClips]);
  const animator: ScientistAnimator = createScientistAnimator(characterMesh, allClips);

  // 3. Mount Nameplate / Speech Sprite
  const nameplate = createNameplateSprite();
  holder.add(nameplate.sprite);

  // Companion State
  let state: CompanionBehaviorState = 'follow';
  let speechText: string | null = null;
  let speechTimerSec = 0;
  let targetCoord: { x: number; z: number } | null = null;
  let currentYaw = initialPos.yaw;

  const say = (text: string, durationSec = 5.0): void => {
    speechText = text;
    speechTimerSec = durationSec;
    nameplate.update(speechText);
  };

  const followPlayer = (): void => {
    state = 'follow';
    targetCoord = null;
  };

  const goto = (x: number, z: number): void => {
    state = 'goto';
    targetCoord = { x, z };
  };

  const playGesture = (gesture: 'wave' | 'cheer' | 'point'): void => {
    state = 'gesture';
    animator.playOneShot(gesture as OneShotKind, () => {
      state = 'follow';
    });
  };

  const executeCommand = (cmd: CompanionCommand): void => {
    if (cmd.text) say(cmd.text);
    if (cmd.action === 'follow') followPlayer();
    else if (cmd.action === 'goto' && cmd.target) goto(cmd.target.x, cmd.target.z);
    else if (cmd.action === 'gesture' && cmd.gesture) playGesture(cmd.gesture);
  };

  const step = (
    dt: number,
    player: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number },
    floorHeight: (x: number, z: number) => number
  ): void => {
    // 1. Handle speech decay
    if (speechText) {
      speechTimerSec -= dt;
      if (speechTimerSec <= 0) {
        speechText = null;
        nameplate.update(null);
      }
    }

    // 2. Determine target position
    let destX = holder.position.x;
    let destZ = holder.position.z;
    let stopDistance = 1.6;

    if (state === 'follow') {
      // Formation: shadow player at 3.0m on right shoulder
      const rightX = Math.cos(player.yaw);
      const rightZ = -Math.sin(player.yaw);
      const forwardX = -Math.sin(player.yaw);
      const forwardZ = -Math.cos(player.yaw);

      // Target = 1.8m right, 2.5m behind player
      destX = player.x + rightX * 1.8 - forwardX * 2.5;
      destZ = player.z + rightZ * 1.8 - forwardZ * 2.5;
      stopDistance = 1.4;
    } else if (state === 'goto' && targetCoord) {
      destX = targetCoord.x;
      destZ = targetCoord.z;
      stopDistance = 0.5;
    }

    const dx = destX - holder.position.x;
    const dz = destZ - holder.position.z;
    const dist = Math.hypot(dx, dz);

    let forwardInput = 0;
    let run = false;

    if (dist > stopDistance) {
      // Move towards destination
      const targetYaw = Math.atan2(dx, dz);
      // Smooth yaw slew
      const yawDiff = Math.atan2(Math.sin(targetYaw - currentYaw), Math.cos(targetYaw - currentYaw));
      currentYaw += yawDiff * Math.min(1.0, dt * 7.0);
      holder.rotation.y = currentYaw;

      // Speed selection
      if (dist > 5.5) {
        run = true;
        forwardInput = 1.0;
        const speed = 5.2 * dt;
        holder.position.x += Math.sin(currentYaw) * speed;
        holder.position.z += Math.cos(currentYaw) * speed;
      } else {
        run = false;
        forwardInput = 1.0;
        const speed = 2.6 * dt;
        holder.position.x += Math.sin(currentYaw) * speed;
        holder.position.z += Math.cos(currentYaw) * speed;
      }
    } else {
      // Stopped: face the player if following
      if (state === 'follow') {
        const toPlayerYaw = Math.atan2(player.x - holder.position.x, player.z - holder.position.z);
        const yawDiff = Math.atan2(Math.sin(toPlayerYaw - currentYaw), Math.cos(toPlayerYaw - currentYaw));
        currentYaw += yawDiff * Math.min(1.0, dt * 4.0);
        holder.rotation.y = currentYaw;
      } else if (state === 'goto') {
        state = 'idle';
      }
    }

    // 3. Ground height clamp
    const groundY = floorHeight(holder.position.x, holder.position.z);
    holder.position.y = groundY;

    // 4. Step animation mixer
    animator.update(dt, {
      forward: forwardInput,
      strafe: 0,
      run,
    });
  };

  const getState = (): CompanionState => ({
    x: holder.position.x,
    y: holder.position.y,
    z: holder.position.z,
    yaw: currentYaw,
    state,
    speech: speechText,
  });

  const dispose = (): void => {
    nameplate.dispose();
    animator.dispose();
    holder.removeFromParent();
  };

  return {
    group: holder,
    getState,
    say,
    followPlayer,
    goto,
    playGesture,
    executeCommand,
    step,
    dispose,
  };
}
