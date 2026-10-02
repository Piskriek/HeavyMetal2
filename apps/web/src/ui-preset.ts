import type { CSSProperties } from 'react';
import { cmd, type PresetId } from '@hm/contracts';
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
  readonly minimapSize: number;
  /** CSS that hides the HUD parts the preset switches off. */
  readonly hudCss: string;
}

const DEFAULTS = {
  accent: '#ffd24a', text: '#dde6ee', dim: '#8fa0b1', panel: '#151a21', line: '#26303b', ok: '#5fd38d', danger: '#ff6b5e',
  title: 'GOBLIN BALL RACERS', subtitle: 'Basalt Isle', quickLabel: 'Quick Race', seriesLabel: 'Championship', uiScale: 1, minimapSize: 150,
  hudSpeed: true, hudLap: true, hudPosition: true, hudTime: true, hudItem: true,
};

export function themeOf(rt: Runtime): UiTheme {
  const scene = rt.binder.sceneId ? rt.store.get(rt.binder.sceneId) : undefined;
  const ref = scene?.children['interface']?.[0]?.ref;
  const p: Record<string, unknown> = ref && rt.store.get(ref) ? rt.store.resolve(ref).params : {};
  const s = (k: keyof typeof DEFAULTS): string => (typeof p[k] === 'string' && p[k] !== '' ? (p[k] as string) : String(DEFAULTS[k]));
  const n = (k: keyof typeof DEFAULTS, lo: number, hi: number): number => { const v = Number(p[k]); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : Number(DEFAULTS[k]); };
  const on = (k: keyof typeof DEFAULTS): boolean => (typeof p[k] === 'boolean' ? (p[k] as boolean) : true);
  const c = { accent: s('accent'), text: s('text'), dim: s('dim'), panel: s('panel'), line: s('line'), ok: s('ok'), danger: s('danger') };
  const hidden = ([['hudSpeed', 'speed'], ['hudLap', 'lap'], ['hudPosition', 'position'], ['hudTime', 'time'], ['hudItem', 'item']] as const).filter(([k]) => !on(k)).map(([, part]) => `[data-hud="${part}"]`);
  return {
    vars: {
      '--accent': c.accent, '--text': c.text, '--dim': c.dim, '--panel': c.panel, '--line': c.line,
      '--hm-accent': c.accent, '--hm-text': c.text, '--hm-dim': c.dim, '--hm-panel': c.panel, '--hm-line': c.line, '--hm-ok': c.ok, '--hm-danger': c.danger,
      '--hms-scale': String(n('uiScale', 0.8, 1.6)),
    } as CSSProperties,
    title: s('title'), subtitle: s('subtitle'), quickLabel: s('quickLabel'), seriesLabel: s('seriesLabel'),
    minimapSize: n('minimapSize', 80, 260),
    hudCss: hidden.length ? `${hidden.join(',')} { display: none !important; }` : '',
  };
}

/** Make the scene's interface preset (one undo step), starting from the defaults. */
export function ensureInterface(rt: Runtime, sceneId: PresetId): PresetId {
  const existing = rt.store.get(sceneId)?.children['interface']?.[0]?.ref;
  if (existing) return existing;
  rt.commands.transaction('Customise the interface', () => {
    if (!rt.store.get(INTERFACE_ID)) rt.commands.execute(cmd.put({ id: INTERFACE_ID, kind: 'interface', name: 'Interface', params: { ...DEFAULTS } as never, tier: 'play' }, 'Customise the interface'));
    rt.commands.execute(cmd.addChild(sceneId, 'interface', INTERFACE_ID, undefined, 'Customise the interface'));
  });
  return INTERFACE_ID;
}
