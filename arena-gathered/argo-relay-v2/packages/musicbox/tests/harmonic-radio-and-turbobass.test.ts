import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateHarmonicMachineChoir,
  SETMIX_SONG_BPM,
  type ActiveMachineEmitter,
} from '../src/harmonic-machine-choir';

test('locks Harmonic Convergence at 144 BPM when all 4 field machine types run within 35m', () => {
  const machines: ActiveMachineEmitter[] = [
    { id: 'm1', stemRole: 'shape-press-bass', x: 5, y: 0, z: 0, isRunning: true, efficiency0to1: 1 },
    { id: 'm2', stemRole: 'texture-mill-arp', x: -5, y: 0, z: 0, isRunning: true, efficiency0to1: 1 },
    { id: 'm3', stemRole: 'light-projector-pad', x: 0, y: 0, z: 6, isRunning: true, efficiency0to1: 1 },
    { id: 'm4', stemRole: 'water-maker-lead', x: 0, y: 0, z: -6, isRunning: true, efficiency0to1: 1 },
  ];
  const state = evaluateHarmonicMachineChoir(0.0, 0, 0, 0, machines);
  assert.equal(state.bpm, SETMIX_SONG_BPM);
  assert.equal(state.bpm, 144.0);
  assert.equal(state.isHarmonicConvergenceLocked, true);
});
