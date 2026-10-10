import React, { useEffect, useState } from 'react';
import type { BaseView, BaseViewSource } from '../view';
import type { Applied, BaseCommand, BaseWorld, Point } from '../world';
import { Compass, Hammer } from 'lucide-react';
import { Hotbar } from './hotbar';
import { InventoryWindow } from './inventory-window';
import { DraftingWindow } from './drafting-window';
import { LatticeWindow } from './lattice-window';
import { BuildReadout } from './build-readout';

interface BaseHudProps {
  source: BaseViewSource;
  onOpenChange?: (isOpen: boolean) => void;
  paused?: boolean;
  modalOpen?: boolean;
  harvestCounter?: { count: number; name: string; fading?: boolean } | null;
  placedCounter?: { count: number; name: string; fading?: boolean } | null;
  hoverSupport?: { text: string; color: string } | null;
  wheelCycleText?: string | null;
  rotationText?: string | null;
  world?: BaseWorld;
  at?: Point;
  currentStructureId?: number | null;
  planPrompt?: string | null;
  onDispatch?: (cmd: BaseCommand) => Applied | void;
  onPlaceLayout?: (layoutId: string) => void;
  onDropPlan?: (planId: number) => void;
  onToast?: (title: string, sub?: string) => void;
}

export type OpenWindow = 'none' | 'inventory' | 'drafting' | 'lattice';

export const BaseHud: React.FC<BaseHudProps> = ({
  source,
  onOpenChange,
  paused = false,
  modalOpen = false,
  harvestCounter = null,
  placedCounter = null,
  hoverSupport = null,
  wheelCycleText = null,
  rotationText = null,
  world,
  at,
  currentStructureId,
  planPrompt = null,
  onDispatch,
  onPlaceLayout,
  onDropPlan,
  onToast,
}) => {
  const [view, setView] = useState<BaseView>(() => source.get());
  const [openWindow, setOpenWindow] = useState<OpenWindow>('none');

  useEffect(() => {
    const unsubscribe = source.subscribe(() => {
      setView(source.get());
    });
    return unsubscribe;
  }, [source]);

  useEffect(() => {
    onOpenChange?.(openWindow !== 'none');
  }, [openWindow, onOpenChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // Tab or 'I' toggles Inventory
      if (e.key === 'Tab' || e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setOpenWindow((prev) => (prev === 'inventory' ? 'none' : 'inventory'));
        return;
      }

      // 'K' toggles Drafting Table
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpenWindow((prev) => (prev === 'drafting' ? 'none' : 'drafting'));
        return;
      }

      // 'L' toggles Lattice Storage
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setOpenWindow((prev) => (prev === 'lattice' ? 'none' : 'lattice'));
        return;
      }

      // Escape closes open window
      if (e.key === 'Escape' && openWindow !== 'none') {
        e.preventDefault();
        setOpenWindow('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openWindow]);

  return (
    <>
      {/* Reticle Build Readout - hidden when paused or any window/modal is open */}
      {!paused && openWindow === 'none' && !modalOpen && (
        <BuildReadout
          build={view.build}
          hoverSupport={hoverSupport}
          wheelCycleText={wheelCycleText}
          rotationText={rotationText}
        />
      )}

      {/* Plan build prompt (within 8m) */}
      {planPrompt && !paused && openWindow === 'none' && !modalOpen && (
        <div style={{ position: 'absolute', bottom: 130, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <div className="hm-plan-build-prompt" data-testid="plan-build-prompt">
            <Hammer size={14} />
            <span>{planPrompt}</span>
          </div>
        </div>
      )}

      {/* Running harvest counter pill beside hotbar */}
      {harvestCounter && !paused && openWindow === 'none' && !modalOpen && (
        <div className={`hm-harvest-counter${harvestCounter.fading ? ' fading' : ''}`} data-testid="base-harvest-counter">
          <span className="hm-count-pill">+{harvestCounter.count}</span>
          <span className="hm-count-name">{harvestCounter.name}</span>
        </div>
      )}

      {/* Running placed/filled counter pill beside hotbar */}
      {placedCounter && !paused && openWindow === 'none' && !modalOpen && (
        <div
          className={`hm-harvest-counter${placedCounter.fading ? ' fading' : ''}`}
          style={{ bottom: harvestCounter ? 134 : 84 }}
          data-testid="base-placed-counter"
        >
          <span className="hm-count-pill">{placedCounter.count > 0 ? `+${placedCounter.count}` : placedCounter.count}</span>
          <span className="hm-count-name">{placedCounter.name}</span>
        </div>
      )}

      {/* Active plans HUD card */}
      {world && world.plans.length > 0 && !paused && openWindow === 'none' && !modalOpen && (
        <div className="hm-plans-hud-card" data-testid="active-plans-hud">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--base-cyan)', textTransform: 'uppercase' }}>
            <Compass size={12} />
            <span>Active Plans ({world.plans.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {world.plans.map((p) => {
              const layout = world.layouts.find((l) => l.id === p.layout);
              const label = layout?.name ?? `Plan #${p.id}`;
              return (
                <div key={p.id} className="hm-plan-item-row" data-testid={`plan-hud-item-${p.id}`}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontFamily: 'Oxanium', fontSize: 10, color: 'var(--base-text-muted)' }}>
                      {p.left.length} piece{p.left.length === 1 ? '' : 's'} remaining
                    </span>
                  </div>
                  <button
                    className="hm-plan-drop-btn"
                    onClick={() => onDropPlan?.(p.id)}
                    title="Cancel plan"
                    data-testid={`drop-plan-btn-${p.id}`}
                  >
                    Drop
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hotbar */}
      <Hotbar inventory={view.inventory} actions={source.actions} />

      {/* Modal Windows */}
      {openWindow === 'inventory' && (
        <InventoryWindow
          inventory={view.inventory}
          actions={source.actions}
          onClose={() => setOpenWindow('none')}
        />
      )}

      {openWindow === 'drafting' && (
        <DraftingWindow
          draft={view.draft}
          lattice={view.lattice}
          actions={source.actions}
          world={(source as any).getWorld ? (source as any).getWorld() : world}
          getWorld={(source as any).getWorld ? () => (source as any).getWorld() : undefined}
          at={at}
          currentStructureId={currentStructureId}
          onDispatch={onDispatch}
          onPlaceLayout={onPlaceLayout}
          onToast={onToast}
          onClose={() => setOpenWindow('none')}
        />
      )}

      {openWindow === 'lattice' && (
        <LatticeWindow
          lattice={view.lattice}
          actions={source.actions}
          onClose={() => setOpenWindow('none')}
        />
      )}
    </>
  );
};
