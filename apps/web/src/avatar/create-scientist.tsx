import { useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { nameProblem } from '@hm/avatarlook';
import { fx } from '../maker/feedback';
import { bigStore } from '../storage/big-store';
import type { PlayAvatar } from '../play/quest';
import { SCIENTIST_FBX_BASE64 } from './scientist/scientist-asset';

export const VISOR_SWATCHES = [
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'green', label: 'Green', hex: '#10b981' },
  { id: 'magenta', label: 'Magenta', hex: '#d946ef' },
  { id: 'white', label: 'White', hex: '#f8fafc' },
  { id: 'red', label: 'Red', hex: '#ef4444' },
] as const;

interface ScientistPreviewApi {
  setVisor: (color: string) => void;
  setCustomScene: (scene: THREE.Group | null) => void;
}

function ScientistTurntable(props: { readonly visor: string; readonly customScene: THREE.Group | null }): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<ScientistPreviewApi | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    el.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff3df, 0x8a9a7a, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(-2, 4, 3);
    sun.castShadow = true;
    scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

    // Decode base64 FBX
    let scientistGroup: THREE.Group | null = null;
    let customGroup: THREE.Group | null = null;
    let spine: THREE.Bone | null = null;
    const visorMaterials: THREE.MeshStandardMaterial[] = [];

    try {
      const binStr = atob(SCIENTIST_FBX_BASE64);
      const len = binStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);

      const fbxLoader = new FBXLoader();
      scientistGroup = fbxLoader.parse(bytes.buffer, '') as THREE.Group;
      scientistGroup.scale.setScalar(0.01); // 175 cm -> 1.75 m

      const submeshColors: Record<string, { color: number; roughness: number; metalness?: number }> = {
        '1': { color: 0x334155, roughness: 0.7 },
        '2': { color: 0x1e293b, roughness: 0.8 },
        '3': { color: 0x475569, roughness: 0.6 },
        '4': { color: 0xe2e8f0, roughness: 0.5 },
        '5': { color: 0xf1f5f9, roughness: 0.6, metalness: 0.05 },
        '6': { color: 0x0f172a, roughness: 0.9 },
        '7': { color: 0x0f172a, roughness: 0.9 },
        '9': { color: 0x334155, roughness: 0.7 },
      };

      scientistGroup.traverse((c) => {
        if ((c as THREE.Bone).isBone) {
          const b = c as THREE.Bone;
          if (b.name === 'mixamorigLeftArm') b.rotation.z -= 1.15;
          if (b.name === 'mixamorigRightArm') b.rotation.z += 1.15;
          if (b.name === 'mixamorigSpine') spine = b;
        }
        if ((c as THREE.Mesh).isMesh) {
          const mesh = c as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.name === '6' || mesh.name === '7' || mesh.name === '8') {
            const vMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(props.visor),
              emissive: new THREE.Color(props.visor),
              emissiveIntensity: 0.8,
              roughness: 0.1,
              metalness: 0.1,
              transparent: true,
              opacity: 0.9,
            });
            mesh.material = vMat;
            visorMaterials.push(vMat);
          } else if (submeshColors[mesh.name]) {
            mesh.material = new THREE.MeshStandardMaterial(submeshColors[mesh.name]);
          }
        }
      });

      scene.add(scientistGroup);
    } catch (err) {
      console.warn('Failed to parse scientist FBX preview:', err);
    }

    const setVisor = (hex: string): void => {
      const col = new THREE.Color(hex);
      for (const m of visorMaterials) {
        m.color.copy(col);
        m.emissive.copy(col);
      }
    };

    const setCustomScene = (custom: THREE.Group | null): void => {
      if (customGroup) {
        scene.remove(customGroup);
        customGroup = null;
      }
      if (custom) {
        if (scientistGroup) scientistGroup.visible = false;
        customGroup = custom;
        scene.add(customGroup);
      } else {
        if (scientistGroup) scientistGroup.visible = true;
      }
    };

    api.current = { setVisor, setCustomScene };

    if (props.customScene) setCustomScene(props.customScene);

    const resize = (): void => {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    const loop = (now: number): void => {
      const time = now * 0.001;
      const angle = time * 0.35;
      const dist = 4.6;
      camera.position.set(Math.sin(angle) * dist, 1.35, Math.cos(angle) * dist);
      camera.lookAt(0, 0.95, 0);

      // Subtle breathing sway
      if (spine && scientistGroup?.visible) {
        spine.rotation.x = Math.sin(time * 2) * 0.02;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.current?.setVisor(props.visor);
  }, [props.visor]);

  useEffect(() => {
    api.current?.setCustomScene(props.customScene);
  }, [props.customScene]);

  return <div ref={host} className="turntable" aria-label="Scientist preview, turning slowly" role="img" />;
}

export function CreateScientist(props: {
  readonly onDone: (avatar: PlayAvatar) => void;
  readonly onBack: () => void;
  readonly inLab?: boolean;
  readonly title?: string;
  readonly doneLabel?: string;
}): ReactElement {
  const [name, setName] = useState('Scientist');
  const [visor, setVisor] = useState<string>('#f59e0b');
  const [customKey, setCustomKey] = useState<string | null>(null);
  const [customScene, setCustomScene] = useState<THREE.Group | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const problem = nameProblem(name);

  const handleCustomFile = (file: File): void => {
    setUploadError(null);
    if (!/\.(glb|gltf|vrm)$/i.test(file.name)) {
      setUploadError('Please choose a .glb or .vrm 3D model.');
      fx('ui-error');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setUploadError('Model is larger than 30 MB.');
      fx('ui-error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return;

      const loader = new GLTFLoader();
      loader.parse(
        buffer,
        '',
        (gltf) => {
          let meshCount = 0;
          gltf.scene.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              meshCount++;
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });

          if (meshCount === 0) {
            setUploadError('No 3D mesh found inside the file.');
            fx('ui-error');
            return;
          }

          // Scale to standard 1.8 m height
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const height = Math.max(0.01, size.y);
          const scale = 1.8 / height;
          gltf.scene.scale.setScalar(scale);
          gltf.scene.position.y = -box.min.y * scale;

          // Save bytes into BigStore (IndexedDB)
          const key = `hm.avatar.custom.${Date.now()}`;
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          const base64 = btoa(binary);
          bigStore().set(key, base64);

          setCustomKey(key);
          setCustomScene(gltf.scene);
          fx('ui-success');
        },
        (err) => {
          const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
          setUploadError(`Could not read 3D file: ${msg}`);
          fx('ui-error');
        }
      );
    };
    reader.readAsArrayBuffer(file);
  };

  const done = (): void => {
    if (problem) {
      setTouched(true);
      fx('ui-error');
      return;
    }
    const cleanName = name.trim();
    fx('ui-success');
    if (customKey) {
      props.onDone({ kind: 'custom', name: cleanName, key: customKey });
    } else {
      props.onDone({ kind: 'scientist', name: cleanName, visor });
    }
  };

  return (
    <div
      className={`create-goblin in-lab create-scientist`}
      role="dialog"
      aria-label={props.title ?? 'Who are you?'}
    >
      <ScientistTurntable visor={visor} customScene={customScene} />

      <section className="cg-panel">
        <h2>{props.title ?? 'Who are you?'}</h2>
        <p className="hint">In the lab you wear the biohazard exploration suit.</p>

        <label className="cg-name">
          <span>Name</span>
          <input
            autoFocus
            value={name}
            maxLength={20}
            placeholder="Scientist name"
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') done();
            }}
          />
        </label>
        {touched && problem ? <p className="hint warn" role="alert">{problem}</p> : null}

        <h4>Visor glow</h4>
        <div className="cg-colours visor-swatches">
          {VISOR_SWATCHES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`visor-chip${visor === s.hex ? ' on' : ''}`}
              style={{ backgroundColor: s.hex }}
              title={s.label}
              onClick={() => {
                setVisor(s.hex);
                fx('ui-toggle');
              }}
            />
          ))}
          <label className="visor-custom" title="Custom visor colour">
            <input
              type="color"
              value={visor}
              onChange={(e) => setVisor(e.target.value)}
            />
            <span>Custom</span>
          </label>
        </div>

        <h4>Custom 3D character</h4>
        <div
          className="custom-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleCustomFile(f);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf,.vrm"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCustomFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {customKey ? 'Replace custom 3D model (.glb / .vrm)' : 'Import custom 3D character (.glb / .vrm)'}
          </button>
          <button
            type="button"
            disabled
            title="Coming with the local game bridge"
          >
            Connect to external game
          </button>
          {uploadError ? <p className="hint warn" role="alert">{uploadError}</p> : null}
          {customKey ? <p className="hint" style={{ color: '#7cff4d' }}>Custom model active</p> : null}
        </div>

        <p className="cg-credits" style={{ fontSize: '11px', color: 'rgba(232, 238, 241, .6)', marginTop: '12px' }}>
          Scientist by Scarecrow_original,{' '}
          <a
            href="http://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--power)' }}
          >
            CC BY 4.0
          </a>
        </p>

        <div className="btns">
          <button type="button" onClick={props.onBack}>Back</button>
          <button type="button" className="go" onClick={done}>
            {props.doneLabel ?? 'Done: into the lab'}
          </button>
        </div>
      </section>
    </div>
  );
}
