import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssFor, SIZES, type HudElement, type HudLayout } from '@hm/hudlayout';
import { formatTime, ordinal } from '@hm/ui';
import type { Hud } from '@hm/game';

const box: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 10px', fontSize: 14, fontWeight: 600, color: 'var(--hm-text, #dde6ee)',
  background: 'rgba(12,16,21,0.62)', border: '1px solid var(--hm-line, #26303b)', borderRadius: 12, textShadow: '0 2px 6px rgba(0,0,0,0.65)', boxSizing: 'border-box', pointerEvents: 'none',
};
const dim: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--hm-dim, #8fa0b1)' };

/**
 * The heads-up display, laid out by a `HudLayout` preset: every element has an anchor, an offset, a scale and a visibility,
 * so the player's screen is data. Elements keep the sizes the layout was designed with (SIZES), scaled by their own `scale`.
 */
export function LayoutHud(props: { hud: Hud; layout: HudLayout; minimap: ReactNode }): ReactElement {
  const { hud, layout } = props;
  const body = (e: HudElement): ReactNode => {
    switch (e.kind) {
      case 'speed': return <><span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Math.round(hud.speed)}</span><span style={dim}>km/h</span></>;
      case 'lap': return <>{hud.lap}/{hud.laps}</>;
      case 'position': return <><span style={{ fontSize: 20, fontWeight: 800 }}>{ordinal(hud.position)}</span><span style={dim}>/ {hud.racers}</span></>;
      case 'time': return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(hud.timeMs)}</span>;
      case 'item': return hud.item ? <span style={{ fontSize: 26 }} title={hud.item.label}>{hud.item.icon}</span> : <span style={{ width: 24, height: 24, borderRadius: 8, border: '1px dashed var(--hm-line, #26303b)', display: 'block' }} />;
      case 'message': return hud.message && hud.phase !== 'countdown' ? <span role="status" style={{ fontSize: 18, fontWeight: 800, color: 'var(--hm-accent, #ffd24a)' }}>{hud.message}</span> : null;
      case 'boost': return <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 7, background: 'rgba(0,0,0,0.5)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.round(Math.min(1, Math.max(0, hud.boost)) * 100)}%`, background: 'linear-gradient(90deg,#37f5ff,#ffd24a)' }} /></span>;
      case 'minimap': return props.minimap;
    }
  };
  return (
    <div data-kit="hud" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', font: 'inherit', color: 'var(--hm-text, #dde6ee)' }}>
      {layout.elements.map((e) => {
        const size = SIZES[e.kind];
        const noBox = e.kind === 'minimap' || e.kind === 'boost' || e.kind === 'message';
        return (
          <div key={e.id} data-hud={e.kind} style={{ ...cssFor(e), width: size.w, height: size.h, ...(noBox ? { display: cssFor(e)['display'] === 'none' ? 'none' : 'block' } : box), ...(cssFor(e)['display'] === 'none' ? { display: 'none' } : {}) }}>
            {body(e)}
          </div>
        );
      })}
    </div>
  );
}
