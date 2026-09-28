import { Maximize2 } from 'lucide-react';

interface ZenRestoreProps {
  onRestore: () => void;
}

export default function ZenRestore({ onRestore }: ZenRestoreProps) {
  return (
    <button
      onClick={onRestore}
      className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 builder-btn text-xs shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105"
      title="Exit Zen Mode (H)"
      aria-label="Exit Zen Mode"
    >
      <Maximize2 size={14} className="text-amber-400" />
      <span className="font-semibold text-amber-200">RESTORE UI [H]</span>
    </button>
  );
}
