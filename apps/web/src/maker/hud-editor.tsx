import type { ReactElement } from 'react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { elementRect, layoutFromJson, layoutToJson, moveElement, normalizeLayout, presetById, setScale, toggle, type Anchor, type HudLayout } from '@hm/hudlayout';
import { themeOf } from '../ui-preset';

const ANCHORS: Anchor[] = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const VIEW = { width: 800, height: 450 };
const COLOURS: Record<string, string> = { speed: '#5fd38d', lap: '#9be3ff', position: '#ffd24a', time: '#c9a0ff', item: '#ff9a5e', minimap: '#6fc2ff', message: '#ffffff', boost: '#37f5ff' };

/** Edit where each HUD part sits: a little preview of the screen and a row of controls per part. Writes the preset's custom layout JSON. */
export function HudEditor(props: { readonly rt: Runtime; readonly presetId: PresetId }): ReactElement {
  const { rt, presetId } = props;
  const current = themeOf(rt).layout;
  const params = rt.store.get(presetId)?.params ?? {};
  const isCustom = params['hudLayout'] === 'custom';
  const write = (l: HudLayout, label: string): void => {
    rt.commands.transaction(label, () => {
      rt.commands.execute(cmd.setParam(`${presetId}.hudLayoutJson`, layoutToJson(normalizeLayout(l)), label));
      rt.commands.execute(cmd.setParam(`${presetId}.hudLayout`, 'custom', label));
    });
  };
  const base: HudLayout = isCustom ? (layoutFromJson(String(params['hudLayoutJson'] ?? '')).layout ?? current) : current;
  const sx = 240 / VIEW.width;

  return (
    <div className="hud-editor">
      <h3 className="sub">HUD layout</h3>
      <div className="hud-preview" style={{ width: 240, height: Math.round(VIEW.height * sx) }} aria-label="Preview of the screen">
        {base.elements.map((e) => {
          const r = elementRect(e, VIEW);
          return <div key={e.id} title={e.kind} style={{ position: 'absolute', left: r.x * sx, top: r.y * sx, width: r.w * sx, height: r.h * sx, background: COLOURS[e.kind] ?? '#fff', opacity: e.visible ? Math.max(0.35, e.opacity * 0.8) : 0.12, borderRadius: 3, fontSize: 8, color: '#000', overflow: 'hidden' }}>{e.kind}</div>;
        })}
      </div>
      {!isCustom ? (
        <div className="btns"><button className="go" onClick={() => write(base, 'Customise HUD layout')}>Edit this layout</button>{['classic', 'minimal', 'kids', 'sim'].map((id) => <button key={id} onClick={() => write(presetById(id)!, `HUD layout: ${id}`)}>Start from {id}</button>)}</div>
      ) : (
        base.elements.map((e) => (
          <div key={e.id} className="hud-row">
            <label><input type="checkbox" checked={e.visible} onChange={() => write(toggle(base, e.id), `HUD: ${e.kind}`)} /> <b>{e.kind}</b></label>
            <select value={e.anchor} onChange={(ev) => write(moveElement(base, e.id, ev.target.value as Anchor, e.offsetX, e.offsetY), `HUD: ${e.kind} anchor`)}>{ANCHORS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            <label>x <input type="number" value={e.offsetX} step={8} onChange={(ev) => write(moveElement(base, e.id, e.anchor, Number(ev.target.value), e.offsetY), `HUD: ${e.kind} x`)} /></label>
            <label>y <input type="number" value={e.offsetY} step={8} onChange={(ev) => write(moveElement(base, e.id, e.anchor, e.offsetX, Number(ev.target.value)), `HUD: ${e.kind} y`)} /></label>
            <label>size <input type="range" min={0.5} max={2} step={0.05} value={e.scale} onChange={(ev) => write(setScale(base, e.id, Number(ev.target.value)), `HUD: ${e.kind} size`)} /></label>
          </div>
        ))
      )}
    </div>
  );
}
