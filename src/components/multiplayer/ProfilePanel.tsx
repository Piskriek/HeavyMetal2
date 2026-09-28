/**
 * Multiplayer → Profile: who you are when you race. Your racing goblin (name, title, crew, straight into
 * the Goblin Creator), your ball (equip a saved design, straight into the Ball Garage), the items you own
 * and the gold shop, your wallet and bets, and your best runs (Hall of Chaos).
 *
 * On RUN.world the player's name and id come from the platform (src/platform); the goblin's name is the
 * racer's own and is set here.
 */
import { useMemo, useState } from 'react';
import { Coins, Crown, Paintbrush, Pencil, ShoppingBag, Trophy, UserRound, Check } from 'lucide-react';
import GoblinSvg from '../creator/GoblinSvg';
import { decodeGoblinDna } from '../../game/meta/goblin-dna';
import { activeProfile, listProfiles, renameProfile, setActiveProfile, type GoblinProfile } from '../../game/meta/goblin-profiles';
import { BASE_MATERIALS } from '../../game/meta/sphere-decal-baker';
import { grantCosmetic, listDesigns, ownedCosmetics, shopCatalog } from '../../game/meta/ball-design';
import { equipDesign, resolvePlayerDesign } from '../../game/pod';
import { balance, buyItem, marketName, readWallet, writeWallet, type WalletDoc } from '../../game/meta/wallet';
import { currentPlayer, renameLocalPlayer } from '../../platform/platform';
import { COURSES, type RunRecord } from '../../game/types';
import { recordModeLabel } from '../../game/session';

type Tab = 'goblin' | 'ball' | 'items' | 'bets' | 'records';

interface ProfilePanelProps {
  records: RunRecord[];
  onOpenCreator: (startWith: GoblinProfile | null) => void;
  onOpenGarage: () => void;
}

function Portrait({ profile, size }: { profile: GoblinProfile; size: number }) {
  const config = useMemo(() => { try { return decodeGoblinDna(profile.dna); } catch { return null; } }, [profile.dna]);
  return config ? <GoblinSvg config={config} size={size} /> : <div className="profile-portrait-empty" style={{ width: size, height: size }}><UserRound size={size / 3} /></div>;
}

export default function ProfilePanel({ records, onOpenCreator, onOpenGarage }: ProfilePanelProps) {
  const [tab, setTab] = useState<Tab>('goblin');
  const [rev, setRev] = useState(0);
  const refresh = () => setRev((r) => r + 1);
  const player = useMemo(() => currentPlayer(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const crew = useMemo(() => listProfiles(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const racer = useMemo(() => activeProfile(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const wallet = useMemo(() => readWallet(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const gold = balance(wallet);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const tabs: { id: Tab; label: string; icon: typeof Crown }[] = [
    { id: 'goblin', label: 'Goblin', icon: UserRound }, { id: 'ball', label: 'Ball', icon: Paintbrush },
    { id: 'items', label: 'Items', icon: ShoppingBag }, { id: 'bets', label: 'Bets', icon: Coins }, { id: 'records', label: 'Records', icon: Trophy },
  ];

  return (
    <div className="profile-panel">
      <header className="profile-header">
        <div className="profile-id">
          <span className="profile-kicker">{player.source === 'run' ? 'RUN.WORLD PLAYER' : 'THIS DEVICE'}</span>
          <PlayerName name={player.name} editable={player.source !== 'run'} onRename={(n) => { if (renameLocalPlayer(n)) refresh(); }} />
          {player.source !== 'run' && <small>Playing locally. On RUN.world your account name shows here.</small>}
        </div>
        <div className="profile-gold" title="Gold: won in races and at the bookie, spent in the shop"><Coins size={18} /><strong>{gold.toLocaleString()}</strong><span>gold</span></div>
      </header>

      <nav className="profile-tabs" role="tablist" aria-label="Profile">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setNote(null); }}><Icon size={14} />{label}</button>
        ))}
      </nav>

      {note && <p className={`profile-note ${note.ok ? 'ok' : 'err'}`} role="status">{note.text}</p>}

      {tab === 'goblin' && (
        <section className="profile-goblin" role="tabpanel">
          {racer ? (
            <div className="profile-racer">
              <div className="profile-portrait"><Portrait profile={racer} size={220} /></div>
              <div className="profile-racer-text">
                <span className="profile-kicker">YOUR RACER</span>
                <GoblinName key={racer.id} profile={racer} onSaved={(r) => { setNote(r.ok ? { ok: true, text: 'Name saved.' } : { ok: false, text: r.reason }); refresh(); }} />
                <p className="profile-title">{racer.title}</p>
                <code className="profile-dna" title="Anyone who loads this code in the Goblin Creator gets this exact goblin">{racer.dna}</code>
                <div className="profile-actions">
                  <button className="fantasy-primary" onClick={() => onOpenCreator(racer)}><Pencil size={15} />Edit in the Goblin Creator</button>
                  <button className="fantasy-secondary" onClick={() => onOpenCreator(null)}>New goblin</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="menu-empty-state"><UserRound size={48} strokeWidth={1.2} /><h3>No racer yet</h3><p>Build a goblin in the Goblin Creator and save it to your crew.</p><button className="fantasy-primary" onClick={() => onOpenCreator(null)}>Open the Goblin Creator</button></div>
          )}
          {crew.length > 1 && <>
            <h3 className="profile-subhead">Your crew <small>pick who races</small></h3>
            <div className="profile-crew">
              {crew.map((g) => (
                <button key={g.id} className={`profile-crew-card ${racer?.id === g.id ? 'active' : ''}`} onClick={() => { setActiveProfile(g.id); refresh(); }} aria-pressed={racer?.id === g.id}>
                  <Portrait profile={g} size={72} /><span>{g.name}</span><small>{racer?.id === g.id ? 'Racing' : g.title}</small>
                </button>
              ))}
            </div>
          </>}
        </section>
      )}

      {tab === 'ball' && <BallTab onOpenGarage={onOpenGarage} onChange={refresh} />}

      {tab === 'items' && (
        <ItemsTab gold={gold} onBuy={(id, price, name) => {
          const r = buyItem(readWallet(), id, price, name);
          if (r.error) { setNote({ ok: false, text: r.error }); return; }
          if (!writeWallet(r.doc) || !grantCosmetic(id)) { setNote({ ok: false, text: 'This device would not save the purchase.' }); return; }
          setNote({ ok: true, text: `${name} is yours. Put it on a ball in the Ball Garage.` });
          refresh();
        }} />
      )}

      {tab === 'bets' && <BetsTab wallet={wallet} />}

      {tab === 'records' && (
        <section role="tabpanel">
          {records.length ? (
            <div className="fantasy-records-wrap"><table className="fantasy-records"><thead><tr><th>Rank</th><th>Track</th><th>Finish</th><th>Chaos</th></tr></thead><tbody>
              {records.slice(0, 12).map((r, i) => <tr key={r.id}><td>{String(i + 1).padStart(2, '0')}</td><td>{COURSES.find((c) => c.id === r.course)?.name ?? 'Serpentine Isle'}<small>{recordModeLabel(r)} / {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></td><td>{r.completed ? `${r.position ?? 1} / ${r.fieldSize ?? 4}` : 'DNF'}</td><td>{r.score.toLocaleString()}</td></tr>)}
            </tbody></table></div>
          ) : <div className="menu-empty-state"><Trophy size={46} strokeWidth={1.2} /><h3>A Legend in the Making</h3><p>Race in Quick Races and your best runs land here.</p></div>}
        </section>
      )}
    </div>
  );
}

function PlayerName({ name, editable, onRename }: { name: string; editable: boolean; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  if (!editable || !editing) return <h2 className="profile-name">{name}{editable && <button className="profile-edit" onClick={() => { setValue(name); setEditing(true); }} aria-label="Rename"><Pencil size={13} /></button>}</h2>;
  return (
    <form className="profile-rename" onSubmit={(e) => { e.preventDefault(); onRename(value); setEditing(false); }}>
      <input value={value} maxLength={24} onChange={(e) => setValue(e.target.value)} aria-label="Your player name" autoFocus />
      <button className="fantasy-link" type="submit"><Check size={14} />Save</button>
    </form>
  );
}

function GoblinName({ profile, onSaved }: { profile: GoblinProfile; onSaved: (r: { ok: true } | { ok: false; reason: string }) => void }) {
  const [value, setValue] = useState(profile.name);
  const dirty = value.trim() !== profile.name;
  return (
    <form className="profile-goblin-name" onSubmit={(e) => { e.preventDefault(); if (dirty) onSaved(renameProfile(profile.id, value)); }}>
      <label className="visually-hidden" htmlFor="goblin-name">Goblin name</label>
      <input id="goblin-name" value={value} maxLength={24} onChange={(e) => setValue(e.target.value)} />
      <button className="fantasy-secondary" type="submit" disabled={!dirty}>Rename</button>
    </form>
  );
}

function BallTab({ onOpenGarage, onChange }: { onOpenGarage: () => void; onChange: () => void }) {
  const designs = listDesigns();
  const equipped = resolvePlayerDesign();
  return (
    <section className="profile-ball" role="tabpanel">
      <div className="profile-ball-now">
        <span className="profile-kicker">ON YOUR RACER</span>
        <h3>{equipped ? designs.find((d) => d.config.bakeKey === equipped.bakeKey)?.name ?? 'Custom ball' : 'The standard issue ball'}</h3>
        {equipped && <p>{BASE_MATERIALS[equipped.base]?.name ?? equipped.base} · {equipped.decals.length} decal{equipped.decals.length === 1 ? '' : 's'} · {equipped.capFinish} caps</p>}
        <button className="fantasy-primary" onClick={onOpenGarage}><Paintbrush size={15} />Open the Ball Garage</button>
      </div>
      <h3 className="profile-subhead">Saved designs <small>pick one to race</small></h3>
      {designs.length ? (
        <div className="profile-designs">
          {designs.map((d) => {
            const on = equipped?.bakeKey === d.config.bakeKey;
            return (
              <button key={d.name} className={`profile-design ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => { equipDesign(on ? null : d.config.bakeKey); onChange(); }}>
                <span className="profile-design-swatch" style={{ background: `radial-gradient(circle at 35% 30%, #ffffff40, transparent 45%), ${d.config.accentColor}` }} />
                <span>{d.name}</span><small>{on ? 'Racing' : BASE_MATERIALS[d.config.base]?.name ?? d.config.base}</small>
              </button>
            );
          })}
        </div>
      ) : <p className="profile-empty-line">No saved designs yet. Paint one in the Ball Garage.</p>}
    </section>
  );
}

function ItemsTab({ gold, onBuy }: { gold: number; onBuy: (id: string, price: number, name: string) => void }) {
  const owned = ownedCosmetics();
  const items = shopCatalog();
  const mine = items.filter((i) => owned.has(i.id));
  return (
    <section className="profile-items" role="tabpanel">
      <p className="fantasy-lead">The basics are free for everyone. Premium finishes and decals cost gold, won in races and at the bookie.</p>
      <div className="profile-shop">
        {items.map((i) => {
          const has = owned.has(i.id);
          return (
            <div key={i.id} className={`profile-item ${has ? 'owned' : ''}`}>
              <span className="profile-item-kind">{i.kind === 'finish' ? 'Ball finish' : 'Decal'}</span>
              <strong>{i.name}</strong>
              {has ? <span className="profile-item-owned"><Check size={13} />Owned</span>
                : <button className="fantasy-secondary" onClick={() => onBuy(i.id, i.price, i.name)} disabled={i.price > gold}><Coins size={13} />{i.price}</button>}
            </div>
          );
        })}
      </div>
      <p className="profile-empty-line">{mine.length} of {items.length} premium items owned.</p>
    </section>
  );
}

function BetsTab({ wallet }: { wallet: WalletDoc }) {
  const bets = [...wallet.bets].reverse();
  const open = bets.filter((b) => b.status === 'open');
  const settled = bets.filter((b) => b.status !== 'open');
  const won = settled.filter((b) => b.status === 'won').reduce((s, b) => s + b.payout, 0);
  const staked = settled.reduce((s, b) => s + (b.status === 'void' ? 0 : b.stake), 0);
  return (
    <section className="profile-bets" role="tabpanel">
      <div className="profile-bet-stats">
        <div><span>Open bets</span><strong>{open.length}</strong></div>
        <div><span>Settled</span><strong>{settled.length}</strong></div>
        <div><span>Won back</span><strong>{won.toLocaleString()} g</strong></div>
        <div><span>Net</span><strong className={won - staked >= 0 ? 'up' : 'down'}>{won - staked >= 0 ? '+' : ''}{(won - staked).toLocaleString()} g</strong></div>
      </div>
      {bets.length ? (
        <table className="round-table profile-bet-table"><thead><tr><th>Bet</th><th>Race</th><th>Stake</th><th>Odds</th><th>Result</th></tr></thead><tbody>
          {bets.slice(0, 40).map((b) => (
            <tr key={b.id} className={`bet-${b.status}`}><td>{marketName(b.market)}</td><td>{b.label}</td><td>{b.stake} g</td><td>×{b.odds.toFixed(2)}</td>
              <td>{b.status === 'open' ? 'Riding' : b.status === 'won' ? `Won ${b.payout} g` : b.status === 'void' ? 'Refunded' : b.position ? `Lost (P${b.position})` : 'Lost (DNF)'}</td></tr>
          ))}
        </tbody></table>
      ) : <div className="menu-empty-state"><Coins size={46} strokeWidth={1.2} /><h3>The bookie is waiting</h3><p>Place a bet on yourself when you set up a race in Quick Races, or between rounds of a tournament.</p></div>}
      <h3 className="profile-subhead">Recent gold</h3>
      <ul className="profile-ledger">
        {[...wallet.ledger].reverse().slice(0, 12).map((e) => <li key={e.id}><span>{e.note || e.reason}</span><strong className={e.amount >= 0 ? 'up' : 'down'}>{e.amount >= 0 ? '+' : ''}{e.amount} g</strong></li>)}
        {!wallet.ledger.length && <li><span>Starting purse</span><strong className="up">+{balance(wallet)} g</strong></li>}
      </ul>
    </section>
  );
}
