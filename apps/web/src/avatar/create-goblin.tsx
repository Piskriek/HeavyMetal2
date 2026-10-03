import { useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import { Animator, animById } from '@hm/anim';
import { LOOKS, LOOK_VARIABLES, nameProblem, randomLook, type AvatarLook, type LookSlot, type PartPlace } from '@hm/avatarlook';
import { PLACES, partsFor } from './accessories';
import { AvatarView } from '@hm/render';
import { goblinRigged } from '../build/cards';
import { PartsPicker } from './parts-picker';
import { PresetPreview } from '../build/cards';
import { fx } from '../maker/feedback';
import { player, saveLook } from '../build/player';

/**
 * Create your goblin: the first thing Play asks. A turntable shows your goblin alive (breathing, waving when you change it); pick a ready-made
 * look, change any colour, roll the dice, give it a name. Done takes you to your island. Everything here is the avatar preset; the same
 * editor opens later from the Avatar tab (P).
 */
function GoblinTurntable(props: { readonly look: AvatarLook; readonly wave: number }): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setLook: (l: AvatarLook) => void; wave: () => void } | null>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff3df, 0x8a9a7a, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-2, 4, 3);
    sun.castShadow = true;
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshStandardMaterial({ color: 0x9cc06a, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    let view: AvatarView | null = null;
    let tall = 1.76; // metres: the camera frames the goblin with whatever it wears
    const setLook = (l: AvatarLook): void => {
      view?.dispose();
      const m = goblinRigged(l);
      if (!m) return;
      tall = m.model.size[1] * 0.04;
      view = new AvatarView(m.model, m.rig, 0.04);
      view.group.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) mesh.castShadow = true; });
      scene.add(view.group);
    };
    const animator = new Animator();
    api.current = { setLook, wave: () => animator.play(animById('wave')) };
    setLook(props.look);
    const resize = (): void => { const r = el.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let raf = 0, last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const a = now * 0.00035;
      const dist = Math.max(4.6, tall * 2.6);
      camera.position.set(Math.sin(a) * dist, tall * 0.75, Math.cos(a) * dist);
      camera.lookAt(0, tall * 0.53, 0);
      if (view) { view.place(0, 0, 0, Math.PI, true); view.setPose(animator.update(dt, { speed: 0, grounded: true, vy: 0 })); }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); view?.dispose(); renderer.dispose(); renderer.domElement.remove(); api.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setLook(props.look); }, [props.look]);
  useEffect(() => { if (props.wave) api.current?.wave(); }, [props.wave]);
  return <div ref={host} className="turntable" aria-label="Your goblin, turning slowly" role="img" />;
}

const QUICK: readonly LookSlot[] = ['skin', 'eyes', 'vest', 'shield'];
/** The dice also dress the goblin: each place gets a part about half the time. */
function randomParts(): Partial<Record<PartPlace, string>> {
  const out: Partial<Record<PartPlace, string>> = {};
  for (const pl of PLACES) { const list = partsFor(pl.place); if (list.length && Math.random() < 0.5) out[pl.place] = list[Math.floor(Math.random() * list.length)]!.id; }
  if (out.hat && out.hair) delete out.hair;
  return out;
}

export function CreateGoblin(props: { readonly onDone: (look: AvatarLook) => void; readonly onBack: () => void }): ReactElement {
  const start = player();
  const first = start.looks.find((l) => l.id === start.lookId) ?? LOOKS[0]!;
  const [look, setLook] = useState<AvatarLook>({ ...first, name: start.created ? first.name : '' });
  const [wave, setWave] = useState(0);
  const [touched, setTouched] = useState(false);
  const problem = nameProblem(look.name);
  const change = (patch: Partial<AvatarLook>): void => { setLook((l) => ({ ...l, ...patch })); setWave((w) => w + 1); };
  const done = (): void => {
    if (problem) { setTouched(true); fx('ui-error'); return; }
    const saved = saveLook({ ...look, name: look.name.trim() });
    fx('ui-success');
    props.onDone(saved);
  };
  return (
    <div className="create-goblin" role="dialog" aria-label="Create your goblin">
      <GoblinTurntable look={look} wave={wave} />
      <section className="cg-panel">
        <h2>Your goblin</h2>
        <label className="cg-name">
          <span>Name</span>
          <input autoFocus value={look.name} maxLength={20} placeholder="Give it a name" onChange={(e) => { setLook((l) => ({ ...l, name: e.target.value })); setTouched(true); }} onKeyDown={(e) => { if (e.key === 'Enter') done(); }} />
        </label>
        {touched && problem ? <p className="hint warn" role="alert">{problem}</p> : null}
        <h4>Looks</h4>
        <div className="cg-looks">
          {LOOKS.map((l) => (
            <button key={l.id} className={l.skin === look.skin && l.vest === look.vest ? 'on' : ''} onClick={() => change({ ...l, id: look.id, name: look.name, ...(look.parts ? { parts: look.parts } : {}) })} title={l.name}>
              <PresetPreview p={{ kind: 'look', look: l }} size={64} /><span>{l.name}</span>
            </button>
          ))}
        </div>
        <h4>What it wears</h4>
        <PartsPicker look={look} onChange={(parts) => change({ parts })} />
        <h4>Colours</h4>
        <div className="cg-colours">
          {LOOK_VARIABLES.filter((v) => QUICK.includes(v.key as LookSlot)).map((v) => (
            <label key={v.key}><input type="color" value={look[v.key as LookSlot]} onChange={(e) => change({ [v.key]: e.target.value } as Partial<AvatarLook>)} /><span>{v.label}</span></label>
          ))}
        </div>
        <p className="hint">More colours, and how your goblin walks and runs, are in the Avatar and Animate tabs once you are on your island.</p>
        <div className="btns">
          <button onClick={() => { change({ ...randomLook(Math.floor(Math.random() * 1e9), look.name), id: look.id, parts: randomParts() }); fx('ui-toggle'); }}>Roll the dice</button>
          <span className="grow" />
          <button onClick={props.onBack}>Back</button>
          <button className="go" onClick={done}>Done: to my island</button>
        </div>
      </section>
    </div>
  );
}
