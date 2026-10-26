/**
 * @file apps/web/src/studio/inspectors/texgraph-node-editor.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Screen 3 & Aspect 3):
 * 20 Canonical Seamless Tiles (`@hm/texgraph`) + 2x2 Wrap & 3D UV Sphere Preview +
 * Interactive Node Parameter Sliders & `[+ Add Node]` Graph Builder.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  evaluateGraph,
  TILE_LIBRARY,
  type TexGraph,
  type TexNode,
} from '@hm/texgraph';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface TexGraphNodeEditorProps {
  state: StudioState;
  store: StudioStore;
}

export type TexPreviewChannel = 'grey' | 'height' | 'roughness' | 'sphere-3d';

export const TexGraphNodeEditor: React.FC<TexGraphNodeEditorProps> = ({ state, store }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [channel, setChannel] = useState<TexPreviewChannel>('grey');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newNodeType, setNewNodeType] = useState<'noise' | 'scratches' | 'spots' | 'hex' | 'weave' | 'blur'>('noise');

  const tileIds = Object.keys(TILE_LIBRARY);
  const activeTileId = state.activeTileId in state.tiles ? state.activeTileId : tileIds[0]!;
  const activeGraph: TexGraph = state.tiles[activeTileId] ?? TILE_LIBRARY[activeTileId]!;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeGraph) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileRes = 64;
    const evaluated = evaluateGraph(activeGraph, { size: tileRes });

    if (channel === 'sphere-3d') {
      // Render a 3D UV-wrapped shaded preview sphere directly on the 256x256 canvas
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.createImageData(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const rad = w * 0.42;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const dx = (px - cx) / rad;
          const dy = (cy - py) / rad;
          const r2 = dx * dx + dy * dy;
          const pOff = (py * w + px) * 4;
          if (r2 > 1.0) {
            imgData.data[pOff] = 9;
            imgData.data[pOff + 1] = 13;
            imgData.data[pOff + 2] = 22;
            imgData.data[pOff + 3] = 255;
            continue;
          }
          const dz = Math.sqrt(1.0 - r2);
          const u = ((Math.atan2(dx, dz) / (Math.PI * 2)) + 0.5) * 2.0;
          const v = (Math.asin(Math.max(-1, Math.min(1, dy))) / Math.PI + 0.5) * 2.0;
          const tx = ((Math.floor(u * tileRes) % tileRes) + tileRes) % tileRes;
          const ty = ((Math.floor(v * tileRes) % tileRes) + tileRes) % tileRes;
          const sampleIdx = ty * tileRes + tx;
          const gVal = evaluated.albedo
            ? (evaluated.albedo[sampleIdx * 3]! * 0.299 + evaluated.albedo[sampleIdx * 3 + 1]! * 0.587 + evaluated.albedo[sampleIdx * 3 + 2]! * 0.114)
            : (evaluated.height?.[sampleIdx] ?? 0.5);
          const hVal = evaluated.height?.[sampleIdx] ?? 0.5;

          // Directional lighting + bump relief
          const ndotl = Math.max(0.15, dx * 0.45 + dy * 0.55 + dz * 0.7);
          const lit = Math.max(0, Math.min(1, (0.35 + gVal * 0.65) * ndotl + (hVal - 0.5) * 0.25));
          const byte = Math.round(lit * 255);
          imgData.data[pOff] = byte;
          imgData.data[pOff + 1] = Math.min(255, Math.round(byte * 1.04));
          imgData.data[pOff + 2] = Math.min(255, Math.round(byte * 1.1));
          imgData.data[pOff + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    // 2x2 Toroidal Seamless Wrap Preview (256x256)
    const imgData = ctx.createImageData(tileRes, tileRes);
    for (let i = 0; i < tileRes * tileRes; i++) {
      if (channel === 'grey' && evaluated.albedo) {
        imgData.data[i * 4 + 0] = Math.max(0, Math.min(255, Math.round(evaluated.albedo[i * 3]! * 255)));
        imgData.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(evaluated.albedo[i * 3 + 1]! * 255)));
        imgData.data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(evaluated.albedo[i * 3 + 2]! * 255)));
      } else {
        const buf = channel === 'height' ? evaluated.height : evaluated.roughness;
        const v = Math.max(0, Math.min(255, Math.round((buf?.[i] ?? 0.5) * 255)));
        imgData.data[i * 4 + 0] = v;
        imgData.data[i * 4 + 1] = v;
        imgData.data[i * 4 + 2] = v;
      }
      imgData.data[i * 4 + 3] = 255;
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = tileRes;
    offscreen.height = tileRes;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(offscreen, 0, 0, 128, 128);
      ctx.drawImage(offscreen, 128, 0, 128, 128);
      ctx.drawImage(offscreen, 0, 128, 128, 128);
      ctx.drawImage(offscreen, 128, 128, 128, 128);

      // Seam Crosshair Guides
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.moveTo(0, 128);
      ctx.lineTo(256, 128);
      ctx.stroke();
    }
  }, [activeTileId, activeGraph, channel]);

  const activeNode: TexNode | undefined =
    activeGraph.nodes.find((n) => n.id === selectedNodeId) ?? activeGraph.nodes[0];

  const handleUpdateNodeParam = (nodeId: string, key: string, value: number) => {
    const nextNodes = activeGraph.nodes.map((n) =>
      n.id === nodeId ? ({ ...n, [key]: value } as TexNode) : n,
    );
    store.updateTexGraph(activeTileId, {
      ...activeGraph,
      nodes: nextNodes,
    });
  };

  const handleAddNode = () => {
    const newId = `${newNodeType}_${activeGraph.nodes.length + 1}`;
    const lastId = activeGraph.nodes[activeGraph.nodes.length - 1]?.id ?? 'n0';
    let created: TexNode;
    switch (newNodeType) {
      case 'scratches':
        created = { id: newId, type: 'scratches', count: 18, length: 0.35, width: 0.012, angleSpread: 0.8, seed: 7 };
        break;
      case 'spots':
        created = { id: newId, type: 'spots', count: 24, radiusMin: 0.02, radiusMax: 0.07, softness: 0.4, seed: 11 };
        break;
      case 'hex':
        created = { id: newId, type: 'hex', count: 8, lineWidth: 0.08, mode: 'edge', seed: 3 };
        break;
      case 'weave':
        created = { id: newId, type: 'weave', countX: 6, countY: 6, gap: 0.12 };
        break;
      case 'blur':
        created = { id: newId, type: 'blur', in: lastId, radius: 0.03 };
        break;
      default:
        created = { id: newId, type: 'noise', scale: 6, scaleY: 6, octaves: 3, gain: 0.5, seed: 19 };
        break;
    }
    store.updateTexGraph(activeTileId, {
      ...activeGraph,
      nodes: [...activeGraph.nodes, created],
    });
    setSelectedNodeId(newId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, color: '#e2e8f0' }}>
      {/* Active Tile Selector */}
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
        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
          Active Procedural Surface Tile (@hm/texgraph — {tileIds.length} Tiles)
        </div>
        <select
          value={activeTileId}
          onChange={(e) => {
            store.setActiveTileId(e.target.value);
            setSelectedNodeId(null);
          }}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            background: '#0f172a',
            color: '#38bdf8',
            border: '1px solid #334155',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {tileIds.map((tId) => (
            <option key={tId} value={tId}>
              {tId} ({state.tiles[tId]?.nodes.length ?? 0} nodes)
            </option>
          ))}
        </select>

        {/* Channel & 3D Sphere Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {(
            [
              { id: 'grey', label: 'Albedo' },
              { id: 'height', label: 'Height' },
              { id: 'roughness', label: 'Rough' },
              { id: 'sphere-3d', label: '3D Sphere' },
            ] as Array<{ id: TexPreviewChannel; label: string }>
          ).map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              style={{
                padding: '4px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: channel === ch.id ? 700 : 500,
                border: channel === ch.id ? '1px solid #38bdf8' : '1px solid #334155',
                background: channel === ch.id ? '#0284c7' : '#0f172a',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <canvas
            ref={canvasRef}
            data-testid="texgraph-preview-canvas"
            width={256}
            height={256}
            style={{
              width: 220,
              height: 220,
              borderRadius: 8,
              border: '1px solid #38bdf8',
              background: '#090d16',
            }}
          />
        </div>
      </div>

      {/* Node Graph Chain & [+ Add Node] */}
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
          <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
            DAG Nodes ({activeGraph.nodes.length})
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value={newNodeType}
              onChange={(e) => setNewNodeType(e.target.value as typeof newNodeType)}
              style={{
                padding: '3px 6px',
                borderRadius: 4,
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                fontSize: 10,
              }}
            >
              <option value="noise">noise (aniso)</option>
              <option value="scratches">scratches</option>
              <option value="spots">spots</option>
              <option value="hex">hex</option>
              <option value="weave">weave</option>
              <option value="blur">blur</option>
            </select>
            <button
              onClick={handleAddNode}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                border: 'none',
                background: '#10b981',
                color: '#052e16',
                fontWeight: 700,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              + Add Node
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {activeGraph.nodes.map((node) => {
            const isSel = node.id === activeNode?.id;
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 5,
                  fontSize: 10,
                  fontWeight: isSel ? 700 : 500,
                  border: isSel ? '1.5px solid #38bdf8' : '1px solid #243046',
                  background: isSel ? 'rgba(56, 189, 248, 0.18)' : '#162032',
                  color: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                {node.id} ({node.type})
              </button>
            );
          })}
        </div>

        {/* Selected Node Parameter Sliders */}
        {activeNode && (
          <div
            style={{
              marginTop: 6,
              padding: 10,
              borderRadius: 6,
              background: '#162032',
              border: '1px solid #243046',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
              Node Parameters: {activeNode.id} ({activeNode.type})
            </div>
            {Object.entries(activeNode).map(([k, v]) => {
              if (k === 'id' || k === 'type' || typeof v !== 'number') return null;
              const isInt = k === 'scale' || k === 'scaleY' || k === 'octaves' || k === 'seed' || k === 'count' || k === 'countX' || k === 'countY';
              return (
                <label
                  key={k}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>{k}</span>
                    <span style={{ color: '#38bdf8' }}>{isInt ? Math.round(v) : v.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min={isInt ? 1 : 0.0}
                    max={k === 'seed' ? 200 : isInt ? 32 : 2.0}
                    step={isInt ? 1 : 0.01}
                    value={v}
                    onChange={(e) =>
                      handleUpdateNodeParam(
                        activeNode.id,
                        k,
                        isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value),
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
