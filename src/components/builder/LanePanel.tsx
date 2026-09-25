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
  readonly onInitSample?: () => void;
  readonly onInitDefault?: () => void;
  readonly onFocusNode?: (nodeId: string) => void;
  readonly isDrawerOpen?: boolean;
  readonly onToggleDrawer?: (open: boolean) => void;
  /** Result of the last save, shown as a status line. */
  readonly status?: string | null;
}

const KIND_LABEL: Record<LaneNodeKind, string> = {
  normal: 'Road', merge: 'Merge', split: 'Split', oob: 'Out of bounds',
};

export default function LanePanel({
  model, onSelectNode, onSelectPath, onMoveNode, onCommand, onSave, onExport, onImport,
  onTestDrive, onInitSample, onInitDefault, onFocusNode, isDrawerOpen, onToggleDrawer, status,
}: LanePanelProps) {
  const selected = model.nodes.find((node) => node.id === model.selectedNodeId) ?? null;
  const selectedPath = model.paths.find((path) => path.id === model.selectedPathId) ?? null;
  const [filterLane, setFilterLane] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isExpanded = isDrawerOpen !== undefined ? isDrawerOpen : drawerOpen;

  const toggleDrawer = () => {
    const next = !isExpanded;
    setDrawerOpen(next);
    onToggleDrawer?.(next);
  };

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
      <header className="lane-panel__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h3 className="lane-panel__title" style={{ margin: 0 }}>Lanes &amp; Paths</h3>
          <p className="lane-panel__counts" data-testid="lane-counts">
            {model.hasDocument
              ? `${model.nodes.length} nodes · ${model.paths.length} paths on ${model.course}`
              : 'No lane network loaded for this course'}
          </p>
        </div>
        {model.hasDocument ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {model.errors.length === 0 ? (
              <span className="lane-panel__ok" style={{ fontWeight: 600, fontSize: '11px' }}>✓ Valid</span>
            ) : (
              <button
                type="button"
                className="lane-panel__button"
                style={{ borderColor: '#ef4444', color: '#fca5a5', padding: '2px 8px' }}
                onClick={() => { setDrawerOpen(true); onToggleDrawer?.(true); }}
                aria-label={`Show ${model.errors.length} validation errors in drawer`}
              >
                ⚠ {model.errors.length} Error{model.errors.length > 1 ? 's' : ''}
              </button>
            )}
            <button
              type="button"
              className={`lane-panel__button${isExpanded ? ' lane-panel__button--primary' : ''}`}
              style={{ padding: '3px 8px' }}
              onClick={toggleDrawer}
              aria-label={isExpanded ? 'Hide node and path lists' : 'Show node and path lists'}
            >
              {isExpanded ? '▼ Hide Lists' : `▲ Lists (${model.nodes.length} Nodes)`}
            </button>
          </div>
        ) : null}
      </header>

      {!model.hasDocument ? (
        <div className="lane-panel__starter" role="region" aria-label="Get started with lanes">
          <p className="lane-panel__starter-text">
            No custom lane network exists yet for this course. Start by generating standard lanes, loading the sample network, or importing a file:
          </p>
          <div className="lane-panel__actions">
            <button
              type="button"
              className="lane-panel__button lane-panel__button--primary"
              onClick={() => onInitDefault?.()}
              aria-label="Generate standard 4-lane baseline for this course"
            >
              Generate Standard 4 Lanes
            </button>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onInitSample?.()}
              aria-label="Load course sample lane network with merges and loops"
            >
              Load Sample Network
            </button>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onCommand?.({ op: 'newPath' })}
              aria-label="Create a new single lane path"
            >
              + New Path [N]
            </button>
          </div>
        </div>
      ) : null}

      <div className="lane-panel__actions" role="group" aria-label="Network file">
        {model.hasDocument ? (
          <>
            <button
              type="button"
              className="lane-panel__button lane-panel__button--primary"
              onClick={() => onCommand?.({ op: 'newPath' })}
              aria-label="Create a new lane path"
            >
              + Path [N]
            </button>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onInitDefault?.()}
              aria-label="Reset track to standard 4 lanes"
            >
              Standard 4 Lanes
            </button>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onInitSample?.()}
              aria-label="Reset track to sample lane network"
            >
              Reset Sample
            </button>
          </>
        ) : null}
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

      {/* Selected Node Quick-Action Inspector Bar (always easily visible when a node is selected) */}
      {selected ? (
        <div className="lane-panel__inspector" role="group" aria-label={`Selected node ${selected.id}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h4 className="lane-panel__subtitle" style={{ margin: 0 }}>
              Selected node <span style={{ color: '#fbbf24' }}>{selected.id}</span>
            </h4>
            <div className="lane-panel__fields" style={{ margin: 0 }}>
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
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
                aria-label="Insert a node on the path before the selected node">Insert [I]</button>
              <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'split' })}
                aria-label="Split a new branch from the selected node">Split [S]</button>
              <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'merge' })}
                aria-label="Merge the selected path end into a clicked node">Merge [M]</button>
              <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'markOob' })}
                aria-label="Mark the selected path as the out-of-bounds branch">Mark OOB</button>
              <button type="button" className="lane-panel__button" onClick={() => onCommand?.({ op: 'delete' })}
                aria-label="Delete the selected node">Delete [Del]</button>
            </div>
            <div className="lane-panel__commands" role="group" aria-label="Node step and camera commands">
              {onFocusNode ? (
                <button
                  type="button"
                  className="lane-panel__button"
                  onClick={() => onFocusNode(selected.id)}
                  aria-label="Frame the selected node in 3D camera"
                >
                  👁 Frame Node [F]
                </button>
              ) : null}
              {selectedPath?.nodeIds ? (() => {
                const pathNodeIds = selectedPath.nodeIds;
                const idx = pathNodeIds.indexOf(selected.id);
                return (
                  <>
                    <button
                      type="button"
                      className="lane-panel__button"
                      disabled={idx <= 0}
                      onClick={() => {
                        if (idx > 0) {
                          const prevId = pathNodeIds[idx - 1];
                          onSelectNode?.(prevId);
                          onFocusNode?.(prevId);
                        }
                      }}
                      aria-label="Select previous node along path"
                    >
                      &larr; Prev [ [ ]
                    </button>
                    <button
                      type="button"
                      className="lane-panel__button"
                      disabled={idx < 0 || idx >= pathNodeIds.length - 1}
                      onClick={() => {
                        if (idx >= 0 && idx < pathNodeIds.length - 1) {
                          const nextId = pathNodeIds[idx + 1];
                          onSelectNode?.(nextId);
                          onFocusNode?.(nextId);
                        }
                      }}
                      aria-label="Select next node along path"
                    >
                      Next [ ] ] &rarr;
                    </button>
                  </>
                );
              })() : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Collapsible Drawer Section (Node & Path Lists + Full Validation) */}
      <div
        className="lane-panel__drawer"
        style={{ display: isExpanded ? 'flex' : 'none', flexDirection: 'column', gap: '10px', marginTop: '6px' }}
      >
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h4 className="lane-panel__subtitle" id="lane-nodes-title" style={{ margin: 0 }}>Nodes</h4>
              {model.paths.length > 0 ? (
                <div style={{ display: 'flex', gap: '3px' }} role="group" aria-label="Filter nodes by lane">
                  <button
                    type="button"
                    className={`lane-panel__button${filterLane === 'all' ? ' lane-panel__button--primary' : ''}`}
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                    onClick={() => setFilterLane('all')}
                    aria-label="Show all nodes from all paths"
                  >
                    All
                  </button>
                  {model.paths.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`lane-panel__button${filterLane === p.id ? ' lane-panel__button--primary' : ''}`}
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => {
                        setFilterLane(p.id);
                        onSelectPath?.(p.id);
                      }}
                      aria-label={`Filter nodes for ${p.name}`}
                    >
                      L{idx + 1}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <ul className="lane-panel__list" aria-labelledby="lane-nodes-title" data-testid="lane-nodes">
              {model.nodes
                .filter((node) => {
                  if (filterLane === 'all') return true;
                  const path = model.paths.find((p) => p.id === filterLane);
                  return path?.nodeIds ? path.nodeIds.includes(node.id) : true;
                })
                .map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      className={`lane-panel__row${node.id === model.selectedNodeId ? ' is-selected' : ''}`}
                      onClick={() => {
                        onSelectNode?.(node.id);
                        onFocusNode?.(node.id);
                      }}
                      aria-pressed={node.id === model.selectedNodeId}
                      aria-label={`Node ${node.id}, ${KIND_LABEL[node.kind as LaneNodeKind] ?? 'orphan'}, x ${Math.round(node.x)}, z ${Math.round(node.z)}, on ${node.pathCount} path(s)`}
                    >
                      <span className="lane-panel__row-kind">{node.kind}</span>
                      <span className="lane-panel__row-id">{node.id}</span>
                      <span className="lane-panel__row-pos">{Math.round(node.x)} ({Math.round((node.x - 190) / 62)}m) · {Math.round(node.z)}</span>
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
                    onClick={() => {
                      onSelectPath?.(path.id);
                      setFilterLane(path.id);
                    }}
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
          <div className="lane-panel__commands" role="group" aria-label="Node nudge coordinates" style={{ marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: '#a1a1aa', marginRight: '4px' }}>Nudge:</span>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onMoveNode?.(selected.id, selected.x - 50, selected.z)}
              aria-label="Nudge node backward 50 units"
            >
              -50 X
            </button>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onMoveNode?.(selected.id, selected.x + 50, selected.z)}
              aria-label="Nudge node forward 50 units"
            >
              +50 X
            </button>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onMoveNode?.(selected.id, selected.x, selected.z - 30)}
              aria-label="Nudge node lateral left 30 units"
            >
              -30 Z
            </button>
            <button
              type="button"
              className="lane-panel__button"
              onClick={() => onMoveNode?.(selected.id, selected.x, selected.z + 30)}
              aria-label="Nudge node lateral right 30 units"
            >
              +30 Z
            </button>
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

        {!selected && !selectedPath && model.hasDocument ? (
          <div className="lane-panel__guide" role="note" aria-label="Lane editing instructions">
            <h4 className="lane-panel__subtitle">Authoring Lanes &amp; Paths</h4>
            <p className="lane-panel__hint">
              Click <strong>+ Path [N]</strong> to add a new lane path. Click any circular handle on the track to move it with the 3D manipulator gizmo.
              Select a node to <strong>Insert [I]</strong>, <strong>Split [S]</strong>, <strong>Merge [M]</strong>, change <strong>Kind [K]</strong>, or <strong>Delete [Del]</strong>.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

