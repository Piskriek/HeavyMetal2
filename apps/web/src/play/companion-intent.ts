/**
 * Companion spatial intent parsing (Plan 48, owner feedback 27 Oct): pure, deterministic, and
 * unit-tested — no naive `includes()` chains. A command is tokenized, scored against synonym
 * groups, and resolved into a world-space target against the player's LIVE pose.
 *
 * Player facing convention (the walker's, from play-scene teleport math):
 *   forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw).
 */

export interface CompanionPlayerPose {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/** Landmarks the game can currently locate for "go to the <place>" orders. */
export interface CompanionLandmarks {
  readonly gate?: { readonly x: number; readonly z: number };
  readonly rover?: { readonly x: number; readonly z: number };
  readonly bench?: { readonly x: number; readonly z: number };
}

export type CompanionIntent =
  | { readonly kind: 'hover-front' }
  | { readonly kind: 'hover-here' }
  | { readonly kind: 'come-front' }
  | { readonly kind: 'flank-right' }
  | { readonly kind: 'flank-left' }
  | { readonly kind: 'hold' }
  | { readonly kind: 'follow' }
  | { readonly kind: 'ground' }
  | { readonly kind: 'landmark'; readonly name: 'gate' | 'rover' | 'bench' }
  | { readonly kind: 'gesture'; readonly gesture: 'wave' | 'cheer' | 'point' }
  | { readonly kind: 'status' }
  | { readonly kind: 'chat' };

/** A resolved order: where to go, whether to float there, and the spoken confirmation. */
export interface CompanionOrder {
  readonly intent: CompanionIntent;
  readonly target: { readonly x: number; readonly z: number } | null;
  readonly hover: boolean;
  readonly hold: boolean;
  readonly follow: boolean;
  readonly reply: string;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();

/** True when any phrase of the group appears in the normalized text (multi-word phrases match as substrings, single words as whole tokens). */
const hits = (text: string, tokens: readonly string[], group: readonly string[]): boolean =>
  group.some((g) => (g.includes(' ') ? text.includes(g) : tokens.includes(g)));

const FLOAT = ['float', 'hover', 'fly', 'levitate', 'airborne', 'lift off', 'rise up', 'rise'];
const FRONT = ['front', 'ahead', 'before me', 'in front'];
// summons are phrases or the direct verb — a bare 'here' ("great work out here") is not a move order
const HERE = ['over here', 'to me', 'come here', 'my position', 'where i am', 'come'];
const RIGHT = ['right', 'starboard', 'flank'];
const LEFT = ['left', 'port side', 'port'];
const HOLD = ['stay', 'hold', 'wait', 'stop', 'guard', 'stand', 'remain', "don't move", 'halt'];
const FOLLOW = ['follow', 'formation', 'with me', 'on me', 'shadow me', 'escort me', 'tag along'];
const GROUND = ['land', 'ground', 'get down', 'walk', 'touch down'];
const GATE = ['gate', 'stargate', 'portal', 'ring'];
const ROVER = ['rover', 'vehicle', 'scout', 'hauler', 'crawler', 'truck', 'car'];
const BENCH = ['bench', 'workbench', 'table', 'drafting'];
const GO = ['go', 'go to', 'head', 'move', 'check', 'check on', 'inspect', 'over to', 'get to'];
const WAVE = ['wave', 'hello', 'hi', 'hey', 'greet', 'greetings'];
const CHEER = ['cheer', 'celebrate', 'great', 'good job', 'awesome', 'well done', 'nice work'];
const POINT = ['point'];
const STATUS = ['status', 'report', 'telemetry', 'diagnostics', 'sitrep', 'how are you'];

/**
 * Parses a spoken or typed command into an intent. Scored, not first-match: a float/hover word
 * plus any front/here word beats the walking variants, and a landmark word with a go-word beats
 * a bare mention of the landmark in chat.
 */
export function parseCompanionIntent(raw: string): CompanionIntent {
  const text = norm(raw);
  const tokens = text.split(' ');
  if (text.length === 0) return { kind: 'chat' };

  const wantsFloat = hits(text, tokens, FLOAT);
  const wantsFront = hits(text, tokens, FRONT);
  const wantsHere = hits(text, tokens, HERE);
  const wantsGo = hits(text, tokens, GO);

  // "land" / "walk" cancels hover before anything else reads as a float order
  if (hits(text, tokens, GROUND) && !wantsFloat) return { kind: 'ground' };

  if (wantsFloat) {
    if (wantsFront) return { kind: 'hover-front' };
    return { kind: 'hover-here' }; // "hover here", or a bare "float"/"hover" holds position in the air
  }

  if (hits(text, tokens, HOLD)) return { kind: 'hold' };
  if (hits(text, tokens, FOLLOW)) return { kind: 'follow' };

  if (hits(text, tokens, RIGHT) && (wantsGo || hits(text, tokens, ['my', 'side', 'flank']))) return { kind: 'flank-right' };
  if (hits(text, tokens, LEFT) && (wantsGo || hits(text, tokens, ['my', 'side']))) return { kind: 'flank-left' };

  if (hits(text, tokens, GATE) && wantsGo) return { kind: 'landmark', name: 'gate' };
  if (hits(text, tokens, ROVER) && wantsGo) return { kind: 'landmark', name: 'rover' };
  if (hits(text, tokens, BENCH) && wantsGo) return { kind: 'landmark', name: 'bench' };

  if (wantsFront || wantsHere) return { kind: 'come-front' };

  if (hits(text, tokens, STATUS)) return { kind: 'status' };
  if (hits(text, tokens, CHEER)) return { kind: 'gesture', gesture: 'cheer' };
  if (hits(text, tokens, WAVE)) return { kind: 'gesture', gesture: 'wave' };
  if (hits(text, tokens, POINT)) return { kind: 'gesture', gesture: 'point' };

  return { kind: 'chat' };
}

const fwd = (yaw: number): { x: number; z: number } => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
const right = (yaw: number): { x: number; z: number } => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

/**
 * Resolves an intent into a world-space order against the player's live pose. Distances per the
 * owner's spec: front 2.2 m hover / 2.0 m walk, flank 2.5 m out and 1.5 m back.
 */
export function resolveCompanionOrder(
  intent: CompanionIntent,
  player: CompanionPlayerPose,
  landmarks: CompanionLandmarks = {},
): CompanionOrder {
  const f = fwd(player.yaw);
  const r = right(player.yaw);
  const none = { target: null, hover: false, hold: false, follow: false };

  switch (intent.kind) {
    case 'hover-front':
      return {
        intent, ...none, hover: true,
        target: { x: player.x + f.x * 2.2, z: player.z + f.z * 2.2 },
        reply: 'Hovering 2.2 meters ahead at eye level, Lead Architect.',
      };
    case 'hover-here':
      return { intent, ...none, hover: true, hold: true, reply: 'Holding this position at eye level.' };
    case 'come-front':
      return {
        intent, ...none,
        target: { x: player.x + f.x * 2.0, z: player.z + f.z * 2.0 },
        reply: 'On my way — two meters ahead of you.',
      };
    case 'flank-right':
      return {
        intent, ...none,
        target: { x: player.x + r.x * 2.5 - f.x * 1.5, z: player.z + r.z * 2.5 - f.z * 1.5 },
        reply: 'Taking your right flank, 2.5 meters out.',
      };
    case 'flank-left':
      return {
        intent, ...none,
        target: { x: player.x - r.x * 2.5 - f.x * 1.5, z: player.z - r.z * 2.5 - f.z * 1.5 },
        reply: 'Taking your left flank, 2.5 meters out.',
      };
    case 'hold':
      return { intent, ...none, hold: true, reply: 'Holding position. Guard stance.' };
    case 'follow':
      return { intent, ...none, follow: true, reply: 'Back in formation on your shoulder.' };
    case 'ground':
      return { intent, ...none, hold: true, reply: 'Touching down.' };
    case 'landmark': {
      const mark = landmarks[intent.name];
      if (!mark) {
        return { intent, ...none, reply: `I don't have coordinates for the ${intent.name} from here.` };
      }
      return {
        intent, ...none, target: { x: mark.x, z: mark.z },
        reply: intent.name === 'gate' ? 'Moving to the Stargate.' : intent.name === 'rover' ? 'Heading to the rover.' : 'Checking the bench.',
      };
    }
    case 'gesture':
      return { intent, ...none, reply: intent.gesture === 'wave' ? 'Greetings, Lead Architect.' : intent.gesture === 'cheer' ? 'Ascent resonance confirmed!' : 'There.' };
    case 'status':
      return { intent, ...none, reply: '' }; // the caller fills live telemetry
    case 'chat':
      return { intent, ...none, reply: '' }; // the caller routes to the bridge or small talk
  }
}
