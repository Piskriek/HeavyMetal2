/**
 * @file apps/web/src/studio/inspectors/texgraph-node-editor.tsx
 * STUDIO-44C: Tier 3 @hm/texgraph DAG & Seamless Wrap Preview Canvas
 *
 * Exposes the 20 canonical procedural surface tiles, interactive node parameter sliders,
 * a real-time 2x2 seamless wrap preview canvas, and immediate live texture upload.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  evaluateGraph,
  TILE_LIBRARY,
  type TexGraph,
  type TexNode,
} from '@hm/texgraph';
import { globalStudioStore, useStudioState } from '../state/studio-hook';
import './texgraph-node-editor.css';

export interface TexGraphNodeEditorProps {
  readonly onTileUpdated?: (tileId: string) => void;
  readonly state?: any;
  readonly store?: any;
}

export const TexGraphNodeEditor: React.FC<TexGraphNodeEditorProps> = ({ onTileUpdated }) => {
  const state = useStudioState();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeTileId, setActiveTileId] = useState<string>(state.activeTileId ?? 'brushed-metal');
  const [channelView, setChannelView] = useState<'albedo' | 'height' | 'roughness'>('albedo');
  const [showSeams, setShowSeams] = useState<boolean>(true);

  // Active graph from store or fallback to canonical library
  const currentGraph: TexGraph = useMemo(() => {
    return state.tiles[activeTileId] ?? TILE_LIBRARY[activeTileId] ?? TILE_LIBRARY['brushed-metal']!;
  }, [state.tiles, activeTileId]);

  // Selected node within the graph for editing
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    currentGraph.nodes[0]?.id ?? 'streaks',
  );

  useEffect(() => {
    if (!currentGraph.nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(currentGraph.nodes[0]?.id ?? '');
    }
  }, [currentGraph, selectedNodeId]);

  // Render 2x2 seamless wrap preview whenever graph or channelView changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const tileDim = 128;
      const ev = evaluateGraph(currentGraph, { size: tileDim });
      const imgData = ctx.createImageData(tileDim, tileDim);
      const pixelCount = tileDim * tileDim;

      for (let i = 0; i < pixelCount; i += 1) {
        let r = 128;
        let g = 128;
        let b = 128;

        if (channelView === 'albedo' && ev.albedo) {
          r = Math.round(ev.albedo[i * 3]! * 255);
          g = Math.round(ev.albedo[i * 3 + 1]! * 255);
          b = Math.round(ev.albedo[i * 3 + 2]! * 255);
        } else if (channelView === 'height' && ev.height) {
          const v = Math.round(ev.height[i]! * 255);
          r = v;
          g = v;
          b = v;
        } else if (channelView === 'roughness' && ev.roughness) {
          const v = Math.round(ev.roughness[i]! * 255);
          r = v;
          g = v;
          b = v;
        }

        const dst = i * 4;
        imgData.data[dst] = r;
        imgData.data[dst + 1] = g;
        imgData.data[dst + 2] = b;
        imgData.data[dst + 3] = 255;
      }

      // Create an offscreen canvas to stamp 2x2
      const offscreen = document.createElement('canvas');
      offscreen.width = tileDim;
      offscreen.height = tileDim;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.putImageData(imgData, 0, 0);

        // Draw 4 tiles (top-left, top-right, bottom-left, bottom-right)
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(offscreen, 0, 0);
        ctx.drawImage(offscreen, 128, 0);
        ctx.drawImage(offscreen, 0, 128);
        ctx.drawImage(offscreen, 128, 128);

        // Subtle seam crosshair
        if (showSeams) {
          ctx.strokeStyle = 'rgba(61, 200, 255, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(128, 0);
          ctx.lineTo(128, 256);
          ctx.moveTo(0, 128);
          ctx.lineTo(256, 128);
          ctx.stroke();
        }
      }
    } catch (err) {
      // Draw error message on canvas
      ctx.fillStyle = '#220808';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Graph evaluation error', 10, 30);
    }
  }, [currentGraph, channelView, showSeams]);

  const handleTileChange = (newTileId: string) => {
    setActiveTileId(newTileId);
    globalStudioStore.setActiveTileId(newTileId);
  };

  const handleUpdateNodeParam = (nodeId: string, paramKey: string, val: number) => {
    const updatedNodes: TexNode[] = currentGraph.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        [paramKey]: val,
      };
    });

    const updatedGraph: TexGraph = {
      ...currentGraph,
      nodes: updatedNodes,
    };

    globalStudioStore.updateTexGraph(activeTileId, updatedGraph);
    onTileUpdated?.(activeTileId);
  };

  const selectedNode = currentGraph.nodes.find((n) => n.id === selectedNodeId);

  // Helper to extract editable numeric parameters from a node
  const editableParams = useMemo(() => {
    if (!selectedNode) return [];
    const ignored = new Set(['id', 'type', 'in', 'a', 'b', 'warp', 'mode']);
    return Object.entries(selectedNode)
      .filter(([k, v]) => !ignored.has(k) && typeof v === 'number')
      .map(([k, v]) => ({ key: k, value: v as number }));
  }, [selectedNode]);

  return (
    <div className="sx-texgraph-editor" data-testid="texgraph-node-editor">
      {/* Header and Tile Selector */}
      <div className="sx-texgraph-header">
        <div className="sx-texgraph-title-area">
          <span className="sx-texgraph-title">TexGraph Designer</span>
          <span className="sx-texgraph-badge">Tier 3 (Procedural)</span>
        </div>

        <div className="sx-tile-select-row">
          <label htmlFor="texgraph-tile-select" className="sx-select-label">Active Surface Tile:</label>
          <select
            id="texgraph-tile-select"
            className="sx-tile-select"
            value={activeTileId}
            onChange={(e) => handleTileChange(e.target.value)}
            data-testid="tile-select-dropdown"
          >
            {Object.keys(TILE_LIBRARY).sort().map((id) => (
              <option key={id} value={id}>
                {TILE_LIBRARY[id]?.name ?? id} ({id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2x2 Seamless Wrap Preview Section */}
      <div className="sx-preview-section">
        <div className="sx-preview-header">
          <span className="sx-preview-label">2×2 Seamless Wrap Preview</span>
          <div className="sx-channel-btns" role="radiogroup" aria-label="Channel preview">
            <button
              type="button"
              className={`sx-channel-btn ${channelView === 'albedo' ? 'active' : ''}`}
              onClick={() => setChannelView('albedo')}
              role="radio"
              aria-checked={channelView === 'albedo'}
            >
              Albedo
            </button>
            <button
              type="button"
              className={`sx-channel-btn ${channelView === 'height' ? 'active' : ''}`}
              onClick={() => setChannelView('height')}
              role="radio"
              aria-checked={channelView === 'height'}
            >
              Height
            </button>
            <button
              type="button"
              className={`sx-channel-btn ${channelView === 'roughness' ? 'active' : ''}`}
              onClick={() => setChannelView('roughness')}
              role="radio"
              aria-checked={channelView === 'roughness'}
            >
              Rough
            </button>
          </div>
        </div>

        <div className="sx-canvas-container">
          <canvas
            ref={canvasRef}
            width={256}
            height={256}
            className="sx-wrap-canvas"
            data-testid="seamless-wrap-canvas"
          />
          <div className="sx-canvas-overlay-ctrls">
            <label className="sx-seam-toggle-label">
              <input
                type="checkbox"
                checked={showSeams}
                onChange={(e) => setShowSeams(e.target.checked)}
              />
              <span>Seam Guides</span>
            </label>
            <span className="sx-dim-pill">256×256 (2×2 repeats)</span>
          </div>
        </div>
      </div>

      {/* Node DAG List & Inspector */}
      <div className="sx-nodes-section">
        <div className="sx-nodes-header">
          <span className="sx-nodes-title">Graph Nodes ({currentGraph.nodes.length})</span>
        </div>

        {/* Node Chips */}
        <div className="sx-nodes-chip-row" role="listbox" aria-label="Tile graph nodes">
          {currentGraph.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                type="button"
                className={`sx-node-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedNodeId(node.id)}
                data-testid={`node-chip-${node.id}`}
                role="option"
                aria-selected={isSelected}
              >
                <span className="sx-node-type-tag">{node.type}</span>
                <span className="sx-node-id-text">{node.id}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Node Parameter Controls */}
        {selectedNode && (
          <div className="sx-node-params-card" data-testid="node-params-card">
            <div className="sx-node-card-header">
              <span className="sx-node-id-title">{selectedNode.id}</span>
              <span className="sx-node-type-badge">{selectedNode.type}</span>
            </div>

            {editableParams.length === 0 ? (
              <div className="sx-no-params">No direct numeric parameters on this node.</div>
            ) : (
              <div className="sx-params-list">
                {editableParams.map(({ key, value }) => {
                  const isInteger = key === 'octaves' || key === 'seed' || key === 'count';
                  const step = isInteger ? 1 : value < 1 ? 0.02 : 0.1;
                  const min = key === 'octaves' ? 1 : key.includes('radius') ? 0.005 : 0;
                  const max = key === 'octaves' ? 8 : key.includes('radius') ? 0.5 : Math.max(100, value * 2);

                  return (
                    <div key={key} className="sx-param-row">
                      <div className="sx-param-label-row">
                        <label htmlFor={`param-slider-${key}`} className="sx-param-key">{key}</label>
                        <span className="sx-param-val">
                          {isInteger ? value.toFixed(0) : value.toFixed(3)}
                        </span>
                      </div>
                      <input
                        id={`param-slider-${key}`}
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        className="sx-slider"
                        value={value}
                        onChange={(e) =>
                          handleUpdateNodeParam(
                            selectedNode.id,
                            key,
                            isInteger ? parseInt(e.target.value, 10) : parseFloat(e.target.value),
                          )
                        }
                        data-testid={`param-slider-${key}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
