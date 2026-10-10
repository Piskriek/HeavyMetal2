// Audits a procedural mesh module from an Arena battle for floating parts (the owner, 2026-10-10: "alot of detached and
// intersecting polygons"). Each builder's group is split into connected parts (vertices welded to 1 mm, triangles that
// share a welded vertex are one part). A part is FLOATING when its box, grown by 2 cm, touches no other part and does not
// reach the ground (y <= 0.02). DEEP overlaps (two parts whose boxes share over half the smaller one's volume) are listed
// as a hint of parts poking through each other; some are by design, so they are reported, not failed.
//   node --import tsx scripts/mesh-audit.ts <module.ts> <builder>[,<builder>...] [--stages 1,6]
// Exit code 1 when any part floats.
import * as THREE from 'three';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

type Part = { box: THREE.Box3; tris: number };

function partsOf(group: THREE.Object3D): Part[] {
  group.updateMatrixWorld(true);
  const parts: Part[] = [];
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry as THREE.BufferGeometry, pos = g.getAttribute('position');
    if (!pos) return;
    const index = g.getIndex(), n = index ? index.count : pos.count;
    // weld to 1 mm
    const key = new Map<string, number>(), weld: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const k = `${Math.round(v.x * 1000)},${Math.round(v.y * 1000)},${Math.round(v.z * 1000)}`;
      let id = key.get(k);
      if (id === undefined) { id = key.size; key.set(k, id); }
      weld.push(id);
    }
    const parent = Array.from({ length: key.size }, (_, i) => i);
    const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
    const vert = (t: number) => (index ? index.getX(t) : t);
    for (let t = 0; t + 2 < n; t += 3) {
      const a = find(weld[vert(t)]!), b = find(weld[vert(t + 1)]!), c = find(weld[vert(t + 2)]!);
      parent[b] = a; parent[find(c)] = a;
    }
    const byRoot = new Map<number, Part>();
    for (let t = 0; t + 2 < n; t += 3) {
      const r = find(weld[vert(t)]!);
      let p = byRoot.get(r);
      if (!p) { p = { box: new THREE.Box3(), tris: 0 }; byRoot.set(r, p); }
      p.tris++;
      for (let k = 0; k < 3; k++) p.box.expandByPoint(v.fromBufferAttribute(pos, vert(t + k)).applyMatrix4(mesh.matrixWorld));
    }
    parts.push(...byRoot.values());
  });
  return parts;
}

const vol = (b: THREE.Box3) => { const s = b.getSize(new THREE.Vector3()); return Math.max(s.x, 1e-4) * Math.max(s.y, 1e-4) * Math.max(s.z, 1e-4); };

async function main(): Promise<void> {
  const [file, names, ...rest] = process.argv.slice(2);
  if (!file || !names) { console.error('usage: mesh-audit.ts <module.ts> <builder,...> [--stages 1,6]'); process.exit(2); }
  const si = rest.indexOf('--stages'), stages = si >= 0 ? rest[si + 1]!.split(',').map(Number) : [1, 6];
  const mod = await import(pathToFileURL(path.resolve(file)).href) as Record<string, unknown>;
  const m = (mod['createMaterials'] as () => unknown)();
  let floatingTotal = 0;
  for (const stage of stages) for (const name of names.split(',')) {
    const build = mod[name] as ((m: unknown, o: unknown) => { group: THREE.Object3D }) | undefined;
    if (!build) { console.log(`s${stage} ${name}: missing`); floatingTotal++; continue; }
    const parts = partsOf(build(m, { stage }).group);
    const grown = parts.map((p) => p.box.clone().expandByScalar(0.02));
    const floating = parts.filter((p, i) => p.box.min.y > 0.02 && !grown.some((g, j) => j !== i && g.intersectsBox(grown[i]!)));
    let deep = 0;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]!.box, b = parts[j]!.box;
      if (!a.intersectsBox(b)) continue;
      const inter = a.clone().intersect(b);
      if (vol(inter) > 0.5 * Math.min(vol(a), vol(b)) && vol(inter) > 1e-3) deep++;
    }
    floatingTotal += floating.length;
    const worst = floating.slice(0, 3).map((p) => `${p.tris}t@(${p.box.min.x.toFixed(2)},${p.box.min.y.toFixed(2)},${p.box.min.z.toFixed(2)})`).join(' ');
    console.log(`s${stage} ${name.padEnd(14)} parts ${String(parts.length).padStart(4)}  floating ${floating.length}${worst ? ` [${worst}]` : ''}  deep-overlaps ${deep}`);
  }
  console.log(floatingTotal === 0 ? 'OK: nothing floats' : `FLOATING PARTS: ${floatingTotal}`);
  process.exit(floatingTotal === 0 ? 0 : 1);
}
void main();
