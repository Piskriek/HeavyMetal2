// ============================================================================
// File: packages/content/src/__tests__/charm-and-act789.test.ts
// Plans: Plan 26, Plan 29, Plan 29b Unit Tests
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  ACT789_AND_CHARM_VOICES,
  getLabFixtureInspectLine,
  isJokeDirtRename,
  selectRoverGreeting,
} from '../charm-and-act789';

describe('Unified Voice Manifest & Charm State Machine (Plans 26, 29, 29b)', () => {
  it('contains all 17 voice lines (9 Act VII-IX + 8 Charm lines)', () => {
    const keys = Object.keys(ACT789_AND_CHARM_VOICES);
    expect(keys).toHaveLength(17);
    expect(ACT789_AND_CHARM_VOICES['A7-01'].subtitle).toContain('twelve-kilowatt');
    expect(ACT789_AND_CHARM_VOICES['A9-02'].subtitle).toContain('patched the host');
    expect(ACT789_AND_CHARM_VOICES['CHARM-WIREFRAME-FILL'].subtitle).toContain('Goodbye wireframe');
  });

  it('cycles stateful Lab fixture inspection lines on 1st, 2nd, and 3rd press of [E]', () => {
    const first  = getLabFixtureInspectLine('old-monitor', 1);
    const second = getLabFixtureInspectLine('old-monitor', 2);
    const third  = getLabFixtureInspectLine('old-monitor', 3);
    expect(first).not.toBe(second);
    expect(second).toContain('DOWNLOAD MORE RAM');
    expect(third).toContain('DO NOT DEGAUSS');
  });

  it('fires the rare 1-in-50 (2%) original Rover greeting only when random < 0.02', () => {
    const rare = selectRoverGreeting(0.01);
    const normal = selectRoverGreeting(0.45);
    expect(rare.isRare).toBe(true);
    expect(rare.text).toContain('FAVOURITE SUB-ROUTINE');
    expect(normal.isRare).toBe(false);
  });

  it('detects food/joke renames of "dirt" in the Act V Studio schema terminal', () => {
    expect(isJokeDirtRename('Cheese')).toBe(true);
    expect(isJokeDirtRename('  tacos ')).toBe(true);
    expect(isJokeDirtRename('Lunar Regolith')).toBe(false);
  });
});
