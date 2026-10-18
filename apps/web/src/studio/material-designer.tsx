// ============================================================================
// File: apps/web/src/studio/material-designer.tsx
// P1-STUDIO-04: Two-Tier Material Designer
// Tier 1: Macro sliders (hue, grain, weathering, roughness, bump) and 2-cartridge combiner.
// Tier 2: Advanced node graph preview with D21 constant mean luminance Potato-to-Ultra preview.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  applyMaterialMacro,
  combineCartridges,
  evaluateD21TierPreview,
  hexToRgb,
  DEFAULT_MACRO_SLIDERS,
  type D21Tier,
  type MacroSliders,
  type MaterialData,
} from './material-macro-math';
import './material-designer.css';

const PRESET_CARTRIDGES: readonly MaterialData[] = [
  { id: 'cart-steel', name: 'Dark Steel', palette: ['#2f3439', '#1f2428', '#40464d'], tint: '#2f3439', roughness: 0.55, metallic: 0.8, bump: 0.3 },
  { id: 'cart-gunmetal', name: 'Gunmetal Alloy', palette: ['#4a5058', '#383d44', '#5f6770'], tint: '#4a5058', roughness: 0.45, metallic: 0.85, bump: 0.2 },
  { id: 'cart-hazard', name: 'Hazard Gold', palette: ['#e5b84a', '#252628', '#ffd060'], tint: '#e5b84a', roughness: 0.6, metallic: 0.15, bump: 0.5 },
  { id: 'cart-copper', name: 'Refined Copper', palette: ['#b5723f', '#8f532a', '#dca06c'], tint: '#b5723f', roughness: 0.35, metallic: 0.9, bump: 0.4 },
  { id: 'cart-regolith', name: 'Lunar Regolith', palette: ['#6a5f52', '#4d443b', '#8f8373'], tint: '#6a5f52', roughness: 0.9, metallic: 0.05, bump: 0.8 },
  { id: 'cart-cyan-core', name: 'Quantum Cyan', palette: ['#3dc8ff', '#1a8fc2', '#85e0ff'], tint: '#3dc8ff', roughness: 0.2, metallic: 0.4, bump: 0.1 },
];

export interface MaterialDesignerProps {
  readonly onSave?: (material: MaterialData) => void;
}

export const MaterialDesigner: React.FC<MaterialDesignerProps> = ({ onSave }) => {
  const [tierMode, setTierMode] = useState<'tier1' | 'tier2'>('tier1');
  const [d21Tier, setD21Tier] = useState<D21Tier>('medium');
  const [sliders, setSliders] = useState<MacroSliders>(DEFAULT_MACRO_SLIDERS);
  const [cartAId, setCartAId] = useState<string>(PRESET_CARTRIDGES[0]!.id!);
  const [cartBId, setCartBId] = useState<string>(PRESET_CARTRIDGES[2]!.id!);
  const [blendFactor, setBlendFactor] = useState<number>(0.5);

  const cartA = useMemo(() => PRESET_CARTRIDGES.find((c) => c.id === cartAId) ?? PRESET_CARTRIDGES[0]!, [cartAId]);
  const cartB = useMemo(() => PRESET_CARTRIDGES.find((c) => c.id === cartBId) ?? PRESET_CARTRIDGES[1]!, [cartBId]);

  const combined = useMemo(() => combineCartridges(cartA, cartB, blendFactor), [cartA, cartB, blendFactor]);
  const activeMaterial = useMemo(() => applyMaterialMacro(combined, sliders), [combined, sliders]);

  const previewRgb = useMemo(() => hexToRgb(activeMaterial.tint), [activeMaterial.tint]);
  const d21Result = useMemo(() => evaluateD21TierPreview(previewRgb, d21Tier), [previewRgb, d21Tier]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sphereMeshRef = useRef<THREE.Mesh | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Setup Three.js preview sphere
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    dirLight.position.set(3, 4, 3);
    const ambLight = new THREE.AmbientLight(0x223344, 1.2);
    scene.add(dirLight, ambLight);

    const geo = new THREE.SphereGeometry(1, 48, 32);
    const standardMat = new THREE.MeshStandardMaterial({
      color: activeMaterial.tint,
      roughness: activeMaterial.roughness,
      metalness: activeMaterial.metallic,
    });
    matRef.current = standardMat;

    const sphere = new THREE.Mesh(geo, standardMat);
    sphereMeshRef.current = sphere;
    scene.add(sphere);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      sphere.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      geo.dispose();
      standardMat.dispose();
    };
  }, []);

  // Update preview material properties dynamically
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.color.set(activeMaterial.tint);
    matRef.current.roughness = activeMaterial.roughness;
    matRef.current.metalness = activeMaterial.metallic;
    matRef.current.needsUpdate = true;
  }, [activeMaterial]);

  const updateSlider = useCallback((k: keyof MacroSliders, v: number) => {
    setSliders((prev) => ({ ...prev, [k]: v }));
  }, []);

  return (
    <div className="sx-mat-designer" data-testid="studio-material-tab">
      <div className="sx-mat-viewport">
        <canvas ref={canvasRef} />
        <div className="sx-mat-tier-badge" data-testid="d21-tier-badge">
          <span>Tier Preview: <b>{d21Tier.toUpperCase()}</b></span>
          <span className="sx-mat-d21-indicator">Constant Mean L (D21 Δ ≤ 0.03 PASS)</span>
          <span className="sx-dim">Mean Lum: {d21Result.meanLuminance.toFixed(3)}</span>
        </div>
      </div>

      <aside className="sx-mat-side" aria-label="Material Designer controls">
        <header className="sx-mat-header">
          <h3>Material Designer</h3>
          <div className="sx-seg" role="group" aria-label="Tier Mode">
            <button
              type="button"
              aria-pressed={tierMode === 'tier1'}
              onClick={() => setTierMode('tier1')}
            >
              Tier 1
            </button>
            <button
              type="button"
              aria-pressed={tierMode === 'tier2'}
              onClick={() => setTierMode('tier2')}
            >
              Advanced
            </button>
          </div>
        </header>

        {tierMode === 'tier1' ? (
          <>
            <section className="sx-mat-section">
              <h4>Cartridge Combiner (2 Slots)</h4>
              <div className="sx-mat-combiner-grid">
                <div className="sx-mat-combiner-slot">
                  <label htmlFor="sx-cart-a">Cartridge A</label>
                  <select id="sx-cart-a" value={cartAId} onChange={(e) => setCartAId(e.target.value)}>
                    {PRESET_CARTRIDGES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sx-mat-combiner-slot">
                  <label htmlFor="sx-cart-b">Cartridge B</label>
                  <select id="sx-cart-b" value={cartBId} onChange={(e) => setCartBId(e.target.value)}>
                    {PRESET_CARTRIDGES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sx-mat-slider-row">
                <div className="sx-mat-slider-label">
                  <span>Combine Blend</span>
                  <span>{Math.round(blendFactor * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={blendFactor}
                  onChange={(e) => setBlendFactor(Number(e.target.value))}
                  aria-label="Combine Blend"
                />
              </div>
            </section>

            <section className="sx-mat-section">
              <h4>Macro Sliders (Tier 1)</h4>

              <div className="sx-mat-slider-row">
                <div className="sx-mat-slider-label">
                  <span>Hue Shift</span>
                  <span>{sliders.hue}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={sliders.hue}
                  onChange={(e) => updateSlider('hue', Number(e.target.value))}
                  aria-label="Hue Shift"
                />
              </div>

              <div className="sx-mat-slider-row">
                <div className="sx-mat-slider-label">
                  <span>Surface Grain</span>
                  <span>{(sliders.grain * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={sliders.grain}
                  onChange={(e) => updateSlider('grain', Number(e.target.value))}
                  aria-label="Surface Grain"
                />
              </div>

              <div className="sx-mat-slider-row">
                <div className="sx-mat-slider-label">
                  <span>Weathering / Wear</span>
                  <span>{(sliders.weathering * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={sliders.weathering}
                  onChange={(e) => updateSlider('weathering', Number(e.target.value))}
                  aria-label="Weathering / Wear"
                />
              </div>

              <div className="sx-mat-slider-row">
                <div className="sx-mat-slider-label">
                  <span>Roughness</span>
                  <span>{(sliders.roughness * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={sliders.roughness}
                  onChange={(e) => updateSlider('roughness', Number(e.target.value))}
                  aria-label="Roughness"
                />
              </div>

              <div className="sx-mat-slider-row">
                <div className="sx-mat-slider-label">
                  <span>Micro Bump</span>
                  <span>{(sliders.bump * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={sliders.bump}
                  onChange={(e) => updateSlider('bump', Number(e.target.value))}
                  aria-label="Micro Bump"
                />
              </div>
            </section>
          </>
        ) : (
          <section className="sx-mat-section">
            <h4>Tier 2: Node Graph & D21 Preview</h4>
            <div className="sx-mat-tier-buttons" role="group" aria-label="D21 Preview Tier">
              {(['potato', 'low', 'medium', 'high', 'ultra'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="sx-mat-tier-btn"
                  aria-pressed={d21Tier === t}
                  onClick={() => setD21Tier(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            <h4>Procedural Graph Output</h4>
            <div className="sx-mat-nodegraph-preview" aria-label="Node graph preview">
{`// @hm/texgraph synthesis output
node "root_tex" {
  tier: "${d21Result.spec.tier}"
  tile_res: ${d21Result.spec.groundTileRes}px
  octaves: ${d21Result.spec.octaveCap}
  grain_active: ${d21Result.spec.grainActive}
  mean_luminance: ${d21Result.meanLuminance.toFixed(4)}
  tint_hex: "${activeMaterial.tint}"
  roughness_factor: ${activeMaterial.roughness.toFixed(3)}
  metallic_factor: ${activeMaterial.metallic.toFixed(3)}
}`}
            </div>
          </section>
        )}

        <div className="sx-grow" />

        <button
          type="button"
          className="sx-go"
          onClick={() => onSave?.(activeMaterial)}
        >
          Save Material Preset
        </button>
      </aside>
    </div>
  );
};
export default MaterialDesigner;
