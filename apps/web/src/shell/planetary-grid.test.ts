// ============================================================================
// File: apps/web/src/shell/planetary-grid.test.ts
// Unit tests for checkPlotCode in apps/web/src/shell/planetary-grid.tsx (TICKET-08a Item A).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePlot } from '../play/plot-code';
import { newPlot, place } from '@hm/plotsim';
import { checkPlotCode } from './planetary-grid-data';

test('checkPlotCode rejects empty, whitespace, and corrupt plot codes with clear reasons', () => {
  const empty = checkPlotCode('');
  assert.equal(empty.ok, false);
  assert.ok(empty.why && empty.why.length > 0);

  const spaces = checkPlotCode('   ');
  assert.equal(spaces.ok, false);
  assert.ok(spaces.why);

  const garbage = checkPlotCode('not-a-valid-plot-code-!!!');
  assert.equal(garbage.ok, false);
  assert.ok(garbage.why);
});

test('checkPlotCode validates a real encoded plot code and extracts owner, stage, and machines', () => {
  const gate = { x: 0, z: 0 };
  const env = { gate, plotRadius: 500, richness: () => 0.8 };
  let plot = newPlot();
  plot = place(plot, env, 'mill', 12, 0, 0);

  const encoded = encodePlot(
    {
      plot: { ...plot, stage: 2 },
      avatar: { kind: 'scientist', name: 'Francois', visor: '#f59e0b' },
    } as any,
    gate
  );
  assert.equal(encoded.ok, true);
  if (!encoded.ok) return;

  const res = checkPlotCode(`  ${encoded.code}  `);
  assert.equal(res.ok, true);
  assert.equal(res.owner, 'Francois');
  assert.equal(res.stage, 2);
  assert.equal(res.machines, 1);
});
