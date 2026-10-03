import { useState, type ReactElement } from 'react';
import type { Profile } from './profile';
import { VISIBILITY, unshare, useShares } from '../share/shares';
import { PresetPreview } from '../build/cards';
import type { Preview } from '../build/catalog';
import { spriteOf } from '../build/sprites';
import { IslandMap } from '../islands/new-island';
import { TEMPLATE_SHAPES } from '../maker/scene';

/**
 * The Community tab: presets other people share. Until the platform backend exists this is a seeded simulated community, so share / get / buy / trade
 * can be tried. Visibility follows the publish choices: free (remix allowed), for sale (credits), friends. Credits only, never real money.
 */
interface Listing { id: string; name: string; by: string; kind: string; price: number; swatch: string; doc: string; preview?: () => Preview; island?: string }
/** What each kind of share is called in the filters. */
const KIND_NAMES: Readonly<Record<string, string>> = { all: 'Everything', sprite: 'Sprites', sound: 'Sounds', island: 'Islands', rules: 'Race rules', model: 'Things' };
const LISTINGS: readonly Listing[] = [
  { id: 'l1', name: 'Dust puff', by: 'Mudwick', kind: 'sprite', price: 0, swatch: '#d9c9a3', doc: 'A soft dust burst for digging and sculpting.', preview: () => ({ kind: 'sprite', sprite: spriteOf('dust') }) },
  { id: 'l2', name: 'Thud', by: 'Snaggle', kind: 'sound', price: 0, swatch: '#8c8a80', doc: 'A satisfying low thud.', preview: () => ({ kind: 'sound', id: 'hit-wall' }) },
  { id: 'l3', name: 'Neon boost trail', by: 'Fizzle', kind: 'sprite', price: 40, swatch: '#ff2e88', doc: 'A glowing trail for boost pads.', preview: () => ({ kind: 'sprite', sprite: { ...spriteOf('sparkle'), colorA: '#ff2e88', colorB: '#ff8fc4', colorC: '#ffffff' } }) },
  { id: 'l4', name: 'Crystal island', by: 'Grizzle', kind: 'island', price: 120, swatch: '#527f6a', doc: 'A small island with glass spires.', island: 'floating-rocks' },
  { id: 'l5', name: 'Marathon rules', by: 'Pip', kind: 'rules', price: 0, swatch: '#c56443', doc: 'Ten laps, tougher AI.', preview: () => ({ kind: 'icon', icon: 'Flag' }) },
  { id: 'l6', name: 'Gold barrel', by: 'Nettle', kind: 'model', price: 25, swatch: '#d5a24a', doc: 'A barrel with real gold.', preview: () => ({ kind: 'model', model: 'barrel' }) },
];

/** The islands people share, to try from My planet (each is drawn from its template shape until shares carry their own maps). */
export const COMMUNITY_ISLANDS: readonly { readonly id: string; readonly name: string; readonly template: string; readonly by: string }[] = LISTINGS.filter((l) => l.island).map((l) => ({ id: `community-${l.id}`, name: l.name, template: l.island!, by: l.by }));

export function Community(props: { readonly profile: Profile; readonly onCredits: (delta: number) => void }): ReactElement {
  const { profile, onCredits } = props;
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState('all');
  const kinds = ['all', ...new Set(LISTINGS.map((l) => l.kind))];
  const get = (l: Listing): void => { if (owned.has(l.id) || profile.credits < l.price) return; onCredits(-l.price); setOwned(new Set(owned).add(l.id)); };
  const mine = useShares();
  return (
    <div className="shell-window wide" role="region" aria-label="Community">
      <header><h3>Community</h3><div className="tabs" role="group" aria-label="Show">{kinds.map((k) => <button key={k} className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{KIND_NAMES[k] ?? k}</button>)}</div></header>
      {mine.length ? (
        <section className="your-shares" aria-label="Your shares">
          <h4>Your shares</h4>
          <div className="shell-cards">
            {mine.map((sh) => (
              <article key={sh.id} className="shell-activity">
                <h4>{sh.name}</h4>
                {sh.description ? <p>{sh.description}</p> : null}
                <p className="hint">{sh.kind}, {VISIBILITY.find((v) => v.id === sh.visibility)?.label.toLowerCase()}{sh.priceCredits ? `, ${sh.priceCredits} cr` : ''}{sh.tags.length ? `, ${sh.tags.join(' ')}` : ''}</p>
                <button onClick={() => unshare(sh.id)}>Stop sharing</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <div className="shell-cards">
        {LISTINGS.filter((l) => filter === 'all' || l.kind === filter).map((l) => (
          <article key={l.id} className="shell-activity">
            <div className="thumb" aria-hidden="true">{l.island && TEMPLATE_SHAPES[l.island] ? <IslandMap shape={TEMPLATE_SHAPES[l.island]!} size={96} label={l.name} /> : l.preview ? <PresetPreview p={l.preview()} size={72} /> : <span style={{ background: l.swatch }} />}</div>
            <h4>{l.name}</h4>
            <p>{l.doc}</p>
            <p className="hint">{(KIND_NAMES[l.kind] ?? l.kind).replace(/s$/, '')} by {l.by}</p>
            <button className={l.price ? '' : 'go'} disabled={owned.has(l.id) || profile.credits < l.price} onClick={() => get(l)}>{owned.has(l.id) ? 'In your inventory' : l.price ? `Buy for ${l.price} cr` : 'Get it free'}</button>
          </article>
        ))}
      </div>
      <p className="hint">Share your own presets from any editor on your island (Share…), or your whole island from the Esc menu. Until the game is online, shares stay on this device.</p>
    </div>
  );
}
