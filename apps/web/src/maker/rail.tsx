import type { ReactElement } from 'react';
import { Brush, Box, MousePointer2, Mountain, Spline, Trash2, TreePalm, type LucideIcon } from 'lucide-react';

/** The left rail: one icon per tool, the name on hover, the keyboard key in the label. */
const ICONS: Record<string, LucideIcon> = { select: MousePointer2, brush: Brush, shape: Mountain, track: Spline, dress: TreePalm, place: Box, delete: Trash2 };

export function ToolRail(props: { readonly tools: readonly { id: string; label: string; hotkey?: string }[]; readonly active: string; readonly onSelect: (id: string) => void }): ReactElement {
  const { tools, active, onSelect } = props;
  return (
    <nav className="rail" aria-label="Tools">
      {tools.map((t) => {
        const Icon = ICONS[t.id] ?? Box;
        return (
          <button key={t.id} className={active === t.id ? 'on' : ''} data-label={`${t.label}${t.hotkey ? ` (${t.hotkey})` : ''}`} aria-label={t.label} aria-pressed={active === t.id} onClick={() => onSelect(t.id)}>
            <Icon size={17} strokeWidth={1.6} />
          </button>
        );
      })}
    </nav>
  );
}
