/**
 * The first card on the Primitives and Lights shelves: what the tab does, and its scene-wide
 * switches (the Shader Manager, the course's tile randomiser, hidden scenery, the underground preview).
 */
import { useEffect, useState } from 'react';
import { Eye, Moon, Paintbrush, Shuffle } from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';

interface Props {
  builder: TrackBuilder3D;
  mode: 'primitives' | 'lights';
  onOpenShaders: () => void;
  onRequestRender?: () => void;
  showToast: (text: string, ms?: number) => void;
}

export default function SceneShelfBox({ builder, mode, onOpenShaders, onRequestRender, showToast }: Props) {
  const [, setRevision] = useState(0);
  useEffect(() => builder.onChange(() => setRevision((r) => r + 1)), [builder]);
  const box = 'flex w-64 shrink-0 flex-col gap-1 self-stretch rounded-lg border border-amber-500/40 bg-zinc-900/90 p-2 text-[11px] text-zinc-300';
  const btn = 'flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 hover:border-amber-500';

  if (mode === 'lights') {
    const stats = builder.lightStats();
    return (
      <div className={box}>
        <b className="text-amber-300">Lights <span className="font-normal text-zinc-500">· pick one, click where it goes</span></b>
        <span className="text-zinc-500">{stats.placed} placed · {stats.lit} shining near the camera</span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={builder.previewAtmosphere} className="accent-amber-500"
            onChange={(e) => { builder.previewAtmosphere = e.target.checked; onRequestRender?.(); setRevision((r) => r + 1); }} />
          <Moon size={12} />Preview underground darkness
        </label>
      </div>
    );
  }

  const edits = builder.getTerrainEdits();
  const hidden = edits.filter((e) => e.hidden).length;
  const orphans = edits.filter((e) => e.orphan).length;
  const tiles = builder.getSceneryTileRandomization();
  return (
    <div className={box}>
      <b className="text-amber-300" title="Place a shape, or click the course's own terrain to move, hide or re-shade it">Primitives &amp; scenery <span className="font-normal text-zinc-500">· click terrain to edit it</span></b>
      <span className="text-zinc-500">
        {edits.length} scenery edit{edits.length === 1 ? '' : 's'}{hidden ? ` · ${hidden} hidden` : ''}{orphans ? ` · ${orphans} no longer match the course` : ''}
      </span>
      <div className="grid grid-cols-2 gap-1">
        <button className={btn} onClick={onOpenShaders}><Paintbrush size={12} />Shaders</button>
        <button className={btn} disabled={!hidden} onClick={() => { const n = builder.unhideAllTerrain(); showToast(`${n} scenery part${n === 1 ? '' : 's'} shown again`); onRequestRender?.(); }}>
          <Eye size={12} />Show hidden
        </button>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5" title="Breaks up the visible repeat of the course's own grass, rock and dirt tiles">
        <input type="checkbox" checked={tiles.on} className="accent-amber-500"
          onChange={(e) => { builder.setSceneryTileRandomization(e.target.checked); onRequestRender?.(); }} />
        <Shuffle size={12} />Randomise the course&apos;s tiles
      </label>
    </div>
  );
}
