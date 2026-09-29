/**
 * The top of the Lanes & Paths window: the friendly lane tools.
 *
 *   Select | Draw        Node every [——]        Start fresh
 *   (a line picked)  colours · Split into 2 lanes · Cut
 *   (a node picked)  colours · Set as finish · Start here
 *
 * Draw: press on a node (or on open road, which puts a start node there) and drag along the road;
 * a box node drops every "Node every" as you go and the line is made when you let go (on another
 * node, it joins it). Select: click a node or a line between two nodes; double-click picks the whole
 * line out to the next split or merge; Delete cuts a picked line; Ctrl-click two nodes joins them.
 */
import { useState } from 'react';
import { Eraser, Flag, MousePointer, Pencil, Play, Scissors, SplitSquareHorizontal, X } from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';
import { LANE_COLORS, laneCorridorWarnings, laneRules, setLaneCorridorRule } from '../../game/lane-network';
import { BRUSH_SPACING_MAX, BRUSH_SPACING_MIN } from '../../game/lane-path-tool';

interface Props {
  builder: TrackBuilder3D;
  drawing: boolean;
  spacing: number;
  onDrawing: (on: boolean) => void;
  onSpacing: (spacing: number) => void;
  onChange: () => void;
  showToast: (msg: string, ms?: number) => void;
}

function Swatches({ onPick, current }: { onPick: (color: string) => void; current?: string }) {
  return (
    <div className="flex items-center gap-1">
      {LANE_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className={`h-5 w-5 rounded border ${current === c ? 'border-white ring-1 ring-white' : 'border-black/40'}`}
          style={{ background: c }}
          title={c}
          aria-label={`Colour ${c}`}
        />
      ))}
      <input type="color" value={current ?? '#38bdf8'} onChange={(e) => onPick(e.target.value)} className="h-5 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent" aria-label="Any colour" />
    </div>
  );
}

export default function LaneToolsBar({ builder, drawing, spacing, onDrawing, onSpacing, onChange, showToast }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const net = builder.getLaneNetwork();
  const line = builder.getSelectedLaneLine();
  const nodes = line ? [] : builder.getSelectedLaneNodeIds();
  const linePath = line ? net?.paths.find((p) => p.id === line.pathId) : undefined;
  const single = nodes.length === 1 ? net?.nodes.find((n) => n.id === nodes[0]) : undefined;
  const endsLane = single && net ? !net.paths.some((p) => p.nodeIds.includes(single.id) && p.nodeIds[p.nodeIds.length - 1] !== single.id) : false;
  const say = (r: { ok: boolean; reason?: string }, ok: string) => { showToast(r.ok ? ok : (r as { reason: string }).reason, r.ok ? 3000 : 4500); onChange(); };

  return (
    <div className="flex flex-col gap-1.5 px-3 pt-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="forge-tool-group" role="radiogroup" aria-label="Lane tool">
          <button role="radio" aria-checked={!drawing} className={`forge-tool ${!drawing ? 'is-on' : ''}`} onClick={() => onDrawing(false)} title="Select: click nodes or the lines between them; double-click a whole line">
            <MousePointer size={13} /> Select
          </button>
          <button role="radio" aria-checked={drawing} className={`forge-tool ${drawing ? 'is-on' : ''}`} onClick={() => onDrawing(true)} title="Draw: press on a node (or open road for a new start) and drag along the road">
            <Pencil size={13} /> Draw
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-zinc-400" title="How far apart the box nodes drop while you draw">
          Node every
          <input type="range" min={BRUSH_SPACING_MIN} max={BRUSH_SPACING_MAX} step={50} value={spacing} onChange={(e) => onSpacing(Number(e.target.value))} className="w-24 accent-amber-500" aria-label="Node spacing" />
          <span className="font-mono text-amber-200 tabular-nums w-9">{spacing}</span>
        </label>
        <span className="flex-1" />
        {confirmClear ? (
          <span className="flex items-center gap-1">
            <span className="text-red-300">Remove every lane?</span>
            <button className="forge-tool !h-6" onClick={() => { const r = builder.clearLanes(); setConfirmClear(false); say(r, 'All lanes gone. Draw: press on the road and drag to start a new one (Ctrl+Z brings them back)'); onDrawing(true); }}>Yes</button>
            <button className="forge-tool !h-6 !px-1.5" onClick={() => setConfirmClear(false)} aria-label="Keep them"><X size={12} /></button>
          </span>
        ) : (
          <button className="forge-tool !h-6" onClick={() => setConfirmClear(true)} title="Remove every lane and node and start again (undo brings them back)">
            <Eraser size={12} /> Start fresh
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer" title="Off: nodes go anywhere (they only pull the ball along). Nodes off the drivable corridor are listed as a warning, never refused.">
          <input type="checkbox" checked={!laneRules.corridor} onChange={(e) => { setLaneCorridorRule(!e.target.checked); onChange(); showToast(e.target.checked ? 'Free node placement: put nodes anywhere' : 'Nodes stay on the drivable corridor again'); }} className="accent-amber-500" />
          Free node placement (no road rule)
        </label>
        {(() => { const off = laneCorridorWarnings(net); return off.length ? <span className="text-amber-300" title={off.join(', ')}>⚠ {off.length} node{off.length === 1 ? '' : 's'} off the drivable corridor (the ball may fall off there)</span> : null; })()}
      </div>

      {drawing && (
        <div className="text-zinc-400">
          <b className="text-zinc-200">Press</b> on a node, or on open road to put a start there, and <b className="text-zinc-200">drag</b> along the road: a box drops every {spacing}. Let go on another node to join it.
        </div>
      )}

      {line && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-700 bg-black/25 px-2 py-1.5">
          <span className="text-zinc-200">{line.nodeIds.length === 2 ? 'Connection' : `Line · ${line.nodeIds.length} nodes`}{linePath ? <> on <b>{linePath.name}</b></> : null}</span>
          <Swatches current={linePath?.color as string | undefined} onPick={(c) => say(builder.colorSelectedLaneLine(c), 'Lane recoloured (balls change only between lanes of one colour)')} />
          <button className="forge-tool !h-6" onClick={() => say(builder.twinSelectedLaneLine(), 'Doubled: two lanes side by side (same colour, so a ball can change between them)')} title="Double this line into two lanes side by side">
            <SplitSquareHorizontal size={12} /> Split into 2 lanes
          </button>
          <button className="forge-tool !h-6" onClick={() => { const r = builder.deleteSelectedLaneLine(); say(r, 'Cut. Ctrl-click the two nodes to join them again'); }} title="Cut the connection (Delete)">
            <Scissors size={12} /> Cut
          </button>
        </div>
      )}

      {!line && nodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-700 bg-black/25 px-2 py-1.5">
          <span className="text-zinc-200">{nodes.length === 1 ? `Node ${nodes[0]}` : `${nodes.length} nodes`}</span>
          <Swatches current={single?.color as string | undefined} onPick={(c) => say(builder.colorSelectedLaneNodes(c), 'Node colour set')} />
          <button className="forge-tool !h-6" onClick={() => say(builder.colorSelectedLaneNodes(null), 'Nodes back to their lane colour')} title="Back to the lane's colour">Lane colour</button>
          {single && endsLane && (
            <button className="forge-tool !h-6" onClick={() => { const made = builder.setFinishAtLaneNode(single.id); showToast(made ? 'A finish line stands here now: races can end at it' : 'A finish line cannot go here', 4000); onChange(); }} title="Put a finish line across the road at this node">
              <Flag size={12} /> Set as finish
            </button>
          )}
          {single && (
            <button className="forge-tool !h-6" onClick={() => { builder.startAtEngine(single.x, single.z); showToast('Test drives start at this node'); onChange(); }} title="Test drives start at this node">
              <Play size={12} /> Start here
            </button>
          )}
        </div>
      )}
    </div>
  );
}
