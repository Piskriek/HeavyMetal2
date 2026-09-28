/**
 * Hoop-Pod texture atlas (docs/HOOP_POD.md §Atlas).
 *
 * Painted once per page into three canvases and shared by every racer:
 *   base   1024² sRGB  — greyscale hand-painted detail (colour comes from the livery tint)
 *   mask   1024² linear — R primary · G accent · B trim · R∧G glass · A wear/grunge (0.25…1)
 *   decals 1024² sRGB  — 4×4 tintable emblems (white fill, dark outline)
 *
 * Layout (glTF convention, flipY = false, uv 0,0 top-left):
 *   v .000–.125 hoop band primary · v .125–.250 hoop band accent · v .250–.500 inner ball strip
 *   v .500–.750: u 0–.25 hubcap disc · .25–.375 sidewall P · .375–.5 sidewall A · .5–.625 inner face
 */
import * as THREE from 'three';

export const ATLAS = 1024;
export const REGION = {
  bandMain: { u0: 0, v0: 0, u1: 1, v1: 0.125 },
  bandAccent: { u0: 0, v0: 0.125, u1: 1, v1: 0.25 },
  cabin: { u0: 0, v0: 0.25, u1: 1, v1: 0.5 },
  hub: { u0: 0, v0: 0.5, u1: 0.25, v1: 0.75 },
  sideMain: { u0: 0.25, v0: 0.5, u1: 0.375, v1: 0.75 },
  sideAccent: { u0: 0.375, v0: 0.5, u1: 0.5, v1: 0.75 },
  inner: { u0: 0.5, v0: 0.5, u1: 0.625, v1: 0.75 },
} as const;
export type Region = (typeof REGION)[keyof typeof REGION];
export const HUB_CENTER = { u: 0.125, v: 0.625 } as const;
export const HUB_RADIUS_UV = 0.12;
/** Lateral half-extent (unit-pod metres) mapped across the inner-ball strip. */
export const CABIN_LATERAL = 0.6;
/** v2 porthole: glass radius 0.30 m (2× v1), centred on the front of the inner ball. */
export const PORTHOLE_RADIUS_M = 0.3;
const PORTHOLE_R_PX = PORTHOLE_RADIUS_M * (ATLAS / (2 * Math.PI * 0.8));
const RAIL_OFFSET_M = 0.3;

const px = (t: number) => t * ATLAS;
const grey = (v: number) => {
  const n = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${n},${n},${n})`;
};
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvas2d(size = ATLAS) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas is unavailable.');
  return { c, g };
}
function rivet(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.beginPath();
  g.arc(x + r * 0.3, y + r * 0.4, r * 1.15, 0, Math.PI * 2);
  g.fill();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.4, '#c8c8c8');
  gr.addColorStop(1, '#4a4a4a');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export interface PodTextures {
  readonly base: THREE.CanvasTexture;
  readonly mask: THREE.CanvasTexture;
  readonly decals: THREE.CanvasTexture;
}

let cache: PodTextures | null = null;
let users = 0;

/** Shared textures; call `releasePodTextures` once per `acquirePodTextures`. */
export function acquirePodTextures(): PodTextures {
  users++;
  if (cache) return cache;
  const { base, mask } = paintAtlas();
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.flipY = false;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  cache = { base: tex(base, true), mask: tex(mask, false), decals: tex(paintDecals(), true) };
  cache.mask.premultiplyAlpha = false;
  return cache;
}

export function releasePodTextures(): void {
  users = Math.max(0, users - 1);
  if (users === 0 && cache) {
    cache.base.dispose();
    cache.mask.dispose();
    cache.decals.dispose();
    cache = null;
  }
}

function paintAtlas() {
  const B = canvas2d();
  const M = canvas2d();
  const G = canvas2d();
  const b = B.g, m = M.g, gg = G.g;
  const r = seeded(1234);
  m.fillStyle = '#000';
  m.fillRect(0, 0, ATLAS, ATLAS);
  b.fillStyle = '#5a5058';
  b.fillRect(0, 0, ATLAS, ATLAS);
  gg.fillStyle = '#000';
  gg.fillRect(0, 0, ATLAS, ATLAS);

  const blot = (x: number, y: number, s: number, a: number) => {
    gg.globalAlpha = a;
    gg.fillStyle = '#fff';
    for (let k = 0; k < 6; k++) {
      gg.beginPath();
      gg.ellipse(x + (r() - 0.5) * s, y + (r() - 0.5) * s * 0.6, s * (0.2 + r() * 0.4), s * (0.12 + r() * 0.25), r() * 3, 0, Math.PI * 2);
      gg.fill();
    }
    gg.globalAlpha = 1;
  };
  const dabs = (x0: number, y0: number, w: number, h: number, n: number, rx: number, ry: number) => {
    for (let i = 0; i < n; i++) {
      b.globalAlpha = 0.05 + r() * 0.06;
      b.fillStyle = r() > 0.5 ? '#fff' : '#000';
      b.beginPath();
      b.ellipse(x0 + r() * w, y0 + r() * h, rx * (0.4 + r()), ry * (0.4 + r()), 0, 0, Math.PI * 2);
      b.fill();
    }
    b.globalAlpha = 1;
  };

  /* hoop bands */
  [0, 1].forEach((row) => {
    const y0 = px(row * 0.125);
    const H = px(0.125);
    const gr = b.createLinearGradient(0, y0, 0, y0 + H);
    gr.addColorStop(0, grey(0.3));
    gr.addColorStop(0.12, grey(0.72));
    gr.addColorStop(0.36, grey(0.98));
    gr.addColorStop(0.52, grey(0.88));
    gr.addColorStop(0.88, grey(0.66));
    gr.addColorStop(1, grey(0.3));
    b.fillStyle = gr;
    b.fillRect(0, y0, ATLAS, H);
    dabs(0, y0 + H * 0.15, ATLAS, H * 0.7, 480, 26, 3);
    b.fillStyle = 'rgba(255,255,255,.35)';
    b.fillRect(0, y0 + H * 0.34, ATLAS, 3);
    for (let k = 0; k < 8; k++) {
      const x = k * 128 + 2;
      b.fillStyle = 'rgba(0,0,0,.6)';
      b.fillRect(x, y0 + H * 0.1, 3, H * 0.8);
      b.fillStyle = 'rgba(255,255,255,.4)';
      b.fillRect(x + 3, y0 + H * 0.1, 2, H * 0.8);
      blot(x + 10, y0 + H * 0.5, 40, 0.8);
    }
    m.fillStyle = row === 0 ? 'rgb(255,0,0)' : 'rgb(0,255,0)';
    m.fillRect(0, y0, ATLAS, H);
    for (let k = 0; k < 16; k++) {
      const x = (k + 0.5) * 64;
      for (const t of [0.2, 0.8]) {
        rivet(b, x, y0 + H * t, 7);
        m.fillStyle = 'rgb(0,0,255)';
        m.beginPath();
        m.arc(x, y0 + H * t, 8, 0, Math.PI * 2);
        m.fill();
        blot(x, y0 + H * t, 26, 0.35);
      }
    }
    for (let k = 0; k < 60; k++) blot(r() * ATLAS, y0 + (r() > 0.5 ? H * 0.14 : H * 0.86), 30, 0.5);
    for (let k = 0; k < 14; k++) blot(r() * ATLAS, y0 + H * (0.3 + r() * 0.4), 60, 0.55);
  });

  /* inner ball strip */
  {
    const y0 = px(0.25);
    const H = px(0.25);
    const cy = y0 + H / 2;
    const perM = H / (CABIN_LATERAL * 2);
    for (let k = 0; k < 16; k++) {
      const x = k * 64;
      b.fillStyle = grey(0.7 + r() * 0.2);
      b.fillRect(x, y0, 64, H);
      b.fillStyle = 'rgba(0,0,0,.55)';
      b.fillRect(x, y0, 2, H);
      for (let j = 0; j < 5; j++) rivet(b, x + 8, y0 + 20 + j * 52, 3.5);
    }
    dabs(0, y0, ATLAS, H, 300, 14, 7);
    const ao = b.createLinearGradient(0, y0, 0, y0 + H);
    ao.addColorStop(0, 'rgba(0,0,0,.7)');
    ao.addColorStop(0.18, 'rgba(0,0,0,0)');
    ao.addColorStop(0.82, 'rgba(0,0,0,0)');
    ao.addColorStop(1, 'rgba(0,0,0,.7)');
    b.fillStyle = ao;
    b.fillRect(0, y0, ATLAS, H);
    m.fillStyle = 'rgb(0,255,0)';
    m.fillRect(0, y0, ATLAS, H);
    for (let k = 0; k < 30; k++) blot(r() * ATLAS, y0 + r() * H, 40, 0.5);

    for (const s of [-1, 1]) {
      const y = cy + s * RAIL_OFFSET_M * perM;
      const gr = b.createLinearGradient(0, y - 7, 0, y + 7);
      gr.addColorStop(0, grey(0.35));
      gr.addColorStop(0.5, grey(1));
      gr.addColorStop(1, grey(0.35));
      b.fillStyle = gr;
      b.fillRect(0, y - 7, ATLAS, 14);
      m.fillStyle = 'rgb(0,0,255)';
      m.fillRect(0, y - 7, ATLAS, 14);
      for (let k = 0; k < 32; k++) rivet(b, k * 32 + 16, y, 3);
    }

    // Porthole at u = .5 (front). Canvas x runs around the roll axis, canvas y is lateral.
    const cx = 0.5 * ATLAS;
    const R = PORTHOLE_R_PX;
    const at = (gx: CanvasRenderingContext2D, fn: (q: CanvasRenderingContext2D) => void) => {
      gx.save();
      gx.setTransform(0, 1, 1, 0, cx, cy);
      fn(gx);
      gx.restore();
    };
    at(m, (q) => {
      q.fillStyle = '#000';
      q.beginPath();
      q.arc(0, 0, R * 1.2, 0, Math.PI * 2);
      q.fill();
      q.fillStyle = 'rgb(255,255,0)';
      q.beginPath();
      q.arc(0, 0, R, 0, Math.PI * 2);
      q.fill();
    });
    at(b, (q) => {
      q.fillStyle = 'rgba(0,0,0,.55)';
      q.beginPath();
      q.arc(3, 4, R * 1.25, 0, Math.PI * 2);
      q.fill();
      const br = q.createLinearGradient(-R * 1.2, -R * 1.2, R * 1.2, R * 1.2);
      br.addColorStop(0, '#fff0b0');
      br.addColorStop(0.45, '#d99a36');
      br.addColorStop(1, '#6a3c10');
      q.fillStyle = br;
      q.beginPath();
      q.arc(0, 0, R * 1.2, 0, Math.PI * 2);
      q.fill();
      q.strokeStyle = '#3a1e08';
      q.lineWidth = 3;
      q.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        q.fillStyle = '#fff4c8';
        q.beginPath();
        q.arc(Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1, 3.2, 0, Math.PI * 2);
        q.fill();
      }
      const gl = q.createRadialGradient(-R * 0.3, -R * 0.35, 1, 0, 0, R);
      gl.addColorStop(0, grey(1));
      gl.addColorStop(0.6, grey(0.8));
      gl.addColorStop(1, grey(0.45));
      q.fillStyle = gl;
      q.beginPath();
      q.arc(0, 0, R, 0, Math.PI * 2);
      q.fill();
      q.strokeStyle = 'rgba(40,20,6,.75)';
      q.lineWidth = 4;
      q.beginPath();
      q.arc(0, 0, R + 1, 0, Math.PI * 2);
      q.stroke();
      // Clean glass — no pilot silhouette. Two glare streaks sell the curvature.
      q.fillStyle = 'rgba(255,255,255,.7)';
      q.beginPath();
      q.ellipse(-R * 0.42, -R * 0.42, R * 0.3, R * 0.1, -0.8, 0, Math.PI * 2);
      q.fill();
      q.fillStyle = 'rgba(255,255,255,.35)';
      q.beginPath();
      q.ellipse(-R * 0.12, -R * 0.62, R * 0.12, R * 0.05, -0.5, 0, Math.PI * 2);
      q.fill();
    });
  }

  /* hubcap disc */
  {
    const cx = px(HUB_CENTER.u);
    const cy = px(HUB_CENTER.v);
    const R = px(HUB_RADIUS_UV);
    b.fillStyle = grey(0.5);
    b.fillRect(0, px(0.5), px(0.25), px(0.25));
    const dome = b.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
    dome.addColorStop(0, grey(1));
    dome.addColorStop(0.55, grey(0.82));
    dome.addColorStop(0.85, grey(0.6));
    dome.addColorStop(1, grey(0.35));
    b.fillStyle = dome;
    b.beginPath();
    b.arc(cx, cy, R, 0, Math.PI * 2);
    b.fill();
    m.fillStyle = 'rgb(255,0,0)';
    m.beginPath();
    m.arc(cx, cy, R * 0.84, 0, Math.PI * 2);
    m.fill();
    b.lineWidth = R * 0.14;
    b.strokeStyle = grey(0.8);
    b.beginPath();
    b.arc(cx, cy, R * 0.91, 0, Math.PI * 2);
    b.stroke();
    m.lineWidth = R * 0.16;
    m.strokeStyle = 'rgb(0,0,255)';
    m.beginPath();
    m.arc(cx, cy, R * 0.91, 0, Math.PI * 2);
    m.stroke();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const x = cx + Math.cos(a) * R * 0.72;
      const y = cy + Math.sin(a) * R * 0.72;
      rivet(b, x, y, 5.5);
      m.fillStyle = 'rgb(0,0,255)';
      m.beginPath();
      m.arc(x, y, 6.5, 0, Math.PI * 2);
      m.fill();
      blot(x, y, 22, 0.5);
    }
  }

  /* sidewalls + inner face */
  ([[REGION.sideMain, 'rgb(255,0,0)'], [REGION.sideAccent, 'rgb(0,255,0)']] as const).forEach(([reg, col]) => {
    const x0 = px(reg.u0), y0 = px(reg.v0), w = px(reg.u1 - reg.u0), h = px(reg.v1 - reg.v0);
    const gr = b.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, grey(0.62));
    gr.addColorStop(1, grey(0.3));
    b.fillStyle = gr;
    b.fillRect(x0, y0, w, h);
    m.fillStyle = col;
    m.fillRect(x0, y0, w, h);
    for (let k = 0; k < 10; k++) blot(x0 + r() * w, y0 + r() * h, 30, 0.5);
  });
  b.fillStyle = '#2b2228';
  b.fillRect(px(REGION.inner.u0), px(REGION.inner.v0), px(0.125), px(0.25));

  /* grunge → mask alpha, stored as .25…1 so premultiplied canvas storage keeps the RGB mask */
  const md = m.getImageData(0, 0, ATLAS, ATLAS);
  const gd = gg.getImageData(0, 0, ATLAS, ATLAS);
  for (let i = 0; i < md.data.length; i += 4) {
    const n = Math.min(1, (gd.data[i] / 255) * 0.85 + r() * 0.25);
    md.data[i + 3] = Math.round((0.25 + 0.75 * n) * 255);
  }
  m.putImageData(md, 0, 0);
  return { base: B.c, mask: M.c };
}

/* ---------------- decal atlas: 16 emblems, white = tinted by decalColor ---------------- */
function paintDecals() {
  const { c, g } = canvas2d();
  g.clearRect(0, 0, ATLAS, ATLAS);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const cell = (i: number, fn: () => void) => {
    g.save();
    g.translate((i % 4) * 256 + 128, Math.floor(i / 4) * 256 + 128);
    fn();
    g.restore();
  };
  const ink = (path: () => void, lw = 14) => {
    g.beginPath();
    path();
    g.lineWidth = lw;
    g.strokeStyle = '#111';
    g.stroke();
    g.fillStyle = '#fff';
    g.fill('evenodd');
  };
  const dot = (x: number, y: number, rr: number) => {
    g.moveTo(x + rr, y);
    g.arc(x, y, rr, 0, Math.PI * 2);
  };
  const star = (n: number, ro: number, ri: number, rot = -Math.PI / 2) => {
    for (let k = 0; k < n * 2; k++) {
      const a = rot + (k / (n * 2)) * Math.PI * 2;
      const rr = k % 2 ? ri : ro;
      if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
  };
  const holes = (fn: () => void) => {
    g.fillStyle = '#111';
    g.beginPath();
    fn();
    g.fill();
  };
  const glyph = (text: string, size: number) => {
    g.font = `900 ${size}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#111';
    g.fillText(text, 0, 6);
  };
  // 0 skull
  cell(0, () => {
    ink(() => { g.moveTo(-70, 10); g.bezierCurveTo(-80, -100, 80, -100, 70, 10); g.lineTo(50, 40); g.lineTo(40, 80); g.lineTo(-40, 80); g.lineTo(-50, 40); g.closePath(); });
    holes(() => { g.ellipse(-28, -5, 20, 24, 0, 0, Math.PI * 2); g.moveTo(48, -5); g.ellipse(28, -5, 20, 24, 0, 0, Math.PI * 2); });
  });
  cell(1, () => ink(() => { star(10, 95, 72, 0); dot(0, 0, 30); }));                                       // gear
  cell(2, () => ink(() => { g.moveTo(20, -100); g.lineTo(-55, 10); g.lineTo(-5, 10); g.lineTo(-25, 100); g.lineTo(60, -15); g.lineTo(10, -15); g.closePath(); })); // bolt
  cell(3, () => ink(() => { g.moveTo(0, 95); g.bezierCurveTo(-80, 90, -80, 10, -40, -30); g.bezierCurveTo(-40, 0, -20, 10, -15, 0); g.bezierCurveTo(-30, -50, 0, -80, 10, -105); g.bezierCurveTo(20, -60, 80, -30, 60, 40); g.bezierCurveTo(55, 80, 30, 95, 0, 95); g.closePath(); })); // flame
  cell(4, () => ink(() => { g.moveTo(-85, 60); g.lineTo(-95, -50); g.lineTo(-45, 0); g.lineTo(0, -80); g.lineTo(45, 0); g.lineTo(95, -50); g.lineTo(85, 60); g.closePath(); })); // crown
  cell(5, () => { ink(() => dot(0, 0, 92)); glyph('g', 110); });                                            // coin
  cell(6, () => ink(() => star(5, 100, 42)));                                                               // star
  cell(7, () => { ink(() => dot(0, 0, 92)); glyph('7', 140); });                                            // seven
  cell(8, () => ink(() => { g.moveTo(-100, -30); g.quadraticCurveTo(0, 60, 100, -30); g.quadraticCurveTo(0, 110, -100, -30); g.closePath(); })); // jaws
  cell(9, () => { ink(() => dot(-10, 20, 72)); ink(() => g.rect(30, -70, 34, 34), 10); ink(() => star(8, 36, 14), 8); }); // bomb
  cell(10, () => { g.rotate(-Math.PI / 4); ink(() => { g.moveTo(-16, -60); g.lineTo(-16, 85); g.arc(0, 85, 16, Math.PI, 0, true); g.lineTo(16, -60); g.lineTo(38, -75); g.lineTo(30, -110); g.lineTo(10, -95); g.lineTo(-10, -95); g.lineTo(-30, -110); g.lineTo(-38, -75); g.closePath(); }); }); // wrench
  cell(11, () => ink(() => { g.moveTo(-90, -30); g.lineTo(-50, -80); g.lineTo(50, -80); g.lineTo(90, -30); g.lineTo(0, 95); g.closePath(); })); // gem
  cell(12, () => { ink(() => { g.moveTo(-105, 0); g.quadraticCurveTo(0, -95, 105, 0); g.quadraticCurveTo(0, 95, -105, 0); g.closePath(); }); holes(() => g.ellipse(0, 0, 18, 40, 0, 0, Math.PI * 2)); }); // eye
  cell(13, () => { ink(() => dot(0, -75, 20), 10); ink(() => g.rect(-10, -55, 20, 130), 10); ink(() => g.rect(-50, -40, 100, 18), 10); ink(() => { g.moveTo(-78, 20); g.quadraticCurveTo(0, 130, 78, 20); g.lineTo(62, 20); g.quadraticCurveTo(0, 100, -62, 20); g.closePath(); }, 10); }); // anchor
  cell(14, () => { for (const s of [-1, 1]) { g.save(); g.rotate((s * Math.PI) / 4); ink(() => { g.rect(-12, -80, 24, 160); dot(-14, -88, 16); dot(14, -88, 16); dot(-14, 88, 16); dot(14, 88, 16); }, 10); g.restore(); } }); // crossbones
  cell(15, () => { ink(() => { dot(0, -45, 42); dot(-45, 5, 42); dot(45, 5, 42); }); ink(() => g.rect(-8, 30, 16, 70), 8); }); // clover
  return c;
}
