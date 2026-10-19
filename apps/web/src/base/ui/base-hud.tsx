import React, { useEffect, useRef, useState } from 'react';
import type { BaseView, BaseViewSource } from '../view';
import type { Applied, BaseCommand, BaseWorld, Point } from '../world';
import { Compass, Hammer } from 'lucide-react';
import { Hotbar } from './hotbar';
import { InventoryWindow } from './inventory-window';
import { DraftingWindow } from './drafting-window';
import { LatticeWindow } from './lattice-window';
import { BuildReadout } from './build-readout';
import type { WeaponStats } from '../weapons';

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
  weaponStats?: WeaponStats | null;
  ammo?: { current: number; max: number } | null;
  drivingSpeed?: number | null;
  drivingBoostEnergy?: number;
  drivingBoosting?: boolean;
  /** The held extraction rifle takes the mouse: the build readout (CANNOT PLACE, the wheel hint) is hidden while it is out. */
  buildHidden?: boolean;
  /** Why the drafting table is locked (TASK-22), or null when it is open. K then says the reason. */
  draftingLock?: string | null;
  onLocked?: (why: string) => void;
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
  weaponStats = null,
  ammo = null,
  drivingSpeed = null,
  drivingBoostEnergy,
  drivingBoosting = false,
  buildHidden = false,
  draftingLock = null,
  onLocked,
}) => {
  const [view, setView] = useState<BaseView>(() => source.get());
  const [openWindow, setOpenWindow] = useState<OpenWindow>('none');
  // read by the key handler, which is set up once (TASK-22: the drafting table waits for Act V)
  const draftingLockRef = useRef(draftingLock);
  draftingLockRef.current = draftingLock;
  const onLockedRef = useRef(onLocked);
  onLockedRef.current = onLocked;

  useEffect(() => {
    const unsubscribe = source.subscribe(() => {
      setView(source.get());
    });
    return unsubscribe;
  }, [source]);

  useEffect(() => {
    (window as any).__hmHud = {
      openInventory: () => setOpenWindow('inventory'),
      /** E on a bench (TICKET-03): the caller checks the drafting lock first, as K does. */
      openDrafting: () => setOpenWindow('drafting'),
      openLattice: () => setOpenWindow('lattice'),
      close: () => setOpenWindow('none'),
    };
    return () => {
      delete (window as any).__hmHud;
    };
  }, []);

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
        if (draftingLockRef.current) { onLockedRef.current?.(draftingLockRef.current); return; }
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
      {/* Reticle Build Readout - hidden when paused, modal open, or driving */}
      {!paused && openWindow === 'none' && !modalOpen && drivingSpeed === null && !buildHidden && (
        <BuildReadout
          build={view.build}
          hoverSupport={hoverSupport}
          wheelCycleText={wheelCycleText}
          rotationText={rotationText}
        />
      )}

      {/* Plan build prompt (within 8m) */}
      {planPrompt && !paused && openWindow === 'none' && !modalOpen && drivingSpeed === null && (
        <div style={{ position: 'absolute', top: 'calc(50% + 36px)', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <div className="hm-plan-build-prompt" data-hud-zone="centre" data-testid="plan-build-prompt">
            <Hammer size={14} />
            <span>{planPrompt}</span>
          </div>
        </div>
      )}

      {/* Running harvest counter pill beside hotbar */}
      {harvestCounter && !paused && openWindow === 'none' && !modalOpen && (
        <div className={`hm-harvest-counter${harvestCounter.fading ? ' fading' : ''}`} data-hud-zone="bottom-left" data-testid="base-harvest-counter">
          <span className="hm-count-pill">+{harvestCounter.count}</span>
          <span className="hm-count-name">{harvestCounter.name}</span>
        </div>
      )}

      {/* Running placed/filled counter pill beside hotbar */}
      {placedCounter && !paused && openWindow === 'none' && !modalOpen && (
        <div
          className={`hm-harvest-counter${placedCounter.fading ? ' fading' : ''}`}
          data-hud-zone="bottom-left" data-testid="base-placed-counter"
        >
          <span className="hm-count-pill">{placedCounter.count > 0 ? `+${placedCounter.count}` : placedCounter.count}</span>
          <span className="hm-count-name">{placedCounter.name}</span>
        </div>
      )}

      {/* Active plans HUD card */}
      {world && world.plans.length > 0 && !paused && openWindow === 'none' && !modalOpen && (
        <div className="hm-plans-hud-card" data-hud-zone="top-right" data-testid="active-plans-hud">
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

      {/* Weapon readout beside hotbar */}
      {weaponStats && !paused && openWindow === 'none' && !modalOpen && (
        <div className="hm-weapon-hud-badge" data-hud-zone="bottom-left" data-testid="weapon-hud-badge" style={{
          position: 'absolute',
          bottom: 100,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 8,
          padding: '6px 12px',
          fontFamily: 'Oxanium, sans-serif',
          zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--base-cyan, #38bdf8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {weaponStats.mode.toUpperCase()}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.05em' }}>
            {ammo ? `${ammo.current}/${ammo.max}` : `${weaponStats.magazine}/${weaponStats.magazine}`}
          </span>
        </div>
      )}

      {/* Driving speed readout */}
      {drivingSpeed !== null && drivingSpeed !== undefined && !paused && openWindow === 'none' && !modalOpen && (
        <div className="hm-speed-hud-badge" data-hud-zone="bottom-left" data-testid="speed-hud-badge" style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 8,
          padding: '6px 14px',
          fontFamily: 'Oxanium, sans-serif',
          zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SPEED
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.05em' }}>
            {Math.abs(drivingSpeed).toFixed(1)} <span style={{ fontSize: 10, color: '#94a3b8' }}>m/s</span>
          </span>
          {drivingBoostEnergy !== undefined && (
            <div data-testid="speed-hud-boost" style={{ width: '100%', minWidth: 64, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
              <div style={{
                width: `${Math.round(Math.max(0, Math.min(1, drivingBoostEnergy)) * 100)}%`,
                height: '100%',
                background: drivingBoosting ? '#38bdf8' : '#f59e0b',
                transition: 'width 0.05s linear',
              }} />
            </div>
          )}
          <span style={{ fontSize: 9, color: drivingBoosting ? '#38bdf8' : '#cbd5e1', marginTop: 2 }}>
            {drivingBoosting ? 'BOOSTING' : '[E] EXIT'}
          </span>
        </div>
      )}

      {/* Modal Windows */}
      {openWindow === 'inventory' && (
        <InventoryWindow
          inventory={view.inventory}
          actions={source.actions}
          loadout={world?.loadout}
          onFit={(slot, item) => onDispatch?.({ t: 'fit', slot, item })}
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
