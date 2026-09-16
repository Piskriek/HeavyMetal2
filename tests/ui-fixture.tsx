import { createRoot } from 'react-dom/client';
import RaceResults from '../src/components/RaceResults';
import { AI_NAMES, AI_COLORS } from '../src/game/types';
import type { MarbleInfo } from '../src/game/types';
import '../src/index.css';
import '../src/powerups.css';
import { createAccount, settleRace } from '../src/game/economy';

const roster: MarbleInfo[] = Array.from({ length: 10 }, (_, id) => ({
  id, name: id === 0 ? 'You' : AI_NAMES[id - 1], color: id === 0 ? '#d7ff3f' : AI_COLORS[id - 1],
  stats: { weight: 5, speed: 5, bounce: 5 }, isPlayer: id === 0,
}));
const isDnf = new URLSearchParams(location.search).has('dnf');
const order = isDnf ? [9, 7, 5, 1, 6, 4, 2, 8, 3, 0] : [9, 7, 5, 1, 0, 6, 4, 2, 8, 3];
const results = order.map((id, i) => ({ id, rank: i + 1, time: isDnf && id === 0 ? null : 25240 + i * 2640, pegs: (i * 7) % 5 }));

createRoot(document.getElementById('root')!).render(<RaceResults
  results={results} roster={roster} title="Marblehurst Grand Prix" subtitle="ROUND 01 / HEAT 1 OF 3" championship
  actions={[{ label: 'Standings & next heat', primary: true, onClick: () => { document.title = 'Action verified'; } }]}
  payout={settleRace(createAccount(), 'fixture', results.find((r) => r.id === 0)!).payout}
/>);