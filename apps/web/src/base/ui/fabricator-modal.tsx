import React, { useEffect, useState } from 'react';
import type { BaseWorld, WorldEnv, Point } from '../world';
import { networkAt } from '../world';
import { VEHICLES, VEHICLE, RECIPE_BY_ID, type VehicleKind } from '../catalog';
import * as L from '@hm/lattice';
import { Bot, Clock, Play, ShieldAlert, Truck, Users, X } from 'lucide-react';
import { ItemGlyph } from './item-glyph';
import { toItemView } from '../world-view';

export interface FabricatorModalProps {
  machineId: number;
  world: BaseWorld;
  env: WorldEnv;
  at: Point;
  onCraft: (machineId: number, recipeId: string) => void;
  onClose: () => void;
}

export const FabricatorModal: React.FC<FabricatorModalProps> = ({
  machineId,
  world,
  env,
  at,
  onCraft,
  onClose,
}) => {
  const [selectedKind, setSelectedKind] = useState<VehicleKind>('scout');

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

  const machine = world.machines.find((x) => x.id === machineId);
  if (!machine) return null;

  const netIds = networkAt(world, env, at);

  const getItemCount = (itemId: string): number => {
    const invCount = L.count(world.player, itemId);
    const netCount = L.totals(world.boxes, netIds)[itemId] ?? 0;
    return invCount + netCount;
  };

  const runningJob = machine.jobs[0] ?? null;
  const runningRecipe = runningJob ? RECIPE_BY_ID[runningJob.recipe] : null;
  const printProgress = runningJob && runningRecipe ? Math.min(1, runningJob.done / runningRecipe.seconds) : 0;
  const printTimeLeft = runningJob && runningRecipe ? Math.max(0, Math.ceil(runningRecipe.seconds - runningJob.done)) : 0;

  const selectedSpec = VEHICLE[selectedKind];
  const recipeId = `vehicle-${selectedKind}`;
  const isLocked = selectedSpec.stage > world.stage;

  const canAfford = !isLocked && selectedSpec.bill.every((b) => getItemCount(b.item) >= b.n);
  const queueFull = machine.jobs.length >= 1; // 1 rover print at a time on the pad

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="fabricator-modal">
      <div
        className="hm-window-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 920, maxWidth: 1040 }}
      >
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <Truck size={22} style={{ color: 'var(--base-cyan)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>VEHICLE FABRICATOR</span>
                <span className="hm-range-badge in" style={{ fontFamily: 'monospace' }}>
                  PAD #{machineId}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "'Oxanium', monospace, sans-serif",
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: runningJob ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                    color: runningJob ? '#22c55e' : '#94a3b8',
                    border: `1px solid ${runningJob ? '#22c55e40' : '#94a3b840'}`,
                  }}
                >
                  {runningJob ? 'PRINTING ROVER' : 'FABRICATION READY'}
                </span>
              </div>
              <span className="hm-window-subtitle">
                Automated surface rover printer using linked storage materials and relay power
              </span>
            </div>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="fabricator-close-btn">
            <X size={14} /> ESC
          </button>
        </div>

        {/* Printing Active Bar */}
        {runningJob && runningRecipe && (
          <div
            style={{
              padding: '12px 18px',
              margin: '0 20px 14px',
              background: 'rgba(14, 165, 233, 0.08)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
            data-testid="fabricator-progress-panel"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} style={{ color: 'var(--base-cyan)', animation: 'spin 4s linear infinite' }} />
                <span style={{ fontFamily: "'Oxanium', monospace", fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                  PRINTING IN PROGRESS: {runningRecipe.output.item.toUpperCase()}
                </span>
              </div>
              <span style={{ fontFamily: "'Oxanium', monospace", fontSize: 12, color: 'var(--base-cyan)' }}>
                {Math.round(printProgress * 100)}% · {printTimeLeft}s REMAINING
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: 'rgba(15, 23, 42, 0.8)',
                borderRadius: 4,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${printProgress * 100}%`,
                  background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
                  transition: 'width 0.2s ease-out',
                }}
              />
            </div>
          </div>
        )}

        {/* Content Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 18, padding: '0 20px 18px' }}>
          {/* Rover Selection Cards */}
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
              AVAILABLE ROVER SCHEMATICS
            </span>

            {VEHICLES.map((kind) => {
              const spec = VEHICLE[kind];
              const locked = spec.stage > world.stage;
              const isSelected = selectedKind === kind;

              return (
                <div
                  key={kind}
                  onClick={() => setSelectedKind(kind)}
                  data-testid={`rover-card-${kind}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: isSelected
                      ? 'rgba(14, 165, 233, 0.14)'
                      : 'rgba(15, 23, 42, 0.65)',
                    border: `1px solid ${
                      isSelected
                        ? 'rgba(56, 189, 248, 0.6)'
                        : locked
                          ? 'rgba(148, 163, 184, 0.15)'
                          : 'rgba(255, 255, 255, 0.08)'
                    }`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontFamily: "'Oxanium', monospace",
                          fontSize: 15,
                          fontWeight: 700,
                          color: locked ? '#94a3b8' : '#f8fafc',
                        }}
                      >
                        {spec.name.toUpperCase()}
                      </span>
                      {spec.cargo && (
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "'Oxanium', monospace",
                            background: 'rgba(168, 85, 247, 0.2)',
                            color: '#c084fc',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          LINKED CARGO
                        </span>
                      )}
                    </div>
                    {locked ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "'Oxanium', monospace",
                          color: '#ef4444',
                          fontWeight: 600,
                        }}
                      >
                        Opens at stage {spec.stage} (the plot is at stage {world.stage})
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontFamily: "'Oxanium', monospace", color: '#22c55e' }}>
                        UNLOCKED (STAGE {spec.stage})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#94a3b8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} style={{ color: 'var(--base-cyan)' }} />
                      {spec.seats} {spec.seats === 1 ? 'Seat' : 'Seats'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} style={{ color: 'var(--base-cyan)' }} />
                      {spec.seconds}s Print
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Bot size={12} style={{ color: 'var(--base-cyan)' }} />
                      {kind === 'scout' ? 'Light Arcade' : kind === 'hauler' ? '6-Wheel Transport' : '8-Track Heavy'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Schematic & Bill */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "'Oxanium', monospace",
                      fontSize: 18,
                      fontWeight: 700,
                      color: isLocked ? '#94a3b8' : '#38bdf8',
                    }}
                  >
                    {selectedSpec.name} Rover Specification
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    {selectedKind === 'scout'
                      ? 'Agile exploration chassis with 4 high-torque wheels for rapid scouting.'
                      : selectedKind === 'hauler'
                        ? 'Long-wheelbase 6x6 transport rover with an integrated quantum link cargo bin.'
                        : 'Heavy all-terrain crawler equipped with heavy track assemblies and drilling mast.'}
                  </p>
                </div>
              </div>

              {isLocked ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  data-testid="rover-locked-notice"
                >
                  <ShieldAlert size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span>
                    Opens at stage {selectedSpec.stage} (the plot is at stage {world.stage}). Raise planetary fidelity to print this rover.
                  </span>
                </div>
              ) : (
                <>
                  <span
                    style={{
                      fontFamily: "'Oxanium', monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--base-cyan)',
                      letterSpacing: '0.08em',
                      display: 'block',
                      marginBottom: 8,
                    }}
                  >
                    REQUIRED REQUISITIONS (LINKED NETWORK)
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedSpec.bill.map((b) => {
                      const itemView = toItemView(b.item);
                      const have = getItemCount(b.item);
                      const hasEnough = have >= b.n;

                      return (
                        <div
                          key={b.item}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: hasEnough ? 'rgba(30, 41, 59, 0.6)' : 'rgba(239, 68, 68, 0.08)',
                            border: `1px solid ${hasEnough ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.25)'}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ItemGlyph item={itemView} size={20} />
                            <span style={{ fontSize: 13, color: '#f8fafc' }}>{itemView.name}</span>
                          </div>
                          <span
                            style={{
                              fontFamily: "'Oxanium', monospace",
                              fontSize: 12,
                              fontWeight: 700,
                              color: hasEnough ? '#22c55e' : '#ef4444',
                            }}
                          >
                            {have} / {b.n}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Print Action Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                className="hm-primary-btn"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontFamily: "'Oxanium', monospace",
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: canAfford && !queueFull ? 1 : 0.45,
                  cursor: canAfford && !queueFull ? 'pointer' : 'not-allowed',
                }}
                disabled={!canAfford || queueFull}
                onClick={() => {
                  if (canAfford && !queueFull) {
                    onCraft(machineId, recipeId);
                  }
                }}
                data-testid={`print-btn-${selectedKind}`}
              >
                <Play size={16} />
                {queueFull
                  ? 'FABRICATION BAY BUSY'
                  : isLocked
                    ? `OPENS AT STAGE ${selectedSpec.stage}`
                    : canAfford
                      ? `PRINT ${selectedSpec.name.toUpperCase()} ROVER`
                      : 'INSUFFICIENT MATERIALS'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
