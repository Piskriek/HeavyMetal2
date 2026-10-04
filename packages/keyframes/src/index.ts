export type Interp = 'step' | 'linear' | 'smooth' | 'bezier';

export interface Key {
  t: number;
  v: number;
  interp: Interp;
  inTan?: number;
  outTan?: number;
}

export interface Track {
  id: string;
  keys: Key[];
}

const cloneKey = (key: Key): Key => ({ ...key });

const sortedKeys = (keys: Key[]): Key[] => {
  const result = keys.slice();
  result.sort((a, b) => a.t - b.t);
  return result;
};

const slope = (from: Key, to: Key): number => {
  const dt = to.t - from.t;
  return dt === 0 ? 0 : (to.v - from.v) / dt;
};

const smoothTangent = (keys: readonly Key[], index: number): number => {
  const key = keys[index];
  if (key === undefined) {
    return 0;
  }

  if (index === 0) {
    const next = keys[1];
    return next === undefined ? 0 : slope(key, next);
  }

  if (index === keys.length - 1) {
    const previous = keys[index - 1];
    return previous === undefined ? 0 : slope(previous, key);
  }

  const previous = keys[index - 1];
  const next = keys[index + 1];
  if (previous === undefined || next === undefined) {
    return 0;
  }

  const dt = next.t - previous.t;
  return dt === 0 ? 0 : (next.v - previous.v) / dt;
};

const hermite = (
  v0: number,
  v1: number,
  m0: number,
  m1: number,
  dt: number,
  s: number,
): number => {
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  return h00 * v0 + h10 * dt * m0 + h01 * v1 + h11 * dt * m1;
};

const interpolate = (
  left: Key,
  right: Key,
  keys: readonly Key[],
  leftIndex: number,
  rightIndex: number,
  time: number,
): number => {
  const dt = right.t - left.t;
  const s = dt === 0 ? 0 : (time - left.t) / dt;

  switch (left.interp) {
    case 'step':
      return left.v;
    case 'linear':
      return left.v + (right.v - left.v) * s;
    case 'smooth':
      return hermite(
        left.v,
        right.v,
        smoothTangent(keys, leftIndex),
        smoothTangent(keys, rightIndex),
        dt,
        s,
      );
    case 'bezier':
      return hermite(
        left.v,
        right.v,
        left.outTan ?? 0,
        right.inTan ?? 0,
        dt,
        s,
      );
    default:
      return left.v;
  }
};

export function valueAt(track: Track, t: number): number {
  const keys = track.keys;
  const first = keys[0];

  if (first === undefined) {
    return 0;
  }

  if (t <= first.t) {
    return first.v;
  }

  const last = keys[keys.length - 1];
  if (last === undefined || t >= last.t) {
    return last?.v ?? first.v;
  }

  for (let index = 0; index < keys.length - 1; index += 1) {
    const left = keys[index];
    const right = keys[index + 1];

    if (left !== undefined && right !== undefined && t < right.t) {
      return interpolate(left, right, keys, index, index + 1, t);
    }
  }

  return last.v;
}

export function addKey(track: Track, key: Key): Track {
  const keys = track.keys.map(cloneKey);
  let replacement = -1;

  for (let index = 0; index < keys.length; index += 1) {
    const existing = keys[index];
    if (existing !== undefined && Math.abs(existing.t - key.t) <= 1e-6) {
      replacement = index;
      break;
    }
  }

  if (replacement >= 0) {
    keys[replacement] = cloneKey(key);
  } else {
    keys.push(cloneKey(key));
  }

  return { id: track.id, keys: sortedKeys(keys) };
}

export function removeKey(track: Track, t: number): Track {
  const keys = track.keys.map(cloneKey);
  const index = keys.findIndex((key) => Math.abs(key.t - t) <= 1e-6);

  if (index >= 0) {
    keys.splice(index, 1);
  }

  return { id: track.id, keys: sortedKeys(keys) };
}

export function moveKeys(track: Track, indices: number[], dt: number): Track {
  const selected = new Set(indices);
  const keys = track.keys.map((key, index) => ({
    ...key,
    t: selected.has(index) ? key.t + dt : key.t,
  }));

  return { id: track.id, keys: sortedKeys(keys) };
}

export function scaleKeys(
  track: Track,
  indices: number[],
  pivot: number,
  factor: number,
): Track {
  const selected = new Set(indices);
  const keys = track.keys.map((key, index) => ({
    ...key,
    t: selected.has(index) ? pivot + (key.t - pivot) * factor : key.t,
  }));

  return { id: track.id, keys: sortedKeys(keys) };
}

export function bake(
  track: Track,
  fps: number,
  from: number,
  to: number,
): number[] {
  if (
    !Number.isFinite(fps) ||
    fps <= 0 ||
    !Number.isFinite(from) ||
    !Number.isFinite(to)
  ) {
    return [];
  }

  if (from === to) {
    return [valueAt(track, from)];
  }

  const direction = to > from ? 1 : -1;
  const distance = Math.abs(to - from);
  const count = Math.floor(distance * fps + 1e-9);
  const samples: number[] = [];

  for (let frame = 0; frame <= count; frame += 1) {
    const candidate = from + (direction * frame) / fps;
    const time = Math.abs(candidate - to) <= 1e-9 ? to : candidate;
    samples.push(valueAt(track, time));
  }

  const lastSample = from + (direction * count) / fps;
  if (Math.abs(lastSample - to) > 1e-9) {
    samples.push(valueAt(track, to));
  }

  return samples;
}

export function snapTime(t: number, fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) {
    return t;
  }

  return Math.round(t * fps) / fps;
}

export function duration(tracks: readonly Track[]): number {
  let hasKeys = false;
  let first = 0;
  let last = 0;

  for (const track of tracks) {
    for (const key of track.keys) {
      if (!hasKeys) {
        first = key.t;
        last = key.t;
        hasKeys = true;
      } else {
        if (key.t < first) {
          first = key.t;
        }
        if (key.t > last) {
          last = key.t;
        }
      }
    }
  }

  return hasKeys ? last - first : 0;
}