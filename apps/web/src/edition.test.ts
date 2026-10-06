import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickEdition } from './edition';

test('a build is the SetMix version unless it or the address asks for Goblin Racing', () => {
  assert.equal(pickEdition(undefined, ''), 'setmix');
  assert.equal(pickEdition('setmix', ''), 'setmix');
  assert.equal(pickEdition('goblin-racing', ''), 'goblin-racing');
  assert.equal(pickEdition('something-else', ''), 'setmix');
});

test('the address picks the other version of the same build', () => {
  assert.equal(pickEdition('setmix', '?edition=goblin-racing'), 'goblin-racing');
  assert.equal(pickEdition('goblin-racing', '?edition=setmix'), 'setmix');
  assert.equal(pickEdition('goblin-racing', '?other=1'), 'goblin-racing');
});
