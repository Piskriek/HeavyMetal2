import type { CSSProperties } from 'react';

/** Container panel shared by every kit surface. */
export const panel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 10,
  font: 'inherit',
  color: 'var(--hm-text, #dde6ee)',
  background: 'var(--hm-panel, #151a21)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 12,
};

/** Horizontal, wrapping control row. */
export const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };

/** Compact label + control pairing. */
export const label: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: 'var(--hm-dim, #8fa0b1)',
};

/** Right aligned numeric read-out. */
export const valueText: CSSProperties = {
  minWidth: 42,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--hm-text, #dde6ee)',
};

/** Range / select / number input. */
export const field: CSSProperties = {
  flex: 1,
  minWidth: 120,
  accentColor: 'var(--hm-accent, #ffd24a)',
  font: 'inherit',
};

/** Select and number box inside the manipulation bar. */
export const control: CSSProperties = {
  minHeight: 32,
  font: 'inherit',
  fontSize: 12,
  color: 'var(--hm-text, #dde6ee)',
  background: 'var(--hm-bg, #0f1318)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 8,
  accentColor: 'var(--hm-accent, #ffd24a)',
};

/** 44px touch target button. */
export const touch: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minWidth: 44,
  minHeight: 44,
  padding: '6px 12px',
  font: 'inherit',
  fontSize: 13,
  color: 'var(--hm-text, #dde6ee)',
  background: 'var(--hm-bg, #0f1318)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 10,
  cursor: 'pointer',
};

/** Small pill button (chips, filters, forks). */
export const chip: CSSProperties = {
  minHeight: 32,
  padding: '2px 10px',
  font: 'inherit',
  fontSize: 12,
  color: 'var(--hm-dim, #8fa0b1)',
  background: 'var(--hm-bg, #0f1318)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 999,
  cursor: 'pointer',
};

/** Square icon-only button (eye, delete). */
export const iconButton: CSSProperties = {
  minWidth: 32,
  minHeight: 32,
  padding: 0,
  font: 'inherit',
  fontSize: 12,
  lineHeight: 1,
  color: 'var(--hm-dim, #8fa0b1)',
  background: 'transparent',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 8,
  cursor: 'pointer',
};

/** Accent treatment for anything pressed / active. */
export const accent: CSSProperties = {
  border: '1px solid var(--hm-accent, #ffd24a)',
  color: 'var(--hm-accent, #ffd24a)',
};

/** Search box. */
export const search: CSSProperties = {
  minHeight: 40,
  padding: '6px 10px',
  font: 'inherit',
  fontSize: 14,
  color: 'var(--hm-text, #dde6ee)',
  background: 'var(--hm-bg, #0f1318)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 8,
};

/** Responsive preset grid. */
export const cards: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 10,
};

/** Preset card shell. */
export const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  background: 'var(--hm-bg, #0f1318)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 10,
};

/** Full-bleed button filling a preset card. */
export const picker: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 6,
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};

/** Thumbnail block (img or hash colour). */
export const thumb: CSSProperties = {
  width: '100%',
  height: 72,
  borderRadius: 8,
  display: 'block',
  objectFit: 'cover',
};

/** Tiny uppercase kind badge. */
export const badge: CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--hm-dim, #8fa0b1)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 999,
  padding: '1px 6px',
};

/** Tiny tag chip. */
export const tagChip: CSSProperties = {
  fontSize: 10,
  color: 'var(--hm-dim, #8fa0b1)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 999,
  padding: '1px 6px',
};

/** Secondary metadata text. */
export const meta: CSSProperties = { fontSize: 11, color: 'var(--hm-dim, #8fa0b1)' };
