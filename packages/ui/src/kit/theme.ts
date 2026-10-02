export interface Theme {
  bg: string;
  panel: string;
  line: string;
  text: string;
  dim: string;
  accent: string;
  danger: string;
  ok: string;
}

export const darkTheme: Theme = {
  bg: '#0f1318',
  panel: '#151a21',
  line: '#26303b',
  text: '#dde6ee',
  dim: '#8fa0b1',
  accent: '#ffd24a',
  danger: '#ff6b5e',
  ok: '#5fd38d',
};

export const paperTheme: Theme = {
  bg: '#f3ecdf',
  panel: '#fbf7ef',
  line: '#ded2bd',
  text: '#332f27',
  dim: '#7b7365',
  accent: '#c07d1a',
  danger: '#b4443a',
  ok: '#3f8a5c',
};

export function themeVars(t: Theme): Record<string, string> {
  return {
    '--hm-bg': t.bg,
    '--hm-panel': t.panel,
    '--hm-line': t.line,
    '--hm-text': t.text,
    '--hm-dim': t.dim,
    '--hm-accent': t.accent,
    '--hm-danger': t.danger,
    '--hm-ok': t.ok,
  };
}
