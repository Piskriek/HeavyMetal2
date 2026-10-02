import { isFiniteNumber } from './ease';
import { normalizeModulator } from './normalize';

export interface ValidationResult { ok: boolean; errors: string[] }

const MAX_DEPTH = 8;
const MAX_COUNT = 4096;
const KINDS = ['constant', 'random', 'noise', 'lfo', 'curve', 'timeline', 'sequence', 'stream', 'texture', 'expr', 'combine'] as const;
const WAVES = ['sine', 'triangle', 'saw', 'square'] as const;
const EASES = ['linear', 'in', 'out', 'inOut', 'hold'] as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function got(v: unknown): string {
  return v === undefined ? '' : ` (got ${JSON.stringify(v)})`;
}

function num(errors: string[], path: string, v: unknown, atLeast?: number, atMost?: number): boolean {
  if (!isFiniteNumber(v)) {
    errors.push(`${path} must be a finite number${atLeast !== undefined ? ` >= ${atLeast}` : ''}`);
    return false;
  }
  if (atLeast !== undefined && v < atLeast) {
    errors.push(`${path} must be a finite number >= ${atLeast} (got ${v})`);
    return false;
  }
  if (atMost !== undefined && v > atMost) {
    errors.push(`${path} must be a finite number <= ${atMost} (got ${v})`);
    return false;
  }
  return true;
}

function checkRange(errors: string[], path: string, v: unknown): boolean {
  if (!isObj(v)) {
    errors.push(`${path} must be an object with finite min and max`);
    return false;
  }
  const min = v.min;
  const max = v.max;
  if (!isFiniteNumber(min) || !isFiniteNumber(max)) {
    errors.push(`${path}.min and ${path}.max must be finite numbers`);
    return false;
  }
  if (min > max) {
    errors.push(`${path}.min (${min}) must be <= ${path}.max (${max})`);
    return false;
  }
  return true;
}

function checkEnum(errors: string[], path: string, v: unknown, allowed: readonly string[], label: string): boolean {
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return true;
  errors.push(`${path} must be one of ${label}${got(v)}`);
  return false;
}

function walk(def: unknown, path: string, depth: number, errors: string[]): void {
  if (depth > MAX_DEPTH) {
    errors.push(`${path} exceeds the maximum modulator nesting depth of ${MAX_DEPTH}`);
    return;
  }
  if (!isObj(def)) {
    errors.push(`${path} must be a modulator object`);
    return;
  }
  const kind = def.kind;
  if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) {
    errors.push(`${path}.kind must be one of ${KINDS.join(', ')}${got(kind)}`);
    return;
  }
  const p = `${path}.${kind}`;

  switch (kind) {
    case 'constant': {
      num(errors, `${p}.value`, def.value);
      return;
    }
    case 'random': {
      if (def.seed !== undefined) num(errors, `${p}.seed`, def.seed);
      num(errors, `${p}.rateHz`, def.rateHz, 0);
      checkEnum(errors, `${p}.mode`, def.mode, ['hold', 'smooth'], '"hold" or "smooth"');
      if (def.distribution !== undefined) checkEnum(errors, `${p}.distribution`, def.distribution, ['uniform', 'gaussian'], '"uniform" or "gaussian"');
      checkRange(errors, `${p}.out`, def.out);
      return;
    }
    case 'noise': {
      if (def.seed !== undefined) num(errors, `${p}.seed`, def.seed);
      num(errors, `${p}.freqHz`, def.freqHz, 0);
      if (def.octaves !== undefined) num(errors, `${p}.octaves`, def.octaves, 1, 8);
      if (def.gain !== undefined) num(errors, `${p}.gain`, def.gain, 0, 1);
      checkRange(errors, `${p}.out`, def.out);
      return;
    }
    case 'lfo': {
      checkEnum(errors, `${p}.wave`, def.wave, WAVES, WAVES.join(', '));
      num(errors, `${p}.freqHz`, def.freqHz, 0);
      if (def.phase !== undefined) num(errors, `${p}.phase`, def.phase, 0, 1);
      if (def.width !== undefined) num(errors, `${p}.width`, def.width, 0, 1);
      checkRange(errors, `${p}.out`, def.out);
      return;
    }
    case 'curve': {
      const points = def.points;
      if (!Array.isArray(points)) {
        errors.push(`${p}.points must be an array of [x, y] pairs`);
      } else {
        if (points.length > MAX_COUNT) errors.push(`${p}.points has ${points.length} entries, at most ${MAX_COUNT} are allowed`);
        points.forEach((pt, i) => {
          if (!Array.isArray(pt) || pt.length < 2 || !isFiniteNumber(pt[0]) || !isFiniteNumber(pt[1])) {
            errors.push(`${p}.points[${i}] must be a [x, y] pair of finite numbers`);
            return;
          }
          if (pt[0] < 0 || pt[0] > 1) errors.push(`${p}.points[${i}].x must be inside 0..1 (got ${pt[0]})`);
          if (pt[1] < 0 || pt[1] > 1) errors.push(`${p}.points[${i}].y must be inside 0..1 (got ${pt[1]})`);
          const prev = points[i - 1];
          if (i > 0 && Array.isArray(prev) && isFiniteNumber(prev[0]) && prev[0] > pt[0]) {
            errors.push(`${p}.points[${i}].x (${pt[0]}) must be >= ${p}.points[${i - 1}].x (${prev[0]}): points must be sorted by x`);
          }
        });
      }
      checkEnum(errors, `${p}.interpolation`, def.interpolation, ['linear', 'smooth', 'step'], '"linear", "smooth" or "step"');
      const input = def.input;
      if (!isObj(input)) {
        errors.push(`${p}.input must be an object`);
      } else if (input.source === 'time') {
        num(errors, `${p}.input.loopMs`, input.loopMs);
      } else if (input.source === 'stream') {
        if (typeof input.path !== 'string' || input.path.length === 0) errors.push(`${p}.input.path must be a non-empty string`);
        checkRange(errors, `${p}.input.in`, input.in);
      } else {
        errors.push(`${p}.input.source must be "time" or "stream"${got(input.source)}`);
      }
      checkRange(errors, `${p}.out`, def.out);
      return;
    }
    case 'timeline': {
      num(errors, `${p}.durationMs`, def.durationMs, 0);
      checkEnum(errors, `${p}.loop`, def.loop, ['none', 'loop', 'pingpong'], '"none", "loop" or "pingpong"');
      const keys = def.keys;
      if (!Array.isArray(keys)) {
        errors.push(`${p}.keys must be an array of keyframes`);
        return;
      }
      if (keys.length > MAX_COUNT) errors.push(`${p}.keys has ${keys.length} entries, at most ${MAX_COUNT} are allowed`);
      keys.forEach((k, i) => {
        if (!isObj(k)) {
          errors.push(`${p}.keys[${i}] must be a keyframe object with timeMs and value`);
          return;
        }
        num(errors, `${p}.keys[${i}].timeMs`, k.timeMs, 0);
        num(errors, `${p}.keys[${i}].value`, k.value);
        if (k.ease !== undefined) checkEnum(errors, `${p}.keys[${i}].ease`, k.ease, EASES, EASES.join(', '));
      });
      return;
    }
    case 'sequence': {
      num(errors, `${p}.rateHz`, def.rateHz, 0);
      if (def.glideMs !== undefined) num(errors, `${p}.glideMs`, def.glideMs, 0);
      if (!Array.isArray(def.steps)) errors.push(`${p}.steps must be an array of numbers`);
      else {
        if (def.steps.length > MAX_COUNT) errors.push(`${p}.steps has ${def.steps.length} entries, at most ${MAX_COUNT} are allowed`);
        def.steps.forEach((v, i) => num(errors, `${p}.steps[${i}]`, v));
      }
      if (def.out !== undefined) checkRange(errors, `${p}.out`, def.out);
      return;
    }
    case 'stream': {
      if (typeof def.path !== 'string' || def.path.length === 0) errors.push(`${p}.path must be a non-empty stream path`);
      if (def.scale !== undefined) num(errors, `${p}.scale`, def.scale);
      if (def.offset !== undefined) num(errors, `${p}.offset`, def.offset);
      if (def.smoothMs !== undefined) num(errors, `${p}.smoothMs`, def.smoothMs, 0);
      if (def.clamp !== undefined) checkRange(errors, `${p}.clamp`, def.clamp);
      return;
    }
    case 'texture': {
      if (typeof def.textureId !== 'string' || def.textureId.length === 0) errors.push(`${p}.textureId must be a non-empty string`);
      walk(def.u, `${p}.u`, depth + 1, errors);
      walk(def.v, `${p}.v`, depth + 1, errors);
      checkRange(errors, `${p}.out`, def.out);
      return;
    }
    case 'expr': {
      if (typeof def.source !== 'string' || def.source.length === 0) errors.push(`${p}.source must be a non-empty expression string`);
      if (def.fallback !== undefined) num(errors, `${p}.fallback`, def.fallback);
      return;
    }
    case 'combine': {
      checkEnum(errors, `${p}.op`, def.op, ['add', 'multiply', 'min', 'max', 'mix'], 'add, multiply, min, max or mix');
      if (!Array.isArray(def.inputs)) errors.push(`${p}.inputs must be an array of modulator definitions`);
      else {
        if (def.inputs.length > MAX_COUNT) errors.push(`${p}.inputs has ${def.inputs.length} entries, at most ${MAX_COUNT} are allowed`);
        def.inputs.forEach((child, i) => walk(child, `${p}.inputs[${i}]`, depth + 1, errors));
      }
      if (def.mix !== undefined) num(errors, `${p}.mix`, def.mix, 0, 1);
      return;
    }
    default:
      return;
  }
}

/** Validate any (possibly untrusted) value as a modulator definition. Never throws. */
export function validateModulator(def: unknown): ValidationResult {
  const errors: string[] = [];
  try {
    walk(def, 'modulator', 1, errors);
  } catch (e) {
    errors.push(`unexpected validation failure: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { ok: errors.length === 0, errors };
}

export { normalizeModulator };
