import { useMemo, type ReactElement } from 'react';
import { cmd, defineSchema, type Params, type PresetId, type PresetSchema, type VariableDef } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { ANIM_VARIABLES, MOVE_SLOTS, animToParams, type AnimPreset, type MoveSlot } from '@hm/anim';
import { LOOK_VARIABLES, nameProblem, type AvatarLook } from '@hm/avatarlook';
import { toolEdit, toolParams, toolVariables, type TabId } from '@hm/buildkit';
import { SFX, type SfxId } from '@hm/audio';
import { Inspector } from '@hm/ui';
import { PLANT_VARIABLES, plantToParams, rulesToParams, RULE_VARIABLES, PLANTS } from '@hm/worldrules';
import { LightingPanel } from '../lighting/lighting-window';
import { fx } from '../maker/feedback';
import { ensurePlant, ensureRules, plantsOf, rulesOf } from '../world';
import { useRev } from '../use-rev';
import { CAMERAS, SOUND_IDS, animOf, lookOf, soundName, toolOf, type ActivityInfo } from './catalog';
import { PresetPreview, goblinWearing } from './cards';
import { editAnim, editTool, resetAnim, resetTool, saveLook, setMove, usePlayer, wearLook } from './player';

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
}

export function ToolEditor({ id }: { readonly id: string }): ReactElement {
  const p = usePlayer();
  const tool = toolOf(p, id);
  if (!tool) return <p className="hint">This tool no longer exists.</p>;
  const vars = toolVariables(tool, SOUND_IDS);
  return (
    <div className="editor">
      <div className="ed-top"><PresetPreview p={tool.action === 'paint' ? { kind: 'icon', icon: 'Paintbrush' } : { kind: 'icon', icon: tool.icon }} size={44} /><p>{tool.doc}</p></div>
      <Inspector schema={schemaOf('tool', tool.name, vars)} params={(p.tools[id] ?? {}) as Params} resolved={toolParams(tool)} tier="build"
        onChange={(k, v) => { const [key, value] = toolEdit(k, v); editTool(id, key, value); }} />
      {p.tools[id] ? <button onClick={() => { resetTool(id); fx('undo'); }}>Back to the ready-made tool</button> : null}
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
      {p.anims[id] ? <button onClick={() => { resetAnim(id); fx('undo'); }}>Back to the ready-made move</button> : null}
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

export function SoundEditor({ id }: { readonly id: string }): ReactElement {
  const r = SFX[id as SfxId];
  if (!r) return <p className="hint">Unknown sound.</p>;
  return (
    <div className="editor">
      <div className="ed-top"><PresetPreview p={{ kind: 'sound', id: id as SfxId }} size={120} /><div><p>{soundName(id)}: {r.layers.length} layer{r.layers.length === 1 ? '' : 's'}, {r.durationMs} ms.</p><button className="go" onClick={() => fx(id as SfxId)}>Play</button></div></div>
      <ul className="ed-layers">{r.layers.map((l, i) => <li key={i}>{l.wave} from {Math.round(l.freq[0])} Hz to {Math.round(l.freq[1])} Hz, rises in {l.attackMs} ms, fades in {l.decayMs} ms</li>)}</ul>
      <p className="hint">Every sound is a preset: open Build mode, Sounds, to change its layers, or drive it with a randomizer.</p>
    </div>
  );
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
        {goblinWearing(look) ? <PresetPreview p={{ kind: 'look', look }} size={120} /> : null}
        <div>
          <label className="row">Name <input value={look.name} maxLength={20} onChange={(e) => change({ name: e.target.value })} /></label>
          {problem ? <p className="hint warn">{problem}</p> : null}
          {p.lookId === id ? <p className="hint">Your goblin is wearing this.</p> : <button className="go" onClick={() => { wearLook(id); actions.applyLook(id); }}>Wear it</button>}
        </div>
      </div>
      <Inspector schema={schemaOf('avatar', look.name, LOOK_VARIABLES)} params={mine ? Object.fromEntries(LOOK_VARIABLES.map((v) => [v.key, look[v.key as keyof AvatarLook]])) : {}} resolved={look as unknown as Record<string, string>} tier="build"
        onChange={(k, v) => { if (typeof v === 'string') change({ [k]: v } as Partial<AvatarLook>); }} />
      {!mine ? <p className="hint">Change any colour and it becomes a goblin of your own.</p> : null}
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
    case 'select': case 'paint': case 'sculpt': case 'things': return <ToolEditor id={id} />;
    case 'animate': return <AnimEditor id={id} actions={props.actions} />;
    case 'sound': return <SoundEditor id={id} />;
    case 'lights': return <LightingPanel rt={props.rt} sceneId={props.sceneId} />;
    case 'activities': { const a = props.activities.find((x) => x.id === id); return a ? <ActivityEditor a={a} actions={props.actions} /> : <p className="hint">Unknown activity.</p>; }
    case 'avatar': return <LookEditor id={id} actions={props.actions} />;
    case 'camera': return <CameraEditor id={id} actions={props.actions} />;
  }
}
