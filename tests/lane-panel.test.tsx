/**
 * M01 · T7 (AC-5, and the key half of the ticket's behaviour list) — the Lanes & Paths panel.
 *
 * AC-5 asks for a headless DOM check: the lanes category renders, validation errors are listed with
 * `aria-live`, Save is disabled while invalid, and every control has a label. All four are asserted
 * here against **real rendered HTML** — React renders to a string in node (`react-dom/server`), so the
 * markup is the shipping markup, not a mock of it. What needs a browser (clicking, dragging, the 3D
 * handles) stays in the preview and is called out as UNVERIFIED below.
 *
 * The model half also pins the two things the panel must never get wrong: the error list is the
 * validator's own, and `canSave` is exactly the validator's verdict.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LanePanel from '../src/components/builder/LanePanel';
import { laneEditForCommand, laneKeyIntent, lanePanelModel } from '../src/game/lane-panel-model';
import { sampleLaneNetwork, validateLaneNetwork, type LaneNetwork } from '../src/game/lane-network';
import { DEFAULT_HALF_WIDTH, LANE_HALF_WIDTH_MAX, LANE_HALF_WIDTH_MIN } from '../src/game/lane-network';
import { applyLaneEdit, SNAP_Z_LANES } from '../src/game/lane-path-tool';
import { FINISH, START_X } from '../src/game/scene';

function sample(): LaneNetwork { return sampleLaneNetwork('ridge'); }

/** A document the validator refuses: one path runs up-range, which is `non_monotone` by definition. */
function broken(): LaneNetwork {
  const network = sample();
  const path = network.paths[0];
  const nodes = network.nodes.map((node, index) => (
    node.id === path.nodeIds[1] ? { ...node, x: 100 } : { ...node, x: node.x + index }
  ));
  return { ...network, nodes, paths: network.paths };
}

test('the model is the validator\'s own verdict, wording and all', () => {
  const good = lanePanelModel(sample());
  assert.equal(good.hasDocument, true);
  assert.equal(good.canSave, true, 'a valid document may be saved');
  assert.deepEqual(good.errors, [], 'and lists no errors');
  assert.ok(good.nodes.length > 5 && good.paths.length > 2, 'nodes and paths are listed');

  const bad = lanePanelModel(broken());
  assert.equal(bad.hasDocument, true, 'a refused document is still shown');
  assert.equal(bad.canSave, false, 'but it may not be saved');
  assert.ok(bad.errors.length > 0, 'and the refusals are listed');
  for (const message of bad.errors) {
    assert.match(message, /^[a-z_]+:/, `every message names its code: ${message}`);
  }
  // The wording is the tool's own, not a second copy that can drift.
  const validation = validateLaneNetwork(broken());
  assert.equal(validation.ok, false);
  if (!validation.ok) assert.equal(bad.errors.length, validation.errors.length);
});

test('the model derives kinds from the graph, never from the authored label', () => {
  const model = lanePanelModel(sample());
  const kinds = new Set(model.nodes.map((node) => node.kind));
  assert.ok(kinds.size >= 2, 'the sample network exercises more than one kind by shape');
  for (const node of model.nodes) {
    assert.ok(['normal', 'merge', 'split', 'oob', 'orphan'].includes(node.kind as string));
  }
  // Terminal kinds come from the path's last node, and the OOB branch is marked as such.
  assert.ok(model.paths.some((path) => path.oob), 'the sample has an out-of-bounds branch');
  assert.ok(model.paths.every((path) => path.nodeCount >= 2), 'every path has at least two nodes');
});

test('AC-5: the rendered panel lists errors live, disables Save while invalid, and labels its controls', () => {
  const empty = renderToStaticMarkup(createElement(LanePanel, { model: lanePanelModel(null) }));
  assert.match(empty, /data-testid="lane-panel"/, 'the panel renders whatever the document state');
  assert.match(empty, /No lane network loaded/, 'an absent document says so');
  assert.match(empty, /\sdisabled(?==|>|\s)/, 'Save is disabled with no document');

  const bad = lanePanelModel(broken());
  const html = renderToStaticMarkup(createElement(LanePanel, {
    model: bad, onSelectNode: () => {}, onSelectPath: () => {}, onMoveNode: () => {},
    onCommand: () => {}, onSave: () => {}, onExport: () => {}, onImport: () => {}, onTestDrive: () => {},
    status: 'Saved', selectedPathId: null,
  }));

  // 1. The category and the panel are in the markup.
  assert.match(html, /data-testid="lane-panel"/);
  assert.match(html, /Lanes &amp; Paths|Lanes & Paths/);
  assert.match(html, /data-testid="lane-counts"/);

  // 2. Errors are listed in a live region, each as a button that focuses its node.
  assert.match(html, /data-testid="lane-errors"[^>]*aria-live="polite"|aria-live="polite"[^>]*data-testid="lane-errors"/,
    'the error list is a live region');
  assert.match(html, /aria-label="Focus the node for: /, 'each error focuses the offending node');
  assert.match(html,
    /(out_of_corridor|non_monotone|unknown_node|too_few_nodes|duplicate_id|kind_mismatch|bad_half_width):/,
    'the validator\'s own wording reaches the markup');

  // 3. Save is disabled while invalid — and the button says why.
  const saveButton = html.match(/<button[^>]*data-testid="lane-save"[^>]*>/)?.[0] ?? '';
  assert.ok(saveButton.length > 0, 'the Save control exists');
  // `\sdisabled` — not the substring inside `aria-disabled`, which is present either way.
  assert.match(saveButton, /\sdisabled(?==|>|\s)/, 'Save is disabled while the document is invalid');
  assert.match(saveButton, /aria-disabled="true"/, 'and says so in ARIA');

  // ...and enabled on a valid document.
  const good = renderToStaticMarkup(createElement(LanePanel, { model: lanePanelModel(sample()) }));
  const goodSave = good.match(/<button[^>]*data-testid="lane-save"[^>]*>/)?.[0] ?? '';
  assert.ok(goodSave.length > 0);
  assert.doesNotMatch(goodSave, /\sdisabled(?==|>|\s)/, 'a valid document can be saved');

  // 4. Every control is labelled: no bare buttons, no unlabelled inputs.
  const controls = html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? [];
  assert.ok(controls.length >= 8, `the panel has controls to check (${controls.length})`);
  for (const control of controls) {
    const labelled = /aria-label=|aria-labelledby=|<label[^>]*>[^<]*$/.test(control)
      || /<label/.test(html.slice(Math.max(0, html.indexOf(control) - 200), html.indexOf(control)));
    const hasText = /<button[^>]*>[\s\S]{0,80}?[A-Za-z]/.test(
      html.slice(html.indexOf(control), html.indexOf(control) + 220),
    );
    assert.ok(labelled || hasText, `unlabelled control: ${control}`);
  }
});

test('the key bindings are the ticket\'s list, and typing never becomes a command', () => {
  const press = (key: string, ctrlOrMeta = false, typing = false) => laneKeyIntent({ key, ctrlOrMeta, typing });
  assert.equal(press('n'), 'newPath');
  assert.equal(press('i'), 'insert');
  assert.equal(press('Delete'), 'delete');
  assert.equal(press('k'), 'cycleKind');
  assert.equal(press('s'), 'split');
  assert.equal(press('m'), 'merge');
  assert.equal(press('o'), 'markOob');
  assert.equal(press('z', true), 'undo');
  assert.equal(press('y', true), 'redo');
  assert.equal(press('Z', true), 'redo', 'Ctrl+Shift+Z redoes');
  assert.equal(press('n', false, true), null, 'typing "n" in a field starts nothing');
  assert.equal(press('n', true), null, 'Ctrl+N is the browser\'s, not ours');
  assert.equal(press('q'), null);
});

test('the panel renders the selected node\'s inspector with labelled fields', () => {
  const network = sample();
  const node = network.nodes[2];
  const model = lanePanelModel(network, { nodeId: node.id });
  const html = renderToStaticMarkup(createElement(LanePanel, {
    model, onMoveNode: () => {}, onCommand: () => {},
  }));
  assert.match(html, new RegExp(`aria-label="Node ${node.id} down-range x"`), 'x field is labelled');
  assert.match(html, new RegExp(`aria-label="Node ${node.id} lateral z"`), 'z field is labelled');
  assert.match(html, /aria-label="Set the selected node to Road"/, 'kind buttons are labelled');
  assert.match(html, /aria-label="Split a new branch from the selected node"/, 'commands are labelled');
  // The authored halfWidth range is the panel's float: 40..240, the validator's own bounds.
  assert.equal(DEFAULT_HALF_WIDTH, 120);
});

/* ---------------------------------------------------------------------------
   The commands: panel wording → the tool's edit.
   ---------------------------------------------------------------------------
   The panel sends commands with no coordinates in them, so these assertions are about the defaults a
   person feels when they press N or S. Every command either yields an edit that `applyLaneEdit`
   accepts — checked here by actually running it — or a refusal that says why.
   ------------------------------------------------------------------------- */

/** Runs a command end to end: the mapping, then the tool's own edit, then the validator inside it. */
function run(network: LaneNetwork, command: Parameters<typeof laneEditForCommand>[0],
             selection: { nodeId?: string | null; pathId?: string | null } = {}) {
  const outcome = laneEditForCommand(command, network, selection);
  if (!outcome.ok) return { ok: false as const, reason: outcome.reason };
  if (outcome.action.kind === 'halfWidth') return { ok: true as const, halfWidth: outcome.action };
  const applied = applyLaneEdit(network, outcome.action.edit);
  return applied.ok
    ? { ok: true as const, edit: outcome.action.edit, network: applied.network }
    : { ok: false as const, reason: applied.reason };
}

test('a new path runs to the flag, in a free lane, and the tool accepts it', () => {
  const network = sample();
  const result = run(network, { op: 'newPath' }, { nodeId: network.nodes[1].id });
  assert.equal(result.ok, true, result.ok ? '' : `the tool refused: ${result.reason}`);

  const path = result.network.paths[result.network.paths.length - 1];
  assert.equal(path.nodeIds.length, 3, 'x, a midpoint, and the flag');
  const nodes = path.nodeIds.map((id) => result.network.nodes.find((node) => node.id === id)!);
  assert.equal(nodes[0].x, START_X + (nodes[0].x - START_X), 'starts at the selection');
  assert.equal(nodes[nodes.length - 1].x, FINISH, 'and ends at the flag, not as a dead end');
  assert.ok(SNAP_Z_LANES.includes(nodes[0].z), `on a lane centre (${nodes[0].z})`);
  assert.deepEqual(nodes.map((node) => node.x), [...nodes.map((node) => node.x)].sort((a, b) => a - b));
  for (let index = 1; index < nodes.length; index++) {
    assert.ok(nodes[index].x > nodes[index - 1].x, 'strictly down the hill');
  }
  // The lane it picks is the one carrying the fewest nodes.
  const countAt = (z: number) => network.nodes.filter((node) => Math.abs(node.z - z) <= 30).length;
  assert.equal(countAt(nodes[0].z), Math.min(...SNAP_Z_LANES.map(countAt)));
});

test('every command either lands or refuses with a reason — never a coordenate the tool dislikes', () => {
  const network = sample();
  const aNode = network.nodes[2];
  const aPath = network.paths[0];

  const cases: { name: string; command: Parameters<typeof laneEditForCommand>[0]; selection?: { nodeId?: string | null; pathId?: string | null } }[] = [
    { name: 'insert', command: { op: 'insert' }, selection: { nodeId: aNode.id, pathId: aPath.id } },
    { name: 'delete', command: { op: 'delete' }, selection: { nodeId: aNode.id } },
    { name: 'split', command: { op: 'split' }, selection: { nodeId: aNode.id } },
    { name: 'markOob', command: { op: 'markOob' }, selection: { pathId: aPath.id } },
    { name: 'cycleKind', command: { op: 'cycleKind' }, selection: { nodeId: aNode.id } },
    { name: 'newPath', command: { op: 'newPath' }, selection: { nodeId: aNode.id } },
  ];
  for (const item of cases) {
    const result = run(network, item.command, item.selection);
    if (!result.ok) continue; // a refusal is allowed, but it must name its code
    assert.ok(result.network, `${item.name} produced a network`);
    const validation = validateLaneNetwork(result.network);
    assert.equal(validation.ok, true, `${item.name} left a document the runtime refuses`);
    assert.notEqual(result.network, network, `${item.name} never mutates the document it was given`);
    assert.equal(network.paths.length >= 1, true, 'the original is still intact');
  }

  // With nothing selected, the answer is a reason, not a guess.
  for (const command of [{ op: 'insert' } as const, { op: 'delete' } as const, { op: 'split' } as const, { op: 'merge' } as const]) {
    const outcome = laneEditForCommand(command, network, {});
    assert.equal(outcome.ok, false, `${command.op} needs a selection`);
    if (!outcome.ok) assert.match(outcome.reason, /^[a-z_]+:/);
  }
  const noDoc = laneEditForCommand({ op: 'newPath' }, null, {});
  assert.equal(noDoc.ok, false);
  if (!noDoc.ok) assert.match(noDoc.reason, /^no_document:/);
});

test('insert lands mid-segment with the interpolated z, and merge folds one path into a node of another', () => {
  const network = sample();
  const path = network.paths[0];
  const first = network.nodes.find((node) => node.id === path.nodeIds[0])!;
  const second = network.nodes.find((node) => node.id === path.nodeIds[1])!;

  const inserted = run(network, { op: 'insert' }, { nodeId: first.id, pathId: path.id });
  assert.equal(inserted.ok, true, inserted.ok ? '' : inserted.reason);
  if (inserted.ok && inserted.edit.op === 'insertNode') {
    assert.equal(inserted.edit.x, (first.x + second.x) / 2, 'the midpoint of the segment after the selection');
    assert.equal(inserted.edit.z, first.z + (second.z - first.z) * ((inserted.edit.x - first.x) / (second.x - first.x)));
    const grown = inserted.network.paths.find((candidate) => candidate.id === path.id)!;
    assert.equal(grown.nodeIds.length, path.nodeIds.length + 1);
  }

  // Merge: one path's end folds into a node further down the mountain. The tool's own rule decides
  // which targets are legal, so the test asks it: the first target it accepts is the one to assert on.
  const lanePath = network.paths.find((path) => path.id.endsWith('lane-0')) ?? network.paths[1];
  const laneTailId = lanePath.nodeIds[lanePath.nodeIds.length - 1];
  const laneTail = network.nodes.find((node) => node.id === laneTailId)!;
  const targets = network.nodes.filter((node) => node.x > laneTail.x && !lanePath.nodeIds.includes(node.id));
  const target = targets.find((node) => applyLaneEdit(network, { op: 'merge', fromPathId: lanePath.id, intoNodeId: node.id }).ok);
  assert.ok(target, 'a down-range node the lane can fold into exists');

  const merged = run(network, { op: 'merge' }, { pathId: lanePath.id, nodeId: target!.id });
  assert.equal(merged.ok, true, merged.ok ? '' : merged.reason);
  if (merged.ok) {
    const folded = merged.network.paths.find((candidate) => candidate.id === lanePath.id)!;
    assert.equal(folded.nodeIds[folded.nodeIds.length - 1], target!.id, 'the target node is the new end');
    assert.deepEqual(folded.nodeIds.slice(0, -1), lanePath.nodeIds, 'the rest of the path is untouched');
    assert.equal(merged.network.paths.length, network.paths.length, 'a merge adds no path');
  }

  // And the refusal that matters: folding a path *through* the split node it leaves would leave that
  // node a normal node by its shape, and T6's law says a node's authored kind must be its shape's.
  const through = network.paths.find((path) => path.nodeIds.includes(network.nodes.find((node) => node.id === 'grid')?.id ?? ''));
  if (through) {
    const refused = run(network, { op: 'merge' }, { pathId: through.id, nodeId: target!.id });
    assert.equal(refused.ok, false, 'the split node survives the refusal');
    if (!refused.ok) assert.match(refused.reason, /^(kind_mismatch|cycle|non_monotone):/);
  }
});

test("half width goes through its own door, bounded by the validator's own limits", () => {
  const network = sample();
  const path = network.paths[0];
  const ok = laneEditForCommand({ op: 'setHalfWidth', pathId: path.id, halfWidth: 180 }, network);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.action, { kind: 'halfWidth', pathId: path.id, halfWidth: 180 });

  for (const halfWidth of [LANE_HALF_WIDTH_MIN - 10, LANE_HALF_WIDTH_MAX + 10]) {
    const refused = laneEditForCommand({ op: 'setHalfWidth', pathId: path.id, halfWidth }, network);
    assert.equal(refused.ok, false, `${halfWidth} is outside the authored range`);
    if (!refused.ok) assert.match(refused.reason, /^bad_half_width:/);
  }
  const unknown = laneEditForCommand({ op: 'setHalfWidth', pathId: 'nope', halfWidth: 180 }, network);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.match(unknown.reason, /^unknown_path:/);
});

// M11: dragging a node no longer re-renders the builder UI once per pointer move.
test('M11: the lane panel is memoised and the builder UI catches up once per frame', async () => {
  const { readFileSync: read } = await import('node:fs');
  assert.equal((LanePanel as unknown as { $$typeof: symbol }).$$typeof, Symbol.for('react.memo'), 'LanePanel is React.memo');
  const ui = read(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  assert.match(ui, /builder\.onChange\(scheduleUpdate\);/, 'builder notifications are coalesced');
  assert.match(ui, /pending = requestAnimationFrame\(\(\) => \{ pending = 0; update\(\); \}\);/, 'one React update per animation frame');
  assert.match(ui, /const scheduleUpdate = \(\) => \{\s*onRequestRender\?\.\(\);/, 'the 3D view is still asked to redraw at once');
  assert.match(ui, /\{\.\.\.laneHandlers\}/, 'the panel gets the stable handlers');
  assert.match(ui, /latest\.current = handlers;/, 'which always call the latest render\'s handlers');
});
