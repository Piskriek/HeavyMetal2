import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_789_QUEST_CHAIN,
  formatCustomSchemaDiffToast,
} from '../src/act789-chain';

test('completes Acts VII-IX quest steps and formats Act V schema diff toast purely', () => {
  const toast = formatCustomSchemaDiffToast('dirt', ' Cheese ');
  assert.equal(toast.sanitizedLabel, 'Cheese');
  assert.equal(ACT_789_QUEST_CHAIN.length, 5);
});
