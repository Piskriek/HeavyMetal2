import { useState, type ReactElement } from 'react';
import { Box, Camera, ChevronDown, ChevronRight, Eye, Gauge, Globe2, Mountain, Palette, Route, Package, Sprout, Sun, Volume2, Waves, Flag, type LucideIcon } from 'lucide-react';
import type { PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';

/**
 * The preset tree: the scene and every preset it holds, nested the way they are stored. Click selects (the inspector shows its variables),
 * double-click goes inside it. Presets inside presets, down to the raw numbers.
 */
const ICON: Record<string, LucideIcon> = {
  scene: Globe2, entity: Box, model: Package, terrain: Mountain, track: Route, decor: Sprout, item: Gauge, race: Flag, interface: Palette,
  sound: Volume2, 'engine-sound': Volume2, music: Volume2, modulator: Waves, 'camera-rig': Camera, veil: Eye, 'light-setup': Sun,
};

export function PresetTree(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly selected: PresetId | null; readonly onSelect: (id: PresetId) => void; readonly onEnter: (id: PresetId) => void }): ReactElement {
  const { rt, sceneId, selected, onSelect, onEnter } = props;
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string): void => setClosed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const node = (id: PresetId, depth: number, seen: ReadonlySet<string>): ReactElement | null => {
    const p = rt.store.get(id);
    if (!p || seen.has(id)) return null;
    const kids = Object.values(p.children).flat().filter((r) => rt.store.get(r.ref));
    const Icon = ICON[p.kind] ?? Box;
    const isClosed = closed.has(id);
    const next = new Set(seen).add(id);
    return (
      <li key={id}>
        <div className={`row${selected === id ? ' sel' : ''}`} style={{ paddingLeft: 14 + depth * 2 }} role="treeitem" aria-expanded={kids.length ? !isClosed : undefined}>
          {kids.length ? <button aria-label={isClosed ? 'Open' : 'Close'} style={{ border: 0, padding: 0 }} onClick={() => toggle(id)}>{isClosed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button> : <span style={{ width: 13 }} />}
          <button className="row-main" style={{ border: 0, padding: 0, display: 'flex', gap: 6, alignItems: 'center', flex: 1, textAlign: 'left', background: 'transparent', color: 'inherit' }} onClick={() => onSelect(id)} onDoubleClick={() => onEnter(id)} title="Click to select, double-click to go inside">
            <Icon size={14} strokeWidth={1.6} /><span>{p.name}</span><small>{p.kind}</small>
          </button>
        </div>
        {kids.length && !isClosed ? <ul role="group">{kids.map((r) => node(r.ref, depth + 1, next))}</ul> : null}
      </li>
    );
  };
  return (
    <section className="tree" aria-label="Preset tree">
      <h3>Preset tree</h3>
      <ul role="tree">{node(sceneId, 0, new Set())}</ul>
    </section>
  );
}
