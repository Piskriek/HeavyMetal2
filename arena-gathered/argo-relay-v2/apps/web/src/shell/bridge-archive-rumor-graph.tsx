// ============================================================================
// File: apps/web/src/shell/bridge-archive-rumor-graph.tsx
// Fix: Guarded all index/find reads under noUncheckedIndexedAccess
// ============================================================================

import React, { useState } from 'react';

export type RumorNodeCategory = 'incident-log' | 'leak-archetype' | 'cartridge-recipe';

export interface RumorGraphNode {
  id: string;
  title: string;
  category: RumorNodeCategory;
  summaryLines: string[];
  unlocked: boolean;
  xPct: number;
  yPct: number;
  connectedToIds: string[];
}

export const CANONICAL_RUMOR_GRAPH_NODES: RumorGraphNode[] = [
  {
    id: 'LOG-01',
    title: 'Bridge Telemetry [T-00:04:12]',
    category: 'incident-log',
    summaryLines: [
      'Recursive sub-sim allocation hit 99.4% of host substrate.',
      'Exterior lunar meshes dropped to 1-bit Bayer fallback.',
    ],
    unlocked: true,
    xPct: 18,
    yPct: 24,
    connectedToIds: ['LOG-02', 'ARCH-IMP'],
  },
  {
    id: 'LOG-02',
    title: 'Sub-Sim Recursion Memo',
    category: 'incident-log',
    summaryLines: [
      'Dr. Vance spun up a nested continent test inside Sector 04.',
      'Only the shielded Earth Lab retained local capacitor backup.',
    ],
    unlocked: true,
    xPct: 48,
    yPct: 18,
    connectedToIds: ['LOG-04', 'REC-GRASS'],
  },
  {
    id: 'LOG-04',
    title: 'Quarantine Breach #09',
    category: 'incident-log',
    summaryLines: [
      '1993-1997 shareware sectors ruptured along low-Pxd fault lines.',
      'Seal rifts with the Beam Tool or synthesize cores peacefully.',
    ],
    unlocked: true,
    xPct: 78,
    yPct: 28,
    connectedToIds: ['ARCH-IMP', 'ARCH-SAPPER'],
  },
  {
    id: 'ARCH-IMP',
    title: '2D Sprite Leak (1994 Era)',
    category: 'leak-archetype',
    summaryLines: [
      'Materializes in Stage 0-1 low-Pxd zones.',
      '0.7s amber arm-raise telegraph before plasma bolt.',
    ],
    unlocked: true,
    xPct: 28,
    yPct: 68,
    connectedToIds: ['REC-GRASS'],
  },
  {
    id: 'ARCH-SAPPER',
    title: 'Relay Tether Sapper',
    category: 'leak-archetype',
    summaryLines: [
      'Attaches #3dc8ff static tether that halves machine S output.',
      'Never destroys player buildings (Rule 23).',
    ],
    unlocked: true,
    xPct: 76,
    yPct: 72,
    connectedToIds: ['REC-GRASS'],
  },
  {
    id: 'REC-GRASS',
    title: 'Emerald Turf Cartridge (.smx)',
    category: 'cartridge-recipe',
    summaryLines: [
      'Fused from Blank Cartridge + Raw Regolith at Preset Bench.',
      '2.5x Pxd/Vtx yield and imprints lush meadow biome.',
    ],
    unlocked: true,
    xPct: 52,
    yPct: 56,
    connectedToIds: [],
  },
];

const CATEGORY_COLORS: Record<RumorNodeCategory, string> = {
  'incident-log': '#ffc13d',
  'leak-archetype': '#ff3d8a',
  'cartridge-recipe': '#7cff4d',
};

export interface BridgeArchiveRumorGraphProps {
  nodes?: RumorGraphNode[];
  onClose: () => void;
}

export const BridgeArchiveRumorGraphModal: React.FC<BridgeArchiveRumorGraphProps> = ({
  nodes = CANONICAL_RUMOR_GRAPH_NODES,
  onClose,
}) => {
  const firstNode = nodes[0];
  const [selectedId, setSelectedId] = useState<string>(firstNode ? firstNode.id : 'LOG-01');
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? firstNode ?? null;

  return (
    <div
      className="hud-card"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(920px, 92vw)',
        height: 'min(580px, 84vh)',
        padding: 20,
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: '#ffc13d', fontWeight: 700, letterSpacing: '0.1em' }}>
            BRIDGE ARRAY DATABANK // CAUSAL RUMOR GRAPH
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Forensic Logs, Containment Leaks &amp; Cartridge Synthesis
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'var(--hud-text-primary)',
            cursor: 'pointer',
          }}
        >
          [Tab / Esc] Close
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 16, flex: 1 }}>
        <div
          style={{
            position: 'relative',
            background: 'rgba(5, 6, 8, 0.85)',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {nodes.flatMap((src) =>
              src.connectedToIds.map((targetId) => {
                const dst = nodes.find((n) => n.id === targetId);
                if (!dst) return null;
                return (
                  <line
                    key={`${src.id}->${dst.id}`}
                    x1={`${src.xPct}%`}
                    y1={`${src.yPct}%`}
                    x2={`${dst.xPct}%`}
                    y2={`${dst.yPct}%`}
                    stroke="rgba(255, 193, 61, 0.35)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                );
              })
            )}
          </svg>

          {nodes.map((node) => {
            const color = CATEGORY_COLORS[node.category];
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
                  padding: '8px 12px',
                  background: isSelected ? 'rgba(255, 193, 61, 0.18)' : 'rgba(13, 17, 24, 0.92)',
                  border: `2px solid ${isSelected ? '#ffffff' : color}`,
                  color: '#e8eef5',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <div style={{ fontSize: 9, color, fontFamily: 'var(--hud-font-mono)' }}>
                  {node.id}
                </div>
                <div>{node.title}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            padding: 16,
            background: 'var(--hud-bg-elevated)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {selectedNode && (
            <>
              <div
                style={{
                  fontSize: 10,
                  color: CATEGORY_COLORS[selectedNode.category],
                  fontFamily: 'var(--hud-font-mono)',
                  fontWeight: 700,
                }}
              >
                {selectedNode.category.toUpperCase()} // {selectedNode.id}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedNode.title}</div>
              {selectedNode.summaryLines.map((line, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: 'var(--hud-text-dim)',
                    margin: 0,
                  }}
                >
                  {line}
                </p>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
