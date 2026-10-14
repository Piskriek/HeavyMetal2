// ============================================================================
// File: apps/web/src/shell/bridge-archive-rumor-graph.tsx
// Plan: Plan 10 (P2-LORE-06 Outer-Wilds-Style Bridge Archive Rumor Node Graph)
// ============================================================================

import React, { useState } from 'react';

export interface RumorGraphNode {
  id: string;
  title: string;
  category: 'bridge-log' | 'archive-leak' | 'synthesis-recipe';
  xPct: number; // 10..90
  yPct: number; // 15..85
  unlocked: boolean;
  summaryLines: string[];
  linksToIds: string[];
}

export const CANONICAL_RUMOR_GRAPH_NODES: RumorGraphNode[] = [
  {
    id: 'LOG-01',
    title: 'Bridge Telemetry [T-00:04:12]',
    category: 'bridge-log',
    xPct: 18,
    yPct: 22,
    unlocked: true,
    summaryLines: [
      'Host substrate hit 99.4% recursive sub-sim allocation.',
      'Exterior world dropped to Stage 0 wireframe/1-bit fallback.',
    ],
    linksToIds: ['LOG-03', 'LEAK-1993'],
  },
  {
    id: 'LOG-03',
    title: 'Four-Float Kernel Lock',
    category: 'bridge-log',
    xPct: 48,
    yPct: 20,
    unlocked: true,
    summaryLines: [
      'Reality resolution governed strictly by S = (Pxd, Vtx, Lx, Aq).',
      'Dr. Haddy isolated Sector 04 inside the Kettle Faraday cage.',
    ],
    linksToIds: ['RECIPE-TURF', 'LOG-08'],
  },
  {
    id: 'LEAK-1993',
    title: '1993–1996 Shareware Quarantine Breach',
    category: 'archive-leak',
    xPct: 22,
    yPct: 68,
    unlocked: true,
    summaryLines: [
      'Uncompiled 2D sprites and .md1/.md2 meshes leaking along low-Pxd fault lines.',
      'Sapper units drain machine kW without damaging hull integrity (Rule 23).',
    ],
    linksToIds: ['RECIPE-CORE', 'LOG-08'],
  },
  {
    id: 'RECIPE-TURF',
    title: 'Cartridge Imprinting (2.5x Plume Yield)',
    category: 'synthesis-recipe',
    xPct: 52,
    yPct: 54,
    unlocked: true,
    summaryLines: [
      'Slotting a written .smx cartridge multiplies machine float output by 2.5x.',
      '47-tile blob transitions knit emerald turf across crater seams.',
    ],
    linksToIds: ['LOG-08'],
  },
  {
    id: 'RECIPE-CORE',
    title: 'Peaceful Anomaly Core Synthesis',
    category: 'synthesis-recipe',
    xPct: 52,
    yPct: 80,
    unlocked: true,
    summaryLines: [
      '2 Lab Salvage + 1 Blank Cartridge = 1 Stabilized Anomaly Core in the Combiner.',
      'Allows 100% peaceful completion with Aggression set to Off or Calm.',
    ],
    linksToIds: ['LOG-08'],
  },
  {
    id: 'LOG-08',
    title: 'Vance Ridge Transponder & Golden Master',
    category: 'bridge-log',
    xPct: 82,
    yPct: 48,
    unlocked: false,
    summaryLines: [
      'Recovered at NW Wreck Site Gamma (+8.8m Ore Ridge).',
      'Splicing the Golden Master .smx at Stage 6 patches the host and heals the Earth Window Breach.',
    ],
    linksToIds: [],
  },
];

export interface BridgeArchiveRumorGraphProps {
  unlockedNodeIds: string[];
}

export const BridgeArchiveRumorGraph: React.FC<BridgeArchiveRumorGraphProps> = ({
  unlockedNodeIds,
}) => {
  const [selectedId, setSelectedId] = useState<string>('LOG-01');

  const nodes = CANONICAL_RUMOR_GRAPH_NODES.map((n) => ({
    ...n,
    unlocked: n.unlocked || unlockedNodeIds.includes(n.id),
  }));

  const activeNode = nodes.find((n) => n.id === selectedId) ?? nodes[0];

  const getCategoryColor = (cat: RumorGraphNode['category']) => {
    switch (cat) {
      case 'bridge-log': return '#3dc8ff';
      case 'archive-leak': return '#ff3d8a';
      case 'synthesis-recipe': return '#b46bff';
    }
  };

  return (
    <div className="hud-card" style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, height: 420 }}>
      {/* Left Interactive SVG + Node Board */}
      <div style={{ position: 'relative', background: 'rgba(5, 6, 8, 0.85)', border: '1px solid rgba(255,255,255,0.14)', overflow: 'hidden' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {nodes.map((from) =>
            from.linksToIds.map((toId) => {
              const to = nodes.find((n) => n.id === toId);
              if (!to) return null;
              const bothUnlocked = from.unlocked && to.unlocked;
              return (
                <line
                  key={`${from.id}->${to.id}`}
                  x1={`${from.xPct}%`}
                  y1={`${from.yPct}%`}
                  x2={`${to.xPct}%`}
                  y2={`${to.yPct}%`}
                  stroke={bothUnlocked ? '#ffc13d' : 'rgba(255,255,255,0.18)'}
                  strokeWidth={bothUnlocked ? 2 : 1}
                  strokeDasharray={bothUnlocked ? undefined : '4 4'}
                />
              );
            })
          )}
        </svg>

        {nodes.map((node) => {
          const accent = getCategoryColor(node.category);
          const isSelected = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId(node.id)}
              style={{
                position: 'absolute',
                left: `${node.xPct}%`,
                top: `${node.yPct}%`,
                transform: 'translate(-50%, -50%)',
                width: 148,
                padding: '7px 9px',
                textAlign: 'left',
                cursor: 'pointer',
                background: isSelected ? 'rgba(255, 193, 61, 0.20)' : '#0d1320',
                border: `2px solid ${node.unlocked ? accent : 'rgba(255,255,255,0.2)'}`,
                color: '#e8eef5',
                fontSize: 11,
              }}
            >
              <div style={{ fontSize: 9, color: accent, fontWeight: 700 }}>{node.id}</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>
                {node.unlocked ? node.title : '[UNEXPLORED SIGNAL]'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Selected Node Forensic Card */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 12, background: 'var(--hud-bg-elevated)' }}>
        <div>
          <div style={{ fontSize: 10, color: getCategoryColor(activeNode.category), fontWeight: 700 }}>
            ARCHIVE NODE // {activeNode.id}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
            {activeNode.unlocked ? activeNode.title : 'Signal Not Yet Recovered'}
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--hud-text-dim)' }}>
            {activeNode.unlocked ? (
              activeNode.summaryLines.map((line, i) => <p key={i} style={{ margin: 0 }}>&bull; {line}</p>)
            ) : (
              <p style={{ margin: 0 }}>
                Explore the North-West Ore Ridge and salvage the Wreck Transponder to decrypt this causal link.
              </p>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--hud-text-dim)' }}>
          CAUSAL LINKS: {activeNode.linksToIds.join(', ') || 'Terminal Consensus Node'}
        </div>
      </div>
    </div>
  );
};
