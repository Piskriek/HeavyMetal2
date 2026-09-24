import React from 'react';
import { X, Keyboard, Compass, Move, Layers, Eye } from 'lucide-react';

interface CheatSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutSection {
  title: string;
  icon: React.ReactNode;
  shortcuts: { key: string; description: string }[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'Transform Gizmo & Tools',
    icon: <Move size={16} className="text-amber-400" />,
    shortcuts: [
      { key: 'W', description: 'Translate mode (move handles)' },
      { key: 'E', description: 'Rotate mode (ring handles)' },
      { key: 'R', description: 'Scale mode (box handles)' },
      { key: 'Q', description: 'Cycle space (World → Local → Track)' },
      { key: 'Esc', description: 'Cancel ongoing drag / deselect' },
    ],
  },
  {
    title: 'Camera & Navigation',
    icon: <Compass size={16} className="text-emerald-400" />,
    shortcuts: [
      { key: 'RMB + Drag', description: 'Look around (free-fly pitch & yaw)' },
      { key: 'WASD', description: 'Fly forward / left / back / right' },
      { key: 'Space / Z', description: 'Fly up / down' },
      { key: 'Shift', description: 'Turbo flight speed (×4)' },
      { key: 'Alt + LMB Drag', description: 'Orbit camera around selection / pivot' },
      { key: 'Mouse Wheel', description: 'Orbit camera zoom in / out' },
      { key: 'F', description: 'Focus camera on selected object' },
      { key: 'Numpad 7 / 1 / 3', description: 'Ortho views: Top / Front / Side' },
    ],
  },
  {
    title: 'Selection & Grouping',
    icon: <Layers size={16} className="text-sky-400" />,
    shortcuts: [
      { key: 'LMB Click', description: 'Select prop (or track node)' },
      { key: 'Shift + Click', description: 'Multi-select additional props' },
      { key: 'Ctrl + G', description: 'Group selected props together' },
      { key: 'Ctrl + Shift + G', description: 'Ungroup selected props' },
      { key: 'Ctrl + D', description: 'Duplicate selected props' },
      { key: 'Delete / Backspace', description: 'Delete selected props' },
      { key: 'Ctrl + Z', description: 'Undo last change' },
      { key: 'Ctrl + Y', description: 'Redo last change' },
    ],
  },
  {
    title: 'Workspace & View',
    icon: <Eye size={16} className="text-purple-400" />,
    shortcuts: [
      { key: 'H', description: 'Zen Mode (toggle all panels)' },
      { key: 'B', description: 'Test Drive (run solo marble test run)' },
      { key: 'V', description: 'Select / Inspect tool' },
      { key: '?', description: 'Toggle this Shortcuts Cheat Sheet' },
    ],
  },
];

export default function CheatSheet({ isOpen, onClose }: CheatSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="builder-forged-panel w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts Cheat Sheet"
      >
        {/* Header */}
        <div className="builder-forged-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-amber-400" />
            <span className="builder-forged-title">FORGE KEYBOARD SHORTCUTS</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-amber-200 hover:text-white rounded hover:bg-black/30 cursor-pointer"
            aria-label="Close Cheat Sheet"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUT_SECTIONS.map((sec) => (
              <div
                key={sec.title}
                className="bg-black/40 border border-amber-900/40 rounded-lg p-3.5 space-y-2.5"
              >
                <div className="flex items-center gap-2 border-b border-amber-800/30 pb-2">
                  {sec.icon}
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    {sec.title}
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {sec.shortcuts.map((sc) => (
                    <div
                      key={sc.key}
                      className="flex items-center justify-between text-xs py-0.5 gap-2"
                    >
                      <span className="text-zinc-300 font-normal">{sc.description}</span>
                      <kbd className="px-2 py-0.5 rounded bg-zinc-900/90 border border-amber-500/30 font-mono text-[11px] font-bold text-amber-200 shadow-sm whitespace-nowrap">
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-black/60 border-t border-amber-900/40 flex justify-end">
          <button onClick={onClose} className="builder-btn px-4 py-1.5">
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
