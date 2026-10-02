import { Vec3 } from './types';

export function hexToLinear(hex: string): Vec3 {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Invalid hex format: "${hex}". Only 6-digit hex codes starting with # are allowed.`);
  }
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);

  const decode = (val: number) => {
    const c = val / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return [decode(r), decode(g), decode(b)];
}

export function linearToHex(c: Vec3): string {
  const encode = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    const s = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    const r = Math.round(s * 255);
    return r.toString(16).padStart(2, '0');
  };

  return `#${encode(c[0])}${encode(c[1])}${encode(c[2])}`;
}

export function kelvinToRgb(k: number): Vec3 {
  const temp = Math.max(1000, Math.min(40000, k)) / 100;

  let r = 0;
  let g = 0;
  let b = 0;

  // Calculate Red
  if (temp <= 66) {
    r = 255;
  } else {
    const rVal = temp - 60;
    r = 329.698727446 * Math.pow(rVal, -0.1332047592);
  }

  // Calculate Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    const gVal = temp - 60;
    g = 288.1221695283 * Math.pow(gVal, -0.0755148492);
  }

  // Calculate Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    const bVal = temp - 10;
    b = 138.5177312231 * Math.log(bVal) - 305.0447927307;
  }

  // Clamp sRGB components to [0, 255]
  const clamp255 = (x: number) => Math.max(0, Math.min(255, x));
  const sr = clamp255(r);
  const sg = clamp255(g);
  const sb = clamp255(b);

  // Decode to linear
  const decode = (val: number) => {
    const c = val / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const lr = decode(sr);
  const lg = decode(sg);
  const lb = decode(sb);

  // Normalise so the largest channel is 1
  const max = Math.max(lr, lg, lb);
  if (max > 0) {
    return [lr / max, lg / max, lb / max];
  }
  return [0, 0, 0];
}
