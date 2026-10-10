import React, { useEffect, useState } from 'react';
import type { BaseWorld, WorldEnv, Point } from '../world';
import { networkAt } from '../world';
import { FORGE, FORGE_BY_ID, PART_SLOTS, WEAPON_FRAME, type PartSlot } from '../catalog';
import { weaponStats, type WeaponStats } from '../weapons';
import * as L from '@hm/lattice';
import { Check, ChevronRight, Crosshair, Flame, Hammer, ShieldAlert, Sparkles, Wrench, X, Zap } from 'lucide-react';
import { toItemView } from '../world-view';

export interface WeaponBenchModalProps {
  world: BaseWorld;
  env: WorldEnv;
  at: Point;
  onForge: (item: string) => void;
  onFit: (slot: PartSlot, item: string | null) => void;
  onClose: () => void;
}

const SLOT_ICONS: Record<PartSlot, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  core: Flame,
  barrel: Zap,
  sight: Crosshair,
  cell: Sparkles,
};

const SLOT_TITLES: Record<PartSlot, string> = {
  core: 'FIRING CORE',
  barrel: 'ACCELERATOR BARREL',
  sight: 'TARGETING OPTICS',
  cell: 'PLASMA POWER CELL',
};

export const WeaponBenchModal: React.FC<WeaponBenchModalProps> = ({
  world,
  env,
  at,
  onForge,
  onFit,
  onClose,
}) => {
  const [activeSlot, setActiveSlot] = useState<PartSlot>('core');
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const netIds = networkAt(world, env, at);

  const getItemCount = (itemId: string): number => {
    const invCount = L.count(world.player, itemId);
    const netCount = L.totals(world.boxes, netIds)[itemId] ?? 0;
    return invCount + netCount;
  };

  const getCarriedCount = (itemId: string): number => {
    return L.count(world.player, itemId);
  };

  const currentStats = weaponStats(world.loadout);

  const effectiveLoadout = hoveredPart && FORGE_BY_ID[hoveredPart]?.slot
    ? { ...world.loadout, [FORGE_BY_ID[hoveredPart]!.slot!]: hoveredPart }
    : world.loadout;
  const previewStats = weaponStats(effectiveLoadout);

  const slotParts = FORGE.filter((f) => f.slot === activeSlot);

  const fireRate = (stats: WeaponStats | null): number => {
    if (!stats) return 0;
    if (stats.mode === 'beam') return Math.round((1 / stats.cooldown) * 10) / 10;
    const cycleTime = stats.cooldown + (stats.burst - 1) * stats.burstGap;
    return Math.round((stats.burst / cycleTime) * 10) / 10;
  };

  const renderDelta = (currVal: number, prevVal: number, unit = '', invert = false) => {
    const diff = Math.round((prevVal - currVal) * 100) / 100;
    if (diff === 0 || !hoveredPart) return null;
    const isGood = invert ? diff < 0 : diff > 0;
    return (
      <span
        style={{
          fontSize: 11,
          fontFamily: "'Oxanium', monospace",
          fontWeight: 700,
          color: isGood ? '#22c55e' : '#ef4444',
          marginLeft: 6,
        }}
      >
        {diff > 0 ? `+${diff}` : diff} {unit}
      </span>
    );
  };

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="weapon-bench-modal">
      <div
        className="hm-window-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 980, maxWidth: 1080 }}
      >
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <Wrench size={22} style={{ color: 'var(--base-cyan)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>WEAPON BENCH MODDING SUITE</span>
                <span className="hm-range-badge in" style={{ fontFamily: 'monospace' }}>
                  BENCH ACTIVE
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "'Oxanium', monospace, sans-serif",
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: currentStats ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: currentStats ? '#22c55e' : '#ef4444',
                    border: `1px solid ${currentStats ? '#22c55e40' : '#ef444440'}`,
                  }}
                >
                  {currentStats ? `${currentStats.mode.toUpperCase()} CONFIGURED` : 'LOADOUT INCOMPLETE'}
                </span>
              </div>
              <span className="hm-window-subtitle">
                Forge modular firearm frames and field components from raw primitives and planetary texture maps
              </span>
            </div>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="weapon-bench-close-btn">
            <X size={14} /> ESC
          </button>
        </div>

        {/* 3-Column Layout: Slots, Parts List, Stats Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: 16, padding: '0 20px 20px' }}>
          {/* Column 1: Frame & 4 Slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              style={{
                fontFamily: "'Oxanium', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--base-cyan)',
                letterSpacing: '0.08em',
              }}
            >
              WEAPON FRAME SLOTS
            </span>

            {PART_SLOTS.map((slotKey) => {
              const fittedId = world.loadout[slotKey];
              const fittedSpec = fittedId ? FORGE_BY_ID[fittedId] : null;
              const isSelected = activeSlot === slotKey;
              const Icon = SLOT_ICONS[slotKey];

              return (
                <div
                  key={slotKey}
                  onClick={() => {
                    setActiveSlot(slotKey);
                    setHoveredPart(null);
                  }}
                  data-testid={`slot-tab-${slotKey}`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: isSelected ? 'rgba(14, 165, 233, 0.16)' : 'rgba(15, 23, 42, 0.65)',
                    border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.08)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={16} style={{ color: isSelected ? 'var(--base-cyan)' : '#94a3b8' }} />
                      <span
                        style={{
                          fontFamily: "'Oxanium', monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#f8fafc',
                        }}
                      >
                        {slotKey.toUpperCase()}
                      </span>
                    </div>
                    <ChevronRight size={14} style={{ color: isSelected ? 'var(--base-cyan)' : '#475569' }} />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: fittedSpec ? '#38bdf8' : '#ef4444',
                      fontWeight: fittedSpec ? 600 : 400,
                    }}
                  >
                    {fittedSpec ? fittedSpec.name : 'EMPTY (Cannot Fire)'}
                  </span>
                </div>
              );
            })}

            {/* Weapon Frame craft option */}
            <div
              style={{
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Oxanium', monospace", fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                  BASE FRAME
                </span>
                <span style={{ fontSize: 10, color: '#22c55e' }}>STAGE 1</span>
              </div>
              <span style={{ fontSize: 11, color: '#f8fafc' }}>Modular Weapon Chassis</span>
              <button
                className="hm-primary-btn"
                style={{ padding: '6px 10px', fontSize: 11 }}
                onClick={() => onForge(WEAPON_FRAME)}
                disabled={!FORGE_BY_ID[WEAPON_FRAME]?.bill.every((b) => getItemCount(b.item) >= b.n)}
                data-testid="forge-frame-btn"
              >
                FORGE FRAME
              </button>
            </div>
          </div>

          {/* Column 2: Parts for Active Slot */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              style={{
                fontFamily: "'Oxanium', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--base-cyan)',
                letterSpacing: '0.08em',
              }}
            >
              {SLOT_TITLES[activeSlot]} COMPONENTS
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 420 }}>
              {slotParts.map((part) => {
                const isLocked = part.stage > world.stage;
                const isFitted = world.loadout[activeSlot] === part.id;
                const isHovered = hoveredPart === part.id;
                const carried = getCarriedCount(part.id);
                const canAfford = !isLocked && part.bill.every((b) => getItemCount(b.item) >= b.n);

                return (
                  <div
                    key={part.id}
                    onMouseEnter={() => setHoveredPart(part.id)}
                    data-testid={`part-card-${part.id}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: isHovered
                        ? 'rgba(14, 165, 233, 0.12)'
                        : isFitted
                          ? 'rgba(34, 197, 94, 0.08)'
                          : 'rgba(15, 23, 42, 0.65)',
                      border: `1px solid ${
                        isHovered
                          ? 'rgba(56, 189, 248, 0.5)'
                          : isFitted
                            ? 'rgba(34, 197, 94, 0.4)'
                            : isLocked
                              ? 'rgba(148, 163, 184, 0.12)'
                              : 'rgba(255, 255, 255, 0.08)'
                      }`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontFamily: "'Oxanium', monospace",
                            fontSize: 14,
                            fontWeight: 700,
                            color: isLocked ? '#94a3b8' : '#f8fafc',
                          }}
                        >
                          {part.name}
                        </span>
                        {isFitted && (
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "'Oxanium', monospace",
                              background: 'rgba(34, 197, 94, 0.2)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.4)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            EQUIPPED
                          </span>
                        )}
                        {carried > 0 && !isFitted && (
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "'Oxanium', monospace",
                              background: 'rgba(56, 189, 248, 0.2)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            IN PACK ({carried})
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "'Oxanium', monospace",
                          color: isLocked ? '#ef4444' : '#22c55e',
                          fontWeight: 600,
                        }}
                      >
                        {isLocked ? `OPENS AT STAGE ${part.stage}` : `STAGE ${part.stage}`}
                      </span>
                    </div>

                    {/* Cost requisition line */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11 }}>
                      {part.bill.map((b) => {
                        const have = getItemCount(b.item);
                        const hasEnough = have >= b.n;
                        const itemView = toItemView(b.item);
                        return (
                          <span
                            key={b.item}
                            style={{
                              color: hasEnough ? '#94a3b8' : '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'rgba(0, 0, 0, 0.3)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {itemView.name}: {have}/{b.n}
                          </span>
                        );
                      })}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        className="hm-primary-btn"
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          opacity: canAfford ? 1 : 0.45,
                          cursor: canAfford ? 'pointer' : 'not-allowed',
                        }}
                        disabled={!canAfford}
                        onClick={() => onForge(part.id)}
                        data-testid={`forge-btn-${part.id}`}
                      >
                        <Hammer size={13} />
                        FORGE ({part.bill[0]?.n ?? 0} ORE)
                      </button>

                      {carried > 0 && !isFitted && (
                        <button
                          className="hm-secondary-btn"
                          style={{
                            padding: '6px 14px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            background: 'rgba(34, 197, 94, 0.15)',
                            borderColor: 'rgba(34, 197, 94, 0.4)',
                            color: '#22c55e',
                          }}
                          onClick={() => onFit(activeSlot, part.id)}
                          data-testid={`fit-btn-${part.id}`}
                        >
                          <Check size={13} />
                          FIT TO FRAME
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 3: Stats Telemetry Bars & Diff */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: "'Oxanium', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--base-cyan)',
                  letterSpacing: '0.08em',
                  display: 'block',
                  marginBottom: 10,
                }}
              >
                WEAPON PERFORMANCE TELEMETRY
              </span>

              {previewStats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Mode */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>FIRE MODE</span>
                      <span style={{ fontFamily: "'Oxanium', monospace", fontWeight: 700, color: '#f8fafc' }}>
                        {previewStats.mode.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Damage */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>DAMAGE PER HIT</span>
                      <span style={{ fontFamily: "'Oxanium', monospace", fontWeight: 700, color: '#f8fafc' }}>
                        {previewStats.damage[0]} - {previewStats.damage[1]}
                        {previewStats.pellets > 1 ? ` (x${previewStats.pellets})` : ''}
                        {currentStats && renderDelta(currentStats.damage[0], previewStats.damage[0])}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (previewStats.damage[1] * previewStats.pellets) / 2)}%`,
                          background: '#f59e0b',
                        }}
                      />
                    </div>
                  </div>

                  {/* Fire Rate */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>CYCLIC FIRE RATE</span>
                      <span style={{ fontFamily: "'Oxanium', monospace", fontWeight: 700, color: '#f8fafc' }}>
                        {fireRate(previewStats)} /s
                        {currentStats && renderDelta(fireRate(currentStats), fireRate(previewStats), '/s')}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, fireRate(previewStats) * 10)}%`,
                          background: '#38bdf8',
                        }}
                      />
                    </div>
                  </div>

                  {/* Spread */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>ACCURACY SPREAD</span>
                      <span style={{ fontFamily: "'Oxanium', monospace", fontWeight: 700, color: '#f8fafc' }}>
                        {previewStats.mode === 'beam' ? '0.0° (PINPOINT)' : `${(previewStats.spread * (180 / Math.PI)).toFixed(1)}°`}
                        {currentStats && renderDelta(currentStats.spread, previewStats.spread, 'rad', true)}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(10, 100 - previewStats.spread * 1200)}%`,
                          background: '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  {/* Range */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>EFFECTIVE RANGE</span>
                      <span style={{ fontFamily: "'Oxanium', monospace", fontWeight: 700, color: '#f8fafc' }}>
                        {previewStats.range}m
                        {currentStats && renderDelta(currentStats.range, previewStats.range, 'm')}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (previewStats.range / 100) * 100)}%`,
                          background: '#a855f7',
                        }}
                      />
                    </div>
                  </div>

                  {/* Zoom */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>OPTICAL MAGNIFICATION</span>
                      <span style={{ fontFamily: "'Oxanium', monospace", fontWeight: 700, color: '#f8fafc' }}>
                        {previewStats.zoom}x
                        {currentStats && renderDelta(currentStats.zoom, previewStats.zoom, 'x')}
                      </span>
                    </div>
                  </div>

                  {/* Magazine */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>CELL CAPACITY</span>
                      <span style={{ fontFamily: "'Oxanium', monospace", fontWeight: 700, color: '#f8fafc' }}>
                        {previewStats.magazine} Charges
                        {currentStats && renderDelta(currentStats.magazine, previewStats.magazine)}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (previewStats.magazine / 40) * 100)}%`,
                          background: '#06b6d4',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldAlert size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span>Weapon cannot fire: one or more part slots are unequipped.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
