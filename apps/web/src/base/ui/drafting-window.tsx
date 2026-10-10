import React, { useState } from 'react';
import type { BaseActions, DraftView, LatticeView } from '../view';
import type { Applied, BaseCommand, BaseWorld, Point } from '../world';
import { layoutPieces, pieceAt } from '../world';
import { Compass, Hammer, X, LayoutGrid, Copy, Play, ArrowDownToLine, Plus } from 'lucide-react';
import { ItemGlyph } from './item-glyph';

interface DraftingWindowProps {
  draft: DraftView;
  lattice?: LatticeView;
  actions: BaseActions;
  world?: BaseWorld;
  getWorld?: () => BaseWorld;
  at?: Point;
  currentStructureId?: number | null;
  onDispatch?: (cmd: BaseCommand) => Applied | void;
  onPlaceLayout?: (layoutId: string) => void;
  onToast?: (title: string, sub?: string) => void;
  onClose: () => void;
}

function MiniFootprintSvg({ code }: { code: string }) {
  const pieces = layoutPieces(code);
  if (!pieces || pieces.length === 0) {
    return <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />;
  }

  const is = pieces.map((p) => p.i);
  const js = pieces.map((p) => p.j);
  const minI = Math.min(...is);
  const maxI = Math.max(...is);
  const minJ = Math.min(...js);
  const maxJ = Math.max(...js);

  const rangeI = Math.max(1, maxI - minI + 1);
  const rangeJ = Math.max(1, maxJ - minJ + 1);

  const size = 52;
  const pad = 4;
  const avail = size - pad * 2;
  const cellSize = Math.min(avail / rangeI, avail / rangeJ, 16);
  const totalW = rangeI * cellSize;
  const totalH = rangeJ * cellSize;
  const offsetX = pad + (avail - totalW) / 2;
  const offsetY = pad + (avail - totalH) / 2;

  const cellRects: { x: number; y: number; kind: string }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number; kind: string }[] = [];

  for (const p of pieces) {
    const cx = offsetX + (p.i - minI) * cellSize;
    const cy = offsetY + (p.j - minJ) * cellSize;
    if (p.kind === 'foundation' || p.kind === 'floor') {
      if (!cellRects.some((c) => Math.abs(c.x - cx) < 0.1 && Math.abs(c.y - cy) < 0.1)) {
        cellRects.push({ x: cx, y: cy, kind: p.kind });
      }
    } else if (p.kind === 'wall' || p.kind === 'airlock' || p.kind === 'doorframe' || p.kind === 'door') {
      if (p.r === 0) {
        edges.push({ x1: cx, y1: cy, x2: cx + cellSize, y2: cy, kind: p.kind });
      } else {
        edges.push({ x1: cx, y1: cy, x2: cx, y2: cy + cellSize, kind: p.kind });
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        background: 'rgba(15, 23, 42, 0.65)',
        borderRadius: 4,
        border: '1px solid var(--base-border-subtle)',
        flexShrink: 0,
      }}
    >
      {cellRects.map((c, idx) => (
        <rect
          key={idx}
          x={c.x + 0.5}
          y={c.y + 0.5}
          width={Math.max(1, cellSize - 1)}
          height={Math.max(1, cellSize - 1)}
          fill="rgba(56, 189, 248, 0.35)"
          stroke="#38bdf8"
          strokeWidth="0.6"
        />
      ))}
      {edges.map((e, idx) => (
        <line
          key={idx}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke={e.kind === 'airlock' ? '#34d399' : '#00f0ff'}
          strokeWidth={e.kind === 'airlock' ? 2 : 1.2}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export const DraftingWindow: React.FC<DraftingWindowProps> = ({
  draft,
  lattice,
  actions,
  world,
  getWorld,
  at,
  currentStructureId,
  onDispatch,
  onPlaceLayout,
  onToast,
  onClose,
}) => {
  const [, setTick] = useState(0);
  const currentWorld = getWorld ? getWorld() : world;
  const [activeTab, setActiveTab] = useState<'blueprints' | 'layouts'>('blueprints');
  const [selectedPrim, setSelectedPrim] = useState<string | null>('prim_cube');
  const [selectedMap, setSelectedMap] = useState<string | null>('map_basalt');

  // Layouts tab state
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importName, setImportName] = useState('');
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const isOutOfRange = lattice ? lattice.here === null : false;

  const handlePickPrim = (id: string) => {
    setSelectedPrim(id);
    actions.pickDraft(id, selectedMap);
  };

  const handlePickMap = (id: string) => {
    setSelectedMap(id);
    actions.pickDraft(selectedPrim, id);
  };

  const handleSaveStructure = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError('Please enter a layout name (1 to 32 characters).');
      return;
    }
    if (trimmed.length > 32) {
      setSaveError('Name cannot exceed 32 characters.');
      return;
    }
    const benchPiece = currentWorld?.base?.pieces?.find((p) => p.kind === 'bench');
    const benchPos = (currentWorld?.base && benchPiece) ? pieceAt(currentWorld.base, benchPiece) : null;
    const targetStructure = currentStructureId ?? (benchPiece?.s ?? (currentWorld?.base?.structures?.[0]?.id ?? null));
    if (targetStructure === null || targetStructure === undefined) {
      setSaveError('No structure targeted. Aim at or stand inside a base.');
      return;
    }
    if (!onDispatch) {
      setSaveError('Dispatch interface unavailable.');
      return;
    }

    const liveAt = benchPos ? { x: benchPos.x, z: benchPos.z } : (at ?? { x: 0, z: 0 });

    const res = onDispatch({
      t: 'saveLayout',
      at: liveAt,
      structure: targetStructure,
      name: trimmed,
    });

    if (res) {
      const refused = res.events.find((e) => e.type === 'refused');
      if (refused && refused.type === 'refused') {
        const reasons: Record<string, string> = {
          'no-bench': 'Must be within reach of a Drafting Table.',
          'no-structure': 'Selected structure not found.',
          'bad-name': 'Invalid name length (1 to 32 chars).',
          'bad-code': 'Structure has no ground foundation at origin.',
          known: 'This layout has already been saved.',
          full: 'Layout limit reached (maximum 16).',
        };
        setSaveError(reasons[refused.why] || `Refused: ${refused.why}`);
        return;
      }
    }

    setSaveName('');
    setSaveError(null);
    setTick((t) => t + 1);
    onToast?.('Layout Saved!', `Saved "${trimmed}" to architectural layout library.`);
  };

  const handleImportLayout = () => {
    const trimmedName = importName.trim();
    const trimmedCode = importCode.trim();
    if (!trimmedName) {
      setImportError('Please enter a name for the imported layout.');
      return;
    }
    if (!trimmedCode) {
      setImportError('Please paste a valid layout code.');
      return;
    }
    if (!onDispatch) {
      setImportError('Dispatch interface unavailable.');
      return;
    }

    const res = onDispatch({
      t: 'importLayout',
      code: trimmedCode,
      name: trimmedName,
    });

    if (res) {
      const refused = res.events.find((e) => e.type === 'refused');
      if (refused && refused.type === 'refused') {
        const reasons: Record<string, string> = {
          'bad-code': 'Invalid or corrupted layout code format.',
          'bad-name': 'Invalid layout name (1 to 32 chars).',
          known: 'An identical layout already exists in your library.',
          full: 'Layout limit reached (maximum 16).',
        };
        setImportError(reasons[refused.why] || `Import failed: ${refused.why}`);
        return;
      }
    }

    setImportName('');
    setImportCode('');
    setImportError(null);
    setTick((t) => t + 1);
    onToast?.('Layout Imported!', `Imported "${trimmedName}" to library.`);
  };

  const result = draft.result;
  const canAfford = !isOutOfRange && result ? result.cost.every((c) => c.have >= c.n) : false;
  const layouts = currentWorld?.layouts ?? [];

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="drafting-modal">
      <div className="hm-window-panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 840 }}>
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <Compass size={18} style={{ color: 'var(--base-cyan)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>ARCHITECTURAL DRAFTING TABLE</span>
                {isOutOfRange && <span className="hm-range-badge out">OUT OF RANGE</span>}
              </div>
              <span className="hm-window-subtitle">
                Synthesize Primitives & Texture Maps or Manage Reusable Layouts
              </span>
            </div>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="drafting-close-btn">
            <X size={14} /> ESC
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="hm-draft-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={`hm-draft-tab-btn ${activeTab === 'blueprints' ? 'active' : ''}`}
            onClick={() => setActiveTab('blueprints')}
            data-testid="drafting-tab-blueprints"
          >
            <Compass size={14} /> Blueprints
          </button>
          <button
            className={`hm-draft-tab-btn ${activeTab === 'layouts' ? 'active' : ''}`}
            onClick={() => setActiveTab('layouts')}
            data-testid="drafting-tab-layouts"
          >
            <LayoutGrid size={14} /> Layouts {layouts.length > 0 ? `(${layouts.length})` : ''}
          </button>
        </div>

        {activeTab === 'blueprints' ? (
          /* 3-Column Blueprints Layout */
          <div className="hm-drafting-layout">
            {/* Column 1: Primitives */}
            <div className="hm-draft-column">
              <span className="hm-draft-col-header">1. GEOMETRIC PRIMITIVES</span>
              {draft.primitives.map((slot) => {
                if (!slot.item) return null;
                const isSelected = selectedPrim === slot.item.id;

                return (
                  <div
                    key={slot.item.id}
                    className={`hm-draft-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handlePickPrim(slot.item!.id)}
                    data-testid={`prim-pick-${slot.item.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="hm-slot-icon-box">
                        <ItemGlyph item={slot.item} size={22} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{slot.item.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                          Mass: {slot.item.kg} kg
                        </span>
                      </div>
                    </div>
                    {isOutOfRange ? (
                      <span className="hm-out-of-range-tag">out of range</span>
                    ) : (
                      <span style={{ fontFamily: 'Oxanium', fontSize: 12, color: 'var(--base-cyan)' }}>
                        x{slot.n}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Column 2: Material Maps */}
            <div className="hm-draft-column">
              <span className="hm-draft-col-header">2. MATERIAL TEXTURE MAPS</span>
              {draft.maps.map((slot) => {
                if (!slot.item) return null;
                const isSelected = selectedMap === slot.item.id;

                return (
                  <div
                    key={slot.item.id}
                    className={`hm-draft-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handlePickMap(slot.item!.id)}
                    data-testid={`map-pick-${slot.item.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="hm-slot-icon-box">
                        <ItemGlyph item={slot.item} size={22} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{slot.item.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                          Albedo / PBR
                        </span>
                      </div>
                    </div>
                    {isOutOfRange ? (
                      <span className="hm-out-of-range-tag">out of range</span>
                    ) : (
                      <span style={{ fontFamily: 'Oxanium', fontSize: 12, color: 'var(--base-cyan)' }}>
                        x{slot.n}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Column 3: Blueprint Preview */}
            <div className="hm-draft-preview-panel" data-testid="drafting-preview-panel">
              <span className="hm-draft-col-header" style={{ color: '#38bdf8' }}>
                3. BLUEPRINT SYNTHESIS
              </span>

              {result ? (
                <>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                      {result.name} Blueprint
                    </div>
                    <div
                      style={{
                        fontFamily: 'Oxanium',
                        fontSize: 12,
                        color: 'var(--base-cyan)',
                        marginTop: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      Target Piece: {result.piece} ({result.kg} kg)
                    </div>
                  </div>

                  {/* Valheim Structural Reach Meter */}
                  <div className="hm-draft-reach-bars">
                    <div className="hm-reach-row">
                      <span>Vertical Integrity (vKeep)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="hm-reach-bar">
                          <div
                            className="hm-reach-fill"
                            style={{ width: `${result.vKeep * 100}%` }}
                          />
                        </div>
                        <span style={{ fontFamily: 'Oxanium', fontSize: 11 }}>
                          {result.vKeep * 100}%
                        </span>
                      </div>
                    </div>

                    <div className="hm-reach-row">
                      <span>Horizontal Cantilever (hKeep)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="hm-reach-bar">
                          <div
                            className="hm-reach-fill"
                            style={{ width: `${result.hKeep * 100}%`, background: '#38bdf8' }}
                          />
                        </div>
                        <span style={{ fontFamily: 'Oxanium', fontSize: 11 }}>
                          {result.hKeep * 100}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bill of Materials */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--base-text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      REQUIRED SUBSTRATE (NETWORK PULLED)
                    </span>
                    {result.cost.map((c) => {
                      const hasEnough = !isOutOfRange && c.have >= c.n;
                      return (
                        <div
                          key={c.item.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            color: isOutOfRange ? '#f87171' : hasEnough ? '#cbd5e1' : '#f87171',
                          }}
                        >
                          <span>{c.item.name}</span>
                          <span style={{ fontFamily: 'Oxanium' }}>
                            {isOutOfRange ? 'out of range' : `${c.have} / ${c.n}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className="hm-synthesize-btn"
                    disabled={!canAfford}
                    onClick={() => actions.draft()}
                    data-testid="synthesize-draft-btn"
                  >
                    <Hammer size={14} />
                    <span>
                      {isOutOfRange
                        ? 'OUT OF RANGE'
                        : canAfford
                          ? 'SYNTHESIZE BLUEPRINT'
                          : 'INSUFFICIENT SUBSTRATE'}
                    </span>
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--base-text-muted)', margin: 'auto' }}>
                  Select a primitive and texture map to calculate structural properties.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Layouts Management Tab */
          <div className="hm-layouts-tab-panel" data-testid="layouts-tab-panel">
            {/* Save Structure Form */}
            <div className="hm-layout-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="hm-draft-col-header">Save Active Structure as Layout</span>
                {currentStructureId !== null && currentStructureId !== undefined && (
                  <span style={{ fontSize: 11, fontFamily: 'Oxanium', color: 'var(--base-cyan)' }}>
                    Target Structure #{currentStructureId}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <input
                  type="text"
                  className="hm-layout-input"
                  placeholder="Layout name (e.g. Starter Outpost)"
                  maxLength={32}
                  value={saveName}
                  onChange={(e) => {
                    setSaveName(e.target.value);
                    setSaveError(null);
                  }}
                  data-testid="save-layout-name-input"
                />
                <button
                  className="hm-layout-btn primary"
                  onClick={handleSaveStructure}
                  data-testid="save-layout-btn"
                >
                  <Plus size={14} /> Save Structure
                </button>
              </div>
              {saveError && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                  {saveError}
                </div>
              )}
            </div>

            {/* Import Layout Form */}
            <div className="hm-layout-section" style={{ marginTop: 14 }}>
              <span className="hm-draft-col-header">Import Shared Layout Code</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <input
                  type="text"
                  className="hm-layout-input"
                  style={{ width: '220px', flexShrink: 0 }}
                  placeholder="Import name"
                  maxLength={32}
                  value={importName}
                  onChange={(e) => {
                    setImportName(e.target.value);
                    setImportError(null);
                  }}
                  data-testid="import-layout-name-input"
                />
                <input
                  type="text"
                  className="hm-layout-input"
                  style={{ flex: 1 }}
                  placeholder="Paste layout base64 code here..."
                  value={importCode}
                  onChange={(e) => {
                    setImportCode(e.target.value);
                    setImportError(null);
                  }}
                  data-testid="import-layout-code-input"
                />
                <button
                  className="hm-layout-btn secondary"
                  onClick={handleImportLayout}
                  data-testid="import-layout-btn"
                >
                  <ArrowDownToLine size={14} /> Import
                </button>
              </div>
              {importError && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                  {importError}
                </div>
              )}
            </div>

            {/* Saved Layouts List */}
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="hm-draft-col-header">Saved Architectural Layouts ({layouts.length})</span>
                <span style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                  Place plans in the world or copy code to share
                </span>
              </div>

              {layouts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--base-text-muted)', padding: '36px 0', fontSize: 13 }}>
                  No saved layouts yet. Build a structure on the surface and save it here to create reusable templates!
                </div>
              ) : (
                <div
                  className="hm-layouts-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 12,
                    marginTop: 12,
                    maxHeight: '280px',
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {layouts.map((layout) => {
                    const count = layoutPieces(layout.code)?.length ?? 0;
                    return (
                      <div
                        key={layout.id}
                        className="hm-layout-card"
                        data-testid={`layout-card-${layout.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: 'var(--base-bg-surface)',
                          padding: '10px 12px',
                          borderRadius: 'var(--base-radius-md)',
                          border: '1px solid var(--base-border-subtle)',
                        }}
                      >
                        <MiniFootprintSvg code={layout.code} />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#f8fafc',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {layout.name}
                          </span>
                          <span
                            style={{
                              fontFamily: 'Oxanium',
                              fontSize: 11,
                              color: 'var(--base-cyan)',
                              marginTop: 2,
                            }}
                          >
                            {count} piece{count === 1 ? '' : 's'}
                          </span>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button
                              className="hm-layout-card-btn place"
                              onClick={() => {
                                onPlaceLayout?.(layout.id);
                                onClose();
                              }}
                              data-testid={`place-layout-btn-${layout.id}`}
                              title="Enter layout placement mode in world"
                            >
                              <Play size={11} /> Place
                            </button>
                            <button
                              className="hm-layout-card-btn share"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(layout.code);
                                  onToast?.('Copied to clipboard!', `Layout "${layout.name}" code copied.`);
                                } catch {
                                  onToast?.('Failed to copy', 'Clipboard error.');
                                }
                              }}
                              data-testid={`share-layout-btn-${layout.id}`}
                              title="Copy layout code to clipboard"
                            >
                              <Copy size={11} /> Share
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
