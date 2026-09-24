/**
 * M01 · T7 (IF-BUILDER) — the **Lanes & Paths** panel.
 *
 * Presentational only: it renders `lanePanelModel` and calls back. Everything it promises is therefore
 * assertable in two places — the derivation in `tests/lane-panel.test.tsx`'s model half, and the markup
 * in its rendered-html half (the panel is rendered to static HTML in node, no browser needed):
 *
 *  - the validation list is the **validator's own** wording, in a live region, and each entry is a
 *    button that focuses the offending node;
 *  - **Save is disabled on exactly `model.canSave`** — which the model derives straight from
 *    `validateLaneNetwork`, so the button cannot be enabled over a document the runtime would refuse;
 *  - every control carries a label (`<label>`, `aria-label`, or its own visible text), and the kind
 *    buttons say what the graph already decided.
 */
import { useState } from 'react';
import type { LaneNodeKind } from '../../game/lane-network';
import type { LanePanelCommand, LanePanelModel } from '../../game/lane-panel-model';

/** The command union lives with the model (it is what `laneEditForCommand` consumes); re-exported so
 *  the builder UI has one import for the panel and its commands. */
export type { LanePanelCommand };

export interface LanePanelProps {
  readonly model: LanePanelModel;
  readonly onSelectNode?: (nodeId: string | null) => void;
  readonly onSelectPath?: (pathId: string | null) => void;
  readonly onMoveNode?: (nodeId: string, x: number, z: number) => void;
  readonly onCommand?: (command: LanePanelCommand) => void;
  readonly onSave?: () => void;
  readonly onExport?: () => void;
  readonly onImport?: (json: string) => void;
  readonly onTestDrive?: () => void;
  /** Result of the last save, shown as a status line. */
  readonly status?: string | null;
}

const KIND_LABEL: Record<LaneNodeKind, string> = {
  normal: 'Road', merge: 'Merge', split: 'Split', oob: 'Out of bounds',
};

export default function LanePanel({
  model, onSelectNode, onSelectPath, onMoveNode, onCommand, onSave, onExport, onImport,
  onTestDrive, status,
}: LanePanelProps) {
  const selected = model.nodes.find((node) => node.id === model.selectedNodeId) ?? null;
  const selectedPath = model.paths.find((path) => path.id === model.selectedPathId) ?? null;

  // The two coordinate boxes are a *draft*: a number typed a digit at a time ("4", "42", …) must not
  // be applied on every keystroke, or the node would be dragged to x 4 on the way to x 4200. The draft
  // commits on blur or Enter, and is dropped when the document moves under it (the value it renders
  // comes from the model whenever there is no draft for the node that is selected).
  const [draft, setDraft] = useState<{ nodeId: string; x: string; z: string } | null>(null);
  const live = draft && selected && draft.nodeId === selected.id ? draft : null;
  const fieldValue = (axis: 'x' | 'z'): string => {
    if (!selected) return '';
    if (live) return axis === 'x' ? live.x : live.z;
    return String(Math.round(axis === 'x' ? selected.x : selected.z));
  };
  const editField = (axis: 'x' | 'z', value: string) => {
    if (!selected) return;
    setDraft({
      nodeId: selected.id,
      x: axis === 'x' ? value : fieldValue('x'),
      z: axis === 'z' ? value : fieldValue('z'),
    });
  };
  const commitDraft = () => {
    if (!selected || !live) return;
    const x = Number(live.x);
    const z = Number(live.z);
    setDraft(null);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (x === selected.x && z === selected.z) return;
    onMoveNode?.(selected.id, x, z);
  };

  return (
    <section className="lane-panel" aria-label="Lanes and paths" data-testid="lane-panel">
      <header className="lane-panel__head">
        <h3 className="lane-panel__title">Lanes &amp; Paths</h3>
        <p className="lane-panel__counts" data-testid="lane-counts">
          {model.hasDocument
            ? `${model.nodes.length} nodes · ${model.paths.length} paths on ${model.course}`
            : 'No lane network loaded for this course'}
        </p>
      </header>

      <div className="lane-panel__actions" role="group" aria-label="Network file">
        <button
          type="button"
          className="lane-panel__button"
          disabled={!model.canSave || !model.hasDocument}
          onClick={() => onSave?.()}
          data-testid="lane-save"
          aria-disabled={!model.canSave || !model.hasDocument}
          title={model.canSave ? 'Save the network' : 'Fix the errors below before saving'}
        >
          Save
        </button>
        <button
          type="button"
          className="lane-panel__button"
          disabled={!model.hasDocument}
          onClick={() => onExport?.()}
          aria-label="Export the lane network as JSON"
        >
          Export
        </button>
        <label className="lane-panel__file">
          <span>Import JSON</span>
          <input
            type="file"
            accept="application/json"
            aria-label="Import a lane network from a JSON file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => onImport?.(text));
            }}
          />
        </label>
        {onTestDrive ? (
          <button type="button" className="lane-panel__button" onClick={() => onTestDrive()}
            aria-label="Close the builder and test drive the edited network">
            Test drive
          </button>
        ) : null}
      </div>

      {status ? <p className="lane-panel__status" role="status" aria-live="polite">{status}</p> : null}

      {/* The validator's own messages. Live, and clickable to focus the node they are about. */}
      <div className="lane-panel__validation">
        <h4 className="lane-panel__subtitle" id="lane-validation-title">Validation</h4>
        <ul
          className="lane-panel__errors"
          aria-labelledby="lane-validation-title"
          aria-live="polite"
          data-testid="lane-errors"
        >
          {model.errors.length === 0
            ? <li className="lane-panel__ok">The network is valid.</li>
            : model.errors.map((message, index) => {
              const nodeId = model.errorNodeIds[index];
              return (
                <li key={`${message}-${index}`} className="lane-panel__error">
                  <button
                    type="button"
                    className="lane-panel__error-button"
                    onClick={() => onSelectNode?.(nodeId)}
                    aria-label={`Focus the node for: ${message}`}
                  >
                    {message}
                  </button>
                </li>
              );
            })}
        </ul>
      </div>

      <div className="lane-panel__columns">
        <div className="lane-panel__column">
          <h4 className="lane-panel__subtitle" id="lane-nodes-title">Nodes</h4>
          <ul className="lane-panel__list" aria-labelledby="lane-nodes-title" data-testid="lane-nodes">
            {model.nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className={`lane-panel__row${node.id === model.selectedNodeId ? ' is-selected' : ''}`}
                  onClick={() => onSelectNode?.(node.id)}
                  aria-pressed={node.id === model.selectedNodeId}
                  aria-label={`Node ${node.id}, ${KIND_LABEL[node.kind as LaneNodeKind] ?? 'orphan'}, x ${Math.round(node.x)}, z ${Math.round(node.z)}, on ${node.pathCount} path(s)`}
                >
                  <span className="lane-panel__row-kind">{node.kind}</span>
                  <span className="lane-panel__row-id">{node.id}</span>
                  <span className="lane-panel__row-pos">{Math.round(node.x)} · {Math.round(node.z)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="lane-panel__column">
          <h4 className="lane-panel__subtitle" id="lane-paths-title">Paths</h4>
          <ul className="lane-panel__list" aria-labelledby="lane-paths-title" data-testid="lane-paths">
            {model.paths.map((path) => (
              <li key={path.id}>
                <button
                  type="button"
                  className={`lane-panel__row${path.id === model.selectedPathId ? ' is-selected' : ''}`}
                  onClick={() => onSelectPath?.(path.id)}
                  aria-pressed={path.id === model.selectedPathId}
                  aria-label={`Path ${path.name}, ${path.nodeCount} nodes, ends as ${path.terminalKind}${path.oob ? ', out-of-bounds branch' : ''}`}
                >
                  <span className="lane-panel__row-kind">{path.terminalKind}</span>
                  <span className="lane-panel__row-id">{path.name}</span>
                  <span className="lane-panel__row-pos">{path.nodeCount} nodes</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {selected ? (
        <div className="lane-panel__inspector" role="group" aria-label={`Selected node ${selected.id}`}>
          <h4 className="lane-panel__subtitle">Selected node</h4>
          <div className="lane-panel__fields">
            <label className="lane-panel__field">
              <span>Node x</span>
              <input
                type="number"
                value={fieldValue('x')}
                aria-label={`Node ${selected.id} down-range x`}
                onChange={(event) => editField('x', event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => { if (event.key === 'Enter') commitDraft(); }}
              />
            </label>
            <label className="lane-panel__field">
              <span>Node z</span>
              <input
                type="number"
                value={fieldValue('z')}
                aria-label={`Node ${selected.id} lateral z`}
                onChange={(event) => editField('z', event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => { if (event.key === 'Enter') commitDraft(); }}
              />
            </label>
          </div>
          <div className="lane-panel__kinds" role="group" aria-label="Node kind">
            {model.kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                className="lane-panel__button"
                aria-pressed={selected.kind === kind}
                onClick={() => onCommand?.({ op: 'cycleKind', kind })}
                aria-label={`Set the selected node to ${KIND_LABEL[kind]}`}
              >
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
          <div className="lane-panel__commands" role="group" aria-label="Node commands">
            <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'insert' })}
              aria-label="Insert a node on the path before the selected node">Insert</button>
            <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'split' })}
              aria-label="Split a new branch from the selected node">Split</button>
            <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'merge' })}
              aria-label="Merge the selected path end into a clicked node">Merge</button>
            <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'markOob' })}
              aria-label="Mark the selected path as the out-of-bounds branch">Mark OOB</button>
            <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'delete' })}
              aria-label="Delete the selected node">Delete</button>
          </div>
          <p className="lane-panel__hint">
            Drag the handle on the track, or type x and z. N new path · I insert · K kind · S split ·
            M merge · O mark OOB · Del delete · Ctrl+Z undo.
          </p>
        </div>
      ) : null}

      {selectedPath ? (
        <div className="lane-panel__inspector" role="group" aria-label={`Selected path ${selectedPath.name}`}>
          <h4 className="lane-panel__subtitle">Selected path</h4>
          <label className="lane-panel__field">
            <span>Half width (40–240)</span>
            <input
              type="range"
              min={40}
              max={240}
              step={10}
              value={selectedPath.halfWidth}
              aria-label={`Half width of path ${selectedPath.name}`}
              onChange={(event) => onCommand?.({
                op: 'setHalfWidth', pathId: selectedPath.id, halfWidth: Number(event.target.value),
              })}
            />
          </label>
          <div className="lane-panel__commands" role="group" aria-label="Path commands">
            <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'markOob' })}
              aria-label="Mark the selected path as the out-of-bounds branch">Mark OOB</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
