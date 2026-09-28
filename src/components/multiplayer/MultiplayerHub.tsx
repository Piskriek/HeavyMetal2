/**
 * Main menu → Multiplayer. Your Profile first (goblin, ball, items, gold, bets, records), then online
 * racing. Online racing runs on RUN.world rooms (docs/RUN_LAUNCH_PLAN.md, MP-R03/R04): the card says
 * plainly where it stands, off-platform, signed out, or waiting on the lobby release, and never
 * pretends a lobby exists.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Coins, Globe2, Medal, UserRound, Users } from 'lucide-react';
import ProfilePanel from './ProfilePanel';
import GoblinSvg from '../creator/GoblinSvg';
import { decodeGoblinDna } from '../../game/meta/goblin-dna';
import { activeProfile, type GoblinProfile } from '../../game/meta/goblin-profiles';
import { balance, readWallet } from '../../game/meta/wallet';
import { currentPlayer, isRunHosted } from '../../platform/platform';
import type { RunRecord } from '../../game/types';
import CardArt from '../ui/CardArt';

interface MultiplayerHubProps {
  records: RunRecord[];
  onOpenCreator: (startWith: GoblinProfile | null) => void;
  onOpenGarage: () => void;
  onQuickRaces: () => void;
  /** Open straight on the Profile (coming back from the creator or garage). */
  startOnProfile?: boolean;
}

export default function MultiplayerHub({ records, onOpenCreator, onOpenGarage, onQuickRaces, startOnProfile = false }: MultiplayerHubProps) {
  const [view, setView] = useState<'hub' | 'profile'>(startOnProfile ? 'profile' : 'hub');
  const player = useMemo(() => currentPlayer(), [view]); // eslint-disable-line react-hooks/exhaustive-deps
  const racer = useMemo(() => activeProfile(), [view]); // eslint-disable-line react-hooks/exhaustive-deps
  const gold = useMemo(() => balance(readWallet()), [view]); // eslint-disable-line react-hooks/exhaustive-deps
  const racerConfig = useMemo(() => { try { return racer ? decodeGoblinDna(racer.dna) : null; } catch { return null; } }, [racer]);
  const hosted = isRunHosted();

  if (view === 'profile') {
    return (
      <div className="mp-hub">
        <button className="fantasy-link mp-back" onClick={() => setView('hub')}><ArrowLeft size={15} />Multiplayer</button>
        <ProfilePanel records={records} onOpenCreator={onOpenCreator} onOpenGarage={onOpenGarage} />
      </div>
    );
  }

  const online = !hosted
    ? { state: 'Local copy', text: 'Online races run on RUN.world. This copy of the game is playing on this device only.' }
    : player.anonymous
      ? { state: 'Sign in', text: 'Sign in to RUN.world to race other players. Your saves already follow your account.' }
      : { state: 'Opening soon', text: 'Lobbies, quick match and join-by-code are the next release. Your profile and gold are ready for it.' };

  return (
    <div className="mp-hub">
      <p className="fantasy-lead">Your goblin, your ball and your gold go wherever you race. Online lobbies run on RUN.world.</p>
      <div className="mp-cards">
        <button className="mp-card mp-card-primary" onClick={() => setView('profile')}>
          <div className="mp-card-art">{racerConfig ? <GoblinSvg config={racerConfig} size={132} /> : <UserRound size={64} strokeWidth={1.1} />}</div>
          <span className="mode-kicker">WHO YOU ARE ON RACE DAY</span>
          <h3>Profile</h3>
          <p>{racer ? `${racer.name}, ${racer.title}.` : 'No racer yet: build one.'} Goblin, ball, items, bets and records.</p>
          <div className="mode-facts"><span><UserRound size={12} />{player.name}</span><span><Coins size={12} />{gold.toLocaleString()} gold</span></div>
          <span className="mp-card-go">Open <ArrowRight size={15} /></span>
        </button>

        <div className={`mp-card ${hosted && !player.anonymous ? '' : 'mp-card-muted'}`} aria-disabled="true">
          <div className="mp-card-art"><CardArt src="/art/menus/cards/card-race-online.png" fallback={<Globe2 size={64} strokeWidth={1.1} />} /></div>
          <span className="mode-kicker">RACE OTHER GOBLINS</span>
          <h3>Race Online</h3>
          <p>{online.text}</p>
          <div className="mode-facts"><span><Users size={12} />Lobbies · quick match · codes</span><span className="mp-state">{online.state}</span></div>
          <button className="fantasy-link" onClick={onQuickRaces}>Race the CPU in Quick Races meanwhile <ArrowRight size={14} /></button>
        </div>

        <div className="mp-card mp-card-muted" aria-disabled="true">
          <div className="mp-card-art"><CardArt src="/art/menus/cards/card-leaderboards.png" fallback={<Medal size={64} strokeWidth={1.1} />} /></div>
          <span className="mode-kicker">BRAGGING RIGHTS</span>
          <h3>Leaderboards</h3>
          <p>Best times on every island track and finish, per week and all time. Arrives with the RUN.world launch.</p>
          <div className="mode-facts"><span className="mp-state">Coming with RUN.world</span></div>
        </div>
      </div>
    </div>
  );
}
