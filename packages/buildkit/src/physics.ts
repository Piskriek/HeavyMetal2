/**
 * The Physics tab (F11, also Shift+F1; hotbar spec V3, Physics play): what a thing is made of decides how it falls, bounces, slides and
 * floats (@hm/physmat does the moving). The hotbar holds what you do; the palette holds the materials.
 */
export const PHYS_WAYS: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly doc: string; readonly left: string; readonly right: string }[] = [
  { id: 'phys-give', name: 'Material', icon: 'Atom', doc: 'Make the thing you point at out of the palette\'s material: rubber bounces, ice slides, a balloon floats, an anvil drops like lead.', left: 'Give it the material', right: 'Back to wood' },
  { id: 'phys-drop', name: 'Drop', icon: 'ArrowDownToLine', doc: 'Lift the thing you point at and let it fall, to see how its material lands.', left: 'Drop it', right: 'Drop it from higher' },
  { id: 'phys-hammer', name: 'Push hammer', icon: 'Hammer', doc: 'A giant hammer blow where you point: everything nearby goes flying (heavy things hardly move).', left: 'Swing it', right: 'A gentle tap' },
];
/** The palette: the materials, in words a child reads (ids are @hm/physmat's). */
export const PHYS_ITEMS: readonly { readonly id: string; readonly name: string; readonly icon: string }[] = [
  { id: 'wood', name: 'Wood', icon: 'Square' }, { id: 'rubber', name: 'Super bouncy', icon: 'CircleDot' }, { id: 'ice', name: 'Slippery ice', icon: 'Snowflake' },
  { id: 'balloon', name: 'Balloon', icon: 'Balloon' }, { id: 'anvil', name: 'Super anvil', icon: 'Anvil' }, { id: 'metal', name: 'Heavy metal', icon: 'Shield' },
  { id: 'cork', name: 'Cork', icon: 'Circle' }, { id: 'stone', name: 'Stone', icon: 'Gem' }, { id: 'jelly', name: 'Jelly', icon: 'Droplet' },
];
