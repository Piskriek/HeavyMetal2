// Plan 57 §15: a `ui:` panel drawn from its preset. Each part draws its widget kind with the value its source has now, and a part
// whose source has no value draws nothing (the lens rule, at run time as validateScreen holds it at design time). The caller's
// class names, styles and formats keep the look a panel had before it was a preset; the preset holds only its structure.
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { StatBinds, UiPanel, UiPart, UiSource } from '@hm/hudlayout';

type Value = string | number | boolean | null | undefined;
type Shown = string | number | boolean;

export interface UiPanelViewProps {
  readonly panel: UiPanel;
  /** The value at each source path; null or absent draws nothing, and a flag that is down draws nothing. */
  readonly values: Readonly<Record<string, Value>>;
  /** The sources the values come from, for each value's own unit (a stat writes it). */
  readonly sources?: readonly UiSource[];
  /** The panel's element: a section (a card), a div (a pill), or none, when its parts go into the caller's own element. */
  readonly element?: 'section' | 'div' | 'none';
  readonly className?: string;
  readonly ariaLabel?: string;
  /** Whether a section announces its changes (on by default; off where it would announce every hit). */
  readonly live?: boolean;
  /** A heading drawn first, the panel's name in the player's words (the health plate's "Health"). */
  readonly title?: { readonly text: string; readonly className?: string };
  /**
   * A class per part id, so a panel keeps its look (the goal card's `play-next`). A stat's pieces take `<id>.<piece>` keys:
   * `.alert` (added while its alert is up), `.of`, `.linked`, `.rate`, `.share`, `.note`.
   */
  readonly partClass?: Readonly<Record<string, string>>;
  /** A style per part id (a metric's colour as `--c`). */
  readonly partStyle?: Readonly<Record<string, CSSProperties>>;
  /** Data attributes per part id (`data-metric`), keys without the `data-` prefix. */
  readonly partData?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * A part's element where the panel had another: a badge is a `small` (the goal card's next step) or a `span` (the pill's stage);
   * a stat is a `p` or a `div` (the health plate's figure).
   */
  readonly partTag?: Readonly<Record<string, 'small' | 'span' | 'p' | 'div'>>;
  /** How a part's value is written (a stage badge as `S3`, a meter's number floored); a stat's pieces take `<id>.<piece>` keys. */
  readonly format?: Readonly<Record<string, (v: string | number) => string>>;
  /** A meter row's inner classes: its list, its name, its bar (per part), as the HUD's own rows have them. */
  readonly meter?: { readonly list?: string; readonly label?: string; readonly bar?: (partId: string) => string };
  /** The top a number meter is measured against (its source's max); 1 for a ratio. */
  readonly meterMax?: Readonly<Record<string, number>>;
  /** A meter drawn on its own as this many segments, lit up to its share (the health bar), per part id. */
  readonly segments?: Readonly<Record<string, number>>;
  /** What each command does here, by command id; an action whose command has no handler draws nothing. */
  readonly actions?: Readonly<Record<string, () => void>>;
  /** A leading mark's class per part id (the comms chip's orb), drawn as an empty span before the words. */
  readonly partIcon?: Readonly<Record<string, string>>;
  /** An accessible name per part id, where the words alone do not say it (the chip's keys). */
  readonly partAria?: Readonly<Record<string, string>>;
  readonly hudZone?: string;
}

const dataAttrs = (d: Readonly<Record<string, string>> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(d ?? {}).map(([k, v]) => [`data-${k}`, v]));

const hasValue = (v: Value): v is string | number => v !== null && v !== undefined && v !== '' && typeof v !== 'boolean';
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${n}`;
/** A stat's pieces as the player reads them when the caller gives no format: a rate signed, a share as a percentage. */
const STAT_FORMAT: Readonly<Record<keyof StatBinds, (v: string | number) => string>> = {
  of: String, rate: (v) => signed(Number(v)), linked: String, share: (v) => `${Math.round(Number(v) * 100)}%`, alert: String,
};

function StatView(props: { readonly part: UiPart; readonly text: string; readonly common: Record<string, unknown>; readonly p: UiPanelViewProps }): ReactElement {
  const { part, text, common, p } = props;
  const w = part.with ?? {};
  const at = (k: keyof StatBinds): Value => (w[k] !== undefined ? p.values[w[k] as string] : undefined);
  const cls = (piece: string): string | undefined => p.partClass?.[`${part.id}.${piece}`];
  const fmt = (k: keyof StatBinds, v: string | number): string => p.format?.[`${part.id}.${k}`]?.(v) ?? STAT_FORMAT[k](v);
  const alerted = at('alert') === true;
  const unit = p.sources?.find((s) => s.path === part.binds)?.unit;
  const of = at('of'), linked = at('linked'), rate = at('rate'), share = at('share');
  const className = [p.partClass?.[part.id], alerted ? cls('alert') : undefined].filter(Boolean).join(' ') || undefined;
  const Tag = p.partTag?.[part.id] === 'div' ? 'div' : 'p';
  return (
    <Tag {...common} className={className}>
      <b>{text}</b>
      {/* plain words beside the value (the power line), or a span where the caller styles it (the health figure's) */}
      {hasValue(of) ? (cls('of') !== undefined ? <>{' '}<span className={cls('of')}>of {fmt('of', of)}</span></> : ` of ${fmt('of', of)}`) : null}
      {unit ? ` ${unit}` : null}
      {hasValue(linked) && Number(linked) > 0 ? <span className={cls('linked')}> (+{fmt('linked', linked)})</span> : null}
      {hasValue(rate) ? <>{' '}<span className={cls('rate')}>{fmt('rate', rate)}/s</span></> : null}
      {hasValue(share) ? <>{' '}<span className={cls('share')}>{fmt('share', share)}</span></> : null}
      {alerted && part.note ? <em className={cls('note')}>{part.note}</em> : null}
    </Tag>
  );
}

function UiPartView(props: { readonly part: UiPart; readonly value: Shown; readonly p: UiPanelViewProps }): ReactElement {
  const { part, value, p } = props;
  // a flag shows its words while it is up (a notice); every other value is written by its format
  const text = typeof value === 'boolean' ? part.label : p.format?.[part.id]?.(value) ?? String(value);
  const common = { className: p.partClass?.[part.id], style: p.partStyle?.[part.id], 'data-ui-part': part.id, ...dataAttrs(p.partData?.[part.id]) };
  switch (part.look.kind) {
    case 'card': return <h2 {...common}>{text}</h2>;
    case 'readout': return <p {...common}>{text}</p>;
    case 'badge': return p.partTag?.[part.id] === 'span' ? <span {...common} aria-label={`${part.label} ${String(value)}`}>{text}</span> : <small {...common}>{text}</small>;
    case 'stat': return <StatView part={part} text={text} common={common} p={p} />;
    case 'meter': {
      const max = p.meterMax?.[part.id] ?? 1;
      const n = p.segments?.[part.id];
      if (n !== undefined) {
        const lit = Math.ceil(Math.max(0, Math.min(1, Number(value) / max)) * n);
        return (
          <div {...common} role="meter" aria-label={part.label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Number(text)}>
            {Array.from({ length: n }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} />)}
          </div>
        );
      }
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
    case 'action': return (
      <button {...common} aria-label={p.partAria?.[part.id]} onClick={p.actions?.[part.binds]}>
        {p.partIcon?.[part.id] !== undefined ? <span className={p.partIcon[part.id]} /> : null}
        <span>{part.label}</span>
      </button>
    );
  }
}

export function UiPanelView(props: UiPanelViewProps): ReactElement | null {
  if (!props.panel.visible) return null;
  // the parts with a value to show, in order (a flag that is down has none), and the actions with a handler to run; consecutive
  // meter rows share one list, as the HUD's rows do
  const shown = props.panel.parts.filter((part) => {
    if (part.look.kind === 'action') return typeof props.actions?.[part.binds] === 'function';
    const v = props.values[part.binds];
    return v !== null && v !== undefined && v !== '' && v !== false;
  });
  const row = (part: UiPart): boolean => part.look.kind === 'meter' && props.segments?.[part.id] === undefined;
  const out: ReactNode[] = props.title ? [<p key="title" className={props.title.className}>{props.title.text}</p>] : [];
  for (let i = 0; i < shown.length; i++) {
    const part = shown[i]!;
    if (row(part)) {
      const run: UiPart[] = [];
      while (i < shown.length && row(shown[i]!)) run.push(shown[i++]!);
      i -= 1;
      out.push(<ul key={`meters-${run[0]!.id}`} className={props.meter?.list}>{run.map((m) => <UiPartView key={m.id} part={m} value={props.values[m.binds] as Shown} p={props} />)}</ul>);
      continue;
    }
    out.push(<UiPartView key={part.id} part={part} value={part.look.kind === 'action' ? part.label : props.values[part.binds] as Shown} p={props} />);
  }
  if (props.element === 'none') return <>{out}</>;
  const Element = props.element ?? 'section';
  const live = Element === 'section' && props.live !== false ? 'polite' : undefined;
  return (
    <Element className={props.className} aria-live={live} aria-label={props.ariaLabel} data-hud-zone={props.hudZone} data-ui-panel={props.panel.id}>
      {out}
    </Element>
  );
}
