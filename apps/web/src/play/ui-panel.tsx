// Plan 57 §15: a `ui:` panel drawn from its preset. Each part draws its widget kind with the value its source has now, and a part
// whose source has no value draws nothing (the lens rule, at run time as validateScreen holds it at design time). The caller's
// class names, styles and formats keep the look a panel had before it was a preset; the preset holds only its structure.
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { UiPanel, UiPart } from '@hm/hudlayout';

type Value = string | number | null | undefined;

export interface UiPanelViewProps {
  readonly panel: UiPanel;
  /** The value at each source path; null or absent draws nothing. */
  readonly values: Readonly<Record<string, Value>>;
  /** The panel's element: a section (a card) or a div (a pill). */
  readonly element?: 'section' | 'div';
  readonly className?: string;
  readonly ariaLabel?: string;
  /** A class per part id, so a panel keeps its look (the goal card's `play-next`). */
  readonly partClass?: Readonly<Record<string, string>>;
  /** A style per part id (a metric's colour as `--c`). */
  readonly partStyle?: Readonly<Record<string, CSSProperties>>;
  /** Data attributes per part id (`data-metric`), keys without the `data-` prefix. */
  readonly partData?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** A badge's element per part id: `small` by default (the goal card's next step), `span` where a panel had one (the pill's stage). */
  readonly partTag?: Readonly<Record<string, 'small' | 'span'>>;
  /** How a part's value is written (a stage badge as `S3`, a meter's number floored). */
  readonly format?: Readonly<Record<string, (v: string | number) => string>>;
  /** A meter row's inner classes: its list, its name, its bar (per part), as the HUD's own rows have them. */
  readonly meter?: { readonly list?: string; readonly label?: string; readonly bar?: (partId: string) => string };
  /** The top a number meter is measured against (its source's max); 1 for a ratio. */
  readonly meterMax?: Readonly<Record<string, number>>;
  readonly hudZone?: string;
}

const dataAttrs = (d: Readonly<Record<string, string>> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(d ?? {}).map(([k, v]) => [`data-${k}`, v]));

function UiPartView(props: { readonly part: UiPart; readonly value: string | number; readonly p: UiPanelViewProps }): ReactElement {
  const { part, value, p } = props;
  const text = p.format?.[part.id]?.(value) ?? String(value);
  const common = { className: p.partClass?.[part.id], style: p.partStyle?.[part.id], 'data-ui-part': part.id, ...dataAttrs(p.partData?.[part.id]) };
  switch (part.look.kind) {
    case 'card': return <h2 {...common}>{text}</h2>;
    case 'readout': return <p {...common}>{text}</p>;
    case 'badge': return p.partTag?.[part.id] === 'span' ? <span {...common} aria-label={`${part.label} ${value}`}>{text}</span> : <small {...common}>{text}</small>;
    case 'meter': {
      const max = p.meterMax?.[part.id] ?? 1;
      const share = Math.max(0, Math.min(1, Number(value) / max));
      return (
        <li {...common} title={`${part.label} ${text}`}>
          <span className={p.meter?.label}>{part.label}</span>
          <i className={p.meter?.bar?.(part.id)}><s style={{ width: `${share * 100}%` }} /></i>
          <b>{text}</b>
        </li>
      );
    }
    case 'list': return <ul {...common}><li>{text}</li></ul>;
  }
}

export function UiPanelView(props: UiPanelViewProps): ReactElement | null {
  if (!props.panel.visible) return null;
  // the parts with a value to show, in order; consecutive meters share one list, as the HUD's rows do
  const shown = props.panel.parts.filter((part) => { const v = props.values[part.binds]; return v !== null && v !== undefined && v !== ''; });
  const out: ReactNode[] = [];
  for (let i = 0; i < shown.length; i++) {
    const part = shown[i]!;
    if (part.look.kind === 'meter') {
      const run: UiPart[] = [];
      while (i < shown.length && shown[i]!.look.kind === 'meter') run.push(shown[i++]!);
      i -= 1;
      out.push(<ul key={`meters-${run[0]!.id}`} className={props.meter?.list}>{run.map((m) => <UiPartView key={m.id} part={m} value={props.values[m.binds] as string | number} p={props} />)}</ul>);
      continue;
    }
    out.push(<UiPartView key={part.id} part={part} value={props.values[part.binds] as string | number} p={props} />);
  }
  const Element = props.element ?? 'section';
  return (
    <Element className={props.className} aria-live={Element === 'section' ? 'polite' : undefined} aria-label={props.ariaLabel} data-hud-zone={props.hudZone} data-ui-panel={props.panel.id}>
      {out}
    </Element>
  );
}
