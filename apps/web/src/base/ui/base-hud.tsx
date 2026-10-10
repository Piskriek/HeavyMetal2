import React, { useEffect, useState } from 'react';
import type { BaseView, BaseViewSource } from '../view';
import { Hotbar } from './hotbar';
import { InventoryWindow } from './inventory-window';
import { DraftingWindow } from './drafting-window';
import { LatticeWindow } from './lattice-window';
import { BuildReadout } from './build-readout';

interface BaseHudProps {
  source: BaseViewSource;
  onOpenChange?: (isOpen: boolean) => void;
}

export type OpenWindow = 'none' | 'inventory' | 'drafting' | 'lattice';

export const BaseHud: React.FC<BaseHudProps> = ({ source, onOpenChange }) => {
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
      {/* Reticle Build Readout */}
      <BuildReadout build={view.build} />

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
