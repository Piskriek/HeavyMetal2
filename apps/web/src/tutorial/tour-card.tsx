import { useEffect, useState, type ReactElement } from 'react';
import { fx } from '../maker/feedback';
import { tourButton, tourLater, tourNever, tourSkip, useTour } from './tour';

/**
 * The tour on screen: a small card at the left with the step, the keys to press and how far along you are. Skip moves on, Not now hides it
 * until the next visit, Never hides it for good. The reveal step has one big button.
 */
/** A ring round the control a step is about (its `highlight` is that control's `data-ui` name), following it if it moves. */
function TourRing(props: { readonly target: string }): ReactElement | null {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    let raf = 0, last = '';
    const tick = (): void => {
      const el = document.querySelector(`[data-ui="${props.target}"]`);
      const r = el?.getBoundingClientRect() ?? null;
      const key = r ? `${r.left},${r.top},${r.width},${r.height}` : '';
      if (key !== last) { last = key; setBox(r && r.width > 0 ? r : null); }
      raf = window.setTimeout(tick, 200) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(raf);
  }, [props.target]);
  if (!box) return null;
  return <div className="tour-ring" aria-hidden="true" style={{ left: box.left - 5, top: box.top - 5, width: box.width + 10, height: box.height + 10 }} />;
}

export function TourCard(): ReactElement | null {
  const t = useTour();
  if (!t.visible || !t.step) return null;
  const s = t.step;
  const reveal = s.advance.type === 'button' && s.advance.id === 'show-pbr';
  return (
    <>
    {s.highlight ? <TourRing target={s.highlight} /> : null}
    <aside className={`tour${reveal ? ' reveal-step' : ''}`} role="dialog" aria-label={`Tour: ${s.title}`}>
      <div className="tour-bar" aria-hidden="true"><i style={{ width: `${Math.round(((t.index + 1) / Math.max(1, t.total)) * 100)}%` }} /></div>
      <small>{t.index + 1} of {t.total}</small>
      <h3>{s.title}</h3>
      <p>{s.text}</p>
      {s.hint && !reveal ? <p className="tour-keys">{s.hint.split(' ').map((k, i) => <kbd key={i}>{k}</kbd>)}</p> : null}
      {reveal ? <button className="go tour-reveal" onClick={() => { fx('ui-click'); tourButton('show-pbr'); }}>Show me</button> : null}
      <div className="tour-btns">
        {s.skippable ? <button onClick={() => { tourSkip(); fx('ui-click', { volume: 0.4 }); }}>Skip</button> : null}
        <span className="grow" />
        <button onClick={tourLater} title="It comes back next time you visit">Not now</button>
        <button onClick={tourNever} title="Start it again any time from the menu">Never</button>
      </div>
    </aside>
    </>
  );
}
