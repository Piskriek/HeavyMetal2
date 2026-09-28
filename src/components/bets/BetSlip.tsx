/**
 * The Goblin Bookie's slip for one round: bet on your own finish (win it, podium, or just finish) at
 * fixed odds from the field size and CPU challenge. The stake leaves the wallet when the bet is placed;
 * the round's result settles it (src/game/meta/wallet.ts).
 */
import { useState } from 'react';
import { Coins, Check, X } from 'lucide-react';
import { BET_MARKETS, MAX_STAKE, MIN_STAKE, betOdds, type BetMarket } from '../../game/meta/wallet';

export interface SlipBet { market: BetMarket; stake: number; odds: number }

interface BetSlipProps {
  fieldSize: number;
  difficulty: string;
  /** Gold available to stake now. */
  gold: number;
  /** Bets already on this round. */
  bets: readonly SlipBet[];
  /** Places a bet; returns an error to show, or null. */
  onPlace: (market: BetMarket, stake: number, odds: number) => string | null;
  /** Takes a bet back (only before the event starts). */
  onCancel?: (market: BetMarket) => void;
  title?: string;
}

export default function BetSlip({ fieldSize, difficulty, gold, bets, onPlace, onCancel, title = 'The Goblin Bookie' }: BetSlipProps) {
  const [market, setMarket] = useState<BetMarket>('podium');
  const [stake, setStake] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const odds = betOdds(market, fieldSize, difficulty);
  const taken = bets.find((b) => b.market === market);
  const clamp = (n: number) => Math.max(0, Math.min(MAX_STAKE, Math.floor(n) || 0));

  const place = () => {
    const err = onPlace(market, stake, odds);
    setError(err);
  };

  return (
    <section className="bet-slip" aria-label={title}>
      <div className="bet-slip-head"><Coins size={15} /><span>{title}</span><strong className="bet-gold">{gold.toLocaleString()} gold</strong></div>
      <div className="bet-markets" role="radiogroup" aria-label="What you bet on">
        {BET_MARKETS.map((m) => {
          const placed = bets.find((b) => b.market === m.id);
          return (
            <button key={m.id} role="radio" aria-checked={market === m.id} className={`bet-market ${market === m.id ? 'selected' : ''} ${placed ? 'placed' : ''}`} onClick={() => { setMarket(m.id); setError(null); }}>
              <span className="bet-market-name">{m.name}</span>
              <span className="bet-market-odds">×{betOdds(m.id, fieldSize, difficulty).toFixed(2)}</span>
              <small>{placed ? `${placed.stake} gold on it` : m.blurb}</small>
            </button>
          );
        })}
      </div>
      {taken ? (
        <div className="bet-taken">
          <Check size={14} /><span>{taken.stake} gold on <b>{BET_MARKETS.find((m) => m.id === market)?.name}</b> pays {Math.floor(taken.stake * taken.odds)} if it lands.</span>
          {onCancel && <button className="fantasy-link" onClick={() => onCancel(market)}><X size={13} />Take it back</button>}
        </div>
      ) : (
        <div className="bet-stake-row">
          <label className="bet-stake"><span>Stake</span><input type="number" min={MIN_STAKE} max={MAX_STAKE} step={10} value={stake} onChange={(e) => setStake(clamp(Number(e.target.value)))} /></label>
          <div className="bet-chips">{[10, 50, 100].map((n) => <button key={n} onClick={() => setStake((s) => clamp(s + n))}>+{n}</button>)}<button onClick={() => setStake(clamp(Math.min(gold, MAX_STAKE)))}>Max</button></div>
          <span className="bet-return">Pays <b>{Math.floor(stake * odds)}</b></span>
          <button className="fantasy-secondary bet-place" onClick={place} disabled={stake < MIN_STAKE || stake > gold}>Place bet</button>
        </div>
      )}
      {error && <p className="bet-error" role="alert">{error}</p>}
      <p className="bet-note">Only on yourself, one bet per market per round. Gold is for goblins: it cannot be bought or cashed out.</p>
    </section>
  );
}
