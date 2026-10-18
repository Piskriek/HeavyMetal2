// ============================================================================
// File: apps/web/src/studio/look-tab.tsx
// TICKET-08b (OPUS_NOTE_15 Item A):
// The Studio's Look tab: a preview viewport with a terrain patch using
// @hm/groundshader stageLook + setCoverage (a @hm/plotbiome cover mask baked
// for a small test plot), the @hm/sky dome via skyUniforms, and the selected
// asset at the gen level its stage would use.
// Controls: stage 0–6 scrubber, sun-elevation slider, and A/B split.
// Pure helper: lookFrame(stage, sunElevDeg).
// ============================================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import {
  createGroundMaterial,
  makeCoverTextures,
  makeGroundTextures,
  setCoverage,
  setStage as setGroundStage,
} from '@hm/groundshader';
import { ASSET_TWEAKS, applyAssetTweak, GEN, loadGenRaw, type GenLevel } from '../assets/gen';

import './look-tab.css';
import {
  LookFrame,
  clamp,
  stageAssetLevel,
  lookFrame,
  bakeLookTestCoverage,
  PATCH_CELLS,
  PATCH_CELL_M,
  PATCH_SPAN,
} from './look-tab-data';

export {
  type LookFrame,
  clamp,
  stageAssetLevel,
  lookFrame,
  bakeLookTestCoverage,
  PATCH_CELLS,
  PATCH_CELL_M,
  PATCH_SPAN,
};

function linearRgbToHex(rgb: readonly [number, number, number]): string {
  const toByte = (v: number): number => {
    const mapped = clamp(v / (1 + Math.max(0, v) * 0.35), 0, 1);
    const srgb = mapped <= 0.0031308 ? mapped * 12.92 : 1.055 * Math.pow(mapped, 1 / 2.4) - 0.055;
    return Math.round(clamp(srgb, 0, 1) * 255);
  };
  const r = toByte(rgb[0]).toString(16).padStart(2, '0');
  const g = toByte(rgb[1]).toString(16).padStart(2, '0');
  const b = toByte(rgb[2]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export interface LookTabProps {
  readonly assetId: string | null;
}

export function LookTab({ assetId }: LookTabProps): ReactElement {
  const [stageA, setStageA] = useState<number>(3);
  const [stageB, setStageB] = useState<number>(5);
  const [sunElevDeg, setSunElevDeg] = useState<number>(28);
  const [abSplit, setAbSplit] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<number>(0.5);

  const effectiveAssetId = useMemo(() => {
    if (assetId && GEN[assetId]) return assetId;
    const keys = Object.keys(GEN);
    return keys.includes('mill') ? 'mill' : (keys[0] ?? null);
  }, [assetId]);

  const frameA = useMemo(() => lookFrame(stageA, sunElevDeg), [stageA, sunElevDeg]);
  const frameB = useMemo(() => lookFrame(stageB, sunElevDeg), [stageB, sunElevDeg]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ frameA, frameB, abSplit, splitRatio, effectiveAssetId });
  stateRef.current = { frameA, frameB, abSplit, splitRatio, effectiveAssetId };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') return undefined;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    } catch {
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.autoClear = false;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);

    // Sky dome mesh
    const skyGeo = new THREE.SphereGeometry(120, 32, 16);
    const skyPos = skyGeo.getAttribute('position');
    const skyCols = new Float32Array(skyPos.count * 3);
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCols, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xd6ecff, 0x3b2f26, 1.1);
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    scene.add(hemi, sun);

    // Ground patch geometry with matA, matB, aShade attributes for @hm/groundshader
    // 64 px tiles: the groundshader accepts only 64, 128, 256 or 512 (and the game's own plot uses 64)
    const groundTex = makeGroundTextures({ size: 64, seed: 42 });
    const coverTiles = makeCoverTextures({ size: 64, seed: 42 });
    const baseBake = bakeLookTestCoverage(3, 42);
    const segs = baseBake.n - 1;
    const patchGeo = new THREE.PlaneGeometry(baseBake.span, baseBake.span, segs, segs);
    patchGeo.rotateX(-Math.PI / 2);
    const posAttr = patchGeo.getAttribute('position');
    const matAArr = new Float32Array(posAttr.count * 3);
    const matBArr = new Float32Array(posAttr.count * 3);
    const shadeArr = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const gx = clamp(Math.floor(((x - baseBake.x0) / baseBake.span) * baseBake.n), 0, baseBake.n - 1);
      const gz = clamp(Math.floor(((z - baseBake.z0) / baseBake.span) * baseBake.n), 0, baseBake.n - 1);
      const h = baseBake.height[gz * baseBake.n + gx] ?? 0;
      posAttr.setY(i, h);
      // Blend rock/gravel/dust/redsoil across the test patch
      matAArr[i * 3] = 0.25;
      matAArr[i * 3 + 1] = 0.25;
      matAArr[i * 3 + 2] = 0.2;
      matBArr[i * 3] = 0.45;
      matBArr[i * 3 + 1] = 0.15;
      matBArr[i * 3 + 2] = 0.1;
      shadeArr[i] = 1.0;
    }
    patchGeo.computeVertexNormals();
    patchGeo.setAttribute('matA', new THREE.BufferAttribute(matAArr, 3));
    patchGeo.setAttribute('matB', new THREE.BufferAttribute(matBArr, 3));
    patchGeo.setAttribute('aShade', new THREE.BufferAttribute(shadeArr, 1));

    const groundMat = createGroundMaterial(groundTex, {
      stage: 3,
      sunDir: new THREE.Vector3(0.5, 0.7, 0.5).normalize(),
      cover: coverTiles,
    });
    const groundMesh = new THREE.Mesh(patchGeo, groundMat);
    scene.add(groundMesh);

    const assetRoot = new THREE.Group();
    scene.add(assetRoot);

    const coverCache = new Map<number, THREE.DataTexture>();
    const getCoverTex = (st: number): THREE.DataTexture => {
      const key = Math.round(st * 2) / 2;
      let tex = coverCache.get(key);
      if (!tex) {
        const b = bakeLookTestCoverage(key, 42);
        tex = new THREE.DataTexture(b.bake.cover, b.n, b.n, THREE.RGBAFormat);
        tex.needsUpdate = true;
        coverCache.set(key, tex);
      }
      return tex;
    };

    const applyLookToScene = (f: LookFrame): void => {
      // Update sky dome vertex colours from skyUniforms
      const cAttr = skyGeo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < cAttr.count; i++) {
        const py = skyPos.getY(i) / 120;
        const t = clamp(py, 0, 1);
        const r = f.sky.horizon[0] * (1 - t) + f.sky.zenith[0] * t;
        const g = f.sky.horizon[1] * (1 - t) + f.sky.zenith[1] * t;
        const b = f.sky.horizon[2] * (1 - t) + f.sky.zenith[2] * t;
        cAttr.array[i * 3] = clamp(r * 0.35, 0.02, 1);
        cAttr.array[i * 3 + 1] = clamp(g * 0.35, 0.02, 1);
        cAttr.array[i * 3 + 2] = clamp(b * 0.35, 0.03, 1);
      }
      cAttr.needsUpdate = true;

      sun.position.set(f.sunDir[0] * 30, f.sunDir[1] * 30, f.sunDir[2] * 30);
      sun.color.setRGB(f.sky.sunColour[0], f.sky.sunColour[1], f.sky.sunColour[2]);
      hemi.color.setRGB(
        clamp(f.sky.zenith[0] * 0.4 + 0.25, 0.2, 1),
        clamp(f.sky.zenith[1] * 0.4 + 0.25, 0.2, 1),
        clamp(f.sky.zenith[2] * 0.4 + 0.3, 0.2, 1),
      );

      setGroundStage(groundMat, f.stage);
      (groundMat.uniforms.uSunDirection!.value as THREE.Vector3).set(f.sunDir[0], f.sunDir[1], f.sunDir[2]).normalize();
      (groundMat.uniforms.uSunColour!.value as THREE.Color).setRGB(f.sky.sunColour[0], f.sky.sunColour[1], f.sky.sunColour[2]);
      const covTex = getCoverTex(f.stage);
      setCoverage(groundMat, {
        tex: covTex,
        x0: baseBake.x0,
        z0: baseBake.z0,
        size: baseBake.span,
        tiles: coverTiles,
      });
    };

    let yaw = 0.65;
    let pitch = 0.36;
    let dist = 11.5;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent): void => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer?.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.006;
      pitch = clamp(pitch + dy * 0.005, 0.08, 1.35);
    };
    const onUp = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      renderer?.domElement.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      dist = clamp(dist * Math.exp(e.deltaY * 0.0012), 3.5, 36);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    const resize = (): void => {
      if (!renderer) return;
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let loadedKey = '';
    const syncAsset = (id: string | null, level: GenLevel): void => {
      const key = `${id ?? ''}:${level}`;
      if (key === loadedKey) return;
      loadedKey = key;
      for (const c of [...assetRoot.children]) assetRoot.remove(c);
      if (!id) return;
      void loadGenRaw(id, level)
        .then((raw) => {
          if (loadedKey !== key) return;
          const inst = applyAssetTweak(raw.clone(true), ASSET_TWEAKS[id]);
          assetRoot.add(inst);
        })
        .catch(() => undefined);
    };

    let raf = 0;
    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      if (!renderer) return;
      const { frameA: fA, frameB: fB, abSplit: split, splitRatio: ratio, effectiveAssetId: id } = stateRef.current;
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      const cp = Math.cos(pitch);
      camera.position.set(
        dist * cp * Math.sin(yaw),
        1.4 + dist * Math.sin(pitch),
        dist * cp * Math.cos(yaw),
      );
      camera.lookAt(0, 1.1, 0);

      if (!split) {
        syncAsset(id, fA.assetLevel);
        applyLookToScene(fA);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.clear();
        renderer.render(scene, camera);
      } else {
        const splitX = Math.round(w * clamp(ratio, 0.1, 0.9));
        renderer.setScissorTest(true);

        // Left half: Stage A
        syncAsset(id, fA.assetLevel);
        applyLookToScene(fA);
        renderer.setViewport(0, 0, w, h);
        renderer.setScissor(0, 0, splitX, h);
        renderer.clear();
        renderer.render(scene, camera);

        // Right half: Stage B
        syncAsset(id, fB.assetLevel);
        applyLookToScene(fB);
        renderer.setViewport(0, 0, w, h);
        renderer.setScissor(splitX, 0, w - splitX, h);
        renderer.clear();
        renderer.render(scene, camera);

        renderer.setScissorTest(false);
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('wheel', onWheel);
      for (const tex of coverCache.values()) tex.dispose();
      groundTex.albedoHeight.dispose();
      groundTex.normalRough.dispose();
      coverTiles.albedoHeight.dispose();
      coverTiles.normalRough.dispose();
      patchGeo.dispose();
      groundMat.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      renderer?.dispose();
      dom.remove();
    };
  }, []);

  return (
    <div className="sx-look" data-testid="studio-look-tab">
      <aside className="sx-look-sidebar" aria-label="Look controls">
        <section className="sx-look-section" aria-label="Stage A Scrubber">
          <div className="sx-look-head">
            <h3>{abSplit ? 'Stage A (Left)' : 'Planetary Stage'}</h3>
            <span className="sx-look-badge">
              Stage {frameA.stage.toFixed(1)} · {frameA.assetLevel.toUpperCase()}
            </span>
          </div>
          <div className="sx-look-stage-pills" role="group" aria-label="Stage presets">
            {[0, 1, 2, 3, 4, 5, 6].map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={Math.round(stageA) === s}
                onClick={() => setStageA(s)}
              >
                S{s}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={6}
            step={0.1}
            value={stageA}
            onChange={(e) => setStageA(Number(e.target.value))}
            aria-label="Stage 0 to 6 scrubber"
          />
          <div className="sx-look-readout-grid">
            <div className="sx-look-kv"><span>Texels/m</span><b>{frameA.ground.texelsPerMetre.toFixed(1)}</b></div>
            <div className="sx-look-kv"><span>Levels</span><b>{Math.round(frameA.ground.levels)}</b></div>
            <div className="sx-look-kv"><span>Normals</span><b>{frameA.ground.normalStrength.toFixed(2)}</b></div>
            <div className="sx-look-kv"><span>Specular</span><b>{frameA.ground.specular.toFixed(2)}</b></div>
            <div className="sx-look-kv"><span>Triplanar</span><b>{frameA.ground.triplanar ? 'On' : 'Off'}</b></div>
            <div className="sx-look-kv"><span>Sky Density</span><b>{(frameA.sky.density * 100).toFixed(0)}%</b></div>
          </div>
        </section>

        <section className="sx-look-section" aria-label="Sun Elevation">
          <div className="sx-look-head">
            <h3>Sun Elevation</h3>
            <span className="sx-look-badge">{frameA.sunElevDeg.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min={-10}
            max={85}
            step={1}
            value={sunElevDeg}
            onChange={(e) => setSunElevDeg(Number(e.target.value))}
            aria-label="Sun elevation slider"
          />
          <div className="sx-look-swatches" aria-label="Sky uniform swatches">
            <div className="sx-look-swatch">
              <span className="sx-look-swatch-chip" style={{ background: linearRgbToHex(frameA.sky.zenith) }} />
              <span>Zenith</span>
            </div>
            <div className="sx-look-swatch">
              <span className="sx-look-swatch-chip" style={{ background: linearRgbToHex(frameA.sky.horizon) }} />
              <span>Horizon</span>
            </div>
            <div className="sx-look-swatch">
              <span className="sx-look-swatch-chip" style={{ background: linearRgbToHex(frameA.sky.sunGlow) }} />
              <span>Sun Glow</span>
            </div>
            <div className="sx-look-swatch">
              <span className="sx-look-swatch-chip" style={{ background: linearRgbToHex(frameA.sky.sunColour) }} />
              <span>Sun Disc</span>
            </div>
          </div>
        </section>

        <section className="sx-look-section" aria-label="A/B Split">
          <div className="sx-look-head">
            <h3>A/B Stage Split</h3>
            <button
              type="button"
              aria-pressed={abSplit}
              onClick={() => setAbSplit((v) => !v)}
              aria-label="Toggle A/B stage split"
            >
              {abSplit ? 'A/B Active' : 'Enable A/B'}
            </button>
          </div>
          {abSplit ? (
            <>
              <div className="sx-look-row">
                <span>Stage B (Right)</span>
                <span className="sx-look-badge cyan">
                  Stage {frameB.stage.toFixed(1)} · {frameB.assetLevel.toUpperCase()}
                </span>
              </div>
              <div className="sx-look-stage-pills" role="group" aria-label="Stage B presets">
                {[0, 1, 2, 3, 4, 5, 6].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={Math.round(stageB) === s}
                    onClick={() => setStageB(s)}
                  >
                    S{s}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={0.1}
                value={stageB}
                onChange={(e) => setStageB(Number(e.target.value))}
                aria-label="Stage B scrubber"
              />
              <div className="sx-look-row">
                <span>Split Curtain</span>
                <b>{Math.round(splitRatio * 100)}%</b>
              </div>
              <input
                type="range"
                min={0.15}
                max={0.85}
                step={0.01}
                value={splitRatio}
                onChange={(e) => setSplitRatio(Number(e.target.value))}
                aria-label="A/B split position"
              />
              <div className="sx-look-readout-grid">
                <div className="sx-look-kv"><span>B Texels/m</span><b>{frameB.ground.texelsPerMetre.toFixed(1)}</b></div>
                <div className="sx-look-kv"><span>B Sky Density</span><b>{(frameB.sky.density * 100).toFixed(0)}%</b></div>
              </div>
            </>
          ) : (
            <p className="sx-dim" style={{ fontSize: 12 }}>
              Compare two fidelity stages side by side across ground shader, biome coverage, sky scattering, and asset LOD.
            </p>
          )}
        </section>

        <section className="sx-look-section" aria-label="Asset Preview Target">
          <div className="sx-look-head">
            <h3>Preview Asset</h3>
            <span className="sx-look-badge">{effectiveAssetId ?? 'None'}</span>
          </div>
          <p className="sx-dim" style={{ fontSize: 12 }}>
            Showing <b>{effectiveAssetId ?? 'none'}</b> at <b>{frameA.assetLevel}</b> detail on a 40 m test plot with baked moss, grass, and water coverage.
          </p>
        </section>
      </aside>

      <div className="sx-look-stage-wrap">
        <div ref={hostRef} className="sx-look-canvas-host" />
        <div className="sx-look-ab-pill left">
          A · Stage {frameA.stage.toFixed(1)} ({frameA.assetLevel.toUpperCase()})
        </div>
        {abSplit ? (
          <>
            <div
              className="sx-look-ab-divider"
              style={{ left: `${Math.round(splitRatio * 100)}%` }}
            />
            <div className="sx-look-ab-pill right">
              B · Stage {frameB.stage.toFixed(1)} ({frameB.assetLevel.toUpperCase()})
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default LookTab;
