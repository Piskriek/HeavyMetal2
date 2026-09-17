import { Flag, SlidersHorizontal, Trophy, CircleDot, ArrowRight, Coins } from 'lucide-react';
import Dialog from './Dialog';
import ItemGlyph from './ItemGlyph';
import { ITEM_INFO } from '../game/types';
import type { ItemType } from '../game/types';

export default function RulesDialog({ onClose }: { onClose: () => void }) {
  return <Dialog onClose={onClose} titleId="rules-title" className="rules-dialog">
    <span className="eyebrow"><Flag size={15} /> THE RACE BRIEFING</span>
    <h2 id="rules-title">Know your way down.</h2>
    <div className="rules-steps">
      <section><SlidersHorizontal /><div><h3>Build your advantage.</h3><p>Weight, speed, and bounce share 15 points. Heavy marbles break shortcut walls; bouncy ones clear jump lips. More speed means less drag.</p></div></section>
      <section><Trophy /><div><h3>Race for the championship.</h3><p>Six Grands Prix, three heats on the exact same circuit. Finishers score 25, 18, 15, 12, 10, 8, 6, 4, 2, or 1 point. The fastest heat of each GP adds one bonus point. Your teammate also scores for Apex Racing.</p></div></section>
      <section><CircleDot /><div><h3>Go three times farther.</h3><p>Circuits now have three times as many sectors. Hit blue or orange pegs and they pop away. Glowing, orbiting pegs contain the marked item. Moving buckets launch you. The course map shows the whole field and your camera position.</p></div></section>
      <section><Coins /><div><h3>Win credits. Stock your toolbar.</h3><p>Every finish pays 60 to 500 credits, plus 5 per orange peg. Spend them in the pit shop on eight single-use power-ups. Bought and collected charges carry over to your next race. Click a slot or press 1-8 to deploy; Space repeats your last selection. A/D or arrows nudge. P pauses the clock and every effect timer.</p></div></section>
    </div>
    <div className="rules-items">{(Object.keys(ITEM_INFO) as ItemType[]).map((item) => <div key={item}><span style={{ color: ITEM_INFO[item].color }}><ItemGlyph item={item} /></span><div><strong>{ITEM_INFO[item].name}</strong><p>{ITEM_INFO[item].desc}</p></div></div>)}</div>
    <p className="rules-safety">A race marshal gently frees stationary marbles. A local reset is the last resort, applied equally to every racer. Freeze and oil penalties are never cancelled by recovery.</p>
    <button className="button-primary" onClick={onClose}>Let's race <ArrowRight size={17} /></button>
  </Dialog>;
}