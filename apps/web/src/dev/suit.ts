// Dev-only: the player's suit as the creature kit it now is (plan 44 / JOB-24).
//   /suit.html            the assembled suit on the Studio turntable, every part listed by its group
//
// There is no GLB here and no skinning: the page builds `ASTRO_SUIT_CREATURE_KIT` (45 `@hm/partgen` parts on the Mixamo
// rest rig), runs the same `studio.kit.audit` gate the tests run, and lets you click a part to highlight it — the part a
// cartridge would land on when you fire at your own suit.
import * as THREE from 'three';
import { ASTRO_SUIT_CREATURE_KIT, buildAstroSuit } from '../avatar/astro/astro-model';
import { createTurntable } from '../play/turntable';
import { CREATURE_ASSEMBLY_ORDER } from '@hm/creature';
import { kitAudit } from '../studio/studio-agent-audit';

const info = document.getElementById('info')!;
const list = document.getElementById('parts')!;

function main(): void {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const stage = createTurntable(canvas);
  const suit = buildAstroSuit('high');
  suit.rotation.y = 0.35;
  stage.scene.add(suit);

  const box = new THREE.Box3().setFromObject(suit);
  stage.fit(box.min.toArray(), box.max.toArray());

  const report = kitAudit(ASTRO_SUIT_CREATURE_KIT.kit, { preset: ASTRO_SUIT_CREATURE_KIT.preset });
  info.textContent = `${report.parts} parts · ${report.moving.length} joints turning · `
    + `${report.looseEnds} loose · ${report.solidClearances.length} collisions · ${report.terminals} terminal issues`;

  // one button per placed part, grouped the way the kit is: base, structure, mechanism, controls, subject
  const meshes = new Map<string, THREE.Mesh[]>();
  suit.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const path = mesh.userData.astroPartPath as string | undefined;
    if (!path) return;
    const list = meshes.get(path) ?? [];
    list.push(mesh);
    meshes.set(path, list);
  });
  const highlight = (path: string | null): void => {
    for (const [p, ms] of meshes) {
      for (const m of ms) {
        const std = m.material as THREE.MeshStandardMaterial;
        const on = p === path;
        std.emissive.setHex(on ? 0x2a6b8f : 0x000000);
        std.emissiveIntensity = on ? 1 : 0;
      }
    }
    for (const b of list.querySelectorAll('button')) b.classList.toggle('on', b.dataset.path === path);
  };
  for (const group of CREATURE_ASSEMBLY_ORDER) {
    const title = document.createElement('h4');
    title.textContent = group;
    list.append(title);
    for (const path of meshes.keys()) {
      if (!path.startsWith(`${group}/`)) continue;
      const button = document.createElement('button');
      button.textContent = path.slice(group.length + 1);
      button.dataset.path = path;
      button.onmouseenter = () => highlight(path);
      button.onmouseleave = () => highlight(null);
      list.append(button);
    }
  }

  stage.renderer.domElement.addEventListener('pointerdown', () => highlight(null));
  (window as unknown as { __suitReady: boolean }).__suitReady = true;
}

try {
  main();
} catch (error) {
  info.textContent = `error: ${String(error)}`;
  throw error;
}
