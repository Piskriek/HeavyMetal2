import * as THREE from 'three';
import { createPlume, METRIC_COLOURS, PLUME_MODES, type PlumeMode } from './index';

const VENT_COLOURS = [METRIC_COLOURS.pxd, METRIC_COLOURS.vtx, METRIC_COLOURS.lx, METRIC_COLOURS.aq, METRIC_COLOURS.all];
const VENT_NAMES = ['Pxd', 'Vtx', 'Lx', 'Aq', 'All'];
const WAVE_FROM: [number, number, number] = [0, 0.8, 0];
const WAVE_METRES = 60;
const WAVE_SECONDS = 8;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text) e.textContent = text;
  return e;
}

/** Mounts the preview into `host`; returns a cleanup function. */
export function mountPreview(host: HTMLElement): () => void {
  host.style.cssText = 'position:relative;width:100%;height:100vh;background:#05060a;overflow:hidden;font:13px/1.4 ui-monospace,Menlo,monospace;color:#cfd6e4';

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch {
    host.append(el('div', 'padding:24px', 'WebGL2 is not available in this browser.'));
    return () => undefined;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.Fog(0x05060a, 40, 140);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);

  // dark ground
  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshBasicMaterial({ color: 0x0b0d13 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(120, 60, 0x1a1f2c, 0x11141d);
  grid.position.y = 0.01;
  scene.add(grid);

  // five machines in a row
  const body = new THREE.CylinderGeometry(0.9, 1.1, 0.8, 24);
  const rim = new THREE.TorusGeometry(0.75, 0.09, 8, 32);
  VENT_COLOURS.forEach((c, i) => {
    const x = (i - 2) * 4.5;
    const m = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: 0x1c212e }));
    m.position.set(x, 0.4, 0);
    scene.add(m);
    const r = new THREE.Mesh(rim, new THREE.MeshBasicMaterial({ color: c }));
    r.rotation.x = Math.PI / 2;
    r.position.set(x, 0.82, 0);
    scene.add(r);
  });

  // the wave's front, drawn on the ground
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.985, 1, 192),
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(WAVE_FROM[0], 0.03, WAVE_FROM[2]);
  ring.visible = false;
  scene.add(ring);

  // the plumes
  const plume = createPlume({ mode: 'cubes', density: 1 });
  scene.add(plume.object);
  VENT_COLOURS.forEach((c, i) => {
    plume.add({ at: [(i - 2) * 4.5, 0.85, 0], colour: c, startAt: 0.3 + i * 0.35 });
  });
  const windDir = new THREE.Vector2(1, 0.25).normalize();
  plume.setWind(windDir.x, windDir.y, 3);

  // controls
  const panel = el('div', 'position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(10,12,18,.78);border:1px solid #232938;border-radius:8px;min-width:250px;backdrop-filter:blur(6px)');
  panel.append(el('div', 'font-weight:700;letter-spacing:.08em;color:#fff', 'PIXEL PLUMES'));
  const modeRow = el('div', 'display:flex;gap:6px;flex-wrap:wrap');
  const modeButtons = new Map<PlumeMode, HTMLButtonElement>();
  const styleBtn = (b: HTMLButtonElement, on: boolean) => {
    b.style.cssText = `cursor:pointer;padding:5px 10px;border-radius:5px;border:1px solid ${on ? '#9fe8ff' : '#2a3042'};background:${on ? '#17323d' : '#121623'};color:${on ? '#fff' : '#a9b3c9'};font:inherit`;
  };
  for (const m of PLUME_MODES) {
    const b = el('button', '', m);
    styleBtn(b, m === plume.mode);
    b.addEventListener('click', () => {
      plume.setMode(m);
      for (const [k, v] of modeButtons) styleBtn(v, k === m);
    });
    modeButtons.set(m, b);
    modeRow.append(b);
  }
  panel.append(modeRow);

  const slider = (label: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string, on: (v: number) => void) => {
    const row = el('label', 'display:flex;flex-direction:column;gap:2px');
    const text = el('span', '', `${label}: ${fmt(value)}`);
    const input = el('input', 'width:100%');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      text.textContent = `${label}: ${fmt(v)}`;
      on(v);
    });
    row.append(text, input);
    panel.append(row);
  };
  slider('density', 0.1, 4, 0.05, 1, (v) => `${v.toFixed(2)}x`, (v) => plume.setDensity(v));
  slider('wind', 0, 14, 0.5, 3, (v) => `${v.toFixed(1)} m/s`, (v) => plume.setWind(windDir.x, windDir.y, v));

  let waveStart = -1;
  const waveBtn = el('button', '', 'wave from the middle vent');
  styleBtn(waveBtn, false);
  waveBtn.addEventListener('click', () => {
    waveStart = clock.elapsedTime;
  });
  panel.append(waveBtn);
  const info = el('div', 'color:#7f8aa3;white-space:pre');
  panel.append(info);
  host.append(panel);

  const legend = el('div', 'position:absolute;right:12px;bottom:10px;display:flex;gap:10px;color:#a9b3c9');
  VENT_NAMES.forEach((n, i) => {
    const s = el('span', `padding:2px 8px;border-radius:4px;border:1px solid ${VENT_COLOURS[i] ?? '#fff'};color:${VENT_COLOURS[i] ?? '#fff'}`, n);
    legend.append(s);
  });
  host.append(legend);

  // camera: slow sway, drag to orbit
  let yaw = 0;
  let pitch = 0.16;
  let dist = 24;
  let dragging = false;
  let swayAmount = 1;
  const onDown = () => { dragging = true; swayAmount = 0; };
  const onUp = () => { dragging = false; };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw -= e.movementX * 0.005;
    pitch = Math.min(1.2, Math.max(-0.05, pitch + e.movementY * 0.004));
  };
  const onWheel = (e: WheelEvent) => {
    dist = Math.min(80, Math.max(8, dist * (1 + e.deltaY * 0.001)));
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

  const size = new THREE.Vector2();
  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(size);
    plume.setViewport(size.y);
  };
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  let frames = 0;
  let acc = 0;
  let fps = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    frames++;
    acc += dt;
    if (acc > 0.5) { fps = frames / acc; frames = 0; acc = 0; }

    if (waveStart >= 0) {
      const k = (t - waveStart) / WAVE_SECONDS;
      if (k >= 1) {
        waveStart = -1;
        plume.setWave(WAVE_FROM, 2e6); // finished: no racers
        ring.visible = false;
      } else {
        const r = WAVE_METRES * k;
        plume.setWave(WAVE_FROM, r);
        ring.visible = true;
        ring.scale.set(Math.max(r, 0.001), Math.max(r, 0.001), 1);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k * 0.7);
      }
    }

    const sway = Math.sin(t * 0.15) * 0.35 * swayAmount;
    const a = yaw + sway;
    camera.position.set(Math.sin(a) * Math.cos(pitch) * dist, 0.8 + Math.sin(pitch) * dist + 2, Math.cos(a) * Math.cos(pitch) * dist);
    camera.lookAt(0, 3.6, 0);

    plume.update(t);
    renderer.render(scene, camera);
    const s = plume.stats();
    info.textContent = `${s.mode}  ${s.pixels} px  ${s.drawCalls} draw call  ${s.triangles} tris\n${fps.toFixed(0)} fps  target ${size.y}px high${waveStart >= 0 ? '\nwave running' : ''}`;
  };
  frame();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointermove', onMove);
    plume.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    panel.remove();
    legend.remove();
  };
}
