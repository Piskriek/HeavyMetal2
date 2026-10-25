/** Browser beauty capture and drag/drop around @hm/cartlab's single, pure PNG codec. */
import * as THREE from 'three';
import { specOfName } from '@hm/matstack';
import { materialCoverageReport } from './studio-agent-coverage';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  encodeSporeCardPng as encodePng, decodeSporeCardPng, SporeCardSchema, auditSporeCreation,
  type EncodeSporeCardOptions, type SporeCard,
} from '@hm/cartlab';
import { anglePoses } from './four-angle';
import { enqueueOffscreenRender, getSharedOffscreenRenderer } from './offscreen-renderer';
import { releaseLayeredEnv, type LayeredEnv } from '../play/layered-material';
import { buildSporeModel, preloadSporeCreation } from './spore-model';
export { decodeSporeCardPng };
export type { SporeCard, SporeCreation } from '@hm/cartlab';

export interface WebSporeCardOptions extends Omit<EncodeSporeCardOptions, 'beautyPng'> { readonly beautyPng?: Uint8Array }

/** Fit the entire kit inside the art window, leaving badges clear without stretching the beauty render. */
export function frameSporeBeautyCamera(camera: THREE.PerspectiveCamera, bounds: THREE.Box3): void {
  const pose = anglePoses(bounds, camera.fov).front;
  const target = new THREE.Vector3(...pose.target);
  camera.position.set(pose.position[0] + (bounds.max.x - bounds.min.x) * 0.7, pose.position[1], pose.position[2]);
  camera.up.set(0, 1, 0); camera.aspect = 1; camera.lookAt(target);
  const inverse = camera.quaternion.clone().invert();
  const tanHalfFov = Math.tan(camera.fov * Math.PI / 360);
  let distance = 0.1;
  // Solve the perspective inequalities for all eight corners in camera space. The vertical
  // ±.59 window is inside y=88..414; the horizontal ±.9 window leaves the frame's border clear.
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(inverse);
    distance = Math.max(distance, point.z + Math.max(Math.abs(point.x) / (tanHalfFov * 0.9), Math.abs(point.y) / (tanHalfFov * 0.59)));
  }
  distance *= 1.05;
  camera.position.sub(target).normalize().multiplyScalar(distance).add(target);
  camera.far = Math.max(200, distance + bounds.getSize(new THREE.Vector3()).length() * 2);
  camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}

async function captureBeauty(card: SporeCard): Promise<Uint8Array> {
  return enqueueOffscreenRender(async () => {
    await preloadSporeCreation(card.creation);
    const { renderer, scene, camera } = getSharedOffscreenRenderer(512);
    const resources = new Set<{ dispose(): void }>();
    const keep = <T extends { dispose(): void }>(x: T): T => { resources.add(x); return x; };
    const previousEnv = scene.environment;
    let build: ReturnType<typeof buildSporeModel> | null = null;
    let env: LayeredEnv | undefined;
    try {
      const pmrem = keep(new THREE.PMREMGenerator(renderer));
      const room = keep(new RoomEnvironment());
      const envTarget = keep(pmrem.fromScene(room, 0.04));
      env = { map: envTarget.texture, intensity: 0.55 };
      build = buildSporeModel(card.creation, keep, env);
      scene.add(build.group); scene.environment = env.map;
      const bounds = new THREE.Box3().setFromObject(build.group);
      if (bounds.isEmpty()) throw new Error('Spore creation has no beauty geometry');
      frameSporeBeautyCamera(camera, bounds);
      renderer.render(scene, camera);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot create Spore beauty canvas');
      const gradient = ctx.createLinearGradient(0, 0, 512, 512);
      gradient.addColorStop(0, '#182e40'); gradient.addColorStop(1, '#060b13');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(renderer.domElement, 0, 0, 512, 512);
      ctx.fillStyle = '#080f1ee8'; ctx.fillRect(16, 16, 480, 72); ctx.fillRect(16, 414, 480, 82);
      ctx.strokeStyle = '#48dbba'; ctx.lineWidth = 1; ctx.strokeRect(16.5, 16.5, 479, 71); ctx.strokeRect(16.5, 414.5, 479, 81);
      ctx.fillStyle = '#83efce'; ctx.font = '12px monospace'; ctx.fillText(`FIDELITY / ${card.creation.kind.toUpperCase()} / SPORE V1`, 30, 37);
      ctx.fillStyle = '#eff9ff'; ctx.font = 'bold 22px sans-serif'; ctx.fillText(card.title, 30, 67, 450);
      ctx.font = '13px monospace'; ctx.fillText(`BY ${card.author}`, 30, 436, 450);
      const seed = card.creation.kind === 'game' ? card.creation.spec.worldSeed : card.creation.kind === 'creature' ? card.creation.spec.seed : null;
      ctx.fillStyle = '#8babc0'; ctx.font = '10px monospace';
      ctx.fillText(`${auditSporeCreation(card.creation)} / SEED ${seed ?? 'N/A'}`, 30, 456, 450);
      const material = card.creation.kind === 'material' ? card.creation.spec : build.placed.map((part) => specOfName(part.material)).find((spec) => spec !== null);
      if (material) {
        const report = materialCoverageReport({ material, grid: 24 });
        const zones = ['top', 'side', 'edge', 'crease', 'bottom', 'splash'] as const;
        const stamp = zones.map((zone) => `${zone.slice(0, 2).toUpperCase()} ${Math.round(Math.max(0, ...report.layers.map((layer) => layer[zone])))}%`);
        ctx.fillText(`6-ZONE MAX LAYER / ${stamp.join(' ')}`, 30, 480, 450);
      } else ctx.fillText('6-ZONE N/A / PROCEDURAL SKIN / ANATOMY AUDITED', 30, 480, 450);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('PNG capture failed')), 'image/png'));
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      if (build) scene.remove(build.group); scene.environment = previousEnv;
      if (env) releaseLayeredEnv(env);
      for (const resource of resources) resource.dispose();
    }
  });
}

/** Captures a real 512² kit/matstack beauty render unless a previously captured PNG is supplied. */
export async function encodeSporeCardPng(options: WebSporeCardOptions): Promise<Uint8Array<ArrayBuffer>> {
  const card = SporeCardSchema.parse(options.card);
  auditSporeCreation(card.creation);
  return encodePng({ card, beautyPng: options.beautyPng ?? await captureBeauty(card) });
}
export async function downloadSporeCard(card: SporeCard): Promise<void> {
  const png = await encodeSporeCardPng({ card });
  const url = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
  const a = document.createElement('a'); a.href = url; a.download = `${card.title.replace(/[^a-z0-9-]+/gi, '-').slice(0, 64)}.png`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { bindSporeCardDrop } from './spore-drop';
