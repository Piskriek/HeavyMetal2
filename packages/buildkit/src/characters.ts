/**
 * The Characters tab (F9; hotbar spec V3, Toy box / Characters): goblins you put on your island that go about by themselves. The hotbar
 * holds what you do (spawn one, change one, take one away); the palette holds how it behaves (@hm/npcbrain does the walking).
 */
export const CHAR_WAYS: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly doc: string; readonly left: string; readonly right: string }[] = [
  { id: 'chars-spawn', name: 'Spawn', icon: 'UserPlus', doc: 'Put a goblin where you point; it does what the palette says (wander, patrol, follow you ...).', left: 'Spawn one', right: 'Take away the one you point at' },
  { id: 'chars-change', name: 'Change', icon: 'Shuffle', doc: 'Give the goblin you point at the palette\'s behaviour.', left: 'Change it', right: 'Change it' },
  { id: 'chars-remove', name: 'Remove', icon: 'UserMinus', doc: 'Take away the goblin you point at.', left: 'Take it away', right: 'Take it away' },
];
export type CharBrain = 'stand' | 'wander' | 'patrol' | 'follow' | 'chase' | 'flee';
/** The behaviours (the palette): what each one does, in words a child reads. */
export const CHAR_BRAINS: readonly { readonly id: CharBrain; readonly name: string; readonly icon: string; readonly doc: string }[] = [
  { id: 'wander', name: 'Wander', icon: 'Footprints', doc: 'Strolls about near where it was put, stopping now and then.' },
  { id: 'patrol', name: 'Patrol', icon: 'Repeat', doc: 'Walks a square round where it was put, again and again.' },
  { id: 'follow', name: 'Follow me', icon: 'Users', doc: 'Stays a few steps behind you wherever you go.' },
  { id: 'chase', name: 'Chase me', icon: 'Target', doc: 'Runs at you when it sees you (it waits a moment first).' },
  { id: 'flee', name: 'Run away', icon: 'Wind', doc: 'Runs away from you when it sees you.' },
  { id: 'stand', name: 'Stand still', icon: 'User', doc: 'Stands where it was put and turns to look at you.' },
];
export const isCharBrain = (id: string): id is CharBrain => CHAR_BRAINS.some((b) => b.id === id);
