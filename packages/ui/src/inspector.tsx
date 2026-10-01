import type { ReactElement } from 'react';
import type { Value } from '@hm/contracts';
import { Control, type Emit } from './controls';
import { buildInspectorModel, type InspectorInput, type InspectorRow, type InspectorSlot } from './model';
import { CSS } from './styles';

export type InspectorProps = InspectorInput & {
  readonly onChange: (key: string, value: Value) => void;
  readonly onReset?: (key: string) => void;
};

interface RowProps { readonly row: InspectorRow; readonly idPrefix: string; readonly emit: Emit; readonly onReset: ((key: string) => void) | undefined }

function Row({ row, idPrefix, emit, onReset }: RowProps): ReactElement {
  const id = `${idPrefix}-${row.key}`;
  return (
    <div className={row.overridden ? 'hmi-row hmi-ov' : 'hmi-row'} data-key={row.key} data-overridden={row.overridden ? 'true' : undefined}>
      <label className="hmi-label" htmlFor={id} title={row.doc}>{row.label}</label>
      <div className="hmi-ctl"><Control row={row} id={id} emit={emit} /></div>
      {onReset && row.overridden ? (
        <button type="button" className="hmi-reset" data-reset={row.key} aria-label={`reset ${row.label}`} onClick={() => onReset(row.key)}>reset</button>
      ) : null}
    </div>
  );
}

function Slot({ slot }: { readonly slot: InspectorSlot }): ReactElement {
  return (
    <li className="hmi-slot" data-slot={slot.key}>
      <span className="hmi-label" title={slot.doc}>{slot.label}</span>
      <span className="hmi-count" title={`${slot.min} to ${slot.max ?? 'any number'} allowed`}>{`${slot.children.length} / ${slot.max ?? '∞'}`}</span>
      <span className="hmi-chips">
        {slot.children.length === 0
          ? <span className="hmi-none">empty</span>
          : slot.children.map((c, i) => <span className="hmi-chip" key={`${c.ref}#${i}`}>{c.ref}</span>)}
      </span>
    </li>
  );
}

/** Draws the model built by buildInspectorModel. Stateless: every edit goes out through onChange / onReset. */
export function Inspector(props: InspectorProps): ReactElement {
  const { onChange, onReset, tier } = props;
  const model = buildInspectorModel(props);
  const idPrefix = `hmi-${props.schema.kind}`;
  const empty = model.groups.length === 0 && model.slots.length === 0;
  return (
    <div className={`hmi hmi-${tier}`} data-tier={tier}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {model.groups.map((group) => (
        <section className="hmi-group" key={group.name}>
          {tier === 'play' ? null : <h3 className="hmi-h">{group.name}</h3>}
          <div className="hmi-rows">
            {group.rows.map((row) => <Row key={row.key} row={row} idPrefix={idPrefix} emit={onChange} onReset={onReset} />)}
          </div>
        </section>
      ))}
      {model.slots.length > 0 ? (
        <section className="hmi-group hmi-slots">
          <h3 className="hmi-h">Contains</h3>
          <ul className="hmi-list">{model.slots.map((slot) => <Slot key={slot.key} slot={slot} />)}</ul>
        </section>
      ) : null}
      {empty ? <p className="hmi-empty">Nothing to show.</p> : null}
    </div>
  );
}
