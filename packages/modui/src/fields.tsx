import type { CSSProperties, ReactNode } from 'react';

export const C = {
  text: 'var(--hm-text, #dde6ee)',
  accent: 'var(--hm-accent, #ffd24a)',
  panel: 'var(--hm-panel, #151a21)',
  line: 'var(--hm-line, #26303b)',
  dim: 'var(--hm-dim, #8395a7)',
  inset: 'var(--hm-inset, #0d1116)',
} as const;

export const inputStyle: CSSProperties = {
  background: C.inset,
  color: C.text,
  border: `1px solid ${C.line}`,
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 11,
  minWidth: 64,
};

export const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 11,
  color: C.dim,
};

export const btnStyle: CSSProperties = {
  background: C.panel,
  color: C.text,
  border: `1px solid ${C.line}`,
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

export function Row({ children }: { children: ReactNode }): ReactNode {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>{children}</div>;
}

/** Labelled number input: data-field, parses to a number, ignores NaN/blank. */
export function Num(props: {
  field: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}): ReactNode {
  return (
    <label style={labelStyle}>
      <span>{props.label}</span>
      <input
        type="number"
        data-field={props.field}
        value={Number.isFinite(props.value) ? props.value : 0}
        step={props.step ?? 0.05}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          if (e.target.value.trim() === '') return;
          const v = Number(e.target.value);
          if (!Number.isFinite(v)) return;
          props.onChange(v);
        }}
        style={inputStyle}
      />
    </label>
  );
}

/** Labelled select: data-field, string values. */
export function Sel(props: {
  field: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}): ReactNode {
  return (
    <label style={labelStyle}>
      <span>{props.label}</span>
      <select data-field={props.field} value={props.value} onChange={(e) => props.onChange(e.target.value)} style={inputStyle}>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Labelled text input: data-field. */
export function Txt(props: { field: string; label: string; value: string; onChange: (v: string) => void }): ReactNode {
  return (
    <label style={labelStyle}>
      <span>{props.label}</span>
      <input type="text" data-field={props.field} value={props.value} onChange={(e) => props.onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}
