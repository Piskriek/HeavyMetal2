import { Droplets, Snowflake, Rocket, Radio, Weight, Ghost, MoveUp, Wind } from 'lucide-react';
import type { ItemType } from '../game/types';

export default function ItemGlyph({ item, size = 24 }: { item: ItemType; size?: number }) {
  const Glyph = { oil: Droplets, freeze: Snowflake, rocket: Rocket, shock: Radio, anvil: Weight, ghost: Ghost, jump: MoveUp, aero: Wind }[item];
  return <Glyph size={size} strokeWidth={1.7} aria-hidden="true" />;
}