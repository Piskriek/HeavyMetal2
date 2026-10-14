// ============================================================================
// File: apps/web/src/shell/build-ribbon.tsx
// Brief: Brief 25 (P0-UI-02 Non-Blocking 136px Bottom Build Ribbon & P2-UI-06 Hologram Lock)
// ============================================================================

import React, { useState } from 'react';

export type BuildCategory = 'machines' | 'structures' | 'heavy' | 'weapons';

export interface BuildableItemSpec {
  id: string;
  name: string;
  category: BuildCategory;
  oreCost: number;
  salvageCost?: number;
  powerKw: number; // Positive = consumes kW; Negative = generates kW (e.g., -36 for Power Unit)
  metricAccent: string;
  hotkey: string;
}

export const CANONICAL_BUILD_ITEMS: BuildableItemSpec[] = [
  { id: 'rock-drill',      name: 'Rock Drill',       category: 'machines',   oreCost: 10, powerKw: 3.0,  metricAccent: '#9aa6b2', hotkey: '1' },
  { id: 'texture-mill',    name: 'Texture Mill',     category: 'machines',   oreCost: 15, powerKw: 4.0,  metricAccent: '#ff3d8a', hotkey: '2' },
  { id: 'shape-press',     name: 'Shape Press',      category: 'machines',   oreCost: 15, powerKw: 3.5,  metricAccent: '#7cff4d', hotkey: '3' },
  { id: 'light-projector', name: 'Light Projector',  category: 'machines',   oreCost: 25, powerKw: 6.0,  metricAccent: '#ffc13d', hotkey: '4' },
  { id: 'water-maker',     name: 'Water Maker (1x1)',category: 'machines',   oreCost: 30, powerKw: 8.0,  metricAccent: '#3dc8ff', hotkey: '5' },
  { id: 'power-unit',      name: 'Power Unit (+36kW)',category: 'machines',  oreCost: 20, powerKw: -36.0,metricAccent: '#ffc13d', hotkey: '6' },
  { id: 'relay-pylon',     name: 'Relay Pylon',      category: 'machines',   oreCost: 8,  powerKw: 0.0,  metricAccent: '#ffffff', hotkey: '7' },
  { id: 'foundation-1x1',  name: 'Steel Frame (4m)', category: 'structures', oreCost: 6,  powerKw: 0.0,  metricAccent: '#8fa8c8', hotkey: '1' },
  { id: 'hardpoint-2x2',   name: 'Heavy Pad (8m)',   category: 'structures', oreCost: 24, powerKw: 0.0,  metricAccent: '#ffc13d', hotkey: '2' },
  { id: 'linked-bin',      name: 'Linked Lattice Bin',category: 'structures',oreCost: 12, powerKw: 0.5,  metricAccent: '#b46bff', hotkey: '3' },
  { id: 'vehicle-bay',     name: 'Vehicle Fabricator',category: 'heavy',     oreCost: 40, salvageCost: 4, powerKw: 10.0, metricAccent: '#ffc13d', hotkey: '1' },
  { id: 'heavy-shape',     name: 'Heavy Shape Press', category: 'heavy',     oreCost: 60, salvageCost: 6, powerKw: 18.0, metricAccent: '#7cff4d', hotkey: '2' },
  { id: 'heavy-light',     name: 'Heavy Light Proj.', category: 'heavy',     oreCost: 60, salvageCost: 6, powerKw: 20.0, metricAccent: '#ffc13d', hotkey: '3' },
  { id: 'heavy-water',     name: 'Heavy Water Maker', category: 'heavy',     oreCost: 65, salvageCost: 6, powerKw: 22.0, metricAccent: '#3dc8ff', hotkey: '4' },
  { id: 'perimeter-turret',name: 'Perimeter Turret',  category: 'weapons',   oreCost: 18, salvageCost: 2, powerKw: 2.0,  metricAccent: '#ffc13d', hotkey: '1' },
];

export interface BuildRibbonProps {
  isOpen: boolean;
  selectedItemId: string | null;
  isGhostLocked: boolean;
  canPlaceCurrentGhost: boolean;
  cannotPlaceReason?: string;
  pocketOre: number;
  linkedDepotOre: number;
  pocketSalvage: number;
  totalSupplyKw: number;
  totalDemandKw: number;
  onSelectItem: (item: BuildableItemSpec) => void;
  onClose: () => void;
}

export const BuildRibbon: React.FC<BuildRibbonProps> = ({
  isOpen,
  selectedItemId,
  isGhostLocked,
  canPlaceCurrentGhost,
  cannotPlaceReason = 'Needs Flat Ground or Foundation Socket',
  pocketOre,
  linkedDepotOre,
  pocketSalvage,
  totalSupplyKw,
  totalDemandKw,
  onSelectItem,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<BuildCategory>('machines');

  const totalAvailableOre = pocketOre + linkedDepotOre;
  const filteredItems = CANONICAL_BUILD_ITEMS.filter((i) => i.category === activeCategory);
  const isBrownout = totalDemandKw > totalSupplyKw;

  return (
    <>
      {/* 1. Center Crosshair Build Hint (Only renders when a build ghost is active — fixes 07-moon-stage0.jpg) */}
      {selectedItemId && !canPlaceCurrentGhost && (
        <div
          data-hud-zone="build-hint"
          className="hud-card"
          style={{
            borderColor: '#ff3d8a',
            color: '#ff3d8a',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          CANNOT PLACE // {cannotPlaceReason.toUpperCase()}
        </div>
      )}

      {/* 2. Bottom-Docked 136px Build Ribbon (Leaves top 78% of 3D viewport completely clear!) */}
      {isOpen && (
        <div data-hud-zone="build-ribbon" className="hud-card">
          {/* Header Row: Category Tabs + Linked Lattice Ore & 12kW Grid Telemetry */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['machines', 'structures', 'heavy', 'weapons'] as BuildCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    background: activeCategory === cat ? 'var(--hud-accent)' : 'transparent',
                    color: activeCategory === cat ? '#050608' : 'var(--hud-text)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 'var(--hud-radius)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--hud-text-dim)' }}>
              <span>
                ORE: <strong style={{ color: 'var(--hud-text)' }}>{pocketOre}</strong>{' '}
                {linkedDepotOre > 0 && <span style={{ color: '#b46bff' }}>(+{linkedDepotOre} Linked)</span>}
              </span>
              <span>
                SALVAGE: <strong style={{ color: '#3dc8ff' }}>{pocketSalvage}</strong>
              </span>
              <span style={{ color: isBrownout ? '#ff3d8a' : '#7cff4d' }}>
                GRID: {totalDemandKw.toFixed(1)} / {totalSupplyKw.toFixed(1)} kW
                {isBrownout ? ' [BROWNOUT]' : ''}
              </span>
            </div>
          </div>

          {/* Middle Row: Horizontal Compact Item Cards */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0' }}>
            {filteredItems.map((item) => {
              const affordable =
                totalAvailableOre >= item.oreCost &&
                pocketSalvage >= (item.salvageCost ?? 0);
              const isSelected = selectedItemId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  style={{
                    minWidth: 118,
                    padding: '6px 8px',
                    textAlign: 'left',
                    cursor: affordable ? 'pointer' : 'not-allowed',
                    opacity: affordable ? 1 : 0.48,
                    background: isSelected ? 'rgba(255, 193, 61, 0.18)' : 'var(--hud-bg-elevated)',
                    border: `1px solid ${isSelected ? item.metricAccent : 'rgba(255,255,255,0.14)'}`,
                    borderLeft: `3px solid ${item.metricAccent}`,
                    borderRadius: 'var(--hud-radius)',
                    color: 'var(--hud-text)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--hud-text-dim)' }}>
                    <span>[{item.hotkey}]</span>
                    <span>{item.powerKw < 0 ? `+${Math.abs(item.powerKw)}kW` : `${item.powerKw}kW`}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 2, color: affordable ? 'var(--hud-text-dim)' : '#ff3d8a' }}>
                    {item.oreCost} Ore {item.salvageCost ? `+ ${item.salvageCost} Salv` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Keybind Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--hud-text-dim)' }}>
            <span>
              [LMB] Place &bull; [R] Rotate 45&deg; &bull;{' '}
              <strong style={{ color: isGhostLocked ? '#7cff4d' : 'var(--hud-text)' }}>
                [H] {isGhostLocked ? 'Ghost Locked (Arrows to Nudge 0.5m)' : 'Lock Ghost & Nudge'}
              </strong>{' '}
              &bull; [F] Demolish (100% Refund)
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--hud-accent)', cursor: 'pointer', fontSize: 10 }}
            >
              [B / Esc] Close Drawer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
