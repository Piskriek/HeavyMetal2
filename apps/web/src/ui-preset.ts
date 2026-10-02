import type { CSSProperties } from 'react';
import { layoutFromJson, normalizeLayout, presetById, type HudLayout } from '@hm/hudlayout';
import { cmd, type PresetId } from '@hm/contracts';
import { screensThemeCss } from './screens-theme';
import { THEMES, getTheme, sprayDataUri, themeCss, themeVars, type Tokens } from '@hm/doodletheme';
import type { Runtime } from '@hm/engine';

/**
 * The interface is a preset too. A scene may carry one `interface` preset (slot `interface`); the menus, the HUD and the editor
 * chrome read it, so changing a colour, a word or a HUD part is a variable edit like any other (undoable, drivable, shareable).
 */

export const INTERFACE_ID: PresetId = 'interface-main';

export interface UiTheme {
  /** CSS variables for the app root: both the editor's names and the kit's `--hm-*` names. */
  readonly vars: CSSProperties;
  readonly title: string;
  readonly subtitle: string;
  readonly quickLabel: string;
  readonly seriesLabel: string;
  readonly layout: HudLayout;
  /** CSS that hides the HUD parts the preset switches off. */
  readonly hudCss: string;
  /** The theme's stylesheet (selectors for buttons, panels, inputs ...) plus the root variables. Render once at the app root. */
  readonly css: string;
}

const DEFAULTS = {
  accent: '#ffd24a', text: '#dde6ee', dim: '#8fa0b1', panel: '#151a21', line: '#26303b', ok: '#5fd38d', danger: '#ff6b5e',
  title: 'GOBLIN BALL RACERS', subtitle: 'Basalt Isle', quickLabel: 'Quick Race', seriesLabel: 'Championship', uiScale: 1,
  hudSpeed: true, hudLap: true, hudPosition: true, hudTime: true, hudItem: true,
};

/** The HUD layout the interface preset asks for: a ready-made one, or the custom JSON. */
function layoutFrom(p: Record<string, unknown>): HudLayout {
  const classic = presetById('classic')!;
  const id = typeof p['hudLayout'] === 'string' ? (p['hudLayout'] as string) : 'classic';
  if (id === 'custom' && typeof p['hudLayoutJson'] === 'string') {
    const r = layoutFromJson(p['hudLayoutJson'] as string);
    if (r.layout) return normalizeLayout(r.layout);
  }
  return presetById(id) ?? classic;
}

export function themeOf(rt: Runtime): UiTheme {
  const scene = rt.binder.sceneId ? rt.store.get(rt.binder.sceneId) : undefined;
  const ref = scene?.children['interface']?.[0]?.ref;
  const p: Record<string, unknown> = ref && rt.store.get(ref) ? rt.store.resolve(ref).params : {};
  const s = (k: keyof typeof DEFAULTS): string => (typeof p[k] === 'string' && p[k] !== '' ? (p[k] as string) : String(DEFAULTS[k]));
  const n = (k: keyof typeof DEFAULTS, lo: number, hi: number): number => { const v = Number(p[k]); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : Number(DEFAULTS[k]); };
  const on = (k: keyof typeof DEFAULTS): boolean => (typeof p[k] === 'boolean' ? (p[k] as boolean) : true);
  const own: Record<string, unknown> = ref ? (rt.store.get(ref)?.params as Record<string, unknown>) ?? {} : {};
  const themeName = typeof p['theme'] === 'string' ? (p['theme'] as string) : 'white-wall';
  const tokens: Tokens | null = themeName === 'classic-dark' ? null : getTheme(themeName);
  const doodles = p['doodles'] !== false;
  // with a theme the theme paints the colours; a colour you changed yourself (an own param) still wins
  const pick = (k: 'accent' | 'text' | 'dim' | 'panel' | 'line' | 'ok' | 'danger', t: string | undefined): string => (typeof own[k] === 'string' && own[k] !== '' ? (own[k] as string) : tokens && t ? t : s(k));
  const c = { accent: pick('accent', tokens?.accent), text: pick('text', tokens?.ink), dim: pick('dim', tokens?.dim), panel: pick('panel', tokens?.wall), line: pick('line', tokens?.line), ok: pick('ok', tokens?.ok), danger: pick('danger', tokens?.danger) };
  const hidden = ([['hudSpeed', 'speed'], ['hudLap', 'lap'], ['hudPosition', 'position'], ['hudTime', 'time'], ['hudItem', 'item']] as const).filter(([k]) => !on(k)).map(([, part]) => `[data-hud="${part}"]`);
  return {
    vars: {
      '--accent': c.accent, '--text': c.text, '--dim': c.dim, '--panel': c.panel, '--line': c.line,
      '--hm-accent': c.accent, '--hm-text': c.text, '--hm-dim': c.dim, '--hm-panel': c.panel, '--hm-line': c.line, '--hm-ok': c.ok, '--hm-danger': c.danger,
      '--hms-scale': String(n('uiScale', 0.8, 1.6)),
      ...(tokens ? { '--bg': tokens.bg, '--ink': tokens.ink, '--accent2': tokens.accent2, '--accent3': tokens.accent3, '--on-accent': tokens.onAccent, '--radius': `${tokens.radius}px`, '--stroke': `${tokens.stroke}px`, '--font-display': tokens.fontDisplay, '--font-body': tokens.fontBody, '--font-mono': tokens.fontMono } : {}),
    } as CSSProperties,
    title: s('title'), subtitle: s('subtitle'), quickLabel: s('quickLabel'), seriesLabel: s('seriesLabel'),
    layout: layoutFrom(p),
    css: tokens ? themeSheet(tokens, doodles, c) : '',
    hudCss: hidden.length ? `${hidden.join(',')} { display: none !important; }` : '',
  };
}

/** Make the scene's interface preset (one undo step), starting from the defaults. */
export function ensureInterface(rt: Runtime, sceneId: PresetId): PresetId {
  const existing = rt.store.get(sceneId)?.children['interface']?.[0]?.ref;
  if (existing) return existing;
  rt.commands.transaction('Customise the interface', () => {
    if (!rt.store.get(INTERFACE_ID)) rt.commands.execute(cmd.put({ id: INTERFACE_ID, kind: 'interface', name: 'Interface', params: {} as never, tier: 'play' }, 'Customise the interface'));
    rt.commands.execute(cmd.addChild(sceneId, 'interface', INTERFACE_ID, undefined, 'Customise the interface'));
  });
  return INTERFACE_ID;
}

/** The whole stylesheet for a theme: root variables (so the page behind the app is painted too), the themed controls, and doodles in the panel margins. */
function themeSheet(t: Tokens, doodles: boolean, c: { accent: string; text: string; dim: string; panel: string; line: string; ok: string; danger: string }): string {
  const vars = themeVars({ ...t, accent: c.accent, ink: c.text, dim: c.dim, wall: c.panel, line: c.line, ok: c.ok, danger: c.danger });
  const root = Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ');
  const spray = doodles ? `.panel, .race .menu, .screen { background-image: url("${sprayDataUri(11, 420, 700, t, 0.9)}"); background-repeat: no-repeat; background-position: center; background-size: cover; }` : '';
  return `:root { ${root} --hm-bg: ${c.panel}; --hm-inset: ${t.bg}; color-scheme: ${t.name === 'night-wall' ? 'dark' : 'light'}; }
body { background: var(--bg); color: var(--text); font-family: var(--font-body); }
.maker, .app { font-family: var(--font-body); }
.brand, h1, h2, .title { font-family: var(--font-display); }
${themeCss({ ...t, accent: c.accent, ink: c.text, dim: c.dim, wall: c.panel, line: c.line, ok: c.ok, danger: c.danger })}
${spray}
${screensThemeCss(t, doodles)}`;
}

export { THEMES };
