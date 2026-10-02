import type { CSSProperties, ReactElement } from 'react';
import { accent, panel, touch } from './styles';

export interface PaletteItem {
  id: number;
  name: string;
  swatch: string;
  image?: string;
}

export interface PaletteProps {
  items: readonly PaletteItem[];
  selected: number;
  onSelect: (id: number) => void;
  columns?: number;
}

const cell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

const art: CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 6,
  display: 'block',
  objectFit: 'cover',
};

const caption: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.2,
  color: 'var(--hm-dim, #8fa0b1)',
  textAlign: 'center',
  overflowWrap: 'anywhere',
};

export function Palette(props: PaletteProps): ReactElement {
  const columns = props.columns ?? 4;
  return (
    <div
      data-kit="palette"
      style={{ ...panel, display: 'grid', gap: 8, gridTemplateColumns: `repeat(${columns}, minmax(44px, 1fr))` }}
    >
      {props.items.map((item) => {
        const on = item.id === props.selected;
        return (
          <button
            key={item.id}
            type="button"
            data-id={item.id}
            aria-pressed={on}
            data-selected={on ? 'true' : undefined}
            title={item.name}
            onClick={() => props.onSelect(item.id)}
            style={{ ...touch, ...cell, ...(on ? accent : null) }}
          >
            {item.image ? (
              <img alt="" src={item.image} style={art} />
            ) : (
              <span style={{ ...art, background: item.swatch }} />
            )}
            <span style={caption}>{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}
