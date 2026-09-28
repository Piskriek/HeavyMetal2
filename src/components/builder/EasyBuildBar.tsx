/**
 * Easy Build: one toolbar to build a track by walking down the road (src/game/builder/easy-build.ts).
 *
 *   ◀ [ the road, start to finish, with every race piece and stunt on it, and the cursor ] ▶
 *   Race · Stunts · Roadside · Nature · Rocks        1 … 9 the pieces        picked piece · checklist
 *
 * Pick a piece and it drops at the cursor, lined up with the road, and the cursor walks on a stretch
 * (Auto-walk), so a track is built by picking what comes next. Roadside pieces alternate sides. The
 * camera glides behind the cursor. Every key is in the key sheet and can be changed.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  Check, ChevronLeft, ChevronRight, CircleDot, Flag, Footprints, Minus, Mountain, Palmtree, Play, Plus, RotateCcw, RotateCw,
  FlipHorizontal2, Rocket, Trash2, Fence, Sparkles,
} from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';
import type { PlacedProp } from '../../game/builder/prop-catalog';
import {
  EASY_SHELVES, EASY_STRETCHES, ROAD_SPOTS, clampShare, easyItem, easyShelf, nextSide, stepShare, stretchOf, trackChecklist,
  type EasyItem, type EasyShelfId, type RoadSpot,
} from '../../game/builder/easy-build';
import { FINISH_LINE_TYPE, START_LINE_TYPE } from '../../game/race-marks';

interface EasyBuildBarProps {
  builder: TrackBuilder3D;
  props: readonly PlacedProp[];
  selectedCount: number;
  keyLabel: (action: string) => string;
  /** The editor's key handler hands Easy Build's keys here. */
  keyRef: MutableRefObject<(action: string) => void>;
  showToast: (msg: string, ms?: number) => void;
  onRequestRender?: () => void;
  onTestRace?: () => void;
}

const SHELF_ICON: Record<EasyShelfId, typeof Flag> = { race: Flag, stunts: Rocket, roadside: Fence, nature: Palmtree, rocks: Mountain };
const SPOT_LABEL: Record<RoadSpot | 'auto', string> = { auto: 'Auto', left: 'Left', middle: 'Middle', right: 'Right', roadside: 'Roadside' };
const SPOT_CYCLE: readonly (RoadSpot | 'auto')[] = ['auto', ...ROAD_SPOTS];
const MARKER_TYPES = new Set(EASY_SHELVES.filter((s) => s.id === 'race' || s.id === 'stunts').flatMap((s) => s.items.map((i) => i.type)));
const SHARE_KEY = 'hm2-easy-build-v1';

function readSaved(): { shelf: EasyShelfId; autoWalk: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(SHARE_KEY) ?? '{}') as { shelf?: string; autoWalk?: boolean };
    return { shelf: EASY_SHELVES.some((s) => s.id === raw.shelf) ? raw.shelf as EasyShelfId : 'race', autoWalk: raw.autoWalk !== false };
  } catch { return { shelf: 'race', autoWalk: true }; }
}

export default function EasyBuildBar({ builder, props, selectedCount, keyLabel, keyRef, showToast, onRequestRender, onTestRace }: EasyBuildBarProps) {
  const saved = useMemo(readSaved, []);
  const [shelfId, setShelfId] = useState<EasyShelfId>(saved.shelf);
  const [share, setShare] = useState(() => clampShare(Math.round(builder.easyShareAtCamera() * EASY_STRETCHES) / EASY_STRETCHES));
  const [spot, setSpot] = useState<RoadSpot | 'auto'>('auto');
  const [side, setSide] = useState<1 | -1>(1);
  const [autoWalk, setAutoWalk] = useState(saved.autoWalk);
  const [last, setLast] = useState<EasyItem | null>(null);
  const [hover, setHover] = useState<EasyItem | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const shelf = easyShelf(shelfId);

  useEffect(() => {
    try { localStorage.setItem(SHARE_KEY, JSON.stringify({ shelf: shelfId, autoWalk })); } catch { /* this visit only */ }
  }, [shelfId, autoWalk]);

  const spotFor = (item: EasyItem | null): RoadSpot => (spot === 'auto' ? item?.spot ?? 'middle' : spot);
  const preview = hover ?? last ?? shelf.items[0];

  // The camera follows the cursor down the road; the ring shows where the next piece lands.
  useEffect(() => {
    builder.easyLookAt(share, spotFor(preview), side, preview?.type);
    onRequestRender?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builder, share]);
  useEffect(() => {
    builder.showEasyCursor(builder.easyRoadPose(share, 'middle'), builder.easyRoadPose(share, spotFor(preview), side, preview?.type));
    onRequestRender?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builder, spot, side, preview?.type]);
  const renderRef = useRef(onRequestRender);
  renderRef.current = onRequestRender;
  // Leaving Easy Build takes the cursor off the road (only on unmount: the render callback changes every render).
  useEffect(() => () => { builder.showEasyCursor(null); renderRef.current?.(); }, [builder]);

  const walk = (dir: 1 | -1) => setShare((s) => stepShare(s, dir));

  const drop = (item: EasyItem) => {
    const where = spotFor(item);
    const placed = builder.easyDrop(item.type, share, where, side);
    if (!placed) {
      showToast(builder.getPlacementError() ?? `${item.name} does not fit here`, 4000);
      builder.clearPlacementError();
      return;
    }
    setLast(item);
    if (where === 'roadside') setSide((s) => nextSide(s));
    showToast(`${item.name} · stretch ${stretchOf(share)} of ${EASY_STRETCHES}${where === 'roadside' ? '' : ` · ${SPOT_LABEL[where].toLowerCase()}`}`);
    if (autoWalk && item.type !== FINISH_LINE_TYPE) walk(1);
    onRequestRender?.();
  };

  const turn = (deg: number) => { builder.rotateSelectedProps((deg * Math.PI) / 180); onRequestRender?.(); };
  const grow = (k: number) => { builder.scaleSelectedProps(k); onRequestRender?.(); };

  // Keys (the editor's handler routes easy.* and the turn keys here).
  keyRef.current = (action: string) => {
    if (action === 'easy.prev') walk(-1);
    else if (action === 'easy.next') walk(1);
    else if (action === 'easy.side') {
      const next = SPOT_CYCLE[(SPOT_CYCLE.indexOf(spot) + 1) % SPOT_CYCLE.length];
      setSpot(next);
      showToast(`Drop spot: ${SPOT_LABEL[next]}`);
    } else if (action === 'easy.place') {
      if (last) drop(last); else showToast('Pick a piece first (1–9)');
    } else if (action === 'easy.nextShelf' || action === 'easy.prevShelf') {
      const i = EASY_SHELVES.findIndex((s) => s.id === shelfId);
      const next = EASY_SHELVES[(i + (action === 'easy.nextShelf' ? 1 : EASY_SHELVES.length - 1)) % EASY_SHELVES.length];
      setShelfId(next.id);
      showToast(next.label);
    } else if (action.startsWith('easy.item')) {
      const item = shelf.items[Number(action.slice('easy.item'.length)) - 1];
      if (item) drop(item);
    } else if (action === 'edit.turnLeft' || action === 'edit.turnRight') {
      if (selectedCount) turn(action === 'edit.turnLeft' ? 15 : -15);
    }
  };

  // The builder edits its prop list in place, so these are read fresh each render (a few props).
  const markers = builder.easyMarkers(MARKER_TYPES);
  const checklist = trackChecklist(props);
  const nextStep = checklist.find((c) => !c.done);

  const pickShareFromStrip = (clientX: number) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    setShare(clampShare(Math.round(((clientX - rect.left) / rect.width) * EASY_STRETCHES) / EASY_STRETCHES));
  };

  return (
    <div className="forge-bar forge-bar--bottom easy-bar pointer-events-auto select-none">
      {/* The road, start to finish */}
      <div className="easy-road-row">
        <button className="forge-tool" onClick={() => walk(-1)} title={`Back along the road [${keyLabel('easy.prev')}]`} aria-label="Back along the road">
          <ChevronLeft size={15} /><kbd className="forge-key">{keyLabel('easy.prev')}</kbd>
        </button>
        <div
          ref={stripRef}
          className="easy-road"
          role="slider"
          aria-label="Where on the road"
          aria-valuemin={1}
          aria-valuemax={EASY_STRETCHES}
          aria-valuenow={stretchOf(share)}
          tabIndex={0}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pickShareFromStrip(e.clientX); }}
          onPointerMove={(e) => { if (e.buttons & 1) pickShareFromStrip(e.clientX); }}
        >
          <div className="easy-road-ticks" />
          {markers.map((m) => (
            <span
              key={m.id}
              className={`easy-marker ${m.type === START_LINE_TYPE ? 'is-start' : m.type === FINISH_LINE_TYPE ? 'is-finish' : ''}`}
              style={{ left: `${m.share * 100}%` }}
              title={easyItem(m.type)?.name}
            />
          ))}
          <span className="easy-cursor" style={{ left: `${share * 100}%` }}><Footprints size={12} /></span>
        </div>
        <button className="forge-tool" onClick={() => walk(1)} title={`On along the road [${keyLabel('easy.next')}]`} aria-label="On along the road">
          <kbd className="forge-key">{keyLabel('easy.next')}</kbd><ChevronRight size={15} />
        </button>
        <span className="easy-stretch">Stretch <b>{stretchOf(share)}</b>/{EASY_STRETCHES}</span>
        <div className="forge-tool-group" role="radiogroup" aria-label="Drop spot">
          {SPOT_CYCLE.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={spot === s}
              className={`forge-tool ${spot === s ? 'is-on' : ''}`}
              onClick={() => setSpot(s)}
              title={s === 'auto' ? 'Each piece goes where it belongs (race pieces on the road, scenery beside it)' : `Drop on the ${SPOT_LABEL[s].toLowerCase()} [${keyLabel('easy.side')} cycles]`}
            >
              {SPOT_LABEL[s]}
            </button>
          ))}
        </div>
        <button
          className="forge-tool"
          aria-pressed={autoWalk}
          onClick={() => setAutoWalk((v) => !v)}
          title="Auto-walk: after a drop the cursor walks on a stretch, ready for the next piece"
        >
          <Footprints size={14} /><span className="hidden xl:inline">Auto-walk</span>
        </button>
      </div>

      <div className="easy-main-row">
        {/* Shelves, Sims style */}
        <nav className="easy-shelves" aria-label="Shelves">
          {EASY_SHELVES.map((s) => {
            const Icon = SHELF_ICON[s.id];
            return (
              <button key={s.id} className={`easy-shelf ${s.id === shelfId ? 'is-on' : ''}`} onClick={() => setShelfId(s.id)} title={`${s.label}: ${s.hint} [${keyLabel('easy.prevShelf')} / ${keyLabel('easy.nextShelf')}]`} aria-pressed={s.id === shelfId}>
                <span className="easy-shelf-icon"><Icon size={19} /></span>
                <span className="easy-shelf-label">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* The pieces: click drops at the cursor */}
        <div className="easy-items builder-shelf-scroll" onPointerLeave={() => setHover(null)}>
          {shelf.items.map((item, i) => (
            <button
              key={item.type}
              className={`easy-item ${last?.type === item.type ? 'is-last' : ''}`}
              onClick={() => drop(item)}
              onPointerEnter={() => setHover(item)}
              title={`${item.name}: drops at the cursor${i < 9 ? ` [${keyLabel(`easy.item${i + 1}`)}]` : ''}`}
            >
              {i < 9 && <kbd className="easy-item-key">{keyLabel(`easy.item${i + 1}`)}</kbd>}
              <img src={item.thumb} alt="" draggable={false} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        {/* The picked piece, and what the track still needs */}
        <div className="easy-side">
          {selectedCount > 0 ? (
            <div className="easy-picked">
              {nextStep && <span className="easy-next"><Sparkles size={11} /> Next: {nextStep.label.toLowerCase()}</span>}
              <span className="easy-caption">Picked · {selectedCount}</span>
              <div className="flex items-center gap-1">
                <button className="forge-tool !px-1.5" onClick={() => turn(15)} title={`Turn left 15° [${keyLabel('edit.turnLeft')}]`} aria-label="Turn left"><RotateCcw size={14} /></button>
                <button className="forge-tool !px-1.5" onClick={() => turn(-15)} title={`Turn right 15° [${keyLabel('edit.turnRight')}]`} aria-label="Turn right"><RotateCw size={14} /></button>
                <button className="forge-tool !px-1.5" onClick={() => { builder.flipSelectedProps(); onRequestRender?.(); }} title={`Mirror [${keyLabel('edit.flip')}]`} aria-label="Mirror"><FlipHorizontal2 size={14} /></button>
                <button className="forge-tool !px-1.5" onClick={() => grow(1 / 1.15)} title="Smaller" aria-label="Smaller"><Minus size={14} /></button>
                <button className="forge-tool !px-1.5" onClick={() => grow(1.15)} title="Bigger" aria-label="Bigger"><Plus size={14} /></button>
                <button className="forge-tool !px-1.5" onClick={() => { builder.deleteSelected(); onRequestRender?.(); }} title={`Delete [${keyLabel('edit.delete')}]`} aria-label="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ) : (
            <ul className="easy-checklist" aria-label="What the track needs">
              {checklist.map((c) => (
                <li key={c.id} className={c.done ? 'is-done' : c === nextStep ? 'is-next' : ''}>
                  {c.done ? <Check size={12} /> : c === nextStep ? <Sparkles size={12} /> : <CircleDot size={12} />}{c.label}
                </li>
              ))}
            </ul>
          )}
          {onTestRace && (
            <button className="forge-cta" onClick={(e) => { (e.currentTarget as HTMLElement).blur(); onTestRace(); }} title={`Race it [${keyLabel('race.test')}]`}>
              <Play size={13} fill="currentColor" /> Test race
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
