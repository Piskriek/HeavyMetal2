import { PARAM_KEYS, REF_KEYS, type PresetSeed } from './types';
import { MATERIALS } from './materials';

export interface SeedIssue {
  seed: string;
  message: string;
}

const VALID_HATS = new Set(['none', 'cap', 'helmet', 'crown', 'bandana', 'horns', 'leaf', 'pot']);
const VALID_EARS = new Set(['small', 'big', 'floppy', 'pointy']);
const VALID_SHAPES = new Set(['sphere', 'box', 'cylinder', 'plane']);
const VALID_BODIES = new Set(['none', 'static', 'dynamic']);
const VALID_TIERS = new Set(['play', 'build', 'pro']);

export function validateSeeds(seeds: readonly PresetSeed[]): SeedIssue[] {
  const issues: SeedIssue[] = [];
  const seenNames = new Set<string>();

  const seedsMap = new Map<string, PresetSeed>();
  for (const s of seeds) {
    if (s && typeof s.name === 'string') {
      seedsMap.set(s.name, s);
    }
  }

  const materialsMap = new Map<string, PresetSeed>();
  for (const m of MATERIALS) {
    materialsMap.set(m.name, m);
  }

  for (const s of seeds) {
    const seedName = s.name ?? '<unnamed>';

    // Name uniqueness
    if (seenNames.has(s.name)) {
      issues.push({ seed: seedName, message: `Duplicate seed name "${s.name}": names must be unique across all seeds` });
    } else {
      seenNames.add(s.name);
    }

    // Name format and length
    const maxNameLen = s.kind === 'racer' ? 32 : 28;
    if (typeof s.name !== 'string' || s.name.trim() !== s.name || s.name.length < 3) {
      issues.push({ seed: seedName, message: `Invalid name "${s.name}": must be trimmed string with length >= 3` });
    } else if (s.name.length > maxNameLen) {
      issues.push({ seed: seedName, message: `Seed name "${s.name}" is too long (length ${s.name.length} > max ${maxNameLen})` });
    }

    // Tags
    if (!Array.isArray(s.tags) || s.tags.length === 0) {
      issues.push({ seed: seedName, message: `Seed "${seedName}" must have at least one tag` });
    } else {
      for (const tag of s.tags) {
        if (typeof tag !== 'string' || tag.length <= 1 || tag !== tag.toLowerCase()) {
          issues.push({ seed: seedName, message: `Invalid tag "${tag}": tags must be non-empty lowercase strings of length > 1` });
        }
      }
    }

    // Tier
    if (!VALID_TIERS.has(s.tier)) {
      issues.push({ seed: seedName, message: `Invalid tier "${s.tier}": must be 'play', 'build', or 'pro'` });
    }

    // Doc
    if (s.doc !== undefined) {
      if (typeof s.doc !== 'string' || s.doc.trim().length <= 10) {
        issues.push({ seed: seedName, message: `Documentation doc must be a descriptive string longer than 10 characters` });
      }
    }

    // Params validation
    const allowedParamKeys = PARAM_KEYS[s.kind];
    if (!allowedParamKeys) {
      issues.push({ seed: seedName, message: `Unknown seed kind "${s.kind}"` });
      continue;
    }

    const paramEntries = Object.entries(s.params ?? {});
    for (const [key, val] of paramEntries) {
      if (!allowedParamKeys.includes(key)) {
        issues.push({ seed: seedName, message: `Unknown param "${key}" for seed kind "${s.kind}"` });
        continue;
      }

      // Check color
      if (key === 'color' || key === 'accent') {
        if (typeof val !== 'string' || !/^#[0-9a-f]{6}$/i.test(val)) {
          issues.push({ seed: seedName, message: `Invalid color format for "${key}": "${val}" does not match #rrggbb` });
        }
      }
    }

    // Kind-specific param checks
    if (s.kind === 'material') {
      const roughness = s.params.roughness;
      if (typeof roughness !== 'number' || !Number.isFinite(roughness) || roughness < 0 || roughness > 1) {
        issues.push({ seed: seedName, message: `Material param roughness must be a finite number between 0 and 1, got ${roughness}` });
      }
      const metalness = s.params.metalness;
      if (typeof metalness !== 'number' || !Number.isFinite(metalness) || metalness < 0 || metalness > 1) {
        issues.push({ seed: seedName, message: `Material param metalness must be a finite number between 0 and 1, got ${metalness}` });
      }
      if ('repeat' in s.params && s.params.repeat !== null) {
        const repeat = s.params.repeat;
        if (typeof repeat !== 'number' || !Number.isFinite(repeat) || repeat < 0.01 || repeat > 256) {
          issues.push({ seed: seedName, message: `Material param repeat must be between 0.01 and 256, got ${repeat}` });
        }
      }
      if ('normalStrength' in s.params && s.params.normalStrength !== null) {
        const ns = s.params.normalStrength;
        if (typeof ns !== 'number' || !Number.isFinite(ns) || ns < 0 || ns > 4) {
          issues.push({ seed: seedName, message: `Material param normalStrength must be between 0 and 4, got ${ns}` });
        }
      }
    } else if (s.kind === 'racer') {
      const w = s.params.weight;
      const sp = s.params.speed;
      const b = s.params.bounce;
      if (typeof w !== 'number' || !Number.isInteger(w) || w < 1 || w > 10) {
        issues.push({ seed: seedName, message: `Racer weight must be an integer between 1 and 10, got ${w}` });
      }
      if (typeof sp !== 'number' || !Number.isInteger(sp) || sp < 1 || sp > 10) {
        issues.push({ seed: seedName, message: `Racer speed must be an integer between 1 and 10, got ${sp}` });
      }
      if (typeof b !== 'number' || !Number.isInteger(b) || b < 1 || b > 10) {
        issues.push({ seed: seedName, message: `Racer bounce must be an integer between 1 and 10, got ${b}` });
      }
      if (typeof w === 'number' && typeof sp === 'number' && typeof b === 'number') {
        if (w + sp + b > 15) {
          issues.push({ seed: seedName, message: `Racer stats budget exceeded: weight(${w}) + speed(${sp}) + bounce(${b}) = ${w + sp + b} > sum limit 15` });
        }
      }
      const skill = s.params.skill;
      if (typeof skill !== 'number' || !Number.isFinite(skill) || skill < 0 || skill > 1) {
        issues.push({ seed: seedName, message: `Racer skill must be a finite number between 0 and 1, got ${skill}` });
      }
      const hat = String(s.params.hat);
      if (!VALID_HATS.has(hat)) {
        issues.push({ seed: seedName, message: `Invalid racer hat "${hat}"` });
      }
      const ears = String(s.params.ears);
      if (!VALID_EARS.has(ears)) {
        issues.push({ seed: seedName, message: `Invalid racer ears "${ears}"` });
      }
    } else if (s.kind === 'camera') {
      const fov = s.params.fov;
      if (typeof fov !== 'number' || !Number.isFinite(fov) || fov < 20 || fov > 110) {
        issues.push({ seed: seedName, message: `Camera fov must be between 20 and 110, got ${fov}` });
      }
      const distance = s.params.distance;
      if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0.5 || distance > 2000) {
        issues.push({ seed: seedName, message: `Camera distance must be between 0.5 and 2000, got ${distance}` });
      }
      const pitch = s.params.pitch;
      if (typeof pitch !== 'number' || !Number.isFinite(pitch) || pitch < -1.5 || pitch > 1.5) {
        issues.push({ seed: seedName, message: `Camera pitch must be between -1.5 and 1.5 rad, got ${pitch}` });
      }
      const yaw = s.params.yaw;
      if (typeof yaw !== 'number' || !Number.isFinite(yaw) || yaw < -6.3 || yaw > 6.3) {
        issues.push({ seed: seedName, message: `Camera yaw must be between -6.3 and 6.3 rad, got ${yaw}` });
      }
    } else if (s.kind === 'entity') {
      const shape = String(s.params.shape);
      if (!VALID_SHAPES.has(shape)) {
        issues.push({ seed: seedName, message: `Invalid entity shape "${shape}"` });
      }
      const body = String(s.params.body);
      if (!VALID_BODIES.has(body)) {
        issues.push({ seed: seedName, message: `Invalid entity body "${body}"` });
      }
      const size = s.params.size;
      if (typeof size !== 'number' || !Number.isFinite(size) || size < 0.05 || size > 50) {
        issues.push({ seed: seedName, message: `Entity size must be between 0.05 and 50, got ${size}` });
      }
      if ('friction' in s.params && s.params.friction !== null) {
        const friction = s.params.friction;
        if (typeof friction !== 'number' || !Number.isFinite(friction) || friction < 0 || friction > 1) {
          issues.push({ seed: seedName, message: `Entity friction must be between 0 and 1, got ${friction}` });
        }
      }
      if ('restitution' in s.params && s.params.restitution !== null) {
        const restitution = s.params.restitution;
        if (typeof restitution !== 'number' || !Number.isFinite(restitution) || restitution < 0 || restitution > 1) {
          issues.push({ seed: seedName, message: `Entity restitution must be between 0 and 1, got ${restitution}` });
        }
      }
    }

    // Refs validation
    const allowedRefKeys = REF_KEYS[s.kind] ?? [];
    if (s.refs) {
      for (const [refKey, targetName] of Object.entries(s.refs)) {
        if (!allowedRefKeys.includes(refKey)) {
          issues.push({ seed: seedName, message: `Unknown ref key "${refKey}" for seed kind "${s.kind}"` });
          continue;
        }
        if (refKey === 'material') {
          // Look up in passed seeds first, then fallback to MATERIALS
          const target = seedsMap.get(targetName) ?? materialsMap.get(targetName);
          if (!target) {
            issues.push({ seed: seedName, message: `Ref material "${targetName}" not found in seed library` });
          } else if (target.kind !== 'material') {
            issues.push({ seed: seedName, message: `Ref material "${targetName}" has kind "${target.kind}", expected kind "material"` });
          }
        }
      }
    }
  }

  return issues;
}
