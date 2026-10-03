import { useState, type ReactElement } from 'react';
import { PresetPreview } from '../build/cards';
import { NewChooser, type NewWay } from './new-thing';

/**
 * A new activity, three ways (B13): Quick setup (a copy of Goblin Racing with your name on it), Setup wizard (its name, what it is, its
 * planet; the planet shows as you choose) or Manual (a plain one, straight into the list to change).
 */
export interface NewActivityChoice { readonly name: string; readonly doc?: string; readonly from?: string; readonly planet?: { readonly hue: number; readonly ring: boolean } }
const STEPS = ['Name', 'What it is', 'Its planet'] as const;

export function NewActivity(props: { readonly onMake: (c: NewActivityChoice) => void; readonly onCancel: () => void }): ReactElement {
  const [way, setWay] = useState<NewWay | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [doc, setDoc] = useState('');
  const [hue, setHue] = useState(140);
  const [ring, setRing] = useState(true);
  const named = name.trim();
  if (!way) {
    return <NewChooser thing="activity" onCancel={props.onCancel} onPick={(w) => { if (w === 'manual') props.onMake({ name: 'New activity' }); else setWay(w); }}
      says={{ quick: 'A copy of Goblin Racing with your own name: the same races and rules, its own planet. Change it from there.', wizard: 'Three short steps: its name, what it is, how its planet looks.', manual: 'A plain activity, added to the list for you to change.' }} />;
  }
  if (way === 'quick') {
    return (
      <div className="new-activity">
        <label className="row">Name <input autoFocus value={name} maxLength={40} placeholder="My racing" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && named) props.onMake({ name: named, from: 'goblin-racing' }); }} /></label>
        <div className="btns"><button onClick={() => setWay(null)}>Back</button><span className="grow" /><button className="go" disabled={!named} onClick={() => props.onMake({ name: named, from: 'goblin-racing' })}>Make {named || 'it'}</button></div>
      </div>
    );
  }
  const last = step === STEPS.length - 1;
  return (
    <div className="new-activity wizard">
      <ol className="ad-steps" aria-label="Steps">{STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}><button onClick={() => setStep(i)}>{i + 1}. {s}</button></li>)}</ol>
      <div className="ni-wiz">
        <PresetPreview p={{ kind: 'planet', hue, ring }} size={140} />
        <div className="ni-q">
          {step === 0 ? <><p>What is it called?</p><input autoFocus value={name} maxLength={40} placeholder="My racing" onChange={(e) => setName(e.target.value)} /></> : null}
          {step === 1 ? <><p>What do players do there, in one line?</p><input value={doc} maxLength={120} placeholder="Race round a volcano at night." onChange={(e) => setDoc(e.target.value)} /></> : null}
          {step === 2 ? (
            <>
              <p>How does its planet look?</p>
              <label className="row slider">Colour <input type="range" min={0} max={359} step={1} value={hue} onChange={(e) => setHue(Number(e.target.value))} aria-label="Planet colour" /></label>
              <div className="seg ni-seg" role="group" aria-label="Rings"><button className={ring ? 'on' : ''} aria-pressed={ring} onClick={() => setRing(true)}>With rings</button><button className={!ring ? 'on' : ''} aria-pressed={!ring} onClick={() => setRing(false)}>No rings</button></div>
            </>
          ) : null}
        </div>
      </div>
      <div className="btns">
        <button onClick={() => (step > 0 ? setStep(step - 1) : setWay(null))}>Back</button>
        <span className="grow" />
        {last ? <button className="go" disabled={!named} onClick={() => props.onMake({ name: named, ...(doc.trim() ? { doc: doc.trim() } : {}), planet: { hue, ring } })}>Make {named || 'it'}</button>
          : <button className="go" disabled={step === 0 && !named} onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</button>}
      </div>
    </div>
  );
}
