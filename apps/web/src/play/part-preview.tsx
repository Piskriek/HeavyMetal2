// The part's live preview on the bench's Parts page and the planet's Drafting Table (TICKET-32; the owner, 2026-10-20: "there
// is gona be a preview of the thing where you have those sliders, else the sliders are useless", and "we want to use
// previews to stimulate the players creativity"). It shows the mesh the cartridge prints: the generator at full detail,
// the sliders, the one-click operators and each slot's material, and whatever the player is hovering to try on. It turns
// slowly; drag to orbit, wheel to zoom. Its own small WebGL context lives only while the page is open and is released on
// close (the min-spec laptop: a GTX 950M). The same context renders the part chips' thumbnails, once a session.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PartSpec } from '@hm/cartlab';
import { GENERATORS, resolveParams, type MeshData } from '@hm/partgen';
import { applyOps } from './part-cartridge';
import { DEFAULT_SLOT_MATERIAL, PART_SWATCHES } from './part-swatches';
import { createTurntable, snapshot, type Turntable } from './turntable';

/** A part mesh as a three.js geometry, one draw group per material slot (in `slotNames` order). */
export function partGeometry(md: MeshData, slotNames: readonly string[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(md.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(md.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(md.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(md.indices, 1));
  for (const s of md.slots) g.addGroup(s.start, s.count, Math.max(0, slotNames.indexOf(s.name)));
  return g;
}

/** The printed mesh: the generator at full detail with the cartridge's operators (an operator that throws is skipped). */
function printedMesh(spec: PartSpec): MeshData | null {
  const g = GENERATORS[spec.gen];
  if (!g) return null;
  const base = g.build(spec.params, 2);
  try {
    return applyOps(base, spec.ops);
  } catch {
    return base;
  }
}

/** The slot names a mesh draws, the generator's first (operators such as edge wear add their own). */
const slotNamesOf = (gen: string, md: MeshData | null): readonly string[] => {
  const names = [...(GENERATORS[gen]?.slots ?? [])];
  for (const s of md?.slots ?? []) if (!names.includes(s.name)) names.push(s.name);
  return names;
};

// ---- the part chips' thumbnails: each generator at its defaults, rendered once a session by the first preview opened
const THUMBS = new Map<string, string>();
const thumbListeners = new Set<() => void>();

/** The generators' thumbnails (data URLs by generator id); the component redraws when they arrive. */
export function usePartThumbs(): ReadonlyMap<string, string> {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = (): void => bump((n) => n + 1);
    thumbListeners.add(f);
    return () => { thumbListeners.delete(f); };
  }, []);
  return THUMBS;
}

function renderThumbs(stage: Turntable, mats: ReadonlyMap<string, THREE.Material>): void {
  for (const g of Object.values(GENERATORS)) {
    const md = g.build(resolveParams(g.params, {}), 2);
    const names = slotNamesOf(g.id, md);
    // the chips are for telling shapes apart on a dark panel: light paint everywhere, a hazard band where a part has one
    const mesh = new THREE.Mesh(partGeometry(md, names), names.map((s) => mats.get(s === 'band' ? 'hazard' : 'paint')!));
    THUMBS.set(g.id, snapshot(stage, mesh));
    mesh.geometry.dispose();
  }
  thumbListeners.forEach((f) => f());
}

const sizeText = (d: readonly number[]): string =>
  Math.max(...d) >= 1 ? `${d.map((x) => x.toFixed(2)).join(' × ')} m` : `${d.map((x) => Math.round(x * 1000)).join(' × ')} mm`;

export interface PartPreviewProps {
  readonly spec: PartSpec;
  /** What the player is trying on (hovering), shown as a tag over the view; null when the view shows the part as set. */
  readonly trying?: string | null;
}

export const PartPreview: React.FC<PartPreviewProps> = ({ spec, trying = null }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<{ stage: Turntable; part: THREE.Mesh; mats: Map<string, THREE.Material> } | null>(null);
  const mesh = useMemo(() => printedMesh(spec), [spec]);
  const slotNames = useMemo(() => slotNamesOf(spec.gen, mesh), [spec.gen, mesh]);

  // the view: built once per page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const stage = createTurntable(canvas);
    const mats = new Map<string, THREE.Material>(PART_SWATCHES.map((s) => [s.id, new THREE.MeshStandardMaterial({ color: s.color, metalness: s.metal, roughness: s.rough, flatShading: true })]));
    const part = new THREE.Mesh(new THREE.BufferGeometry(), [...mats.values()]);
    stage.scene.add(part);
    if (THUMBS.size === 0) renderThumbs(stage, mats);
    viewRef.current = { stage, part, mats };
    return () => {
      part.geometry.dispose();
      mats.forEach((m) => m.dispose());
      stage.dispose();
      viewRef.current = null;
    };
  }, []);

  // the part: rebuilt on every slider, operator or material change, and on every try-on
  useEffect(() => {
    const v = viewRef.current;
    if (!v || !mesh) return;
    const old = v.part.geometry;
    v.part.geometry = partGeometry(mesh, slotNames);
    old.dispose();
    v.part.material = slotNames.map((s) => v.mats.get(spec.slotMaterials[s] ?? DEFAULT_SLOT_MATERIAL[s] ?? 'paint') ?? v.mats.get('paint')!);
  }, [mesh, slotNames, spec.slotMaterials]);

  // framing: on a new generator, as soon as the part outgrows the view, and when it shrinks well inside it (a try-on of
  // a mirror zooms out, and back in when it ends); small tuning inside the view keeps it where the player turned it
  const framed = useRef<{ gen: string; r: number } | null>(null);
  useEffect(() => {
    const v = viewRef.current;
    if (!v || !mesh) return;
    const r = 0.5 * Math.hypot(mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]);
    const last = framed.current;
    if (last && last.gen === spec.gen && r <= last.r * 1.08 && r > last.r * 0.7) return;
    framed.current = { gen: spec.gen, r };
    v.stage.fit(mesh.min, mesh.max);
    v.stage.grid.scale.setScalar(Math.pow(10, Math.ceil(Math.log10(Math.max(r, 0.01) * 4))));
  }, [mesh, spec.gen]);

  const dims = mesh ? [mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]] : null;
  return (
    <figure className={`part-preview${trying ? ' trying' : ''}`} data-testid="part-preview">
      <canvas ref={canvasRef} aria-label={`Preview of ${spec.name}`} />
      {trying ? <span className="part-preview-trying" data-testid="part-preview-trying">Trying {trying}. Click to keep it.</span> : null}
      {dims ? (
        <figcaption>
          <span>{sizeText(dims)}</span>
          <span>{Math.round(mesh!.indices.length / 3)} tris</span>
        </figcaption>
      ) : null}
    </figure>
  );
};
