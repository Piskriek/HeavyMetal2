import { Eye } from 'lucide-react';

interface ZenRestoreProps {
  onRestore: () => void;
  /** The key that brings the panels back, as the player has it bound. */
  keyLabel?: string;
}

export default function ZenRestore({ onRestore, keyLabel = 'H' }: ZenRestoreProps) {
  return (
    <button
      onClick={onRestore}
      className="forge-tool pointer-events-auto absolute top-3 right-3 z-50 shadow-2xl"
      title={`Show the panels [${keyLabel}]`}
      aria-label="Show the panels"
    >
      <Eye size={14} />
      <span>Show panels</span>
      {keyLabel && <kbd className="forge-key">{keyLabel}</kbd>}
    </button>
  );
}
