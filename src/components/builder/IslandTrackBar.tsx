/**
 * The builder's track picker: the island's tracks (Serpentine Isle and any made here), with New and
 * Duplicate beside it. New starts an empty track on the island; Duplicate copies the open track's
 * placed items under a new name. Each opens the new track at once.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CopyPlus, FilePlus2 } from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';
import type { CourseId } from '../../game/types';
import { ISLAND_COURSE, playableCourses } from '../../game/course-archive';

interface IslandTrackBarProps {
  builder: TrackBuilder3D;
  course: CourseId | undefined;
  onCourseChange?: (course: CourseId) => void;
  showToast: (message: string, ms?: number) => void;
  onRequestRender?: () => void;
}

type Dialog = { mode: 'new' | 'duplicate'; name: string } | null;

export default function IslandTrackBar({ builder, course, onCourseChange, showToast, onRequestRender }: IslandTrackBarProps) {
  const [, setRevision] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const input = useRef<HTMLInputElement>(null);
  const tracks = builder.getIslandTracks();
  const open = tracks?.tracks.find((t) => t.id === tracks.active);
  const courses = playableCourses();

  useEffect(() => { if (dialog) input.current?.select(); }, [dialog?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = () => {
    if (!dialog) return;
    const name = dialog.name.trim();
    if (!name) { showToast('Give the track a name first.'); return; }
    const made = builder.createIslandTrack(name, dialog.mode === 'duplicate');
    if (!made) { showToast('The track could not be saved on this device.', 4000); return; }
    showToast(dialog.mode === 'duplicate' ? `Duplicated as ${made.name}` : `Created ${made.name}`);
    setDialog(null);
    setRevision((r) => r + 1);
    onRequestRender?.();
  };

  return (
    <>
      <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/60 rounded px-2 py-1 text-xs">
        <span className="hidden 2xl:inline text-zinc-400 font-medium text-[11px]">Track:</span>
        {courses.length > 1 && onCourseChange && (
          <select
            className="bg-transparent text-amber-300 focus:outline-none cursor-pointer font-bold text-xs"
            value={course ?? ISLAND_COURSE}
            onChange={(e) => onCourseChange(e.target.value as CourseId)}
            aria-label="Course"
          >
            {courses.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900 text-amber-200">{c.name}</option>)}
          </select>
        )}
        {tracks ? (
          <select
            className="bg-transparent text-amber-300 focus:outline-none cursor-pointer font-bold text-xs max-w-[12rem]"
            value={tracks.active}
            aria-label="Island track"
            onChange={(e) => {
              if (builder.switchIslandTrack(e.target.value)) {
                showToast(`Opened ${tracks.tracks.find((t) => t.id === e.target.value)?.name ?? 'track'}`);
                setRevision((r) => r + 1);
                onRequestRender?.();
              }
            }}
          >
            {tracks.tracks.map((t) => <option key={t.id} value={t.id} className="bg-zinc-900 text-amber-200">{t.name}</option>)}
          </select>
        ) : courses.length <= 1 && (
          <span className="text-amber-300 font-bold">{courses.find((c) => c.id === course)?.name}</span>
        )}
      </div>
      {tracks && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setDialog({ mode: 'new', name: 'New track' })}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border font-medium cursor-pointer bg-zinc-900/80 hover:bg-zinc-800 text-amber-300 border-zinc-700/50"
            title="Create a new empty track on the island"
          >
            <FilePlus2 size={13} /><span className="hidden 2xl:inline">New</span>
          </button>
          <button
            onClick={() => setDialog({ mode: 'duplicate', name: `${open?.name ?? 'Track'} copy` })}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border font-medium cursor-pointer bg-zinc-900/80 hover:bg-zinc-800 text-amber-300 border-zinc-700/50"
            title="Make a copy of the open track under a new name"
          >
            <CopyPlus size={13} /><span className="hidden 2xl:inline">Duplicate</span>
          </button>
        </div>
      )}

      {/* On the page itself: the toolbar's blur would otherwise pin a fixed dialog inside the toolbar. */}
      {dialog && createPortal(
        <div className="forge-theme fixed inset-0 z-[80] flex items-center justify-center bg-black/55 pointer-events-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="island-track-dialog-title"
            className="w-[22rem] max-w-[calc(100vw-2rem)] bg-zinc-950 border border-amber-500/60 rounded-lg p-4 shadow-2xl text-amber-100 flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); confirm(); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setDialog(null); }}
          >
            <h2 id="island-track-dialog-title" className="text-sm font-bold text-amber-300">
              {dialog.mode === 'duplicate' ? `Duplicate ${open?.name ?? 'this track'}?` : 'New track on the island'}
            </h2>
            <p className="text-xs text-zinc-400">
              {dialog.mode === 'duplicate'
                ? 'The copy gets every placed item of the open track, and opens so you can change it. The original stays as it is.'
                : 'An empty track on the island. The tracks you already have stay as they are.'}
            </p>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Name
              <input
                ref={input}
                value={dialog.name}
                maxLength={40}
                onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-amber-100 focus:outline-none focus:border-amber-500"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-xs rounded border border-amber-400 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold cursor-pointer">
                {dialog.mode === 'duplicate' ? 'Duplicate' : 'Create'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
