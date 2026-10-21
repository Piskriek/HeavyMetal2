/**
 * The bench's material preview (plan 41 section 4.6): a small machine-like test piece wearing the material, on the
 * shared turntable with the lab's room reflection, so every layer has somewhere to land: sharp edges, the crease where
 * the body meets its plinth, tops, the splash zone. The mask view shows one layer's coverage in black and white.
 * Shelf thumbnails are the same piece, compiled without blocking (compileAsync) and drawn one a frame, once a session.
 *
 * The piece is an interim composition of partgen parts; Argo's test piece (TICKET-40, MATSTACK_TEST_PIECE_KIT) takes
 * its place when it lands.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Kit } from '@hm/kitspec';
import type { MaterialSpec } from '@hm/matstack';
import { buildKitPreset, type KitBuild } from './kit-build';
import { kitLayering, materialForSpec, releaseLayeredEnv, setMaskView, type LayeredEnv } from './layered-material';
import { createTurntable, snapshot, type Turntable } from './turntable';

/** A small machine, about 1.2 m across: a plinth, a bevelled body with a grille and a lamp, a hopper, a beam, a bracket, bolts. */
const PIECE: Kit = {
  parts: {
    plinth: { source: { kind: 'box', size: [1.2, 0.1, 0.8] }, material: 'M', rank: 0 },
    body: { source: { kind: 'param', gen: 'can', params: { width: 0.5, depth: 0.5, height: 0.9 } }, material: 'M', rank: 0 },
    grille: { source: { kind: 'param', gen: 'grille', params: { width: 0.36, height: 0.32 } }, material: 'M', rank: 0 },
    lamp: { source: { kind: 'param', gen: 'lamp', params: {} }, material: 'M', rank: 0 },
    hopper: { source: { kind: 'param', gen: 'hopper', params: { topWidth: 0.5, topDepth: 0.5, bottomWidth: 0.3, bottomDepth: 0.3, height: 0.24 } }, material: 'M', rank: 0 },
    beam: { source: { kind: 'param', gen: 'beam', params: { length: 0.5, section: 0.08 } }, material: 'M', rank: 0 },
    bracket: { source: { kind: 'param', gen: 'bracket', params: {} }, material: 'M', rank: 0 },
    bolt: { source: { kind: 'param', gen: 'bolt', params: {} }, material: 'M', rank: 0 },
  },
  assemblies: {
    piece: {
      children: [
        { ref: 'plinth', key: 'plinth' },
        { ref: 'body', key: 'body', at: [-0.25, 0.1, 0] },
        { ref: 'grille', key: 'grille', at: [-0.25, 0.32, 0.25] },
        { ref: 'lamp', key: 'lamp', at: [-0.25, 0.78, 0.25] },
        { ref: 'hopper', key: 'hopper', at: [-0.25, 1.0, 0] },
        { ref: 'beam', key: 'beam', at: [0.3, 0.1, 0.2] },
        { ref: 'bracket', key: 'bracket', at: [0.35, 0.1, -0.2] },
        { ref: 'bolt', key: 'bolts-front', at: [-0.52, 0.1, 0.32], repeat: { count: 2, step: [1.04, 0, 0] } },
        { ref: 'bolt', key: 'bolts-back', at: [-0.52, 0.1, -0.32], repeat: { count: 2, step: [1.04, 0, 0] } },
      ],
    },
  },
};

/** The rank the preview draws at: per pixel, with the physical extras where the material has them. */
const RANK = 2;

/** The piece's geometry, built once (its edge lines do not depend on the material) and dressed per material. */
function buildPiece(env: LayeredEnv, spec: MaterialSpec): KitBuild | null {
  return buildKitPreset(PIECE, 'piece', {
    materials: {},
    gen: () => null,
    maxRank: 2,
    resolveMaterial: (name) => (name === 'M' ? materialForSpec(spec, RANK, env) : null),
    layering: kitLayering,
  });
}

/** Puts a material on every mesh of the piece. */
function dress(build: KitBuild, m: THREE.Material): void {
  build.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.material = m;
  });
}

/** The piece's box, for framing. */
function boxOf(build: KitBuild): { min: number[]; max: number[] } {
  const b = new THREE.Box3().setFromObject(build.group);
  return { min: b.min.toArray(), max: b.max.toArray() };
}

// ---- shelf thumbnails: rendered once a session, one a frame, without blocking on shader compiles
const THUMBS = new Map<string, string>();
const thumbListeners = new Set<() => void>();
const queue: { id: string; spec: MaterialSpec }[] = [];

/** The materials' thumbnails (data URLs by id); the component redraws as each arrives. */
export function useMaterialThumbs(): ReadonlyMap<string, string> {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = (): void => bump((n) => n + 1);
    thumbListeners.add(f);
    return () => { thumbListeners.delete(f); };
  }, []);
  return THUMBS;
}

export interface MaterialPreviewProps {
  readonly spec: MaterialSpec;
  /** What the player is trying on (hovering), shown as a tag over the view; null when the view shows the material as set. */
  readonly trying?: string | null;
  /** Shows this visible layer's coverage in black and white (the mask view), or -1 for the material. */
  readonly maskLayer?: number;
  /** Materials to make shelf thumbnails for (by id), each once a session. */
  readonly thumbs?: readonly { readonly id: string; readonly spec: MaterialSpec }[];
}

export const MaterialPreview: React.FC<MaterialPreviewProps> = ({ spec, trying = null, maskLayer = -1, thumbs }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<{ stage: Turntable; env: LayeredEnv; piece: KitBuild; thumbPiece: KitBuild } | null>(null);
  const [ready, setReady] = useState(false);

  // the view: built once per page, with the lab's room reflection so metal reads as metal
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const stage = createTurntable(canvas);
    const pmrem = new THREE.PMREMGenerator(stage.renderer);
    const room = new RoomEnvironment();
    const envTarget = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    stage.scene.environment = envTarget.texture;
    stage.scene.environmentIntensity = 0.45;
    const env: LayeredEnv = { map: envTarget.texture, intensity: 1 };
    const piece = buildPiece(env, spec);
    const thumbPiece = buildPiece(env, spec);
    if (!piece || !thumbPiece) return undefined;
    stage.scene.add(piece.group);
    const box = boxOf(piece);
    stage.fit(box.min, box.max);
    stage.grid.scale.setScalar(4);
    viewRef.current = { stage, env, piece, thumbPiece };
    setReady(true);
    // thumbnails, one a frame: compile without blocking, then draw
    let stopped = false;
    const pump = async (): Promise<void> => {
      while (!stopped) {
        const next = queue.shift();
        if (!next) { await new Promise((r) => setTimeout(r, 120)); continue; }
        if (THUMBS.has(next.id)) continue;
        const m = materialForSpec(next.spec, RANK, env);
        dress(thumbPiece, m);
        try { await stage.renderer.compileAsync(thumbPiece.group, stage.camera, stage.scene); } catch { /* compile on draw instead */ }
        if (stopped) return;
        THUMBS.set(next.id, snapshot(stage, thumbPiece.group, 88));
        thumbListeners.forEach((f) => f());
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    };
    void pump();
    return () => {
      stopped = true;
      for (const b of [piece, thumbPiece]) b.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      releaseLayeredEnv(env);
      envTarget.dispose();
      stage.dispose();
      viewRef.current = null;
    };
    // the view is built once; later specs are dressed below
  }, []);

  // the shelf's thumbnails, queued the first time they are asked for
  useEffect(() => {
    for (const t of thumbs ?? []) if (!THUMBS.has(t.id) && !queue.some((q) => q.id === t.id)) queue.push(t);
  }, [thumbs]);

  // the material, on every change and every try-on; the mask view on its own material copy (the preview's reflection)
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const m = materialForSpec(spec, RANK, v.env);
    dress(v.piece, m);
    setMaskView(m, maskLayer);
    return () => setMaskView(m, -1);
  }, [spec, maskLayer, ready]);

  const shown = spec.layers.filter((l) => l.visible).length;
  return (
    <figure className={`part-preview material-preview${trying ? ' trying' : ''}`} data-testid="material-preview">
      <canvas ref={canvasRef} aria-label={`Preview of ${spec.name}`} />
      {trying ? <span className="part-preview-trying" data-testid="material-preview-trying">Trying {trying}. Click to keep it.</span> : null}
      <figcaption>
        <span>{maskLayer >= 0 ? 'Where the layer lands' : spec.name}</span>
        <span>{shown === 1 ? '1 layer' : `${shown} layers`}</span>
      </figcaption>
    </figure>
  );
};
