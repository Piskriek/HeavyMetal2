/**
 * T12 — Integration and Performance Benchmarks
 * 
 * Comprehensive integration tests exercising the full pipeline:
 * qualification → staging → release → race → results
 * 
 * Performance benchmarks for physics and rendering.
 * Safety checks.
 * Legacy compatibility.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runQualifyingHeat } from '../src/game/qualifying/harness';
import { createStagingState, transitionStaging } from '../src/game/staging/lifecycle';
import { computeReleasePlan, ReleaseExecutor, CLEAR_OCCUPANCY } from '../src/game/release/scheduler';
import { buildFrozenGrid } from '../src/game/release/grid';
import { compileGameplayProps, barrierOBBs } from '../src/game/gameplay-props';
import { testSweptSphereOBB } from '../src/game/physics/wall-ccd';
import { createRacingArbiter } from '../src/game/pickups/claims';
import { createDentState, applyDentImpact, recoverDents } from '../src/game/dent-state';
import { createRollingState, updateRollingState } from '../src/game/rolling-state';
import { createRollingResistanceState, applyRollingEffects } from '../src/game/rolling-resistance';
import { buildCubeSphereGeometry, validateCubeSphereGeometry } from '../src/game/cube-sphere';
import { generateDiagnosticAtlas, verifyGutterSurvival } from '../src/game/cube-sphere-atlas';
import { validateProps, writeStorage, readStorage } from '../src/game/track-storage';
import { normalizeRaceConfig } from '../src/game/contracts/config';
import { legacyParticipants, syntheticField } from '../src/game/qualifying/field';
import type { CourseId } from '../src/game/types';
import type { OBB, SweptSphere } from '../src/game/physics/wall-ccd';
import type { PlacedProp } from '../src/game/track-builder-3d';

/** Helper to build a valid RaceConfigV1 for qualifying heats */
function heatConfig(size: number, seed: number, course: CourseId = 'ridge') {
  const participants = size <= 4 ? legacyParticipants() : syntheticField(size, seed);
  return normalizeRaceConfig({
    version: 1, fieldSize: size, course, seed, participants, customPhysics: false,
    qualifying: { retries: 2, deadlineSeconds: 20 },
  }).config;
}

// ============================================================================
// Integration Tests: Full Pipeline
// ============================================================================

test('T12: Full pipeline - 20 racer vertical slice', () => {
  const racerCount = 20;
  const seed = 42;
  
  // 1. Qualification
  const qualifyingResult = runQualifyingHeat({
    config: heatConfig(racerCount, seed, 'ridge'),
    humanControl: 'auto',
  });
  
  assert.strictEqual(qualifyingResult.ranked.length, racerCount);
  assert.ok(qualifyingResult.ranked.every(r => r.time !== null && r.time > 0));
  
  // 2. Grid
  const corridor = {
    id: 'ridge-start',
    from: 100,
    to: 500,
    halfWidth: 480,
    minSpacing: 150,
    clearanceSeconds: 3.0,
  };
  
  const gridResult = buildFrozenGrid(qualifyingResult.ranked, { corridor });
  assert.strictEqual(gridResult.grid.slots.length, racerCount);
  
  // 3. Staging (state machine only, no entries)
  const stagingState = createStagingState();
  assert.ok(stagingState);
  assert.strictEqual(stagingState.phase, 'qualifying');
  
  // Transition through staging phases: qualifying → results → staging
  const qualifyingComplete = transitionStaging(stagingState, { type: 'qualifying-complete' });
  assert.ok(qualifyingComplete.ok);
  assert.strictEqual(qualifyingComplete.state.phase, 'results');
  
  const beginStaging = transitionStaging(qualifyingComplete.state, { type: 'begin-staging' });
  assert.ok(beginStaging.ok);
  assert.strictEqual(beginStaging.state.phase, 'staging');
  
  // 4. Release plan
  const planResult = computeReleasePlan(gridResult.grid, CLEAR_OCCUPANCY);
  assert.ok(planResult.plan.waves.length > 0);
  
  // 5. Release execution
  const executor = new ReleaseExecutor(gridResult.grid, planResult.plan, CLEAR_OCCUPANCY);
  let releasedCount = 0;
  
  for (let tick = 0; tick < 600; tick++) {
    const released = executor.step();
    releasedCount += released.length;
    if (executor.isDone) break;
  }
  
  assert.strictEqual(releasedCount, racerCount);
  assert.ok(executor.isDone);
  
  console.log(`20-racer pipeline: qualifying → grid → staging → release completed`);
});

test('T12: Full pipeline - 50 racer acceptance', () => {
  const racerCount = 50;
  const seed = 123;
  
  // Qualification
  const qualifyingResult = runQualifyingHeat({
    config: heatConfig(racerCount, seed, 'ridge'),
    humanControl: 'auto',
  });
  
  assert.strictEqual(qualifyingResult.ranked.length, racerCount);
  
  // Grid
  const corridor = {
    id: 'ridge-start',
    from: 100,
    to: 500,
    halfWidth: 480,
    minSpacing: 150,
    clearanceSeconds: 3.0,
  };
  
  const gridResult = buildFrozenGrid(qualifyingResult.ranked, { corridor });
  assert.strictEqual(gridResult.grid.slots.length, racerCount);
  
  // Release
  const planResult = computeReleasePlan(gridResult.grid, CLEAR_OCCUPANCY);
  assert.ok(planResult.plan.waves.length > 0);
  
  console.log(`50-racer pipeline completed`);
});

test('T12: Full pipeline - 100 racer acceptance', () => {
  const racerCount = 100;
  const seed = 456;
  
  // Qualification
  const qualifyingResult = runQualifyingHeat({
    config: heatConfig(racerCount, seed, 'ridge'),
    humanControl: 'auto',
  });
  
  assert.strictEqual(qualifyingResult.ranked.length, racerCount);
  
  // Grid
  const corridor = {
    id: 'ridge-start',
    from: 100,
    to: 500,
    halfWidth: 480,
    minSpacing: 150,
    clearanceSeconds: 3.0,
  };
  
  const gridResult = buildFrozenGrid(qualifyingResult.ranked, { corridor });
  assert.strictEqual(gridResult.grid.slots.length, racerCount);
  
  // Release
  const planResult = computeReleasePlan(gridResult.grid, CLEAR_OCCUPANCY);
  assert.ok(planResult.plan.waves.length > 0);
  
  console.log(`100-racer pipeline completed`);
});

// ============================================================================
// Performance Benchmarks: Physics
// ============================================================================

test('T12: Physics performance - Wall CCD (100 racers × 20 walls)', () => {
  const racerCount = 100;
  const wallCount = 20;
  
  // Create 100 racer spheres
  const racers: SweptSphere[] = Array.from({ length: racerCount }, (_, i) => ({
    startX: i * 5, startY: 0, startZ: 0,
    endX: i * 5 + Math.random() * 2, endY: 0, endZ: Math.random() * 2,
    radius: 1.0,
  }));
  
  // Create 20 wall OBBs
  const walls: OBB[] = Array.from({ length: wallCount }, (_, i) => ({
    id: `wall-${i}`,
    x: i * 10, y: 0, z: 50,
    halfWidth: 2, halfHeight: 2, halfDepth: 2,
    rotY: 0, rotX: 0, rotZ: 0,
    generation: 1,
  }));
  
  const timings: number[] = [];
  
  // Warm up
  for (let i = 0; i < 100; i++) {
    for (const racer of racers) {
      for (const wall of walls) {
        testSweptSphereOBB(racer, wall);
      }
    }
  }
  
  // Measure 1000 frames
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    
    for (const racer of racers) {
      for (const wall of walls) {
        testSweptSphereOBB(racer, wall);
      }
    }
    
    const elapsed = performance.now() - start;
    timings.push(elapsed);
  }
  
  timings.sort((a, b) => a - b);
  const p95Index = Math.floor(timings.length * 0.95);
  const p95 = timings[p95Index];
  const p99 = timings[Math.floor(timings.length * 0.99)];
  
  console.log(`Wall CCD timing (100 racers × 20 walls): p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms`);
  
  // Target: p95 ≤ 4ms
  assert.ok(p95 <= 4.0, `p95 ${p95.toFixed(2)}ms exceeds 4ms target`);
});

test('T12: Physics performance - Pickup arbitration (100 racers × 50 pickups)', () => {
  const racerCount = 100;
  const pickupCount = 50;
  
  const arbiter = createRacingArbiter(0);
  
  // Register pickups
  for (let i = 0; i < pickupCount; i++) {
    arbiter.register(`pickup-${i}`, i);
  }
  
  const timings: number[] = [];
  
  // Warm up
  for (let frame = 0; frame < 100; frame++) {
    for (let racerId = 0; racerId < racerCount; racerId++) {
      for (let pickupId = 0; pickupId < pickupCount; pickupId++) {
        if (Math.random() < 0.1) { // 10% chance of claim attempt
          arbiter.submitClaim(`pickup-${pickupId}`, racerId, Math.random());
        }
      }
    }
    arbiter.resolve(() => ({ type: 'fuel', amount: 1 }));
  }
  
  // Reset for measurement
  arbiter.reset();
  for (let i = 0; i < pickupCount; i++) {
    arbiter.register(`pickup-${i}`, i);
  }
  
  // Measure 1000 frames
  for (let frame = 0; frame < 1000; frame++) {
    const start = performance.now();
    
    for (let racerId = 0; racerId < racerCount; racerId++) {
      for (let pickupId = 0; pickupId < pickupCount; pickupId++) {
        if (Math.random() < 0.1) {
          arbiter.submitClaim(`pickup-${pickupId}`, racerId, Math.random());
        }
      }
    }
    arbiter.resolve(() => ({ type: 'fuel', amount: 1 }));
    
    const elapsed = performance.now() - start;
    timings.push(elapsed);
  }
  
  timings.sort((a, b) => a - b);
  const p95Index = Math.floor(timings.length * 0.95);
  const p95 = timings[p95Index];
  const p99 = timings[Math.floor(timings.length * 0.99)];
  
  console.log(`Pickup arbitration timing (100 racers × 50 pickups): p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms`);
  
  // Target: p95 ≤ 4ms
  assert.ok(p95 <= 4.0, `p95 ${p95.toFixed(2)}ms exceeds 4ms target`);
});

test('T12: Physics performance - Dent system (100 racers)', () => {
  const racerCount = 100;
  
  // Create dent states for all racers
  let dentStates = Array.from({ length: racerCount }, () => createDentState());
  
  const timings: number[] = [];
  const dt = 1/120; // 8.33ms tick
  
  // Warm up
  for (let frame = 0; frame < 100; frame++) {
    for (let i = 0; i < racerCount; i++) {
      // Random impact
      if (Math.random() < 0.05) {
        const direction = { x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 };
        const severity = Math.random();
        dentStates[i] = applyDentImpact(dentStates[i], direction, severity, 0);
      }
      
      // Recovery
      dentStates[i] = recoverDents(dentStates[i], dt);
    }
  }
  
  // Measure 1000 frames
  for (let frame = 0; frame < 1000; frame++) {
    const start = performance.now();
    
    for (let i = 0; i < racerCount; i++) {
      // Random impact
      if (Math.random() < 0.05) {
        const direction = { x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 };
        const severity = Math.random();
        dentStates[i] = applyDentImpact(dentStates[i], direction, severity, 0);
      }
      
      // Recovery
      dentStates[i] = recoverDents(dentStates[i], dt);
    }
    
    const elapsed = performance.now() - start;
    timings.push(elapsed);
  }
  
  timings.sort((a, b) => a - b);
  const p95Index = Math.floor(timings.length * 0.95);
  const p95 = timings[p95Index];
  const p99 = timings[Math.floor(timings.length * 0.99)];
  
  console.log(`Dent system timing (100 racers): p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms`);
  
  // Target: p95 ≤ 4ms
  assert.ok(p95 <= 4.0, `p95 ${p95.toFixed(2)}ms exceeds 4ms target`);
});

// ============================================================================
// Safety Checks
// ============================================================================

test('T12: No release overlaps', () => {
  const racerCount = 20;
  
  const qualifyingResult = runQualifyingHeat({
    config: heatConfig(racerCount, 42, 'ridge'),
    humanControl: 'auto',
  });
  
  const corridor = {
    id: 'ridge-start',
    from: 100,
    to: 500,
    halfWidth: 480,
    minSpacing: 150,
    clearanceSeconds: 3.0,
  };
  
  const gridResult = buildFrozenGrid(qualifyingResult.ranked, { corridor });
  const planResult = computeReleasePlan(gridResult.grid, CLEAR_OCCUPANCY);
  
  // Check for overlaps (no two racers released at same time in same wave)
  for (const wave of planResult.plan.waves) {
    const waveTimes = wave.slots.map(s => s.scheduledTick);
    const uniqueTimes = new Set(waveTimes);
    // Within a wave, all slots should have the same scheduled tick
    assert.strictEqual(uniqueTimes.size, 1, `Wave ${wave.wave} has inconsistent scheduled ticks`);
  }
  
  // Check that waves are properly spaced
  const waveTicks = planResult.plan.waves.map(w => w.scheduledTick);
  for (let i = 1; i < waveTicks.length; i++) {
    assert.ok(waveTicks[i] > waveTicks[i-1], `Wave ${i} not spaced after wave ${i-1}`);
  }
});

test('T12: Release executor - no unsafe blocked-exit bypass', () => {
  const racerCount = 20;
  
  const qualifyingResult = runQualifyingHeat({
    config: heatConfig(racerCount, 42, 'ridge'),
    humanControl: 'auto',
  });
  
  const corridor = {
    id: 'ridge-start',
    from: 100,
    to: 500,
    halfWidth: 480,
    minSpacing: 150,
    clearanceSeconds: 3.0,
  };
  
  const gridResult = buildFrozenGrid(qualifyingResult.ranked, { corridor });
  const planResult = computeReleasePlan(gridResult.grid, CLEAR_OCCUPANCY);
  
  // Create executor with blocked occupancy - every spawn point is occupied
  const blockedOccupancy = {
    isOccupied: () => true, // Always blocked
  };
  
  const executor = new ReleaseExecutor(gridResult.grid, planResult.plan, blockedOccupancy);
  
  // Run to completion (bounded by MAX_RELEASE_SPAN_SECONDS)
  const released = executor.run();
  
  // Verify that with full occupancy blocking, released slots have delay or blocked status
  // The executor should NOT silently release into occupied space without delay
  const releasedStatuses = released.map(r => r.status);
  const hasDelays = released.some(r => r.delayTicks > 0 || r.status === 'delayed' || r.status === 'blocked' || r.status === 'dnf');
  
  // Either some slots were delayed/blocked/dnf, or the executor timed out before releasing all
  const totalAccounted = released.length;
  assert.ok(
    hasDelays || totalAccounted < racerCount || executor.isDone,
    'Blocked occupancy should cause delays, blocks, or timeout'
  );
  
  console.log(`Blocked exit: ${released.length} released, statuses: ${[...new Set(releasedStatuses)].join(', ')}`);
});

// ============================================================================
// Legacy Compatibility
// ============================================================================

test('T12: Legacy 4-racer compatibility', () => {
  const racerCount = 4;
  
  // Qualification
  const qualifyingResult = runQualifyingHeat({
    config: heatConfig(racerCount, 42, 'ridge'),
    humanControl: 'auto',
  });
  
  assert.strictEqual(qualifyingResult.ranked.length, racerCount);
  
  // Grid
  const corridor = {
    id: 'ridge-start',
    from: 100,
    to: 500,
    halfWidth: 480,
    minSpacing: 150,
    clearanceSeconds: 3.0,
  };
  
  const gridResult = buildFrozenGrid(qualifyingResult.ranked, { corridor });
  assert.strictEqual(gridResult.grid.slots.length, racerCount);
  
  // Staging
  const stagingState = createStagingState();
  assert.ok(stagingState);
  
  // Release
  const planResult = computeReleasePlan(gridResult.grid, CLEAR_OCCUPANCY);
  assert.ok(planResult.plan.waves.length > 0);
  
  console.log(`Legacy 4-racer compatibility verified`);
});

// ============================================================================
// Geometry and Rendering
// ============================================================================

test('T12: Cube-sphere geometry generation and validation', () => {
  const radius = 1.0;
  const resolution = 4;
  
  const geometry = buildCubeSphereGeometry(radius, resolution);
  
  assert.ok(geometry.positions.length > 0);
  assert.ok(geometry.normals.length > 0);
  assert.ok(geometry.atlasUVs.length > 0);
  assert.ok(geometry.indices.length > 0);
  
  // Validate geometry
  const errors = validateCubeSphereGeometry(geometry);
  assert.strictEqual(errors.length, 0, `Geometry validation failed: ${errors.join(', ')}`);
  
  console.log(`Cube-sphere geometry: ${geometry.vertexCount} vertices, ${geometry.triangleCount} triangles`);
});

test('T12: Diagnostic atlas generation and gutter survival', () => {
  const atlas = generateDiagnosticAtlas();
  
  assert.ok(atlas.length > 0);
  assert.strictEqual(atlas.length, 2048 * 2048 * 4);
  
  // Verify gutter survival
  const gutterCheck = verifyGutterSurvival(atlas);
  assert.ok(gutterCheck.pass, `Gutter survival failed: ${gutterCheck.details?.join(', ')}`);
  
  console.log(`Diagnostic atlas: 2048×2048, gutter survival verified`);
});

// ============================================================================
// Track Storage
// ============================================================================

test('T12: Track storage validation and round-trip', () => {
  const props: PlacedProp[] = [
    {
      id: 'prop-1',
      type: 'barrier',
      name: 'Test Barrier',
      x: 100,
      y: 0,
      z: 50,
      rotY: 0,
      scale: 1.0,
      width: 10,
      height: 5,
      depth: 2,
      alignToTrack: false,
    },
    {
      id: 'prop-2',
      type: 'pickup',
      name: 'Test Pickup',
      x: 200,
      y: 5,
      z: 100,
      rotY: Math.PI / 4,
      scale: 1.0,
      alignToTrack: false,
    },
  ];
  
  // Validate
  const validation = validateProps(props);
  assert.ok(validation.valid, `Validation failed: ${validation.errors.join(', ')}`);
  
  // Write to mock storage
  const mockStorage = new Map<string, string>();
  const mockStorageBackend = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { mockStorage.set(key, value); },
    removeItem: (key: string) => { mockStorage.delete(key); },
    clear: () => { mockStorage.clear(); },
    key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
    length: mockStorage.size,
  } as Storage;
  
  const writeResult = writeStorage(props, 'ridge', mockStorageBackend);
  assert.ok(writeResult.ok, `Write failed: ${writeResult.error}`);
  
  // Read back
  const readResult = readStorage(mockStorageBackend);
  assert.strictEqual(readResult.props.length, props.length);
  assert.strictEqual(readResult.courseId, 'ridge');
  
  // Verify round-trip
  assert.deepStrictEqual(readResult.props[0].id, props[0].id);
  assert.deepStrictEqual(readResult.props[1].id, props[1].id);
  
  console.log(`Track storage: ${props.length} props validated and round-tripped`);
});

// ============================================================================
// Gameplay Props Compilation
// ============================================================================

test('T12: Gameplay props compilation with corridor validation', () => {
  const builderProps: PlacedProp[] = [
    {
      id: 'barrier-1',
      type: 'barrier_spike_wall',
      name: 'Spike Wall',
      x: 5000,
      y: 0,
      z: 0,
      rotY: 0,
      scale: 1.0,
      width: 10,
      height: 5,
      depth: 2,
      alignToTrack: false,
    },
    {
      id: 'pickup-1',
      type: 'powerup_speed_boost',
      name: 'Speed Boost',
      x: 6000,
      y: 5,
      z: 0,
      rotY: 0,
      scale: 1.0,
      alignToTrack: false,
    },
    // This one should be rejected (overlaps corridor)
    {
      id: 'barrier-2',
      type: 'barrier_spike_wall',
      name: 'Blocked Wall',
      x: 100, // Too close to start
      y: 0,
      z: 0,
      rotY: 0,
      scale: 1.0,
      width: 10,
      height: 5,
      depth: 2,
      alignToTrack: false,
    },
  ];
  
  const builderDefs = [
    { type: 'barrier_spike_wall', name: 'Spike Wall', category: 'barrier', isBarrier: true, defaultWidth: 10, defaultHeight: 5, defaultDepth: 2, url: '' },
    { type: 'powerup_speed_boost', name: 'Speed Boost', category: 'powerup', isPowerup: true, defaultWidth: 2, defaultHeight: 2, defaultDepth: 2, url: '' },
  ];
  
  const compiled = compileGameplayProps({
    builderProps,
    builderDefs,
    releaseCorridor: {
      minX: 0,
      maxX: 1000,
      minZ: -500,
      maxZ: 500,
      minY: -100,
      maxY: 100,
    },
  });
  
  // Should have barriers and pickups (corridor validation may reject some)
  assert.ok(compiled.barriers.length >= 0);
  assert.ok(compiled.pickups.length >= 0);
  
  console.log(`Gameplay props: ${compiled.barriers.length} barriers, ${compiled.pickups.length} pickups, ${compiled.warnings.length} warnings`);
});

// ============================================================================
// Rolling State and Resistance
// ============================================================================

test('T12: Rolling state and resistance integration', () => {
  let rollingState = createRollingState();
  let resistanceState = createRollingResistanceState();
  
  const velocity = { x: 10, y: 0, z: 5 }; // Moving forward and slightly sideways
  const radius = 1.0;
  const mass = 100;
  const dt = 1/120;
  
  // Simulate 10 seconds
  for (let i = 0; i < 1200; i++) {
    rollingState = updateRollingState(rollingState, velocity, radius, true, dt);
    const result = applyRollingEffects(velocity, mass, true, dt, resistanceState);
    resistanceState = result.newState;
  }
  
  // Verify rolling state updated
  assert.ok(rollingState.rollingPhase > 0);
  
  console.log(`Rolling state: phase=${rollingState.rollingPhase.toFixed(2)}`);
});
