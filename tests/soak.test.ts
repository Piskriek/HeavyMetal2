/**
 * T12 — Soak Test (Memory Leak Detection)
 * 
 * Runs a sustained simulation to detect memory leaks and resource growth.
 * This is a shorter version (2 minutes) suitable for CI; a full 15-minute
 * soak should be run manually before release.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runQualifyingHeat } from '../src/game/qualifying/harness';
import { buildFrozenGrid } from '../src/game/release/grid';
import { computeReleasePlan, ReleaseExecutor, CLEAR_OCCUPANCY } from '../src/game/release/scheduler';
import { createDentState, applyDentImpact, recoverDents } from '../src/game/dent-state';
import { createRollingState, updateRollingState } from '../src/game/rolling-state';
import { createRollingResistanceState, applyRollingEffects } from '../src/game/rolling-resistance';
import { createRacingArbiter } from '../src/game/pickups/claims';
import { normalizeRaceConfig } from '../src/game/contracts/config';
import { syntheticField } from '../src/game/qualifying/field';

function heatConfig(size: number, seed: number) {
  return normalizeRaceConfig({
    version: 1, fieldSize: size, course: 'ridge' as const, seed,
    participants: syntheticField(size, seed), customPhysics: false,
    qualifying: { retries: 2, deadlineSeconds: 20 },
  }).config;
}

test('T12: Soak test — sustained simulation without memory growth', { timeout: 120_000 }, () => {
  const racerCount = 20;
  const iterations = 50; // 50 qualifying heats
  
  // Measure memory before
  if (globalThis.gc) globalThis.gc();
  const memBefore = process.memoryUsage();
  
  const timings: number[] = [];
  
  for (let iter = 0; iter < iterations; iter++) {
    const start = performance.now();
    
    // Run a full qualifying heat
    const result = runQualifyingHeat({
      config: heatConfig(racerCount, iter),
      humanControl: 'auto',
    });
    
    // Build grid
    const corridor = {
      id: 'ridge-start', from: 100, to: 500,
      halfWidth: 480, minSpacing: 150, clearanceSeconds: 3.0,
    };
    const gridResult = buildFrozenGrid(result.ranked, { corridor });
    
    // Compute release plan
    const planResult = computeReleasePlan(gridResult.grid, CLEAR_OCCUPANCY);
    
    // Execute release
    const executor = new ReleaseExecutor(gridResult.grid, planResult.plan, CLEAR_OCCUPANCY);
    executor.run();
    
    const elapsed = performance.now() - start;
    timings.push(elapsed);
  }
  
  // Force GC and measure memory after
  if (globalThis.gc) globalThis.gc();
  const memAfter = process.memoryUsage();
  
  // Calculate heap growth
  const heapGrowth = memAfter.heapUsed - memBefore.heapUsed;
  const heapGrowthMB = heapGrowth / (1024 * 1024);
  
  // Calculate average and p95 iteration times
  timings.sort((a, b) => a - b);
  const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
  const p95Time = timings[Math.floor(timings.length * 0.95)];
  
  console.log(`Soak test: ${iterations} iterations`);
  console.log(`  Average: ${avgTime.toFixed(1)}ms, p95: ${p95Time.toFixed(1)}ms`);
  console.log(`  Heap growth: ${heapGrowthMB.toFixed(1)}MB (${(heapGrowthMB / iterations).toFixed(2)}MB/iter)`);
  
  // Heap growth should not exceed 50MB for 50 iterations (1MB/iter)
  // This is generous; a well-behaved system should be near zero after GC
  assert.ok(heapGrowthMB < 50, `Heap grew by ${heapGrowthMB.toFixed(1)}MB, exceeds 50MB threshold`);
  
  // Average iteration time should stay under 500ms
  assert.ok(avgTime < 500, `Average iteration time ${avgTime.toFixed(1)}ms exceeds 500ms`);
});

test('T12: Soak test — dent state accumulation without leaks', () => {
  const racerCount = 50;
  const frames = 10000; // ~83 seconds at 120Hz
  const dt = 1/120;
  
  // Create dent states
  let dentStates = Array.from({ length: racerCount }, () => createDentState());
  
  if (globalThis.gc) globalThis.gc();
  const memBefore = process.memoryUsage();
  
  for (let frame = 0; frame < frames; frame++) {
    for (let i = 0; i < racerCount; i++) {
      // Random impacts (5% chance per frame)
      if (Math.random() < 0.05) {
        const direction = {
          x: Math.random() - 0.5,
          y: Math.random() - 0.5,
          z: Math.random() - 0.5,
        };
        dentStates[i] = applyDentImpact(dentStates[i], direction, Math.random(), frame * dt);
      }
      
      // Recovery every frame
      dentStates[i] = recoverDents(dentStates[i], dt);
    }
  }
  
  if (globalThis.gc) globalThis.gc();
  const memAfter = process.memoryUsage();
  
  const heapGrowth = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);
  console.log(`Dent soak: ${frames} frames × ${racerCount} racers, heap growth: ${heapGrowth.toFixed(1)}MB`);
  
  // Should not grow significantly
  assert.ok(heapGrowth < 30, `Dent system heap grew by ${heapGrowth.toFixed(1)}MB`);
});

test('T12: Soak test — pickup arbiter without leaks', () => {
  const pickupCount = 30;
  const racerCount = 20;
  const frames = 5000;
  
  const arbiter = createRacingArbiter(2.0);
  for (let i = 0; i < pickupCount; i++) {
    arbiter.register(`pickup-${i}`, 0);
  }
  
  if (globalThis.gc) globalThis.gc();
  const memBefore = process.memoryUsage();
  
  for (let frame = 0; frame < frames; frame++) {
    arbiter.setTime(frame / 120);
    
    // Random claims
    for (let racerId = 0; racerId < racerCount; racerId++) {
      for (let pickupId = 0; pickupId < pickupCount; pickupId++) {
        if (Math.random() < 0.02) {
          arbiter.submitClaim(`pickup-${pickupId}`, racerId, Math.random());
        }
      }
    }
    
    arbiter.resolve((id) => ({ type: 'fuel', amount: 1 }));
  }
  
  if (globalThis.gc) globalThis.gc();
  const memAfter = process.memoryUsage();
  
  const heapGrowth = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);
  console.log(`Pickup soak: ${frames} frames, heap growth: ${heapGrowth.toFixed(1)}MB`);
  
  assert.ok(heapGrowth < 30, `Pickup arbiter heap grew by ${heapGrowth.toFixed(1)}MB`);
});

test('T12: Soak test — rolling state without leaks', () => {
  const racerCount = 50;
  const frames = 10000;
  const dt = 1/120;
  
  let rollingStates = Array.from({ length: racerCount }, () => createRollingState());
  let resistanceStates = Array.from({ length: racerCount }, () => createRollingResistanceState());
  
  if (globalThis.gc) globalThis.gc();
  const memBefore = process.memoryUsage();
  
  for (let frame = 0; frame < frames; frame++) {
    for (let i = 0; i < racerCount; i++) {
      const velocity = {
        x: 10 + Math.sin(frame * 0.01 + i) * 5,
        y: 0,
        z: Math.cos(frame * 0.01 + i) * 3,
      };
      
      rollingStates[i] = updateRollingState(rollingStates[i], velocity, 1.0, true, dt);
      const result = applyRollingEffects(velocity, 100, true, dt, resistanceStates[i]);
      resistanceStates[i] = result.newState;
    }
  }
  
  if (globalThis.gc) globalThis.gc();
  const memAfter = process.memoryUsage();
  
  const heapGrowth = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);
  console.log(`Rolling soak: ${frames} frames × ${racerCount} racers, heap growth: ${heapGrowth.toFixed(1)}MB`);
  
  assert.ok(heapGrowth < 30, `Rolling state heap grew by ${heapGrowth.toFixed(1)}MB`);
});
