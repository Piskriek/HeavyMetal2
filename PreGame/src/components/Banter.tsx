import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Line } from '../game/characters';
import { displayName } from '../game/characters';
import Portrait from './Portrait';

interface Props { lines: Line[]; className?: string; delay?: number; interval?: number }

/** Speech bubbles that pop in one at a time. Expression follows each line's mood. */
export default function Banter({ lines, className = '', delay = 350, interval = 1000 }: Props) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(lines.length); return; }
    const timers = lines.map((_, i) => setTimeout(() => setShown(i + 1), delay + i * interval));
    return () => timers.forEach(clearTimeout);
  }, [lines, delay, interval]);
  return <ol className={`banter ${className}`} aria-live="polite">
    {lines.slice(0, shown).map((line, i) => <li key={i} className={`banter-line ${line.speaker.isPlayer ? 'banter-player' : ''} mood-${line.mood}`} style={{ '--speaker': line.speaker.color } as CSSProperties}>
      <Portrait className="banter-portrait" marble={line.speaker} mood={line.mood} size={72} />
      <div className="banter-bubble"><b>{displayName(line.speaker)}</b><p>{line.text}</p></div>
    </li>)}
  </ol>;
}
