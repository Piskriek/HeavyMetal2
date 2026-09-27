/**
 * Brightness for placed 3D models: 0 (off, the model as the sun and sky light it) to 100 (its own
 * texture glows on top), to balance a model against the island's terrain. One undo step per drag.
 */
import { useState } from 'react';
import { Sun } from 'lucide-react';

interface BrightnessSliderProps {
  value: number;
  /** `start` is true on the first change of a drag (the caller pushes one undo step then). */
  onChange: (value: number, start: boolean) => void;
  /** Shown beside the label, e.g. "3 models". */
  note?: string;
}

export default function BrightnessSlider({ value, onChange, note }: BrightnessSliderProps) {
  const [dragging, setDragging] = useState(false);
  const level = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex flex-col gap-1 pt-1.5 pb-1 text-xs border-t border-zinc-800/60">
      <div className="flex items-center justify-between">
        <span className="text-zinc-300 font-medium flex items-center gap-1.5">
          <Sun size={13} className={level > 0 ? 'text-amber-400' : 'text-zinc-500'} />
          <span>Brightness</span>
          {note && <span className="text-[10px] text-zinc-500">{note}</span>}
        </span>
        <span className="font-mono text-[11px] text-amber-200 tabular-nums">{level === 0 ? 'Off' : level}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={level}
        aria-label="Model brightness, 0 is off"
        onPointerDown={() => setDragging(false)}
        onChange={(e) => {
          onChange(Number(e.target.value), !dragging);
          setDragging(true);
        }}
        onPointerUp={() => setDragging(false)}
        onKeyUp={() => setDragging(false)}
        className="w-full accent-amber-500 cursor-pointer"
      />
      <span className="text-[10px] text-zinc-500">Raise it until the model sits in the same light as the terrain around it.</span>
    </div>
  );
}
