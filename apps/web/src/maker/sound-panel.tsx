import { useState, type ReactElement } from 'react';
import { cmd, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { SFX, musicPattern, type SfxId } from '@hm/audio';
import { normalizeRecipe, recipeToJson, type MusicSpec, type SfxRecipe } from '@hm/soundlab';
import { audio, fx } from './feedback';
import { builtInRecipe, ENGINE_ID, MUSIC_ID, ensureOverride, ensureScenePreset, engineSpecOf, listSlots, musicSpecOf, overrideId, removeOverride, removeScenePreset, type SoundSlot } from '../sound/bank';
import { EngineLab, MusicLab, SoundLab } from '../sound/lab';

/**
 * Every sound in the game is a preset. Here you hear each one, change its volume and pitch (or mute it), reshape it layer by layer
 * in the Sound Lab, roll or wiggle new versions, and tune the engine hum and the music. Volume and pitch are ordinary variables,
 * so a driver can move them too. Everything saves with the map.
 */

const CATEGORIES: { id: SoundSlot['category']; label: string }[] = [{ id: 'race', label: 'Race' }, { id: 'editor', label: 'Editor' }, { id: 'ui', label: 'Menus' }];

type Open = { kind: 'sfx'; id: SfxId } | { kind: 'engine' } | { kind: 'music' } | null;

export function SoundPanel(props: {
  readonly rt: Runtime;
  readonly tier: Tier;
  readonly onFeedback: (kind: 'success' | 'error' | 'deleted', text: string) => void;
  /** re-render trigger (the maker bumps this on every store change) */
  readonly rev?: number;
}): ReactElement {
  const { rt, tier, onFeedback } = props;
  const [cat, setCat] = useState<SoundSlot['category'] | 'music'>('race');
  const [open, setOpen] = useState<Open>(null);
  const slots = cat === 'music' ? [] : listSlots(rt).filter((s) => s.category === cat);
  const toggle = (o: Open): void => { setOpen(open && o && JSON.stringify(open) === JSON.stringify(o) ? null : o); fx('ui-toggle'); };

  const set = (slot: SfxId, key: 'volume' | 'pitch' | 'enabled', value: number | boolean): void => {
    const id = ensureOverride(rt, slot);
    rt.commands.execute(cmd.setParam(`${id}.${key}`, value, `Sound ${slot}: ${key}`));
  };
  const param = (slot: SfxId, key: string, fallback: number): number => Number(rt.store.get(overrideId(slot))?.params[key] ?? fallback);

  const recipeOf = (slot: SfxId): SfxRecipe => {
    const raw = rt.store.get(overrideId(slot))?.params['recipe'];
    try { if (typeof raw === 'string' && raw) return normalizeRecipe(JSON.parse(raw) as SfxRecipe); } catch { /* fall back to the built-in */ }
    return normalizeRecipe((builtInRecipe(slot) ?? SFX[slot]) as unknown as SfxRecipe);
  };
  const writeRecipe = (slot: SfxId, r: SfxRecipe): void => {
    const id = ensureOverride(rt, slot);
    rt.commands.execute(cmd.setParam(`${id}.recipe`, JSON.stringify(JSON.parse(recipeToJson(r))), `Reshape sound: ${slot}`));
  };
  const preview = (slot: SfxId, r: SfxRecipe): void => {
    const eng = audio();
    if (!eng) { fx('ui-error'); return; }
    eng.playRecipe(r, { volume: param(slot, 'volume', 1), pitch: param(slot, 'pitch', 1) });
  };

  const engine = engineSpecOf(rt);
  const music = musicSpecOf(rt);
  const setEngine = (key: string, v: number): void => { const id = ensureScenePreset(rt, 'engine'); rt.commands.execute(cmd.setParam(`${id}.${key}`, v, `Engine hum: ${key}`)); };
  const playMusic = (s: MusicSpec): void => { const eng = audio(); if (!eng) { fx('ui-error'); return; } eng.playMusic(musicPattern(s.seed, Math.min(s.bars, 4), { mood: s.mood, bpm: s.bpm })); };
  const setMusic = (s: MusicSpec): void => {
    const id = ensureScenePreset(rt, 'music');
    rt.commands.transaction('Music', () => { for (const [k, v] of Object.entries(s)) rt.commands.execute(cmd.setParam(`${id}.${k}`, v as never, 'Music')); });
  };

  return (
    <section className="sounds">
      <h3>Sounds</h3>
      <p className="hint">Every sound is a preset. Tap ▶ to hear it, Edit to change it. Edits save with your map.</p>
      <div className="seg">{[...CATEGORIES, { id: 'music' as const, label: 'Engine + music' }].map((c) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => { setCat(c.id); setOpen(null); fx('ui-click'); }}>{c.label}</button>)}</div>
      {cat === 'music' ? (
        <ul className="sound-list">
          <li className={rt.store.get(ENGINE_ID) ? 'edited' : ''}>
            <div className="sound-row"><span className="grow">Engine hum</span>
              <button onClick={() => toggle({ kind: 'engine' })}>{open?.kind === 'engine' ? 'Done' : 'Edit'}</button></div>
            {open?.kind === 'engine' ? (
              <div className="sound-edit">
                <EngineLab spec={engine.spec} tier={tier} onChange={setEngine} onReplace={(s) => { const id = ensureScenePreset(rt, 'engine'); rt.commands.transaction('Engine hum', () => { for (const [k, v] of Object.entries(s)) rt.commands.execute(cmd.setParam(`${id}.${k}`, v, 'Engine hum')); }); }} />
                {rt.store.get(ENGINE_ID) ? <button onClick={() => { removeScenePreset(rt, 'engine'); onFeedback('deleted', 'Back to the built-in engine hum'); }}>Reset to built-in</button> : null}
              </div>
            ) : null}
          </li>
          <li className={rt.store.get(MUSIC_ID) ? 'edited' : ''}>
            <div className="sound-row"><button title="Play" onClick={() => playMusic(music.spec)}>▶</button><span className="grow">Race music</span>
              <button title="Stop" onClick={() => audio()?.stopMusic()}>■</button>
              <button onClick={() => toggle({ kind: 'music' })}>{open?.kind === 'music' ? 'Done' : 'Edit'}</button></div>
            {open?.kind === 'music' ? (
              <div className="sound-edit">
                <label className="row"><input type="checkbox" checked={music.enabled} onChange={(e) => { const id = ensureScenePreset(rt, 'music'); rt.commands.execute(cmd.setParam(`${id}.enabled`, e.target.checked, 'Music on/off')); }} /> Music plays in the race</label>
                <MusicLab spec={music.spec} tier={tier} onChange={setMusic} onPreview={playMusic} />
                {rt.store.get(MUSIC_ID) ? <button onClick={() => { removeScenePreset(rt, 'music'); onFeedback('deleted', 'Back to the built-in music'); }}>Reset to built-in</button> : null}
              </div>
            ) : null}
          </li>
        </ul>
      ) : (
        <ul className="sound-list">
          {slots.map((s) => (
            <li key={s.id} className={s.edited ? 'edited' : ''}>
              <div className="sound-row">
                <button title="Play" onClick={() => fx(s.id)}>▶</button>
                <span className="grow">{s.label}{s.edited ? <i title="Changed from the built-in sound"> ●</i> : null}</span>
                <button onClick={() => toggle({ kind: 'sfx', id: s.id })}>{open?.kind === 'sfx' && open.id === s.id ? 'Done' : 'Edit'}</button>
              </div>
              {open?.kind === 'sfx' && open.id === s.id ? (
                <div className="sound-edit">
                  <label className="row">Volume <input type="range" min={0} max={2} step={0.01} value={param(s.id, 'volume', 1)} onChange={(e) => set(s.id, 'volume', Number(e.target.value))} onPointerUp={() => fx(s.id)} /> <span>{Math.round(param(s.id, 'volume', 1) * 100)}%</span></label>
                  <label className="row">Pitch <input type="range" min={0.25} max={4} step={0.01} value={param(s.id, 'pitch', 1)} onChange={(e) => set(s.id, 'pitch', Number(e.target.value))} onPointerUp={() => fx(s.id)} /> <span>{param(s.id, 'pitch', 1).toFixed(2)}x</span></label>
                  {tier !== 'play' ? <label className="row"><input type="checkbox" checked={rt.store.get(overrideId(s.id))?.params['enabled'] !== false} onChange={(e) => set(s.id, 'enabled', e.target.checked)} /> Enabled</label> : null}
                  <SoundLab recipe={recipeOf(s.id)} tier={tier} onChange={(r) => writeRecipe(s.id, r)} onPreview={(r) => preview(s.id, r)} />
                  {s.edited ? <button onClick={() => { removeOverride(rt, s.id); onFeedback('deleted', 'Back to the built-in sound'); }}>Reset to built-in</button> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
