/**
 * The player's own presets (plan 39 section 7): parts, species and lights saved from a bench or the Studio, kept in the
 * profile, and offered as "Yours" after the named presets everywhere a preset is chosen. Each is a print (the same JSON
 * a cartridge carries), so anything saved can be printed, and checked on load with cartlab's own reader, so a broken or
 * foreign one is dropped rather than trusted. A share code carries one preset between players. Pure: the screen reads
 * and writes the text with the profile store.
 */
import { printKind, readPrint, type Print, type PrintKind } from '@hm/cartlab';

export const MY_PRESETS_KEY = 'hm.setmix.presets';
/** How many presets a profile keeps (the oldest of a full library goes first). */
export const MAX_MY_PRESETS = 200;

export interface MyPreset {
  readonly id: string;
  readonly kind: PrintKind;
  readonly name: string;
  readonly print: Print;
}

export interface MyPresets {
  readonly v: 1;
  readonly next: number;
  readonly list: readonly MyPreset[];
}

export const EMPTY_MY_PRESETS: MyPresets = { v: 1, next: 1, list: [] };

/** The spec a print carries, whatever kind it is. */
const innerOf = (p: Print) =>
  'part' in p ? p.part
    : 'species' in p ? p.species
      : 'light' in p ? p.light
        : 'material' in p ? p.material
          : 'sprite' in p ? p.sprite : 'sound' in p ? p.sound : p.harness;
const nameOf = (p: Print): string => innerOf(p).name;
/** JSON with every object's keys sorted, at every depth, so equal data always reads the same. */
const stable = (x: unknown): string => {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(x);
};
/** The print's own data with its name left out: two presets that differ only by name are the same preset. */
const body = (p: Print): string => {
  const { name: _name, ...rest } = innerOf(p) as { name: string };
  return stable({ kind: printKind(p), ...rest });
};
const named = (p: Print, name: string): Print =>
  'part' in p ? { part: { ...p.part, name } }
    : 'species' in p ? { species: { ...p.species, name } }
      : 'light' in p ? { light: { ...p.light, name } }
        : 'material' in p ? { material: { ...p.material, name } }
          : 'sprite' in p ? { sprite: { ...p.sprite, name } }
            : 'sound' in p ? { sound: { ...p.sound, name } }
              : { harness: { ...p.harness, name } };

/** The library from its stored text; anything unreadable is the empty library, and each broken preset is dropped. */
export function parseMyPresets(raw: string | null): MyPresets {
  if (!raw) return EMPTY_MY_PRESETS;
  try {
    const o = JSON.parse(raw) as { v?: unknown; next?: unknown; list?: unknown };
    if (!o || o.v !== 1 || !Array.isArray(o.list)) return EMPTY_MY_PRESETS;
    const list: MyPreset[] = [];
    for (const x of o.list.slice(-MAX_MY_PRESETS)) {
      if (!x || typeof x !== 'object') continue;
      const { id, name, print } = x as { id?: unknown; name?: unknown; print?: unknown };
      const p = readPrint(print);
      if (typeof id !== 'string' || !/^my\d{1,6}$/.test(id) || typeof name !== 'string' || name.length === 0 || name.length > 64 || !p) continue;
      if (list.some((q) => q.id === id)) continue;
      list.push({ id, kind: printKind(p), name, print: named(p, name) });
    }
    const highest = list.reduce((m, q) => Math.max(m, Number(q.id.slice(2))), 0);
    const next = typeof o.next === 'number' && Number.isSafeInteger(o.next) && o.next > highest ? o.next : highest + 1;
    return { v: 1, next, list };
  } catch {
    return EMPTY_MY_PRESETS;
  }
}

export const serializeMyPresets = (s: MyPresets): string => JSON.stringify(s);

/** The library with a print saved (under its own name). Saving one the library already holds returns that one. */
export function savePreset(s: MyPresets, print: Print): { readonly presets: MyPresets; readonly preset: MyPreset } {
  const same = s.list.find((q) => body(q.print) === body(print));
  if (same) return { presets: s, preset: same };
  const preset: MyPreset = { id: `my${s.next}`, kind: printKind(print), name: nameOf(print), print };
  const list = [...s.list, preset].slice(-MAX_MY_PRESETS);
  return { presets: { v: 1, next: s.next + 1, list }, preset };
}

export const forgetPreset = (s: MyPresets, id: string): MyPresets => ({ ...s, list: s.list.filter((q) => q.id !== id) });

export function renamePreset(s: MyPresets, id: string, name: string): MyPresets {
  const n = name.trim().slice(0, 64);
  if (!n) return s;
  return { ...s, list: s.list.map((q) => (q.id === id ? { ...q, name: n, print: named(q.print, n) } : q)) };
}

export const presetsOf = (s: MyPresets, kind: PrintKind): readonly MyPreset[] => s.list.filter((q) => q.kind === kind);

const PREFIX: Readonly<Record<PrintKind, string>> = { part: 'SMX-PRT-', species: 'SMX-SPC-', light: 'SMX-LGT-', material: 'SMX-MAT-', sprite: 'SMX-PXD-', sound: 'SMX-SND-', harness: 'SMX-HRN-' };

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (code: string): string => {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** One preset as a code to pass to another player: its kind's prefix and the print's JSON, base64url. */
export const shareCode = (print: Print): string => `${PREFIX[printKind(print)]}${toBase64Url(JSON.stringify(print))}`;

/** The print in a share code, checked as a save is, or null for anything else (a typo, another game's code, junk). */
export function readShareCode(code: string): Print | null {
  const c = code.trim();
  const kind = (Object.keys(PREFIX) as PrintKind[]).find((k) => c.startsWith(PREFIX[k]));
  if (!kind || c.length > 4000) return null;
  try {
    const p = readPrint(JSON.parse(fromBase64Url(c.slice(PREFIX[kind].length))));
    return p && printKind(p) === kind ? p : null;
  } catch {
    return null;
  }
}
