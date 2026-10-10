export const DT = 1 / 60;
export type RoverKind = 'scout' | 'hauler' | 'crawler';

export const ROVERS = {
  scout: {
    mass: 400,
    topSpeed: 14,
    wheels: 4,
    wheelCount: 4,
    wheelbase: 2.2,
    track: 1.6,
    wheelRadius: 0.45,
    radius: 0.45,
    maxSteer: 0.5,
    steerMax: 0.5,
    steer: 0.5,
    length: 2.2,
    width: 1.6,
    axles: 2,
    axleCount: 2,
  },
  hauler: {
    mass: 1600,
    topSpeed: 9,
    wheels: 6,
    wheelCount: 6,
    axles: 3,
    axleCount: 3,
    wheelbase: 3.6,
    track: 2.0,
    wheelRadius: 0.55,
    radius: 0.55,
    maxSteer: 0.4,
    steerMax: 0.4,
    steer: 0.4,
    length: 3.6,
    width: 2.0,
  },
  crawler: {
    mass: 4000,
    topSpeed: 4,
    wheels: 8,
    wheelCount: 8,
    contacts: 8,
    contactCount: 8,
    length: 4.4,
    wheelbase: 4.4,
    track: 2.4,
    wheelRadius: 0.4,
    radius: 0.4,
    maxSteer: 0,
    steerMax: 0,
    steer: 0,
    width: 2.4,
    axles: 4,
    axleCount: 4,
  },
};

export interface RoverState {
  kind: RoverKind;
  p: [number, number, number];
  q: [number, number, number, number];
  v: [number, number, number];
  w: [number, number, number];
}

export interface Ground {
  height(x: number, z: number): number;
  g: number;
  boxes?: { cx: number; cz: number; hx: number; hz: number; yaw: number; top: number }[];
}

export interface Input {
  throttle: number;
  steer: number;
  brake: boolean;
}

const PI = 3.141592653589793;
const TWO_PI = 6.283185307179586;
const HALF_PI = 1.5707963267948966;
const OMEGA = 6.283185307179586;
const OMEGA2 = 39.47841760435743;
const ZETA = 0.6;
const REST = 0.5;

function yawPair(a: number): [number, number] {
  const q = Math.floor((a + PI) / TWO_PI);
  let r0 = a - q * TWO_PI;
  if (!(r0 > -PI && r0 <= PI)) {
    if (r0 > PI) r0 = r0 - TWO_PI;
    else if (r0 <= -PI) r0 = r0 + TWO_PI;
  }
  const k = Math.floor(r0 / HALF_PI + 0.5);
  const r = r0 - k * HALF_PI;
  const r2 = r * r;
  const r3 = r2 * r;
  const r4 = r2 * r2;
  const r5 = r4 * r;
  const r6 = r4 * r2;
  const r7 = r6 * r;
  const r8 = r4 * r4;
  const r9 = r8 * r;
  const s = r - r3 / 6 + r5 / 120 - r7 / 5040 + r9 / 362880;
  const c = 1 - r2 / 2 + r4 / 24 - r6 / 720 + r8 / 40320;
  let km = k % 4;
  if (km < 0) km += 4;
  if (km === 0) return [c, s];
  if (km === 1) return [-s, c];
  if (km === 2) return [-c, -s];
  return [s, -c];
}

function clampN(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function spawn(
  kind: RoverKind,
  x: number,
  z: number,
  heading: [number, number],
  ground: Ground
): RoverState {
  let hx = heading[0] ?? 0;
  let hz = heading[1] ?? 1;
  const L = Math.sqrt(hx * hx + hz * hz);
  if (L > 1e-12) {
    hx = hx / L;
    hz = hz / L;
  } else {
    hx = 0;
    hz = 1;
  }
  let cc: number;
  let ss: number;
  if (hz <= -1 + 1e-12) {
    cc = 0;
    ss = 1;
  } else {
    const ch = Math.sqrt((1 + hz) * 0.5);
    if (ch < 1e-9) {
      cc = 0;
      ss = 1;
    } else {
      cc = ch;
      ss = hx / (2 * ch);
      const n = Math.sqrt(cc * cc + ss * ss);
      if (n > 1e-12) {
        cc = cc / n;
        ss = ss / n;
      }
    }
  }
  const gh = ground.height(x, z);
  let rad = 0.45;
  if (kind === 'hauler') rad = 0.55;
  else if (kind === 'crawler') rad = 0.4;
  const sag = ground.g / OMEGA2;
  const hover = REST + rad - sag;
  return {
    kind,
    p: [x, gh + hover, z],
    q: [0, ss, 0, cc],
    v: [0, 0, 0],
    w: [0, 0, 0],
  };
}

export function speed(s: RoverState): number {
  const x = s.q[0] ?? 0;
  const y = s.q[1] ?? 0;
  const z = s.q[2] ?? 0;
  const w = s.q[3] ?? 1;
  const fx = 2 * (x * z + w * y);
  const fy = 2 * (y * z - w * x);
  const fz = 1 - 2 * (x * x + y * y);
  const vx = s.v[0] ?? 0;
  const vy = s.v[1] ?? 0;
  const vz = s.v[2] ?? 0;
  return vx * fx + vy * fy + vz * fz;
}

export function hashRover(s: RoverState): string {
  const p0 = s.p[0] ?? 0;
  const p1 = s.p[1] ?? 0;
  const p2 = s.p[2] ?? 0;
  const q0 = s.q[0] ?? 0;
  const q1 = s.q[1] ?? 0;
  const q2 = s.q[2] ?? 0;
  const q3 = s.q[3] ?? 1;
  const v0 = s.v[0] ?? 0;
  const v1 = s.v[1] ?? 0;
  const v2 = s.v[2] ?? 0;
  const w0 = s.w[0] ?? 0;
  const w1 = s.w[1] ?? 0;
  const w2 = s.w[2] ?? 0;
  const t =
    s.kind +
    '|' +
    String(p0) +
    ',' +
    String(p1) +
    ',' +
    String(p2) +
    '|' +
    String(q0) +
    ',' +
    String(q1) +
    ',' +
    String(q2) +
    ',' +
    String(q3) +
    '|' +
    String(v0) +
    ',' +
    String(v1) +
    ',' +
    String(v2) +
    '|' +
    String(w0) +
    ',' +
    String(w1) +
    ',' +
    String(w2);
  let h1 = 2166136261;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
  }
  h1 = h1 >>> 0;
  let h2 = 5381;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h2 = (Math.imul(h2, 33) ^ c) >>> 0;
  }
  let a = (h1 >>> 0).toString(16);
  while (a.length < 8) a = '0' + a;
  let b = (h2 >>> 0).toString(16);
  while (b.length < 8) b = '0' + b;
  return a + b;
}

export function step(s: RoverState, input: Input, ground: Ground): RoverState {
  let thr = input.throttle;
  if (!(thr >= -1 && thr <= 1)) {
    if (thr > 1) thr = 1;
    else if (thr < -1) thr = -1;
    else thr = 0;
  }
  let str = input.steer;
  if (!(str >= -1 && str <= 1)) {
    if (str > 1) str = 1;
    else if (str < -1) str = -1;
    else str = 0;
  }
  const brk = input.brake === true;
  const kind = s.kind;

  let mass: number;
  let top: number;
  let track: number;
  let base: number;
  let rad: number;
  let maxSt: number;
  let n: number;
  let inertia: number;
  let bodyHy: number;
  let bodyRad: number;
  if (kind === 'scout') {
    mass = 400;
    top = 14;
    track = 1.6;
    base = 2.2;
    rad = 0.45;
    maxSt = 0.5;
    n = 4;
    inertia = 246.66666666666666;
    bodyHy = 0.35;
    bodyRad = 1.4;
  } else if (kind === 'hauler') {
    mass = 1600;
    top = 9;
    track = 2.0;
    base = 3.6;
    rad = 0.55;
    maxSt = 0.4;
    n = 6;
    inertia = 2261.3333333333335;
    bodyHy = 0.5;
    bodyRad = 2.0;
  } else {
    mass = 4000;
    top = 4;
    track = 2.4;
    base = 4.4;
    rad = 0.4;
    maxSt = 0;
    n = 8;
    inertia = 8373.333333333334;
    bodyHy = 0.45;
    bodyRad = 2.4;
  }

  let px = s.p[0] ?? 0;
  let py = s.p[1] ?? 0;
  let pz = s.p[2] ?? 0;
  let qx = s.q[0] ?? 0;
  let qy = s.q[1] ?? 0;
  let qz = s.q[2] ?? 0;
  let qw = s.q[3] ?? 1;
  {
    const l = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
    if (l > 1e-12) {
      qx = qx / l;
      qy = qy / l;
      qz = qz / l;
      qw = qw / l;
    } else {
      qx = 0;
      qy = 0;
      qz = 0;
      qw = 1;
    }
  }
  let vx = s.v[0] ?? 0;
  let vy = s.v[1] ?? 0;
  let vz = s.v[2] ?? 0;
  let ax = s.w[0] ?? 0;
  let ay = s.w[1] ?? 0;
  let az = s.w[2] ?? 0;

  const g = ground.g;
  const kPer = (mass * OMEGA2) / n;
  const cPer = (2 * ZETA * mass * OMEGA) / n;
  const kDrivePer = (mass * 3) / n;
  const kBrakePer = (mass * 10) / n;
  const kLatPer = (mass * 12) / n;
  const kRollPer = (mass * 0.3) / n;
  const MU = 1.5;
  const maxNper = (mass * g) / n / 1 + 0;
  const maxN = maxNper * 8 + 200;

  const lxs: number[] = [];
  const lzs: number[] = [];
  const fronts: boolean[] = [];
  const sides: number[] = [];
  if (kind === 'scout') {
    const hx2 = track * 0.5;
    const hz2 = base * 0.5;
    lxs.push(-hx2); lzs.push(hz2); fronts.push(true); sides.push(0);
    lxs.push(hx2); lzs.push(hz2); fronts.push(true); sides.push(0);
    lxs.push(-hx2); lzs.push(-hz2); fronts.push(false); sides.push(0);
    lxs.push(hx2); lzs.push(-hz2); fronts.push(false); sides.push(0);
  } else if (kind === 'hauler') {
    const hx2 = track * 0.5;
    const hz2 = base * 0.5;
    lxs.push(-hx2); lzs.push(hz2); fronts.push(true); sides.push(0);
    lxs.push(hx2); lzs.push(hz2); fronts.push(true); sides.push(0);
    lxs.push(-hx2); lzs.push(0); fronts.push(false); sides.push(0);
    lxs.push(hx2); lzs.push(0); fronts.push(false); sides.push(0);
    lxs.push(-hx2); lzs.push(-hz2); fronts.push(false); sides.push(0);
    lxs.push(hx2); lzs.push(-hz2); fronts.push(false); sides.push(0);
  } else {
    const hx2 = track * 0.5;
    const r0 = 1.65;
    const r1 = 0.55;
    const r2 = -0.55;
    const r3 = -1.65;
    lxs.push(-hx2); lzs.push(r0); fronts.push(false); sides.push(-1);
    lxs.push(hx2); lzs.push(r0); fronts.push(false); sides.push(1);
    lxs.push(-hx2); lzs.push(r1); fronts.push(false); sides.push(-1);
    lxs.push(hx2); lzs.push(r1); fronts.push(false); sides.push(1);
    lxs.push(-hx2); lzs.push(r2); fronts.push(false); sides.push(-1);
    lxs.push(hx2); lzs.push(r2); fronts.push(false); sides.push(1);
    lxs.push(-hx2); lzs.push(r3); fronts.push(false); sides.push(-1);
    lxs.push(hx2); lzs.push(r3); fronts.push(false); sides.push(1);
  }

  const delta = str * maxSt;
  const cs0 = yawPair(delta);
  const cd = cs0[0] ?? 1;
  const sd = cs0[1] ?? 0;

  let leftT = 0;
  let rightT = 0;
  if (kind === 'crawler') {
    let lt = thr + str;
    lt = clampN(lt, -1, 1);
    let rt = thr - str;
    rt = clampN(rt, -1, 1);
    leftT = lt * top;
    rightT = rt * top;
  }
  const wheeledTarget = thr * top;

  const boxes = ground.boxes;
  const SUB = 2;
  const h = DT / SUB;

  for (let sub = 0; sub < SUB; sub++) {
    const x = qx;
    const y = qy;
    const z = qz;
    const wq = qw;
    const R00 = 1 - 2 * (y * y + z * z);
    const R01 = 2 * (x * y - wq * z);
    const R02 = 2 * (x * z + wq * y);
    const R10 = 2 * (x * y + wq * z);
    const R11 = 1 - 2 * (x * x + z * z);
    const R12 = 2 * (y * z - wq * x);
    const R20 = 2 * (x * z - wq * y);
    const R21 = 2 * (y * z + wq * x);
    const R22 = 1 - 2 * (x * x + y * y);
    const Fx = R02;
    const Fz = R22;
    let Fhx = Fx;
    let Fhz = Fz;
    {
      const l = Math.sqrt(Fhx * Fhx + Fhz * Fhz);
      if (l > 1e-9) {
        Fhx = Fhx / l;
        Fhz = Fhz / l;
      } else {
        Fhx = 0;
        Fhz = 1;
      }
    }
    void R01;
    void R11;
    void R21;
    void R10;
    void R20;
    const Rhx = -Fhz;
    const Rhz = Fhx;
    const WhxS = Fhx * cd + Rhx * sd;
    const WhzS = Fhz * cd + Rhz * sd;
    const WsxS = Rhx * cd - Fhx * sd;
    const WszS = Rhz * cd - Fhz * sd;

    let FxTot = 0;
    let FyTot = 0;
    let FzTot = 0;
    let TxTot = 0;
    let TyTot = 0;
    let TzTot = 0;

    for (let i = 0; i < n; i++) {
      const lx = lxs[i] ?? 0;
      const lz = lzs[i] ?? 0;
      const isFront = fronts[i] ?? false;
      const side = sides[i] ?? 0;
      const rx = R00 * lx + R02 * lz;
      const ry = R10 * lx + R12 * lz;
      const rz = R20 * lx + R22 * lz;
      const Ax = px + rx;
      const Ay = py + ry;
      const Az = pz + rz;
      const gh = ground.height(Ax, Az);
      const restClear = REST + rad;
      const clearance = Ay - gh;
      const comp = restClear - clearance;
      if (!(comp > 0)) continue;
      const cxv = ay * rz - az * ry;
      const cyv = az * rx - ax * rz;
      const czv = ax * ry - ay * rx;
      const vcx = vx + cxv;
      const vcy = vy + cyv;
      const vcz = vz + czv;
      let N = kPer * comp - cPer * vcy;
      if (!(N > 0)) N = 0;
      if (N > maxN) N = maxN;
      if (!(N > 1e-9)) continue;
      FyTot += N;
      TxTot += -rz * N;
      TzTot += rx * N;

      let Whx: number;
      let Whz: number;
      let Wsx: number;
      let Wsz: number;
      if (isFront) {
        Whx = WhxS;
        Whz = WhzS;
        Wsx = WsxS;
        Wsz = WszS;
      } else {
        Whx = Fhx;
        Whz = Fhz;
        Wsx = Rhx;
        Wsz = Rhz;
      }
      const vl = vcx * Whx + vcz * Whz;
      const vs = vcx * Wsx + vcz * Wsz;
      let Fl: number;
      if (brk) {
        Fl = (0 - vl) * kBrakePer;
        const lim = MU * N;
        if (Fl > lim) Fl = lim;
        else if (Fl < -lim) Fl = -lim;
      } else if (kind === 'crawler') {
        if (thr === 0 && str === 0) {
          Fl = (0 - vl) * kRollPer;
          const lim = MU * N;
          if (Fl > lim) Fl = lim;
          else if (Fl < -lim) Fl = -lim;
        } else {
          let tgt: number;
          if (side > 0) tgt = leftT;
          else if (side < 0) tgt = rightT;
          else tgt = wheeledTarget;
          Fl = (tgt - vl) * kDrivePer;
          const lim = MU * N;
          if (Fl > lim) Fl = lim;
          else if (Fl < -lim) Fl = -lim;
        }
      } else {
        if (thr === 0) {
          Fl = (0 - vl) * kRollPer;
          const lim = MU * N;
          if (Fl > lim) Fl = lim;
          else if (Fl < -lim) Fl = -lim;
        } else {
          Fl = (wheeledTarget - vl) * kDrivePer;
          const lim = MU * N;
          if (Fl > lim) Fl = lim;
          else if (Fl < -lim) Fl = -lim;
        }
      }
      let Flat = (0 - vs) * kLatPer;
      {
        const lim = MU * N;
        if (Flat > lim) Flat = lim;
        else if (Flat < -lim) Flat = -lim;
      }
      const Ftx = Whx * Fl + Wsx * Flat;
      const Ftz = Whz * Fl + Wsz * Flat;
      FxTot += Ftx;
      FzTot += Ftz;
      TxTot += ry * Ftz;
      TyTot += rz * Ftx - rx * Ftz;
      TzTot += -ry * Ftx;
    }

    FyTot += -mass * g;

    vx += (FxTot / mass) * h;
    vy += (FyTot / mass) * h;
    vz += (FzTot / mass) * h;

    ax += (TxTot / inertia) * h;
    ay += (TyTot / inertia) * h;
    az += (TzTot / inertia) * h;

    {
      const fH = 1 - 3 * h;
      const fY = 1 - 1 * h;
      const cH = fH < 0 ? 0 : fH;
      const cY = fY < 0 ? 0 : fY;
      ax *= cH;
      az *= cH;
      ay *= cY;
    }
    {
      const f = 1 - 0.02 * h;
      vx *= f;
      vy *= f;
      vz *= f;
    }
    {
      const vmax = top * 2 + 5;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (sp > vmax) {
        const k = vmax / sp;
        vx *= k;
        vy *= k;
        vz *= k;
      }
    }
    {
      const wmax = 6;
      const wl = Math.sqrt(ax * ax + ay * ay + az * az);
      if (wl > wmax) {
        const k = wmax / wl;
        ax *= k;
        ay *= k;
        az *= k;
      }
    }

    px += vx * h;
    py += vy * h;
    pz += vz * h;

    {
      const dqx = 0.5 * (ax * qw + ay * qz - az * qy);
      const dqy = 0.5 * (ay * qw + az * qx - ax * qz);
      const dqz = 0.5 * (az * qw + ax * qy - ay * qx);
      const dqw = 0.5 * (-ax * qx - ay * qy - az * qz);
      qx += dqx * h;
      qy += dqy * h;
      qz += dqz * h;
      qw += dqw * h;
      const l = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
      if (l > 1e-12) {
        qx /= l;
        qy /= l;
        qz /= l;
        qw /= l;
      } else {
        qx = 0;
        qy = 0;
        qz = 0;
        qw = 1;
      }
    }

    {
      const gh0 = ground.height(px, pz);
      const minY = gh0 + bodyHy * 0.5;
      if (py < minY) {
        py = minY;
        if (vy < 0) vy = 0;
        ax *= 0.8;
        ay *= 0.8;
        az *= 0.8;
      }
    }

    if (boxes !== undefined) {
      for (let bi = 0; bi < boxes.length; bi++) {
        const b = boxes[bi];
        if (b === undefined) continue;
        const cx = b.cx;
        const cz = b.cz;
        const hx = b.hx;
        const hz = b.hz;
        const yaw = b.yaw;
        const topY = b.top;
        if (py - bodyHy > topY) continue;
        const dx = px - cx;
        const dz = pz - cz;
        const cs = yawPair(yaw);
        const cc = cs[0] ?? 1;
        const ss2 = cs[1] ?? 0;
        const lx = cc * dx - ss2 * dz;
        const lz = ss2 * dx + cc * dz;
        const ax2 = lx < 0 ? -lx : lx;
        const az2 = lz < 0 ? -lz : lz;
        if (ax2 <= hx && az2 <= hz) {
          const dx1 = hx - ax2;
          const dz1 = hz - az2;
          const pv = topY - (py - bodyHy);
          const phx = dx1 + bodyRad;
          const phz = dz1 + bodyRad;
          const ph = phx < phz ? phx : phz;
          if (pv < ph) {
            py = topY + bodyHy;
            if (vy < 0) vy = 0;
            ax *= 0.8;
            ay *= 0.8;
            az *= 0.8;
          } else {
            if (phx < phz) {
              const sgn = lx >= 0 ? 1 : -1;
              const plx = sgn * phx;
              const pwx = cc * plx;
              const pwz = -ss2 * plx;
              px += pwx;
              pz += pwz;
              const nx = cc * sgn;
              const nz = -ss2 * sgn;
              const vn = vx * nx + vz * nz;
              if (vn < 0) {
                vx -= nx * vn;
                vz -= nz * vn;
              }
              ax *= 0.8;
              ay *= 0.8;
              az *= 0.8;
            } else {
              const sgn = lz >= 0 ? 1 : -1;
              const plz = sgn * phz;
              const pwx = ss2 * plz;
              const pwz = cc * plz;
              px += pwx;
              pz += pwz;
              const nx = ss2 * sgn;
              const nz = cc * sgn;
              const vn = vx * nx + vz * nz;
              if (vn < 0) {
                vx -= nx * vn;
                vz -= nz * vn;
              }
              ax *= 0.8;
              ay *= 0.8;
              az *= 0.8;
            }
          }
        } else {
          let qxx = lx;
          let qzz = lz;
          if (qxx > hx) qxx = hx;
          else if (qxx < -hx) qxx = -hx;
          if (qzz > hz) qzz = hz;
          else if (qzz < -hz) qzz = -hz;
          const ex = lx - qxx;
          const ez = lz - qzz;
          const d = Math.sqrt(ex * ex + ez * ez);
          if (!(d < bodyRad)) continue;
          const pv = topY - (py - bodyHy);
          const ph = bodyRad - d;
          if (pv < ph) {
            py = topY + bodyHy;
            if (vy < 0) vy = 0;
            ax *= 0.8;
            ay *= 0.8;
            az *= 0.8;
          } else {
            if (d > 1e-9) {
              const ux = ex / d;
              const uz = ez / d;
              const plx = ux * ph;
              const plz = uz * ph;
              const pwx = cc * plx + ss2 * plz;
              const pwz = -ss2 * plx + cc * plz;
              px += pwx;
              pz += pwz;
              const nx = cc * ux + ss2 * uz;
              const nz = -ss2 * ux + cc * uz;
              const vn = vx * nx + vz * nz;
              if (vn < 0) {
                vx -= nx * vn;
                vz -= nz * vn;
              }
              ax *= 0.8;
              ay *= 0.8;
              az *= 0.8;
            }
          }
        }
      }
    }
  }

  return {
    kind,
    p: [px, py, pz],
    q: [qx, qy, qz, qw],
    v: [vx, vy, vz],
    w: [ax, ay, az],
  };
}
