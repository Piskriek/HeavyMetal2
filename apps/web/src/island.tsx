import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cmd, type Params, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { Animator, type MoveSet } from '@hm/anim';
import { V3_MODES, V3_TABS, levelOfMode, modeOfLevel, nextMode, v3Button, v3Slots, v3TabForKey, v3TabName, type V3Button, type V3Drive, type V3Found, type V3Mode, type V3Slider, type V3Source, type V3SubTool, type V3Tab, WIRE_DOS, PHYS_ITEMS, PHYS_WAYS, CHAR_BRAINS, CHAR_WAYS, isCharBrain, SOUND_WAYS, isAmbience, EFFECT_ICONS, EFFECT_WAYS, LOGIC_PRESETS, LOGIC_WAYS, LogicRunner, normalizeRule, ruleSentence, PAINTS, THINGS, shakeById, shakeOffset, toolById, type ShakePreset, type TabId, type ToolPreset } from '@hm/buildkit';
import type { Effect } from '@hm/tutorial';
import { createThreeRenderer, SurfaceArray, tileSizeFor, RACING_SURFACES, SETMIX_FILE, SETMIX_SURFACES, SETMIX_VOXEL, SURF, type ThreeRenderer } from '@hm/render';
import { evaluateGraph, tileBytes, type TexGraph } from '@hm/texgraph';
import { cropTerrain, heightAt, type Terrain } from '@hm/terrain';
import { createAdaptiveQuality, guessQuality, parseQuality, type AdaptiveQuality, type DeviceFacts, type FpsTarget, type Quality } from '@hm/game';
import { noteGpu, powerPreferenceOf, showTier, type GpuChoice, type Profile } from './shell/profile';
import { SettingsBody } from './shell/settings-body';
import type { SfxId } from '@hm/audio';
import { ensureLightPreset, followLighting, pickLook } from './look';
import { decorInstances } from './maker/dress';
import type { MakerScene } from './maker/scene';
import { placementsOf } from './maker/models-panel';
import { focusTargetOf } from './maker/focus';
import { fx } from './maker/feedback';
import { BuildController, type Aim, type Selected } from './build/build-controller';
import { GizmoControl, gizmoModeFor, type GizmoTarget } from './build/gizmo-control';
import { EffectsRuntime, type PlacedEffect } from './build/effects-runtime';
import { SoundscapeRuntime, zoneOf, emitterOf, type PlacedSound } from './build/soundscape-runtime';
import { SoundSpotsPanel } from './build/sound-spots-panel';
import { flicker, pickLights, presetById as lampById } from '@hm/lightplace';
import { AMBIENCES } from '@hm/soundscape';
import { audio } from './maker/feedback';
import { PARTICLE_PRESETS } from '@hm/particles';
import { Crosshair, ModeBar } from './build/hud';
import { V3Hud, type V3OptionItem } from './build/v3-hud';
import { WireGraph } from './build/wire-graph';
import { PLANTS } from '@hm/worldrules';
import { ANIM_WAYS, CAMERA_WAYS, animOf, catalog, lookOf, soundName, surfaceColours, toolOf, type ActivityInfo, type CatalogItem } from './build/catalog';
import { SFX_IDS } from '@hm/audio';
import { PaletteStrip, type StripItem } from './build/palette-strip';
import { LayersPanel } from './build/layers';
import { SurfaceEditor } from './build/surface-editor';
import { LogicPanel } from './build/logic-panel';
import { EffectsPanel } from './build/effects-panel';
import { TextureBench } from './build/texture-bench';
import { TEX_ANIMS, draftColours, draftFromTile, draftToTile, newHistory, type DraftHistory, type TexDraft } from './build/texture-draft';
import { decodeBlob, encodeWebp, loadTextures, saveTexture } from './build/texture-store';
import type { StampKind } from '@hm/terrainops';
import { LIGHT_WAYS, isLightWay, applyLightWay } from './build/light-ways';
import { avatarRigged, voxelModelById } from './build/cards';
import { encodeModel } from '@hm/voxel';
import { rulesOf } from './world';
import { CharactersRuntime, type PlacedChar } from './build/characters-runtime';
import { PhysicsRuntime, type PhysThing } from './build/physics-runtime';
import { carvePath, pathPreview, rainOn, ROAD_SURFACE, RIVER_SURFACE } from './build/paths';
import { WiresRuntime, type PlacedWire, type PlacedZone, type WireEffect } from './build/wires-runtime';
import { boxSelect, type Item as SelItem } from '@hm/selectset';
import { SlowMo, orbitShot, sampleTrack, trackDuration, type CamTrack } from '@hm/camtrack';
import { walkerAt, type WalkPath } from '@hm/walkpath';
import { cellAt, hitThings, recolour, sculptBlocks, type V3 as HitV3 } from './build/voxel-hit';
import type { VoxelModel } from '@hm/voxel';
import { decodeModel } from '@hm/voxel';
import { CharactersPanel } from './build/characters-panel';
import { kindDef } from './avatar/accessories';
import { EditorFor, MovesEditor, PlantEditor, SpriteEditor, WorldRulesEditor, type EditorActions } from './build/editors';
import { FloatingWindow, useWindows } from './build/windows';
import { editTool, holdWay, pickPalette, player, putInSlot, resetV3Sliders, setActivities, setLevel, setMode, setSlot, setTab, setV3Filter, setV3Preset, setV3Slider, setV3Slot, setV3Tab, setView, usePlayer, wearLook, type PlayerState } from './build/player';
import { spriteOf } from './build/sprites';
import { ShareDialog } from './share/share-dialog';
import type { ShareKind } from './share/shares';
import type { Preview } from './build/catalog';
import { mapBundle, saveMap } from './maker/storage';
import { spriteDef } from './build/sprites';
import { TourCard } from './tutorial/tour-card';
import { startTour, stopTour, tourEvent, tourReplay, tourTick, useTour } from './tutorial/tour';
import { captureMouse, lookFilter } from './shell/capture-mouse';
import { AvatarDock } from './avatar/avatar-dock';
import { LOOKS as AVATAR_LOOKS, type AvatarLook } from '@hm/avatarlook';

/**
 * My Island. Walk mode: you are the goblin (third person, or first person with V); the mouse is captured for looking and the crosshair aims.
 * Build HUD (grown-up switch on): the hotbar of the owner's spec V3 (build/v3-hud.tsx, docs/HOTBAR_V3_SPEC.md): F1..F12 pick a tab (Shift+F1
 * and Shift+F2 for F11 and F12), 1..9 or the wheel pick a slot, left click uses it, right click does the opposite, the backtick switches
 * Game, Simplified and Advanced, Tab frees the mouse for the sliders, / finds a tool. Studio mode (B, or the button top right): no goblin, fly with W A S D, Space and C, look with the right mouse
 * button, the mouse stays free, tools act where the cursor points, every setting opens in a movable window, F focuses on a thing, H hides
 * the rest. Esc closes one thing at a time and then opens the jump menu.
 */
let lastPose: { px: number; pz: number; face: number; camYaw: number } | null = null; // where the goblin stood when the island was last left
const SEA = 0.35; // lower ground than this is water: the goblin stays on land

/** The palette's surfaces for the ways to paint. */
// the palette shows each surface's own tile (SetMix's graph-made set), its colours until the picture loads
/** Lights' palette: the looks. */
/** Paint a thing (F2): toy colours. */
const TINTS: readonly { readonly id: string; readonly name: string; readonly rgb: [number, number, number] }[] = [
  { id: 'red', name: 'Red', rgb: [214, 62, 56] }, { id: 'orange', name: 'Orange', rgb: [238, 128, 46] }, { id: 'yellow', name: 'Yellow', rgb: [242, 196, 54] },
  { id: 'lime', name: 'Lime', rgb: [150, 206, 64] }, { id: 'green', name: 'Green', rgb: [62, 150, 82] }, { id: 'teal', name: 'Teal', rgb: [40, 160, 160] },
  { id: 'blue', name: 'Blue', rgb: [58, 104, 214] }, { id: 'purple', name: 'Purple', rgb: [128, 82, 200] }, { id: 'pink', name: 'Pink', rgb: [236, 120, 170] },
  { id: 'white', name: 'White', rgb: [240, 238, 232] }, { id: 'grey', name: 'Grey', rgb: [130, 128, 124] }, { id: 'black', name: 'Black', rgb: [38, 36, 40] },
];
/** A sculpt tool takes its shape (Stamp) from the palette and the toggles from beside the hotbar. */
const withSculptPalette = (tool: ToolPreset, s: { readonly palette: Readonly<Partial<Record<TabId, string>>>; readonly sculptToggles: { readonly mirror: boolean; readonly smoothAfter: boolean } }): ToolPreset =>
  tool.tab === 'sculpt' ? { ...tool, stampShape: s.palette.sculpt ?? 'mound', mirror: s.sculptToggles.mirror, smoothAfter: s.sculptToggles.smoothAfter }
    : tool.action === 'things' ? { ...tool, model: s.palette.things ?? 'palm' } : tool;

/** The V3 button in hand (docs/HOTBAR_V3_SPEC.md): the mode, the tab, its slot, the preset picked in it, and Simplified's sub-tool. */
interface V3Now { readonly mode: V3Mode; readonly t: V3Tab; readonly tab: number; readonly slot: number; readonly preset: number; readonly slotId: string; readonly button: V3Button | null; readonly sub: V3SubTool | null }
function v3Now(s: PlayerState): V3Now {
  const mode = modeOfLevel(s.level), tab = s.v3.tab, t = V3_TABS[tab] ?? V3_TABS[0]!;
  const slot = s.v3.slots[mode][tab] ?? 0, slotId = v3Slots(t, mode)[slot]?.id ?? '';
  const preset = s.v3.presets[`${mode}:${t.key}:${slotId}`] ?? (mode === 'advanced' ? -1 : 0);
  return { mode, t, tab, slot, preset, slotId, button: v3Button(t, mode, slot, preset), sub: mode === 'simplified' ? t.simplified.subtools[slot] ?? null : null };
}
/** A Simplified slider's value for what it drives, or null when the tool in hand has no such slider (then the tool's own value stands). */
function v3Drive(s: PlayerState, d: V3Drive): number | null {
  const n = v3Now(s);
  const sl = n.sub?.sliders.find((x) => x.drives === d);
  if (!n.sub || !sl) return null;
  return s.v3.sliders[`${n.t.key}:${n.sub.id}:${sl.id}`] ?? sl.value ?? null;
}
/** Where a button lives in a mode: by its id, else the first button of the mode that does the same (the tour hands over Game Mode's). */
function v3Locate(mode: V3Mode, id: string): { tab: number; slot: number; preset: number } | null {
  const all = (t: V3Tab): V3Button[] => [...t.game.presets, ...t.simplified.subtools.flatMap((x) => x.presets), ...t.advanced.tools];
  const same = V3_TABS.flatMap(all).find((b) => b.id === id)?.bind;
  for (const pass of [0, 1]) {
    const hit = (b: V3Button): boolean => (pass === 0 ? b.id === id : !!same && !b.bind.todo && b.bind.way === same.way && (b.bind.palette?.things ?? '') === (same.palette?.things ?? ''));
    for (let ti = 0; ti < V3_TABS.length; ti++) {
      const t = V3_TABS[ti]!;
      if (mode === 'game') { const i = t.game.presets.findIndex(hit); if (i >= 0) return { tab: ti, slot: i, preset: 0 }; }
      else if (mode === 'simplified') { for (let i = 0; i < t.simplified.subtools.length; i++) { const j = t.simplified.subtools[i]!.presets.findIndex(hit); if (j >= 0) return { tab: ti, slot: i, preset: j }; } }
      else { const i = t.advanced.tools.findIndex(hit); if (i >= 0) return { tab: ti, slot: i, preset: -1 }; }
    }
  }
  return null;
}
/** The internal tools a way works through (Clay Plump and Scoop carve things, and raise or lower the ground). */
const toolsOfWay = (way: string): string[] => (way === 'v3-clay-plump' ? ['things-carve', 'raise'] : way === 'v3-clay-scoop' ? ['things-carve', 'lower'] : toolById(way) ? [way] : []);
/** A colour of Paint a thing: a toy colour, a picked one (c-rrggbb), or a bright new one every time (rainbow). */
function tintRgb(id: string | undefined): [number, number, number] {
  if (id && /^c-[0-9a-f]{6}$/.test(id)) { const n = parseInt(id.slice(2), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  if (id === 'rainbow') {
    // a saturated hue at random: hsl(h, 85%, 55%)
    const h = Math.random() * 6, c = 0.85 * (1 - Math.abs(2 * 0.55 - 1)), x = c * (1 - Math.abs((h % 2) - 1)), m = 0.55 - c / 2;
    const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  return (TINTS.find((t) => t.id === id) ?? TINTS[0]!).rgb;
}
/** Game Mode's Boombox: the funny sounds it picks from. */
const FUNNY: readonly SfxId[] = ['jump', 'boost', 'splash', 'item-pickup', 'oil', 'respawn', 'freeze', 'snap'];
/** Reduce motion (the system setting): no screen shakes. */
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAINT_ITEMS: readonly StripItem[] = PAINTS.map((s) => ({ id: String(s.id), name: s.name, preview: SETMIX_FILE[s.id] ? { kind: 'image', url: `textures/setmix/${SETMIX_FILE[s.id]}.webp`, colors: surfaceColours(s.id) } : { kind: 'swatch', colors: surfaceColours(s.id) } }));

const WIN = {
  presets: { w: 560, h: 620 },
  editor: { w: 380, h: 560 },
};

export function IslandWalk(props: {
  readonly rt: Runtime; readonly scene: MakerScene; readonly intro?: boolean; readonly level?: 'goblin' | 'island'; readonly onMenuChange?: (open: boolean) => void; readonly grownUp?: boolean;
  readonly skin?: 'flat' | 'pbr'; readonly onSkin?: (skin: 'flat' | 'pbr') => void; readonly quality?: 'auto' | Quality;
  /** The style: voxel blocks or the painted ground (the Flat / PBR detail is `skin`). */
  readonly style?: 'voxel' | 'painted'; readonly onStyle?: (style: 'voxel' | 'painted') => void;
  /** Whose ground tiles: SetMix's graph-made set (the default) or Goblin Racing's image set. */
  readonly ground?: 'setmix' | 'racing';
  /** Which graphics chip to ask for (Settings); read when the view opens. */
  readonly gpu?: GpuChoice;
  /** The frame rate auto quality aims for (Settings): 15 prettier, 60 smoother. */
  readonly fpsTarget?: FpsTarget;
  /** Only this element's area of the view is seen (the SetMix home's window): the renderer shades just that part. */
  readonly clipTo?: RefObject<HTMLElement | null>;
  /** Called once the view has drawn its first frames (a preview window shows its loading bar until then). */
  readonly onReady?: () => void;
  /** Showcase only: where on the screen (0..1 across and down) the goblin should stand, when only part of the view is seen (the SetMix home's window). */
  readonly frame?: { readonly x: number; readonly y: number };
  /** The player's own changes to the graphics preset, on top of whichever tier draws (Settings). */
  readonly graphics?: Params;
  /** The whole profile and its updater, for the Settings window (Esc, Settings). */
  readonly profile?: Profile; readonly onProfile?: (fn: (p: Profile) => Profile) => void;
  readonly onReplayTour?: () => void; readonly onResetProgress?: () => void;
  readonly activities?: readonly ActivityInfo[]; readonly onActivity?: (id: string) => void;
  /** The tour's thank-you (in-game credits, never money). */
  readonly onCredits?: (amount: number) => void;
  /** Mouse speed, invert, field of view (Settings). */
  readonly controls?: { readonly sensitivity: number; readonly invertY: boolean; readonly fov: number };
  /** Behind the main menu: no HUD, no controls, the camera circles your island and your goblin. When it turns off the camera flies down to the goblin. */
  readonly showcase?: boolean;
  readonly onActivities: () => void; readonly onIslands?: () => void; readonly onHub: () => void; readonly onMainMenu: () => void; readonly onIntroDone?: () => void;
}): ReactElement {
  const { rt, onActivities, onIslands, onHub, onMainMenu, onIntroDone, onMenuChange } = props;
  const host = useRef<HTMLDivElement>(null);
  const introRef = useRef(props.intro === true);
  const terrainView = useRef<{ setLook: (l: { skin?: 'flat' | 'pbr'; detail?: boolean }) => void; tick: (seconds: number) => void } | null>(null);
  const skin = props.skin ?? 'flat';
  const style = props.style ?? 'voxel';
  // the renderer's look: its skin is the style (voxel blocks or painted), its detail the Flat / PBR buttons
  // PBR always draws the smooth ground (owner, 2026-10-03: "the pbr mode should use the smooth meshes ... texturing in blocks might work for
  // voxel but won't for pbr"); the voxel blocks are the Flat look of the voxel style
  const groundLook = { skin: style === 'voxel' && skin !== 'pbr' ? 'flat' as const : 'pbr' as const, detail: skin === 'pbr' };
  const lookRef = useRef(groundLook);
  lookRef.current = groundLook;
  useEffect(() => { terrainView.current?.setLook(lookRef.current); }, [skin, style]);
  const controlsRef = useRef(props.controls ?? { sensitivity: 1, invertY: false, fov: 75 });
  controlsRef.current = props.controls ?? { sensitivity: 1, invertY: false, fov: 75 };
  const qualityRef = useRef(props.quality ?? 'auto');
  qualityRef.current = props.quality ?? 'auto';
  const ownGraphicsRef = useRef<Params>(props.graphics ?? {});
  ownGraphicsRef.current = props.graphics ?? {};
  const clipRef = useRef(props.clipTo);
  clipRef.current = props.clipTo;
  const frameRef = useRef(props.frame);
  frameRef.current = props.frame;
  const fpsRef = useRef<FpsTarget>(props.fpsTarget ?? 60);
  fpsRef.current = props.fpsTarget ?? 60;
  const graphicsRef = useRef<{ readonly renderer: ThreeRenderer; readonly device: DeviceFacts; adaptive: AdaptiveQuality } | null>(null);
  // a change in Settings applies at once: a chosen tier is set; switching to auto starts from the guess, a new target keeps the tier it is on
  const modeRef = useRef(props.quality ?? 'auto');
  useEffect(() => {
    const g = graphicsRef.current;
    const mode = props.quality ?? 'auto';
    const wasAuto = parseQuality(modeRef.current) === null;
    modeRef.current = mode;
    if (!g) return;
    const chosen = parseQuality(mode);
    g.adaptive = createAdaptiveQuality(chosen ?? (wasAuto ? g.adaptive.current : guessQuality(g.device)), { locked: chosen !== null, targetFps: props.fpsTarget ?? 60 });
    showTier(g.renderer, g.adaptive.current, ownGraphicsRef.current);
  }, [props.quality, props.fpsTarget, props.graphics]);
  const activities = useMemo(() => props.activities ?? [], [props.activities]);
  useEffect(() => { setActivities(activities); }, [activities]);

  const p = usePlayer();
  const [menu, setMenu] = useState(false);
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState('');
  /**
   * The palette film strip (top middle): Tab opens and closes it like a window (owner: "a toggle, so it doesn't hide when you let go"), and
   * opening it frees the mouse to click it and the buttons round it (the PBR button, the presets); closing it gives the mouse back to looking.
   */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusId, setFocusId] = useState<PresetId | null>(null);
  const [isolateId, setIsolateId] = useState<PresetId | null>(null);
  const win = useWindows();
  const buildOn = props.grownUp !== false;
  const level = props.level ?? 'goblin';
  const scene = props.scene;
  const lightingRef = useRef<{ refresh: () => void } | null>(null);
  const items = useMemo(() => catalog(p.tab, p, activities), [p, activities]);
  const byId = useMemo(() => new Map(items.map((c) => [c.id, c])), [items]);
  const row: (CatalogItem | null)[] = p.hotbars[p.tab].map((id) => (id ? byId.get(id) ?? null : null));
  const heldItem = row[p.slots[p.tab]] ?? null;
  const v3 = v3Now(p);
  const [findOpen, setFindOpen] = useState(false);
  const showcase = props.showcase === true;
  const readyRef = useRef(props.onReady);
  readyRef.current = props.onReady;
  /** Avatar mode: the Avatar tab (P) turns the camera to face your avatar, with your characters and its presets beside it (E11). */
  const avatarMode = p.tab === 'avatar' && level === 'goblin' && !showcase;
  const live = useRef({ menu, buildOn, level, items, focusId, isolateId, win, showcase, avatarMode, paletteOpen });
  live.current = { menu, buildOn, level, items, focusId, isolateId, win, showcase, avatarMode, paletteOpen };
  /** The tab you were on before avatar mode: Done, Esc or P again goes back to it. */
  const beforeAvatar = useRef<TabId>('select');
  const landRef = useRef<(() => void) | null>(null);
  const wasShowcase = useRef(showcase);
  // leaving the menu: fly down from the orbit to the goblin
  useEffect(() => { if (wasShowcase.current && !showcase) landRef.current?.(); wasShowcase.current = showcase; }, [showcase]);
  useEffect(() => { onMenuChange?.(menu); if (menu) tourEvent('opened-menu'); }, [menu]); // eslint-disable-line react-hooks/exhaustive-deps
  const noteTimer = useRef(0);
  const say = useCallback((t: string) => { setNote(t); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2200); }, []);
  const api = useRef<{ lock: () => void; unlock: () => void; undo: () => void; redo: () => void; playAnim: (id: string) => void; setAvatarLook: () => void; previewLook: (look: AvatarLook | null) => void; refreshModels: () => void; pick: (tab: TabId, id: string) => void; reveal: () => void; groundPeek: () => Terrain | null;
    /** Layers: carry a thing with the Move tool, place one where you look, show or hide the plants. */
    carry: (ref: PresetId) => void; addThing: (modelId: string) => PresetId | null; showPlants: (on: boolean) => void;
    /** The surface editor: draw surface `id` from this texture graph (SetMix's graph-made ground only; false for the image set). */
    setSurfaceLook: (id: number, graph: TexGraph, blocks?: boolean) => boolean;
    /** Texture mode: a surface's tile as drawn now, put one back, make it move. */
    readTile: (id: number) => { colour: Uint8Array; pbr: Uint8Array; size: number } | null; putTile: (id: number, colour: Uint8Array, maps: Uint8Array) => void;
    setAnim: (id: number, v: readonly [number, number, number, number]) => void } | null>(null);
  /** A small copy of the ground you are looking at (the tool presets draw on it). */
  // the island overview needs the cursor: let go of the mouse when the level goes up
  useEffect(() => { if (level === 'island') api.current?.unlock(); lightingRef.current?.refresh(); }, [level]);
  // studio keeps the mouse free; walking takes it back when you click the world
  useEffect(() => { if (p.mode === 'studio') api.current?.unlock(); }, [p.mode]);
  useEffect(() => { api.current?.setAvatarLook(); }, [p.lookId, p.looks]);
  useEffect(() => { applyV3(false, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // entering avatar mode: the mouse is free to click the dock, and the studio (which has no avatar) goes back to walking
  useEffect(() => { if (!avatarMode) return; api.current?.unlock(); if (player().mode === 'studio') setMode('walk'); tourEvent('opened-avatar'); }, [avatarMode]);
  useEffect(() => { api.current?.refreshModels(); }, [isolateId]);
  // every change on the island saves itself a moment later (lighting, world rules, plants, sounds, redo: not only the tools)
  useEffect(() => {
    if (showcase) return;
    let t = 0;
    const off = rt.commands.subscribe(() => { window.clearTimeout(t); t = window.setTimeout(() => { saveMap(rt, scene.sceneId); }, 1200); });
    return () => { off(); window.clearTimeout(t); };
  }, [rt, scene, showcase]);

  // the tour: runs on your island (not behind the main menu); its effects are carried out here
  const tourOn = !showcase && level === 'goblin';
  const tourView = useTour();
  const [revealing, setRevealing] = useState(0);
  useEffect(() => {
    if (!tourOn) return;
    const apply = (e: Effect): void => {
      const a = e.action;
      switch (a.type) {
        case 'say': say(a.text); break;
        case 'give': {
          // the tour hands over a V3 button (or one that does the same in this mode)
          const mode = modeOfLevel(player().level), at = v3Locate(mode, a.item);
          if (at) { const t = V3_TABS[at.tab]!; setV3Tab(at.tab); setV3Slot(mode, at.tab, at.slot); const id = v3Slots(t, mode)[at.slot]?.id; if (id && mode !== 'game') setV3Preset(`${mode}:${t.key}:${id}`, at.preset); applyV3(false); break; }
          const tool = toolById(a.item);
          if (!tool) break;
          const s = player();
          setTab(tool.tab); putInSlot(tool.tab, s.slots[tool.tab], tool.id);
          break;
        }
        case 'selectSlot': { const s = player(); setSlot(s.tab, a.slot); break; }
        // the reveal: the full ground (the painted style with its detail)
        case 'setSkin': props.onSkin?.(a.skin); if (a.skin === 'pbr') props.onStyle?.('painted'); break;
        case 'reveal': setRevealing(Date.now()); api.current?.reveal(); break;
        case 'credits': props.onCredits?.(a.amount); say(`+${a.amount} credits`); break;
      }
    };
    startTour(buildOn ? 'build' : 'walk', apply);
    return () => stopTour();
  }, [tourOn, buildOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const edits = `${JSON.stringify(p.tools).length}:${JSON.stringify(p.anims).length}:${JSON.stringify(p.sprites).length}:${p.looks.length}`;
  const lastEdits = useRef(edits);
  useEffect(() => { if (lastEdits.current !== edits) tourEvent('edited'); lastEdits.current = edits; }, [edits]);
  useEffect(() => { if (!revealing) return; const t = window.setTimeout(() => setRevealing(0), 1600); return () => window.clearTimeout(t); }, [revealing]);

  // a tool's 'pick' plugs play when it comes into your hand (not when the island first opens)
  const heldKey = `${p.tab}:${heldItem?.id ?? ''}`;
  const lastHeld = useRef(heldKey);
  useEffect(() => { if (lastHeld.current !== heldKey && heldItem) api.current?.pick(p.tab, heldItem.id); lastHeld.current = heldKey; }, [heldKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** What happens when a slot of a tab that is not a tool gets picked: lights change, moves play, cameras switch, looks are worn. */
  const applyNow = useCallback((tab: TabId, id: string | null) => {
    if (!id) return;
    const pl = player();
    if (tab === 'lights') { if (isLightWay(id)) say(`${byIdName(tab, id)}: ${LIGHT_WAYS.find((w) => w.id === id)?.left ?? ''} with the left button`); else { pickLook(rt, scene.sceneId, id); say(`Light: ${byIdName(tab, id)}`); } }
    else if (tab === 'animate') { if (!id.startsWith('anim-')) api.current?.playAnim(id); }
    else if (tab === 'sound') { if (!id.startsWith('sound-')) fx(id as SfxId); }
    else if (tab === 'avatar') { wearLook(id); say(`Wearing ${lookOf(pl, id).name}`); }
    else if (tab === 'camera') { if (!id.startsWith('cam-')) switchCamera(id); }
  }, [rt, scene.sceneId, say]); // eslint-disable-line react-hooks/exhaustive-deps
  const byIdName = (tab: TabId, id: string): string => catalog(tab, player(), activities).find((c) => c.id === id)?.name ?? id;
  const switchCamera = (id: string): void => {
    if (id === 'studio') { setMode('studio'); return; }
    if (id === 'island') { say('Esc, then the up arrow in the bar, shows the whole island'); return; }
    setMode('walk'); setView(id === 'first' ? 'first' : 'third');
  };
  const leaveAvatar = (): void => { setTab(beforeAvatar.current === 'avatar' ? 'select' : beforeAvatar.current); fx('ui-toggle', { volume: 0.5 }); };
  const leaveAvatarRef = useRef(leaveAvatar);
  leaveAvatarRef.current = leaveAvatar;
  /** The V3 hotbar: put the button in hand's binding in hand (its internal tab, way and palette picks) and, unless only syncing, do what picking it does. */
  const applyV3 = (announce = true, act = true): void => {
    const n = v3Now(player());
    const b = n.button;
    if (!b) return;
    if (b.bind.todo) { holdWay(b.bind.tab, null); if (announce) say(`${b.name}: coming`); return; }
    holdWay(b.bind.tab, b.bind.way, b.bind.palette ?? {});
    // Simplified's sliders that set the tool's own size and strength
    if (n.sub) for (const sl of n.sub.sliders) { const v = player().v3.sliders[`${n.t.key}:${n.sub.id}:${sl.id}`]; if (v !== undefined) driveTool(sl, v); }
    if (!act) return;
    const way = b.bind.way;
    if (way === 'light-look' && b.bind.palette?.lights) pickLook(rt, scene.sceneId, b.bind.palette.lights);
    else if (way === 'logic-graph') openWireGraph();
    else if (b.bind.tab === 'animate' && !way.startsWith('anim-') && !way.startsWith('v3-')) api.current?.playAnim(way);
    else if (b.bind.tab === 'camera' && !way.startsWith('cam-') && !way.startsWith('v3-')) switchCamera(way);
  };
  /** A slider that changes the tool in hand (size, strength, colour): the tools its way works through take the value. */
  const driveTool = (sl: V3Slider, v: number): void => {
    const s = player(), way = s.hotbars[s.tab][s.slots[s.tab]] ?? '';
    for (const id of toolsOfWay(way)) {
      if (sl.drives === 'tool-size') editTool(id, 'size', Math.max(0.1, v));
      else if (sl.drives === 'tool-width') editTool(id, 'size', Math.min(30, Math.max(0.5, v / 2)));
      else if (sl.drives === 'tool-strength' || sl.drives === 'density') editTool(id, 'strength', Math.min(1, Math.max(0.01, v / 100)));
    }
    if (sl.drives === 'tint-colour') pickPalette('tint', `c-${Math.round(v).toString(16).padStart(6, '0')}`);
  };
  const pickV3Tab = (i: number): void => { if (i === player().v3.tab && !live.current.avatarMode) return; setV3Tab(i); applyV3(false); fx('tool-switch', { volume: 0.5 }); tourEvent('tab-selected'); };
  const pickV3Slot = (i: number): void => {
    const n = v3Now(player());
    if (i < 0 || i >= v3Slots(n.t, n.mode).length) return;
    setV3Slot(n.mode, n.tab, i); applyV3(); fx('tool-switch', { volume: 0.5 }); tourEvent('slot-selected');
  };
  const pickV3Preset = (i: number): void => {
    const n = v3Now(player());
    if (!n.slotId) return;
    setV3Preset(`${n.mode}:${n.t.key}:${n.slotId}`, i); applyV3(); fx('select', { volume: 0.5 });
  };
  const pickV3Mode = (m: V3Mode): void => {
    if (modeOfLevel(player().level) === m) return;
    setLevel(levelOfMode(m)); applyV3(false); fx('ui-toggle', { volume: 0.5 }); tourEvent('mode-switched');
    say(`${V3_MODES.find((x) => x.id === m)?.name ?? m} Mode`);
  };
  const pickFound = (f: V3Found): void => {
    const m = modeOfLevel(player().level), t = V3_TABS[f.tab]!;
    setV3Tab(f.tab); setV3Slot(m, f.tab, f.slot);
    const id = v3Slots(t, m)[f.slot]?.id;
    if (id && m !== 'game') setV3Preset(`${m}:${t.key}:${id}`, f.preset);
    applyV3(); fx('tool-switch', { volume: 0.5 });
  };
  const onV3Slider = (sl: V3Slider, key: string, v: number, done: boolean): void => {
    setV3Slider(key, v);
    driveTool(sl, v);
    if (done && sl.drives === 'hour') rt.commands.execute(cmd.setParam(`${scene.sceneId}.timeOfDay`, Math.round(v * 4) / 4, 'Time of day'));
    if (done && sl.drives === 'clouds') { const ref = ensureLightPreset(rt, scene.sceneId); rt.commands.execute(cmd.setParam(`${ref}.skyClouds`, Math.round(v) / 100, 'Cloudiness')); }
    if (done) tourEvent('edited');
  };
  const onV3Reset = (prefix: string, sub: V3SubTool): void => { resetV3Sliders(prefix); for (const sl of sub.sliders) if (sl.drives && sl.value !== undefined) driveTool(sl, sl.value); fx('ui-click', { volume: 0.4 }); };
  /** The lists a tool picks from (Advanced's options, Game's Prop Box). */
  const v3Options = (source: V3Source): readonly V3OptionItem[] => {
    const icon = (i: string): Preview => ({ kind: 'icon', icon: i });
    switch (source) {
      case 'blocks': return THINGS.filter((t) => t.id.startsWith('block-')).map((t) => ({ id: t.id, name: t.name, preview: icon(t.icon) }));
      case 'props': return THINGS.filter((t) => !t.id.startsWith('block-')).map((t) => ({ id: t.id, name: t.name, preview: icon(t.icon) }));
      case 'plants': return THINGS.filter((t) => ['palm', 'bush', 'rock', 'flowers', 'grass-clump'].includes(t.id)).map((t) => ({ id: t.id, name: t.name, preview: icon(t.icon) }));
      case 'sounds': return SFX_IDS.map((id) => ({ id, name: soundName(id), preview: icon('Volume2') }));
      case 'effects': return PARTICLE_PRESETS.map((e) => ({ id: e.id, name: e.name, preview: icon(EFFECT_ICONS[e.id] ?? 'Sparkles') }));
      case 'paints': return PAINT_ITEMS;
      case 'tints': return TINTS.map((t) => ({ id: t.id, name: t.name, preview: { kind: 'swatch', colors: [`rgb(${t.rgb.join(',')})`] } }));
      case 'brains': return CHAR_BRAINS.map((b) => ({ id: b.id, name: b.name, preview: icon(b.icon) }));
      case 'wires': return WIRE_DOS.map((d) => ({ id: d.id, name: d.name, preview: icon(d.icon) }));
    }
  };
  const openWireGraph = (): void => { api.current?.unlock(); live.current.win.open('wiregraph', 'Visual Wire Graph', { x: 60, y: 80, w: 520, h: 470 }); };
  const openWireGraphRef = useRef(openWireGraph);
  openWireGraphRef.current = openWireGraph;


  const actions: EditorActions = {
    playAnim: (a) => api.current?.playAnim(a.id),
    openActivity: (id) => props.onActivity?.(id),
    useCamera: switchCamera,
    applyLook: () => api.current?.setAvatarLook(),
    openSprite: (id) => win.open(`sprite:${id}`, `Sprite: ${spriteOf(id).name}`, { x: 420 + (win.list.length % 3) * 24, y: 90, ...WIN.editor }),
    share: (kind, id) => openShare(kind, id),
  };
  const openShare = (kind: ShareKind, id: string): void => {
    api.current?.unlock();
    win.open(`share:${kind}:${id}`, 'Share', { x: Math.max(12, window.innerWidth / 2 - 220), y: 70, w: 440, h: 660 });
  };
  /** What a share holds and shows, by kind. */
  const shareInfo = (kind: ShareKind, id: string): { name: string; preview: Preview; data: () => unknown } => {
    const pl = player();
    switch (kind) {
      case 'tool': { const t = toolOf(pl, id); return { name: t?.name ?? id, preview: { kind: 'icon', icon: t?.icon ?? 'Box' }, data: () => ({ tool: toolOf(player(), id), sprites: Object.fromEntries((toolOf(player(), id)?.plugs ?? []).filter((x) => x.kind === 'sprite').map((x) => [x.ref, spriteOf(x.ref)])) }) }; }
      case 'sprite': { const sp = spriteOf(id); return { name: sp.name, preview: { kind: 'sprite', sprite: sp }, data: () => spriteOf(id) }; }
      case 'animation': { const a = animOf(pl, id); return { name: a.name, preview: { kind: 'anim', anim: a }, data: () => animOf(player(), id) }; }
      case 'look': { const l = lookOf(pl, id); return { name: l.name, preview: { kind: 'look', look: l }, data: () => lookOf(player(), id) }; }
      case 'island': return { name: rt.store.get(scene.sceneId)?.name ?? 'My island', preview: { kind: 'icon', icon: 'Globe' }, data: () => mapBundle(rt, scene.sceneId) };
    }
  };
  /** A preset picked in the palette (a tab without materials shows its presets there): it goes in the slot you are on. */
  /** Layers: what this island is made of (the palette's Layers button, or L). */
  const openLayers = (): void => { win.open('layers', 'Layers', { x: Math.max(12, window.innerWidth - 380), y: 70, w: 350, h: 560 }); };
  const openLayersRef = useRef(openLayers);
  openLayersRef.current = openLayers;
  /** Select picked something: open what changes it (the ground its look, a plant its kind's behaviour, the sea the world rules, a thing its layer). */
  const openSelected = (w: Selected): void => {
    if (w.kind === 'ground') {
      const s = PAINTS.find((x) => x.id === w.surface);
      if (s && props.ground !== 'racing') win.open(`surface:${s.id}`, `Look: ${s.name}`, { x: Math.max(12, window.innerWidth - 420), y: 70, w: 390, h: 640 });
    } else if (w.kind === 'plant') win.open(`plant:${w.plant}`, `Behaviour: ${w.plant}`, { x: 80, y: 110, ...WIN.editor });
    else if (w.kind === 'water') win.open('world', 'World rules', { x: 60, y: 90, ...WIN.editor });
    else { setLayerSel(w.ref); openLayers(); }
  };
  const openSelectedRef = useRef(openSelected);
  openSelectedRef.current = openSelected;
  const [layerSel, setLayerSel] = useState<PresetId | null>(null);
  // the gizmo follows the selected thing (read by the frame loop)
  const gizmoSel = useRef<PresetId | null>(null);
  gizmoSel.current = layerSel;
  /** Texture mode (MASTER_PLAN 6.4): the surface you stepped into, its draft, and the colour Paint puts on. */
  const [tex, setTex] = useState<{ readonly id: number; readonly name: string; readonly draft: TexDraft; readonly history: DraftHistory; readonly colours: [number, number, number][] } | null>(null);
  const [texColour, setTexColour] = useState(0);
  const texApply = useRef(0);
  const stepIntoTexture = (id: number): void => {
    const t = api.current?.readTile(id);
    const s = PAINTS.find((x) => x.id === id);
    if (!t || !s) return;
    const draft = draftFromTile(t.colour, t.pbr, t.size);
    win.list.filter((w) => w.id.startsWith('surface:')).forEach((w) => win.close(w.id));
    setTex({ id, name: s.name, draft, history: newHistory(), colours: draftColours(draft) });
    api.current?.unlock();
    setTexColour(Math.min(5, draftColours(draft).length - 1));
    say(`${s.name}: paint and sculpt it with the hotbar; Animate makes it move. Esc steps out.`);
  };
  /** Texture mode: show the edit on the island a moment after the last dab. */
  const texChanged = (): void => {
    window.clearTimeout(texApply.current);
    texApply.current = window.setTimeout(() => { if (tex) { const b = draftToTile(tex.draft); api.current?.putTile(tex.id, b.colour, b.maps); } }, 220);
  };
  const stepOutOfTexture = (): void => {
    if (!tex) return;
    window.clearTimeout(texApply.current);
    const b = draftToTile(tex.draft), size = tex.draft.size, id = tex.id;
    api.current?.putTile(id, b.colour, b.maps);
    setTex(null);
    void Promise.all([encodeWebp(b.colour, size, 0.92), encodeWebp(b.maps, size, 1)]).then(([colour, maps]) => { if (colour && maps) void saveTexture(id, { colour, maps }); });
    say(`${PAINTS.find((x) => x.id === id)?.name ?? 'The texture'} kept`);
  };
  const stepOutRef = useRef(stepOutOfTexture);
  stepOutRef.current = stepOutOfTexture;
  const texRef = useRef(tex);
  texRef.current = tex;
  const [plantsShown, setPlantsShown] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer: ThreeRenderer = createThreeRenderer({ shadows: true, background: 'sky', powerPreference: powerPreferenceOf(props.gpu) });
    renderer.mount(el, rt.world, rt.store);
    noteGpu(renderer.gpu);
    // graphics: a chosen tier is kept; auto starts at what the graphics chip can probably do and keeps the frames at the target (Settings)
    const device: DeviceFacts = { touch: matchMedia('(pointer: coarse)').matches, cores: navigator.hardwareConcurrency || 0, dpr: window.devicePixelRatio || 1, width: window.innerWidth, gpu: renderer.gpu };
    const chosen = parseQuality(qualityRef.current);
    graphicsRef.current = { renderer, device, adaptive: createAdaptiveQuality(chosen ?? guessQuality(device), { locked: chosen !== null, targetFps: fpsRef.current }) };
    showTier(renderer, graphicsRef.current.adaptive.current, ownGraphicsRef.current);
    const offFrame = renderer.onFrame((dt) => { const q = graphicsRef.current?.adaptive.frame(dt); if (q) showTier(renderer, q, ownGraphicsRef.current); });
    (window as unknown as { hmRenderer: unknown }).hmRenderer = renderer; // console: hmRenderer.burst({...})
    // console and tests: count what the ground is made of (read only)
    (window as unknown as { hmGround: unknown }).hmGround = { surfaces: (): Record<number, number> => { const t = rt.binder.terrain()?.terrain; const out: Record<number, number> = {}; if (t) for (const s of t.surfaceA) out[s] = (out[s] ?? 0) + 1; return out; },
      /** The cells that show a surface at all: as their own, or blended in over another (a soft brush paints the second layer). */
      shows: (id: number): number => { const t = rt.binder.terrain()?.terrain; let n = 0; if (t) for (let i = 0; i < t.surfaceA.length; i++) if (t.surfaceA[i] === id || (t.surfaceB[i] === id && t.blend[i]! > 0)) n++; return n; } };
    // the ground's tiles: SetMix's graph-made set, or Goblin Racing's image set (the high end); the voxel blocks always wear the graph set's faces
    // sharp 512-pixel tiles unless the graphics start low (they are resampled to 256 there: a quarter of the memory)
    const tileSize = tileSizeFor(graphicsRef.current.adaptive.current);
    const surfaces = new SurfaceArray(props.ground === 'racing' ? RACING_SURFACES : SETMIX_SURFACES, undefined, SETMIX_VOXEL, tileSize);
    (window as unknown as { hmGround: { tile?: (id: number) => number } }).hmGround.tile = (id) => surfaces.checksum(id);
    (window as unknown as { hmGround: { things?: () => number } }).hmGround.things = () => rt.store.get(scene.sceneId)?.children['models']?.length ?? 0;
    (window as unknown as { hmGround: { heightAt?: (x: number, z: number) => number } }).hmGround.heightAt = (x, z) => { const t = rt.binder.terrain()?.terrain; return t ? heightAt(t, x, z) : 0; };
    (window as unknown as { hmGround: { heights?: () => number } }).hmGround.heights = () => { const t = rt.binder.terrain()?.terrain; let s = 0; if (t) for (let i = 0; i < t.heights.length; i++) s += t.heights[i]! * ((i % 97) + 1); return Math.round(s * 1000) / 1000; };
    /** Draw a surface from a texture graph: its painted-ground tile, or (blocks) its voxel faces, three seeds like the baked ones. */
    const applyLook = (id: number, graph: TexGraph, blocks: boolean): void => {
      if (blocks) surfaces.setVoxelFaces(id, [0, 1000, 2000].map((seed) => tileBytes(evaluateGraph(graph, { size: 32, seed }))));
      else { const b = tileBytes(evaluateGraph(graph, { size: surfaces.size })); surfaces.setTile(id, b.colour, b.maps); }
    };
    // the player's own looks for SetMix surfaces (the surface editor) replace the baked tiles once they have loaded ("b4": grass's blocks)
    if (props.ground !== 'racing') {
      const looks = props.profile?.groundLooks ?? {};
      void surfaces.ready.then(() => {
        for (const [key, graph] of Object.entries(looks)) {
          try { applyLook(Number(key.replace(/^b/, '')), graph, key.startsWith('b')); } catch { /* a broken look keeps the baked tile */ }
        }
      });
    }
    void surfaces.ready.then(async () => {
      const stored = await loadTextures();
      for (const [id, t] of stored) {
        if (t.colour && t.maps) {
          const [c, m] = await Promise.all([decodeBlob(t.colour, surfaces.size), decodeBlob(t.maps, surfaces.size)]);
          if (c && m) surfaces.setTile(id, c, m);
        }
        if (t.anim) surfaces.setAnim(id, t.anim[0], t.anim[1], t.anim[2], t.anim[3]);
      }
    });
    const offClock = renderer.onFrame(() => { terrainView.current?.tick(performance.now() / 1000); });
    const showTerrain = (): void => {
      const st = rt.binder.terrain();
      if (!st) return;
      const tv = renderer.setTerrain(st.terrain, surfaces);
      tv?.setLook({ cliffSurface: SURF.cliff, soft: st.look.soft, normalStrength: st.look.bump, ...lookRef.current });
      terrainView.current = tv;
    };
    showTerrain();
    const offTerrain = rt.binder.onTerrain(showTerrain);
    // looking down from the island overview there is a lot of air between the camera and the ground: thin the haze so the island can be seen
    const stopLighting = followLighting(rt.store, scene.sceneId, renderer, () => (live.current.level === 'island' ? 0.1 : live.current.showcase ? 0.3 : 1));
    lightingRef.current = stopLighting;
    let plantsHidden = false;
    const showDecor = (): void => { const d = rt.binder.decor(); renderer.setDecor(d && !live.current.isolateId && !plantsHidden ? decorInstances(d.placements) : null); };
    showDecor();
    const offDecor = rt.binder.onDecor(showDecor);

    // your goblin: the voxel goblin in the look you wear, split into bones so the animation presets move it
    // your active avatar, whatever its kind (goblin, human ...): its model, its size, its bones
    const showLook = (look: AvatarLook): void => { const g = avatarRigged(look); renderer.setAvatar(g?.model ?? null, kindDef(look).block, g?.rig); };
    let previewing: AvatarLook | null = null;
    const setAvatarLook = (): void => { if (previewing) return; const pl = player(); showLook(lookOf(pl, pl.lookId)); };
    const previewLook = (look: AvatarLook | null): void => { previewing = look; if (look) showLook(look); else setAvatarLook(); };
    setAvatarLook();
    const animator = new Animator();
    const moves = (): MoveSet => { const pl = player(); return { idle: animOf(pl, pl.moves.idle), walk: animOf(pl, pl.moves.walk), run: animOf(pl, pl.moves.run), jump: animOf(pl, pl.moves.jump), fall: animOf(pl, pl.moves.fall) }; };

    // characters (the Characters tab, F9): goblins drawn after the placed things, walked by their brains each frame
    const chars = new CharactersRuntime();
    // things in motion (the Physics tab, F11): dropped or hammered, they fall by their material and settle as one undo step
    const physics = new PhysicsRuntime();
    const physThing = (ref: PresetId): PhysThing | null => {
      if (!rt.store.get(ref)) return null;
      const pr = rt.store.resolve(ref).params as Record<string, unknown>;
      const m = typeof pr['data'] === 'string' && pr['data'] ? decodeModel(pr['data'] as string).model : null;
      const s = Number(pr['scale'] ?? 0.1);
      const size: [number, number, number] = m ? [m.size[0] * s, m.size[1] * s, m.size[2] * s] : [1, 1, 1];
      return { ref, base: [Number(pr['x'] ?? 0), Number(pr['y'] ?? 0), Number(pr['z'] ?? 0)], size, material: String(pr['phys'] ?? 'wood') };
    };
    let physSettled = 0;
    let rainTick = 0;
    // trigger zones and wires (the Logic tab, F7)
    const wires = new WiresRuntime();
    const placedZones = (): PlacedZone[] => (rt.store.get(scene.sceneId)?.children['zones'] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => { const pr = rt.store.resolve(r.ref).params as Record<string, unknown>; return { ref: r.ref, x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), half: Number(pr['half'] ?? 2) }; });
    const placedWires = (): PlacedWire[] => (rt.store.get(scene.sceneId)?.children['wires'] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => { const pr = rt.store.resolve(r.ref).params as Record<string, unknown>; const when = String(pr['when'] ?? 'enter'); return { ref: r.ref, from: String(pr['from'] ?? ''), when: when === 'leave' || when === 'every' ? when : 'enter', every: Number(pr['every'] ?? 3), to: String(pr['to'] ?? ''), do: String(pr['do'] ?? 'toggle'), sound: String(pr['sound'] ?? 'item-pickup'), text: String(pr['text'] ?? 'Hello!') }; });
    const wireHidden = new Set<string>(), wirePosed = new Set<string>(), lampsOff = new Set<string>();
    let wireFrom: string | null = null, wiresShown = false, wiresFired = 0, wiresKey = '';
    const thingAt = (ref: string): [number, number, number] | null => { if (!rt.store.get(ref as PresetId)) return null; const pr = rt.store.resolve(ref as PresetId).params as Record<string, unknown>; return [Number(pr['x'] ?? 0), Number(pr['y'] ?? 0), Number(pr['z'] ?? 0)]; };
    const applyWire = (e: WireEffect): void => {
      wiresFired++;
      if (e.kind === 'hide') wireHidden.add(e.thing);
      else if (e.kind === 'show') wireHidden.delete(e.thing);
      else if (e.kind === 'toggle') { if (wireHidden.has(e.thing)) wireHidden.delete(e.thing); else wireHidden.add(e.thing); fx('item-pickup', { volume: 0.4 }); }
      else if (e.kind === 'light-on') lampsOff.delete(e.lamp);
      else if (e.kind === 'light-off') lampsOff.add(e.lamp);
      else if (e.kind === 'sound') fx(e.sound as SfxId);
      else if (e.kind === 'say') say(e.text);
      else if (e.kind === 'teleport') { const to = thingAt(e.to); if (to) { px = to[0] + 1.5; pz = to[2] + 1.5; py = ground(px, pz); vy = 0; fx('boost', { volume: 0.5 }); } }
    };
    (window as unknown as { hmWires: unknown }).hmWires = () => ({ zones: placedZones().length, wires: placedWires().length, hidden: [...wireHidden], fired: wiresFired, from: wireFrom,
      walkInto: (ref: string) => { const z = placedZones().find((q) => q.ref === ref) ?? placedZones()[0]; if (!z) return 0; const out = wires.step(0.05, placedZones(), placedWires(), [[z.x, z.y, z.z]]); out.forEach(applyWire); return out.length; } });
    // a road or a river being drawn (the Terrain tab, F10): its points so far, shown as a ribbon
    let path: { kind: 'road' | 'river'; width: number; pts: [number, number][] } | null = null;
    let pathShown = false, pathsLaid = 0;
    const showPath = (): void => {
      const ts = rt.binder.terrain();
      if (!path || !path.pts.length || !ts) { if (pathShown) { renderer.overlay.hide('path'); pathShown = false; } return; }
      const lift = (x: number, z: number): [number, number, number] => [x, heightAt(ts.terrain, x, z) + 0.15, z];
      const line = pathPreview(path.pts).map(([x, z]) => lift(x, z));
      renderer.overlay.show('path', [
        ...(line.length > 1 ? [{ type: 'ribbon' as const, points: line, width: path.width, color: path.kind === 'road' ? '#c8a26b' : '#3e8fd6', opacity: 0.55 }] : []),
        ...path.pts.map(([x, z], i) => ({ type: 'handle' as const, id: `p${i}`, position: lift(x, z), color: '#ffffff', size: 0.25 })),
      ]);
      pathShown = true;
    };
    const layPath = (): void => {
      const ts = rt.binder.terrain();
      if (!path || path.pts.length < 2 || !ts) { say('Click at least two points first'); return; }
      lastLaid = [...path.pts];
      const kind = path.kind, made = carvePath(ts.terrain, path.pts, kind, path.width);
      path = null; showPath();
      if (!made) { say('Nothing to change there'); return; }
      builder.applyHeights(made.heights, made.rect, kind === 'road' ? 'Road' : 'River', { cells: made.paint, surface: kind === 'road' ? Number(player().palette.road ?? ROAD_SURFACE) || ROAD_SURFACE : RIVER_SURFACE });
      pathsLaid++; fx('place', { volume: 0.6 }); say(kind === 'road' ? 'Road laid' : 'River dug: it runs downhill all the way');
    };
    let lastLaid: [number, number][] = [];
    // tests: the placed things and where a world point lands on the screen
    (window as unknown as { hmThings: unknown }).hmThings = () => (rt.store.get(scene.sceneId)?.children['models'] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => { const pr = rt.store.resolve(r.ref).params as Record<string, unknown>; return { ref: r.ref, x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0) }; });
    (window as unknown as { hmProject: unknown }).hmProject = (x: number, y: number, z: number) => { const q = renderer.camera.project([x, y, z]), r = el.getBoundingClientRect(); return [q[0] + r.left, q[1] + r.top]; };
    (window as unknown as { hmPath: unknown }).hmPath = () => ({ points: path?.pts.length ?? 0, laid: pathsLaid, last: lastLaid });
    const lastCharAt = new Map<string, [number, number]>();
    let charBase = 0, charRefs: string[] = [];
    // a character wears a ready-made avatar look (dressed like your own goblin, not a statue): its model, once per look
    const lookData = new Map<string, { data: string; block: number } | null>();
    const charLook = (id: string, ref: string): { data: string; block: number } | null => {
      const look = AVATAR_LOOKS.find((l) => l.id === id) ?? AVATAR_LOOKS[[...ref].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATAR_LOOKS.length]!;
      if (!lookData.has(look.id)) { const g = avatarRigged(look); lookData.set(look.id, g ? { data: encodeModel(g.model as never), block: kindDef(look).block } : null); }
      return lookData.get(look.id) ?? null;
    };
    const placedChars = (): PlacedChar[] => (rt.store.get(scene.sceneId)?.children['characters'] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => {
      const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
      const brain = String(pr['brain'] ?? 'wander');
      return { ref: r.ref, brain: isCharBrain(brain) ? brain : 'wander', x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), yaw: Number(pr['yaw'] ?? 0) };
    });
    const refreshModels = (): void => {
      const iso = live.current.isolateId;
      const all = placementsOf(rt, scene.sceneId);
      const refs = rt.store.get(scene.sceneId)?.children['models'] ?? [];
      const shown = iso ? all.filter((_, i) => refs[i]?.ref === iso) : all;
      const cs = iso ? [] : placedChars();
      charBase = shown.length; charRefs = cs.map((c) => c.ref);
      const charModels = cs.map((c) => {
        const pr = rt.store.resolve(c.ref as PresetId).params as Record<string, unknown>;
        const m = charLook(String(pr['look'] ?? ''), c.ref);
        return { params: { data: m?.data ?? '', scale: (m?.block ?? 0.04) * Number(pr['size'] ?? 1) }, x: c.x, y: c.y, z: c.z, yawDeg: c.yaw + 180 };
      });
      renderer.setModels([...shown, ...charModels]);
      showDecor();
    };
    refreshModels();

    const ground = (x: number, z: number): number => { const st = rt.binder.terrain(); return st ? heightAt(st.terrain, x, z) : 0; };
    const builder = new BuildController(rt, renderer, scene.sceneId, scene.terrainId, {
      onModels: refreshModels,
      say,
      onDecorPreview: (preview) => { const d = rt.binder.decor(); renderer.setDecor(live.current.isolateId ? null : preview ? decorInstances(preview) : d ? decorInstances(d.placements) : null); },
      onFocus: (id) => { setFocusId(id); if (id) { setMode('studio'); say('Focused: drag with the right mouse button to look round it, Esc to leave'); } },
      onIsolate: (id) => { setIsolateId(id); say(id ? 'Everything else is hidden (Hide others again, or Esc, to show it)' : 'Everything is shown'); },
      onAnim: (id) => { if (!studio()) animator.play(animOf(player(), id)); },
      onSelect: (w) => { openSelectedRef.current(w); unlock(); },
      onShake: (id, amount) => { if (reducedMotion()) return; shakes.push({ s: shakeById(id), t0: performance.now(), amount }); if (shakes.length > 6) shakes.shift(); },
    });
    const shakes: { s: ShakePreset; t0: number; amount: number }[] = [];
    // start at the middle when it is low, flat-ish land; on a mountain or in the sea, walk out east to the first low ground
    let px = 0, pz = 0;
    for (let r = 0; r < 120 && (ground(px, pz) < SEA || ground(px, pz) > 5); r += 2) { px = r; pz = 0; }
    if (ground(px, pz) < SEA || ground(px, pz) > 5) { px = 0; pz = 0; for (let r = 0; r < 120 && ground(px, pz) < SEA; r += 2) { px = r; pz = 0; } }
    let face = 0;
    if (!introRef.current && lastPose) { px = lastPose.px; pz = lastPose.pz; face = lastPose.face; }
    let py = ground(px, pz), vy = 0;
    let camYaw = Math.PI, camPitch = 0.3, camDist = 3.6;
    if (!introRef.current && lastPose) camYaw = lastPose.camYaw;
    const intro = { on: introRef.current, t: 0, ms: 3200 };
    if (intro.on) { camPitch = 1.3; camDist = 150; }
    landRef.current = () => { intro.on = true; intro.t = 0; camPitch = 1.3; camDist = 150; };
    let eye: [number, number, number] | null = null;
    // studio camera: where it is and where it looks
    /** The Lights tab's Sun: when it last moved (it keeps moving while held). */
    let lightTick = 0;
    /** Logic: the island's rules, run frame by frame, and the things they have posed (put back when a move ends). */
    const logic = new LogicRunner();
    const logicPosed = new Set<string>();
    let fly: { x: number; y: number; z: number; yaw: number; pitch: number } | null = null;
    let orbit = { yaw: 0.8, pitch: 0.4, dist: 8 };
    // avatar mode's mirror: how far round from straight in front the camera stands, how far away, how high it looks
    let mirror = { turn: 0.38, dist: 3.4, lift: 0.1 };
    const down = new Set<string>();
    let mouse = 0; // bit 1 = left, 2 = right
    let firstUse = false;
    let pointerLocked = false;
    let lockFails = 0;
    let softAim = false; // pointer lock is not available (some browsers, embedded views): aim at the centre, look with the right button
    let suppressMenu = false;
    let cursor = { x: 0, y: 0 };
    let looking: { x: number; y: number } | null = null;
    // the transform gizmo (Pro and Studio, on Select's tab; docs/ARENA_PLAN.md)
    const gizmo = new GizmoControl(rt, scene.sceneId, renderer.overlay, (i, p) => renderer.setModelPose(i, p.x, p.y, p.z, p.yaw, p.scale),
      (ref) => { const t = focusTargetOf(rt, ref); return t ? t.center[1] - Number(rt.store.resolve(ref).params['y'] ?? 0) : 0; });
    let gizmoTargets: GizmoTarget[] = [], gizmoFov = 60;
    // a group of things picked together (Box, or Ctrl and a click with Select): the gizmo moves them as one
    let group: PresetId[] = [];
    let boxing: { x0: number; y0: number; add: boolean; div: HTMLDivElement } | null = null;
    const sizes = new Map<string, { scale: number; size: [number, number, number] }>();
    const sizeOf = (ref: PresetId): [number, number, number] => {
      const pr = rt.store.resolve(ref).params as Record<string, unknown>; const sc = Number(pr['scale'] ?? 0.1);
      const hit = sizes.get(ref); if (hit && hit.scale === sc) return hit.size;
      const m = typeof pr['data'] === 'string' && pr['data'] ? decodeModel(pr['data'] as string).model : null;
      const size: [number, number, number] = m ? [m.size[0] * sc, m.size[1] * sc, m.size[2] * sc] : [1, 1, 1];
      sizes.set(ref, { scale: sc, size }); return size;
    };
    /** The placed things as they look on screen now (for box select). */
    const screenItems = (): SelItem[] => {
      const r = el.getBoundingClientRect(), cam = eye ?? [px, py, pz];
      return (rt.store.get(scene.sceneId)?.children['models'] ?? []).filter((q) => rt.store.get(q.ref) && rt.store.resolve(q.ref).params['hidden'] !== true).flatMap((q) => {
        const pr = rt.store.resolve(q.ref).params as Record<string, unknown>; const x = Number(pr['x'] ?? 0), y = Number(pr['y'] ?? 0), z = Number(pr['z'] ?? 0);
        const [sx, sy, sz] = sizeOf(q.ref);
        const pts = [-1, 1].flatMap((a) => [0, 1].flatMap((b) => [-1, 1].map((c) => renderer.camera.project([x + a * sx / 2, y + b * sy, z + c * sz / 2])))).filter((p) => p[0] >= 0 || p[1] >= 0);
        if (!pts.length) return [];
        const xs = pts.map((p) => p[0] + r.left), ys = pts.map((p) => p[1] + r.top);
        const c = renderer.camera.project([x, y + sy / 2, z]);
        return [{ id: q.ref as string, centre: [c[0] + r.left, c[1] + r.top] as [number, number], bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number], depth: Math.hypot(x - cam[0], y - cam[1], z - cam[2]), kind: 'prop' }];
      });
    };
    let groupShown = false;
    // the Camera tab's ways (F8): an orbit shot playing, a photo asked for, slow motion
    let shot: { track: CamTrack; t: number } | null = null;
    let photoNext = false, photos = 0;
    const slow = new SlowMo();
    let slowOn = false;
    // walk paths (the Animate tab, F4): things that walk by themselves, only for show
    let walkDraw: { who: PresetId; pts: [number, number][] } | null = null;
    let walkClock = 0, walkShown = false, walkMoved = 0;
    // pointing at a thing's blocks (F2 Paint a thing, F3 Carve)
    const modelCache = new Map<string, VoxelModel | null>();
    const blockUnder = (): { ref: PresetId; model: VoxelModel; cell: HitV3; normal: HitV3 } | null => {
      const r = gizmoRay(); if (!r) return null;
      const things = (rt.store.get(scene.sceneId)?.children['models'] ?? []).filter((q) => rt.store.get(q.ref) && rt.store.resolve(q.ref).params['hidden'] !== true).map((q) => { const pr = rt.store.resolve(q.ref).params as Record<string, unknown>; return { ref: q.ref as string, data: String(pr['data'] ?? ''), pose: { x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), yaw: Number(pr['yaw'] ?? 0), scale: Number(pr['scale'] ?? 0.1) } }; });
      const h = hitThings(things, r.origin, r.dir, modelCache);
      return h ? { ref: h.ref as PresetId, model: h.model, cell: h.hit.cell, normal: h.hit.normal } : null;
    };
    let blockEdits = 0;
    (window as unknown as { hmBlocks: unknown }).hmBlocks = () => ({ edits: blockEdits, under: blockUnder()?.ref ?? null });
    const walkPosed = new Set<string>();
    const placedWalks = (): { ref: string; who: string; path: WalkPath }[] => (rt.store.get(scene.sceneId)?.children['paths'] ?? []).filter((r) => rt.store.get(r.ref)).flatMap((r) => {
      const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
      let pts: [number, number][] = [];
      try { const v = JSON.parse(String(pr['points'] ?? '[]')) as unknown; if (Array.isArray(v)) pts = v.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number')); } catch { /* bad points: no walk */ }
      if (pts.length < 2) return [];
      const mode = String(pr['mode'] ?? 'ping-pong'); const wait = Number(pr['wait'] ?? 0.5);
      return [{ ref: r.ref, who: String(pr['who'] ?? ''), path: { points: pts.map(([x, z]) => ({ pos: [x, 0, z] as [number, number, number], wait })), mode: mode === 'loop' || mode === 'once' ? mode : 'ping-pong', speed: Number(pr['speed'] ?? 1.5), smooth: true } }];
    });
    const showWalkDraw = (): void => {
      const ts = rt.binder.terrain();
      if (!walkDraw || !walkDraw.pts.length || !ts) { if (walkShown) { renderer.overlay.hide('walkpath'); walkShown = false; } return; }
      const lift = (x: number, z: number): [number, number, number] => [x, heightAt(ts.terrain, x, z) + 0.12, z];
      const line = pathPreview(walkDraw.pts).map(([x, z]) => lift(x, z));
      renderer.overlay.show('walkpath', [...(line.length > 1 ? [{ type: 'ribbon' as const, points: line, width: 0.35, color: '#ffc53d', opacity: 0.8 }] : []), ...walkDraw.pts.map(([x, z], i) => ({ type: 'handle' as const, id: `w${i}`, position: lift(x, z), color: '#ffffff', size: 0.22 }))]);
      walkShown = true;
    };
    const layWalk = (): void => {
      if (!walkDraw || walkDraw.pts.length < 1) { say('Click points along its way first'); return; }
      const at = rt.store.get(walkDraw.who) ? rt.store.resolve(walkDraw.who).params as Record<string, unknown> : null;
      // it starts where it stands
      const pts = at ? [[Number(at['x'] ?? 0), Number(at['z'] ?? 0)] as [number, number], ...walkDraw.pts] : walkDraw.pts;
      const who = walkDraw.who; walkDraw = null; showWalkDraw();
      const pid = `walk-${Date.now().toString(36)}`;
      rt.commands.transaction('Walk a path', () => {
        rt.commands.execute(cmd.put({ id: pid, kind: 'walk-path', name: 'Walk', params: { who, points: JSON.stringify(pts.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100])), mode: (['ping-pong', 'loop', 'once'] as const).find((x) => x === player().palette.walk) ?? 'ping-pong', speed: Math.min(10, Math.max(0.2, (v3Drive(player(), 'walk-speed') ?? 5.4) / 3.6)), wait: Math.min(30, v3Drive(player(), 'walk-wait') ?? 0.5) } as never, tier: 'play' }, 'Walk a path'));
        rt.commands.execute(cmd.addChild(scene.sceneId, 'paths', pid, undefined, 'Walk a path'));
      });
      saveMap(rt, scene.sceneId); say(`${rt.store.get(who)?.name ?? 'It'} walks its path${player().palette.walk === 'loop' ? ', round and round' : player().palette.walk === 'once' ? ', once' : ', there and back'}`); fx('place', { volume: 0.5 });
    };
    // tests: pick a thing as Layers or a click would (null lets go)
    (window as unknown as { hmSelect: unknown }).hmSelect = (ref: PresetId | null) => setLayerSel(ref);
    (window as unknown as { hmWalks: unknown }).hmWalks = () => ({ count: placedWalks().length, drawing: walkDraw?.pts.length ?? -1, moved: walkMoved });
    (window as unknown as { hmCamera: unknown }).hmCamera = () => ({ shot: !!shot, photos, slow: slowOn, scale: slow.scale });
    /** Shift snaps moves to half metres and sizes to quarter steps, Ctrl snaps turns to 15 degrees (hotbar spec V3). */
    const gizmoSnap = (): { move?: number; turn?: number; scale?: number } => {
      const snap: { move?: number; turn?: number; scale?: number } = {};
      if (down.has('shift')) { snap.move = 0.5; snap.scale = 0.25; }
      if (down.has('control')) snap.turn = 15;
      return snap;
    };
    // placed particle effects (the Effects tab, F12): running emitters that follow the island's list
    const effects = new EffectsRuntime(3000);
    const placedEffects = (): PlacedEffect[] => (rt.store.get(scene.sceneId)?.children['effects'] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => {
      const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
      return { ref: r.ref, preset: String(pr['preset'] ?? 'campfire'), x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), scale: Number(pr['scale'] ?? 1), on: pr['on'] !== false };
    });
    (window as unknown as { hmEffects: unknown }).hmEffects = () => ({ placed: placedEffects().length, particles: effects.count });
    // placed sounds (the Sound tab, F5): ambience zones as live synth beds, sounds repeating from their spots
    const soundscape = new SoundscapeRuntime();
    const placedSounds = (): PlacedSound[] => (rt.store.get(scene.sceneId)?.children['soundscape'] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => {
      const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
      return { ref: r.ref, what: String(pr['what'] ?? ''), x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), size: Number(pr['size'] ?? 8), volume: Number(pr['volume'] ?? 0.8), every: Number(pr['every'] ?? 4), on: pr['on'] !== false };
    });
    let soundOverlay = false;
    // lamps (the Lights tab, F6): the most important ones lit by the renderer's fixed pool, flickering as their preset says
    const placedLamps = (): { ref: string; preset: string; x: number; y: number; z: number; yaw: number; pitch: number; brightness: number; on: boolean }[] => (rt.store.get(scene.sceneId)?.children['lamps'] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => {
      const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
      return { ref: r.ref, preset: String(pr['preset'] ?? 'bulb'), x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), yaw: Number(pr['yaw'] ?? 0), pitch: Number(pr['pitch'] ?? 90), brightness: Number(pr['brightness'] ?? 1), on: pr['on'] !== false };
    });
    let lampsLit = 0;
    (window as unknown as { hmLamps: unknown }).hmLamps = () => { const l = placedLamps()[0]; return { placed: placedLamps().length, lit: lampsLit, slots: renderer.lampSlots, first: l ? [l.x, l.y, l.z] : null }; };
    let charMoved = 0;
    (window as unknown as { hmChars: unknown }).hmChars = () => ({ count: placedChars().length, drawn: charRefs.length, moved: charMoved, first: (() => { const at = charRefs[0] ? lastCharAt.get(charRefs[0]) : undefined; const ts = rt.binder.terrain(); return at ? [at[0], ts ? heightAt(ts.terrain, at[0], at[1]) : 0, at[1]] : null; })() });
    (window as unknown as { hmPhysics: unknown }).hmPhysics = () => ({ moving: physics.active, settled: physSettled });
    (window as unknown as { hmSounds: unknown }).hmSounds = () => ({ placed: placedSounds().length, zones: placedSounds().filter((p) => isAmbience(p.what)).length });
    // tests: what the gizmo shows, where a point along its arrow lands on screen, and the target's place
    (window as unknown as { hmGizmo: unknown }).hmGizmo = () => {
      const g = gizmo.seen;
      if (!g) return null;
      const pr = rt.store.get(g.ref) ? rt.store.resolve(g.ref).params : {};
      const along = (k: 0 | 1 | 2, f: number): readonly [number, number] => { const p: [number, number, number] = [g.pivot[0], g.pivot[1], g.pivot[2]]; p[k] += g.len * f; const q = renderer.camera.project(p), r = el.getBoundingClientRect(); return [q[0] + r.left, q[1] + r.top]; };
      return { mode: g.mode, hot: g.hot, len: g.len, size: gizmo.size, count: g.count, group: [...group], x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), xArrow: along(0, 0.7), xFar: along(0, 1.4), arrows: { x: [along(0, 0.7), along(0, 1.4)], y: [along(1, 0.7), along(1, 1.4)], z: [along(2, 0.7), along(2, 1.4)] } };
    };
    let lastLookEvent = 0, lastMoveEvent = 0, lastTourTick = 0;
    const realMove = lookFilter();

    // the whole shell is the pointer-lock target, so the mouse stays captured through the dive and the menus
    const root = (el.closest('.shell') as HTMLElement | null) ?? el;
    const isLocked = (): boolean => !!document.pointerLockElement && root.contains(document.pointerLockElement);
    const studio = (): boolean => player().mode === 'studio';
    const centre = (): { x: number; y: number } => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    /** The tools act at the cursor whenever the mouse is free (Studio, the island view), at the crosshair while you walk with it captured or soft-aimed. */
    const atCursor = (): boolean => !(pointerLocked || softAim) || studio() || live.current.level === 'island';
    /** Where the tool acts: the crosshair while the mouse is captured, the cursor when it is free. */
    const gizmoRay = (): { origin: [number, number, number]; dir: [number, number, number] } | null => {
      const c = atCursor() ? cursor : centre(); const r = renderer.ray(c.x, c.y);
      return r ? { origin: [r.origin[0], r.origin[1], r.origin[2]], dir: [r.direction[0], r.direction[1], r.direction[2]] } : null;
    };
    /** The index the renderer drew a placed thing at (hidden layers are not drawn; isolate draws one). */
    const drawnIndex = (ref: PresetId): number => {
      if (live.current.isolateId) return live.current.isolateId === ref ? 0 : -1;
      const refs = (rt.store.get(scene.sceneId)?.children['models'] ?? []).filter((r) => rt.store.get(r.ref) && rt.store.resolve(r.ref).params['hidden'] !== true);
      return refs.findIndex((r) => r.ref === ref);
    };
    const aim = (): Aim | null => { const c = atCursor() ? cursor : centre(); const h = renderer.pick(c.x, c.y); return h.point ? { point: h.point, normal: h.normal ?? null } : null; };

    // the browser refuses a re-lock for a moment after Esc: only give up on the mouse after three refusals in a row
    const failLock = (): void => { if (studio()) return; if (++lockFails >= 3) { softAim = true; setLocked(true); } };
    const lock = (): void => {
      if (document.pointerLockElement || studio()) return;
      captureMouse(root, failLock);
    };
    const unlock = (): void => { softAim = false; suppressMenu = true; if (document.pointerLockElement) document.exitPointerLock(); else { suppressMenu = false; setLocked(false); } };
    api.current = {
      lock, unlock, refreshModels,
      playAnim: (id) => { animator.play(animOf(player(), id)); },
      setAvatarLook, previewLook,
      undo: () => { builder.undo(); tourEvent('undo'); refreshModels(); },
      redo: () => { rt.commands.redo(); refreshModels(); },
      carry: (ref) => {
        builder.carrying = ref;
        // hand over the Move tool so the next click puts it down where you point
        const s = player(); const slot = s.hotbars.select.indexOf('move');
        setTab('select'); if (slot >= 0) setSlot('select', slot); else putInSlot('select', s.slots.select, 'move');
        api.current?.unlock();
        say(`Carrying ${rt.store.get(ref)?.name ?? 'it'}: click where it goes`);
      },
      addThing: (modelId) => {
        const base = toolById(`place-${modelId}`);
        if (!base) return null;
        // where you look, or three steps in front of you
        const fx3 = px + Math.sin(face) * 3, fz3 = pz + Math.cos(face) * 3;
        const ts = rt.binder.terrain();
        const a = aim() ?? { point: [fx3, ts ? heightAt(ts.terrain, fx3, fz3) : py, fz3] as const, normal: null };
        builder.use(toolOf(player(), base.id) ?? base, a, false, performance.now(), true);
        builder.end();
        const refs = rt.store.get(scene.sceneId)?.children['models'] ?? [];
        return refs[refs.length - 1]?.ref ?? null;
      },
      showPlants: (on) => { plantsHidden = !on; showDecor(); },
      readTile: (id) => { const t = surfaces.readTile(id); return t ? { ...t, size: surfaces.size } : null; },
      putTile: (id, colour, maps) => surfaces.setTile(id, colour, maps),
      setAnim: (id, v) => surfaces.setAnim(id, v[0], v[1], v[2], v[3]),
      setSurfaceLook: (id, graph, blocks = false) => {
        // the racing ground's painted tiles are pictures; its blocks are SetMix's and can change
        if (props.ground === 'racing' && !blocks) return false;
        applyLook(id, graph, blocks);
        return true;
      },
      groundPeek: () => { const ts = rt.binder.terrain(); if (!ts) return null; const a = aim(); const pt = a?.point ?? [px, py, pz]; return cropTerrain(ts.terrain, pt[0], pt[2], 24); },
      pick: (tab, id) => {
        if (tab !== 'select' && tab !== 'paint' && tab !== 'sculpt' && tab !== 'things') return;
        const tool = toolOf(player(), id);
        if (tool) builder.fire(tool, 'pick', aim());
      },
      // the big reveal: confetti round the goblin, a cheer, a fanfare
      reveal: () => {
        const c = spriteDef('confetti');
        for (let i = 0; i < 5; i++) renderer.burst({ ...c, count: Math.round(c.count * 1.4), position: [px + Math.cos(i * 1.26) * 2.5, py + 0.2, pz + Math.sin(i * 1.26) * 2.5] });
        if (!studio()) animator.play(animOf(player(), 'cheer'));
        fx('finish');
      },
    };
    const onLockChange = (): void => {
      const was = pointerLocked;
      pointerLocked = isLocked();
      if (pointerLocked) { lockFails = 0; softAim = false; }
      setLocked(pointerLocked);
      if (was && !pointerLocked) {
        if (suppressMenu) { suppressMenu = false; return; }
        // Esc while aiming: the browser let go of the mouse; open the jump menu
        setMenu(true);
      }
    };
    document.addEventListener('pointerlockchange', onLockChange);
    pointerLocked = isLocked(); setLocked(pointerLocked);
    const onLockError = (): void => failLock();
    document.addEventListener('pointerlockerror', onLockError);

    /** Esc closes exactly one thing: the wheel, the front window, focus, hide-others, what Move carries; then it opens the menu. */
    const escape = (): void => {
      if (gizmo.dragging) { gizmo.cancel(); return; }
      if (shot) { shot = null; return; }
      if (walkDraw) { walkDraw = null; showWalkDraw(); say('Let go of the path'); return; }
      if (path) { path = null; showPath(); say('Let go of the path'); return; }
      if (wireFrom) { wireFrom = null; say('Let go of the wire'); return; }
      if (boxing) { boxing.div.remove(); boxing = null; return; }
      if (group.length) { group = []; say('Let go of the group'); return; }
      if (texRef.current) { if (live.current.win.closeTop()) return; stepOutRef.current(); return; }
      if (live.current.win.closeTop()) return;
      if (live.current.focusId) { setFocusId(null); renderer.setFocus(null); return; }
      if (live.current.isolateId) { setIsolateId(null); return; }
      if (builder.carrying) { builder.carrying = null; say('Put back'); return; }
      // the picked thing (its gizmo): let go of it
      if (gizmoSel.current) { setLayerSel(null); say('Let go'); return; }
      if (live.current.avatarMode) { leaveAvatarRef.current(); return; }
      if (document.pointerLockElement) { suppressMenu = true; document.exitPointerLock(); }
      if (intro.on) { intro.t = intro.ms; return; }
      setMenu((m) => !m);
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      const k = e.key.toLowerCase();
      if (live.current.showcase) return;
      if (k === 'escape') { escape(); return; }
      if (typing) return;
      if (live.current.menu) return;
      if (e.key === 'Enter' && path && path.pts.length >= 2) { e.preventDefault(); layPath(); return; }
      if (e.key === 'Enter' && walkDraw && walkDraw.pts.length >= 1) { e.preventDefault(); layWalk(); return; }
      if ((e.key === '+' || e.key === '=' || e.key === '-') && gizmoTargets.length && !e.ctrlKey) { gizmo.grow(e.key === '-' ? -1 : 1); return; }
      const v3tab = v3TabForKey(e.key, e.shiftKey);
      if (v3tab !== null && live.current.buildOn) { e.preventDefault(); pickV3Tab(v3tab); return; }
      // the backtick switches Game, Simplified and Advanced; / finds a tool; [ and ] size what you hold
      if (e.key === '`' && live.current.buildOn && !e.ctrlKey) { e.preventDefault(); pickV3Mode(nextMode(modeOfLevel(player().level))); return; }
      if (e.key === '/' && live.current.buildOn && !live.current.avatarMode) { e.preventDefault(); setFindOpen(true); unlock(); return; }
      if ((e.key === '[' || e.key === ']') && live.current.buildOn) {
        const s = player(), way = s.hotbars[s.tab][s.slots[s.tab]] ?? '';
        for (const id of toolsOfWay(way)) { const t = toolOf(s, id); if (t) editTool(id, 'size', Math.min(30, Math.max(0.1, Math.round(t.size * (e.key === ']' ? 1.25 : 0.8) * 10) / 10))); }
        const t = toolOf(player(), toolsOfWay(way)[0] ?? ''); if (t) say(`Size ${t.size}`);
        return;
      }
      if (k === 'tab') {
        e.preventDefault();
        if (live.current.buildOn && !intro.on && !e.repeat) {
          const open = !live.current.paletteOpen;
          setPaletteOpen(open);
          if (open) unlock(); else if (!studio()) lock();
          fx('ui-toggle', { volume: 0.4 });
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) rt.commands.redo(); else { builder.undo(); tourEvent('undo'); } refreshModels(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); rt.commands.redo(); refreshModels(); return; }
      if (k >= '1' && k <= '9' && live.current.buildOn && !live.current.avatarMode) { pickV3Slot(Number(k) - 1); return; }
      if (k === 'l' && live.current.buildOn) { openLayersRef.current(); return; }
      if (k === 'b' && live.current.buildOn) { const to = studio() ? 'walk' : 'studio'; setMode(to); if (to === 'walk') { fly = null; setFocusId(null); renderer.setFocus(null); } fx('ui-toggle'); return; }
      if (k === 'v' && !studio()) { const s = player(); setView(s.view === 'first' ? 'third' : 'first'); fx('ui-toggle', { volume: 0.5 }); return; }
      if (k === 'f' && studio() && live.current.buildOn) { const a = aim(); const m = a ? builder.modelAt(a) : null; setFocusId(m ? m.ref : null); if (!m) renderer.setFocus(null); return; }
      if (k === 'h' && live.current.buildOn) { const a = aim(); const m = a ? builder.modelAt(a) : null; setIsolateId((cur) => (cur ? null : m ? m.ref : null)); return; }
      if ((k === 'x' || k === 'delete') && live.current.buildOn) { const a = aim(); if (a) builder.removeAt(a); return; }
      down.add(k);
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Tab') { e.preventDefault(); return; }
      down.delete(e.key.toLowerCase());
    };
    const onBlur = (): void => { down.clear(); mouse = 0; looking = null; };
    window.addEventListener('blur', onBlur);
    const overUi = (e: Event): boolean => !el.contains(e.target as Node);
    const onPointerDown = (e: PointerEvent): void => {
      if (live.current.menu || intro.on || live.current.showcase) return;
      cursor = { x: e.clientX, y: e.clientY };
      if (!pointerLocked && overUi(e)) return;
      // avatar mode: the right button turns you round in the mirror; the left one never uses a tool here
      if (live.current.avatarMode) { if (e.button === 2) { looking = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ } } return; }
      // Box (Select): drag a rectangle over things
      if (e.button === 0 && live.current.buildOn && atCursor() && !gizmo.hovering && player().tab === 'select' && player().hotbars.select[player().slots.select] === 'select-box') {
        if (player().level === 'easy') { say('Box picks groups in Pro and Studio (beside the hotbar)'); return; }
        const div = document.createElement('div');
        div.className = 'box-select';
        el.appendChild(div);
        boxing = { x0: e.clientX, y0: e.clientY, add: e.ctrlKey || e.shiftKey, div };
        return;
      }
      // a gizmo handle under the pointer takes the left button
      if (e.button === 0 && live.current.buildOn && gizmo.hovering && gizmo.down(gizmoTargets, gizmoRay(), e.altKey, gizmoFov)) { fx('select', { volume: 0.4 }); return; }
      if (studio() || live.current.level === 'island') {
        // the mouse is free: right button looks around, left button uses what you hold where the cursor points
        if (e.button === 2) { looking = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ } return; }
        if (e.button === 0 && live.current.buildOn) { mouse |= 1; firstUse = true; pressNow(); }
        return;
      }
      if (!pointerLocked && !softAim) { lock(); return; }
      if (softAim && e.button === 2) { looking = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ } return; }
      mouse |= e.button === 2 ? 2 : 1;
      if (e.button === 0 || e.button === 2) { firstUse = true; pressNow(); }
    };
    const onPointerMove = (e: PointerEvent): void => {
      cursor = { x: e.clientX, y: e.clientY };
      if (live.current.menu) return;
      if (gizmo.dragging && atCursor()) gizmo.track(gizmoRay(), gizmoSnap());
      if (boxing) { const r = el.getBoundingClientRect(); Object.assign(boxing.div.style, { left: `${Math.min(boxing.x0, e.clientX) - r.left}px`, top: `${Math.min(boxing.y0, e.clientY) - r.top}px`, width: `${Math.abs(e.clientX - boxing.x0)}px`, height: `${Math.abs(e.clientY - boxing.y0)}px` }); }
      if ((pointerLocked || looking) && performance.now() - lastLookEvent > 400) { lastLookEvent = performance.now(); tourEvent('looked'); }
      if (pointerLocked) {
        if (!realMove(e.movementX, e.movementY)) return;
        const c = controlsRef.current, ys = c.invertY ? -1 : 1;
        camYaw -= e.movementX * 0.0026 * c.sensitivity;
        camPitch = Math.min(1.3, Math.max(player().view === 'first' ? -1.3 : -0.55, camPitch + e.movementY * 0.0022 * c.sensitivity * ys));
        return;
      }
      if (!looking) return;
      const sens = controlsRef.current.sensitivity, dx = (e.clientX - looking.x) * sens, dy = (e.clientY - looking.y) * sens * (controlsRef.current.invertY ? -1 : 1);
      looking = { x: e.clientX, y: e.clientY };
      if (live.current.avatarMode) { mirror = { ...mirror, turn: mirror.turn - dx * 0.008, lift: Math.min(0.9, Math.max(-0.25, mirror.lift + dy * 0.004)) }; return; }
      if (live.current.focusId) { orbit = { ...orbit, yaw: orbit.yaw - dx * 0.008, pitch: Math.min(1.45, Math.max(-0.2, orbit.pitch + dy * 0.006)) }; return; }
      if (fly) { fly.yaw -= dx * 0.004; fly.pitch = Math.min(1.5, Math.max(-1.5, fly.pitch - dy * 0.004)); return; }
      camYaw -= dx * 0.006;
      camPitch = Math.min(1.3, Math.max(0.05, camPitch + dy * 0.004));
    };
    const onPointerUp = (e: PointerEvent): void => {
      if (boxing && e.button === 0) {
        const b = boxing; boxing = null; b.div.remove();
        const picked = (player().v3.filters['F1:Static Mesh'] === false ? [] : boxSelect(screenItems(), [b.x0, b.y0], [e.clientX, e.clientY], player().palette.box === 'enclosed' ? 'enclosed' : 'touch')) as PresetId[];
        const next = b.add ? [...new Set([...group, ...(gizmoSel.current && !group.length ? [gizmoSel.current] : []), ...picked])] : picked;
        if (next.length === 1) { group = []; setLayerSel(next[0]!); } else group = next;
        say(next.length === 0 ? 'Nothing in the box' : next.length === 1 ? `${rt.store.get(next[0]!)?.name ?? 'One thing'} picked` : `${next.length} things picked: the gizmo moves them together (Esc lets go)`);
        fx('select', { volume: 0.5 });
        return;
      }
      if (gizmo.dragging && e.button === 0) {
        if (atCursor()) cursor = { x: e.clientX, y: e.clientY };
        const said = gizmo.up(gizmoRay()); if (said) say(said); fx('place', { volume: 0.5 }); return;
      }
      if (looking && e.button === 2) { looking = null; try { el.releasePointerCapture(e.pointerId); } catch { /* not captured */ } return; }
      looking = null;
      if (mouse) { mouse &= e.button === 2 && !softAim ? ~2 : ~1; if (!mouse) builder.end(); }
    };
    const onWheel = (e: WheelEvent): void => {
      if (live.current.showcase) return;
      if (!pointerLocked && overUi(e)) return;
      if (live.current.avatarMode) { mirror = { ...mirror, dist: Math.min(7, Math.max(1.4, mirror.dist * (e.deltaY > 0 ? 1.08 : 0.92))) }; return; }
      if (live.current.focusId) { orbit = { ...orbit, dist: Math.min(60, Math.max(1.5, orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9))) }; return; }
      if (live.current.buildOn && (pointerLocked || softAim || studio())) { const n = v3Now(player()), c = v3Slots(n.t, n.mode).length; if (c) pickV3Slot((((n.slot + (e.deltaY > 0 ? 1 : -1)) % c) + c) % c); return; }
      camDist = Math.min(14, Math.max(2.2, camDist * (e.deltaY > 0 ? 1.08 : 0.92)));
    };
    const onContext = (e: Event): void => e.preventDefault();
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown); window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('wheel', onWheel, { passive: true }); el.addEventListener('contextmenu', onContext);

    type Under = NonNullable<ReturnType<typeof blockUnder>>;
    /** Paint a thing (F2): every block of the colour you point at takes the palette's colour; the sponge puts back the colours it was made with. One undo step. */
    const tintThing = (b: Under, tint: string | undefined): void => {
      let data: string;
      if (tint === 'sponge') {
        const name = rt.store.get(b.ref)?.name ?? '';
        const made = voxelModelById(THINGS.find((t) => t.name === name)?.id ?? '');
        if (!made) { say('This one has no colours to go back to'); return; }
        data = encodeModel({ ...b.model, palette: b.model.palette.map((q, i) => (made.palette[i] ? { ...q, color: made.palette[i]!.color } : q)) });
      } else data = recolour(b.model, cellAt(b.model, b.cell[0], b.cell[1], b.cell[2]), tintRgb(tint));
      rt.commands.execute(cmd.setParam(`${b.ref}.data`, data as never, tint === 'sponge' ? 'Wipe the paint off' : 'Paint a thing'));
      blockEdits++; refreshModels(); saveMap(rt, scene.sceneId);
      fx('paint-tick', { volume: 0.5, minGapMs: 80 });
    };
    /** Carve (F3) and clay: a round hole into the block you point at, or clay on the face you point at. One undo step. */
    const carveThing = (b: Under, add: boolean, size: number): void => {
      const mat = cellAt(b.model, b.cell[0], b.cell[1], b.cell[2]);
      const sc = Number(rt.store.resolve(b.ref).params['scale'] ?? 0.1);
      const radius = Math.max(1, (0.25 * Math.max(0.3, size)) / sc);
      // dig into the block you point at; clay goes on the face you point at
      const at: HitV3 = add ? [b.cell[0] + 0.5 + b.normal[0], b.cell[1] + 0.5 + b.normal[1], b.cell[2] + 0.5 + b.normal[2]] : [b.cell[0] + 0.5, b.cell[1] + 0.5, b.cell[2] + 0.5];
      const data = sculptBlocks(b.model, at, radius, add, mat);
      if (!data) return;
      rt.commands.execute(cmd.setParam(`${b.ref}.data`, data as never, add ? 'Add clay' : 'Carve'));
      blockEdits++; refreshModels(); saveMap(rt, scene.sceneId);
      fx('sculpt-tick', { volume: 0.5, minGapMs: 80 });
    };
    /** Put a zone down where you point (a step-pad, a switch, a bell): small, noticing a goblin walking in. */
    const putZone = (a: Aim, half: number, label: string): PresetId => {
      const zid = `zone-${Date.now().toString(36)}` as PresetId;
      rt.commands.transaction(label, () => {
        rt.commands.execute(cmd.put({ id: zid, kind: 'logic-zone', name: label, params: { x: a.point[0], y: a.point[1], z: a.point[2], half, when: 'enter' } as never, tier: 'play' }, label));
        rt.commands.execute(cmd.addChild(scene.sceneId, 'zones', zid, undefined, label));
      });
      return zid;
    };
    const putWire = (from: string, to: string, does: string, label: string, sound = 'item-pickup'): void => {
      const wid = `wire-${Date.now().toString(36)}`;
      const when = String(rt.store.get(from as PresetId) ? rt.store.resolve(from as PresetId).params['when'] ?? 'enter' : 'enter');
      rt.commands.transaction(label, () => {
        rt.commands.execute(cmd.put({ id: wid, kind: 'logic-wire', name: 'Wire', params: { from, when: when === 'leave' ? 'leave' : 'enter', every: 3, to, do: does, sound, text: 'Hello!' } as never, tier: 'play' }, label));
        rt.commands.execute(cmd.addChild(scene.sceneId, 'wires', wid, undefined, label));
      });
      saveMap(rt, scene.sceneId);
    };
    /** Snip every cord of the zone, thing or lamp you point at. */
    const snipAt = (a: Aim): number => {
      const zone = placedZones().map((z) => ({ z, d: Math.hypot(z.x - a.point[0], z.z - a.point[2]) })).filter((q) => q.d <= q.z.half + 1).sort((p1, p2) => p1.d - p2.d)[0]?.z.ref ?? null;
      const thing = builder.modelAt(a)?.ref ?? placedLamps().map((l) => ({ l, d: Math.hypot(l.x - a.point[0], l.z - a.point[2]) })).filter((q) => q.d < 2).sort((p1, p2) => p1.d - p2.d)[0]?.l.ref ?? null;
      const wrefs = rt.store.get(scene.sceneId)?.children['wires'] ?? [];
      const mine = wrefs.map((r, i) => ({ r, i })).filter(({ r }) => { if (!rt.store.get(r.ref)) return false; const pr = rt.store.resolve(r.ref).params; return (!!zone && pr['from'] === zone) || (!!thing && pr['to'] === thing); });
      if (!mine.length) return 0;
      rt.commands.transaction('Snip the cords', () => { for (const { i } of [...mine].reverse()) rt.commands.execute(cmd.removeChild(scene.sceneId, 'wires', i, 'Snip the cords')); });
      saveMap(rt, scene.sceneId);
      return mine.length;
    };
    let clayOn: 'thing' | 'ground' | null = null;
    /** The V3 buttons the island does itself (docs/HOTBAR_V3_SPEC.md): clay on the ground or a thing, funny sounds and a roar, noon and night, cords, the cutter, a doorbell, the Hierarchy list, the wire graph. */
    const useV3Way = (id: string, alt: boolean, now: number, first: boolean): void => {
      const s = player();
      if (id === 'v3-clay-plump' || id === 'v3-clay-scoop') {
        const add = (id === 'v3-clay-plump') !== alt;
        if (first) { const b = blockUnder(); clayOn = b ? 'thing' : 'ground'; if (b) { carveThing(b, add, toolOf(s, 'things-carve')?.size ?? 1); return; } }
        if (clayOn !== 'ground') return;
        const a = aim(), base = toolOf(s, add ? 'raise' : 'lower');
        if (!a || !base) return;
        builder.use(withSculptPalette(base, s), a, false, now, first);
        if (first) tourEvent('used-sculpt');
        return;
      }
      if (!first) return;
      const a = aim();
      switch (id) {
        case 'v3-hierarchy': openLayersRef.current(); return;
        case 'logic-graph': openWireGraphRef.current(); return;
        case 'v3-noon': case 'v3-night': {
          const noon = id === 'v3-noon';
          rt.commands.execute(cmd.setParam(`${scene.sceneId}.timeOfDay`, noon ? 12 : 22, noon ? 'Noon' : 'Night'));
          say(noon ? 'Noon: the sun is high' : 'Night: the moon is up'); fx(noon ? 'ui-success' : 'ui-toggle', { volume: 0.5 });
          return;
        }
        case 'v3-funny': {
          fx(FUNNY[Math.floor(Math.random() * FUNNY.length)]!, { volume: 0.7 });
          if (a) renderer.burst({ ...spriteDef('stars'), count: 12, position: [a.point[0], a.point[1] + 1, a.point[2]] });
          return;
        }
        case 'v3-roar': {
          fx('shockwave', { volume: 0.9 }); fx('hit-wall', { volume: 0.6 });
          if (!reducedMotion()) { shakes.push({ s: shakeById('rumble'), t0: performance.now(), amount: 1 }); if (shakes.length > 6) shakes.shift(); }
          if (a) renderer.burst({ ...spriteDef('embers'), count: 40, position: [a.point[0], a.point[1] + 0.4, a.point[2]] });
          say('ROAR!');
          return;
        }
        case 'v3-doorbell': {
          if (!a) { say('Point at the ground'); return; }
          if (alt) { const n = snipAt(a); say(n ? 'Bell taken off' : 'No bell there'); return; }
          const zid = putZone(a, 0.8, 'Doorbell');
          putWire(zid, '', 'sound', 'Doorbell', 'ui-success');
          say('A doorbell: it chimes when a goblin steps on it'); fx('place', { volume: 0.5 });
          return;
        }
        case 'v3-cord': {
          if (!a) { say('Point at the ground'); return; }
          if (alt) { const n = snipAt(a); say(n ? (n === 1 ? 'Snip: one cord cut' : `Snip: ${n} cords cut`) : 'No cords there'); fx(n ? 'delete' : 'ui-error', { volume: 0.5 }); return; }
          const does = s.palette.wire ?? 'toggle';
          if (!wireFrom) { wireFrom = putZone(a, 0.9, does === 'light-on' ? 'Switch' : 'Step-pad'); say(does === 'light-on' ? 'Now click the lamp it lights' : 'Now click the thing it opens'); fx('place', { volume: 0.5 }); return; }
          const m = builder.modelAt(a);
          const lamp = placedLamps().map((l) => ({ l, d: Math.hypot(l.x - a.point[0], l.z - a.point[2]) })).filter((q) => q.d < 2).sort((p1, p2) => p1.d - p2.d)[0]?.l ?? null;
          const target = does === 'light-on' ? lamp?.ref ?? null : m?.ref ?? lamp?.ref ?? null;
          if (!target) { say(does === 'light-on' ? 'Click a lamp (Esc lets go of the cord)' : 'Click a thing (Esc lets go of the cord)'); return; }
          const from = wireFrom; wireFrom = null;
          putWire(from, target, does, 'Magic cord');
          say(does === 'light-on' ? 'ZAP! Step on the switch to light it' : 'ZAP! Step on the pad to open it'); fx('place', { volume: 0.6 });
          return;
        }
        case 'v3-cutter': {
          if (!a) { say('Point at a pad, a thing or a lamp'); return; }
          const n = snipAt(a);
          say(n ? (n === 1 ? 'Snip: one cord cut' : `Snip: ${n} cords cut`) : 'No cords there'); fx(n ? 'delete' : 'ui-error', { volume: 0.5 });
          return;
        }
      }
    };
    /** Using what you hold: tools act on the world; the other tabs act on a left click too (play, light, open, wear, switch). */
    const useHeld = (alt: boolean, now: number, first: boolean): void => {
      const s = player();
      const id = s.hotbars[s.tab][s.slots[s.tab]];
      const v3b = v3Now(s).button;
      if (v3b?.bind.todo || !id) { if (first) say(v3b ? `${v3b.name}: coming. ${v3b.doc}` : 'Pick something on the hotbar'); return; }
      if (id.startsWith('v3-') || id === 'logic-graph') { useV3Way(id, alt, now, first); return; }
      if (s.tab === 'select' || s.tab === 'paint' || s.tab === 'sculpt' || s.tab === 'things') {
        const own: ToolPreset | null = toolOf(s, id);
        // a way to paint puts down what the palette has picked (top middle)
        const tool: ToolPreset | null = own && own.action === 'paint' && own.way ? { ...own, surface: Number(s.palette.paint ?? 4) || 4 } : own ? withSculptPalette(own, s) : own;
        const a = aim();
        // Pro and Studio: Move, Turn and Resize pick the thing; the gizmo on it does the rest (Easy keeps click-to-carry)
        if (s.tab === 'select' && s.level !== 'easy' && tool && a && tool.action === 'inspect' && down.has('control')) {
          if (!first) return;
          const m = builder.modelAt(a);
          if (!m) { say('Point at something you placed'); return; }
          const base = group.length ? group : gizmoSel.current ? [gizmoSel.current] : [];
          const next = base.includes(m.ref) ? base.filter((r) => r !== m.ref) : [...base, m.ref];
          if (next.length === 1) { group = []; setLayerSel(next[0]!); } else group = next;
          say(next.length > 1 ? `${next.length} things in the group` : next.length === 1 ? 'One thing picked' : 'Nothing picked'); fx('select', { volume: 0.5 });
          return;
        }
        if (s.tab === 'select' && s.level !== 'easy' && tool && a && (tool.action === 'move' || tool.action === 'turn' || tool.action === 'resize')) {
          if (!first || gizmo.dragging) return;
          const m = builder.modelAt(a);
          if (m) { setLayerSel(m.ref); say(`${rt.store.get(m.ref)?.name ?? 'A thing'}: drag the gizmo; + and - size it, Shift and Ctrl snap, Alt leaves a copy`); fx('select', { volume: 0.5 }); }
          else say('Point at something you placed');
          return;
        }
        if (tool && (tool.action === 'tint' || tool.action === 'carve')) {
          // one click, one change, one undo step (a held stroke would make one step per repeat)
          if (!first) return;
          const b = blockUnder();
          if (!b) { say('Point at a thing you placed'); return; }
          if (tool.action === 'tint') tintThing(b, s.palette.tint); else carveThing(b, alt, tool.size);
          return;
        }
        if (tool && a && (tool.action === 'road' || tool.action === 'river')) {
          if (!first) return;
          const kind = tool.action;
          const width = Math.max(1.5, tool.size);
          if (!path || path.kind !== kind) path = { kind, width, pts: [] };
          if (alt) { path.pts.pop(); say(path.pts.length ? `${path.pts.length} points` : 'No points yet'); showPath(); return; }
          const last = path.pts[path.pts.length - 1];
          if (last && path.pts.length >= 2 && Math.hypot(a.point[0] - last[0], a.point[2] - last[1]) < Math.max(1.2, width / 2)) { layPath(); return; }
          path.pts.push([a.point[0], a.point[2]]);
          fx('select', { volume: 0.4 });
          say(path.pts.length === 1 ? `${tool.name}: click the next point, then the last one again to lay it` : `${path.pts.length} points: the last one again (or Enter) lays it, Esc lets go`);
          showPath();
          return;
        }
        if (tool && a && tool.action === 'rain') {
          if (!first && now - rainTick < 250) return;
          rainTick = now;
          const ts = rt.binder.terrain();
          const wet = ts ? rainOn(ts.terrain, a.point[0], a.point[2], Math.max(4, tool.size * 1.5), alt ? 0.2 : tool.strength, Math.floor(now) % 99991) : null;
          if (wet) { builder.applyHeights(wet.heights, wet.rect, 'Rain'); if (first) say('Rain: gullies form, soil washes into the hollows'); fx('splash', { volume: 0.3, minGapMs: 200 }); }
          return;
        }
        if (tool && a) {
          // Simplified's sliders: a block as wide as Width, a prop at Size
          const block = tool.action === 'things' && tool.placeWay === 'one' && tool.model.startsWith('block-') ? v3Drive(s, 'block-size') : null;
          const prop = tool.action === 'things' && tool.placeWay === 'one' && !tool.model.startsWith('block-') ? v3Drive(s, 'prop-size') : null;
          builder.use(block !== null ? { ...tool, size: Math.max(0.1, block) } : prop !== null ? { ...tool, size: tool.size * prop / 100 } : tool, a, alt, now, first);
          if (first) tourEvent((tool.action === 'place' || tool.action === 'things') && !alt ? 'placed' : tool.tab === 'sculpt' ? 'used-sculpt' : tool.tab === 'paint' ? 'used-paint' : 'used-select');
        }
        return;
      }
      // the Logic tab's ways: add the palette's rule to what you point at, take rules off it, open the island's rules
      if (s.tab === 'logic') {
        if (!first) return;
        if (id === 'logic-zone' || id === 'logic-wire') {
          const a = aim();
          if (!a) { say('Point at the ground'); return; }
          const zs = placedZones();
          const zoneNear = zs.map((z) => ({ z, d: Math.hypot(z.x - a.point[0], z.z - a.point[2]) })).filter((q) => q.d <= q.z.half + 1).sort((p, q) => p.d - q.d)[0]?.z ?? null;
          if (id === 'logic-zone') {
            if (alt) {
              if (!zoneNear) { say('No zone there'); return; }
              const zrefs = rt.store.get(scene.sceneId)?.children['zones'] ?? [], wrefs = rt.store.get(scene.sceneId)?.children['wires'] ?? [];
              rt.commands.transaction('Remove a zone', () => {
                wrefs.map((r, i) => ({ r, i })).filter(({ r }) => rt.store.get(r.ref) && rt.store.resolve(r.ref).params['from'] === zoneNear.ref).reverse().forEach(({ i }) => rt.commands.execute(cmd.removeChild(scene.sceneId, 'wires', i, 'Remove a zone')));
                const zi = zrefs.findIndex((r) => r.ref === zoneNear.ref); if (zi >= 0) rt.commands.execute(cmd.removeChild(scene.sceneId, 'zones', zi, 'Remove a zone'));
              });
              saveMap(rt, scene.sceneId); say('Zone taken away, with its wires'); fx('delete', { volume: 0.5 });
              return;
            }
            const zid = `zone-${Date.now().toString(36)}`;
            rt.commands.transaction('Zone', () => {
              rt.commands.execute(cmd.put({ id: zid, kind: 'logic-zone', name: 'Zone', params: { x: a.point[0], y: a.point[1], z: a.point[2], half: Math.max(0.5, (v3Drive(s, 'zone-size') ?? 4) / 2), when: s.palette.zone === 'leave' ? 'leave' : 'enter' } as never, tier: 'play' }, 'Zone'));
              rt.commands.execute(cmd.addChild(scene.sceneId, 'zones', zid, undefined, 'Zone'));
            });
            saveMap(rt, scene.sceneId); say('A zone: now take Wire, click it, then click what it acts on'); fx('place', { volume: 0.5 });
            return;
          }
          // Wire: the zone first, then what it acts on
          const m = builder.modelAt(a);
          const lampNear = placedLamps().map((l) => ({ l, d: Math.hypot(l.x - a.point[0], l.z - a.point[2]) })).filter((q) => q.d < 2).sort((p, q) => p.d - q.d)[0]?.l ?? null;
          const target = m?.ref ?? lampNear?.ref ?? null;
          if (alt) {
            if (!target) { say('Point at a wired thing or lamp'); return; }
            const wrefs = rt.store.get(scene.sceneId)?.children['wires'] ?? [];
            const mine = wrefs.map((r, i) => ({ r, i })).filter(({ r }) => rt.store.get(r.ref) && rt.store.resolve(r.ref).params['to'] === target);
            if (!mine.length) { say('No wires to that'); return; }
            rt.commands.transaction('Remove wires', () => { for (const { i } of [...mine].reverse()) rt.commands.execute(cmd.removeChild(scene.sceneId, 'wires', i, 'Remove wires')); });
            saveMap(rt, scene.sceneId); say(mine.length === 1 ? 'Its wire is off' : `Its ${mine.length} wires are off`); fx('delete', { volume: 0.5 });
            return;
          }
          if (!wireFrom) {
            if (!zoneNear) { say(zs.length ? 'Click a zone first (the purple boxes)' : 'Put a zone down first (Zone)'); return; }
            wireFrom = zoneNear.ref; say('Now click the thing or lamp it acts on'); fx('select', { volume: 0.5 });
            return;
          }
          const does = s.palette.wire ?? 'toggle';
          if (!target) { say('Click a thing or a lamp (Esc lets go of the wire)'); return; }
          if ((does === 'light-on' || does === 'light-off') && !lampNear) { say('Light on and off need a lamp: click a lamp'); return; }
          const wid = `wire-${Date.now().toString(36)}`;
          const from = wireFrom; wireFrom = null;
          rt.commands.transaction('Wire', () => {
            rt.commands.execute(cmd.put({ id: wid, kind: 'logic-wire', name: 'Wire', params: { from, when: rt.store.get(from as PresetId) && rt.store.resolve(from as PresetId).params['when'] === 'leave' ? 'leave' : 'enter', every: 3, to: target, do: does, sound: 'item-pickup', text: 'Hello!' } as never, tier: 'play' }, 'Wire'));
            rt.commands.execute(cmd.addChild(scene.sceneId, 'wires', wid, undefined, 'Wire'));
          });
          saveMap(rt, scene.sceneId);
          say(`Wired: walking into the zone does this: ${WIRE_DOS.find((d) => d.id === does)?.name.toLowerCase() ?? does}`); fx('place', { volume: 0.5 });
          return;
        }
        if (id === 'logic-rules') { live.current.win.open('logic', 'Rules', { x: 60, y: 80, ...WIN.editor }); unlock(); return; }
        const a = aim();
        const thing = a ? builder.modelAt(a)?.ref ?? null : null;
        const refs = rt.store.get(scene.sceneId)?.children['logic'] ?? [];
        if (id === 'logic-remove' || alt) {
          if (!thing) { say('Point at a thing to take its rules off'); return; }
          const mine = refs.map((r, i) => ({ r, i })).filter(({ r }) => rt.store.get(r.ref) && String(rt.store.resolve(r.ref).params['thing'] ?? '') === thing);
          if (!mine.length) { say('No rules on that'); return; }
          rt.commands.transaction('Remove rules', () => { for (const { i } of [...mine].reverse()) rt.commands.execute(cmd.removeChild(scene.sceneId, 'logic', i, 'Remove rules')); });
          say(mine.length === 1 ? 'Its rule is off' : `Its ${mine.length} rules are off`); fx('delete', { volume: 0.5 });
          return;
        }
        const preset = LOGIC_PRESETS.find((x) => x.id === s.palette.logic) ?? LOGIC_PRESETS[0]!;
        if (preset.needsThing && !thing) { say(`${preset.name}: point at a thing you placed`); return; }
        const rule = normalizeRule({ ...preset.rule, thing: preset.needsThing ? thing : '' }, 'new');
        const ruleId = `rule-${Date.now().toString(36)}`;
        const { id: _new, ...params } = rule;
        rt.commands.transaction(`Rule: ${preset.name}`, () => {
          rt.commands.execute(cmd.put({ id: ruleId, kind: 'logic-rule', name: preset.name, params: params as never, tier: 'play' }, `Rule: ${preset.name}`));
          rt.commands.execute(cmd.addChild(scene.sceneId, 'logic', ruleId, undefined, `Rule: ${preset.name}`));
        });
        saveMap(rt, scene.sceneId);
        say(ruleSentence(rule, thing ? (rt.store.get(thing)?.name ?? 'it').toLowerCase() : 'the island'));
        fx('place', { volume: 0.5 });
        return;
      }
      // the Animate tab's ways: a thing walks a path, or stops
      if (s.tab === 'animate' && id.startsWith('anim-')) {
        if (!first) return;
        const a = aim();
        if (!a) { say('Point at the ground'); return; }
        if (id === 'anim-stop') {
          const m = builder.modelAt(a);
          const refs = rt.store.get(scene.sceneId)?.children['paths'] ?? [];
          const mine = m ? refs.map((r, i) => ({ r, i })).filter(({ r }) => rt.store.get(r.ref) && rt.store.resolve(r.ref).params['who'] === m.ref) : [];
          if (!mine.length) { say('Point at a thing that walks'); return; }
          rt.commands.transaction('Stop walking', () => { for (const { i } of [...mine].reverse()) rt.commands.execute(cmd.removeChild(scene.sceneId, 'paths', i, 'Stop walking')); });
          saveMap(rt, scene.sceneId); say('It stays put now'); fx('delete', { volume: 0.5 });
          return;
        }
        if (!walkDraw) {
          const m = builder.modelAt(a);
          if (!m) { say('Click the thing that should walk'); return; }
          walkDraw = { who: m.ref, pts: [] };
          say(`${rt.store.get(m.ref)?.name ?? 'It'}: now click points along its way, the last one again (or Enter) to go`); fx('select', { volume: 0.5 });
          return;
        }
        if (alt) { walkDraw.pts.pop(); showWalkDraw(); return; }
        const lastPt = walkDraw.pts[walkDraw.pts.length - 1];
        if (lastPt && Math.hypot(a.point[0] - lastPt[0], a.point[2] - lastPt[1]) < 1) { layWalk(); return; }
        walkDraw.pts.push([a.point[0], a.point[2]]); showWalkDraw(); fx('select', { volume: 0.3 });
        return;
      }
      // the Camera tab's ways: an orbit shot, a photo, slow motion
      if (s.tab === 'camera' && id.startsWith('cam-')) {
        if (!first) return;
        if (id === 'cam-photo') { photoNext = true; return; }
        if (id === 'cam-slowmo') { slowOn = !slowOn; slow.setScale(slowOn ? 0.2 : 1, 0.4); say(slowOn ? 'Slow motion' : 'Back to speed'); fx('ui-toggle', { volume: 0.4 }); return; }
        const a = aim();
        const m = a ? builder.modelAt(a) : null;
        const at = m && rt.store.get(m.ref) ? (() => { const pr = rt.store.resolve(m.ref).params as Record<string, unknown>; return [Number(pr['x'] ?? 0), Number(pr['y'] ?? 0) + 1, Number(pr['z'] ?? 0)] as [number, number, number]; })() : [px, py + 1, pz] as [number, number, number];
        const from = eye ? (Math.atan2(eye[0] - at[0], eye[2] - at[2]) * 180) / Math.PI : 0;
        shot = { track: orbitShot(at, 6, 2.5, Math.max(1, v3Drive(s, 'orbit-time') ?? 8), from, 1, 55), t: 0 };
        say(m ? `Flying round ${rt.store.get(m.ref)?.name ?? 'it'} (Esc stops)` : 'Flying round you (Esc stops)'); fx('ui-toggle', { volume: 0.4 });
        return;
      }
      // the Physics tab's ways: give the thing you point at the palette's material, drop it, or swing the push hammer
      if (s.tab === 'physics') {
        if (!first) return;
        const a = aim();
        if (!a) { say('Point at something'); return; }
        const mat = s.palette.physics ?? 'rubber';
        const matName = PHYS_ITEMS.find((m) => m.id === mat)?.name ?? mat;
        if (id === 'phys-hammer') {
          const refs = (rt.store.get(scene.sceneId)?.children['models'] ?? []).map((r) => physThing(r.ref)).filter((t): t is PhysThing => !!t);
          const n = physics.swing([a.point[0], a.point[1], a.point[2]], 6, alt ? 1 : 4, refs);
          fx(n ? 'boost' : 'ui-error', { volume: 0.6 });
          say(n ? `Bonk! ${n === 1 ? 'One thing flies' : `${n} things fly`}` : 'Nothing near enough to push');
          return;
        }
        const m = builder.modelAt(a);
        if (!m) { say('Point at something you placed'); return; }
        if (id === 'phys-give') {
          const give = alt ? 'wood' : mat;
          rt.commands.execute(cmd.setParam(`${m.ref}.phys`, give as never, `Made of ${give}`));
          saveMap(rt, scene.sceneId);
          say(`${rt.store.get(m.ref)?.name ?? 'It'} is ${alt ? 'wood' : matName.toLowerCase()} now: Drop shows how it lands`); fx('select', { volume: 0.5 });
          return;
        }
        const t = physThing(m.ref);
        if (t) { physics.drop(t, alt ? 6 : 3); fx('jump', { volume: 0.4 }); }
        return;
      }
      // the Characters tab's ways: spawn a goblin with the palette's behaviour, give the one you point at that behaviour, take one away
      if (s.tab === 'characters') {
        if (!first) return;
        const a = aim();
        if (!a) { say('Point at the ground'); return; }
        const brain = s.palette.characters && isCharBrain(s.palette.characters) ? s.palette.characters : 'wander';
        const bname = CHAR_BRAINS.find((b) => b.id === brain)?.name ?? brain;
        const refs = rt.store.get(scene.sceneId)?.children['characters'] ?? [];
        // the character nearest where you point (where it walks to now, not where it was put)
        let near = -1, nearD = 1.6;
        refs.forEach((r, i) => { const di = charRefs.indexOf(r.ref); const pr = rt.store.get(r.ref) ? rt.store.resolve(r.ref).params : null; if (!pr) return; const at = di >= 0 ? lastCharAt.get(r.ref) : undefined; const x = at?.[0] ?? Number(pr['x'] ?? 0), z = at?.[1] ?? Number(pr['z'] ?? 0); const d = Math.hypot(x - a.point[0], z - a.point[2]); if (d < nearD) { nearD = d; near = i; } });
        if (id === 'chars-remove' || (alt && id === 'chars-spawn')) {
          if (near < 0) { say('Point at a character'); return; }
          rt.commands.execute(cmd.removeChild(scene.sceneId, 'characters', near, 'Remove a character'));
          saveMap(rt, scene.sceneId); refreshModels(); say('Character taken away'); fx('delete', { volume: 0.5 });
          return;
        }
        if (id === 'chars-change') {
          const r = refs[near];
          if (!r) { say('Point at a character'); return; }
          rt.commands.execute(cmd.setParam(`${r.ref}.brain`, brain as never, `Behaves: ${bname}`));
          saveMap(rt, scene.sceneId); say(`It does this now: ${bname}`); fx('select', { volume: 0.5 });
          return;
        }
        const charId = `char-${Date.now().toString(36)}`;
        const yaw = (Math.atan2(px - a.point[0], pz - a.point[2]) * 180) / Math.PI;
        rt.commands.transaction(`Character: ${bname}`, () => {
          rt.commands.execute(cmd.put({ id: charId, kind: 'character', name: 'Goblin', params: { brain, look: AVATAR_LOOKS[Math.floor(Math.random() * AVATAR_LOOKS.length)]!.id, x: a.point[0], y: a.point[1], z: a.point[2], yaw, size: 1 } as never, tier: 'play' }, `Character: ${bname}`));
          rt.commands.execute(cmd.addChild(scene.sceneId, 'characters', charId, undefined, `Character: ${bname}`));
        });
        saveMap(rt, scene.sceneId); refreshModels();
        say(`A goblin: ${CHAR_BRAINS.find((b) => b.id === brain)?.doc ?? bname}`); fx('place', { volume: 0.5 });
        return;
      }
      // the Sound tab's ways: play the palette's pick, place it (an ambience becomes a zone, a sound repeats from its spot), take the nearest away, list them
      if (s.tab === 'sound' && id.startsWith('sound-')) {
        if (!first) return;
        if (id === 'sound-list') { live.current.win.open('soundscape', 'Sounds here', { x: 60, y: 80, ...WIN.editor }); unlock(); return; }
        const what = s.palette.sound ?? 'forest-birds';
        const name = isAmbience(what) ? AMBIENCES.find((a) => a.id === what)?.name ?? what : soundName(what);
        if (id === 'sound-play') {
          if (isAmbience(what)) {
            const amb = AMBIENCES.find((a) => a.id === what);
            const eng = audio();
            if (amb && eng) { eng.setBed(`preview-${what}`, amb.layers, 0.5); window.setTimeout(() => eng.setBed(`preview-${what}`, amb.layers, 0), 3000); }
          } else fx(what as SfxId);
          say(name);
          return;
        }
        const a = aim();
        if (!a) { say('Point at the ground'); return; }
        const refs = rt.store.get(scene.sceneId)?.children['soundscape'] ?? [];
        if (id === 'sound-remove' || alt) {
          let best = -1, bestD = 4;
          refs.forEach((r, i) => { if (!rt.store.get(r.ref)) return; const pr = rt.store.resolve(r.ref).params; const d = Math.hypot(Number(pr['x'] ?? 0) - a.point[0], Number(pr['z'] ?? 0) - a.point[2]); if (d < bestD) { bestD = d; best = i; } });
          if (best < 0) { say('No placed sound near there'); return; }
          rt.commands.execute(cmd.removeChild(scene.sceneId, 'soundscape', best, 'Remove a placed sound'));
          saveMap(rt, scene.sceneId); say('Sound taken away'); fx('delete', { volume: 0.5 });
          return;
        }
        const spotId = `sound-${Date.now().toString(36)}`;
        const zone = isAmbience(what);
        rt.commands.transaction(`Sound: ${name}`, () => {
          rt.commands.execute(cmd.put({ id: spotId, kind: 'sound-spot', name, params: { what, x: a.point[0], y: a.point[1], z: a.point[2], size: zone ? 8 : Math.max(1, v3Drive(s, 'hearing') ?? 10), volume: Math.min(1, Math.max(0, (v3Drive(s, zone ? 'amb-volume' : 'loudness') ?? 80) / 100)), every: 4, on: true } as never, tier: 'play' }, `Sound: ${name}`));
          rt.commands.execute(cmd.addChild(scene.sceneId, 'soundscape', spotId, undefined, `Sound: ${name}`));
        });
        saveMap(rt, scene.sceneId);
        say(zone ? `${name}: a zone, you hear it when you are near` : `${name}: it plays from here every few seconds`); fx('place', { volume: 0.5 });
        return;
      }
      // the Effects tab's ways: place the palette's effect where you point, play it once, or take the nearest away
      if (s.tab === 'effects') {
        if (!first) return;
        const a = aim();
        if (!a) { say('Point at the ground'); return; }
        const kind = s.palette.effects ?? 'campfire';
        const name = PARTICLE_PRESETS.find((p) => p.id === kind)?.name ?? kind;
        if (id === 'effects-once') { effects.once(kind, [a.point[0], a.point[1], a.point[2]]); fx('select', { volume: 0.4 }); return; }
        const refs = rt.store.get(scene.sceneId)?.children['effects'] ?? [];
        if (id === 'effects-remove' || alt) {
          let best = -1, bestD = 3;
          refs.forEach((r, i) => { if (!rt.store.get(r.ref)) return; const pr = rt.store.resolve(r.ref).params; const d = Math.hypot(Number(pr['x'] ?? 0) - a.point[0], Number(pr['z'] ?? 0) - a.point[2]); if (d < bestD) { bestD = d; best = i; } });
          if (best < 0) { say('No effect near there'); return; }
          rt.commands.execute(cmd.removeChild(scene.sceneId, 'effects', best, 'Remove an effect'));
          saveMap(rt, scene.sceneId); say('Effect taken away'); fx('delete', { volume: 0.5 });
          return;
        }
        const effectId = `effect-${Date.now().toString(36)}`;
        rt.commands.transaction(`Effect: ${name}`, () => {
          rt.commands.execute(cmd.put({ id: effectId, kind: 'effect', name, params: { preset: kind, x: a.point[0], y: a.point[1], z: a.point[2], scale: Math.min(5, Math.max(0.2, (v3Drive(s, 'effect-size') ?? 2) / 2)), on: true } as never, tier: 'play' }, `Effect: ${name}`));
          rt.commands.execute(cmd.addChild(scene.sceneId, 'effects', effectId, undefined, `Effect: ${name}`));
        });
        saveMap(rt, scene.sceneId);
        say(`${name} placed`); fx('place', { volume: 0.5 });
        return;
      }
      // the Lights tab's ways act on the light where you are (the Sun keeps moving while held)
      if (s.tab === 'lights' && (id === 'light-lamp' || id === 'light-lamp-remove')) {
        if (!first) return;
        const a = aim();
        if (!a) { say('Point at the ground'); return; }
        const refs = rt.store.get(scene.sceneId)?.children['lamps'] ?? [];
        if (id === 'light-lamp-remove' || alt) {
          let best = -1, bestD = 3;
          refs.forEach((r, i) => { if (!rt.store.get(r.ref)) return; const pr = rt.store.resolve(r.ref).params; const d = Math.hypot(Number(pr['x'] ?? 0) - a.point[0], Number(pr['z'] ?? 0) - a.point[2]); if (d < bestD) { bestD = d; best = i; } });
          if (best < 0) { say('No lamp near there'); return; }
          rt.commands.execute(cmd.removeChild(scene.sceneId, 'lamps', best, 'Remove a lamp'));
          saveMap(rt, scene.sceneId); say('Lamp taken away'); fx('delete', { volume: 0.5 });
          return;
        }
        const kind = s.palette.lamp && lampById(s.palette.lamp) ? s.palette.lamp : 'bulb';
        const lp = lampById(kind)!;
        // a spotlight hangs high and points down; a campfire or a candle sits low; the rest float at lamp height
        const lift = lp.kind === 'spot' ? 3 : kind === 'campfire' ? 0.4 : kind === 'candle' ? 0.5 : kind === 'torch' ? 1.6 : 1.2;
        const lampId = `lamp-${Date.now().toString(36)}`;
        rt.commands.transaction(`Lamp: ${lp.name}`, () => {
          rt.commands.execute(cmd.put({ id: lampId, kind: 'lamp', name: lp.name, params: { preset: kind, x: a.point[0], y: a.point[1] + lift, z: a.point[2], yaw: 0, pitch: 90, brightness: Math.min(3, Math.max(0, (v3Drive(s, 'lamp-brightness') ?? 50) / 50)), on: true } as never, tier: 'play' }, `Lamp: ${lp.name}`));
          rt.commands.execute(cmd.addChild(scene.sceneId, 'lamps', lampId, undefined, `Lamp: ${lp.name}`));
        });
        saveMap(rt, scene.sceneId);
        say(renderer.lampSlots > 0 ? `${lp.name}: it shows best at dusk and at night (Day and night)` : `${lp.name} placed (lamps are not lit on Potato graphics)`); fx('place', { volume: 0.5 });
        return;
      }
      if (s.tab === 'lights' && isLightWay(id)) {
        const holds = LIGHT_WAYS.find((w) => w.id === id)?.hold === true;
        if (!first && (!holds || now - lightTick < 120)) return;
        lightTick = now;
        const said = applyLightWay(rt, scene.sceneId, id, alt, s.palette.lights);
        if (said) say(said);
        if (first) fx('ui-toggle', { volume: 0.4 });
        return;
      }
      if (!first) return;
      if (s.tab === 'animate' && alt) { animator.stop(); return; }
      applyNow(s.tab, id);
    };

    /** The right button, or Shift standing still while walking: the opposite action. */
    const altHeld = (): boolean => (mouse & 2) !== 0 || (!studio() && down.has('shift') && !down.has('w'));
    /** A press uses the tool at once (a click shorter than a frame still counts); holding it repeats from the frame loop. */
    const pressNow = (): void => {
      if (!live.current.buildOn || live.current.menu || live.current.level === 'island' || intro.on) return;
      useHeld(altHeld(), performance.now(), true);
      firstUse = false;
    };

    /** The main menu's camera angle round the goblin: it sways on the side away from the middle of the island. */
    // it starts from the side away from the island's middle and turns to the nearest angle whose whole sway sees the goblin past every plant
    const SWAY = 0.5, MENU_DIST = 7;
    let menuBase: number | null = null;
    const shotBlocked = (a: number): number => {
      const d = rt.binder.decor()?.placements ?? [];
      const ex = px + Math.sin(a) * MENU_DIST, ez = pz + Math.cos(a) * MENU_DIST;
      let hits = 0;
      for (const p of d) {
        if (p.kind !== 'palm' && p.kind !== 'bush' && p.kind !== 'boulder') continue;
        // distance from the plant to the camera-goblin segment, on the ground plane
        const vx = px - ex, vz = pz - ez, wx = p.x - ex, wz = p.z - ez;
        const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz)));
        if (Math.hypot(wx - vx * t, wz - vz * t) < 1.4 + p.scale * 0.6) hits++;
      }
      return hits;
    };
    const menuAngle = (now: number): number => {
      if (menuBase === null) {
        const out = Math.hypot(px, pz) > 1 ? Math.atan2(px, pz) : 0.6;
        let best = out, bestCost = Infinity;
        for (let i = 0; i < 24; i++) {
          const a = out + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12);
          let cost = Math.ceil(i / 2) * 0.01;
          for (const k of [-1, -0.5, 0, 0.5, 1]) cost += shotBlocked(a + k * SWAY);
          if (cost < bestCost) { bestCost = cost; best = a; }
        }
        menuBase = best;
      }
      return menuBase + Math.sin(now * 0.00007) * SWAY;
    };

    let raf = 0, last = performance.now(), drawn = 0;
    let prevX = px, prevZ = pz;
    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      // slow motion (the Camera tab): the world's time, not yours
      const worldDt = slow.tick(dt);
      if (physics.active) {
        const ts = rt.binder.terrain();
        for (const q of physics.step(worldDt, (x, z) => (ts ? heightAt(ts.terrain, x, z) : 0))) { const i = drawnIndex(q.ref as PresetId); if (i >= 0) renderer.setModelPose(i, q.x, q.y, q.z, Number(rt.store.resolve(q.ref as PresetId).params['yaw'] ?? 0)); }
        const done = physics.settled();
        if (done && done.length) {
          const label = physics.label;
          rt.commands.transaction(label, () => { for (const q of done) { if (!rt.store.get(q.ref as PresetId)) continue; rt.commands.execute(cmd.setParam(`${q.ref}.x`, q.x, label)); rt.commands.execute(cmd.setParam(`${q.ref}.y`, q.y, label)); rt.commands.execute(cmd.setParam(`${q.ref}.z`, q.z, label)); } });
          physSettled++; saveMap(rt, scene.sceneId); refreshModels();
        }
      }
      const allChars = live.current.isolateId ? [] : placedChars();
      // added or taken away (a panel, undo): draw the list again
      if (!live.current.isolateId && (allChars.length !== charRefs.length || allChars.some((c, i) => c.ref !== charRefs[i]))) refreshModels();
      if (charRefs.length) {
        const list = allChars;
        const ts = rt.binder.terrain(), sea = rulesOf(rt, scene.sceneId).waterLevel;
        const poses = chars.step(worldDt, list, [px, py, pz], (x, z) => { if (!ts) return 0; const h = heightAt(ts.terrain, x, z); return h < sea + 0.1 ? null : h; });
        charMoved = 0;
        poses.forEach((q, k) => { lastCharAt.set(q.ref, [q.x, q.z]); const i = charRefs.indexOf(q.ref); if (i >= 0) renderer.setModelPose(charBase + i, q.x, q.y, q.z, q.yaw + 180); const home = list[k]; if (home) charMoved = Math.max(charMoved, Math.hypot(q.x - home.x, q.z - home.z)); });
      }
      {
        const lamps = placedLamps();
        if (lamps.length || lampsLit) {
          const t = now / 1000;
          const lit = lamps.flatMap((l, i) => { const p = l.on && !lampsOff.has(l.ref) ? lampById(l.preset) : undefined; return p ? [{ l, p, intensity: p.intensity * l.brightness * flicker(p.flicker, p.rate, t, i * 7919 + 13) }] : []; });
          const ear: [number, number, number] = eye ? [eye[0], eye[1], eye[2]] : [px, py, pz];
          const best = pickLights(lit.map((x) => ({ pos: [x.l.x, x.l.y, x.l.z] as [number, number, number], intensity: x.intensity, range: x.p.range, on: true })), ear, renderer.lampSlots);
          renderer.setLamps(best.map((i) => { const x = lit[i]!; const yaw = (x.l.yaw * Math.PI) / 180, pitch = (x.l.pitch * Math.PI) / 180;
            return { kind: x.p.kind, pos: [x.l.x, x.l.y, x.l.z] as const, dir: [Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)] as const, color: x.p.color, intensity: x.intensity, range: x.p.range, angle: x.p.angle, penumbra: x.p.penumbra }; }));
          lampsLit = best.length;
        }
      }
      {
        const zs = placedZones(), ws = placedWires();
        // the wires changed (an undo, a new wire): what they did starts over
        const wkey = ws.map((w) => w.ref + w.do + w.to + w.from).join('|');
        if (wkey !== wiresKey) { wiresKey = wkey; wireHidden.clear(); lampsOff.clear(); }
        if (ws.length) {
          const ts = rt.binder.terrain();
          const actors: [number, number, number][] = [[px, py, pz], ...[...lastCharAt.values()].map(([x, z]) => [x, ts ? heightAt(ts.terrain, x, z) : py, z] as [number, number, number])];
          wires.step(dt, zs, ws, actors).forEach(applyWire);
        }
        // hidden by a wire: only for show, like the rules (the island never changes)
        for (const ref of [...wireHidden, ...wirePosed]) {
          const at = thingAt(ref), i = drawnIndex(ref as PresetId);
          if (!at || i < 0) continue;
          const yaw = Number(rt.store.resolve(ref as PresetId).params['yaw'] ?? 0);
          if (wireHidden.has(ref)) { renderer.setModelPose(i, at[0], at[1] - 9999, at[2], yaw); wirePosed.add(ref); }
          else { renderer.setModelPose(i, at[0], at[1], at[2], yaw); wirePosed.delete(ref); }
        }
        const showWires = live.current.buildOn && player().tab === 'logic' && (zs.length > 0 || !!wireFrom);
        if (showWires) {
          const lampPos = (ref: string): [number, number, number] | null => { const l = placedLamps().find((q) => q.ref === ref); return l ? [l.x, l.y, l.z] : null; };
          renderer.overlay.show('wires', [
            ...zs.map((z) => ({ type: 'box' as const, center: [z.x, z.y + 1, z.z] as [number, number, number], half: [z.half, Math.max(1, z.half / 2), z.half] as [number, number, number], color: z.ref === wireFrom ? '#ffc53d' : '#8e6be8' })),
            ...ws.flatMap((w) => { const z = zs.find((q) => q.ref === w.from); const to = thingAt(w.to) ?? lampPos(w.to); return z && to ? [{ type: 'line' as const, from: [z.x, z.y + 1.5, z.z] as [number, number, number], to: [to[0], to[1] + 1, to[2]] as [number, number, number], color: '#8e6be8' }] : []; }),
          ]);
          wiresShown = true;
        } else if (wiresShown) { renderer.overlay.hide('wires'); wiresShown = false; }
      }
      // a path being drawn lets go when you put the Road or River down
      if (path) { const pl = player(); const held = toolOf(pl, pl.hotbars[pl.tab][pl.slots[pl.tab]] ?? ''); if (pl.tab !== 'sculpt' || held?.action !== path.kind) { path = null; showPath(); } }
      {
        walkClock += worldDt;
        const walks = placedWalks();
        const ts = rt.binder.terrain();
        const walking = new Set<string>();
        walkMoved = 0;
        for (const w of walks) {
          const at = thingAt(w.who), i = drawnIndex(w.who as PresetId);
          if (!at || i < 0) continue;
          const s = walkerAt(w.path, walkClock);
          const gy = ts ? heightAt(ts.terrain, s.pos[0], s.pos[2]) : at[1];
          renderer.setModelPose(i, s.pos[0], gy + (s.moving ? Math.abs(Math.sin(walkClock * 8)) * 0.05 : 0), s.pos[2], s.yaw);
          walking.add(w.who); walkPosed.add(w.who);
          walkMoved = Math.max(walkMoved, Math.hypot(s.pos[0] - at[0], s.pos[2] - at[2]));
        }
        for (const ref of [...walkPosed]) if (!walking.has(ref)) { walkPosed.delete(ref); const at = thingAt(ref), i = drawnIndex(ref as PresetId); if (at && i >= 0) renderer.setModelPose(i, at[0], at[1], at[2], Number(rt.store.resolve(ref as PresetId).params['yaw'] ?? 0)); }
        if (walkDraw) { const pl = player(); if (pl.tab !== 'animate' || pl.hotbars.animate[pl.slots.animate] !== 'anim-path') { walkDraw = null; showWalkDraw(); } }
      }
      effects.sync(placedEffects());
      {
        const spots = placedSounds();
        const ear: [number, number, number] = eye ? [eye[0], eye[1], eye[2]] : [px, py, pz];
        soundscape.update(dt, ear, (camYaw * 180) / Math.PI, spots, audio(), (sound, volume) => fx(sound as SfxId, { volume }));
        const showSpots = live.current.buildOn && player().tab === 'sound' && spots.length > 0;
        if (showSpots) {
          renderer.overlay.show('soundscape', spots.map((sp) => isAmbience(sp.what)
            ? { type: 'box' as const, center: zoneOf(sp).centre, half: zoneOf(sp).half, color: sp.on ? '#2bb3a3' : '#9a9a9a' }
            : { type: 'ring' as const, center: emitterOf(sp).pos, normal: [0, 1, 0] as [number, number, number], radius: Math.max(0.6, emitterOf(sp).radius), width: 0.12, color: sp.on ? '#f08a24' : '#9a9a9a' }));
          soundOverlay = true;
        } else if (soundOverlay) { renderer.overlay.hide('soundscape'); soundOverlay = false; }
      }
      effects.step(worldDt);
      renderer.setParticles('glow', effects.glow.buffer, effects.glow.count);
      renderer.setParticles('plain', effects.plain.buffer, effects.plain.count);
      if (now - lastTourTick > 250) { lastTourTick = now; tourTick(); }
      if (intro.on) {
        intro.t += dt * 1000;
        const k = Math.min(1, intro.t / intro.ms), e = 1 - Math.pow(1 - k, 3);
        camDist = 150 + (3.6 - 150) * e; camPitch = 1.3 + (0.3 - 1.3) * e; camYaw = Math.PI + (1 - e) * 1.2;
        if (k >= 1) { intro.on = false; onIntroDone?.(); }
      }
      const overview = live.current.level === 'island' || live.current.showcase;
      const st = studio() && !live.current.showcase; // a showcase (the home's Goblin Racing window) is never the studio, whatever mode your island was left in
      const mirrorOn = live.current.avatarMode && !overview && !st;
      const fpv = player().view === 'first' && !st && !mirrorOn;
      const paused = live.current.menu || overview || mirrorOn;
      let grounded = true;
      if (!paused && !st) {
        const fwx = -Math.sin(camYaw), fwz = -Math.cos(camYaw), rx = -fwz, rz = fwx;
        let mx = 0, mz = 0;
        if (down.has('w') || down.has('arrowup')) { mx += fwx; mz += fwz; }
        if (down.has('s') || down.has('arrowdown')) { mx -= fwx; mz -= fwz; }
        if (down.has('d') || down.has('arrowright')) { mx += rx; mz += rz; }
        if (down.has('a') || down.has('arrowleft')) { mx -= rx; mz -= rz; }
        const len = Math.hypot(mx, mz);
        if (len > 0 && !intro.on) {
          const speed = (down.has('shift') ? 8 : 3.6) * dt;
          const nx = px + (mx / len) * speed, nz = pz + (mz / len) * speed;
          if (now - lastMoveEvent > 400) { lastMoveEvent = now; tourEvent('moved'); }
          if (ground(nx, nz) >= SEA) { px = nx; pz = nz; }
          else if (ground(nx, pz) >= SEA) px = nx;
          else if (ground(px, nz) >= SEA) pz = nz;
        }
        // FPS rules: with the mouse captured the goblin always faces where you look (strafing and backing up included); without it it faces where it walks
        const lookingBy = pointerLocked || softAim;
        if ((lookingBy || len > 0) && !intro.on) {
          const want = lookingBy ? Math.atan2(fwx, fwz) : Math.atan2(mx, mz);
          let dAng = want - face; while (dAng > Math.PI) dAng -= 2 * Math.PI; while (dAng < -Math.PI) dAng += 2 * Math.PI;
          face += dAng * Math.min(1, dt * (lookingBy ? 22 : 14));
        }
        // gravity and a jump on Space
        const g = ground(px, pz);
        grounded = py <= g + 0.04;
        if (grounded && down.has(' ') && !intro.on) { vy = 6.4; tourEvent('jumped'); }
        vy -= 18 * dt;
        let ny = py + vy * dt;
        if (ny <= g) { ny = g; vy = 0; }
        py = ny;
        grounded = py <= g + 0.04;
      }
      // using what you hold, every frame the button is down
      if (mouse && live.current.buildOn && !paused) { useHeld(altHeld(), now, firstUse); firstUse = false; }

      // the goblin: animation from how it moved this frame
      const speed = dt > 0 ? Math.hypot(px - prevX, pz - prevZ) / dt : 0;
      prevX = px; prevZ = pz;
      animator.setMoves(moves());
      const pose = animator.update(dt, { speed: paused ? 0 : speed, grounded, vy });
      // behind the main menu the goblin turns three-quarters toward the camera
      if (live.current.showcase) face = menuAngle(now) - 0.45;
      else menuBase = null;
      renderer.setAvatarPose(px, py, pz, face + Math.PI, pose, !fpv && !st);
      renderer.setLightFocus([px, py + 1.2, pz]);
      // Logic: the island's rules run as you play (they only pose things for show: the island itself never changes)
      {
        const rr = rt.store.get(scene.sceneId)?.children['logic'] ?? [];
        if (rr.length || logicPosed.size) {
          const rules = rr.filter((r) => rt.store.get(r.ref)).map((r) => normalizeRule(rt.store.resolve(r.ref).params, r.ref));
          const modelRefs = (rt.store.get(scene.sceneId)?.children['models'] ?? []).filter((r) => rt.store.get(r.ref) && rt.store.resolve(r.ref).params['hidden'] !== true);
          const things = new Map<string, { x: number; y: number; z: number; yaw: number; index: number }>();
          modelRefs.forEach((r, index) => { const pr = rt.store.resolve(r.ref).params; things.set(r.ref, { x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), yaw: Number(pr['yaw'] ?? 0), index }); });
          const out = logic.step(rules, { player: [px, py, pz], things, hour: Number(rt.store.resolve(scene.sceneId).params['timeOfDay'] ?? -1), now: now / 1000 });
          for (const ev of out.events) { if (ev.kind === 'sound') fx(ev.id as SfxId); else say(ev.text); }
          if (!live.current.isolateId) for (const [ref, pose] of out.poses) {
            const t = things.get(ref);
            if (!t) continue;
            renderer.setModelPose(t.index, t.x, pose.hidden ? t.y - 9999 : t.y + pose.dy, t.z, t.yaw + pose.dyaw);
            if (pose.dy || pose.dyaw || pose.hidden) logicPosed.add(ref); else logicPosed.delete(ref);
          }
        }
      }

      const head = fpv ? 1.62 : 0.9;
      let wantEye: [number, number, number], target: [number, number, number];
      const fid = live.current.focusId;
      const ft = fid ? focusTargetOf(rt, fid) : null;
      if (ft) {
        // focus: orbit the thing; the world whites out around it
        orbit = { ...orbit, dist: orbit.dist || ft.radius * 3 };
        const c = ft.center;
        target = [c[0], c[1], c[2]];
        wantEye = [c[0] + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, c[1] + Math.sin(orbit.pitch) * orbit.dist, c[2] + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist];
        renderer.setFocus({ target: c, radius: ft.radius, veil: true, hideNear: true, falloff: 14 });
      } else if (st) {
        // studio: fly
        if (!fly) { const e0 = eye ?? [px, py + 3, pz + 5]; fly = { x: e0[0], y: e0[1], z: e0[2], yaw: camYaw, pitch: -0.25 }; }
        const fx3 = -Math.sin(fly.yaw) * Math.cos(fly.pitch), fy3 = Math.sin(fly.pitch), fz3 = -Math.cos(fly.yaw) * Math.cos(fly.pitch);
        const rx3 = Math.cos(fly.yaw), rz3 = -Math.sin(fly.yaw);
        const sp = (down.has('shift') ? 24 : 8) * dt;
        if (!live.current.menu) {
          if (down.has('w') || down.has('arrowup')) { fly.x += fx3 * sp; fly.y += fy3 * sp; fly.z += fz3 * sp; }
          if (down.has('s') || down.has('arrowdown')) { fly.x -= fx3 * sp; fly.y -= fy3 * sp; fly.z -= fz3 * sp; }
          if (down.has('d') || down.has('arrowright')) { fly.x += rx3 * sp; fly.z += rz3 * sp; }
          if (down.has('a') || down.has('arrowleft')) { fly.x -= rx3 * sp; fly.z -= rz3 * sp; }
          if (down.has(' ')) fly.y += sp;
          if (down.has('c') || down.has('control')) fly.y -= sp;
        }
        fly.y = Math.max(fly.y, ground(fly.x, fly.z) + 0.4);
        wantEye = [fly.x, fly.y, fly.z];
        target = [fly.x + fx3, fly.y + fy3, fly.z + fz3];
      } else if (fpv) {
        fly = null;
        wantEye = [px, py + head, pz];
        const cp = Math.cos(camPitch);
        target = [px - Math.sin(camYaw) * cp, py + head - Math.sin(camPitch), pz - Math.cos(camYaw) * cp];
      } else {
        fly = null;
        // over the shoulder: the goblin sits to the left of the crosshair so the crosshair always has a clear view
        const rgx = Math.cos(camYaw), rgz = -Math.sin(camYaw), shoulder = intro.on ? 0 : 0.85;
        target = [px + rgx * shoulder, py + head + 0.25, pz + rgz * shoulder];
        wantEye = [px + rgx * shoulder + Math.sin(camYaw) * Math.cos(camPitch) * camDist, py + head + 0.25 + Math.sin(camPitch) * camDist, pz + rgz * shoulder + Math.cos(camYaw) * Math.cos(camPitch) * camDist];
        wantEye[1] = Math.max(wantEye[1], ground(wantEye[0], wantEye[2]) + 0.6);
      }
      // tests and look reviews: hold the camera at a given eye and target (window.hmPinView = { eye, target }, null lets go)
      const pin = (window as unknown as { hmPinView?: { eye: [number, number, number]; target: [number, number, number] } | null }).hmPinView;
      if (pin) { wantEye = pin.eye; target = pin.target; }
      if (shot) {
        shot.t += dt;
        if (shot.t > trackDuration(shot.track)) shot = null;
        else { const c = sampleTrack(shot.track, shot.t); wantEye = [c.pos[0], c.pos[1], c.pos[2]]; target = [c.target[0], c.target[1], c.target[2]]; }
      }
      if (!ft && !live.current.focusId) renderer.setFocus(null);
      if (live.current.showcase) {
        // the main menu's view: the camera sways round your goblin on the side away from the middle of the island, so the goblin stands in
        // front and the volcano (or whatever is in the middle) rises behind it; it never passes through a hill
        const a = menuAngle(now);
        // aim a little to the goblin's left so it stands in the right third of the screen, clear of the menu
        const rx = Math.cos(a), rz = -Math.sin(a);
        const fr = frameRef.current;
        // a window onto this view (the SetMix home): stand back so the island shows round the goblin, and aim so the goblin stands across the
        // screen where the window is; the camera stays level, so the horizon and the sky sit in the middle of the window
        const dist = fr ? MENU_DIST * 1.6 : MENU_DIST;
        const vf = Math.tan(((controlsRef.current.fov - 15) * Math.PI) / 360), aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const off = fr ? (fr.x - 0.5) * 2 * vf * aspect * dist : 2;
        // in a window, look down a touch at the goblin's middle: it stands mid-window with the horizon and sky above it
        target = [px - rx * off, py + (fr ? 1.45 : 1.9), pz - rz * off];
        wantEye = [px + Math.sin(a) * dist, py + (fr ? 2.6 : 2.3), pz + Math.cos(a) * dist];
        wantEye[1] = Math.max(wantEye[1], ground(wantEye[0], wantEye[2]) + 1.2);
      } else if (overview) { const a = now * 0.00008; target = [0, 6, 0]; wantEye = [Math.sin(a) * 150, 85, Math.cos(a) * 150]; }
      else if (mirrorOn && !ft) {
        // the mirror: in front of your avatar, a little round to one side; aimed so it stands left of the middle, clear of the dock on the right
        const a = face + mirror.turn, d = mirror.dist;
        const vf = Math.tan(((controlsRef.current.fov - 15) * Math.PI) / 360), aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const off = window.innerWidth > 760 ? 0.26 * vf * aspect * d : 0;
        const rx = Math.cos(a), rz = -Math.sin(a);
        const mid = py + 0.92;
        target = [px + rx * off, mid, pz + rz * off];
        wantEye = [px + Math.sin(a) * d, mid + 0.25 + mirror.lift * d * 0.6, pz + Math.cos(a) * d];
        wantEye[1] = Math.max(wantEye[1], ground(wantEye[0], wantEye[2]) + 0.4);
      }
      const snap = (fpv || st) && !overview && !ft;
      const k = snap ? 1 : Math.min(1, dt * (overview ? 3 : 10));
      eye = eye && !snap ? [eye[0] + (wantEye[0] - eye[0]) * k, eye[1] + (wantEye[1] - eye[1]) * k, eye[2] + (wantEye[2] - eye[2]) * k] : wantEye;
      const fov = controlsRef.current.fov;
      renderer.setFov(fpv ? fov : st ? fov - 10 : fov - 15);
      // camera-shake plugs wobble the view (never the stored eye, so the camera settles back exactly)
      let sx = 0, sy = 0, sz = 0;
      for (let i = shakes.length - 1; i >= 0; i--) {
        const sh = shakes[i]!, t = now - sh.t0;
        if (t >= sh.s.ms) { shakes.splice(i, 1); continue; }
        const o = shakeOffset(sh.s, t, sh.amount); sx += o[0]; sy += o[1]; sz += o[2];
      }
      if (sx || sy || sz) renderer.camera.set([eye[0] + sx, eye[1] + sy, eye[2] + sz], [target[0] + sx * 0.5, target[1] + sy * 0.5, target[2] + sz * 0.5]);
      else renderer.camera.set(eye, target);
      {
        const pl = player(), sel = gizmoSel.current;
        const on = live.current.buildOn && pl.level !== 'easy' && !live.current.menu && !live.current.avatarMode && !texRef.current;
        group = group.filter((r) => rt.store.get(r));
        const refs = group.length > 1 ? group : sel ? [sel] : [];
        gizmoTargets = on ? refs.map((ref) => ({ ref, index: drawnIndex(ref) })).filter((t) => t.index >= 0) : [];
        if (on && group.length > 1) {
          renderer.overlay.show('group', group.flatMap((ref) => { if (!rt.store.get(ref)) return []; const pr = rt.store.resolve(ref).params as Record<string, unknown>; const [sx, sy, sz] = sizeOf(ref); return [{ type: 'box' as const, center: [Number(pr['x'] ?? 0), Number(pr['y'] ?? 0) + sy / 2, Number(pr['z'] ?? 0)] as [number, number, number], half: [sx / 2 + 0.05, sy / 2 + 0.05, sz / 2 + 0.05] as [number, number, number], color: '#ffc53d' }]; }));
          groupShown = true;
        } else if (groupShown) { renderer.overlay.hide('group'); groupShown = false; }
        gizmoFov = fpv ? fov : st ? fov - 10 : fov - 15;
        gizmo.frame(gizmoTargets, gizmoModeFor(pl.tab === 'select' ? pl.hotbars.select[pl.slots.select] : 'move'), gizmoRay(), gizmoFov, gizmoSnap());
      }
      renderer.step();
      // seen through a window (the SetMix home): shade only what the window shows
      const clipEl = clipRef.current?.current;
      if (clipEl && el) { const r = clipEl.getBoundingClientRect(), c = el.getBoundingClientRect(); const full = r.width >= c.width - 2 && r.height >= c.height - 2; renderer.setClip(full ? null : { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }); }
      else renderer.setClip(null);
      renderer.render(1);
      if (photoNext) {
        photoNext = false;
        const canvas = el.querySelector('canvas');
        if (canvas) {
          try {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png'); a.download = `setmix-photo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
            a.click(); photos++; say('Photo saved'); fx('ui-success', { volume: 0.5 });
          } catch { say('The photo could not be saved here'); }
        }
      }
      if (++drawn === 4) readyRef.current?.();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      if (isLocked()) { suppressMenu = true; document.exitPointerLock(); }
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel); el.removeEventListener('contextmenu', onContext);
      offTerrain(); offDecor(); offFrame(); offClock(); stopLighting(); graphicsRef.current = null;
      lastPose = { px, pz, face, camYaw };
      api.current = null;
      renderer.unmount();
    };
  }, [rt, scene, say]); // eslint-disable-line react-hooks/exhaustive-deps

  // studio opens the settings of what you hold in a window of its own (close it any time)
  useEffect(() => {
    if (p.mode !== 'studio' || !buildOn || showcase) return;
    if (!win.isOpen('held')) win.open('held', 'What you hold', { x: 24, y: 70, ...WIN.editor });
  }, [p.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc, Settings: the settings presets in a window of their own; Lighting presets (and the clock) are one click away inside it
  const openLighting = (): void => { setTab('lights'); win.open('edit:lights:light', 'Lighting', { x: Math.max(12, window.innerWidth - 400), y: 64, w: 372, h: 640 }); };
  /** My avatar: the Avatar tab with your avatars and its presets. */
  const openAvatar = (): void => { const cur = player().tab; if (cur !== 'avatar') beforeAvatar.current = cur; setTab('avatar'); };
  const openSettings = (): void => { win.open('settings', 'Settings', { x: Math.max(12, window.innerWidth - 470), y: 64, w: 448, h: Math.min(720, window.innerHeight - 90) }); };
  // the tool in your hand and its presets row (a tool with presets of its own shows them above the hotbar instead of the words)
  const heldOwn = heldItem && (p.tab === 'select' || p.tab === 'paint' || p.tab === 'sculpt' || p.tab === 'things') ? toolOf(p, heldItem.id) : null;
  const heldTool = heldOwn ? withSculptPalette(heldOwn, p) : null;
  const inner = heldItem ? heldWords(p.tab, heldItem, toolOf(p, heldItem.id)) : null;
  const v3words = { title: v3.button?.name ?? v3TabName(v3.t, v3.mode), line: v3.button ? `${v3.button.bind.todo ? 'Coming: ' : ''}${v3.button.doc}` : '', left: v3.button?.bind.todo ? 'Nothing yet' : v3.button?.left ?? inner?.left ?? 'Use it', right: v3.button?.bind.todo ? 'Nothing yet' : v3.button?.right ?? inner?.right ?? 'The opposite' };
  // the sliders as they stand: what you set, else the tool's own size and strength
  const v3Sliders: Record<string, number> = { ...p.v3.sliders };
  if (v3.sub) { const own = toolsOfWay(p.hotbars[p.tab][p.slots[p.tab]] ?? ''), tool = toolOf(p, own.find((x) => x !== 'things-carve') ?? own[0] ?? ''); if (tool) for (const sl of v3.sub.sliders) { const k = `${v3.t.key}:${v3.sub.id}:${sl.id}`; if (v3Sliders[k] !== undefined) continue; if (sl.drives === 'tool-size') v3Sliders[k] = tool.size; else if (sl.drives === 'tool-width') v3Sliders[k] = tool.size * 2; else if (sl.drives === 'tool-strength' || sl.drives === 'density') v3Sliders[k] = Math.round(tool.strength * 100); } }
  const showHud = buildOn && !menu && level !== 'island' && !showcase;

  // the toggles go into the shell's slot above the galaxy bar (studio keeps that bar down), else they sit in place
  const [topSlot, setTopSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const slot = document.getElementById('hud-top');
    if (slot) { setTopSlot(slot); return; }
    // not there yet (it can come in the same moment as the view): look again next frame
    const t = requestAnimationFrame(() => setTopSlot(document.getElementById('hud-top')));
    return () => cancelAnimationFrame(t);
  }, [showHud]);
  const inTopSlot = (node: ReactElement): ReactElement => (topSlot ? createPortal(node, topSlot) : node);
  return (
    <div className={`island${p.mode === 'studio' ? ' studio' : ''}${avatarMode ? ' avatar-mode' : ''}${showHud ? ' hud' : ''}`} style={{ position: 'absolute', inset: 0, ['--win-bottom' as string]: showHud && !avatarMode ? (v3.mode === 'game' ? '210px' : '270px') : '12px' }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {showHud && p.mode === 'walk' && !avatarMode ? <Crosshair active={locked} /> : null}
      {showHud ? inTopSlot(<ModeBar mode={p.mode} view={p.view} skin={skin} onAvatar={buildOn ? openAvatar : undefined} onMode={(m) => { setMode(m); fx('ui-toggle'); }} onView={(v) => { setView(v); fx('ui-toggle'); }} onSkin={(s) => { props.onSkin?.(s); fx('ui-toggle'); say(s === 'pbr' ? 'PBR: bumps, shine and height detail on' : 'Flat: plain colours, no bumps or shine'); }} />) : null}
      {/* texture mode: the tile you stepped into, in front of you; the hotbar works on it */}
      {tex && showHud ? (
        <>
          <TextureBench name={tex.name} draft={tex.draft} history={tex.history} tool={heldTool} tab={p.tab} colour={tex.colours[texColour] ?? [128, 128, 128]} shape={(p.palette.sculpt ?? 'mound') as StampKind} onChange={texChanged} onSay={say} />
          <div className="tb-head" role="navigation" aria-label="Where you are">
            <span>My island</span><span aria-hidden="true">›</span><b>{tex.name} texture</b>
            <button className="go" onClick={stepOutOfTexture}>Back to the island</button>
            <label className="tb-any" title="Paint with any colour">Any colour <input type="color" value={`#${(tex.colours[texColour] ?? [128, 128, 128]).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`} onChange={(e) => { const h = e.target.value.slice(1); const c: [number, number, number] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; setTex((t) => (t ? { ...t, colours: [...t.colours.slice(0, 8), c] } : t)); setTexColour(8); }} /></label>
          </div>
        </>
      ) : null}
      {/* the palette: what the tool in your hand puts down (top middle) */}
      {showHud && !avatarMode && tex && (p.tab === 'paint' || p.tab === 'animate') ? (
        p.tab === 'paint'
          ? <PaletteStrip title="Colour" items={tex.colours.map((c, i) => ({ id: String(i), name: `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`, preview: { kind: 'swatch', colors: [`rgb(${c.join(',')})`] } }))} community={[]} selected={String(texColour)} onPick={(id) => { setTexColour(Number(id)); fx('select', { volume: 0.5 }); }} />
          : <PaletteStrip title="Moves" items={TEX_ANIMS.map((a) => ({ id: a.id, name: a.name, preview: { kind: 'icon', icon: a.icon } }))} community={[]} selected={undefined} onPick={(id) => { const a = TEX_ANIMS.find((x) => x.id === id); if (!a) return; api.current?.setAnim(tex.id, a.v); void saveTexture(tex.id, { anim: a.v }); say(`${tex.name}: ${a.name.toLowerCase()} (step out to see it on the island)`); fx('select', { volume: 0.5 }); }} />
      ) : null}
      {showHud && !avatarMode ? (
        <V3Hud mode={v3.mode} tab={v3.tab} slot={v3.slot} preset={v3.preset} sliders={v3Sliders} filters={p.v3.filters} palette={p.palette} options={v3Options} words={v3words}
          drivesLive={(sl) => sl.drives !== 'hour' && sl.drives !== 'clouds'}
          onTab={pickV3Tab} onSlot={pickV3Slot} onPreset={pickV3Preset} onSlider={onV3Slider} onReset={onV3Reset}
          onFilter={(key, on) => { setV3Filter(key, on); fx('ui-click', { volume: 0.4 }); }}
          onOption={(key, id) => { pickPalette(key, id); fx('select', { volume: 0.5 }); }}
          onMode={pickV3Mode} onUndo={() => { api.current?.undo(); }} onRedo={() => { api.current?.redo(); }}
          findOpen={findOpen} onFind={(open) => { setFindOpen(open); if (open) api.current?.unlock(); }} onFound={pickFound}
          onComing={(what) => say(`${what}: coming`)} note={note && !showcase ? note : ''}
          onEditLook={props.ground === 'racing' ? undefined : () => { const id = Number(p.palette.paint ?? SURF.grass); const sf = PAINTS.find((x) => x.id === id); if (sf) { api.current?.unlock(); win.open(`surface:${id}`, `Look: ${sf.name}`, { x: Math.max(12, window.innerWidth - 420), y: 70, w: 390, h: 640 }); } }} />
      ) : null}
      {avatarMode && !menu ? <AvatarDock actions={actions} onPreview={(l) => api.current?.previewLook(l)} onDone={leaveAvatar} /> : null}
      {showcase ? null : win.list.map((w) => (
        <FloatingWindow key={w.id} win={win} id={w.id} title={w.id === 'held' ? (v3.button ? `${v3TabName(v3.t, v3.mode)}: ${v3.button.name}` : 'What you hold') : w.title} className={w.id === 'wiregraph' ? 'wide' : ''}>
          {w.id === 'wiregraph' ? <WireGraph rt={rt} sceneId={scene.sceneId} does={p.palette.wire ?? 'toggle'} />
            : w.id === 'held' ? (heldItem ? <EditorFor tab={p.tab} id={heldItem.id} rt={rt} sceneId={scene.sceneId} activities={activities} actions={actions} /> : <p className="hint">Pick something on the hotbar.</p>)
            : w.id === 'settings' ? (props.profile && props.onProfile ? <SettingsBody profile={props.profile} update={props.onProfile} onReplayTour={() => props.onReplayTour?.()} onReset={() => props.onResetProgress?.()} top={<div className="btns settings-jump"><button onClick={openLighting}>Lighting presets and time of day</button></div>} /> : null)
            : w.id === 'layers' ? <LayersPanel rt={rt} sceneId={scene.sceneId} selected={layerSel} onSelect={setLayerSel} plantsShown={plantsShown} onPlants={(on) => { setPlantsShown(on); api.current?.showPlants(on); }}
                onMove={(ref) => api.current?.carry(ref)} onShow={(ref) => { setFocusId(ref); }} onAdd={(id) => api.current?.addThing(id) ?? null} onGround={() => pickV3Tab(1)} />
            : w.id.startsWith('surface:') ? (() => { const sid = Number(w.id.slice(8)); const s = PAINTS.find((x) => x.id === sid); return <SurfaceEditor surfaceId={sid} name={s?.name ?? 'This surface'}
                startOn={style === 'voxel' && skin !== 'pbr' ? 'blocks' : 'ground'} onStepIn={props.ground === 'racing' ? undefined : () => stepIntoTexture(sid)} savedGround={props.profile?.groundLooks?.[String(sid)]} savedBlocks={props.profile?.groundLooks?.[`b${sid}`]}
                onApply={(g, target) => api.current?.setSurfaceLook(sid, g, target === 'blocks') ?? false}
                onSave={(g, target) => props.onProfile?.((pr) => { const key = target === 'blocks' ? `b${sid}` : String(sid); const looks = { ...(pr.groundLooks ?? {}) }; if (g) looks[key] = g; else delete looks[key]; return { ...pr, groundLooks: looks }; })} />; })()
            : w.id === 'logic' ? <LogicPanel rt={rt} sceneId={scene.sceneId} />
            : w.id === 'effects' ? <EffectsPanel rt={rt} sceneId={scene.sceneId} />
            : w.id === 'soundscape' ? <SoundSpotsPanel rt={rt} sceneId={scene.sceneId} />
            : w.id === 'characters' ? <CharactersPanel rt={rt} sceneId={scene.sceneId} onChange={() => api.current?.refreshModels()} />
            : w.id === 'world' ? <><WorldRulesEditor rt={rt} sceneId={scene.sceneId} /><div className="btns world-plants" role="group" aria-label="How the plants behave">{PLANTS.map((pl) => <button key={pl.kind} onClick={() => win.open(`plant:${pl.kind}`, `Behaviour: ${pl.name}`, { x: 80, y: 110, ...WIN.editor })}>{pl.name}</button>)}</div></>
            : w.id === 'moves' ? <MovesEditor actions={actions} />
            : w.id.startsWith('plant:') ? <PlantEditor rt={rt} sceneId={scene.sceneId} kind={w.id.slice(6)} />
            : w.id.startsWith('sprite:') ? <SpriteEditor id={w.id.slice(7)} actions={actions} />
            : w.id.startsWith('share:') ? (() => { const [, kind, ...rest] = w.id.split(':'); const ref = rest.join(':'); const info = shareInfo(kind as ShareKind, ref); return <ShareDialog kind={kind as ShareKind} refId={ref} name={info.name} preview={info.preview} data={info.data} onDone={(t) => { win.close(w.id); say(t); }} />; })()
            : w.id.startsWith('edit:') ? (() => { const [, tab, ...rest] = w.id.split(':'); return <EditorFor tab={tab as TabId} id={rest.join(':')} rt={rt} sceneId={scene.sceneId} activities={activities} actions={actions} />; })()
            : null}
        </FloatingWindow>
      ))}
      {note && !showcase && !(showHud && !avatarMode) ? <div className="island-note" role="status">{note}</div> : null}
      {tourOn && !menu ? <TourCard /> : null}
      {revealing ? <div className="reveal-flash" key={revealing} aria-hidden="true" /> : null}
      {!menu && !showcase ? <p className="island-hint">{avatarMode ? 'Hold the right button to turn round. Wheel zooms. Esc or Done goes back.' : hint(buildOn, locked, p.mode, focusId !== null)}</p> : null}
      {menu ? (
        <div className="island-menu" role="dialog" aria-label="Menu">
          <button className="go" onClick={() => { setMenu(false); if (p.mode === 'walk') api.current?.lock(); }}>Back to {p.mode === 'studio' ? 'the studio' : 'walking'}</button>
          <div className="im-group" role="group" aria-label="On this island">
            <h4>On this island</h4>
            {buildOn ? <button onClick={() => { setMenu(false); setMode(p.mode === 'studio' ? 'walk' : 'studio'); }}>{p.mode === 'studio' ? 'Walk as your avatar' : 'Studio mode'}</button> : null}
            <button onClick={() => { setMenu(false); openAvatar(); }}>My avatar</button>
            {buildOn ? <button onClick={() => { setMenu(false); win.open('world', 'World rules and plants', { x: 60, y: 90, ...WIN.editor }); }}>World rules and plants</button> : null}
            {buildOn ? <button onClick={() => { setMenu(false); win.open('moves', 'How my goblin moves', { x: 60, y: 90, ...WIN.editor }); }}>How my goblin moves</button> : null}
            {buildOn ? <button onClick={() => { setMenu(false); openShare('island', scene.sceneId); }}>Share this island</button> : null}
            {!tourView.visible ? <button onClick={() => { setMenu(false); tourReplay(); }}>Show the tour</button> : null}
          </div>
          <div className="im-group" role="group" aria-label="SetMix">
            <h4>SetMix</h4>
            <button onClick={onMainMenu}>Home</button>
            {onIslands ? <button onClick={onIslands}>My planet</button> : null}
            <button onClick={onActivities}>Activities</button>
            <button onClick={onHub}>Community</button>
            <button onClick={() => { setMenu(false); openSettings(); }}>Settings</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function hint(buildOn: boolean, locked: boolean, mode: 'walk' | 'studio', focus: boolean): string {
  if (focus) return 'Right mouse button looks round it. Wheel zooms. Esc leaves focus.';
  if (mode === 'studio') return 'Fly with W A S D, Space and C. Hold the right button to look. F focus, H hide, B walk.';
  if (!buildOn) return locked ? 'Esc opens the menu.' : 'Click to capture the mouse. Esc opens the menu.';
  return locked ? 'Tab frees the mouse, / finds a tool, ` switches mode, B studio, Esc menu.' : 'Click the world to look around. / finds a tool, Esc menu.';
}

/** The words about what you hold. */
function heldWords(tab: TabId, item: CatalogItem, tool: ToolPreset | null): { title: string; line: string; left: string; right: string } {
  const title = item.name;
  if (tool) return { title, line: tool.doc, left: tool.left, right: tool.right };
  switch (tab) {
    case 'animate': { const w = ANIM_WAYS.find((x) => x.id === item.id); return w ? { title, line: w.doc, left: w.left, right: w.right } : { title, line: item.doc, left: 'Play it', right: 'Stop' }; }
    case 'sound': { const w = SOUND_WAYS.find((x) => x.id === item.id); return w ? { title, line: w.doc, left: w.left, right: w.right } : { title, line: item.doc, left: 'Play it', right: 'Play it' }; }
    case 'lights': { const w = LIGHT_WAYS.find((x) => x.id === item.id); return w ? { title, line: w.doc, left: w.left, right: w.right } : { title, line: 'The light of your island. E, Edit to change any knob.', left: 'Use this light', right: 'Use this light' }; }
    case 'avatar': return { title, line: item.doc, left: 'Wear it', right: 'Wear it' };
    case 'camera': { const w = CAMERA_WAYS.find((x) => x.id === item.id); return w ? { title, line: w.doc, left: w.left, right: w.right } : { title, line: item.doc, left: 'Use this camera', right: 'Use this camera' }; }
    case 'logic': { const w = LOGIC_WAYS.find((x) => x.id === item.id); return { title, line: w?.doc ?? item.doc, left: w?.left ?? 'Use it', right: w?.right ?? 'Use it' }; }
    case 'effects': { const w = EFFECT_WAYS.find((x) => x.id === item.id); return { title, line: w?.doc ?? item.doc, left: w?.left ?? 'Use it', right: w?.right ?? 'Use it' }; }
    case 'physics': { const w = PHYS_WAYS.find((x) => x.id === item.id); return { title, line: w?.doc ?? item.doc, left: w?.left ?? 'Use it', right: w?.right ?? 'Use it' }; }
    case 'characters': { const w = CHAR_WAYS.find((x) => x.id === item.id); return { title, line: w?.doc ?? item.doc, left: w?.left ?? 'Use it', right: w?.right ?? 'Use it' }; }
    default: return { title, line: item.doc, left: 'Use it', right: 'The opposite' };
  }
}
