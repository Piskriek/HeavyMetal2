import { useState, type ReactElement } from 'react';
import { Coins, Eye, Flag, Gauge, Settings2, Trophy, UserRound } from 'lucide-react';
import { humanizeDelta, type Activity } from '@hm/activities';
import { currentTournament, withTournament, type Profile } from './profile';

/**
 * The menu of one activity (Goblin Racing). It is a separate game inside the game: its own sections, its own profile page.
 * Tournaments, rankings and the bookie run on a simulated community until the platform backend is connected, so the whole flow can be tried offline.
 */
type Section = 'quick' | 'tournaments' | 'spectate' | 'rankings' | 'settings' | 'goblin' | 'bookie';
const SECTIONS: readonly { id: Section; label: string; Icon: typeof Flag }[] = [
  { id: 'quick', label: 'Quick Race', Icon: Flag }, { id: 'tournaments', label: 'Tournaments', Icon: Trophy }, { id: 'spectate', label: 'Spectate', Icon: Eye },
  { id: 'rankings', label: 'Rankings', Icon: Gauge }, { id: 'settings', label: 'Settings', Icon: Settings2 }, { id: 'goblin', label: 'My Goblin', Icon: UserRound }, { id: 'bookie', label: 'The Bookie', Icon: Coins },
];
const SIM_PLAYERS = ['Snaggle', 'Mudwick', 'Grizzle', 'Pip', 'Bogra', 'Nettle', 'Skrit', 'Ormund', 'Fizzle'];
const ratingOf = (n: string): number => 900 + ([...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 7) * 55;

export function GoblinRacingMenu(props: {
  readonly profile: Profile; readonly activity: Activity; readonly onBack: () => void;
  readonly onQuickRace: () => void; readonly onMyGoblin: () => void; readonly onProfile: (fn: (p: Profile) => Profile) => void;
}): ReactElement {
  const { profile, activity, onBack, onQuickRace, onMyGoblin, onProfile } = props;
  const [section, setSection] = useState<Section>('quick');
  const [stake, setStake] = useState(50);
  const [pick, setPick] = useState(SIM_PLAYERS[0]!);
  const [bet, setBet] = useState<{ on: string; stake: number } | null>(null);
  const [msg, setMsg] = useState('');
  const now = Date.now();
  const tourney = currentTournament(profile, now);
  const cup = { state: tourney.toJSON(), strikes: tourney.strikesFor(profile.name), lockedOut: tourney.isLockedOut(profile.name) };
  const joined = cup.state.entrants.some((e) => e.playerId === profile.name);
  const mutate = (f: (t: ReturnType<typeof currentTournament>) => ReturnType<typeof currentTournament>): void => {
    try { onProfile((p) => withTournament(p, f(currentTournament(p, Date.now())))); setMsg(''); } catch (e) { setMsg(e instanceof Error ? e.message : (e as { message?: string }).message ?? 'Could not do that'); }
  };
  const rows = [...SIM_PLAYERS.map((n) => ({ n, r: ratingOf(n) })), { n: profile.name, r: 1000 }].sort((a, b) => b.r - a.r);

  return (
    <div className="shell-racing">
      <aside className="shell-racing-nav">
        <div className="shell-brand small"><b>{activity.name.toUpperCase()}</b><i>ACTIVITY</i></div>
        <nav>
          {SECTIONS.map(({ id, label, Icon }) => <button key={id} className={section === id ? 'on' : ''} onClick={() => setSection(id)}><Icon size={15} strokeWidth={1.6} />{label}</button>)}
        </nav>
        <span className="grow" />
        <div className="shell-credits">{profile.credits} cr</div>
        <button onClick={onBack}>Back</button>
      </aside>
      <section className="shell-racing-main">
        {section === 'quick' ? (<><h2>Quick Race</h2><p>Pick your goblin and race round the island, three laps against the field.</p><button className="go" onClick={onQuickRace}>Choose a goblin and race</button></>) : null}
        {section === 'tournaments' ? (
          <>
            <h2>Tournaments</h2>
            <article className="shell-activity">
              <h4>The Basalt Cup · weekly</h4>
              <p>Heats of eight, the top three go through, one final. Sign up before it locks, then show up for your heat: no-shows lose 50 rating and earn a strike (three strikes miss the next cup). While you wait, spectate, visit the bookie and mingle.</p>
              <p className="hint">{cup.state.entrants.length} / {cup.state.capacity} signed up · sign-ups close in {humanizeDelta(cup.state.closesAt - now)} · your strikes {cup.strikes} / 3 (simulated field until the platform backend is connected)</p>
              <div className="btns">
                {joined ? <button onClick={() => mutate((t) => t.withdraw(profile.name))}>Withdraw</button> : <button className="go" disabled={cup.lockedOut || cup.state.status !== 'signup'} onClick={() => mutate((t) => t.signUp(profile.name, now, 1000))}>Sign up</button>}
                <span className="hint">{joined ? 'You are in. See you in your heat.' : cup.lockedOut ? 'Locked out of this cup (three strikes).' : cup.state.status !== 'signup' ? 'Sign-up is closed.' : 'Not signed up.'}</span>
              </div>
              {msg ? <p className="hint" role="status">{msg}</p> : null}
            </article>
          </>
        ) : null}
        {section === 'spectate' ? (
          <>
            <h2>Spectate</h2>
            <p>Watch a heat live from a chase, free, ghost or director camera. Races are deterministic, so watching is a replay of the inputs.</p>
            <ul className="shell-list">{['Heat 1 · Snaggle, Mudwick, Grizzle …', 'Heat 2 · Pip, Bogra, Nettle …'].map((h) => <li key={h}><span>{h}</span><button disabled title="Needs recorded input streams (replay system)">Watch</button></li>)}</ul>
          </>
        ) : null}
        {section === 'rankings' ? (
          <><h2>Rankings</h2><ol className="shell-list rank">{rows.map((x, i) => <li key={x.n} className={x.n === profile.name ? 'me' : ''}><b>{i + 1}</b><span>{x.n}</span><span>{x.r}</span></li>)}</ol></>
        ) : null}
        {section === 'settings' ? (
          <>
            <h2>Race settings</h2>
            <p className="hint">Goblin Racing is built in, so its rules are fixed. Duplicate it in Activities to change them.</p>
            <ul className="shell-list">{[['Laps', 3], ['Field', 8], ['AI skill', 1]].map(([k, v]) => <li key={String(k)}><span>{k}</span><b>{v}</b></li>)}</ul>
          </>
        ) : null}
        {section === 'goblin' ? (<><h2>My Goblin</h2><p>Name your goblin, build its ball (weight, speed, bounce, colours) and pick a ready-made racer.</p><button className="go" onClick={onMyGoblin}>Customize my goblin</button></>) : null}
        {section === 'bookie' ? (
          <>
            <h2>The Bookie</h2>
            <p>Bet in-game credits on who wins the next heat. Credits only, never real money.</p>
            <label className="row">Goblin <select value={pick} onChange={(e) => setPick(e.target.value)}>{SIM_PLAYERS.map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="row">Stake <input type="range" min={10} max={Math.max(10, Math.min(500, profile.credits))} step={10} value={Math.min(stake, Math.max(10, profile.credits))} onChange={(e) => setStake(Number(e.target.value))} /> {stake} cr</label>
            <button className="go" disabled={!!bet || profile.credits < stake} onClick={() => { setBet({ on: pick, stake }); onProfile((p) => ({ ...p, credits: p.credits - stake })); }}>Place bet</button>
            {bet ? <p className="hint">Bet placed: {bet.stake} cr on {bet.on}. Pays out when the heat is run.</p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
