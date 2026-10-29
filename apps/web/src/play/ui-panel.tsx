// Plan 57 §15: a `ui:` panel drawn from its preset. Each part draws its widget kind with the value its source has now, and a part
// whose source has no value draws nothing (the lens rule, at run time as validateScreen holds it at design time). The caller's
// class names keep the look a panel had before it was a preset.
import type { ReactElement } from 'react';
import type { UiPanel, UiPart } from '@hm/hudlayout';

export interface UiPanelViewProps {
  readonly panel: UiPanel;
  /** The value at each source path; null or absent draws nothing. */
  readonly values: Readonly<Record<string, string | number | null | undefined>>;
  readonly className?: string;
  /** A class per part id, so a panel keeps its look (the goal card's `play-next`). */
  readonly partClass?: Readonly<Record<string, string>>;
  readonly hudZone?: string;
}

function UiPartView(props: { readonly part: UiPart; readonly value: string | number; readonly className: string | undefined }): ReactElement {
  const { part, value, className } = props;
  const text = String(value);
  switch (part.look.kind) {
    case 'card': return <h2 className={className} data-ui-part={part.id}>{text}</h2>;
    case 'readout': return <p className={className} data-ui-part={part.id}>{text}</p>;
    case 'badge': return <small className={className} data-ui-part={part.id}>{text}</small>;
    case 'meter': return <meter className={className} data-ui-part={part.id} min={0} max={1} value={Number(value)} aria-label={part.label} />;
    case 'list': return <ul className={className} data-ui-part={part.id}><li>{text}</li></ul>;
  }
}

export function UiPanelView(props: UiPanelViewProps): ReactElement | null {
  if (!props.panel.visible) return null;
  return (
    <section className={props.className} aria-live="polite" data-hud-zone={props.hudZone} data-ui-panel={props.panel.id}>
      {props.panel.parts.map((part) => {
        const v = props.values[part.binds];
        if (v === null || v === undefined || v === '') return null;
        return <UiPartView key={part.id} part={part} value={v} className={props.partClass?.[part.id]} />;
      })}
    </section>
  );
}
