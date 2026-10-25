// `studio-skill.md` is what any coding agent reads before it touches the Studio, so it is generated from the same registry the panels
// draw from and committed to `apps/web/public` — and these tests hold the committed copy to the generator. A command added without
// re-running `scripts/studio-skill.mjs` fails here, which is the only way the file can stay true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STUDIO_COMMANDS } from './studio-agent';
import { studioSkillMarkdown } from './studio-skill';
import { FOUR_FLOATS, STAGE_LADDER, stageLadder, stageLadderTable } from './studio-skill-rules';

const skillPath = path.resolve(process.cwd(), 'apps/web/public/studio-skill.md');

test('the committed skill file is exactly what the registry generates', () => {
  const onDisk = readFileSync(skillPath, 'utf8');
  const generated = studioSkillMarkdown();
  assert.ok(onDisk === generated, 'apps/web/public/studio-skill.md is stale: run `node --import tsx scripts/studio-skill.mjs`');
});

test('the skill file names every tool, with its parameters, and nothing that does not exist', () => {
  const text = studioSkillMarkdown();
  for (const command of STUDIO_COMMANDS) assert.ok(text.includes(`\`${command.name}\``), `${command.name} is not in the skill file`);
  for (const command of STUDIO_COMMANDS.filter((c) => c.name !== 'studio.doc.propose')) {
    for (const p of command.params) assert.ok(text.includes(`\`${p.key}\``), `${command.name}.${p.key} is not documented`);
  }
  // the four-step closed loop is mandatory, in order, and each step names the tool it uses
  const propose = text.indexOf('1. **Propose.**');
  const validate = text.indexOf('2. **Validate.**');
  const measure = text.indexOf('3. **Measure.**');
  const look = text.indexOf('4. **Look.**');
  assert.ok(propose > 0 && propose < validate && validate < measure && measure < look, 'the closed loop is out of order');
  for (const tool of ['studio.doc.propose', 'studio.kit.validate', 'studio.material.coverage', 'studio.capture']) {
    assert.ok(text.indexOf(tool) > 0, `${tool} is missing from the playbook`);
  }
});

test('the skill file carries the three worked examples and at least one refusal', () => {
  const text = studioSkillMarkdown();
  for (const heading of ['Worked example 1', 'Worked example 2', 'Worked example 3']) assert.ok(text.includes(heading), `${heading} is missing`);
  assert.ok(text.includes('"why"'), 'the file should show what a refusal looks like');
  // the examples are runnable-looking code, not prose: the propose calls are there
  assert.ok((text.match(/studio\.doc\.propose\(/g) ?? []).length >= 3);
  assert.ok(text.includes('studio.capture({ mode: \'turntable4\''), 'the four-side capture is not shown');
  assert.ok(text.includes('maskView'), 'the mask view is not shown');
});

test('the four floats and the stage ladder are the canon ones', () => {
  assert.match(FOUR_FLOATS, /Pxd/);
  assert.match(FOUR_FLOATS, /Vtx/);
  assert.match(FOUR_FLOATS, /Lx/);
  assert.match(FOUR_FLOATS, /Aq/);
  assert.equal(FOUR_FLOATS.includes('fifth'), false);
  assert.deepEqual(
    STAGE_LADDER.map((s) => s.stage),
    ['0a', '0b', '1', '2', '3', '4', '5', '6'],
  );
  const ladder = stageLadder();
  assert.ok(ladder.startsWith('Stage 0a'));
  assert.ok(ladder.endsWith('Stage 6 (PBR, full detail: every slider, every layer, 60 Hz and up).'));
  const table = stageLadderTable();
  assert.equal(table.split('\n').length, 2 + STAGE_LADDER.length);
  assert.ok(table.includes('| 0b |'));
  // and the skill file quotes both
  const text = studioSkillMarkdown();
  assert.ok(text.includes('S = (Pxd, Vtx, Lx, Aq)'));
  assert.ok(text.includes('Stage 0a (Wireframe on arrival'));
});

test('the file stays a file an agent can load: a sensible size, no placeholder text', () => {
  const text = studioSkillMarkdown();
  assert.ok(text.length > 4000 && text.length < 40000, `the skill file is ${text.length} bytes`);
  for (const banned of ['TODO', 'FIXME', 'lorem ipsum', 'XXX', '<placeholder>']) {
    assert.equal(text.toLowerCase().includes(banned.toLowerCase()), false, `the skill file contains '${banned}'`);
  }
  assert.ok(text.endsWith('\n'), 'the file should end with a newline');
});
