/**
 * Companion spatial intent parsing (Plan 48, owner feedback 27 Oct): pure, deterministic, and
 * unit-tested — no naive `includes()` chains. A command is tokenized, scored against synonym
 * groups, and resolved into a world-space target against the player's LIVE pose.
 *
 * Player facing convention (the walker's, from play-scene teleport math):
 *   forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw).
 */
import { parseScoutOrder, type ScoutCategory } from './companion-scout';

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
  // plan 49: orders about what the player pinged (the ping is the referent: "remove the chevrons" means on that)
  | { readonly kind: 'kit-strip-hazard' }
  | { readonly kind: 'kit-restore-hazard' }
  | { readonly kind: 'kit-save-default' }
  | { readonly kind: 'kit-reset' }
  | { readonly kind: 'ping-what' }
  // plan 50: the drone's standing orders, finds, and edit control
  | { readonly kind: 'combat-mode'; readonly mode: 'defend' | 'weapons-free' | 'hold-fire' }
  | { readonly kind: 'focus'; readonly target: 'ping' | 'nearest' | 'biggest' }
  | { readonly kind: 'cover'; readonly side: 'left' | 'right' | 'rear' }
  | { readonly kind: 'scout'; readonly category: ScoutCategory }
  | { readonly kind: 'recall' }
  | { readonly kind: 'undo' }
  | { readonly kind: 'keep' }
  | { readonly kind: 'mimic-apply' }
  | { readonly kind: 'bridge-game'; readonly name: string | null }
  | { readonly kind: 'bridge-stop' }
  | { readonly kind: 'relay-on' }
  | { readonly kind: 'relay-off' }
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
// plan 49: kit edits on the pinged thing
const HAZARD = ['chevron', 'chevrons', 'hazard', 'hazards', 'stripe', 'stripes', 'striping', 'black and yellow', 'yellow and black', 'caution', 'band', 'bands', 'tiger stripes'];
const REMOVE = ['remove', 'strip', 'delete', 'get rid of', 'take off', 'take away', 'lose', 'clear', 'no more', 'without', 'paint over', 'hide', 'drop'];
const RESTORE_VERB = ['put', 'bring', 'add', 'give'];
const DEFAULT_VERB = ['save', 'make', 'set', 'keep', 'store', 'write'];
const RESET = ['reset', 'revert', 'undo'];
const WHAT = ['what is this', 'what is that', "what's this", "what's that", 'what am i looking at', 'what am i pointing at', 'what did i ping', 'identify', 'what is it'];
// plan 51 wave 2: words around a game's name in "bridge the game I'm playing" that are not the name
const BRIDGE_FILLER = ['the', 'this', 'that', 'game', 'games', "i'm", 'im', 'i', 'am', 'playing', 'running', 'open', 'please', 'now', 'for', 'me', 'my', 'to', 'into', 'with', 'one', 'current', 'here'];

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

  // plan 49: kit edits first, so "the stripes on the ground" is an edit, not a landing order
  const hazard = hits(text, tokens, HAZARD);
  if (hazard && (tokens.includes('restore') || (tokens.includes('back') && hits(text, tokens, RESTORE_VERB)))) return { kind: 'kit-restore-hazard' };
  // "take the stripes off" splits its verb around the object, so take...off/away counts as a removal too
  const takeOff = tokens.includes('take') && (tokens.includes('off') || tokens.includes('away'));
  if (hazard && (hits(text, tokens, REMOVE) || takeOff)) return { kind: 'kit-strip-hazard' };
  if (tokens.includes('default') && hits(text, tokens, DEFAULT_VERB)) return { kind: 'kit-save-default' };
  // plan 50: edit control, then the drone's orders, before any movement word reads them as a move
  if (hits(text, tokens, ['undo', 'undo that', 'take that back', 'revert that', 'no not that'])) return { kind: 'undo' };
  // plan 51: the player puts a mimicked mechanic in force (before "keep", whose "apply it" would catch it)
  if (hits(text, tokens, ['mimic', 'mimicked', 'that mechanic', 'copy that movement', 'copied movement'])) {
    if (hits(text, tokens, ['apply', 'try', 'use', 'put', 'give me', 'switch to', 'load'])) return { kind: 'mimic-apply' };
  }
  if (hits(text, tokens, ['keep it', 'keep that', 'keep this', 'yes keep', 'apply it', 'commit it'])) return { kind: 'keep' };
  // plan 53: the input relay is the player's choice; this only opens the dialog (a box ticked and a word typed turn it on)
  if (/^(?:please )?(?:relay my (?:input|presses|keys)|send my (?:input|presses|keys) (?:to|into) the game|(?:turn on|start|enable) (?:the )?(?:input )?relay|input relay on)\b/.test(text)) return { kind: 'relay-on' };
  if (/^(?:please )?(?:(?:stop|end|turn off|disable) (?:the )?(?:input )?relay|relay off|input relay off)\b/.test(text)) return { kind: 'relay-off' };
  // plan 51 wave 2: ending the bridge puts back everything its live mimic changed
  if (/^(?:please )?(?:unbridge|unlink the game|(?:stop|end|close|drop|cut|kill) (?:the )?(?:bridge|bridging|game bridge|mimic|mimicking)|disconnect(?: from)?(?: the)? (?:game|bridge))\b/.test(text)) return { kind: 'bridge-stop' };
  // plan 51 wave 2: "bridge this game", "bridge counter strike", "hook into the game I'm playing": the name, if said
  const bridge = /^(?:please )?(?:bridge(?: to| into| with)?|hook into|connect to|link up with)\b(.*)$/.exec(text);
  if (bridge) {
    const name = (bridge[1] ?? '').split(' ').filter((w) => w && !BRIDGE_FILLER.includes(w)).join(' ');
    return { kind: 'bridge-game', name: name || null };
  }
  if (hits(text, tokens, RESET)) return { kind: 'kit-reset' };
  if (hits(text, tokens, ['hold fire', 'cease fire', 'stop shooting', "don't shoot", 'dont shoot', 'stand down'])) return { kind: 'combat-mode', mode: 'hold-fire' };
  if (hits(text, tokens, ['weapons free', 'open fire', 'fire at will', 'go loud', 'engage', 'attack everything', 'kill everything'])) return { kind: 'combat-mode', mode: 'weapons-free' };
  if (hits(text, tokens, ['defend me', 'protect me', 'guard me', 'keep me alive', 'watch my back'])) return { kind: 'combat-mode', mode: 'defend' };
  if (hits(text, tokens, ['cover'])) {
    if (hits(text, tokens, ['left'])) return { kind: 'cover', side: 'left' };
    if (hits(text, tokens, ['rear', 'back', 'six', 'behind'])) return { kind: 'cover', side: 'rear' };
    if (hits(text, tokens, ['right'])) return { kind: 'cover', side: 'right' };
  }
  const attackWord = hits(text, tokens, ['focus', 'kill', 'shoot', 'attack', 'take out', 'take down', 'target', 'hit']);
  if (attackWord) {
    if (hits(text, tokens, ['big one', 'biggest', 'brute', 'big guy', 'boss', 'tank'])) return { kind: 'focus', target: 'biggest' };
    if (hits(text, tokens, ['nearest', 'closest', 'nearby'])) return { kind: 'focus', target: 'nearest' };
    if (hits(text, tokens, ['that', 'this', 'it', 'him', 'them', 'there', 'pinged', 'marked'])) return { kind: 'focus', target: 'ping' };
  }
  if (hits(text, tokens, ['recall', 'come back', 'return to me', 'cancel that', 'cancel everything', 'regroup', 'fall back'])) return { kind: 'recall' };
  if (hits(text, tokens, WHAT)) return { kind: 'ping-what' };

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
  // plan 50: a find order, after the hold, follow and landmark words ("I need you to guard the gate" is a hold)
  const find = parseScoutOrder(raw);
  if (find) return { kind: 'scout', category: find };

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
    case 'kit-strip-hazard':
    case 'kit-restore-hazard':
    case 'kit-save-default':
    case 'kit-reset':
    case 'ping-what':
    case 'combat-mode':
    case 'focus':
    case 'cover':
    case 'scout':
    case 'recall':
    case 'undo':
    case 'keep':
    case 'mimic-apply':
    case 'bridge-game':
    case 'bridge-stop':
    case 'relay-on':
    case 'relay-off':
      return { intent, ...none, reply: '' }; // the caller runs it (the kit edit, the order or the find) and reports it
    case 'chat':
      return { intent, ...none, reply: '' }; // the caller routes to the bridge or small talk
  }
}
