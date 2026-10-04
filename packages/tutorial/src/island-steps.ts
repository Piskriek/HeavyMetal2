import type { Step } from './index';

/**
 * The island tour, written for the V3 hotbar (docs/HOTBAR_V3_SPEC.md: tabs on F1..F12, slots on 1..9, Game, Simplified and Advanced on the
 * backtick, Esc for the menu). Every step is
 * a preset: change the words, the keys, the order or what it gives you without touching code. It ends with the big reveal: the island
 * switches from the flat voxel paint that matches your goblin to the full PBR ground.
 *
 * Events the island sends: moved, looked, jumped, slot-selected, tab-selected, used-sculpt, used-paint, placed, undo, mode-switched,
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
    text: 'Your avatar jumps too. Every move it makes is an animation preset you can change later (My avatar, top right).',
    hint: 'Space',
    advance: { type: 'event', name: 'jumped' },
    skippable: true,
  },
  {
    id: 'sculpt', title: 'Shape the ground',
    text: 'You hold Mound Builder from Dirt and Trees (F10). Click the ground three times; the right button digs it back down.',
    hint: 'F10 Click',
    advance: { type: 'event', name: 'used-sculpt', count: 3 },
    skippable: true,
    highlight: 'island.tab.F10',
    onEnter: [{ type: 'give', item: 'mound-builder' }],
  },
  {
    id: 'place', title: 'Plant a tree',
    text: 'You hold Plant Oak Tree. Things you place stand on the ground and follow it when you dig or raise it.',
    hint: 'Click',
    advance: { type: 'event', name: 'placed' },
    skippable: true,
    highlight: 'island.tab.F10',
    onEnter: [{ type: 'give', item: 'plant-oak' }],
  },
  {
    id: 'undo', title: 'Take it back',
    text: 'Every change can be undone (Ctrl+Z, or the arrow at the end of the hotbar). Break things, nothing is lost.',
    hint: 'Ctrl+Z',
    advance: { type: 'event', name: 'undo' },
    skippable: true,
  },
  {
    id: 'modes', title: 'Three ways to build',
    text: 'Game keeps it playful. Simplified adds plain sliders and the gizmo; Advanced has every tool. Try one: the switch is at the end of the hotbar (or press the backtick). F3 is the same topic in all three.',
    hint: '`',
    advance: { type: 'event', name: 'mode-switched' },
    skippable: true,
    highlight: 'island.mode.simplified',
  },
  {
    id: 'tweak', title: 'Change a preset',
    text: 'In Simplified, move a slider above the hotbar (Tab frees the mouse while you walk). Your tool keeps the change.',
    hint: 'Tab',
    advance: { type: 'event', name: 'edited' },
    skippable: true,
  },
  {
    id: 'menu', title: 'The menu',
    text: 'Esc closes one window at a time, then opens the menu: studio mode, your avatar, world rules, settings, and SetMix: home, your islands, activities like Goblin Racing.',
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
    text: 'Flat and PBR (top right) switch the bumps and shine on and off; the style, voxel or painted, is on My planet. Goblin Racing waits under Activities in the Esc menu. Here are 100 credits.',
    advance: { type: 'time', ms: 7000 },
    skippable: true,
    onDone: [{ type: 'credits', amount: 100 }],
  },
];

/** The short tour when build mode is off (younger players): walk, hop, the menu and the reveal. */
export const WALK_STEPS: Step[] = ISLAND_STEPS.filter((s) => ['welcome', 'jump', 'menu', 'reveal', 'finish'].includes(s.id)).map((s) =>
  s.id === 'finish' ? { ...s, text: 'Flat and PBR are the two buttons top right, switch any time. Here are 100 credits.' } : s);
