// A leak on the plot: a sliced column in the leak's colour, and a ring on the ground when a wave is due. Sealing (the beam held on it) turns the column amber and locks its
// slices back into line, and a sealed leak loses its column. The junked models around it are the wrecks (play/wrecks.ts). Pure geometry and
// one shader; the state comes from the monsters.
import * as THREE from 'three';
import type { MonsterMarker } from '../play/monsters';

export interface LeakVisualFrame {
  readonly dt: number;
  readonly markers: readonly MonsterMarker[];
  /** The leak under the beam's seal hold, or null. */
  readonly sealing: number | null;
  readonly camera: THREE.Camera;
  readonly stage: number;
}

export interface LeakVisuals {
  update(frame: LeakVisualFrame): void;
  dispose(): void;
}

/** The leak colours: dormant (cyan), open and warned (magenta), sealing (amber, the beam's Seal colour, #ffc13d). */
const COLOUR = { dormant: 0x3dc8ff, open: 0xff3d8a, warned: 0xff3d8a, sealing: 0xffc13d, sealed: 0x3dc8ff } as const;
const COLUMN_RADIUS = 2.2;
const COLUMN_HEIGHT = 3.5;

const columnMaterial = (): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(COLOUR.dormant) },
      uSeal: { value: 0 },
      uOpacity: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeal;
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        // horizontal glitch slices: each band shifts sideways; sealing locks them back into line
        float band = floor((position.y + 1.75) * 6.0);
        float jitter = sin(band * 12.9898 + floor(uTime * 9.0) * 4.1);
        float amp = (1.0 - uSeal) * 0.22;
        vec3 p = position;
        p.x += jitter * amp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uSeal;
      uniform float uOpacity;
      varying vec3 vLocal;
      void main() {
        float band = step(0.45, fract((vLocal.y + 1.75) * 6.0 + uTime * 0.6));
        float rim = smoothstep(0.7, 1.0, length(vLocal.xz) / ${COLUMN_RADIUS.toFixed(2)});
        float a = uOpacity * (0.6 + 0.4 * band) * (0.6 + 0.4 * rim);
        gl_FragColor = vec4(uColor * (0.6 + 0.8 * rim), clamp(a, 0.0, 1.0));
      }
    `,
  });

interface Entry {
  readonly group: THREE.Group;
  readonly column: THREE.Mesh;
  readonly ring: THREE.Mesh;
  /** The era aura: a soft disc on the ground that drops the ground to the leak's era. */
  readonly aura: THREE.Mesh;
  readonly x: number;
  readonly z: number;
}

export function createLeakVisuals(scene: THREE.Scene, groundHeightAt: (x: number, z: number) => number): LeakVisuals {
  const entries = new Map<number, Entry>();
  let time = 0;

  const create = (id: number, x: number, z: number): Entry => {
    const group = new THREE.Group();
    group.name = `leak:${id}`;
    group.position.set(x, groundHeightAt(x, z), z);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, COLUMN_HEIGHT, 20, 6, true), columnMaterial());
    column.position.y = COLUMN_HEIGHT / 2;
    group.add(column);
    const ring = new THREE.Mesh(new THREE.RingGeometry(COLUMN_RADIUS * 0.92, COLUMN_RADIUS * 1.05, 40), new THREE.MeshBasicMaterial({ color: COLOUR.warned, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);
    const aura = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.03;
    group.add(aura);
    scene.add(group);
    return { group, column, ring, aura, x, z };
  };

  return {
    update({ dt, markers, sealing }) {
      time += dt;
      for (const mk of markers) {
        let e = entries.get(mk.id);
        if (!e) {
          e = create(mk.id, mk.x, mk.z);
          entries.set(mk.id, e);
        }
        // the era aura: sprite leaks are white, early 3D cyan-blue, modern 3D cyan; a sealed leak has none
        const eraColour = mk.era === 'early3d' ? 0x7dd3fc : mk.era === 'modern3d' ? 0x3dc8ff : 0xe8e8e8;
        const auraMat = e.aura.material as THREE.MeshBasicMaterial;
        auraMat.color.setHex(eraColour);
        auraMat.opacity = mk.state === 'sealed' ? 0 : mk.state === 'warned' ? 0.6 + 0.2 * Math.abs(Math.sin(time * 6)) : mk.dormant ? 0.3 : 0.45;

        const sealing1 = sealing === mk.id && mk.state !== 'sealed';
        const colour = mk.state === 'sealed' ? COLOUR.sealed : sealing1 ? COLOUR.sealing : mk.dormant ? COLOUR.dormant : COLOUR.open;
        const mat = e.column.material as THREE.ShaderMaterial;
        mat.uniforms['uTime']!.value = time;
        mat.uniforms['uSeal']!.value = mk.seal;
        (mat.uniforms['uColor']!.value as THREE.Color).setHex(colour);
        mat.uniforms['uOpacity']!.value = mk.state === 'sealed' ? 0.12 : 1;
        e.column.visible = mk.state !== 'sealed' || mk.seal < 1;
        const ringMat = e.ring.material as THREE.MeshBasicMaterial;
        ringMat.color.setHex(colour);
        ringMat.opacity = mk.state === 'warned' ? 0.8 + 0.2 * Math.abs(Math.sin(time * 6)) : sealing1 ? 0.9 : 0;
      }
      // leaks that are gone from the markers (none are removed in play, but a new plot clears them)
      for (const [id, e] of entries) {
        if (markers.some((m) => m.id === id)) continue;
        scene.remove(e.group);
        entries.delete(id);
      }
    },
    dispose() {
      for (const e of entries.values()) {
        scene.remove(e.group);
        e.column.geometry.dispose();
        (e.column.material as THREE.Material).dispose();
        e.ring.geometry.dispose();
        (e.ring.material as THREE.Material).dispose();
        e.aura.geometry.dispose();
        (e.aura.material as THREE.Material).dispose();
      }
      entries.clear();
    },
  };
}
