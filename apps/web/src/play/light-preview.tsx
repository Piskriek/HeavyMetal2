// The Lights page's live preview (plan 39 section 6, Lx; the previews rule): a square lamp housing on a floor, its lens
// glowing the light's colour at its intensity, its pattern running, and a point light so the player sees what it throws
// onto the ground. The preview has its own materials (they change with every slider), not the shared lamp ones.
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { LightSpec } from '@hm/cartlab';
import { lightHex, patternGlow } from './light-presets';
import { createTurntable } from './turntable';

export interface LightPreviewProps {
  readonly spec: LightSpec;
  /** What the player is trying on (hovering), shown as a tag over the view; null when it shows the light as set. */
  readonly trying?: string | null;
}

export const LightPreview: React.FC<LightPreviewProps> = ({ spec, trying = null }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const stage = createTurntable(canvas);
    stage.grid.visible = false;
    // a dim scene, so the lamp's own light reads
    for (const c of stage.scene.children) if ((c as THREE.Light).isLight) (c as THREE.Light).intensity *= 0.25;
    const floorMat = new THREE.MeshStandardMaterial({ color: '#5b636b', roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.6), floorMat);
    floor.position.y = -0.02;
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.55, metalness: 0.3 });
    const lensMat = new THREE.MeshStandardMaterial({ color: '#14181f', emissive: '#ffffff', roughness: 0.3 });
    // a square housing on a short square post: the lens faces forward and a little down
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.06), bodyMat);
    post.position.y = 0.17;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.14), bodyMat);
    housing.position.set(0, 0.44, 0);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.012), lensMat);
    lens.position.set(0, 0.44, 0.076);
    const glow = new THREE.PointLight('#ffffff', 1, 2.4, 1.6);
    glow.position.set(0, 0.42, 0.22);
    const rig = new THREE.Group();
    rig.add(floor, post, housing, lens, glow);
    rig.rotation.x = 0;
    stage.scene.add(rig);
    stage.fit([-0.38, 0, -0.3], [0.38, 0.58, 0.3]);
    stage.onFrame = (t) => {
      const s = specRef.current;
      const hex = lightHex(s);
      const level = s.intensity * patternGlow(s.pattern, t);
      lensMat.emissive.set(hex);
      lensMat.emissiveIntensity = level;
      glow.color.set(hex);
      glow.intensity = level * 1.6;
    };
    return () => {
      for (const m of [floor, post, housing, lens]) m.geometry.dispose();
      floorMat.dispose();
      bodyMat.dispose();
      lensMat.dispose();
      stage.dispose();
    };
  }, []);

  return (
    <figure className={`part-preview light-preview${trying ? ' trying' : ''}`} data-testid="light-preview">
      <canvas ref={canvasRef} aria-label={`Preview of ${spec.name}`} />
      {trying ? <span className="part-preview-trying" data-testid="light-preview-trying">Trying {trying}. Click to keep it.</span> : null}
      <figcaption>
        <span>{spec.colour ? `signal ${spec.colour}` : `${Math.round(spec.kelvin)} K`}</span>
        <span>{spec.intensity.toFixed(1)}x</span>
      </figcaption>
    </figure>
  );
};
