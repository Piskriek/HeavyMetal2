import React, { useEffect } from 'react';
import type { BaseWorld, WorldEnv, Point } from '../world';
import { networkAt } from '../world';
import { ITEMS, QUEUE_MAX, RECIPE_BY_ID, RECIPES } from '../catalog';
import * as L from '@hm/lattice';
import { CheckCircle2, Clock, Factory, Flame, Layers, PackageCheck, Play, X } from 'lucide-react';
import { ItemGlyph } from './item-glyph';
import { toItemView } from '../world-view';

export interface RefineryModalProps {
  machineId: number;
  world: BaseWorld;
  env: WorldEnv;
  at: Point;
  onCraft: (machineId: number, recipeId: string) => void;
  onCollect: (machineId: number) => void;
  onClose: () => void;
}

export const RefineryModal: React.FC<RefineryModalProps> = ({
  machineId,
  world,
  env,
  at,
  onCraft,
  onCollect,
  onClose,
}) => {
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

  const isMill = machine.kind === 'mill';
  const machineTitle = isMill ? 'HEAVY TEXTURE MILL' : 'HEAVY HYDRAULIC PRESS';
  const machineSubtitle = isMill
    ? 'Synthesizes Raw Pixels (mono & chroma) into planetary Texture Maps'
    : 'Compresses Raw Vertices (rough & fine) into architectural Primitives';
  const accentColor = isMill ? '#ff4fd8' : '#7dd3fc';
  const MachineIcon = isMill ? Flame : Layers;

  const machineRecipes = RECIPES.filter((r) => r.machine === machine.kind);
  const queueFull = machine.jobs.length >= QUEUE_MAX;
  const runningJob = machine.jobs[0] ?? null;
  const waitingJobs = machine.jobs.slice(1);

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="refinery-modal">
      <div
        className="hm-window-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 880, maxWidth: 980 }}
      >
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <MachineIcon size={22} style={{ color: accentColor, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{machineTitle}</span>
                <span className="hm-range-badge in" style={{ fontFamily: 'monospace' }}>
                  HARDPOINT #{machineId}
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
                  {runningJob ? 'OPERATIONAL' : 'STANDBY'}
                </span>
              </div>
              <span className="hm-window-subtitle">{machineSubtitle}</span>
            </div>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="refinery-close-btn">
            <X size={14} /> ESC
          </button>
        </div>

        {/* Content Layout: 2 Columns (Recipes on Left, Queue & Out on Right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.9fr',
            gap: 20,
            padding: 20,
            overflowY: 'auto',
            maxHeight: 'calc(82vh - 120px)',
          }}
        >
          {/* Left Column: Recipes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontFamily: "'Oxanium', monospace, sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--base-cyan)',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Factory size={14} />
              Refining Recipes ({machineRecipes.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {machineRecipes.map((r) => {
                const outSpec = ITEMS[r.output.item];
                const inputItems = r.inputs.map((inp) => {
                  const have = getItemCount(inp.item);
                  const ok = have >= inp.n;
                  const spec = ITEMS[inp.item];
                  return {
                    id: inp.item,
                    name: spec?.name ?? inp.item,
                    tint: spec?.tint ?? '#94a3b8',
                    have,
                    need: inp.n,
                    ok,
                  };
                });

                const canAfford = inputItems.every((inp) => inp.ok);
                const canQueue = canAfford && !queueFull;

                return (
                  <div
                    key={r.id}
                    className="hm-recipe-card"
                    style={{
                      background: 'var(--base-bg-surface)',
                      border: '1px solid var(--base-border-subtle)',
                      borderRadius: 'var(--base-radius-md)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Top row: Output & duration */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ItemGlyph
                          item={toItemView(r.output.item)}
                          size={24}
                        />
                        <div>
                          <div
                            style={{
                              fontFamily: "'Oxanium', monospace, sans-serif",
                              fontWeight: 700,
                              fontSize: 13,
                              color: 'var(--base-text-primary)',
                            }}
                          >
                            {outSpec?.name ?? r.output.item}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                            Yields {r.output.n}x refined item
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          color: '#facc15',
                          background: 'rgba(250, 204, 21, 0.1)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px solid rgba(250, 204, 21, 0.2)',
                          fontFamily: "'Oxanium', monospace, sans-serif",
                        }}
                      >
                        <Clock size={12} />
                        {r.seconds}s
                      </div>
                    </div>

                    {/* Inputs row */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {inputItems.map((inp) => (
                        <div
                          key={inp.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'rgba(0, 0, 0, 0.35)',
                            border: `1px solid ${inp.ok ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.3)'}`,
                            fontSize: 11,
                          }}
                        >
                          <ItemGlyph item={toItemView(inp.id)} size={14} />
                          <span style={{ color: 'var(--base-text-secondary)' }}>{inp.name}</span>
                          <strong
                            style={{
                              fontFamily: "'Oxanium', monospace, sans-serif",
                              color: inp.ok ? '#22c55e' : '#ef4444',
                            }}
                          >
                            {inp.have}/{inp.need}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {/* Action button */}
                    <button
                      className="hm-primary-btn"
                      onClick={() => onCraft(machineId, r.id)}
                      disabled={!canQueue}
                      data-testid={`queue-btn-${r.id}`}
                      style={{
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: canQueue ? 'var(--base-cyan)' : 'rgba(255, 255, 255, 0.05)',
                        color: canQueue ? '#070c14' : 'var(--base-text-muted)',
                        cursor: canQueue ? 'pointer' : 'not-allowed',
                        border: 'none',
                        borderRadius: 'var(--base-radius-sm)',
                        fontWeight: 700,
                        fontFamily: "'Oxanium', monospace, sans-serif",
                        fontSize: 11,
                        letterSpacing: 0.5,
                      }}
                    >
                      <Play size={12} />
                      {queueFull
                        ? 'QUEUE FULL'
                        : canAfford
                          ? 'QUEUE REFINEMENT'
                          : 'INSUFFICIENT INPUTS'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Queue & Collection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Queue Box */}
            <div
              style={{
                background: 'var(--base-bg-surface)',
                border: '1px solid var(--base-border-subtle)',
                borderRadius: 'var(--base-radius-md)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Oxanium', monospace, sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--base-cyan)',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Clock size={14} />
                  Queue Status
                </div>
                <span
                  style={{
                    fontFamily: "'Oxanium', monospace, sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    color: queueFull ? '#facc15' : 'var(--base-text-muted)',
                  }}
                >
                  {machine.jobs.length} / {QUEUE_MAX}
                </span>
              </div>

              {runningJob ? (
                (() => {
                  const rec = RECIPE_BY_ID[runningJob.recipe];
                  const totalSec = rec?.seconds ?? 30;
                  const pct = Math.min(100, Math.round((runningJob.done / totalSec) * 100));
                  const left = Math.max(0, totalSec - runningJob.done).toFixed(1);
                  const outName = ITEMS[rec?.output.item ?? '']?.name ?? runningJob.recipe;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--base-text-primary)' }}>
                          Processing: {outName}
                        </span>
                        <span style={{ color: '#22c55e', fontFamily: "'Oxanium', monospace, sans-serif" }}>
                          {pct}% ({left}s)
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div
                        style={{
                          width: '100%',
                          height: 8,
                          background: 'rgba(0,0,0,0.4)',
                          borderRadius: 4,
                          overflow: 'hidden',
                          border: '1px solid var(--base-border-subtle)',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${accentColor}, var(--base-cyan))`,
                            transition: 'width 0.1s linear',
                          }}
                        />
                      </div>

                      {/* Waiting list */}
                      {waitingJobs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                          <div style={{ fontSize: 10, color: 'var(--base-text-muted)', textTransform: 'uppercase' }}>
                            Next in line:
                          </div>
                          {waitingJobs.map((j, idx) => {
                            const r = RECIPE_BY_ID[j.recipe];
                            const name = ITEMS[r?.output.item ?? '']?.name ?? j.recipe;
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  background: 'rgba(0, 0, 0, 0.25)',
                                  fontSize: 11,
                                  color: 'var(--base-text-secondary)',
                                }}
                              >
                                <span>#{idx + 2} {name}</span>
                                <span style={{ fontFamily: "'Oxanium', monospace, sans-serif", color: 'var(--base-text-muted)' }}>
                                  {r?.seconds}s
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div style={{ fontSize: 12, color: 'var(--base-text-muted)', padding: '12px 0', textAlign: 'center' }}>
                  Queue is currently idle. Queue a recipe on the left to start processing.
                </div>
              )}
            </div>

            {/* Output Collection Hopper */}
            <div
              style={{
                background: 'var(--base-bg-surface)',
                border: '1px solid var(--base-border-subtle)',
                borderRadius: 'var(--base-radius-md)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "'Oxanium', monospace, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--base-cyan)',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <PackageCheck size={14} />
                Refinery Output Hopper
              </div>

              {machine.out.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {machine.out.map((stack, idx) => {
                      const spec = ITEMS[stack.item];
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: 4,
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ItemGlyph item={toItemView(stack.item)} size={18} />
                            <span style={{ fontSize: 12, color: 'var(--base-text-primary)', fontWeight: 600 }}>
                              {spec?.name ?? stack.item}
                            </span>
                          </div>
                          <span
                            style={{
                              fontFamily: "'Oxanium', monospace, sans-serif",
                              fontWeight: 700,
                              color: '#22c55e',
                              fontSize: 13,
                            }}
                          >
                            x{stack.n}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className="hm-primary-btn"
                    onClick={() => onCollect(machineId)}
                    data-testid="refinery-collect-btn"
                    style={{
                      marginTop: 4,
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: '#22c55e',
                      color: '#070c14',
                      border: 'none',
                      borderRadius: 'var(--base-radius-sm)',
                      fontWeight: 700,
                      fontFamily: "'Oxanium', monospace, sans-serif",
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={14} />
                    COLLECT FINISHED ITEMS
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--base-text-muted)', lineHeight: 1.4 }}>
                  Hopper empty. Finished goods are deposited automatically into linked network storage bins.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
