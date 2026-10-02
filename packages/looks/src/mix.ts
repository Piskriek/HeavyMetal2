import { LookParams, LOOK_NUMBER_KEYS, LOOK_COLOR_KEYS, LOOK_RANGES, Vec3 } from './types';
import { hexToLinear, linearToHex } from './colour';

export function mixLooks(a: LookParams, b: LookParams, t: number): LookParams {
  const ct = Math.max(0, Math.min(1, t));

  if (ct === 0) {
    const res = { ...a } as any;
    for (const key of LOOK_COLOR_KEYS) {
      res[key] = (a[key] as string).toLowerCase();
    }
    return res as LookParams;
  }
  if (ct === 1) {
    const res = { ...b } as any;
    for (const key of LOOK_COLOR_KEYS) {
      res[key] = (b[key] as string).toLowerCase();
    }
    return res as LookParams;
  }

  const result = {} as any;

  // Number keys
  for (const key of LOOK_NUMBER_KEYS) {
    if (key === 'sunAzimuth') {
      let diff = (b.sunAzimuth - a.sunAzimuth) % 360;
      if (diff < -180) diff += 360;
      if (diff > 180) diff -= 360;
      let mixedAzimuth = (a.sunAzimuth + diff * ct) % 360;
      if (mixedAzimuth < 0) mixedAzimuth += 360;
      result.sunAzimuth = mixedAzimuth;
    } else {
      const valA = a[key] as number;
      const valB = b[key] as number;
      result[key] = valA + (valB - valA) * ct;
    }
  }

  // Color keys
  for (const key of LOOK_COLOR_KEYS) {
    const la = hexToLinear(a[key] as string);
    const lb = hexToLinear(b[key] as string);
    const mixed: Vec3 = [
      la[0] + (lb[0] - la[0]) * ct,
      la[1] + (lb[1] - la[1]) * ct,
      la[2] + (lb[2] - la[2]) * ct
    ];
    result[key] = linearToHex(mixed);
  }

  return result as LookParams;
}

export function validateLook(p: LookParams): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!p || typeof p !== 'object') {
    return { ok: false, errors: ['p is not an object'] };
  }

  const anyP = p as any;

  // Validate number keys
  for (const key of LOOK_NUMBER_KEYS) {
    const val = anyP[key];
    if (val === undefined || val === null) {
      errors.push(`Missing key: ${key}`);
      continue;
    }
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      errors.push(`Invalid number or non-finite: ${key}`);
      continue;
    }
    const range = LOOK_RANGES[key];
    if (range) {
      const [min, max] = range;
      if (val < min || val > max) {
        errors.push(`Value out of range for ${key}: got ${val}, expected [${min}, ${max}]`);
      }
    }
  }

  // Validate color keys
  for (const key of LOOK_COLOR_KEYS) {
    const val = anyP[key];
    if (val === undefined || val === null) {
      errors.push(`Missing key: ${key}`);
      continue;
    }
    if (typeof val !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(val)) {
      errors.push(`Invalid color hex format for ${key}: got "${String(val)}"`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
