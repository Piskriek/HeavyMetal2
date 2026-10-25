/**
 * `studio-skill.md`, generated (plan 40 §1, §5.2): one file any coding agent can read. It is built from the same registry the buttons
 * draw from (`STUDIO_COMMANDS`) and from the four rules every asset in this game obeys, so it cannot drift from the tools it
 * describes — `apps/web/public/studio-skill.md` is written by `scripts/studio-skill.mjs` and a test compares the two.
 *
 * The mandatory part is the closed loop: propose -> validate -> measure -> look. An agent that skips the measure step ships a rust
 * bloom that covers 67% of a face (the 22 October review found exactly that), and the numbers it needs are one call away.
 */
import { FOUR_FLOATS, stageLadder } from './studio-skill-rules';
import { STUDIO_COMMANDS, type CommandSpec, type ParamSpec } from './studio-agent';

const paramLine = (p: ParamSpec): string => {
  const t = p.type;
  const range =
    t.kind === 'number' || t.kind === 'int'
      ? ` | ${t.min ?? '-inf'}..${t.max ?? 'inf'} (default ${t.default})`
      : t.kind === 'enum'
        ? ` | one of: ${t.options.join(', ')}`
        : t.kind === 'bool'
          ? ` | true or false (default ${String(t.default)})`
          : t.kind === 'color'
            ? ` | #rrggbb (default ${t.default})`
            : ` | ${t.kind}`;
  return `  - \`${p.key}\` (${p.label})${range}${p.help ? ` — ${p.help}` : ''}`;
};

const commandBlock = (c: CommandSpec): string =>
  [`### \`${c.name}\``, c.summary, `Returns: ${c.returns}`, '', 'Parameters:', ...c.params.map(paramLine)].join('\n');

/**
 * The skill file as markdown. Deterministic: the same registry gives the same bytes, which is what lets a test hold the committed
 * file to it.
 */
export function studioSkillMarkdown(): string {
  const tools = STUDIO_COMMANDS.filter((c) => c.name !== 'studio.doc.propose').map(commandBlock);
  return [
    '# The FIDELITY Studio, for an agent',
    '',
    'You are working inside the FIDELITY Studio: a game whose every asset is generated from presets inside presets. Nothing here is an',
    'opaque model. A machine is a kit of parts on sockets; a part is a generator with sliders; a material is a stack of layers over a',
    'surface; a light is a preset. You change the same data the person\'s panels change, and they accept your changes one row at a time.',
    '',
    '## The rules you may not break',
    '',
    '1. **The four floats.** Every quantity in the game is one of `S = (Pxd, Vtx, Lx, Aq)`. There is no fifth metric. When a slider needs',
    '   a unit, name which of the four it belongs to.',
    '   ' + FOUR_FLOATS,
    '2. **Square sections, nothing floating, no lettering.** A part sits on a socket or on another part\'s box; a 5 mm gap is a bug.',
    '3. **Believable, grounded machines.** A machine stands on its foot, its vents face where its plume goes, its power socket is reachable.',
    '4. **Legal art only.** Generate everything from the packages; never paste in an outside model or a traced image.',
    '5. **Fidelity stages.** The same asset is drawn at seven stages; a slider that only works at Stage 6 is half a slider.',
    '   ' + stageLadder(),
    '',
    '## The closed loop (do all four, in this order, every time)',
    '',
    '1. **Propose.** `studio.doc.propose` with `@hm/scenedoc` operations (create, set, move, rename, duplicate, remove) and/or one',
    '   `matstack.*` command per row. Nothing is applied: you get staged rows back, plus a refusal with the reason for anything that',
    '   could not be staged. A refusal is information, not an error to retry blind.',
    '2. **Validate.** `studio.kit.validate` on the kit you touched: an unresolved `mat:`/`vault:` id, a part below the floor, a part that',
    '   floats, a machine socket that went missing. Fix every issue before you spend a person\'s attention on the change.',
    '3. **Measure.** `studio.material.coverage` for the material you touched. It returns percentages per zone — `top`, `side`, `edge`,',
    '   `crease`, `bottom`, `splash` — for every layer, plus the material\'s edge metal and a set of plain readings. The numbers that',
    '   matter: a patch is 2-15% of a face, a coat is over 60%; creases gather 2-3x what a face does; a worn edge shows bare metal at',
    '   0.45 or more; soot on a fired machine reads on tops *and* undersides; dust settles on tops, not on walls.',
    '4. **Look.** `studio.capture({ mode: \'turntable4\', includeStaged: true })` at rank 0 and rank 2, and `maskView` for the layer you',
    '   are unsure about. Four sides, both detail ranks: a white patch on a mask view is a place the layer will show.',
    '',
    'Only then ask the person to accept. `studio.changes.accept` takes one row id at a time, and every accepted row lands on the normal',
    'undo history. If you are told a row is wrong, `studio.changes.reject` it and propose a better one instead of editing the old row.',
    '',
    '## The tools',
    '',
    '```json',
    JSON.stringify(
      STUDIO_COMMANDS.map((c) => ({ name: c.name, summary: c.summary, group: c.group, params: c.params.map((p) => ({ key: p.key, type: p.type })) })),
      null,
      2,
    ),
    '```',
    '',
    ...tools,
    '',
    '## Worked example 1: tune a part, then print it',
    '',
    '```js',
    '// a hopper panel: bigger bolts, one planar dissolve, then look at it from four sides at both ranks',
    'await studio.doc.propose({ label: \'panel: fatter bolts\', ops: [',
    '  { op: \'set\', id: \'panel-body\', props: { boltsPerSide: 4, boltHead: 0.03 } },',
    ']});',
    'await studio.kit.validate({ kit: PANEL_KIT, preset: \'panel\', sockets: [] });',
    'await studio.capture({ mode: \'turntable4\', rank: 0 });',
    'await studio.capture({ mode: \'turntable4\', rank: 2 });',
    '```',
    '',
    '## Worked example 2: a module from parts on sockets',
    '',
    '```js',
    '// a bolted access door: frame, leaf, two hinges, a handle and corner bolts, every one of them on a socket',
    'const ops = [',
    '  { op: \'create\', type: \'part\', id: \'door-frame\', props: { kind: \'plate\' } },',
    '  { op: \'create\', type: \'part\', id: \'door-leaf\', parent: \'door-frame\' },',
    '  { op: \'create\', type: \'part\', id: \'door-hinge-a\', parent: \'door-leaf\' },',
    '  { op: \'create\', type: \'part\', id: \'door-hinge-b\', parent: \'door-leaf\' },',
    '  { op: \'create\', type: \'part\', id: \'door-handle\', parent: \'door-leaf\' },',
    '];',
    'const { staged, refusals } = await studio.doc.propose({ label: \'access door\', ops });',
    'if (refusals.length) throw new Error(refusals.map((r) => r.label + \': \' + r.why).join(\'\\n\'));',
    'const report = await studio.kit.validate({ kit: DOOR_KIT, preset: \'door\', sockets: [\'power\'] });',
    '// report.problems names every floating part by path: seat it and validate again',
    'await studio.capture({ mode: \'turntable4\' });',
    '```',
    '',
    '## Worked example 3: restyle a machine and prove it',
    '',
    '```js',
    '// hazard yellow over a workshop, aged, with rust gathering in the creases and mud up the splash zone',
    'await studio.doc.propose({ label: \'mill: field-worn hazard\', material: { name: \'mat:mill\', command: {',
    '  command: \'matstack.setPaint\', body: \'#b8b2a2\', trim: \'#eab308\',',
    '} } });',
    'await studio.doc.propose({ label: \'mill: age it\', material: { name: \'mat:mill\', command: { command: \'matstack.setAge\', age: 0.55 } } });',
    'await studio.doc.propose({ label: \'mill: rust in the creases\', material: { name: \'mat:mill\', command: {',
    '  command: \'matstack.addLayer\', layer: \'rust-bloom\',',
    '} } });',
    'const cov = await studio.material.coverage({ material: materialOf(\'mat:mill\') });',
    '// check: rust bloom 2-15% of a side face, more in creases; edge metal 0.45+ where edge-wear shows',
    'await studio.capture({ mode: \'turntable4\', maskView: 1 }); // the rust layer\'s own mask, in black and white',
    '```',
    '',
    '## What a refusal looks like',
    '',
    '```json',
    '{ "call": 0, "label": "mill: rust in the creases", "why": "the material already has 6 layers" }',
    '```',
    '',
    'Read it, propose something that fits, and leave the person\'s document alone until they accept a row.',
    '',
  ].join('\n');
}
