import type { Step } from './index';

/**
 * The island tour, written for the build HUD as it is now (tabs on F1..F10, slots on 1..9, E for presets, Esc for the menu). Every step is
 * a preset: change the words, the keys, the order or what it gives you without touching code. It ends with the big reveal: the island
 * switches from the flat voxel paint that matches your goblin to the full PBR ground.
 *
 * Events the island sends: moved, looked, jumped, slot-selected, tab-selected, used-sculpt, used-paint, placed, undo, opened-presets,
 * edited, opened-menu. The reveal step waits for the 'show-pbr' button on the tour card.
 */
export const ISLAND_STEPS: Step[] = [
  {
    id: 'welcome', title: 'Your island',
    text: 'This island is yours: everything on it is a preset you can change. Click the world so the mouse looks around, then walk.',
    hint: 'W A S D',
    advance: { type: 'any', of: [{ type: 'event', name: 'moved', count: 3 }, { type: 'event', name: 'looked', count: 3 }] },
    skippable: true,
  },
  {
    id: 'jump', title: 'Hop',
    text: 'Your avatar jumps too. Every move it makes is an animation preset you can change later (P opens your avatar).',
    hint: 'Space',
    advance: { type: 'event', name: 'jumped' },
    skippable: true,
  },
  {
    id: 'sculpt', title: 'Shape the ground',
    text: 'You hold Raise from the Sculpt tab. Click the ground three times; the right button lowers it.',
    hint: 'F3 Click',
    advance: { type: 'event', name: 'used-sculpt', count: 3 },
    skippable: true,
    highlight: 'island.tab.sculpt',
    onEnter: [{ type: 'give', item: 'raise' }],
  },
  {
    id: 'place', title: 'Plant a palm',
    text: 'Things you place stand on the ground and follow it when you dig or raise it.',
    hint: 'F9 Click',
    advance: { type: 'event', name: 'placed' },
    skippable: true,
    highlight: 'island.tab.things',
    onEnter: [{ type: 'give', item: 'place-palm' }],
  },
  {
    id: 'undo', title: 'Take it back',
    text: 'Every change can be undone. Break things, nothing is lost.',
    hint: 'Ctrl+Z',
    advance: { type: 'event', name: 'undo' },
    skippable: true,
  },
  {
    id: 'presets', title: 'Your presets',
    text: 'E opens every preset of the tab you are on, with a preview of each. Click one to put it in your hand.',
    hint: 'E',
    advance: { type: 'event', name: 'opened-presets' },
    skippable: true,
    highlight: 'island.presets',
  },
  {
    id: 'tweak', title: 'Change a preset',
    text: 'Click Edit on any card and move a slider, or add a sprite or sound with + attribute. Your copy keeps the change.',
    hint: 'Edit',
    advance: { type: 'event', name: 'edited' },
    skippable: true,
  },
  {
    id: 'menu', title: 'The menu',
    text: 'Esc closes one window at a time, then opens the menu: studio mode, your avatar, settings, and SetMix: home, your islands, activities like Goblin Racing.',
    hint: 'Esc',
    advance: { type: 'event', name: 'opened-menu' },
    skippable: true,
  },
  {
    id: 'reveal', title: 'The big moment',
    text: 'Your island wears flat voxel paint that matches your avatar. Underneath is the full ground. Press the button and watch it change.',
    hint: 'PBR',
    advance: { type: 'button', id: 'show-pbr' },
    skippable: true,
    highlight: 'island.ground.pbr',
    onDone: [{ type: 'setSkin', skin: 'pbr' }, { type: 'reveal' }],
  },
  {
    id: 'finish', title: 'All yours',
    text: 'Flat and PBR are the two buttons top right, switch any time. Goblin Racing waits in the Activities tab (F7). Here are 100 credits.',
    advance: { type: 'time', ms: 7000 },
    skippable: true,
    onDone: [{ type: 'credits', amount: 100 }],
  },
];

/** The short tour when build mode is off (younger players): walk, hop, the menu and the reveal. */
export const WALK_STEPS: Step[] = ISLAND_STEPS.filter((s) => ['welcome', 'jump', 'menu', 'reveal', 'finish'].includes(s.id)).map((s) =>
  s.id === 'finish' ? { ...s, text: 'Flat and PBR are the two buttons top right, switch any time. Here are 100 credits.' } : s);
