import { useMemo, useState, type ReactElement } from 'react';
import { LogicPanel } from './logic-panel';
import { EffectsPanel } from './effects-panel';
import { SoundSpotsPanel } from './sound-spots-panel';
import { CharactersPanel } from './characters-panel';
import { cmd, defineSchema, type Params, type PresetId, type PresetSchema, type VariableDef } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { ANIMATIONS, ANIM_VARIABLES, MOVE_SLOTS, animToParams, type AnimPreset, type MoveSlot } from '@hm/anim';
import { LOOK_VARIABLES, nameProblem, type AvatarLook, type LookSlot } from '@hm/avatarlook';
import { PLUG_KINDS, PLUG_POINTS, SHAKES, SPRITE_PRESETS, SPRITE_VARIABLES, addPlug, addable, changePlug, removePlug, spriteToParams, toolEdit, toolParams, toolVariables, type PlugKind, type TabId, type ToolPlug, type ToolPreset } from '@hm/buildkit';
import { SFX, type SfxId } from '@hm/audio';
import { Inspector } from '@hm/ui';
import { PLANT_VARIABLES, plantToParams, rulesToParams, RULE_VARIABLES, PLANTS } from '@hm/worldrules';
import { LightingPanel } from '../lighting/lighting-window';
import { audio, fx } from '../maker/feedback';
import { builtInRecipe, ensureOverride, hasOverride, overrideId, removeOverride } from '../sound/bank';
import { SoundLab } from '../sound/lab';
import { normalizeRecipe, recipeToJson, type SfxRecipe } from '@hm/soundlab';
import { ensurePlant, ensureRules, plantsOf, rulesOf } from '../world';
import { useRev } from '../use-rev';
import { ANIM_WAYS, CAMERAS, CAMERA_WAYS, SOUND_IDS, animOf, lookOf, soundName, toolOf, type ActivityInfo } from './catalog';
import { PresetPreview, avatarWearing } from './cards';
import { editAnim, editSprite, editTool, resetAnim, resetSprite, resetTool, saveLook, setMove, usePlayer, wearLook } from './player';
import { spriteOf } from './sprites';
import { PartsPicker } from '../avatar/parts-picker';
import type { Preview } from './catalog';

/**
 * Attribute editors: open any preset and change it. Each is the generic inspector (sliders that never stop short, a number box, the input
 * chooser) over that preset's variables, with a live preview on top. They live in movable floating windows.
 */
const schemaOf = (kind: string, label: string, variables: readonly VariableDef[]): PresetSchema => defineSchema({ kind, version: 1, label, doc: label, variables, slots: [] });

export interface EditorActions {
  readonly playAnim: (a: AnimPreset) => void;
  readonly openActivity: (id: string) => void;
  readonly useCamera: (id: string) => void;
  readonly applyLook: (id: string) => void;
  /** Open the editor of a sprite burst (a tool's sprite plug). */
  readonly openSprite: (id: string) => void;
  /** Open "Share with the community?" for a preset. */
  readonly share: (kind: 'tool' | 'sprite' | 'animation' | 'look', id: string) => void;
}

export function ToolEditor({ id, actions }: { readonly id: string; readonly actions: EditorActions }): ReactElement {
  const p = usePlayer();
  const tool = toolOf(p, id);
  if (!tool) return <p className="hint">This tool no longer exists.</p>;
  const vars = toolVariables(tool, SOUND_IDS);
  return (
    <div className="editor">
      <div className="ed-top"><PresetPreview p={tool.action === 'paint' ? { kind: 'icon', icon: 'Paintbrush' } : { kind: 'icon', icon: tool.icon }} size={44} /><p>{tool.doc}</p></div>
      <Inspector schema={schemaOf('tool', tool.name, vars)} params={(p.tools[id] ?? {}) as Params} resolved={toolParams(tool)} tier="build"
        onChange={(k, v) => { const [key, value] = toolEdit(k, v); editTool(id, key, value); }} />
      <PlugList tool={tool} actions={actions} />
      <div className="btns">
        {p.tools[id] ? <button onClick={() => { resetTool(id); fx('undo'); }}>Back to the ready-made tool</button> : null}
        <span className="grow" />
        <button onClick={() => actions.share('tool', id)}>Share…</button>
      </div>
    </div>
  );
}

/** The choices for a plug of a kind: id, name, preview. */
function plugChoices(kind: PlugKind): { readonly id: string; readonly name: string; readonly preview: Preview }[] {
  switch (kind) {
    case 'sprite': return SPRITE_PRESETS.map((s) => { const own = spriteOf(s.id); return { id: s.id, name: own.name, preview: { kind: 'sprite', sprite: own } }; });
    case 'sound': return SOUND_IDS.map((id) => ({ id, name: soundName(id), preview: { kind: 'sound', id: id as SfxId } }));
    case 'anim': return ANIMATIONS.map((a) => ({ id: a.id, name: a.name, preview: { kind: 'anim', anim: a } }));
    case 'shake': return SHAKES.map((s) => ({ id: s.id, name: s.name, preview: { kind: 'shake', amp: s.amp } }));
  }
}
const plugPreview = (pl: ToolPlug): Preview => plugChoices(pl.kind).find((c) => c.id === pl.ref)?.preview ?? { kind: 'icon', icon: 'Box' };
const plugName = (pl: ToolPlug): string => plugChoices(pl.kind).find((c) => c.id === pl.ref)?.name ?? pl.ref;

/**
 * "When you use it": the tool's plugs. Each row is a moment (on use, on right click, when you pick it, when you let go) and a preset that
 * plays then, with its preview; click the preview to choose another, Edit opens it (sprites), x takes it off. "+ attribute" adds one.
 */
function PlugList({ tool, actions }: { readonly tool: ToolPreset; readonly actions: EditorActions }): ReactElement {
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState<number | null>(null);
  const save = (plugs: readonly ToolPlug[]): void => { editTool(tool.id, 'plugs', plugs); };
  const try_ = (pl: ToolPlug): void => {
    if (pl.kind === 'sound') fx(pl.ref as SfxId);
    else if (pl.kind === 'anim') actions.playAnim(ANIMATIONS.find((a) => a.id === pl.ref) ?? ANIMATIONS[0]!);
  };
  return (
    <section className="plugs" aria-label="When you use it">
      <h4>When you use it</h4>
      {tool.plugs.length === 0 ? <p className="hint">Nothing plays yet. Add a sprite, a sound, a move or a shake with + attribute.</p> : null}
      {tool.plugs.map((pl, i) => (
        <div key={i} className="plug">
          <select aria-label="When" value={pl.on} onChange={(e) => { save(changePlug(tool.plugs, i, { on: e.target.value as ToolPlug['on'] })); fx('ui-click', { volume: 0.4 }); }}>
            {PLUG_POINTS.filter((pt) => pt.accepts.includes(pl.kind)).map((pt) => <option key={pt.on} value={pt.on}>{pt.label}</option>)}
          </select>
          <button className="plug-pv" title={`${PLUG_KINDS[pl.kind].label}: ${plugName(pl)} (click to choose another)`} aria-expanded={choosing === i} onClick={() => { setChoosing(choosing === i ? null : i); try_(pl); }}>
            <PresetPreview p={plugPreview(pl)} size={36} />
          </button>
          <span className="plug-name"><small>{PLUG_KINDS[pl.kind].label}</small>{plugName(pl)}</span>
          <label className="plug-amt" title="How strongly it plays (1 = as made)">x<input type="number" min={0} max={4} step={0.1} value={pl.amount} onChange={(e) => save(changePlug(tool.plugs, i, { amount: Number(e.target.value) }))} /></label>
          {pl.kind === 'sprite' ? <button title="Change this burst" onClick={() => actions.openSprite(pl.ref)}>Edit</button> : null}
          <button className="x" aria-label="Take it off" title="Take it off" onClick={() => { save(removePlug(tool.plugs, i)); setChoosing(null); fx('delete', { volume: 0.5 }); }}>×</button>
          {choosing === i ? (
            <div className="plug-choose" role="listbox" aria-label={`Choose a ${PLUG_KINDS[pl.kind].label.toLowerCase()}`}>
              {plugChoices(pl.kind).map((c) => (
                <button key={c.id} role="option" aria-selected={c.id === pl.ref} className={c.id === pl.ref ? 'on' : ''} title={c.name}
                  onClick={() => { const next = changePlug(tool.plugs, i, { ref: c.id }); save(next); try_(next[i]!); }}>
                  <PresetPreview p={c.preview} size={40} /><span>{c.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      <button className="plug-add" aria-expanded={adding} onClick={() => setAdding(!adding)}>+ attribute</button>
      {adding ? (
        <div className="plug-menu" role="menu">
          {addable(tool.plugs).map(({ point, kinds }) => (
            <div key={point.on} className="plug-point">
              <b title={point.doc}>{point.label}</b>
              {kinds.map((k) => (
                <button key={k} role="menuitem" title={PLUG_KINDS[k].doc} onClick={() => {
                  const r = addPlug(tool.plugs, point.on, k);
                  if (r.refused) { fx('ui-error'); return; }
                  save(r.plugs); setAdding(false); setChoosing(r.plugs.length - 1); fx('select');
                }}>{PLUG_KINDS[k].label}</button>
              ))}
            </div>
          ))}
          {addable(tool.plugs).length === 0 ? <p className="hint">This tool has as many as it can hold. Take one off first.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

/** A sprite burst is a preset too: how many bits, their colours, size, speed, spread, gravity, how long they last. */
export function SpriteEditor({ id, actions }: { readonly id: string; readonly actions: EditorActions }): ReactElement {
  const p = usePlayer();
  const s = spriteOf(id);
  const schema = useMemo(() => schemaOf('sprite', 'Sprite', SPRITE_VARIABLES), []);
  return (
    <div className="editor">
      <div className="ed-top big"><PresetPreview p={{ kind: 'sprite', sprite: s }} size={120} /><p>Every tool that plays {s.name.toLowerCase()} changes with it.</p></div>
      <Inspector schema={schema} params={(p.sprites[id] ?? {}) as Params} resolved={spriteToParams(s)} tier="build" onChange={(k, v) => editSprite(id, k, v)} />
      <div className="btns">
        {p.sprites[id] ? <button onClick={() => { resetSprite(id); fx('undo'); }}>Back to the ready-made burst</button> : null}
        <span className="grow" />
        <button onClick={() => actions.share('sprite', id)}>Share…</button>
      </div>
    </div>
  );
}

export function AnimEditor({ id, actions }: { readonly id: string; readonly actions: EditorActions }): ReactElement {
  const p = usePlayer();
  const anim = animOf(p, id);
  const usedFor = MOVE_SLOTS.filter((m) => p.moves[m] === id);
  return (
    <div className="editor">
      <div className="ed-top big"><PresetPreview p={{ kind: 'anim', anim }} size={120} /><div><p>{anim.loop ? 'Repeats while it plays.' : `Plays once, ${anim.duration.toFixed(2)} s.`}</p><button className="go" onClick={() => actions.playAnim(anim)}>Play it on my goblin</button></div></div>
      <div className="ed-moves">
        <span className="hint">Use it when my goblin</span>
        {MOVE_SLOTS.map((m) => <button key={m} className={usedFor.includes(m) ? 'on' : ''} aria-pressed={usedFor.includes(m)} onClick={() => { setMove(m, id); fx('select'); }}>{MOVE_WORDS[m]}</button>)}
      </div>
      <Inspector schema={schemaOf('animation', anim.name, ANIM_VARIABLES)} params={(p.anims[id] ?? {}) as Params} resolved={animToParams(anim)} tier="build" onChange={(k, v) => editAnim(id, k, v)} />
      <div className="btns">
        {p.anims[id] ? <button onClick={() => { resetAnim(id); fx('undo'); }}>Back to the ready-made move</button> : null}
        <span className="grow" />
        <button onClick={() => actions.share('animation', id)}>Share…</button>
      </div>
    </div>
  );
}
const MOVE_WORDS: Record<MoveSlot, string> = { idle: 'stands', walk: 'walks', run: 'runs', jump: 'jumps', fall: 'falls' };

export function MovesEditor({ actions }: { readonly actions: EditorActions }): ReactElement {
  const p = usePlayer();
  return (
    <div className="editor moves">
      <p className="hint">Which move plays for each way your goblin moves. Click a move to see it and change it.</p>
      {MOVE_SLOTS.map((m) => {
        const a = animOf(p, p.moves[m]);
        return <div key={m} className="move-row"><PresetPreview p={{ kind: 'anim', anim: a }} size={52} /><span><b>When it {MOVE_WORDS[m]}</b><br />{a.name}</span><button onClick={() => actions.playAnim(a)}>Play</button></div>;
      })}
    </div>
  );
}

const SOUND_SCHEMA = schemaOf('sound', 'Sound', [
  { key: 'volume', type: 'number', label: 'Volume', doc: 'How loud it plays (1 = as made).', tier: 'play', default: 1, min: 0, max: 2, step: 0.01, hardMin: 0, group: 'Sound' },
  { key: 'pitch', type: 'number', label: 'Pitch', doc: 'Higher or lower (1 = as made, 2 = an octave up).', tier: 'play', default: 1, min: 0.25, max: 4, step: 0.01, hardMin: 0.05, hardMax: 16, group: 'Sound' },
  { key: 'enabled', type: 'boolean', label: 'Plays', doc: 'Switch it off to mute this sound everywhere on the island.', tier: 'play', default: true, group: 'Sound' },
]);

/** A sound preset on this island: volume, pitch, on or off, and its shape layer by layer (the Sound Lab). Saved with the island. */
export function SoundEditor({ id, rt }: { readonly id: string; readonly rt: Runtime }): ReactElement {
  useRev(rt);
  const slot = id as SfxId;
  if (!SFX[slot]) return <p className="hint">Unknown sound.</p>;
  const own = hasOverride(rt, slot) ? rt.store.get(overrideId(slot)) : undefined;
  const recipe = soundRecipeOf(rt, slot);
  const params = own?.params ?? {};
  const resolved = { volume: Number(params['volume'] ?? 1), pitch: Number(params['pitch'] ?? 1), enabled: params['enabled'] !== false };
  const write = (key: string, v: unknown, label: string): void => { const pid = ensureOverride(rt, slot); rt.commands.execute(cmd.setParam(`${pid}.${key}`, v as never, label)); };
  const preview = (r: SfxRecipe): void => { const eng = audio(); if (eng) eng.playRecipe(r, { volume: resolved.volume, pitch: resolved.pitch }); };
  return (
    <div className="editor">
      <div className="ed-top"><PresetPreview p={{ kind: 'sound', id: slot, recipe }} size={120} /><div><p>{soundName(id)}: {recipe.layers.length} layer{recipe.layers.length === 1 ? '' : 's'}.{own ? ' This island has its own version.' : ''}</p><button className="go" onClick={() => fx(slot)}>Play</button></div></div>
      <Inspector schema={SOUND_SCHEMA} params={own ? { volume: resolved.volume, pitch: resolved.pitch, enabled: resolved.enabled } : {}} resolved={resolved} tier="play"
        onChange={(k, v) => { write(k, v, `Sound ${soundName(id)}: ${k}`); fx(slot, { minGapMs: 180 }); }} />
      <h4>Shape</h4>
      <SoundLab recipe={recipe} tier="build" onChange={(r) => write('recipe', JSON.stringify(JSON.parse(recipeToJson(r))), `Reshape ${soundName(id)}`)} onPreview={preview} />
      {own ? <button onClick={() => { removeOverride(rt, slot); fx('undo'); }}>Back to the ready-made sound</button> : null}
    </div>
  );
}

function soundRecipeOf(rt: Runtime, slot: SfxId): SfxRecipe {
  const raw = hasOverride(rt, slot) ? rt.store.get(overrideId(slot))?.params['recipe'] : undefined;
  try { if (typeof raw === 'string' && raw) return normalizeRecipe(JSON.parse(raw) as SfxRecipe); } catch { /* fall back to the ready-made one */ }
  return normalizeRecipe((builtInRecipe(slot) ?? SFX[slot]) as unknown as SfxRecipe);
}

export function LookEditor({ id, actions }: { readonly id: string; readonly actions: EditorActions }): ReactElement {
  const p = usePlayer();
  const look = lookOf(p, id);
  const mine = p.looks.some((l) => l.id === id);
  const change = (patch: Partial<AvatarLook>): void => { const saved = saveLook({ ...look, ...patch }); if (!mine) actions.applyLook(saved.id); };
  const problem = nameProblem(look.name);
  return (
    <div className="editor">
      <div className="ed-top big">
        {avatarWearing(look) ? <PresetPreview p={{ kind: 'look', look }} size={120} /> : null}
        <div>
          <label className="row">Name <input value={look.name} maxLength={20} onChange={(e) => change({ name: e.target.value })} /></label>
          {problem ? <p className="hint warn">{problem}</p> : null}
          {p.lookId === id ? <p className="hint">Your goblin is wearing this.</p> : <button className="go" onClick={() => { wearLook(id); actions.applyLook(id); }}>Wear it</button>}
        </div>
      </div>
      <h4>What it wears</h4>
      <PartsPicker look={look} onChange={(parts) => change({ parts })} />
      <Inspector schema={schemaOf('avatar', look.name, LOOK_VARIABLES)} params={mine ? Object.fromEntries(LOOK_VARIABLES.map((v) => [v.key, look[v.key as LookSlot]])) : {}} resolved={look as unknown as Record<string, string>} tier="build"
        onChange={(k, v) => { if (typeof v === 'string') change({ [k]: v } as Partial<AvatarLook>); }} />
      {!mine ? <p className="hint">Change any colour and it becomes a goblin of your own.</p> : <div className="btns"><span className="grow" /><button onClick={() => actions.share('look', id)}>Share…</button></div>}
    </div>
  );
}

export function WorldRulesEditor({ rt, sceneId }: { readonly rt: Runtime; readonly sceneId: PresetId }): ReactElement {
  useRev(rt);
  const ref = rt.store.get(sceneId)?.children['world']?.[0]?.ref;
  const own = ref ? rt.store.get(ref) : undefined;
  const schema = useMemo(() => schemaOf('world-rules', 'World rules', RULE_VARIABLES), []);
  return (
    <div className="editor">
      <p className="hint">What the ground and the plants do when you change the island. {own ? 'This island has its own rules.' : 'These are the ready-made rules: change one and the island gets its own copy.'}</p>
      <Inspector schema={schema} params={own?.params ?? {}} resolved={rulesToParams(rulesOf(rt, sceneId))} tier="build"
        onChange={(k, v) => { const id = ensureRules(rt, sceneId); rt.commands.execute(cmd.setParam(`${id}.${k}`, v, 'World rules')); }} />
    </div>
  );
}

export function PlantEditor({ rt, sceneId, kind }: { readonly rt: Runtime; readonly sceneId: PresetId; readonly kind: string }): ReactElement {
  useRev(rt);
  const b = plantsOf(rt, sceneId).find((p) => p.kind === kind) ?? PLANTS[0]!;
  const ownRef = (rt.store.get(sceneId)?.children['plants'] ?? []).find((r) => rt.store.get(r.ref) && rt.store.resolve(r.ref).params['kind'] === kind)?.ref;
  const schema = useMemo(() => schemaOf('plant', b.name, PLANT_VARIABLES), [b.name]);
  return (
    <div className="editor">
      <p className="hint">How {b.name.toLowerCase()} behaves when the ground under it changes.</p>
      <Inspector schema={schema} params={ownRef ? rt.store.get(ownRef)?.params ?? {} : {}} resolved={plantToParams(b)} tier="play"
        onChange={(k, v) => { const id = ensurePlant(rt, sceneId, kind); rt.commands.execute(cmd.setParam(`${id}.${k}`, v, `${b.name} behaviour`)); }} />
    </div>
  );
}

export function ActivityEditor({ a, actions }: { readonly a: ActivityInfo; readonly actions: EditorActions }): ReactElement {
  return (
    <div className="editor">
      <div className="ed-top"><PresetPreview p={{ kind: 'planet', hue: a.hue, ring: a.ring }} size={72} /><div><p>{a.doc}</p><button className="go" onClick={() => actions.openActivity(a.id)}>Open {a.name}</button></div></div>
    </div>
  );
}

export function CameraEditor({ id, actions }: { readonly id: string; readonly actions: EditorActions }): ReactElement {
  const c = CAMERAS.find((x) => x.id === id) ?? CAMERAS[0]!;
  return (
    <div className="editor">
      <div className="ed-top"><PresetPreview p={{ kind: 'icon', icon: c.icon }} size={56} /><div><p>{c.doc}</p><button className="go" onClick={() => actions.useCamera(c.id)}>Use it</button></div></div>
    </div>
  );
}

/** The editor for whatever a card is. */
export function EditorFor(props: { readonly tab: TabId; readonly id: string; readonly rt: Runtime; readonly sceneId: PresetId; readonly activities: readonly ActivityInfo[]; readonly actions: EditorActions }): ReactElement {
  const { tab, id } = props;
  switch (tab) {
    case 'select': case 'paint': case 'sculpt': case 'things': return <ToolEditor id={id} actions={props.actions} />;
    case 'animate': return id.startsWith('anim-') ? <p className="hint">{ANIM_WAYS.find((w) => w.id === id)?.doc ?? ''}</p> : <AnimEditor id={id} actions={props.actions} />;
    case 'sound': return id.startsWith('sound-') ? <SoundSpotsPanel rt={props.rt} sceneId={props.sceneId} /> : <SoundEditor id={id} rt={props.rt} />;
    case 'lights': return <LightingPanel rt={props.rt} sceneId={props.sceneId} />;
    case 'logic': return <LogicPanel rt={props.rt} sceneId={props.sceneId} />;
    case 'effects': return <EffectsPanel rt={props.rt} sceneId={props.sceneId} />;
    case 'characters': return <CharactersPanel rt={props.rt} sceneId={props.sceneId} />;
    case 'physics': return <p className="hint">What a thing is made of is on its layer too (Layers, Material). Drop shows how it lands; the push hammer sends things flying and they stay where they land (Ctrl+Z puts them back).</p>;
    case 'avatar': return <LookEditor id={id} actions={props.actions} />;
    case 'camera': return id.startsWith('cam-') ? <p className="hint">{CAMERA_WAYS.find((w) => w.id === id)?.doc ?? ''}</p> : <CameraEditor id={id} actions={props.actions} />;
  }
}
