/**
 * The Paint Shop — player livery for the Hoop-Pod (docs/HOOP_POD.md §Paint Shop).
 *
 * Visual system (docs/GAME_DESIGN.md): charcoal iron, forest teal, aged brass, warm parchment and a
 * restrained crimson primary action; Cinzel headings, sans body; large beveled rectangles, ornament
 * only at the edges. One pod is the focal point (Blizzard character-creation guidance) and every
 * colour has a text name (Xbox AG 102). Keyboard: arrows move within tabs/options, Enter/Space
 * select, Escape goes back (AG 112). Reduced motion stops the turntable (AG 117).
 *
 * The preview is the real race renderer — a one-slot HoopPodFleet — not a mock-up.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as THREE from 'three';
import { capsuleById, riderById, type Loadout } from '../game/loadouts';
import {
  HoopPodFleet, POD_EMBLEMS, POD_LIVERY_EVENT, POD_PATTERNS, POD_PRESETS, describeLivery, liveryForLoadout,
  loadPlayerLivery, sameLivery, savePlayerLivery, type PodLivery,
} from '../game/pod';
import '../pod-paint-shop.css';

export interface PodPaintShopProps {
  /** The player's current loadout — drives "Capsule colours" and the default look. */
  readonly loadout: Loadout;
  /** Team colour (roster colour for PLAYER_ID). */
  readonly teamColor?: string;
  readonly reducedMotion?: boolean;
  readonly onBack?: () => void;
  readonly onSaved?: (livery: PodLivery | null) => void;
}

type Swatch = { readonly name: string; readonly hex: string };
type CategoryId = 'primary' | 'secondary' | 'trim' | 'glass' | 'decalColor' | 'hubDecal' | 'bandPattern' | 'wear';
interface Category {
  readonly id: CategoryId;
  readonly label: string;
  readonly hint: string;
  readonly options: readonly { readonly label: string; readonly value: string | number; readonly swatch?: string }[];
}

const sw = (list: readonly Swatch[]) => list.map((s) => ({ label: s.name, value: s.hex, swatch: s.hex }));
const CATEGORIES: readonly Category[] = [
  { id: 'primary', label: 'Hoop Paint', hint: 'Hoops one, three, four and six, plus the hubcap field.', options: sw([
    { name: 'Riveted Iron', hex: '#7a6f66' }, { name: 'Charcoal Iron', hex: '#3a3b40' }, { name: 'Forest Teal', hex: '#2f6b5e' },
    { name: 'Springsteel Teal', hex: '#4f9f97' }, { name: 'Goblin Green', hex: '#4a9a32' }, { name: 'Scrapdome Crimson', hex: '#9c2f24' },
    { name: 'Aged Brass', hex: '#b8893a' }, { name: 'Trade Prince Gold', hex: '#e8b53a' }, { name: 'Siege Plate', hex: '#4b4f5c' },
  ]) },
  { id: 'secondary', label: 'Accent & Core', hint: 'Accent hoops two and five, and the inner ball behind the porthole.', options: sw([
    { name: 'Team Orange', hex: '#f0a15b' }, { name: 'Rust Patch', hex: '#a8602e' }, { name: 'Gunmetal', hex: '#3c3844' },
    { name: 'Bone White', hex: '#e9dcb8' }, { name: 'Royal Purple', hex: '#6a32a0' }, { name: 'Lagoon', hex: '#87d7ba' },
    { name: 'Lavender', hex: '#b7a0e8' }, { name: 'Sunflower', hex: '#e4cc77' },
  ]) },
  { id: 'trim', label: 'Rivets & Rims', hint: 'Every rivet, rim ring and porthole rail.', options: sw([
    { name: 'Raw Iron', hex: '#8f8a84' }, { name: 'Brass', hex: '#e0aa48' }, { name: 'Copper', hex: '#d0784a' },
    { name: 'Steel', hex: '#d8dde2' }, { name: 'Pale Gold', hex: '#fff0b0' },
  ]) },
  { id: 'glass', label: 'Porthole Glass', hint: 'The glow of the forward porthole.', options: sw([
    { name: 'Amber Lantern', hex: '#ffb238' }, { name: 'Candle Yellow', hex: '#ffc34d' }, { name: 'Forge Orange', hex: '#ff9a3a' },
    { name: 'Fel Green', hex: '#7dff3a' }, { name: 'Ruby', hex: '#ff3a5a' }, { name: 'Teal Crystal', hex: '#35f0d0' },
  ]) },
  { id: 'hubDecal', label: 'Emblem', hint: 'Painted on both hubcaps; reads correctly from either side.',
    options: POD_EMBLEMS.map((name, i) => ({ label: name, value: i })) },
  { id: 'decalColor', label: 'Emblem Colour', hint: 'Emblem and band-pattern ink.', options: sw([
    { name: 'Parchment', hex: '#e9dfc9' }, { name: 'Bright Gold', hex: '#f3d49b' }, { name: 'Rivet Tan', hex: '#d8b479' },
    { name: 'Nix Lilac', hex: '#b6a3e0' }, { name: 'Grub Moss', hex: '#a9c18a' }, { name: 'Sprocket Clay', hex: '#db9374' },
    { name: 'Teal Glow', hex: '#35f0d0' }, { name: 'Soot', hex: '#1a1418' },
  ]) },
  { id: 'bandPattern', label: 'Bands', hint: 'Painted around every hoop. Glow runes are emissive.',
    options: POD_PATTERNS.map((name, i) => ({ label: name, value: i })) },
  { id: 'wear', label: 'Weathering', hint: 'Edge chips first, then rust blooms.', options: [
    { label: 'Showroom', value: 0 }, { label: 'Race-worn', value: 0.35 }, { label: 'Battle-scarred', value: 0.6 }, { label: 'Scrapyard', value: 0.85 },
  ] },
];

const isSelected = (livery: PodLivery, cat: Category, value: string | number) => {
  const current = livery[cat.id];
  return typeof current === 'number' && typeof value === 'number' ? Math.abs(current - value) < 1e-6 : current === value;
};

export default function PodPaintShop({ loadout, teamColor = '#f0a15b', reducedMotion, onBack, onSaved }: PodPaintShopProps) {
  const capsuleLook = useMemo(() => liveryForLoadout(loadout, teamColor), [loadout, teamColor]);
  const [saved, setSaved] = useState<PodLivery | null>(() => loadPlayerLivery());
  const [livery, setLivery] = useState<PodLivery>(() => saved ?? capsuleLook);
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState('');
  const systemReduced = usePrefersReducedMotion();
  const still = reducedMotion ?? systemReduced;
  const headingId = useId();
  const cat = CATEGORIES[tab];
  const dirty = !sameLivery(livery, saved ?? capsuleLook);
  const capsule = capsuleById(loadout.capsule);
  const rider = riderById(loadout.rider);

  const pick = useCallback((c: Category, value: string | number) => {
    setLivery((l) => ({ ...l, [c.id]: value }) as PodLivery);
    setStatus('');
  }, []);

  const save = () => {
    const result = savePlayerLivery(livery);
    if (result.ok) {
      setSaved(livery);
      window.dispatchEvent(new CustomEvent(POD_LIVERY_EVENT, { detail: livery }));
      setStatus('Livery saved. Your pod wears it from the next frame.');
      onSaved?.(livery);
    } else {
      setStatus(result.reason === 'invalid'
        ? 'That livery could not be saved.'
        : 'This browser would not store the livery. It will apply for this session only.');
      window.dispatchEvent(new CustomEvent(POD_LIVERY_EVENT, { detail: livery }));
    }
  };
  const restore = () => {
    savePlayerLivery(null);
    setSaved(null);
    setLivery(capsuleLook);
    window.dispatchEvent(new CustomEvent(POD_LIVERY_EVENT, { detail: null }));
    setStatus(`Restored the ${capsule.name} colours.`);
    onSaved?.(null);
  };

  const onRootKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && onBack) {
      e.preventDefault();
      onBack();
    }
  };

  return (
    <section className="pod-shop" aria-labelledby={headingId} onKeyDown={onRootKey} data-reduced-motion={still || undefined}>
      <span className="pod-shop__corner pod-shop__corner--tl" aria-hidden />
      <span className="pod-shop__corner pod-shop__corner--br" aria-hidden />

      <header className="pod-shop__header">
        <div className="pod-shop__flourish" aria-hidden><span /><i /><span /></div>
        <h2 id={headingId} className="pod-shop__title">The Paint Shop</h2>
        <p className="pod-shop__subtitle">{rider.name} · {capsule.name} · {capsule.title}</p>
      </header>

      <div className="pod-shop__body">
        <div className="pod-shop__stage">
          <PodPreview livery={livery} still={still} label={`${capsule.name} Hoop-Pod preview. ${describeLivery(livery)}.`} />
          <p className="pod-shop__describe" aria-live="polite">{describeLivery(livery)}</p>
          <div className="pod-shop__presets" role="group" aria-label="Preset liveries">
            <button type="button" className="pod-plate" data-active={sameLivery(livery, capsuleLook) || undefined} onClick={() => setLivery(capsuleLook)}>
              <span className="pod-plate__name">Capsule colours</span>
              <span className="pod-plate__meta">{capsule.name}</span>
            </button>
            {POD_PRESETS.map((p) => (
              <button key={p.id} type="button" className="pod-plate" data-rarity={p.rarity.toLowerCase()} data-active={sameLivery(livery, p.livery) || undefined} onClick={() => setLivery(p.livery)}>
                <span className="pod-plate__name">{p.name}</span>
                <span className="pod-plate__meta">{p.rarity}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pod-shop__workbench">
          <Tabs index={tab} onChange={setTab} />
          <div className="pod-shop__panel" role="tabpanel" id={`pod-panel-${cat.id}`} aria-labelledby={`pod-tab-${cat.id}`}>
            <p className="pod-shop__hint">{cat.hint}</p>
            <Options category={cat} livery={livery} onPick={pick} />
          </div>
        </div>
      </div>

      <footer className="pod-shop__footer">
        {onBack && <button type="button" className="pod-btn" onClick={onBack}>Back</button>}
        <button type="button" className="pod-btn" onClick={restore}>Use capsule colours</button>
        <p className="pod-shop__status" role="status">{status || (dirty ? 'Unsaved changes.' : saved ? 'Wearing your saved livery.' : 'Wearing capsule colours.')}</p>
        <button type="button" className="pod-btn pod-btn--primary" onClick={save} disabled={!dirty}>Save livery</button>
      </footer>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function Tabs({ index, onChange }: { index: number; onChange: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? CATEGORIES.length - 1 : (index + delta + CATEGORIES.length) % CATEGORIES.length;
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="pod-tabs" role="tablist" aria-label="Livery parts" aria-orientation="vertical" onKeyDown={move}>
      {CATEGORIES.map((c, i) => (
        <button
          key={c.id} ref={(el) => { refs.current[i] = el; }} id={`pod-tab-${c.id}`} type="button" role="tab"
          aria-selected={i === index} aria-controls={`pod-panel-${c.id}`} tabIndex={i === index ? 0 : -1}
          className="pod-tab" onClick={() => onChange(i)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Options({ category, livery, onPick }: { category: Category; livery: PodLivery; onPick: (c: Category, v: string | number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, category.options.findIndex((o) => isSelected(livery, category, o.value)));
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const cols = category.options.length > 8 ? 3 : 2;
    const map: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    const delta = map[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const n = category.options.length;
    const next = (selected + delta + n) % n;
    onPick(category, category.options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="pod-options" role="radiogroup" aria-label={category.label} onKeyDown={move} data-dense={category.options.length > 8 || undefined}>
      {category.options.map((o, i) => {
        const on = i === selected && isSelected(livery, category, o.value);
        return (
          <button
            key={o.label} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on}
            tabIndex={i === selected ? 0 : -1} className="pod-option" onClick={() => onPick(category, o.value)}
          >
            {o.swatch && <span className="pod-option__swatch" style={{ background: o.swatch }} aria-hidden />}
            <span className="pod-option__label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function PodPreview({ livery, still, label }: { livery: PodLivery; still: boolean; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const liveryRef = useRef(livery);
  const dirtyRef = useRef(true);
  const stillRef = useRef(still);
  const yawRef = useRef(0.55);
  liveryRef.current = livery;
  stillRef.current = still;
  useEffect(() => { dirtyRef.current = true; }, [livery]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      host.dataset.failed = 'true';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // matches renderer-3d.ts
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffe6bf, 0x1f3b35, 1.5));
    const key = new THREE.DirectionalLight(0xffd9a0, 2.6);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight(0x8fd8c8, 1.4);
    rim.position.set(-4, 2, -3);
    scene.add(key, rim);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 1.35, 5.4);
    camera.lookAt(0, 0.95, 0);

    const fleet = new HoopPodFleet(scene, {
      capacity: 1, radius: 1, lods: ['hero', 'hero', 'hero'], frustumCull: false, bakeLayers: 1, playerDesign: false, listen: false,
    });
    fleet.setCount(1);
    const racer = { id: -1 };
    const pos = { x: 0, y: 1, z: 0 };
    const yaw = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let roll = 0;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; host.setPointerCapture(e.pointerId); };
    const moveP = (e: PointerEvent) => { if (dragging) { yawRef.current += (e.clientX - lastX) * 0.01; lastX = e.clientX; } };
    const up2 = () => { dragging = false; };
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', moveP);
    host.addEventListener('pointerup', up2);
    host.addEventListener('pointercancel', up2);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!stillRef.current) {
        if (!dragging) yawRef.current += dt * 0.35;
        roll = (roll + dt * 1.6) % (Math.PI * 2);
      }
      yaw.setFromAxisAngle(up, yawRef.current);
      fleet.setRacer(0, racer, pos, yaw, roll, true, 0, dt);
      if (dirtyRef.current) {
        fleet.setLivery(0, liveryRef.current);
        dirtyRef.current = false;
      }
      fleet.commit(camera, dt, stillRef.current, host.clientHeight);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', moveP);
      host.removeEventListener('pointerup', up2);
      host.removeEventListener('pointercancel', up2);
      fleet.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { yawRef.current -= 0.2; e.preventDefault(); }
    if (e.key === 'ArrowRight') { yawRef.current += 0.2; e.preventDefault(); }
  };

  return (
    <div className="pod-preview" ref={hostRef} role="img" aria-label={label} tabIndex={0} onKeyDown={onKey}>
      <span className="pod-preview__hint" aria-hidden>Drag or use ← → to turn</span>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}
