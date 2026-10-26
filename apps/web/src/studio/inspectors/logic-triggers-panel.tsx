/**
 * @file apps/web/src/studio/inspectors/logic-triggers-panel.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Screen 5 & Aspect 9):
 * Interactive Visual Node-Wiring Canvas (`@hm/wiregraph` `layout`, `portPos`, `wirePath` cubic Beziers)
 * with clickable Output -> Input pin wiring, animated signal pulse, and `[+ Add Logic Node]` library.
 */

import React, { useState } from 'react';
import { layout, portPos, wirePath, type End } from '@hm/wiregraph';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface LogicTriggersPanelProps {
  state: StudioState;
  store: StudioStore;
}

const NODE_PRESET_LIBRARY: Array<{
  idPrefix: string;
  label: string;
  inputs: string[];
  outputs: string[];
}> = [
  { idPrefix: 'proximity-sensor', label: 'Proximity Sensor', inputs: [], outputs: ['detected'] },
  { idPrefix: 'pressure-plate', label: 'Pressure Plate', inputs: [], outputs: ['stepped'] },
  { idPrefix: 'daylight-sensor', label: 'Daylight Sensor', inputs: [], outputs: ['nightfall'] },
  { idPrefix: 'power-relay', label: 'Power Relay Switch', inputs: ['trigger'], outputs: ['energized'] },
  { idPrefix: 'timer-delay', label: 'Timer Delay Gate', inputs: ['inSignal'], outputs: ['delayedOut'] },
  { idPrefix: 'stargate-iris', label: 'Stargate Iris Actuator', inputs: ['openSignal'], outputs: ['locked'] },
  { idPrefix: 'blast-door', label: 'Airlock Blast Door', inputs: ['openCmd'], outputs: ['isOpen'] },
  { idPrefix: 'perimeter-turret', label: 'Perimeter Defense Turret', inputs: ['power', 'targetAlert'], outputs: ['firing'] },
];

export const LogicTriggersPanel: React.FC<LogicTriggersPanelProps> = ({ state, store }) => {
  const world = state.worlds[state.activeWorldId]!;
  const graph = world.logicGraph;
  const diag = store.getLogicDiagnostics();

  const [pendingSource, setPendingSource] = useState<End | null>(null);
  const [presetToAdd, setPresetToAdd] = useState<string>(NODE_PRESET_LIBRARY[0]!.idPrefix);

  const placedNodes = React.useMemo(
    () => layout(graph, { nodeW: 132, nodeH: 56, colGap: 54, rowGap: 20 }),
    [graph],
  );

  const svgWidth = Math.max(
    360,
    ...placedNodes.map((p) => p.x + p.w + 24),
  );
  const svgHeight = Math.max(
    210,
    ...placedNodes.map((p) => p.y + p.h + 24),
  );

  const handleAddPresetNode = () => {
    const preset =
      NODE_PRESET_LIBRARY.find((p) => p.idPrefix === presetToAdd) ??
      NODE_PRESET_LIBRARY[0]!;
    let candidateId = preset.idPrefix;
    let suffix = 2;
    while (graph.nodes.some((n) => n.id === candidateId)) {
      candidateId = `${preset.idPrefix}-${suffix++}`;
    }
    store.addLogicNode(candidateId, preset.inputs, preset.outputs);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, color: '#e2e8f0' }}>
      {/* Top Bar: [+ Add Logic Node] */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
            @hm/wiregraph — Visual Sensor → Actuator Canvas
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: diag.problems.length === 0 ? '#34d399' : '#f87171',
            }}
          >
            {diag.problems.length === 0 ? '✓ Valid DAG' : `⚠ ${diag.problems.length} Issue(s)`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={presetToAdd}
            onChange={(e) => setPresetToAdd(e.target.value)}
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: 4,
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
              fontSize: 11,
            }}
          >
            {NODE_PRESET_LIBRARY.map((p) => (
              <option key={p.idPrefix} value={p.idPrefix}>
                {p.label} ({p.inputs.length} in → {p.outputs.length} out)
              </option>
            ))}
          </select>
          <button
            onClick={handleAddPresetNode}
            style={{
              padding: '5px 10px',
              borderRadius: 4,
              border: 'none',
              background: '#10b981',
              color: '#052e16',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            + Add Node
          </button>
        </div>

        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {pendingSource ? (
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>
              ⚡ Wiring from [{pendingSource.node}.{pendingSource.port}] — click any green Input pin to connect!
            </span>
          ) : (
            'Click any pink Output pin (right side of a node) then click a green Input pin (left side) to wire.'
          )}
        </div>
      </div>

      {/* Interactive SVG Node-Graph Canvas with Cubic Bezier Cables */}
      <div
        style={{
          background: '#090d16',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 8,
          overflowX: 'auto',
        }}
      >
        <svg
          data-testid="wiregraph-svg-canvas"
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', background: '#090d16', borderRadius: 6 }}
        >
          {/* Cubic Bezier Connection Wires */}
          {graph.wires.map((w, idx) => {
            const srcBox = placedNodes.find((p) => p.id === w.from.node);
            const dstBox = placedNodes.find((p) => p.id === w.to.node);
            const srcNode = graph.nodes.find((n) => n.id === w.from.node);
            const dstNode = graph.nodes.find((n) => n.id === w.to.node);
            if (!srcBox || !dstBox || !srcNode || !dstNode) return null;
            const pA = portPos(srcBox, srcNode, 'out', w.from.port);
            const pB = portPos(dstBox, dstNode, 'in', w.to.port);
            if (!pA || !pB) return null;
            const [[x0, y0], [cx0, cy0], [cx1, cy1], [x1, y1]] = wirePath(pA, pB);
            const d = `M ${x0 + 12} ${y0 + 12} C ${cx0 + 12} ${cy0 + 12}, ${cx1 + 12} ${cy1 + 12}, ${x1 + 12} ${y1 + 12}`;
            return (
              <g
                key={`${w.from.node}.${w.from.port}->${w.to.node}.${w.to.port}#${idx}`}
                onClick={() => store.disconnectLogicWire(w.from, w.to)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={d}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                />
                <circle
                  cx={(x0 + x1) * 0.5 + 12}
                  cy={(y0 + y1) * 0.5 + 12}
                  r={4}
                  fill="#fbbf24"
                />
              </g>
            );
          })}

          {/* Microchip Node Boxes & Clickable Port Pins */}
          {placedNodes.map((box) => {
            const node = graph.nodes.find((n) => n.id === box.id);
            if (!node) return null;
            return (
              <g key={box.id} transform="translate(12, 12)">
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  rx={6}
                  fill="#162032"
                  stroke="#334155"
                  strokeWidth={1.5}
                />
                <text
                  x={box.x + box.w / 2}
                  y={box.y + 16}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize={10}
                  fontWeight={700}
                >
                  {node.id}
                </text>

                {/* Input Ports (Left Side — Green) */}
                {node.inputs.map((port) => {
                  const pos = portPos(box, node, 'in', port);
                  if (!pos) return null;
                  return (
                    <g
                      key={`in:${port}`}
                      onClick={() => {
                        if (pendingSource) {
                          store.connectLogicWire(pendingSource, {
                            node: node.id,
                            port,
                          });
                          setPendingSource(null);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle cx={pos[0]} cy={pos[1]} r={5.5} fill="#10b981" stroke="#052e16" strokeWidth={1.5} />
                      <text x={pos[0] + 8} y={pos[1] + 3} fill="#94a3b8" fontSize={9}>
                        {port}
                      </text>
                    </g>
                  );
                })}

                {/* Output Ports (Right Side — Pink) */}
                {node.outputs.map((port) => {
                  const pos = portPos(box, node, 'out', port);
                  if (!pos) return null;
                  const isPending =
                    pendingSource?.node === node.id && pendingSource?.port === port;
                  return (
                    <g
                      key={`out:${port}`}
                      onClick={() => setPendingSource({ node: node.id, port })}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={pos[0]}
                        cy={pos[1]}
                        r={isPending ? 7 : 5.5}
                        fill={isPending ? '#fbbf24' : '#ff3d8a'}
                        stroke="#0f172a"
                        strokeWidth={1.5}
                      />
                      <text
                        x={pos[0] - 8}
                        y={pos[1] + 3}
                        textAnchor="end"
                        fill="#cbd5e1"
                        fontSize={9}
                      >
                        {port}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Active Wire Connections List */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
          Active Signal Cables ({graph.wires.length})
        </div>
        {graph.wires.map((w, idx) => (
          <div
            key={`${w.from.node}.${w.from.port}->${w.to.node}.${w.to.port}#${idx}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '5px 8px',
              borderRadius: 6,
              background: '#162032',
              border: '1px solid #243046',
              fontSize: 10,
            }}
          >
            <div>
              <span style={{ color: '#f472b6', fontWeight: 700 }}>
                {w.from.node}.{w.from.port}
              </span>
              <span style={{ color: '#94a3b8' }}> ──▶ </span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                {w.to.node}.{w.to.port}
              </span>
            </div>
            <button
              onClick={() => store.disconnectLogicWire(w.from, w.to)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
