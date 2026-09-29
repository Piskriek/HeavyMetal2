/**
 * The Start button (top bar): where a test drive starts. Every start spot (the grid, each start line,
 * each lane's first node, the test ball) with Go (fly there) and Start here (put the test ball on it);
 * "Put it where I click"; back to the grid; the start hook's height. When the ball stands off the
 * course, a hologram ball shows where the race really begins and a dotted line the lane it rolls
 * onto, and this says so.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Crosshair, Flag, Locate, MapPin, Play, Route, RotateCcw, X } from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';

interface Props {
  builder: TrackBuilder3D;
  placing: boolean;
  onPlace: (on: boolean) => void;
  onChange: () => void;
  showToast: (msg: string, ms?: number) => void;
}

const KIND_ICON = { grid: Flag, 'start-line': Flag, lane: Route, 'test-ball': MapPin } as const;

export default function StartOptions({ builder, placing, onPlace, onChange, showToast }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ right: number; top: number } | null>(null);
  const ball = builder.getTestBall();
  const reality = builder.testStartReality();
  const spots = builder.startSpots();
  const height = builder.getTestBallHeight();

  return (
    <>
      <button
        className={`forge-tool ${open || placing ? 'is-on' : ''}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ right: window.innerWidth - r.right, top: r.bottom + 6 });
          setOpen((v) => !v);
        }}
        title="Where a test drive starts: go to a start, put the start anywhere, back to the grid"
        aria-expanded={open}
      >
        <MapPin size={14} /><span className="hidden lg:inline">Start</span>
      </button>
      {open && anchor && createPortal(
        <div
          className="forge-theme fixed z-[75] w-80 pointer-events-auto rounded-lg border border-amber-500/60 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md text-amber-100 flex flex-col gap-2"
          style={{ right: anchor.right, top: anchor.top }}
          role="dialog"
          aria-label="Start options"
        >
          <div className="flex items-center justify-between">
            <span className="forge-title text-[12px] font-bold text-amber-300">Test drives start from</span>
            <button className="forge-tool !px-1.5" onClick={() => setOpen(false)} aria-label="Close"><X size={13} /></button>
          </div>
          <div className="text-[12px] text-zinc-200">
            {ball ? <>The test ball{height > 0 ? <>, hanging {height} up on the start hook (it drops)</> : null}.</> : <>The grid (no test ball placed).</>}
          </div>
          {reality && reality.offBy > 120 && (
            <div className="rounded border border-cyan-700/60 bg-cyan-950/40 p-2 text-[11px] text-cyan-100">
              The ball stands {Math.round(reality.offBy)} off the course. The race starts at the <b>hologram ball</b> on the road
              nearest to it{reality.laneName ? <>, then rolls onto <b>{reality.laneName}</b> (dotted line)</> : null}.
              <button className="ml-1 underline" onClick={() => {
                const at = builder.getTestBall();
                if (at) { builder.startAtEngine(at.x, at.z); onChange(); showToast('The ball is on the road now, where the race starts'); }
              }}>Put the ball there</button>
            </div>
          )}
          {reality && reality.offBy <= 120 && reality.laneName && (
            <div className="text-[11px] text-zinc-400">It rolls onto <b className="text-zinc-200">{reality.laneName}</b> (the dotted line shows where it joins).</div>
          )}

          <ul className="flex flex-col gap-0.5 max-h-56 overflow-y-auto builder-scroll">
            {spots.map((spot) => {
              const Icon = KIND_ICON[spot.kind];
              return (
                <li key={spot.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-zinc-900 text-[12px]">
                  <Icon size={13} style={spot.color ? { color: spot.color } : undefined} className={spot.color ? '' : 'text-amber-400'} />
                  <span className="flex-1 truncate">{spot.label}</span>
                  <button className="forge-tool !h-6 !px-1.5" title="Fly the camera there" onClick={() => { builder.flyToEngine(spot.x, spot.z); onChange(); }}>
                    <Locate size={12} /> Go
                  </button>
                  {spot.kind !== 'test-ball' && (
                    <button className="forge-tool !h-6 !px-1.5" title="Test drives start here" onClick={() => {
                      builder.startAtEngine(spot.x, spot.z);
                      onChange();
                      showToast(`Test drives start at ${spot.label.toLowerCase()}`);
                    }}>
                      <Play size={12} /> Start
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 pt-2">
            <button className={`forge-tool ${placing ? 'is-on' : ''}`} onClick={() => { onPlace(!placing); if (!placing) setOpen(false); }} title="Click the road (or a ramp or deck) to put the start there">
              <Crosshair size={13} /> Put it where I click
            </button>
            <button className="forge-tool" disabled={!ball} onClick={() => { builder.setTestBall(null); onChange(); showToast('Test drives start from the grid again'); }}>
              <RotateCcw size={13} /> Grid
            </button>
          </div>
          {ball && (
            <label className="flex items-center gap-2 text-[11px] text-zinc-300" title="How high the ball hangs on the start hook; it drops when the test starts (0: it rests on the ground and gets the push). Shift-drag the ball to lift it.">
              Start hook height
              <input
                type="number" min={0} max={20000} step={50} value={height}
                onChange={(e) => { builder.setTestBallHeight(Number(e.target.value) || 0); onChange(); }}
                className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs text-amber-200"
              />
            </label>
          )}
          <div className="text-[10px] text-zinc-500">Drag the yellow ball to move the start; Shift-drag lifts it onto the hook.</div>
        </div>,
        document.body,
      )}
    </>
  );
}
