import type { CSSProperties } from 'react';
import type { MarbleInfo, } from '../game/types';
import type { Mood } from '../game/characters';
import { portraitOf } from '../game/characters';

interface Props { marble: MarbleInfo; mood?: Mood; size: number; ring?: 'steel' | 'crown' | 'spiked'; className?: string; alt?: string }

/** Goblin portrait inside a riveted metal ring from the UI kit. The player gets the crown ring. */
export default function Portrait({ marble, mood = 'angry', size, ring, className = '', alt = '' }: Props) {
  const frame = ring ?? (marble.isPlayer ? 'crown' : 'steel');
  return <span className={`kit-portrait ring-${frame} ${className}`} style={{ '--size': `${size}px`, '--speaker': marble.color } as CSSProperties}>
    <img src={portraitOf(marble, mood)} alt={alt} draggable={false} />
  </span>;
}
