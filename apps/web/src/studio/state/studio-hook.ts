/**
 * @file apps/web/src/studio/state/studio-hook.ts
 * Shared singleton instance of StudioStore and React 19 useSyncExternalStore hook.
 */

import { useSyncExternalStore } from 'react';
import { createStudioStore, type StudioState, type StudioStore } from './studio-store';
import { MILL_V2_KIT } from '../../play/kit-mill-v2';
import { MATSTACK_TEST_PIECE_KIT } from '../../play/kit-modules';
import { STARGATE_KIT } from '../../play/kit-stargate';
import { FABRICATOR_FRAME_KIT } from '../../play/kit-fabricator-frame';
import { CAPACITOR_BANK_KIT } from '../../play/kit-capacitor-bank';

export const globalStudioStore: StudioStore = createStudioStore(
  {
    'kit:texture-mill': { kit: MILL_V2_KIT, rootPreset: 'mill-frame' },
    'kit:stargate': { kit: STARGATE_KIT, rootPreset: 'stargate' },
    'kit:fabricator-frame': { kit: FABRICATOR_FRAME_KIT, rootPreset: 'fabricator-frame' },
    'kit:capacitor-bank': { kit: CAPACITOR_BANK_KIT, rootPreset: 'capacitor-bank' },
    'kit:test-piece': { kit: MATSTACK_TEST_PIECE_KIT, rootPreset: 'matstack-test-piece' },
  },
  'kit:texture-mill',
);

export function useStudioState(): StudioState {
  return useSyncExternalStore(globalStudioStore.subscribe, globalStudioStore.getSnapshot);
}
