import { useState, type ReactElement } from 'react';
import type { Visibility } from '@hm/plugs';
import { licenseOf } from '@hm/plugs';
import { PresetPreview } from '../build/cards';
import type { Preview } from '../build/catalog';
import { fx } from '../maker/feedback';
import { SHARE_LIMIT, VISIBILITY, parseTags, publish, shareOf, shareProblems, type ShareKind } from './shares';

/**
 * "Share with the community?": who gets it (keep private, up for sale, share freely, share with friends), a name, a description and tags.
 * Shows what others may do with it (the licence) and how big it is against RUN's limit, and refuses with plain reasons.
 */
const ACTION: Readonly<Record<Visibility, string>> = { private: 'Keep it private', sale: 'Put it up for sale', free: 'Share it', friends: 'Share with friends' };
const DONE: Readonly<Record<Visibility, string>> = { private: 'Kept private', sale: 'Up for sale', free: 'Shared', friends: 'Shared with friends' };

export function ShareDialog(props: {
  readonly kind: ShareKind; readonly refId: string; readonly name: string; readonly preview: Preview; readonly data: () => unknown; readonly onDone: (text: string) => void;
}): ReactElement {
  const before = shareOf(props.kind, props.refId);
  const [vis, setVis] = useState<Visibility>(before?.visibility ?? 'free');
  const [name, setName] = useState(before?.name ?? props.name);
  const [description, setDescription] = useState(before?.description ?? '');
  const [tags, setTags] = useState((before?.tags ?? []).join(', '));
  const [price, setPrice] = useState(String(before?.priceCredits ?? 25));
  const [problems, setProblems] = useState<string[]>([]);
  const [bytes] = useState(() => JSON.stringify(props.data() ?? null).length);
  const lic = licenseOf(vis);
  const req = { visibility: vis, name, description, ...(tags.trim() ? { tags: parseTags(tags) } : {}), ...(vis === 'sale' ? { priceCredits: Number(price) } : {}) };
  const live = shareProblems({ ...req, presetId: props.refId }, bytes);
  const go = (): void => {
    const r = publish(props.kind, props.refId, req, props.data());
    if (r.problems.length) { setProblems(r.problems); fx('ui-error'); return; }
    fx('ui-success');
    props.onDone(`${DONE[vis]}: ${r.share!.name}. It is in Community, under Your shares.`);
  };
  return (
    <div className="share" role="form" aria-label="Share with the community">
      <div className="share-head"><PresetPreview p={props.preview} size={64} /><div><h3>Share with the community?</h3><p className="hint">{before ? 'You shared this before: sharing again replaces it.' : 'Choose who gets it.'}</p></div></div>
      <div className="share-vis" role="radiogroup" aria-label="Who gets it">
        {VISIBILITY.map((v) => (
          <button key={v.id} role="radio" aria-checked={vis === v.id} className={vis === v.id ? 'on' : ''} onClick={() => { setVis(v.id); fx('ui-click', { volume: 0.4 }); }}>
            <b>{v.label}</b><span>{v.doc}</span>
          </button>
        ))}
      </div>
      {vis === 'sale' ? <label className="row">Price <input type="number" min={1} max={100000} step={1} value={price} onChange={(e) => setPrice(e.target.value)} /> credits</label> : null}
      <label className="row">Name <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
      <label className="row col">Description <textarea rows={3} maxLength={400} value={description} placeholder="What it is, and what it is good for" onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="row">Tags <input value={tags} placeholder="dig, dust, cosy" onChange={(e) => setTags(e.target.value)} /></label>
      <ul className="share-lic" aria-label="What others may do with it">
        <li className={lic.use ? 'yes' : 'no'}>{vis === 'private' ? 'Only you use it' : 'Others can use it'}</li>
        <li className={lic.remix ? 'yes' : 'no'}>{lic.remix ? 'They can change it' : 'They cannot change it'}</li>
        <li className={lic.resell ? 'yes' : 'no'}>{lic.resell ? 'They can resell it' : 'Nobody can resell it'}</li>
        {lic.credit ? <li className="yes">Your name stays on it</li> : null}
      </ul>
      <p className="hint">{Math.max(1, Math.ceil(bytes / 1000))} KB of the {SHARE_LIMIT / 1000} KB a share can be.</p>
      {(problems.length ? problems : live).length ? <ul className="share-problems" role="alert">{(problems.length ? problems : live).map((p) => <li key={p}>{p}</li>)}</ul> : null}
      <div className="btns"><span className="grow" /><button className="go" disabled={live.length > 0} onClick={go}>{ACTION[vis]}</button></div>
    </div>
  );
}
