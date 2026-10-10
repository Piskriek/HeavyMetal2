import React, { useEffect } from 'react';
import type { BaseWorld, WorldEnv, Point } from '../world';
import { networkAt } from '../world';
import { HEAVY, HEAVY_BILL, FABRICATOR_BILL, ITEMS, type StationKind } from '../catalog';
import * as L from '@hm/lattice';
import { Cpu, Droplets, Flame, Layers, SunMedium, Truck, Wrench, X } from 'lucide-react';
import { ItemGlyph } from './item-glyph';
import { toItemView } from '../world-view';

export interface MachinePickerModalProps {
  hardpointId: number;
  world: BaseWorld;
  env: WorldEnv;
  at: Point;
  onInstall: (hardpointId: number, kind: StationKind) => void;
  onClose: () => void;
}

const STATION_KINDS: readonly StationKind[] = ['fabricator', ...HEAVY];

const MACHINE_META: Record<StationKind, {
  name: string;
  role: string;
  desc: string;
  metric: string;
  rate: string;
  draw: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  accentColor: string;
}> = {
  fabricator: {
    name: 'Vehicle Fabricator',
    role: 'Surface Rover Printing Bay',
    desc: 'Prints complete surface exploration and cargo rovers (Scout, Hauler, Crawler) using linked storage.',
    metric: 'Print Bay',
    rate: '1 Rover',
    draw: 'Relay Power',
    icon: Truck,
    accentColor: '#38bdf8',
  },
  mill: {
    name: 'Heavy Texture Mill',
    role: 'Massive Surface Refinement',
    desc: '20x pixel output for 4x power. Refines raw pixels into texture maps.',
    metric: 'Pxd Flow',
    rate: '40 Pxd/s',
    draw: '16 kW',
    icon: Flame,
    accentColor: '#ff4fd8',
  },
  press: {
    name: 'Heavy Hydraulic Press',
    role: 'High-Density Compression',
    desc: '20x vertex output for 4x power. Presses raw vertices into primitives.',
    metric: 'Vtx Flow',
    rate: '40 Vtx/s',
    draw: '16 kW',
    icon: Layers,
    accentColor: '#7dd3fc',
  },
  projector: {
    name: 'Heavy Light Projector',
    role: 'Luminance Atmospheric Array',
    desc: '20x photonic output for 4x power. Illuminates dark plains and drives stage progression.',
    metric: 'Lux Lumens',
    rate: '40 Lux/s',
    draw: '16 kW',
    icon: SunMedium,
    accentColor: '#facc15',
  },
  water: {
    name: 'Heavy Water Synthesizer',
    role: 'Hydro-Atmospheric Generator',
    desc: '20x aqueous output for 4x power. Irrigates ground for lush vegetative stages.',
    metric: 'Aqua Yield',
    rate: '40 Aq/s',
    draw: '16 kW',
    icon: Droplets,
    accentColor: '#38bdf8',
  },
};

export const MachinePickerModal: React.FC<MachinePickerModalProps> = ({
  hardpointId,
  world,
  env,
  at,
  onInstall,
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

  const netIds = networkAt(world, env, at);

  const getItemCount = (itemId: string): number => {
    const invCount = L.count(world.player, itemId);
    const netCount = L.totals(world.boxes, netIds)[itemId] ?? 0;
    return invCount + netCount;
  };

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="machine-picker-modal">
      <div
        className="hm-window-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 860, maxWidth: 960 }}
      >
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <Cpu size={20} style={{ color: 'var(--base-cyan)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>INSTALL HEAVY TERRAFORMER</span>
                <span className="hm-range-badge in" style={{ fontFamily: 'monospace' }}>
                  HARDPOINT #{hardpointId}
                </span>
              </div>
              <span className="hm-window-subtitle">
                Mount a heavy 8-meter industrial terraformer directly to your reinforced hardpoint foundation
              </span>
            </div>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="machine-picker-close-btn">
            <X size={14} /> ESC
          </button>
        </div>

        {/* Machine Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            padding: 20,
            overflowY: 'auto',
            maxHeight: 'calc(80vh - 120px)',
          }}
        >
          {STATION_KINDS.map((kind) => {
            const meta = MACHINE_META[kind];
            const Icon = meta.icon;
            const bill = kind === 'fabricator' ? FABRICATOR_BILL : HEAVY_BILL[kind];

            const billItems = bill.map((b) => {
              const have = getItemCount(b.item);
              const ok = have >= b.n;
              const spec = ITEMS[b.item];
              return {
                id: b.item,
                name: spec?.name ?? b.item,
                tint: spec?.tint ?? '#94a3b8',
                have,
                need: b.n,
                ok,
              };
            });

            const canAfford = billItems.every((b) => b.ok);

            return (
              <div
                key={kind}
                className="hm-machine-card"
                style={{
                  background: 'var(--base-bg-surface)',
                  border: `1px solid ${canAfford ? meta.accentColor + '40' : 'var(--base-border-subtle)'}`,
                  borderRadius: 'var(--base-radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: `${meta.accentColor}20`,
                      border: `1px solid ${meta.accentColor}50`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: meta.accentColor,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'Oxanium', monospace, sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--base-text-primary)',
                      }}
                    >
                      {meta.name}
                    </div>
                    <div style={{ fontSize: 11, color: meta.accentColor, opacity: 0.9 }}>
                      {meta.role}
                    </div>
                  </div>
                </div>

                {/* Description & telemetry tags */}
                <div style={{ fontSize: 12, color: 'var(--base-text-secondary)', lineHeight: 1.4 }}>
                  {meta.desc}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="hm-pill" style={{ fontSize: 10, background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: 4, color: 'var(--base-text-secondary)', border: '1px solid var(--base-border-subtle)' }}>
                    Power: <strong style={{ color: '#facc15' }}>{meta.draw}</strong>
                  </span>
                  <span className="hm-pill" style={{ fontSize: 10, background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: 4, color: 'var(--base-text-secondary)', border: '1px solid var(--base-border-subtle)' }}>
                    Output: <strong style={{ color: meta.accentColor }}>{meta.rate}</strong>
                  </span>
                  <span className="hm-pill" style={{ fontSize: 10, background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: 4, color: 'var(--base-text-secondary)', border: '1px solid var(--base-border-subtle)' }}>
                    Footprint: <strong style={{ color: 'var(--base-cyan)' }}>8m Hardpoint</strong>
                  </span>
                </div>

                {/* Required Materials Bill */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <div
                    style={{
                      fontFamily: "'Oxanium', monospace, sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--base-text-muted)',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    Required Materials (Pack + Network)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {billItems.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: `1px solid ${b.ok ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.25)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ItemGlyph
                            item={toItemView(b.id)}
                            size={16}
                          />
                          <span style={{ fontSize: 12, color: 'var(--base-text-primary)' }}>
                            {b.name}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: "'Oxanium', monospace, sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                            color: b.ok ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {b.have} / {b.need}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Install Button */}
                <button
                  className="hm-primary-btn"
                  onClick={() => onInstall(hardpointId, kind)}
                  disabled={!canAfford}
                  data-testid={`install-btn-${kind}`}
                  style={{
                    marginTop: 'auto',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: canAfford ? 'var(--base-cyan)' : 'rgba(255, 255, 255, 0.05)',
                    color: canAfford ? '#070c14' : 'var(--base-text-muted)',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    border: 'none',
                    borderRadius: 'var(--base-radius-md)',
                    fontWeight: 700,
                    fontFamily: "'Oxanium', monospace, sans-serif",
                    fontSize: 12,
                    letterSpacing: 0.5,
                  }}
                >
                  <Wrench size={14} />
                  {canAfford ? `INSTALL ${kind.toUpperCase()}` : 'MISSING MATERIALS'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
