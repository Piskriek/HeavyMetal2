import type { ReactElement, ReactNode } from 'react';

/**
 * Making anything new offers three ways in (owner, 2026-10-03, B13): Quick setup (a ready-made start, one click), Setup wizard (a few plain
 * questions, one per step, with the result showing as you answer) and Manual (a plain one and the full editor). The way you picked last time
 * for this kind of thing is marked, so a returning player goes straight there.
 */
export type NewWay = 'quick' | 'wizard' | 'manual';

import { kv } from '../storage/profile-storage';

const KEY = (thing: string): string => `hm.newway.${thing}`;
export function lastWay(thing: string): NewWay | null {
  try { const v = kv.get(KEY(thing)); return v === 'quick' || v === 'wizard' || v === 'manual' ? v : null; } catch { return null; }
}
const remember = (thing: string, way: NewWay): void => { try { kv.set(KEY(thing), way); } catch { /* storage blocked */ } };

const WAYS: readonly { readonly id: NewWay; readonly name: string; readonly effort: string }[] = [
  { id: 'quick', name: 'Quick setup', effort: 'One click' },
  { id: 'wizard', name: 'Setup wizard', effort: 'A few questions' },
  { id: 'manual', name: 'Manual', effort: 'Every detail' },
];

export function NewChooser(props: {
  /** Which kind of thing (remembers the last way per kind): 'avatar', 'island', 'activity' ... */
  readonly thing: string;
  /** What each way gives you, for this kind of thing. */
  readonly says: Readonly<Record<NewWay, string>>;
  readonly onPick: (way: NewWay) => void;
  readonly onCancel: () => void;
  /** Asked before the ways (the avatar asks which kind). */
  readonly before?: ReactNode;
}): ReactElement {
  const last = lastWay(props.thing);
  return (
    <div className="new-chooser" role="group" aria-label="How to make it">
      {props.before}
      <div className="nc-ways">
        {WAYS.map((w) => (
          <button key={w.id} className={`nc-way${last === w.id ? ' last' : ''}`} onClick={() => { remember(props.thing, w.id); props.onPick(w.id); }}>
            <b>{w.name}</b>
            <em>{last === w.id ? 'Your last choice' : w.effort}</em>
            <span>{props.says[w.id]}</span>
          </button>
        ))}
      </div>
      <button className="quiet nc-cancel" onClick={props.onCancel}>Cancel</button>
    </div>
  );
}
