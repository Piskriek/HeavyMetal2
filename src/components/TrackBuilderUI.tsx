import React, { useEffect, useRef, useState } from 'react';
import {
  TreePine, Flag, Mountain, RotateCcw, RotateCw,
  Trash2, Copy, Download, Upload, Compass, Play, X,
  Layers, Eye, MousePointer, Camera, Sun, ChevronDown, Users,
  Move
} from 'lucide-react';
import { COURSES, type CourseId } from '../game/types';
import {
  TrackBuilder3D,
  PROP_DEFINITIONS,
  type PropCategory,
  type PlacedProp
} from '../game/track-builder-3d';
import { SKY_PRESETS } from '../game/renderer-3d';

interface TrackBuilderUIProps {
  builder: TrackBuilder3D;
  canvas: HTMLCanvasElement;
  onClose: () => void;
  onTestRace?: () => void;
  onRequestRender?: () => void;
  course?: CourseId;
  onCourseChange?: (course: CourseId) => void;
}

const CATEGORIES: { id: PropCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'foliage', label: 'Foliage & Nature', icon: <TreePine size={16} /> },
  { id: 'trackside', label: 'Trackside & Stunts', icon: <Compass size={16} /> },
  { id: 'cavern_mine', label: 'Cavern & Mine', icon: <Mountain size={16} /> },
  { id: 'stadium', label: 'Stadium & Crowds', icon: <Flag size={16} /> },
  { id: 'decals', label: 'Road Decals', icon: <Layers size={16} /> },
  { id: 'goblins', label: 'Goblins & Crew', icon: <Users size={16} /> },
];

export default function TrackBuilderUI({ builder, canvas, onClose, onTestRace, onRequestRender, course, onCourseChange }: TrackBuilderUIProps) {
  const [category, setCategory] = useState<PropCategory>('foliage');
  const [activePropType, setActivePropType] = useState<string | null>(builder.getActivePropType());
  const [selectedProp, setSelectedProp] = useState<PlacedProp | null>(builder.getSelectedProp());
  const [selectedProps, setSelectedProps] = useState<PlacedProp[]>(builder.getSelectedProps());
  const [clickMoveEnabled, setClickMoveEnabled] = useState(false);
  const [nudgeAxis, setNudgeAxis] = useState<'y' | 'x' | 'z'>('y');
  const [alignToTrack, setAlignToTrack] = useState(builder.snapping.alignToTrack);
  const [snapToCenterline, setSnapToCenterline] = useState(builder.snapping.snapToCenterline);
  const [cameraFacingDefault, setCameraFacingDefault] = useState(builder.snapping.cameraFacingDefault);
  const [decalDefault, setDecalDefault] = useState(builder.snapping.decalDefault ?? false);
  const [showPropsDrawer, setShowPropsDrawer] = useState(false);
  const [currentSky, setCurrentSky] = useState<string>(builder.getSkybox());
  const [showSkyMenu, setShowSkyMenu] = useState(false);
  const [toast, setToast] = useState<string | null>('3D Track Builder Active: WASD to fly, Right-Drag to look, Click props to select');

  const keysRef = useRef(new Set<string>());
  const isRightMouseDown = useRef(false);
  const isDraggingSelected = useRef(false);
  const isRotatingSelected = useRef(false);
  const lastDragSurfacePoint = useRef<{ x: number; y: number; z: number } | null>(null);
  const clickMoveEnabledRef = useRef(false);
  clickMoveEnabledRef.current = clickMoveEnabled;
  const nudgeAxisRef = useRef<'y' | 'x' | 'z'>('y');
  nudgeAxisRef.current = nudgeAxis;
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Sync builder changes
  useEffect(() => {
    const update = () => {
      setSelectedProp(builder.getSelectedProp());
      setSelectedProps(builder.getSelectedProps());
      setActivePropType(builder.getActivePropType());
      setCurrentSky(builder.getSkybox());
      onRequestRender?.();
    };
    builder.onChange(update);
    builder.freeFly.active = true;
    return () => {
      builder.freeFly.active = false;
    };
  }, [builder, onRequestRender]);

  // Animation frame loop for smooth fly camera
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Always update fly camera each frame
      builder.updateFlyCamera(dt, keysRef.current);
      onRequestRender?.();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [builder, onRequestRender]);

  // Canvas mouse & pointer controls
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        isRightMouseDown.current = true;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
      } else if (e.button === 0) {
        // Left click
        if (builder.getActivePropType()) {
          const placed = builder.placeActiveProp(e.clientX, e.clientY, canvas);
          if (placed) {
            showToast(`Placed ${placed.name}!`);
            onRequestRender?.();
          }
        } else {
          // Check if clicking in-place rotation handle
          if (builder.getSelectedProps().length > 0 && builder.raycastRotateHandle(e.clientX, e.clientY, canvas)) {
            isRotatingSelected.current = true;
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            showToast('Orbit / Rotate In-Place: Drag left/right');
            return;
          }

          // Select mode: check if clicking on an existing placed prop
          const hitProp = builder.raycastProp(e.clientX, e.clientY, canvas);
          const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
          if (hitProp) {
            builder.selectProp(hitProp.id, isMulti);
            const currentSelected = builder.getSelectedProps();
            if (clickMoveEnabledRef.current) {
              isDraggingSelected.current = true;
              const hit = builder.raycastSurface(e.clientX, e.clientY, canvas);
              lastDragSurfacePoint.current = hit ? { ...hit.point } : null;
            } else {
              isDraggingSelected.current = false;
              lastDragSurfacePoint.current = null;
            }

            if (currentSelected.length > 1) {
              showToast(`Selected ${currentSelected.length} items (${builder.isSelectionGrouped() ? 'Grouped' : 'Multi-select'}) [Ctrl+G: Group, Ctrl+D: Dup, Del: Delete]`);
            } else {
              showToast(`Selected ${hitProp.name} [Numpad/Arrows: move on ${nudgeAxisRef.current.toUpperCase()}, 5: cycle axis, M: click-move]`);
            }
            onRequestRender?.();
          } else {
            // Clicked empty area: deselect unless holding multi modifier
            if (!isMulti) {
              if (builder.getSelectedProps().length > 0) {
                builder.selectProp(null);
                onRequestRender?.();
              }
            }
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isRightMouseDown.current) {
        const dx = e.clientX - lastPointerPos.current.x;
        const dy = e.clientY - lastPointerPos.current.y;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        builder.rotateCamera(dx, dy);
        onRequestRender?.();
      }

      // Rotating/tilting selected prop in-place around centroid
      if (isRotatingSelected.current && !isRightMouseDown.current) {
        const dx = e.clientX - lastPointerPos.current.x;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        builder.rotateSelectedProps((dx * Math.PI) / 180);
        onRequestRender?.();
        return;
      }

      // Dragging selected prop across surface (ONLY when clickMoveEnabled is ON!)
      if (isDraggingSelected.current && clickMoveEnabledRef.current && !isRightMouseDown.current) {
        const selected = builder.getSelectedProps();
        if (selected.length > 0) {
          const hit = builder.raycastSurface(e.clientX, e.clientY, canvas);
          if (hit) {
            if (lastDragSurfacePoint.current) {
              const dx = Math.round(hit.point.x - lastDragSurfacePoint.current.x);
              const dy = Math.round(hit.point.y - lastDragSurfacePoint.current.y);
              const dz = Math.round(hit.point.z - lastDragSurfacePoint.current.z);
              if (dx !== 0 || dy !== 0 || dz !== 0) {
                builder.moveSelectedProps(dx, dy, dz);
                lastDragSurfacePoint.current = { ...hit.point };
                onRequestRender?.();
              }
            } else {
              lastDragSurfacePoint.current = { ...hit.point };
            }
            return;
          }
        }
      }

      if (builder.getActivePropType()) {
        builder.updateGhostPosition(e.clientX, e.clientY, canvas);
        canvas.style.cursor = 'crosshair';
        onRequestRender?.();
      } else {
        // Hover check in select mode
        const hitHandle = builder.getSelectedProps().length > 0 && builder.raycastRotateHandle(e.clientX, e.clientY, canvas);
        const hit = hitHandle || builder.raycastProp(e.clientX, e.clientY, canvas);
        canvas.style.cursor = hitHandle ? 'grab' : (hit ? 'pointer' : 'default');
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        isRightMouseDown.current = false;
        // Right click cancels active placement
        if (builder.getActivePropType()) {
          builder.setActivePropType(null);
          showToast('Select Mode active');
        }
      } else if (e.button === 0) {
        isDraggingSelected.current = false;
        lastDragSurfacePoint.current = null;
        isRotatingSelected.current = false;
      }
    };

    window.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [builder, canvas]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      keysRef.current.add(e.code);

      // Keyboard shortcuts
      // 1. Cycle active axis with Numpad 5 or Digit 5
      if ((e.code === 'Numpad5' || e.code === 'Digit5') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const current = nudgeAxisRef.current;
        const nextAxis: 'y' | 'x' | 'z' = current === 'y' ? 'x' : current === 'x' ? 'z' : 'y';
        setNudgeAxis(nextAxis);
        showToast(`Nudge Axis: ${nextAxis.toUpperCase()} [Numpad/Arrows to move, 5 to cycle]`);
        return;
      }

      // 2. Toggle Click Move with KeyM
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setClickMoveEnabled((prev) => {
          const next = !prev;
          showToast(next ? 'Click Move: ON (Click & drag to move)' : 'Click Move: OFF (Clicking selects only)');
          return next;
        });
        return;
      }

      // 3. Group / Ungroup with Ctrl+G / Ctrl+Shift+G
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyG') {
        e.preventDefault();
        if (e.shiftKey) {
          const success = builder.ungroupSelected();
          if (success) {
            showToast('Ungrouped selection');
            onRequestRender?.();
          }
        } else {
          const gid = builder.groupSelected();
          if (gid) {
            showToast(`Grouped ${builder.getSelectedProps().length} decorations [Ctrl+Shift+G to ungroup]`);
            onRequestRender?.();
          } else {
            showToast('Select 2 or more decorations to group');
          }
        }
        return;
      }

      // 4. Directional movement along active axis via Arrow or Numpad keys
      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code);
      const isNumpad = ['Numpad8', 'Numpad2', 'Numpad4', 'Numpad6'].includes(e.code);
      if (isArrow || isNumpad) {
        const selected = builder.getSelectedProps();
        if (selected.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 100 : 25;
          let dx = 0;
          let dy = 0;
          let dz = 0;
          const axis = nudgeAxisRef.current;

          if (axis === 'y') {
            // Y axis: Up/Right raises, Down/Left lowers
            if (e.code === 'ArrowUp' || e.code === 'Numpad8') dy = step;
            else if (e.code === 'ArrowDown' || e.code === 'Numpad2') dy = -step;
            else if (e.code === 'ArrowRight' || e.code === 'Numpad6') dy = step;
            else if (e.code === 'ArrowLeft' || e.code === 'Numpad4') dy = -step;
          } else if (axis === 'x') {
            // X axis: Right/Up moves +X, Left/Down moves -X
            if (e.code === 'ArrowRight' || e.code === 'Numpad6') dx = step;
            else if (e.code === 'ArrowLeft' || e.code === 'Numpad4') dx = -step;
            else if (e.code === 'ArrowUp' || e.code === 'Numpad8') dx = step;
            else if (e.code === 'ArrowDown' || e.code === 'Numpad2') dx = -step;
          } else if (axis === 'z') {
            // Z axis: Up/Right moves +Z (forward along track), Down/Left moves -Z (backward)
            if (e.code === 'ArrowUp' || e.code === 'Numpad8') dz = step;
            else if (e.code === 'ArrowDown' || e.code === 'Numpad2') dz = -step;
            else if (e.code === 'ArrowRight' || e.code === 'Numpad6') dz = step;
            else if (e.code === 'ArrowLeft' || e.code === 'Numpad4') dz = -step;
          }

          builder.moveSelectedProps(dx, dy, dz);
          onRequestRender?.();
          return;
        }
      } else if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const selected = builder.getSelectedProps();
        if (selected.length > 0) {
          e.preventDefault();
          const stepDeg = e.shiftKey ? 10 : 2;
          const delta = (stepDeg * Math.PI) / 180 * (e.code === 'BracketLeft' ? -1 : 1);
          builder.tiltSelectedProps(delta);
          showToast(`Tilt adjusted for ${selected.length} item(s)`);
          onRequestRender?.();
        }
      } else if (e.code === 'KeyX' && !e.ctrlKey && !e.metaKey) {
        const selected = builder.getSelectedProps();
        if (selected.length > 0) {
          e.preventDefault();
          builder.flipSelectedProps();
          showToast(`Flipped/mirrored ${selected.length} item(s)`);
          onRequestRender?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault();
        const dups = builder.duplicateSelected();
        if (dups.length > 0) {
          showToast(`Duplicated ${dups.length} item(s) as group`);
          onRequestRender?.();
        }
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        const count = builder.getSelectedProps().length;
        if (count > 0) {
          builder.deleteSelected();
          showToast(`Deleted ${count} item(s)`);
          onRequestRender?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        builder.undo();
        showToast('Undo');
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        builder.redo();
        showToast('Redo');
      } else if (e.code === 'KeyF') {
        const selected = builder.getSelectedProps();
        if (selected.length > 0) {
          e.preventDefault();
          builder.focusProp(selected[0].id);
          showToast(`Focused camera on ${selected[0].name}`);
        }
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        builder.setActivePropType(null);
        showToast('Select / Inspect Tool Active');
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (builder.getActivePropType()) {
          builder.setActivePropType(null);
          showToast('Select Tool Active');
        } else if (builder.getSelectedProps().length > 0) {
          builder.selectProp(null);
        } else {
          onClose();
        }
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        onClose();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [builder, onClose]);

  const selectPropType = (type: string) => {
    if (activePropType === type) {
      builder.setActivePropType(null);
    } else {
      builder.setActivePropType(type);
      builder.selectProp(null);
      showToast('Click track or terrain to place. Right-click to cancel.');
    }
  };

  const handleExport = () => {
    const json = builder.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `track-3d-layout-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported layout to JSON!');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          builder.importJson(reader.result as string);
          showToast('Imported layout from JSON!');
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const filteredProps = PROP_DEFINITIONS.filter((p) => p.category === category);
  const placedProps = builder.getProps();

  return (
    <div className="track-builder-root pointer-events-none fixed inset-0 z-50 flex flex-col justify-between select-none">
      {/* Toast notification */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-950/90 border border-amber-500/70 text-amber-200 px-4 py-2 rounded-lg text-sm shadow-xl backdrop-blur-md transition-all">
          {toast}
        </div>
      )}

      {/* Top Bar */}
      <div className="pointer-events-auto flex items-center justify-between bg-zinc-950/85 border-b border-amber-500/40 px-4 py-2.5 backdrop-blur-md text-amber-100">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-wider text-amber-400 flex items-center gap-1.5 text-sm">
            <Compass size={18} /> 3D TRACK BUILDER
          </span>

          {/* Track Selector */}
          {onCourseChange && (
            <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/60 rounded px-2 py-1 text-xs">
              <span className="text-zinc-400 font-medium">Track:</span>
              <select
                className="bg-transparent text-amber-300 focus:outline-none cursor-pointer font-bold"
                value={course ?? 'ridge'}
                onChange={(e) => onCourseChange(e.target.value as CourseId)}
              >
                {COURSES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-amber-200">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Skybox / Atmosphere Environment Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSkyMenu(!showSkyMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-zinc-900/80 hover:bg-zinc-800 text-amber-300 rounded border border-zinc-700/50 font-medium cursor-pointer"
              title="Choose Skydome Environment & Atmosphere"
            >
              <Sun size={13} />
              <span>Sky: {SKY_PRESETS[currentSky]?.name.split(' (')[0] ?? 'Ridge'}</span>
              <ChevronDown size={11} />
            </button>

            {showSkyMenu && (
              <div className="absolute top-8 left-0 z-50 w-64 bg-zinc-950/95 border border-amber-500/60 rounded-lg shadow-2xl p-2 flex flex-col gap-1 backdrop-blur-md">
                <span className="text-[10px] font-bold text-amber-400 px-2 py-1 uppercase tracking-wider">
                  Skydome Atmosphere
                </span>
                {Object.values(SKY_PRESETS).map((p) => {
                  const isActive = currentSky === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        builder.setSkybox(p.id);
                        setCurrentSky(p.id);
                        setShowSkyMenu(false);
                        showToast(`Atmosphere: ${p.name}`);
                      }}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-xs text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-amber-950/70 border border-amber-500/80 text-amber-200 font-bold'
                          : 'hover:bg-zinc-900 text-zinc-300 border border-transparent'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded border border-zinc-700 overflow-hidden shrink-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${p.url})` }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="text-[9px] text-zinc-500 capitalize">{p.id} biome</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Placed Props Drawer Toggle */}
          <button
            onClick={() => setShowPropsDrawer(!showPropsDrawer)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
              showPropsDrawer
                ? 'bg-amber-500/25 text-amber-300 border-amber-500/80 font-bold'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/50'
            }`}
            title="View all placed props in scene"
          >
            <Layers size={14} /> Props ({placedProps.length})
          </button>

          {/* Snapping Options */}
          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer hover:text-amber-300">
            <input
              type="checkbox"
              checked={alignToTrack}
              onChange={(e) => {
                setAlignToTrack(e.target.checked);
                builder.snapping.alignToTrack = e.target.checked;
              }}
              className="rounded border-zinc-700 text-amber-500 focus:ring-0"
            />
            Align to Track
          </label>

          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer hover:text-amber-300">
            <input
              type="checkbox"
              checked={snapToCenterline}
              onChange={(e) => {
                setSnapToCenterline(e.target.checked);
                builder.snapping.snapToCenterline = e.target.checked;
              }}
              className="rounded border-zinc-700 text-amber-500 focus:ring-0"
            />
            Snap Centerline
          </label>

          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer hover:text-amber-300" title="When enabled, newly placed PNG decorations rotate to always face the camera. When disabled, they are placed with a fixed 3D world orientation.">
            <input
              type="checkbox"
              checked={cameraFacingDefault}
              onChange={(e) => {
                setCameraFacingDefault(e.target.checked);
                builder.snapping.cameraFacingDefault = e.target.checked;
                showToast(e.target.checked ? 'Default: Camera Facing (Billboard)' : 'Default: Fixed 3D World Orientation');
              }}
              className="rounded border-zinc-700 text-amber-500 focus:ring-0"
            />
            Camera Facing
          </label>

          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer hover:text-amber-300" title="When enabled, newly placed items are treated as flat decals on the track/ground surface.">
            <input
              type="checkbox"
              checked={decalDefault}
              onChange={(e) => {
                setDecalDefault(e.target.checked);
                builder.snapping.decalDefault = e.target.checked;
                showToast(e.target.checked ? 'Default: Decal (Flat on Track/Ground)' : 'Default: Upright Decoration');
              }}
              className="rounded border-zinc-700 text-amber-500 focus:ring-0"
            />
            Decal (Flat)
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => builder.undo()}
            className="p-1.5 text-zinc-300 hover:text-amber-400 bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-700/50"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={() => builder.redo()}
            className="p-1.5 text-zinc-300 hover:text-amber-400 bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-700/50"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw size={15} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-zinc-900/80 hover:bg-zinc-800 text-amber-300 rounded border border-zinc-700/50"
            title="Export to JSON"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-zinc-900/80 hover:bg-zinc-800 text-amber-300 rounded border border-zinc-700/50"
            title="Import from JSON"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={() => {
              if (confirm('Clear all placed props?')) {
                builder.clearAll();
                showToast('Cleared all props');
              }
            }}
            className="p-1.5 text-red-400 hover:text-red-300 bg-zinc-900/80 hover:bg-red-950/40 rounded border border-red-900/40"
            title="Clear All Props"
          >
            <Trash2 size={15} />
          </button>
          {onTestRace && (
            <button
              onClick={onTestRace}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors shadow-lg shadow-emerald-600/30 cursor-pointer"
              title="Test drive on this track!"
            >
              <Play size={13} fill="currentColor" /> TEST RACE
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded transition-colors"
          >
            {onTestRace ? 'MENU' : 'EXIT BUILD [B]'}
          </button>
        </div>
      </div>

      {/* Placed Props Scene Drawer */}
      {showPropsDrawer && (
        <div className="pointer-events-auto absolute top-14 left-4 z-40 w-80 max-h-[calc(100vh-140px)] bg-zinc-950/95 border border-amber-500/50 rounded-lg shadow-2xl backdrop-blur-md flex flex-col text-amber-100 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/90 border-b border-zinc-800">
            <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
              <Layers size={15} /> PLACED PROPS ({placedProps.length})
            </span>
            <div className="flex items-center gap-1">
              {placedProps.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm(`Clear all ${placedProps.length} props?`)) {
                      builder.clearAll();
                      showToast('Cleared all props');
                    }
                  }}
                  className="px-2 py-0.5 text-[11px] bg-red-950/60 hover:bg-red-900/80 text-red-300 rounded border border-red-800/40 flex items-center gap-1"
                  title="Clear all placed props"
                >
                  <Trash2 size={11} /> Clear All
                </button>
              )}
              <button
                onClick={() => setShowPropsDrawer(false)}
                className="text-zinc-400 hover:text-amber-200 p-1 rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-96">
            {placedProps.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500">
                No props placed on this track yet.<br />
                Select a prop from the dock below to place!
              </div>
            ) : (
              placedProps.map((p) => {
                const def = PROP_DEFINITIONS.find((d) => d.type === p.type);
                const isSelected = builder.isPropSelected(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs transition-colors ${
                      isSelected
                        ? p.groupId
                          ? 'bg-cyan-950/50 border-cyan-500/80 text-cyan-200'
                          : 'bg-amber-950/50 border-amber-500/80 text-amber-200'
                        : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      onClick={(e) => {
                        const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
                        builder.selectProp(p.id, isMulti);
                        showToast(`Selected ${p.name}`);
                      }}
                    >
                      {def?.url && (
                        <img
                          src={def.url}
                          alt={p.name}
                          className="w-7 h-7 object-contain bg-zinc-950/60 rounded p-0.5 shrink-0"
                        />
                      )}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold truncate text-[11px]">{p.name}</span>
                          {p.groupId && (
                            <span className="text-[9px] px-1 py-0.2 bg-cyan-950/80 text-cyan-300 rounded font-mono border border-cyan-700/50">GRP</span>
                          )}
                          {def?.isRamp ? (
                            <span className="text-[9px] px-1 py-0.2 bg-amber-900/60 text-amber-300 rounded font-mono">RAMP</span>
                          ) : def?.isSlingshot || def?.is3DModel ? (
                            <span className="text-[9px] px-1 py-0.2 bg-orange-950/60 text-orange-300 rounded font-mono">3D</span>
                          ) : (p.isDecal !== undefined ? p.isDecal : def?.isDecal) ? (
                            <span className="text-[9px] px-1 py-0.2 bg-emerald-950/60 text-emerald-300 rounded font-mono">DECAL</span>
                          ) : p.cameraFacing === false ? (
                            <span className="text-[9px] px-1 py-0.2 bg-purple-950/60 text-purple-300 rounded font-mono">3D</span>
                          ) : (
                            <span className="text-[9px] px-1 py-0.2 bg-blue-950/60 text-blue-300 rounded font-mono">BB</span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 truncate">
                          X:{p.x} Y:{p.y} Z:{p.z}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => {
                          builder.focusProp(p.id);
                          showToast(`Focused on ${p.name}`);
                        }}
                        className="p-1 text-zinc-400 hover:text-amber-300 bg-zinc-800 hover:bg-zinc-700 rounded"
                        title="Focus Camera [F]"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={() => {
                          builder.deleteProp(p.id);
                          showToast(`Deleted ${p.name}`);
                        }}
                        className="p-1 text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 rounded border border-red-900/30"
                        title="Delete Prop"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Selected Prop(s) Inspector (Floating Right) */}
      {selectedProps.length > 1 ? (
        <div className="pointer-events-auto self-end mr-4 mb-auto mt-4 w-80 bg-zinc-950/95 border border-cyan-500/60 rounded-lg p-3.5 shadow-2xl backdrop-blur-md text-cyan-100 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-cyan-400">
                  {builder.isSelectionGrouped() ? 'Group' : 'Multi-Selection'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                  {selectedProps.length} Items
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">
                Centroid: ({builder.getGroupCentroid().x}, {builder.getGroupCentroid().y}, {builder.getGroupCentroid().z})
              </span>
            </div>
            <button
              onClick={() => builder.selectProp(null)}
              className="text-zinc-400 hover:text-cyan-200 text-xs p-1 cursor-pointer"
              title="Deselect All [Esc]"
            >
              <X size={14} />
            </button>
          </div>

          {/* Group / Ungroup Bar */}
          <div className="flex items-center gap-2">
            {builder.isSelectionGrouped() ? (
              <button
                onClick={() => {
                  builder.ungroupSelected();
                  showToast('Ungrouped selection');
                  onRequestRender?.();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1 text-xs rounded font-bold bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-600 transition-colors cursor-pointer"
                title="Ungroup into individual items [Ctrl+Shift+G]"
              >
                <Users size={13} />
                <span>Ungroup [Ctrl+Shift+G]</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  builder.groupSelected();
                  showToast(`Grouped ${selectedProps.length} items [Ctrl+Shift+G to ungroup]`);
                  onRequestRender?.();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1 text-xs rounded font-bold bg-cyan-600 hover:bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-900/40 transition-colors cursor-pointer"
                title="Group items into a single unit [Ctrl+G]"
              >
                <Users size={13} />
                <span>Group Selected [Ctrl+G]</span>
              </button>
            )}
          </div>

          {/* Active Nudge Axis Indicator & Quick Nudge */}
          <div className="flex flex-col gap-1 text-xs bg-zinc-900/70 p-2 rounded-md border border-zinc-800">
            <div className="flex justify-between items-center text-zinc-400">
              <div className="flex items-center gap-1">
                <span>Nudge Active Axis:</span>
                <span className="font-mono font-bold text-amber-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-amber-500/40">
                  {nudgeAxis.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => {
                  const next: 'y' | 'x' | 'z' = nudgeAxis === 'y' ? 'x' : nudgeAxis === 'x' ? 'z' : 'y';
                  setNudgeAxis(next);
                  showToast(`Nudge Axis: ${next.toUpperCase()} [Press 5 to cycle]`);
                }}
                className="text-[10px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
              >
                Cycle [5]
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[-100, -25, +25, +100].map((step) => (
                <button
                  key={step}
                  onClick={() => {
                    const dx = nudgeAxis === 'x' ? step : 0;
                    const dy = nudgeAxis === 'y' ? step : 0;
                    const dz = nudgeAxis === 'z' ? step : 0;
                    builder.moveSelectedProps(dx, dy, dz);
                    onRequestRender?.();
                  }}
                  className="px-1 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 cursor-pointer text-center font-mono"
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>
          </div>

          {/* Group Scale (Centroid-relative) */}
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400 font-medium">Scale Group (from Centroid):</span>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '-25%', mult: 0.75 },
                { label: '-10%', mult: 0.9 },
                { label: '+10%', mult: 1.1 },
                { label: '+25%', mult: 1.25 }
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => {
                    builder.scaleSelectedProps(btn.mult);
                    onRequestRender?.();
                  }}
                  className="px-1 py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-cyan-300 rounded border border-zinc-700 cursor-pointer text-center font-mono"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Group Orbit Rotation (Yaw around Centroid) */}
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400 font-medium">Orbit Yaw (around Centroid):</span>
            <div className="grid grid-cols-5 gap-1">
              {[-45, -15, 15, 45, 180].map((deg) => (
                <button
                  key={deg}
                  onClick={() => {
                    builder.rotateSelectedProps((deg * Math.PI) / 180);
                    onRequestRender?.();
                  }}
                  className="px-1 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-cyan-300 rounded border border-zinc-700 cursor-pointer text-center font-mono"
                >
                  {deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>
          </div>

          {/* Group Tilt / In-Place Rotation */}
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400 font-medium">Tilt All [ [ / ] ]:</span>
            <div className="grid grid-cols-5 gap-1">
              {[-15, -5, 0, 5, 15].map((deg) => (
                <button
                  key={deg}
                  onClick={() => {
                    if (deg === 0) {
                      for (const p of selectedProps) {
                        builder.updatePropTransform(p.id, { rotZ: 0 });
                      }
                    } else {
                      builder.tiltSelectedProps((deg * Math.PI) / 180);
                    }
                    onRequestRender?.();
                  }}
                  className="px-1 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-cyan-300 rounded border border-zinc-700 cursor-pointer text-center font-mono"
                >
                  {deg === 0 ? '0° Flat' : deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>
          </div>

          {/* Group Flip / Mirror Button */}
          <div className="flex items-center justify-between pt-1 pb-1 text-xs border-t border-zinc-800/60">
            <span className="text-zinc-400">Flip / Mirror All:</span>
            <button
              onClick={() => {
                builder.flipSelectedProps();
                showToast('Flipped/mirrored selection');
                onRequestRender?.();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 cursor-pointer"
              title="Flip / Mirror all items horizontally [Key: X]"
            >
              <RotateCw size={13} />
              <span>Mirror Selection [X]</span>
            </button>
          </div>

          {/* Group Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
            <button
              onClick={() => {
                if (selectedProps.length > 0) {
                  builder.focusProp(selectedProps[0].id);
                  showToast('Focused camera on group');
                }
              }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-cyan-300 rounded border border-zinc-700/60 font-medium cursor-pointer"
              title="Focus Camera [F]"
            >
              <Eye size={13} /> Focus [F]
            </button>
            <button
              onClick={() => {
                const dups = builder.duplicateSelected();
                showToast(`Duplicated ${dups.length} items as group`);
                onRequestRender?.();
              }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-cyan-300 rounded border border-zinc-700/60 font-medium cursor-pointer"
              title="Duplicate Group [Ctrl+D]"
            >
              <Copy size={13} /> Duplicate [Ctrl+D]
            </button>
            <button
              onClick={() => {
                const count = builder.getSelectedProps().length;
                builder.deleteSelected();
                showToast(`Deleted ${count} items`);
                onRequestRender?.();
              }}
              className="flex items-center justify-center px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow-lg shadow-red-600/30 cursor-pointer"
              title="Delete Group [Del / Backspace]"
            >
              <Trash2 size={14} /> DELETE
            </button>
          </div>
        </div>
      ) : selectedProp ? (
        <div className="pointer-events-auto self-end mr-4 mb-auto mt-4 w-72 bg-zinc-950/95 border border-amber-500/60 rounded-lg p-3.5 shadow-2xl backdrop-blur-md text-amber-100 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-amber-400 truncate">{selectedProp.name}</span>
                {selectedProp.groupId && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                    GROUPED
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400">Position: ({selectedProp.x}, {selectedProp.y}, {selectedProp.z})</span>
            </div>
            <button
              onClick={() => builder.selectProp(null)}
              className="text-zinc-400 hover:text-amber-200 text-xs p-1 cursor-pointer"
              title="Deselect [Esc]"
            >
              <X size={14} />
            </button>
          </div>

          {/* Group info & Ungroup button if part of group */}
          {selectedProp.groupId && (
            <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-700/50 px-2 py-1 rounded text-xs">
              <span className="text-cyan-300 font-medium">Part of Group</span>
              <button
                onClick={() => {
                  builder.ungroupSelected();
                  showToast('Ungrouped selection');
                  onRequestRender?.();
                }}
                className="px-2 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-cyan-200 rounded border border-zinc-600 cursor-pointer"
                title="Ungroup [Ctrl+Shift+G]"
              >
                Ungroup [Ctrl+Shift+G]
              </button>
            </div>
          )}

          {/* Active Nudge Axis Indicator */}
          <div className="flex items-center justify-between text-xs bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800/80">
            <span className="text-zinc-400">Nudge Axis: <b className="text-amber-400 font-mono">{nudgeAxis.toUpperCase()}</b></span>
            <button
              onClick={() => {
                const next: 'y' | 'x' | 'z' = nudgeAxis === 'y' ? 'x' : nudgeAxis === 'x' ? 'z' : 'y';
                setNudgeAxis(next);
                showToast(`Nudge Axis: ${next.toUpperCase()} [Press 5 to cycle]`);
              }}
              className="text-[10px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
            >
              Cycle [5]
            </button>
          </div>

          {/* Scale Slider */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Scale:</span>
              <span className="text-amber-300 font-mono">{selectedProp.scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="3.0"
              step="0.05"
              value={selectedProp.scale}
              onChange={(e) =>
                builder.updatePropTransform(selectedProp.id, { scale: parseFloat(e.target.value) })
              }
              className="accent-amber-500"
            />
          </div>

          {/* Position X (Horizontal Left / Right) */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Position X (Horizontal):</span>
              <span className="text-amber-300 font-mono">{selectedProp.x}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={selectedProp.x - 3000}
                max={selectedProp.x + 3000}
                step="10"
                value={selectedProp.x}
                onChange={(e) =>
                  builder.updatePropTransform(selectedProp.id, { x: parseInt(e.target.value) })
                }
                className="accent-amber-500 flex-1"
              />
              <button
                onClick={() => builder.updatePropTransform(selectedProp.id, { x: selectedProp.x - 50 })}
                className="px-1.5 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
                title="Move Left (-50)"
              >
                -50
              </button>
              <button
                onClick={() => builder.updatePropTransform(selectedProp.id, { x: selectedProp.x + 50 })}
                className="px-1.5 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
                title="Move Right (+50)"
              >
                +50
              </button>
            </div>
          </div>

          {/* Position Z (Horizontal Forward / Back) */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Position Z (Along Track):</span>
              <span className="text-amber-300 font-mono">{selectedProp.z}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={selectedProp.z - 3000}
                max={selectedProp.z + 3000}
                step="10"
                value={selectedProp.z}
                onChange={(e) =>
                  builder.updatePropTransform(selectedProp.id, { z: parseInt(e.target.value) })
                }
                className="accent-amber-500 flex-1"
              />
              <button
                onClick={() => builder.updatePropTransform(selectedProp.id, { z: selectedProp.z - 50 })}
                className="px-1.5 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
                title="Move Back (-50)"
              >
                -50
              </button>
              <button
                onClick={() => builder.updatePropTransform(selectedProp.id, { z: selectedProp.z + 50 })}
                className="px-1.5 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
                title="Move Forward (+50)"
              >
                +50
              </button>
            </div>
          </div>

          {/* Height (Altitude) Offset */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Height Offset (Y):</span>
              <span className="text-amber-300 font-mono">{selectedProp.y}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={selectedProp.y - 1000}
                max={selectedProp.y + 1000}
                step="10"
                value={selectedProp.y}
                onChange={(e) =>
                  builder.updatePropTransform(selectedProp.id, { y: parseInt(e.target.value) })
                }
                className="accent-amber-500 flex-1"
              />
              <button
                onClick={() => builder.updatePropTransform(selectedProp.id, { y: selectedProp.y - 25 })}
                className="px-1.5 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
                title="Lower (-25)"
              >
                -25
              </button>
              <button
                onClick={() => builder.updatePropTransform(selectedProp.id, { y: selectedProp.y + 25 })}
                className="px-1.5 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
                title="Raise (+25)"
              >
                +25
              </button>
            </div>
          </div>

          {/* Rotation Y */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Rotation Y (Yaw):</span>
              <span className="text-amber-300 font-mono">{Math.round((selectedProp.rotY * 180) / Math.PI)}°</span>
            </div>
            <input
              type="range"
              min={-Math.PI}
              max={Math.PI}
              step="0.05"
              value={selectedProp.rotY}
              onChange={(e) =>
                builder.updatePropTransform(selectedProp.id, { rotY: parseFloat(e.target.value) })
              }
              className="accent-amber-500"
            />
          </div>

          {/* Tilt / In-Place Rotation */}
          <div className="flex flex-col gap-1.5 bg-zinc-900/60 p-2 rounded-md border border-zinc-800/80 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-medium">Tilt / In-Place Rotation:</span>
              <span className="text-amber-300 font-mono font-bold">
                {Math.round(((selectedProp.rotZ ?? 0) * 180) / Math.PI)}°
              </span>
            </div>
            <input
              type="range"
              min="-90"
              max="90"
              value={Math.round(((selectedProp.rotZ ?? 0) * 180) / Math.PI)}
              onChange={(e) => {
                const deg = parseFloat(e.target.value);
                builder.updatePropTransform(selectedProp.id, { rotZ: (deg * Math.PI) / 180 });
                onRequestRender?.();
              }}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
            />
            <div className="grid grid-cols-5 gap-1 pt-0.5">
              {[-15, -5, 0, 5, 15].map((deg) => (
                <button
                  key={deg}
                  onClick={() => {
                    const currentDeg = Math.round(((selectedProp.rotZ ?? 0) * 180) / Math.PI);
                    const newDeg = deg === 0 ? 0 : Math.max(-90, Math.min(90, currentDeg + deg));
                    builder.updatePropTransform(selectedProp.id, { rotZ: (newDeg * Math.PI) / 180 });
                    onRequestRender?.();
                  }}
                  className="px-1 py-0.5 text-[10px] bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/50 cursor-pointer text-center"
                >
                  {deg === 0 ? '0° Flat' : (deg > 0 ? `+${deg}°` : `${deg}°`)}
                </button>
              ))}
            </div>
          </div>

          {/* Flip / Mirror Button */}
          <div className="flex items-center justify-between pt-1 pb-1 text-xs border-t border-zinc-800/60">
            <span className="text-zinc-400">Flip / Mirror PNG:</span>
            <button
              onClick={() => {
                const next = !selectedProp.flipX;
                builder.updatePropTransform(selectedProp.id, { flipX: next });
                showToast(next ? 'Flipped Horizontally (Mirrored)' : 'Restored Normal Orientation');
                onRequestRender?.();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold border transition-colors cursor-pointer ${
                selectedProp.flipX
                  ? 'bg-amber-600/90 hover:bg-amber-500 text-zinc-950 border-amber-400'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'
              }`}
              title="Flip / Mirror the PNG horizontally [Key: X]"
            >
              <RotateCw size={13} />
              <span>{selectedProp.flipX ? 'Mirrored (Flipped)' : 'Normal'}</span>
            </button>
          </div>

          {/* Decal Mode (Flat) Checkbox / Toggle */}
          {(() => {
            const def = PROP_DEFINITIONS.find((d) => d.type === selectedProp.type);
            if (def?.isRamp || def?.isSlingshot || def?.is3DModel) return null;
            const isDecal = selectedProp.isDecal !== undefined ? selectedProp.isDecal : (def?.isDecal ?? false);
            return (
              <div className="flex items-center justify-between pt-1 pb-1 text-xs border-t border-zinc-800/60">
                <span className="text-zinc-400">Decal Mode (Flat):</span>
                <button
                  onClick={() => {
                    const next = !isDecal;
                    builder.updatePropTransform(selectedProp.id, {
                      isDecal: next,
                      cameraFacing: next ? false : selectedProp.cameraFacing,
                    });
                    showToast(next ? 'Set as Decal (Flat on Track/Ground)' : 'Set as Upright Decoration');
                    onRequestRender?.();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold border transition-colors cursor-pointer ${
                    isDecal
                      ? 'bg-emerald-600/90 hover:bg-emerald-500 text-zinc-950 border-emerald-400'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'
                  }`}
                  title="Toggle whether this item lies flat on the road/ground as a decal, or stands upright"
                >
                  <Layers size={13} />
                  <span>{isDecal ? 'Decal (Flat on Ground)' : 'Upright Decoration'}</span>
                </button>
              </div>
            );
          })()}

          {/* Camera Facing Toggle (for PNG decorations that are NOT decals or 3D models) */}
          {(() => {
            const def = PROP_DEFINITIONS.find((d) => d.type === selectedProp.type);
            const isDecal = selectedProp.isDecal !== undefined ? selectedProp.isDecal : (def?.isDecal ?? false);
            if (def?.isRamp || def?.isSlingshot || def?.is3DModel || isDecal) return null;
            const isFacing = selectedProp.cameraFacing !== false;
            return (
              <div className="flex items-center justify-between pt-1 pb-1 text-xs border-t border-zinc-800/60">
                <span className="text-zinc-400">Camera Facing:</span>
                <button
                  onClick={() => {
                    const next = !isFacing;
                    builder.updatePropTransform(selectedProp.id, { cameraFacing: next });
                    showToast(next ? 'Set to Camera Facing (Billboard)' : 'Set to Fixed 3D World Orientation');
                    onRequestRender?.();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold border transition-colors cursor-pointer ${
                    isFacing
                      ? 'bg-amber-600/90 hover:bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'
                  }`}
                  title="Toggle whether this decoration rotates to face the camera (billboard) or stays fixed in 3D world space"
                >
                  <Camera size={13} />
                  <span>{isFacing ? 'ON (Billboard)' : 'OFF (Fixed 3D)'}</span>
                </button>
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
            <button
              onClick={() => {
                builder.focusProp(selectedProp.id);
                showToast(`Focused camera on ${selectedProp.name}`);
              }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-amber-300 rounded border border-zinc-700/60 font-medium"
              title="Focus Camera [F]"
            >
              <Eye size={13} /> Focus [F]
            </button>
            <button
              onClick={() => builder.duplicateSelected()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-amber-300 rounded border border-zinc-700/60 font-medium"
              title="Duplicate [Ctrl+D]"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              onClick={() => {
                builder.deleteSelected();
                showToast('Deleted prop');
              }}
              className="flex items-center justify-center px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow-lg shadow-red-600/30 cursor-pointer"
              title="Delete Prop [Del / Backspace]"
            >
              <Trash2 size={14} /> DELETE
            </button>
          </div>
        </div>
      ) : null}

      {/* Bottom Prop Palette */}
      <div className="pointer-events-auto bg-zinc-950/90 border-t border-amber-500/40 backdrop-blur-md flex flex-col">
        {/* Category Tabs & Select Mode Toggle */}
        <div className="flex items-center justify-between px-4 pt-2 border-b border-zinc-800/70">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                builder.setActivePropType(null);
                showToast('Select Tool Active: Click any prop in 3D to select or delete it');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t font-bold transition-all ${
                !activePropType
                  ? 'bg-amber-600 text-zinc-950 shadow'
                  : 'bg-zinc-900/80 text-amber-300 hover:bg-zinc-800 border-t border-x border-zinc-700/50'
              }`}
              title="Select / Inspect mode (click existing props)"
            >
              <MousePointer size={14} />
              SELECT TOOL [V]
            </button>

            {/* Click Move Toggle Button */}
            <button
              onClick={() => {
                setClickMoveEnabled((prev) => {
                  const next = !prev;
                  showToast(next ? 'Click Move: ON (Click & drag to move)' : 'Click Move: OFF (Clicking selects only)');
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-t font-bold transition-all border-t border-x cursor-pointer ${
                clickMoveEnabled
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-700/50'
              }`}
              title="Toggle click-move mode [M] (Default: OFF, clicking only selects)"
            >
              <Move size={13} />
              <span>CLICK MOVE: {clickMoveEnabled ? 'ON' : 'OFF'} [M]</span>
            </button>

            {/* Active Axis Cycle Button */}
            <button
              onClick={() => {
                const nextAxis: 'y' | 'x' | 'z' = nudgeAxis === 'y' ? 'x' : nudgeAxis === 'x' ? 'z' : 'y';
                setNudgeAxis(nextAxis);
                showToast(`Nudge Axis: ${nextAxis.toUpperCase()} [Numpad/Arrows to move, 5 to cycle]`);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-t font-bold bg-zinc-900/80 text-amber-300 hover:text-amber-200 border-t border-x border-zinc-700/50 transition-all cursor-pointer"
              title="Active movement axis for Arrow/Numpad keys. Press 5 on Numpad or click to cycle: Y -> X -> Z -> Y"
            >
              <span className="text-zinc-400">AXIS:</span>
              <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-amber-400 border border-amber-500/40">
                {nudgeAxis.toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-500">[5]</span>
            </button>

            {/* If multi-selected, show group pill in dock */}
            {selectedProps.length > 1 && (
              <button
                onClick={() => {
                  if (builder.isSelectionGrouped()) {
                    builder.ungroupSelected();
                    showToast('Ungrouped selection');
                  } else {
                    builder.groupSelected();
                    showToast(`Grouped ${selectedProps.length} items`);
                  }
                  onRequestRender?.();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-t font-bold bg-cyan-950 text-cyan-300 border-t border-x border-cyan-700/60 transition-all cursor-pointer hover:bg-cyan-900/60"
                title="Group/Ungroup selected decorations [Ctrl+G / Ctrl+Shift+G]"
              >
                <Users size={13} />
                <span>{builder.isSelectionGrouped() ? `Group (${selectedProps.length})` : `Selected (${selectedProps.length})`}</span>
              </button>
            )}

            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t font-medium transition-all ${
                  category === cat.id
                    ? 'bg-zinc-900 text-amber-400 border-t border-x border-amber-500/40 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prop Cards Grid (Horizontal Scrollable) */}
        <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto max-h-40 scrollbar-thin">
          {filteredProps.map((p) => {
            const isSelected = activePropType === p.type;
            return (
              <button
                key={p.type}
                onClick={() => selectPropType(p.type)}
                className={`group flex flex-col items-center p-2 rounded-lg border transition-all shrink-0 w-28 bg-zinc-900/90 hover:bg-zinc-850 ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/50'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="w-16 h-16 flex items-center justify-center overflow-hidden mb-1.5">
                  <img
                    src={p.url}
                    alt={p.name}
                    className="max-w-full max-h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                    draggable={false}
                  />
                </div>
                <span className="text-[11px] text-zinc-300 group-hover:text-amber-200 truncate w-full text-center">
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
