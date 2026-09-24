import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface DrawerLayoutProps {
  topBar?: React.ReactNode;
  leftDrawer?: React.ReactNode;
  rightDrawer?: React.ReactNode;
  bottomDock?: React.ReactNode;
  children?: React.ReactNode;
  isZen: boolean;
  onToggleZen: () => void;
}

interface LayoutPreferences {
  leftWidth: number;
  rightWidth: number;
  dockHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  dockCollapsed: boolean;
}

const STORAGE_KEY = 'hm2-builder-layout-v1';

const DEFAULT_PREFS: LayoutPreferences = {
  leftWidth: 300,
  rightWidth: 340,
  dockHeight: 220,
  leftCollapsed: false,
  rightCollapsed: false,
  dockCollapsed: false,
};

export default function DrawerLayout({
  topBar,
  leftDrawer,
  rightDrawer,
  bottomDock,
  children,
  isZen,
}: DrawerLayoutProps) {
  const [prefs, setPrefs] = useState<LayoutPreferences>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
      } catch {}
    }
    return DEFAULT_PREFS;
  });

  const savePrefs = (updated: LayoutPreferences) => {
    setPrefs(updated);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  const isResizing = useRef<'left' | 'right' | 'dock' | null>(null);

  // Resize pointer handlers
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isResizing.current) return;
      if (isResizing.current === 'left') {
        const newWidth = Math.max(220, Math.min(500, e.clientX));
        setPrefs((p) => ({ ...p, leftWidth: newWidth }));
      } else if (isResizing.current === 'right') {
        const newWidth = Math.max(240, Math.min(540, window.innerWidth - e.clientX));
        setPrefs((p) => ({ ...p, rightWidth: newWidth }));
      } else if (isResizing.current === 'dock') {
        const newHeight = Math.max(140, Math.min(480, window.innerHeight - e.clientY));
        setPrefs((p) => ({ ...p, dockHeight: newHeight }));
      }
    };

    const onPointerUp = () => {
      if (isResizing.current) {
        isResizing.current = null;
        setPrefs((p) => {
          savePrefs(p);
          return p;
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const toggleLeft = () => savePrefs({ ...prefs, leftCollapsed: !prefs.leftCollapsed });
  const toggleRight = () => savePrefs({ ...prefs, rightCollapsed: !prefs.rightCollapsed });
  const toggleDock = () => savePrefs({ ...prefs, dockCollapsed: !prefs.dockCollapsed });

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col pointer-events-none select-none">
      {/* Top Bar */}
      {topBar && !isZen && (
        <header className="z-30 pointer-events-auto flex-shrink-0">
          {topBar}
        </header>
      )}

      {/* Main Workspace Body */}
      <div className="relative flex-1 flex overflow-hidden w-full">
        {/* Left Drawer */}
        {leftDrawer && !isZen && (
          <aside
            className="relative z-20 flex-shrink-0 flex h-full pointer-events-auto transition-[width] duration-150 ease-out"
            style={{ width: prefs.leftCollapsed ? 0 : prefs.leftWidth }}
            aria-label="Palette and Asset Library Drawer"
          >
            <div
              className={`h-full w-full overflow-hidden transition-opacity duration-150 ${
                prefs.leftCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              {leftDrawer}
            </div>

            {/* Collapse toggle tab on edge */}
            <button
              onClick={toggleLeft}
              className="absolute -right-5 top-1/2 -translate-y-1/2 z-30 w-5 h-12 flex items-center justify-center builder-btn rounded-r-md rounded-l-none border-l-0 p-0 text-amber-300 hover:text-white"
              title={prefs.leftCollapsed ? 'Expand Catalog Drawer' : 'Collapse Catalog Drawer'}
              aria-label={prefs.leftCollapsed ? 'Expand Catalog Drawer' : 'Collapse Catalog Drawer'}
            >
              {prefs.leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Drag resize handle */}
            {!prefs.leftCollapsed && (
              <div
                onPointerDown={(e) => {
                  e.preventDefault();
                  isResizing.current = 'left';
                }}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-amber-500/40 transition-colors z-30"
                title="Drag to resize drawer"
              />
            )}
          </aside>
        )}

        {/* Viewport Center Area (Canvas Overlays) */}
        <main className="relative flex-1 h-full min-w-0 overflow-hidden pointer-events-none">
          {children}

          {/* Bottom Dock */}
          {bottomDock && !isZen && (
            <section
              className="absolute left-0 right-0 bottom-0 z-20 pointer-events-auto transition-[height] duration-150 ease-out"
              style={{ height: prefs.dockCollapsed ? 0 : prefs.dockHeight }}
              aria-label="Bottom Dock"
            >
              {/* Dock collapse toggle tab */}
              <button
                onClick={toggleDock}
                className="absolute left-1/2 -translate-x-1/2 -top-5 z-30 h-5 w-16 flex items-center justify-center builder-btn rounded-t-md rounded-b-none border-b-0 p-0 text-amber-300 hover:text-white"
                title={prefs.dockCollapsed ? 'Expand Bottom Dock' : 'Collapse Bottom Dock'}
                aria-label={prefs.dockCollapsed ? 'Expand Bottom Dock' : 'Collapse Bottom Dock'}
              >
                {prefs.dockCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* Drag resize handle */}
              {!prefs.dockCollapsed && (
                <div
                  onPointerDown={(e) => {
                    e.preventDefault();
                    isResizing.current = 'dock';
                  }}
                  className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-amber-500/40 transition-colors z-30"
                  title="Drag to resize dock"
                />
              )}

              <div
                className={`h-full w-full overflow-hidden transition-opacity duration-150 ${
                  prefs.dockCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              >
                {bottomDock}
              </div>
            </section>
          )}
        </main>

        {/* Right Drawer */}
        {rightDrawer && !isZen && (
          <aside
            className="relative z-20 flex-shrink-0 flex h-full pointer-events-auto transition-[width] duration-150 ease-out"
            style={{ width: prefs.rightCollapsed ? 0 : prefs.rightWidth }}
            aria-label="Inspector and Properties Drawer"
          >
            {/* Collapse toggle tab on edge */}
            <button
              onClick={toggleRight}
              className="absolute -left-5 top-1/2 -translate-y-1/2 z-30 w-5 h-12 flex items-center justify-center builder-btn rounded-l-md rounded-r-none border-r-0 p-0 text-amber-300 hover:text-white"
              title={prefs.rightCollapsed ? 'Expand Inspector Drawer' : 'Collapse Inspector Drawer'}
              aria-label={prefs.rightCollapsed ? 'Expand Inspector Drawer' : 'Collapse Inspector Drawer'}
            >
              {prefs.rightCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            {/* Drag resize handle */}
            {!prefs.rightCollapsed && (
              <div
                onPointerDown={(e) => {
                  e.preventDefault();
                  isResizing.current = 'right';
                }}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-amber-500/40 transition-colors z-30"
                title="Drag to resize drawer"
              />
            )}

            <div
              className={`h-full w-full overflow-hidden transition-opacity duration-150 ${
                prefs.rightCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              {rightDrawer}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
