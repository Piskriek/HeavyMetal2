// The Species page's live preview (plan 39 section 6, Aq; the previews rule): the tree a species cartridge will grow,
// grown by the plot's own call (speciesModel) and drawn with the plot's own foliage material at full fidelity, swaying in
// the wind. Its chips' thumbnails are rendered once a session through the same small WebGL context.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SpeciesSpec } from '@hm/cartlab';
import type { Species } from '@hm/treegen';
import { createFoliageMaterial, speciesModel } from './plot-biome-view';
import { SPECIES_PRESETS } from './species-presets';
import { createTurntable, snapshot, type Turntable } from './turntable';

const THUMBS = new Map<string, string>();
const thumbListeners = new Set<() => void>();

/** The species presets' thumbnails (data URLs by preset id); the component redraws when they arrive. */
export function useSpeciesThumbs(): ReadonlyMap<string, string> {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = (): void => bump((n) => n + 1);
    thumbListeners.add(f);
    return () => { thumbListeners.delete(f); };
  }, []);
  return THUMBS;
}

export interface SpeciesPreviewProps {
  readonly spec: SpeciesSpec;
  /** What the player is trying on (hovering), shown as a tag over the view; null when it shows the tree as set. */
  readonly trying?: string | null;
  /** The player's saved species: each gets a thumbnail (keyed by its preset id) for its chip, rendered once. */
  readonly extra?: readonly { readonly id: string; readonly spec: SpeciesSpec }[];
}

export const SpeciesPreview: React.FC<SpeciesPreviewProps> = ({ spec, trying = null, extra }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<{ stage: Turntable; tree: THREE.Mesh; foliage: THREE.Material } | null>(null);
  const model = useMemo(() => speciesModel({ species: spec.species as Species, params: spec.params }, 'near'), [spec.species, spec.params]);

  // the view: built once per page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const stage = createTurntable(canvas);
    const foliage = createFoliageMaterial();
    foliage.uniforms.uStage.value = 6;
    stage.onFrame = (t) => { foliage.uniforms.uWindTime.value = t; };
    const tree = new THREE.Mesh(new THREE.BufferGeometry(), foliage.material);
    stage.scene.add(tree);
    if (THUMBS.size === 0) {
      for (const p of SPECIES_PRESETS) {
        const m = speciesModel({ species: p.species, params: p.params }, 'near');
        THUMBS.set(p.id, snapshot(stage, new THREE.Mesh(m.geometry, foliage.material)));
        m.geometry.dispose();
      }
      thumbListeners.forEach((f) => f());
    }
    viewRef.current = { stage, tree, foliage: foliage.material };
    return () => {
      tree.geometry.dispose();
      foliage.dispose();
      stage.dispose();
      viewRef.current = null;
    };
  }, []);

  // the saved species' chips: a thumbnail each, the first time they are seen
  useEffect(() => {
    const v = viewRef.current;
    if (!v || !extra) return;
    let added = false;
    for (const e of extra) {
      if (THUMBS.has(e.id)) continue;
      const m = speciesModel({ species: e.spec.species as Species, params: e.spec.params }, 'near');
      THUMBS.set(e.id, snapshot(v.stage, new THREE.Mesh(m.geometry, v.foliage)));
      m.geometry.dispose();
      added = true;
    }
    if (added) thumbListeners.forEach((f) => f());
  }, [extra]);

  // the tree: regrown on every slider, preset or canopy change, and on every try-on
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const old = v.tree.geometry;
    v.tree.geometry = model.geometry;
    if (old !== model.geometry) old.dispose();
  }, [model]);

  // framing: on a new species, and when the tree outgrows the view or shrinks well inside it
  const framed = useRef<{ species: string; h: number } | null>(null);
  const box = useMemo(() => {
    model.geometry.computeBoundingBox();
    return model.geometry.boundingBox!.clone();
  }, [model]);
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const h = box.max.y - box.min.y;
    const last = framed.current;
    if (last && last.species === spec.species && h <= last.h * 1.08 && h > last.h * 0.7) return;
    framed.current = { species: spec.species, h };
    v.stage.fit(box.min.toArray(), box.max.toArray());
    v.stage.grid.scale.setScalar(Math.pow(10, Math.ceil(Math.log10(Math.max(h, 1)))));
  }, [box, spec.species]);

  return (
    <figure className={`part-preview species-preview${trying ? ' trying' : ''}`} data-testid="species-preview">
      <canvas ref={canvasRef} aria-label={`Preview of ${spec.name}`} />
      {trying ? <span className="part-preview-trying" data-testid="species-preview-trying">Trying {trying}. Click to keep it.</span> : null}
      <figcaption>
        <span>{(box.max.y - box.min.y).toFixed(1)} m tall</span>
        <span>{model.triangles} tris</span>
      </figcaption>
    </figure>
  );
};
