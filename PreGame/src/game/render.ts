import Matter from 'matter-js';
import { Game, Marble } from './engine';
import { meta, W } from './track';
import { MARBLE_RADIUS, ITEM_INFO } from './types';
import { ballFor, drawSprite, drawStrip, sprite } from './sprites';

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

function polygon(ctx: CanvasRenderingContext2D, body: Matter.Body) {
  const v = body.vertices;
  ctx.beginPath();
  ctx.moveTo(v[0].x, v[0].y);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
  ctx.closePath();
}

function drawPipe(ctx: CanvasRenderingContext2D, body: Matter.Body, fill: string, edge: string) {
  polygon(ctx, body);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = edge;
  ctx.stroke();
  // highlight along the top surface (local top edge => vertices around index 0..1 for un-chamfered; approximate using bounds)
  const v = body.vertices;
  // find edge closest to "up" normal via body angle
  const a = body.angle;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = Math.sin(a);
  const ny = -Math.cos(a);
  // top surface line: project vertices onto normal, take max
  let maxN = -Infinity;
  for (const p of v) {
    const d = (p.x - body.position.x) * nx + (p.y - body.position.y) * ny;
    if (d > maxN) maxN = d;
  }
  // extent along u
  let minU = Infinity;
  let maxU = -Infinity;
  for (const p of v) {
    const d = (p.x - body.position.x) * ux + (p.y - body.position.y) * uy;
    if (d < minU) minU = d;
    if (d > maxU) maxU = d;
  }
  const off = maxN - 3;
  ctx.beginPath();
  ctx.moveTo(body.position.x + ux * (minU + 6) + nx * off, body.position.y + uy * (minU + 6) + ny * off);
  ctx.lineTo(body.position.x + ux * (maxU - 6) + nx * off, body.position.y + uy * (maxU - 6) + ny * off);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * amt)));
  g = Math.max(0, Math.min(255, Math.round(g * amt)));
  b = Math.max(0, Math.min(255, Math.round(b * amt)));
  return `rgb(${r},${g},${b})`;
}

function drawMarble(ctx: CanvasRenderingContext2D, game: Game, m: Marble, t: number) {
  const b = m.body;
  const { x, y } = b.position;
  const r = MARBLE_RADIUS;
  const frozen = game.time < m.frozenUntil;
  const ghost = game.time < m.ghostUntil;
  const anvil = game.time < m.anvilUntil;
  const rocket = game.time < m.rocketUntil;

  ctx.save();
  if (ghost) ctx.globalAlpha = 0.45;

  // trail
  if (m.trail.length > 2) {
    ctx.beginPath();
    ctx.moveTo(m.trail[0].x, m.trail[0].y);
    for (let i = 1; i < m.trail.length; i++) ctx.lineTo(m.trail[i].x, m.trail[i].y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = rocket ? 'rgba(251,146,60,0.7)' : m.info.color + '55';
    ctx.lineWidth = rocket ? 10 : 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // shadow
  ctx.beginPath();
  ctx.arc(x + 2, y + 3, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // body: kit ball sprite (spiked ball while Heavy metal is active), flat gradient until sprites load
  if (drawSprite(ctx, anvil ? 'ball-spiked' : ballFor(m.info.color), x, y, (anvil ? r * 2.9 : r * 2.2), (anvil ? r * 2.9 : r * 2.2), b.angle)) {
    // spin is visible in the sprite texture
  } else {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  const base = anvil ? '#475569' : m.info.color;
  g.addColorStop(0, shade(base, 1.6));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, 0.55));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // swirl showing spin
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(b.angle);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0.2, Math.PI * 0.9);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, Math.PI + 0.2, Math.PI * 1.9);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();
  ctx.restore();

  // specular
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  }

  // outline
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = m.info.isPlayer ? 3 : 1.5;
  ctx.strokeStyle = m.info.isPlayer ? `rgba(255,255,255,${0.7 + 0.3 * Math.sin(t / 120)})` : 'rgba(0,0,0,0.4)';
  ctx.stroke();

  if (anvil) {
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (frozen) {
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186,230,253,0.55)';
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.stroke();
    // ice spikes
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2));
      ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
      ctx.stroke();
    }
  }
  if (m.inOil) {
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(168,85,247,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (game.time < m.aeroUntil) {
    ctx.strokeStyle = '#5eead4bb';
    ctx.lineWidth = 1.5;
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x, y, r + 6, direction * 0.4 + t / 700, direction * 0.4 + t / 700 + 1.1);
      ctx.stroke();
    }
  }
  ctx.restore();

  // name tag
  ctx.save();
  ctx.font = `${m.info.isPlayer ? 'bold ' : ''}11px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const label = m.info.isPlayer ? 'YOU' : m.info.name;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(x - tw / 2 - 4, y - r - 20, tw + 8, 14, 4);
  ctx.fill();
  ctx.fillStyle = m.info.isPlayer ? '#fff' : '#e2e8f0';
  ctx.fillText(label, x, y - r - 8);
  const heldItem = game.availableItem(m);
  if (heldItem) {
    ctx.beginPath();
    ctx.arc(x + tw / 2 + 10, y - r - 13, 3, 0, Math.PI * 2);
    ctx.fillStyle = ITEM_INFO[heldItem].color;
    ctx.fill();
  }
  if (m.info.isPlayer) {
    // arrow marker
    const by = y - r - 26 - Math.abs(Math.sin(t / 200)) * 4;
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x - 7, by - 9);
    ctx.lineTo(x + 7, by - 9);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, game: Game, cam: Camera, cw: number, ch: number, t: number, options: { minimap?: boolean; shake?: boolean } = {}) {
  ctx.clearRect(0, 0, cw, ch);

  const theme = game.track.theme;
  // background
  // Outside the track (visible when zoomed out) is plain dark blue.
  ctx.fillStyle = '#0a1a33';
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  const shakeX = options.shake !== false && game.shake > 0 ? (Math.random() - 0.5) * game.shake * 0.7 : 0;
  const shakeY = options.shake !== false && game.shake > 0 ? (Math.random() - 0.5) * game.shake * 0.7 : 0;
  ctx.translate(cw / 2 + shakeX, ch / 2 + shakeY);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  const viewTop = cam.y - ch / 2 / cam.scale - 100;
  const viewBottom = cam.y + ch / 2 / cam.scale + 100;
  const viewLeft = cam.x - cw / 2 / cam.scale - 100;
  const viewRight = cam.x + cw / 2 / cam.scale + 100;

  // track interior
  ctx.fillStyle = theme.track;
  ctx.fillRect(0, viewTop, W, viewBottom - viewTop);
  // subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gs = 100;
  for (let gy = Math.floor(viewTop / gs) * gs; gy < viewBottom; gy += gs) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(158,190,211,0.12)';
  for (let gy = Math.floor(viewTop / 50) * 50; gy < viewBottom; gy += 50) {
    for (let gx = 25; gx < W; gx += 50) ctx.fillRect(gx, gy, 1.5, 1.5);
  }
  // segment labels
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(190,210,228,0.12)';
  for (const seg of game.track.segments) {
    if (seg.y + 30 > viewTop && seg.y < viewBottom) ctx.fillText(seg.name.toUpperCase(), 16, seg.y + 26);
  }

  // finish line stripes
  const fy = game.track.finishY;
  if (fy > viewTop && fy < viewBottom) {
    const sq = 15;
    for (let i = 0; i < W / sq; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#f8fafc' : '#0f172a';
        ctx.fillRect(i * sq, fy - sq + j * sq, sq, sq);
      }
    drawSprite(ctx, 'flag-checker', 34, fy - 44, 56, 52);
    drawSprite(ctx, 'flag-checker', W - 34, fy - 44, 56, 52);
  }

  // oil slicks
  for (const o of game.oils) {
    const life = (o.expiresAt - game.time) / 9000;
    ctx.save();
    ctx.globalAlpha = Math.min(1, life * 3);
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.r, o.r * 0.75, 0, 0, Math.PI * 2);
    const og = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, o.r);
    og.addColorStop(0, '#3b0764');
    og.addColorStop(0.7, '#581c87');
    og.addColorStop(1, 'rgba(88,28,135,0)');
    ctx.fillStyle = og;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(o.x - 10, o.y - 8, o.r * 0.35, o.r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(216,180,254,0.35)';
    ctx.fill();
    ctx.restore();
  }

  // static bodies
  const bodies = game.track.bodies;
  for (const b of bodies) {
    if (b.label === 'marble') continue;
    if (b.bounds.max.y < viewTop || b.bounds.min.y > viewBottom) continue;
    if (b.bounds.max.x < viewLeft || b.bounds.min.x > viewRight) continue;
    const md = meta(b);
    if (md?.destroyed) continue;
    switch (md?.kind) {
      case 'ramp':
        if (!drawStrip(ctx, b, 'strip-wood')) drawPipe(ctx, b, theme.pipe, theme.pipeEdge);
        break;
      case 'gate': {
        if (drawStrip(ctx, b, 'strip-hazard')) break;
        // trapdoor with red/white kerb stripes
        polygon(ctx, b);
        ctx.fillStyle = '#334155';
        ctx.fill();
        const { min, max } = b.bounds;
        for (let x = min.x, i = 0; x < max.x; x += 20, i++) {
          ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#f8fafc';
          ctx.fillRect(x, min.y, Math.min(20, max.x - x), 5);
        }
        break;
      }
      case 'block': {
        if (drawStrip(ctx, b, 'tile-metal', { tile: 36 })) break;
        polygon(ctx, b);
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case 'ppeg': {
        const r = md.radius ?? 10;
        const col = md.pegColor ?? 'blue';
        const base = col === 'orange' ? '#f97316' : col === 'green' ? (md.itemDrop ? ITEM_INFO[md.itemDrop].color : '#22c55e') : '#3b82f6';
        const lit = col === 'orange' ? '#fed7aa' : col === 'green' ? '#bbf7d0' : '#bfdbfe';
        const hit = !!md.hit;
        const age = hit ? game.time - (md.hitAt ?? 0) : 0;
        const pulse = hit ? Math.max(0.3, 1 - age / 210) : col === 'green' ? 1 + Math.sin(t / 330 + b.position.x) * 0.06 : 1;
        const gem = sprite(`gem-${col === 'green' && md.itemDrop ? 'purple' : col}`);
        if (hit || col === 'green') {
          ctx.beginPath();
          ctx.arc(b.position.x, b.position.y, r * 2.2, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(b.position.x, b.position.y, r * 0.5, b.position.x, b.position.y, r * 2.2);
          glow.addColorStop(0, base + 'aa');
          glow.addColorStop(1, base + '00');
          ctx.fillStyle = glow;
          ctx.fill();
        }
        if (gem) {
          const size = r * 2.5 * pulse;
          ctx.save();
          if (hit) ctx.filter = 'brightness(1.8)';
          ctx.drawImage(gem, b.position.x - size / 2, b.position.y - size / 2, size, size);
          ctx.restore();
        } else {
        const pg = ctx.createRadialGradient(b.position.x - 3, b.position.y - 3, 1, b.position.x, b.position.y, r * pulse);
        pg.addColorStop(0, hit ? '#ffffff' : lit);
        pg.addColorStop(0.5, hit ? lit : base);
        pg.addColorStop(1, hit ? base : shade(base, 0.55));
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.strokeStyle = hit ? '#fff' : 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        }
        if (col === 'green' && !hit) {
          ctx.beginPath();
          ctx.arc(b.position.x, b.position.y, r + 5, t / 450, t / 450 + Math.PI * 1.4);
          ctx.strokeStyle = base;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 10px system-ui';
          const mark = md.itemDrop ? { rocket: '>>', jump: '^', oil: 'O', shock: 'S', anvil: 'W', aero: 'A', freeze: 'F', ghost: 'G' }[md.itemDrop] : '?';
          ctx.strokeStyle = '#102019bb';
          ctx.lineWidth = 2;
          ctx.strokeText(mark, b.position.x, b.position.y + 1);
          ctx.fillText(mark, b.position.x, b.position.y + 1);
        }
        break;
      }
      case 'bucket': {
        const { x, y } = b.position;
        ctx.save();
        ctx.translate(x, y);
        // bucket: open top trapezoid
        ctx.beginPath();
        ctx.moveTo(-55, -17);
        ctx.lineTo(-42, 17);
        ctx.lineTo(42, 17);
        ctx.lineTo(55, -17);
        ctx.closePath();
        const bgd = ctx.createLinearGradient(0, -17, 0, 17);
        bgd.addColorStop(0, '#c026d3');
        bgd.addColorStop(1, '#701a75');
        ctx.fillStyle = bgd;
        ctx.fill();
        ctx.strokeStyle = '#f5d0fe';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fdf4ff';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FREE BALL', 0, 2);
        // rails
        ctx.restore();
        ctx.strokeStyle = 'rgba(240,171,252,0.25)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, y + 20);
        ctx.lineTo(W - 40, y + 20);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'ice':
        if (!drawStrip(ctx, b, 'strip-ice')) drawPipe(ctx, b, '#7dd3fc', '#38bdf8');
        break;
      case 'wall':
        if (drawStrip(ctx, b, 'strip-metal')) break;
        polygon(ctx, b);
        ctx.fillStyle = '#2b3652';
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      case 'spinner':
        if (!drawStrip(ctx, b, 'strip-red')) {
          polygon(ctx, b);
          ctx.fillStyle = '#f43f5e';
          ctx.fill();
          ctx.strokeStyle = '#881337';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (drawSprite(ctx, 'bumper-spiked', b.position.x, b.position.y, 30, 26)) break;
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#fecdd3';
        ctx.fill();
        break;
      case 'peg': {
        const r = md.radius ?? 11;
        if (drawSprite(ctx, 'bumper-crown', b.position.x, b.position.y, r * 2.9, r * 2.35)) break;
        const pg = ctx.createRadialGradient(b.position.x - 3, b.position.y - 3, 1, b.position.x, b.position.y, r);
        pg.addColorStop(0, '#94a3b8');
        pg.addColorStop(1, '#334155');
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, r, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case 'breakable': {
        const ratio = (md.hp ?? 1) / (md.maxHp ?? 1);
        const { min, max } = b.bounds;
        if (!drawStrip(ctx, b, 'crate', { tile: 40 })) {
          polygon(ctx, b);
          ctx.fillStyle = '#b45309';
          ctx.fill();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.stroke();
          // brick lines
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1.5;
          for (let yy = min.y + 12; yy < max.y; yy += 12) {
            ctx.beginPath();
            ctx.moveTo(min.x, yy);
            ctx.lineTo(max.x, yy);
            ctx.stroke();
          }
        }
        // cracks
        if (ratio < 0.99) {
          ctx.strokeStyle = '#fde68a';
          ctx.lineWidth = 1.5;
          const n = Math.ceil((1 - ratio) * 6);
          for (let i = 0; i < n; i++) {
            const sx = min.x + ((i * 37) % (max.x - min.x));
            const sy = min.y + ((i * 53) % (max.y - min.y));
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + 8, sy + 14);
            ctx.lineTo(sx - 4, sy + 26);
            ctx.stroke();
          }
        }
        // requirement label
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.fillStyle = '#fff7ed';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(8,20,32,0.7)';
        ctx.fillRect(-13, -21, 26, 44);
        ctx.fillStyle = '#fff7ed';
        ctx.fillText('⚖', 0, -12);
        ctx.fillText(`${md.req}`, 0, 4);
        ctx.font = '8px system-ui';
        ctx.fillText('WT', 0, 16);
        ctx.restore();
        break;
      }
      case 'pad': {
        const pulse = 0.6 + 0.4 * Math.sin(t / 150);
        polygon(ctx, b);
        if (!drawStrip(ctx, b, 'strip-hazard')) {
          ctx.fillStyle = '#065f46';
          ctx.fill();
        }
        ctx.strokeStyle = `rgba(52,211,153,${pulse})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = `rgba(110,231,183,${pulse})`;
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▲ BOUNCE ▲', b.position.x, b.position.y);
        break;
      }
      case 'boost': {
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        const w = (b.bounds.max.x - b.bounds.min.x);
        const h = (b.bounds.max.y - b.bounds.min.y);
        // compute local dims from vertices
        const v = b.vertices;
        const lw = Math.hypot(v[1].x - v[0].x, v[1].y - v[0].y);
        const lh = Math.hypot(v[2].x - v[1].x, v[2].y - v[1].y);
        void w;
        void h;
        const redStrip = sprite('strip-red');
        if (redStrip) ctx.drawImage(redStrip, -lw / 2, -lh / 2, lw, lh);
        ctx.fillStyle = 'rgba(249,115,22,0.18)';
        ctx.fillRect(-lw / 2, -lh / 2, lw, lh);
        ctx.strokeStyle = 'rgba(251,146,60,0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-lw / 2, -lh / 2, lw, lh);
        // animated chevrons pointing along +x local
        const phase = (t / 400) % 1;
        const n = Math.max(2, Math.floor(lw / 26));
        for (let i = 0; i < n; i++) {
          const px = -lw / 2 + ((i + phase) / n) * lw;
          const alpha = 0.4 + 0.6 * ((i + phase) / n);
          ctx.strokeStyle = `rgba(253,186,116,${alpha})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px - 6, -lh / 2 + 6);
          ctx.lineTo(px + 4, 0);
          ctx.lineTo(px - 6, lh / 2 - 6);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'itembox': {
        if (!md.active) {
          ctx.beginPath();
          ctx.arc(b.position.x, b.position.y, 17, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250,204,21,0.25)';
          ctx.setLineDash([3, 4]);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        ctx.save();
        ctx.translate(b.position.x, b.position.y + Math.sin(t / 300) * 3);
        ctx.rotate(Math.sin(t / 500) * 0.3);
        const ig = ctx.createLinearGradient(-17, -17, 17, 17);
        ig.addColorStop(0, '#fde047');
        ig.addColorStop(1, '#f59e0b');
        if (!drawSprite(ctx, 'crate', 0, 0, 34, 30)) {
          ctx.beginPath();
          ctx.roundRect(-15, -15, 30, 30, 7);
          ctx.fillStyle = ig;
          ctx.fill();
          ctx.strokeStyle = '#fff7ed';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 4;
        ctx.font = 'bold 20px system-ui';
        ctx.strokeText('?', 0, 1);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 20px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 1);
        ctx.restore();
        break;
      }
      case 'finish':
        break;
      default:
        break;
    }
  }

  // marbles (player drawn last)
  const sorted = [...game.marbles].sort((a, b) => Number(a.info.isPlayer) - Number(b.info.isPlayer));
  for (const m of sorted) {
    const p = m.body.position;
    if (p.y < viewTop || p.y > viewBottom) continue;
    drawMarble(ctx, game, m, t);
  }

  // effects
  for (const e of game.effects) {
    const k = e.ttl / e.maxTtl;
    switch (e.type) {
      case 'ring': {
        ctx.beginPath();
        ctx.arc(e.x, e.y, (1 - k) * 120 + 10, 0, Math.PI * 2);
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = k;
        ctx.lineWidth = 4 * k + 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'flash': {
        ctx.beginPath();
        ctx.arc(e.x, e.y, (1 - k) * 14 + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${k * 0.7})`;
        ctx.fill();
        break;
      }
      case 'beam': {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x2 ?? e.x, e.y2 ?? e.y);
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = k;
        ctx.lineWidth = 6 * k + 1;
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'debris':
      case 'snow': {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = k;
        for (const p of e.particles ?? []) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * k, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'text': {
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        const ty = e.y - (1 - k) * 30;
        ctx.strokeText(e.text ?? '', e.x, ty);
        ctx.fillStyle = e.color;
        ctx.fillText(e.text ?? '', e.x, ty);
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }

  // side pipe walls
  const plate = sprite('tile-metal');
  const platePattern = plate ? ctx.createPattern(plate, 'repeat') : null;
  if (platePattern) platePattern.setTransform(new DOMMatrix().scaleSelf(40 / plate!.naturalWidth, 40 / plate!.naturalWidth));
  ctx.fillStyle = platePattern ?? '#1e2942';
  ctx.fillRect(-40, viewTop, 40, viewBottom - viewTop);
  ctx.fillRect(W, viewTop, 40, viewBottom - viewTop);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-6, viewTop, 6, viewBottom - viewTop);
  ctx.fillRect(W, viewTop, 6, viewBottom - viewTop);

  ctx.restore();

  if (options.minimap !== false && ch > 240) drawMinimap(ctx, game, cw, ch);
}

function drawMinimap(ctx: CanvasRenderingContext2D, game: Game, cw: number, ch: number) {
  const mh = ch - 140;
  const mx = cw - 26;
  const my = 70;
  const H = game.track.height;
  ctx.save();
  ctx.fillStyle = 'rgba(15,23,42,0.7)';
  ctx.beginPath();
  ctx.roundRect(mx - 14, my - 10, 28, mh + 20, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // segments ticks
  for (const s of game.track.segments) {
    const yy = my + (s.y / H) * mh;
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    ctx.fillRect(mx - 8, yy, 16, 1);
  }
  // finish
  const fy = my + (game.track.finishY / H) * mh;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(mx - 9, fy - 1, 18, 3);
  // marbles
  const list = [...game.marbles].sort((a, b) => Number(a.info.isPlayer) - Number(b.info.isPlayer));
  for (const m of list) {
    const yy = my + Math.max(0, Math.min(1, m.body.position.y / H)) * mh;
    const xx = mx + ((m.body.position.x / W) - 0.5) * 14;
    ctx.beginPath();
    ctx.arc(xx, yy, m.info.isPlayer ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = m.info.color;
    ctx.fill();
    if (m.info.isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}
