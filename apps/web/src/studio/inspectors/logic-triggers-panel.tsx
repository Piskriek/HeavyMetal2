import React, { useState } from 'react';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface LogicTriggersPanelProps {
  state: StudioState;
  store: StudioStore;
}

export const LogicTriggersPanel: React.FC<LogicTriggersPanelProps> = ({ state, store }) => {
  const world = state.worlds[state.activeWorldId]!;
  const graph = world.logicGraph;
  const diag = store.getLogicDiagnostics();

  const [fromNode, setFromNode] = useState(graph.nodes[0]?.id ?? 'proximity-sensor');
  const [fromPort, setFromPort] = useState(graph.nodes[0]?.outputs[0] ?? 'detected');
  const [toNode, setToNode] = useState(graph.nodes[2]?.id ?? 'stargate-iris');
  const [toPort, setToPort] = useState(graph.nodes[2]?.inputs[0] ?? 'openSignal');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14, color: '#e2e8f0' }}>
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
        <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
          @hm/wiregraph — Zero-Code Sensor → Actuator Wiring
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <label style={{ fontSize: 10, color: '#94a3b8' }}>
            From Node
            <select
              value={fromNode}
              onChange={(e) => {
                const n = graph.nodes.find((nd) => nd.id === e.target.value);
                setFromNode(e.target.value);
                if (n?.outputs[0]) setFromPort(n.outputs[0]);
              }}
              style={{ width: '100%', padding: 6, marginTop: 3, borderRadius: 4, background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: 11 }}
            >
              {graph.nodes.filter((n) => n.outputs.length > 0).map((n) => (
                <option key={n.id} value={n.id}>{n.id}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 10, color: '#94a3b8' }}>
            Output Port
            <input
              type="text"
              value={fromPort}
              onChange={(e) => setFromPort(e.target.value)}
              style={{ width: '100%', padding: 6, marginTop: 3, borderRadius: 4, background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: 11 }}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <label style={{ fontSize: 10, color: '#94a3b8' }}>
            To Node
            <select
              value={toNode}
              onChange={(e) => {
                const n = graph.nodes.find((nd) => nd.id === e.target.value);
                setToNode(e.target.value);
                if (n?.inputs[0]) setToPort(n.inputs[0]);
              }}
              style={{ width: '100%', padding: 6, marginTop: 3, borderRadius: 4, background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: 11 }}
            >
              {graph.nodes.filter((n) => n.inputs.length > 0).map((n) => (
                <option key={n.id} value={n.id}>{n.id}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 10, color: '#94a3b8' }}>
            Input Port
            <input
              type="text"
              value={toPort}
              onChange={(e) => setToPort(e.target.value)}
              style={{ width: '100%', padding: 6, marginTop: 3, borderRadius: 4, background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: 11 }}
            />
          </label>
        </div>

        <button
          onClick={() => store.connectLogicWire({ node: fromNode, port: fromPort }, { node: toNode, port: toPort })}
          style={{
            marginTop: 4,
            padding: '7px 12px',
            borderRadius: 6,
            border: 'none',
            background: '#10b981',
            color: '#052e16',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          + Connect @hm/wiregraph Link
        </button>
      </div>

      {/* Active Wire Graph Connections & DAG Diagnostics */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
          <span>Active Wires ({graph.wires.length})</span>
          <span style={{ color: diag.problems.length === 0 ? '#34d399' : '#f87171' }}>
            {diag.problems.length === 0 ? '✓ Valid DAG' : `${diag.problems.length} Issue(s)`}
          </span>
        </div>
        {graph.wires.map((w, idx) => (
          <div
            key={`${w.from.node}.${w.from.port}->${w.to.node}.${w.to.port}#${idx}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px',
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
