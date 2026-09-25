import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TreePine, Flag, Mountain, RotateCcw, RotateCw,
  Trash2, Copy, Download, Upload, Compass, Play, X,
  Layers, Eye, MousePointer, Camera, Sun, ChevronDown,
  Users, Move, Database, History, Save, RefreshCw,
  HardDrive, Clock, ShieldCheck, Zap, Clapperboard, Pause,
  Minus, Plus, Film, Route, Box, HelpCircle, Maximize2, Sparkles,
  Search, FolderDown, Magnet, ChevronLeft, ChevronRight, ChevronUp
} from 'lucide-react';
import { COURSES, type CourseId } from '../game/types';
import ZenRestore from './builder/ZenRestore';
import CheatSheet from './builder/CheatSheet';
import CustomModelsTab from './builder/CustomModelsTab';
import ShadingPanel from './builder/ShadingPanel';
import CollisionPanel from './builder/CollisionPanel';
import { DEFAULT_MATERIAL_DESCRIPTOR } from '../game/materials/material-descriptor';
import { DEFAULT_ROLE_CONFIGS } from '../game/collision/obstacle-roles';
import type { GizmoMode, GizmoSpace } from '../game/builder/gizmo-math';
import {
  TrackBuilder3D,
  PROP_DEFINITIONS,
  animGridFor,
  animSpeedFor,
  animatedTwinDef,
  normalizeAnimFrames,
  normalizeAnimFrameDelays,
  propHasAnimatedOption,
  ANIM_SPEED_MAX,
  ANIM_SPEED_MIN,
  ANIM_SPEED_STEP,
  type PropCategory,
  type PlacedProp,
  type DecalSide
} from '../game/track-builder-3d';
import { SKY_PRESETS } from '../game/renderer-3d';
import LanePanel, { type LanePanelCommand } from './builder/LanePanel';
import '../lane-panel.css';
import '../builder-theme.css';
import { laneEditForCommand, laneKeyIntent, lanePanelModel, type LaneKeyIntent } from '../game/lane-panel-model';
import { snapNode } from '../game/lane-path-tool';
import { sampleLaneNetwork, createDefaultLaneNetwork, createBlankLaneNetwork } from '../game/lane-network';

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
  { id: 'powerup', label: 'Powerups', icon: <Zap size={16} /> },
  { id: 'barrier', label: 'Barriers', icon: <ShieldCheck size={16} /> },
  { id: 'animated', label: 'Animated', icon: <Clapperboard size={16} /> },
  { id: 'custom_models' as any, label: 'Custom 3D', icon: <Box size={16} /> },
  // M01 · T7 — not a prop shelf: this tab opens the Lanes & Paths panel and its 3D handles.
  { id: 'lanes', label: 'Lanes & Paths', icon: <Route size={16} /> },
];

export default function TrackBuilderUI({ builder, canvas, onClose, onTestRace, onRequestRender, course, onCourseChange }: TrackBuilderUIProps) {
  const [category, setCategory] = useState<PropCategory>('foliage');
  const [isZen, setIsZen] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'transform' | 'shading' | 'collision' | 'animation'>('transform');
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>(builder.getGizmoMode());
  const [gizmoSpace, setGizmoSpace] = useState<GizmoSpace>(builder.getGizmoSpace());
  const [cameraPreset, setCameraPreset] = useState<'fly' | 'top' | 'front' | 'side' | 'iso'>('fly');
  const [selectedLanePathId, setSelectedLanePathId] = useState<string | null>(null);
  const [laneRevision, setLaneRevision] = useState(0);
  const [laneStatus, setLaneStatus] = useState<string | null>(null);
  const [laneDrawerOpen, setLaneDrawerOpen] = useState(false);
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
  const [decalLightingDefault, setDecalLightingDefault] = useState<boolean>(builder.snapping.decalLightingDefault ?? true);
  const [selectedStageFilter, setSelectedStageFilter] = useState<'all' | 'alpine' | 'canyon' | 'cavern' | 'stadium'>('all');
  const [animDelayTargetFrame, setAnimDelayTargetFrame] = useState<number | 'all'>(0);
  const [delayInputStr, setDelayInputStr] = useState<string>('0');
  const [showSkyMenu, setShowSkyMenu] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [showSnappingMenu, setShowSnappingMenu] = useState(false);
  const [shelfSearch, setShelfSearch] = useState('');
  const [shelfExpanded, setShelfExpanded] = useState(false);
  const shelfScrollRef = useRef<HTMLDivElement>(null);
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; timestamp: number; count: number }>({
    status: 'idle',
    timestamp: 0,
    count: builder.getProps().length,
  });
  const [backupsList, setBackupsList] = useState<{ latest: any; history: any[]; localHistory: any[] }>({
    latest: null,
    history: [],
    localHistory: [],
  });
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [toast, setToast] = useState<string | null>('3D Track Builder Active: WASD to fly (Space: up, Z: down), Right-Drag to look, Click props to select');

  const scrollShelf = (direction: 'left' | 'right') => {
    if (shelfScrollRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      shelfScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };




  const keysRef = useRef(new Set<string>());
  const isRightMouseDown = useRef(false);
  const isDraggingSelected = useRef(false);
  const isRotatingSelected = useRef(false);
  const isDraggingDecalSide = useRef(false);
  const activeDecalSide = useRef<DecalSide | null>(null);
  const lastDragSurfacePoint = useRef<{ x: number; y: number; z: number } | null>(null);
  const clickMoveEnabledRef = useRef(false);
  clickMoveEnabledRef.current = clickMoveEnabled;
  const nudgeAxisRef = useRef<'y' | 'x' | 'z'>('y');
  nudgeAxisRef.current = nudgeAxis;
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  /** The key handler lives in an effect that must not re-bind on every render: it calls through here. */
  const laneIntentRef = useRef<(intent: LaneKeyIntent) => void>(() => {});
  const draggingLaneNode = useRef<string | null>(null);
  const laneDragReason = useRef<string | null>(null);

  const showToast = (msg: string, stickyMs = 3500) => {
    setToast(msg);
    setTimeout(() => setToast(null), stickyMs);
  };
  const shownPlacementErrorRef = useRef<string | null>(null);

  // Sync builder changes
  useEffect(() => {
    const update = () => {
      setSelectedProp(builder.getSelectedProp());
      setSelectedProps(builder.getSelectedProps());
      setActivePropType(builder.getActivePropType());
      setCurrentSky(builder.getSkybox());
      setCameraFacingDefault(builder.snapping.cameraFacingDefault);
      setDecalDefault(builder.snapping.decalDefault ?? false);
      setDecalLightingDefault(builder.snapping.decalLightingDefault ?? true);
      // M01 · T7 — every builder change re-derives the lane panel from the document itself.
      setLaneRevision((revision) => revision + 1);
      // T03: unsupported gameplay-prop placements fail visibly, not silently
      const placementError = builder.getPlacementError();
      if (placementError && placementError !== shownPlacementErrorRef.current) {
        shownPlacementErrorRef.current = placementError;
        showToast(placementError, 6000);
        builder.clearPlacementError();
      }
      if (!placementError) shownPlacementErrorRef.current = null;
      onRequestRender?.();
    };
    builder.onChange(update);
    builder.freeFly.active = true;
    builder.initGizmo(canvas);
    builder.keymap.pushScope('builder');
    return () => {
      builder.freeFly.active = false;
      builder.keymap.popScope('builder');
    };
  }, [builder, canvas, onRequestRender]);

  // Animated decorations preview: advance sheet frames while anything is playing.
  // Gated on hasPlayingAnimations() so idle scenes render nothing extra.
  useEffect(() => {
    const timer = setInterval(() => {
      if (builder.hasPlayingAnimations()) {
        builder.updateAnimations(performance.now() / 1000);
        onRequestRender?.();
      }
    }, 120);
    return () => clearInterval(timer);
  }, [builder, onRequestRender]);

  // Sync course and backup status
  useEffect(() => {
    if (course) {
      builder.setCourse(course);
    }
    const unsub = builder.onBackupStatus((info) => {
      setBackupInfo(info);
    });
    return () => unsub();
  }, [builder, course]);

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
        // M01 · T7 — the lanes tool owns the left button: a handle under the pointer is picked up for a
        // drag (undo pushed once, here, not per frame), and a click on open track clears the selection.
        if (builder.getLanesToolActive()) {
          if (builder.isDraggingGizmo() || builder.isGizmoHovered()) {
            return;
          }
          const hitNode = builder.raycastLaneNode(e.clientX, e.clientY, canvas);
          builder.selectLaneNode(hitNode);
          laneDragReason.current = null;
          if (hitNode) {
            showToast(`Node ${hitNode} [drag gizmo to move · Del delete · K kind · S split · I insert]`);
          }
          setLaneRevision((revision) => revision + 1);
          onRequestRender?.();
          return;
        }
        if (builder.getActivePropType()) {
          const placed = builder.placeActiveProp(e.clientX, e.clientY, canvas);
          if (placed) {
            showToast(`Placed ${placed.name}!`);
            onRequestRender?.();
          }
        } else {
          // Check if clicking decal side handle (yellow manipulation box on decal edges)
          const hitDecalSide = builder.getSelectedProps().length === 1 && builder.raycastDecalSideHandle(e.clientX, e.clientY, canvas);
          if (hitDecalSide) {
            builder.pushUndo();
            isDraggingDecalSide.current = true;
            activeDecalSide.current = hitDecalSide.side;
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            showToast(`Manipulating ${hitDecalSide.side.toUpperCase()} decal edge [Drag up/down to tilt/slope]`);
            return;
          }

          // Check if clicking in-place rotation handle
          if (builder.getSelectedProps().length > 0 && builder.raycastRotateHandle(e.clientX, e.clientY, canvas)) {
            builder.pushUndo();
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
      // M01 · T7 — a lane handle being dragged: pointer → track → snapNode → the tool's own moveNode.
      // A refusal leaves the handle where the document says it is (so dragging along a limit works),
      // and the last reason is held back for pointer-up rather than toasted once per frame.
      if (draggingLaneNode.current && !isRightMouseDown.current) {
        const moved = builder.dragLaneNode(draggingLaneNode.current, e.clientX, e.clientY, canvas);
        laneDragReason.current = moved.ok ? null : moved.reason;
        setLaneRevision((revision) => revision + 1);
        onRequestRender?.();
        return;
      }

      if (isRightMouseDown.current) {
        const dx = e.clientX - lastPointerPos.current.x;
        const dy = e.clientY - lastPointerPos.current.y;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        builder.rotateCamera(dx, dy);
        onRequestRender?.();
      }

      // Dragging decal side handle (raising/lowering front, back, left, right edge)
      if (isDraggingDecalSide.current && activeDecalSide.current && !isRightMouseDown.current) {
        const dy = e.clientY - lastPointerPos.current.y;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        const selected = builder.getSelectedProp();
        if (selected && dy !== 0) {
          const deltaElevation = -dy * 1.5;
          builder.nudgeDecalSide(selected.id, activeDecalSide.current, deltaElevation, false, false);
          onRequestRender?.();
        }
        return;
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

      if (builder.getLanesToolActive() && !builder.getActivePropType()) {
        // The lanes tool: a grab cursor over a handle, nothing special anywhere else.
        canvas.style.cursor = builder.raycastLaneNode(e.clientX, e.clientY, canvas) ? 'grab' : 'default';
        return;
      }

      if (builder.getActivePropType()) {
        builder.updateGhostPosition(e.clientX, e.clientY, canvas);
        canvas.style.cursor = 'crosshair';
        onRequestRender?.();
      } else {
        // Hover check in select mode
        const hitDecalSide = builder.getSelectedProps().length === 1 && builder.raycastDecalSideHandle(e.clientX, e.clientY, canvas);
        const hitHandle = builder.getSelectedProps().length > 0 && builder.raycastRotateHandle(e.clientX, e.clientY, canvas);
        const hitProp = builder.raycastProp(e.clientX, e.clientY, canvas);
        if (hitDecalSide) {
          canvas.style.cursor = 'ns-resize';
        } else if (hitHandle) {
          canvas.style.cursor = 'grab';
        } else if (hitProp) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
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
        if (draggingLaneNode.current) {
          // The drag is over: say the last refusal once, if it was anything worth saying. "unchanged"
          // is what a drag that never left its node reports, and that is not news.
          const reason = laneDragReason.current;
          draggingLaneNode.current = null;
          laneDragReason.current = null;
          if (reason && !reason.startsWith('unchanged')) showToast(reason, 5000);
          setLaneRevision((revision) => revision + 1);
          onRequestRender?.();
        }
        if (isDraggingDecalSide.current) {
          isDraggingDecalSide.current = false;
          activeDecalSide.current = null;
          builder.saveToStorage();
          onRequestRender?.();
        }
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

  // M01 · T7 — the lanes tool. Its handles are drawn only while this tab is open, and leaving the tab
  // puts the tool away (which also clears the node selection). Opening it ends any pending prop
  // placement, because two tools must not share the left mouse button.
  useEffect(() => {
    if (category === 'lanes') {
      builder.setActivePropType(null);
      builder.setLanesToolActive(true);
      if (!builder.getLaneNetwork()) {
        const defaultNet = createDefaultLaneNetwork(course ?? 'ridge');
        builder.setLaneNetwork(defaultNet);
        setSelectedLanePathId('default-lane-1');
        setLaneStatus('Generated standard 4 lanes (~10m node spacing, 121 nodes/lane)');
        refreshLanes();
      } else if (!selectedLanePathId && builder.getLaneNetwork()?.paths.length) {
        setSelectedLanePathId(builder.getLaneNetwork()!.paths[0].id);
      }
    } else {
      builder.setLanesToolActive(false);
    }
    onRequestRender?.();
    return () => { builder.setLanesToolActive(false); };
  }, [builder, category, course, onRequestRender, selectedLanePathId]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // Always track pressed keys for free-fly camera movement
      keysRef.current.add(e.code);

      // M01 · T7 — while the lanes tool is up, N/I/Del/K/M/O and Ctrl+Z / Ctrl+Y belong to it.
      // S key is reserved for reverse flying unless Shift/Alt is held or not in freeFly mode.
      if (builder.getLanesToolActive()) {
        const isReverseFlying = (e.code === 'KeyS' || e.key === 's' || e.key === 'S') && (isRightMouseDown.current || builder.freeFly.active);
        const intent = isReverseFlying ? null : laneKeyIntent({ key: e.key, ctrlOrMeta: e.ctrlKey || e.metaKey, typing: false });
        if (intent) {
          e.preventDefault();
          laneIntentRef.current(intent);
          return;
        }

        const selectedNode = builder.getSelectedLaneNode();
        if (selectedNode) {
          if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            builder.focusOnLaneNode(selectedNode.id);
            showToast(`Framed node ${selectedNode.id} in view`);
            onRequestRender?.();
            return;
          }
          if (e.code === 'BracketLeft') {
            e.preventDefault();
            const net = builder.getLaneNetwork();
            const activePath = net?.paths.find((p) => p.id === selectedLanePathId) ?? net?.paths.find((p) => p.nodeIds.includes(selectedNode.id));
            if (activePath) {
              const idx = activePath.nodeIds.indexOf(selectedNode.id);
              if (idx > 0) {
                const prevId = activePath.nodeIds[idx - 1];
                builder.selectLaneNode(prevId);
                builder.focusOnLaneNode(prevId);
                refreshLanes();
                onRequestRender?.();
                showToast(`Node ${prevId} (${idx}/${activePath.nodeIds.length})`);
              }
            }
            return;
          }
          if (e.code === 'BracketRight') {
            e.preventDefault();
            const net = builder.getLaneNetwork();
            const activePath = net?.paths.find((p) => p.id === selectedLanePathId) ?? net?.paths.find((p) => p.nodeIds.includes(selectedNode.id));
            if (activePath) {
              const idx = activePath.nodeIds.indexOf(selectedNode.id);
              if (idx >= 0 && idx < activePath.nodeIds.length - 1) {
                const nextId = activePath.nodeIds[idx + 1];
                builder.selectLaneNode(nextId);
                builder.focusOnLaneNode(nextId);
                refreshLanes();
                onRequestRender?.();
                showToast(`Node ${nextId} (${idx + 2}/${activePath.nodeIds.length})`);
              }
            }
            return;
          }
        }
      }

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
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        const selected = builder.getSelectedProps();
        if (selected.length > 0) {
          e.preventDefault();
          const stepDeg = e.shiftKey ? -15 : 15;
          builder.pushUndo();
          builder.rotateSelectedProps((stepDeg * Math.PI) / 180);
          showToast(`Rotated ${selected.length} item(s) (${stepDeg > 0 ? `+${stepDeg}` : stepDeg}°) [Key: R]`);
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
      } else if (e.code === 'KeyW' && !(e.ctrlKey || e.metaKey || e.altKey) && isRightMouseDown.current === false) {
        e.preventDefault();
        builder.setGizmoMode('translate');
        showToast('Gizmo: Translate [W]');
      } else if (e.code === 'KeyE' && !(e.ctrlKey || e.metaKey || e.altKey) && isRightMouseDown.current === false) {
        e.preventDefault();
        builder.setGizmoMode('rotate');
        showToast('Gizmo: Rotate [E]');
      } else if (e.code === 'KeyR' && !(e.ctrlKey || e.metaKey || e.altKey) && isRightMouseDown.current === false) {
        e.preventDefault();
        builder.setGizmoMode('scale');
        showToast('Gizmo: Scale [R]');
      } else if (e.code === 'KeyQ' && !(e.ctrlKey || e.metaKey || e.altKey) && isRightMouseDown.current === false) {
        e.preventDefault();
        const next = builder.cycleGizmoSpace();
        showToast(`Gizmo Space: ${next.toUpperCase()} [Q]`);
      } else if (e.code === 'KeyG' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          if (builder.ungroupSelected()) showToast('Ungrouped selection');
        } else {
          if (builder.groupSelected()) showToast('Grouped selection');
        }
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        builder.setActivePropType(null);
        showToast('Select / Inspect Tool Active');
      } else if (e.code === 'Tab' || (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        setIsZen((prev) => !prev);
      } else if ((e.key === '?' || (e.code === 'Slash' && e.shiftKey)) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowCheatSheet((prev) => !prev);
      } else if (e.code === 'Numpad7') {
        e.preventDefault();
        builder.setCameraPreset('top');
        setCameraPreset('top');
        showToast('Camera: Top Ortho View [Num 7]');
        onRequestRender?.();
      } else if (e.code === 'Numpad1') {
        e.preventDefault();
        builder.setCameraPreset('front');
        setCameraPreset('front');
        showToast('Camera: Front Ortho View [Num 1]');
        onRequestRender?.();
      } else if (e.code === 'Numpad3') {
        e.preventDefault();
        builder.setCameraPreset('side');
        setCameraPreset('side');
        showToast('Camera: Side Ortho View [Num 3]');
        onRequestRender?.();
      } else if (e.code === 'Numpad0') {
        e.preventDefault();
        builder.setCameraPreset('iso');
        setCameraPreset('iso');
        showToast('Camera: Isometric View [Num 0]');
        onRequestRender?.();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (builder.isDraggingGizmo()) {
          builder.cancelGizmoDrag();
          showToast('Transform cancelled');
        } else if (builder.getActivePropType()) {
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

  const refreshBackupsList = async () => {
    setIsLoadingBackups(true);
    try {
      const data = await builder.fetchBackups();
      setBackupsList(data);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (showBackupsModal) {
      refreshBackupsList();
    }
  }, [showBackupsModal]);

  const handleSaveDiskBackup = async () => {
    const res = await builder.backupToFile(true);
    if (res) {
      showToast(`Saved backup file to disk! (${res.count} props)`);
      refreshBackupsList();
    } else {
      showToast('Disk backup saved.');
      refreshBackupsList();
    }
  };

  const handleRestoreStarterDecorations = async () => {
    if (confirm('Restore the 14 starter track decorations? This will replace your current placed props.')) {
      await builder.restoreDefaultPreset();
      showToast('Restored 14 starter track decorations!');
      setShowBackupsModal(false);
    }
  };

  const handleRestoreFile = async (filename: string) => {
    if (confirm(`Restore backup file "${filename}"?`)) {
      const ok = await builder.restoreBackupFile(filename);
      if (ok) {
        showToast(`Restored backup ${filename}!`);
        setShowBackupsModal(false);
      } else {
        showToast('Failed to restore backup file.');
      }
    }
  };

  const handleRestoreLocalSnapshot = (props: PlacedProp[]) => {
    if (confirm(`Restore browser snapshot with ${props.length} props?`)) {
      builder.pushUndo();
      builder.importJson(JSON.stringify(props));
      showToast(`Restored ${props.length} props from browser backup!`);
      setShowBackupsModal(false);
    }
  };

  const handleDownloadSpecificBackup = (data: any, name: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${name}!`);
  };

  // Click-outside listener to dismiss topbar dropdown menus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.builder-dropdown-menu') || target.closest('[data-dropdown-trigger]')) {
        return;
      }
      setShowFileMenu(false);
      setShowCameraMenu(false);
      setShowSnappingMenu(false);
      setShowSkyMenu(false);
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  const displayedProps = useMemo(() => {
    if (shelfSearch.trim()) {
      const q = shelfSearch.toLowerCase().trim();
      return PROP_DEFINITIONS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return PROP_DEFINITIONS.filter((p) => p.category === category);
  }, [category, shelfSearch]);

  const placedProps = builder.getProps();


  /* ---------------------------------------------------------------------------
     M01 · T7 — the lanes tool's wiring.
     ---------------------------------------------------------------------------
     The panel is presentational: everything it asks for becomes one `laneEditForCommand`
     (pure: command + document + selection → edit) and then one builder call, which either lands or
     refuses with a reason. A refusal is a toast and nothing changes — no half-applied edit, no undo
     entry. The model is re-derived from the builder's own change notifications, so React never keeps
     a second copy of the document that could drift from the one being edited.
     ------------------------------------------------------------------------- */

  const laneModel = useMemo(
    () => lanePanelModel(builder.getLaneNetwork(), {
      nodeId: builder.getSelectedLaneNode()?.id ?? null,
      pathId: selectedLanePathId,
    }),
    [builder, laneRevision, selectedLanePathId],
  );

  const refreshLanes = () => setLaneRevision((revision) => revision + 1);

  const initSampleLanes = () => {
    const sample = sampleLaneNetwork(course ?? 'ridge');
    builder.setLaneNetwork(sample);
    setSelectedLanePathId(null);
    setLaneStatus('Loaded sample lane network');
    showToast('Loaded sample lane network with merges & loops');
    refreshLanes();
    onRequestRender?.();
  };

  const initDefaultLanes = () => {
    const defaultNet = createDefaultLaneNetwork(course ?? 'ridge');
    builder.setLaneNetwork(defaultNet);
    setSelectedLanePathId('default-lane-1');
    setLaneStatus('Generated standard 4 lanes (~10m node spacing, 121 nodes/lane)');
    showToast('Generated standard 4 lanes (~10m node spacing, 121 nodes/lane)');
    refreshLanes();
    onRequestRender?.();
  };

  const runLaneCommand = (command: LanePanelCommand) => {
    if (command.op === 'newPath' && !builder.getLaneNetwork()) {
      const fresh = createBlankLaneNetwork(course ?? 'ridge');
      builder.setLaneNetwork(fresh);
      setSelectedLanePathId(fresh.paths[0]?.id ?? null);
      setLaneStatus('Created new path');
      showToast('Created initial lane path');
      refreshLanes();
      onRequestRender?.();
      return;
    }

    const outcome = laneEditForCommand(command, builder.getLaneNetwork(), {
      nodeId: builder.getSelectedLaneNode()?.id ?? null,
      pathId: selectedLanePathId,
    });
    if (!outcome.ok) { showToast(outcome.reason, 5000); return; }
    if (outcome.action.kind === 'halfWidth') {
      const result = builder.setLanePathHalfWidth(outcome.action.pathId, outcome.action.halfWidth);
      if (!result.ok) { showToast(result.reason, 5000); return; }
      setLaneStatus(`${outcome.action.pathId} half width ${outcome.action.halfWidth}`);
    } else {
      const result = builder.applyLaneCommand(outcome.action.edit);
      if (!result.ok) { showToast(result.reason, 5000); return; }
      setLaneStatus(`${outcome.action.edit.op} applied`);
    }
    refreshLanes();
    onRequestRender?.();
  };

  const runLaneIntent = (intent: LaneKeyIntent) => {
    switch (intent) {
      case 'undo':
        builder.undo();
        setSelectedLanePathId(null);
        setLaneStatus('Undo');
        break;
      case 'redo':
        builder.redo();
        setSelectedLanePathId(null);
        setLaneStatus('Redo');
        break;
      case 'newPath': runLaneCommand({ op: 'newPath' }); return;
      case 'insert': runLaneCommand({ op: 'insert' }); return;
      case 'delete': runLaneCommand({ op: 'delete' }); return;
      case 'cycleKind': runLaneCommand({ op: 'cycleKind' }); return;
      case 'split': runLaneCommand({ op: 'split' }); return;
      case 'merge': runLaneCommand({ op: 'merge' }); return;
      case 'markOob': runLaneCommand({ op: 'markOob' }); return;
    }
    refreshLanes();
    onRequestRender?.();
  };
  // The key handler is bound once; it calls through the ref so it always sees this render's runner.
  laneIntentRef.current = runLaneIntent;

  const moveLaneNodeFromPanel = (nodeId: string, x: number, z: number) => {
    // A typed coordinate is clamped into the corridor but never snapped: a typed x means that x.
    const clamped = snapNode(x, z, { lanes: false, grid: false });
    const result = builder.applyLaneCommand({ op: 'moveNode', nodeId, x: clamped.x, z: clamped.z });
    if (!result.ok) { showToast(result.reason, 5000); return; }
    setLaneStatus(`Moved ${nodeId}`);
    refreshLanes();
    onRequestRender?.();
  };

  const saveLaneDoc = () => {
    const result = builder.saveLaneDoc();
    if (result.ok) {
      setLaneStatus('Saved to storage');
    } else {
      setLaneStatus(`Not saved: ${result.reason}`);
      showToast(`Lane network not saved: ${result.reason}`, 5000);
    }
    refreshLanes();
  };

  const exportLanes = () => {
    const json = builder.exportLanes();
    setLaneStatus(`Exported ${json.length} bytes of JSON`);
    // The download itself needs a real browser; the status line is its headless-visible half.
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lane-network-${course ?? 'ridge'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { showToast('Export: the browser blocked the download', 5000); }
  };

  const importLanes = (json: string) => {
    const result = builder.importLanes(json);
    if (!result.ok) {
      const codes = result.errors.map((error) => error.code).join(', ');
      setLaneStatus(`Import refused: ${codes}`);
      showToast(`Import refused: ${codes}`, 6000);
    } else {
      setLaneStatus('Imported');
    }
    setSelectedLanePathId(null);
    refreshLanes();
    onRequestRender?.();
  };

  const handleExportPackage = () => {
    try {
      const json = builder.exportHmtPackage();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `track-${course ?? 'ridge'}.hmt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Exported .hmt Track Package');
    } catch (e) {
      showToast(`Package export error: ${(e as Error).message}`);
    }
  };

  const handleBakeAO = () => {
    try {
      const res = builder.bakeVertexAO();
      showToast(`Bake complete: ${res.count} meshes, ${res.totalVertices} vertices with contact AO`);
      onRequestRender?.();
    } catch (e) {
      showToast(`Bake error: ${(e as Error).message}`);
    }
  };

  return (
    <div className="track-builder-root pointer-events-none fixed inset-0 z-50 flex flex-col justify-between select-none">
      {/* Toast notification */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-950/90 border border-amber-500/70 text-amber-200 px-4 py-2 rounded-lg text-sm shadow-xl backdrop-blur-md transition-all">
          {toast}
        </div>
      )}

      {/* Top Bar */}
      {!isZen && (
        <header className="pointer-events-auto relative z-30 bg-zinc-950/90 border-b border-amber-500/40 px-3 py-1.5 backdrop-blur-md text-amber-100 flex items-center justify-between gap-2 shadow-lg select-none">
          {/* Left Zone: Brand + File Menu + Track/Sky + Props Hierarchy */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5 font-bold tracking-wider text-amber-400 text-xs px-2 py-1 bg-amber-950/50 border border-amber-600/40 rounded shadow-inner">
              <Compass size={15} className="text-amber-400" />
              <span className="hidden sm:inline font-mono">FORGE 3D</span>
            </div>

            {/* File & Project Dropdown */}
            <div className="relative">
              <button
                data-dropdown-trigger
                onClick={() => {
                  setShowFileMenu(!showFileMenu);
                  setShowCameraMenu(false);
                  setShowSnappingMenu(false);
                  setShowSkyMenu(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer font-bold ${
                  showFileMenu ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow' : 'bg-zinc-900/90 hover:bg-zinc-800 text-amber-300 border-zinc-700/60'
                }`}
                title="Project, File, Export, Bake and Backup options"
              >
                <FolderDown size={13} />
                <span>File</span>
                <ChevronDown size={11} className={showFileMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>

              {showFileMenu && (
                <div className="builder-dropdown-menu left-0 w-64 flex flex-col gap-1 text-xs">
                  <span className="text-[10px] font-bold text-amber-400 px-2.5 py-1 uppercase tracking-wider border-b border-zinc-800">
                    Project & Storage
                  </span>
                  <button
                    onClick={() => { setShowFileMenu(false); handleExport(); }}
                    className="builder-dropdown-item"
                  >
                    <Download size={14} className="text-amber-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">Export JSON Layout</span>
                      <span className="text-[10px] text-zinc-400">Save placed props to disk JSON</span>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowFileMenu(false); handleImport(); }}
                    className="builder-dropdown-item"
                  >
                    <Upload size={14} className="text-amber-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">Import JSON Layout</span>
                      <span className="text-[10px] text-zinc-400">Load a track props JSON file</span>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowFileMenu(false); handleExportPackage(); }}
                    className="builder-dropdown-item"
                  >
                    <Box size={14} className="text-emerald-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-emerald-300">Export .hmt Track Package</span>
                      <span className="text-[10px] text-zinc-400">Standalone bundle with 3D models</span>
                    </div>
                  </button>
                  <div className="my-1 border-t border-zinc-800/80" />
                  <button
                    onClick={() => { setShowFileMenu(false); handleBakeAO(); }}
                    className="builder-dropdown-item"
                  >
                    <Sparkles size={14} className="text-amber-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-amber-300">Bake Vertex AO & Lighting</span>
                      <span className="text-[10px] text-zinc-400">Raytrace contact occlusion into vertices</span>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowFileMenu(false); setShowBackupsModal(true); }}
                    className="builder-dropdown-item"
                  >
                    <Database size={14} className="text-cyan-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-cyan-300">Backups & Version History</span>
                        {backupInfo.timestamp > 0 && (
                          <span className="text-[9px] text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-700/50">Auto-saved</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">Browse disk snapshots and local history</span>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowFileMenu(false); handleRestoreStarterDecorations(); }}
                    className="builder-dropdown-item"
                  >
                    <RefreshCw size={14} className="text-zinc-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">Restore Starter Preset</span>
                      <span className="text-[10px] text-zinc-400">Load default 14 track decorations</span>
                    </div>
                  </button>
                  <div className="my-1 border-t border-zinc-800/80" />
                  <button
                    onClick={() => {
                      setShowFileMenu(false);
                      if (confirm('Clear all placed props?')) {
                        builder.clearAll();
                        showToast('Cleared all props');
                      }
                    }}
                    className="builder-dropdown-item text-red-400 hover:text-red-300 hover:bg-red-950/40"
                  >
                    <Trash2 size={14} className="text-red-400 shrink-0" />
                    <span className="font-semibold">Clear All Props...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Track Selector */}
            {onCourseChange && (
              <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/60 rounded px-2 py-1 text-xs">
                <span className="text-zinc-400 font-medium text-[11px]">Track:</span>
                <select
                  className="bg-transparent text-amber-300 focus:outline-none cursor-pointer font-bold text-xs"
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

            {/* Skybox Selector */}
            <div className="relative">
              <button
                data-dropdown-trigger
                onClick={() => {
                  setShowSkyMenu(!showSkyMenu);
                  setShowFileMenu(false);
                  setShowCameraMenu(false);
                  setShowSnappingMenu(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-zinc-900/80 hover:bg-zinc-800 text-amber-300 rounded border border-zinc-700/50 font-medium cursor-pointer"
                title="Choose Skydome Environment & Atmosphere"
              >
                <Sun size={12} />
                <span className="hidden md:inline text-[11px]">Sky: {SKY_PRESETS[currentSky]?.name.split(' (')[0] ?? 'Ridge'}</span>
                <ChevronDown size={10} />
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
                          onRequestRender?.();
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
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors cursor-pointer ${
                showPropsDrawer
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/80 font-bold'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/50'
              }`}
              title="View placed props hierarchy in scene"
            >
              <Layers size={13} />
              <span className="text-[11px]">Props ({placedProps.length})</span>
            </button>
          </div>

          {/* Center Zone: DCC Gizmo Bar + Camera Dropdown + Snapping Dropdown */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* DCC Gizmo Toolbar */}
            <div className="flex items-center bg-zinc-900/95 rounded border border-zinc-700/60 p-0.5 text-xs shadow-inner">
              <button
                onClick={() => {
                  builder.setGizmoMode('translate');
                  setGizmoMode('translate');
                  showToast('Gizmo: Translate [W]');
                }}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  gizmoMode === 'translate' ? 'bg-amber-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Translate Gizmo [W]"
              >
                W: Move
              </button>
              <button
                onClick={() => {
                  builder.setGizmoMode('rotate');
                  setGizmoMode('rotate');
                  showToast('Gizmo: Rotate [E]');
                }}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  gizmoMode === 'rotate' ? 'bg-amber-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Rotate Gizmo [E]"
              >
                E: Rotate
              </button>
              <button
                onClick={() => {
                  builder.setGizmoMode('scale');
                  setGizmoMode('scale');
                  showToast('Gizmo: Scale [R]');
                }}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  gizmoMode === 'scale' ? 'bg-amber-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Scale Gizmo [R]"
              >
                R: Scale
              </button>
              <button
                onClick={() => {
                  const next = builder.cycleGizmoSpace();
                  setGizmoSpace(next);
                  showToast(`Gizmo Space: ${next.toUpperCase()} [Q]`);
                }}
                className="px-1.5 py-0.5 text-amber-300 hover:text-amber-200 font-mono text-[10px] cursor-pointer"
                title="Cycle Space (World / Local / Track) [Q]"
              >
                [{gizmoSpace.toUpperCase().slice(0, 4)}]
              </button>
            </div>

            {/* Camera Views Dropdown */}
            <div className="relative">
              <button
                data-dropdown-trigger
                onClick={() => {
                  setShowCameraMenu(!showCameraMenu);
                  setShowFileMenu(false);
                  setShowSnappingMenu(false);
                  setShowSkyMenu(false);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700/60 font-medium cursor-pointer"
                title="Camera Rigs & Orthographic Views [0, 1, 3, 7]"
              >
                <Camera size={12} className="text-amber-400" />
                <span className="text-[11px] capitalize">{cameraPreset} View</span>
                <ChevronDown size={10} />
              </button>

              {showCameraMenu && (
                <div className="builder-dropdown-menu left-0 w-44 flex flex-col gap-0.5 text-xs">
                  <span className="text-[10px] font-bold text-amber-400 px-2 py-1 uppercase tracking-wider border-b border-zinc-800">
                    Camera Rig Views
                  </span>
                  <button
                    onClick={() => {
                      builder.setCameraPreset('fly');
                      setCameraPreset('fly');
                      setShowCameraMenu(false);
                      showToast('Camera: Perspective Free-Fly [WASD + Right-Drag]');
                      onRequestRender?.();
                    }}
                    className={`builder-dropdown-item ${cameraPreset === 'fly' ? 'bg-amber-950/70 text-amber-200 font-bold border-amber-600/50' : ''}`}
                  >
                    <span>Perspective Fly</span>
                  </button>
                  <button
                    onClick={() => {
                      builder.setCameraPreset('top');
                      setCameraPreset('top');
                      setShowCameraMenu(false);
                      showToast('Camera: Top Ortho View [Num 7]');
                      onRequestRender?.();
                    }}
                    className={`builder-dropdown-item ${cameraPreset === 'top' ? 'bg-amber-950/70 text-amber-200 font-bold border-amber-600/50' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>Top Ortho</span>
                      <span className="text-[10px] text-zinc-500 font-mono">[Num 7]</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      builder.setCameraPreset('front');
                      setCameraPreset('front');
                      setShowCameraMenu(false);
                      showToast('Camera: Front Ortho View [Num 1]');
                      onRequestRender?.();
                    }}
                    className={`builder-dropdown-item ${cameraPreset === 'front' ? 'bg-amber-950/70 text-amber-200 font-bold border-amber-600/50' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>Front Ortho</span>
                      <span className="text-[10px] text-zinc-500 font-mono">[Num 1]</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      builder.setCameraPreset('side');
                      setCameraPreset('side');
                      setShowCameraMenu(false);
                      showToast('Camera: Side Ortho View [Num 3]');
                      onRequestRender?.();
                    }}
                    className={`builder-dropdown-item ${cameraPreset === 'side' ? 'bg-amber-950/70 text-amber-200 font-bold border-amber-600/50' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>Side Ortho</span>
                      <span className="text-[10px] text-zinc-500 font-mono">[Num 3]</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      builder.setCameraPreset('iso');
                      setCameraPreset('iso');
                      setShowCameraMenu(false);
                      showToast('Camera: Isometric View [Num 0]');
                      onRequestRender?.();
                    }}
                    className={`builder-dropdown-item ${cameraPreset === 'iso' ? 'bg-amber-950/70 text-amber-200 font-bold border-amber-600/50' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>Isometric</span>
                      <span className="text-[10px] text-zinc-500 font-mono">[Num 0]</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Snapping & Placement Dropdown */}
            <div className="relative">
              <button
                data-dropdown-trigger
                onClick={() => {
                  setShowSnappingMenu(!showSnappingMenu);
                  setShowFileMenu(false);
                  setShowCameraMenu(false);
                  setShowSkyMenu(false);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors cursor-pointer font-medium ${
                  alignToTrack || snapToCenterline
                    ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                    : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/50'
                }`}
                title="Surface alignment, snapping, billboard & decal placement options"
              >
                <Magnet size={12} className={alignToTrack || snapToCenterline ? 'text-amber-400' : 'text-zinc-400'} />
                <span className="text-[11px]">Snapping</span>
                <ChevronDown size={10} />
              </button>

              {showSnappingMenu && (
                <div className="builder-dropdown-menu left-0 w-64 flex flex-col gap-1 p-2 text-xs">
                  <span className="text-[10px] font-bold text-amber-400 px-1 py-0.5 uppercase tracking-wider border-b border-zinc-800">
                    Placement & Snapping
                  </span>
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-zinc-900 cursor-pointer">
                    <span className="text-zinc-200 font-medium">Align to Track Surface</span>
                    <input
                      type="checkbox"
                      checked={alignToTrack}
                      onChange={(e) => {
                        setAlignToTrack(e.target.checked);
                        builder.snapping.alignToTrack = e.target.checked;
                      }}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-zinc-900 cursor-pointer">
                    <span className="text-zinc-200 font-medium">Snap to Centerline</span>
                    <input
                      type="checkbox"
                      checked={snapToCenterline}
                      onChange={(e) => {
                        setSnapToCenterline(e.target.checked);
                        builder.snapping.snapToCenterline = e.target.checked;
                      }}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-zinc-900 cursor-pointer">
                    <span className="text-zinc-200 font-medium">Camera Facing (Billboard)</span>
                    <input
                      type="checkbox"
                      checked={cameraFacingDefault}
                      onChange={(e) => {
                        setCameraFacingDefault(e.target.checked);
                        builder.setCameraFacingDefault(e.target.checked);
                        showToast(e.target.checked ? 'Mode: Billboard Camera Facing' : 'Mode: Fixed 3D Orientation');
                      }}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-zinc-900 cursor-pointer">
                    <span className="text-zinc-200 font-medium">Decal (Flat on Track)</span>
                    <input
                      type="checkbox"
                      checked={decalDefault}
                      onChange={(e) => {
                        setDecalDefault(e.target.checked);
                        builder.setDecalDefault(e.target.checked);
                        showToast(e.target.checked ? 'Default: Flat Decal' : 'Default: Upright Decoration');
                      }}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-zinc-900 cursor-pointer">
                    <span className="text-zinc-200 font-medium">Decal Receives Track Lighting</span>
                    <input
                      type="checkbox"
                      checked={decalLightingDefault}
                      onChange={(e) => {
                        setDecalLightingDefault(e.target.checked);
                        builder.setDecalLightingDefault(e.target.checked);
                        showToast(e.target.checked ? 'Decals: Lit by Track' : 'Decals: Unlit Raw');
                      }}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Right Zone: Undo/Redo + Help + Zen + Test Race + Exit */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => builder.undo()}
              className="p-1 text-zinc-300 hover:text-amber-400 bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-700/50 cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={13} />
            </button>
            <button
              onClick={() => builder.redo()}
              className="p-1 text-zinc-300 hover:text-amber-400 bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-700/50 cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={13} />
            </button>
            <button
              onClick={() => setShowCheatSheet(true)}
              className="p-1 text-amber-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-700/50 cursor-pointer"
              title="Hotkeys & Cheat Sheet [?]"
            >
              <HelpCircle size={13} />
            </button>
            <button
              onClick={() => setIsZen(true)}
              className="p-1 text-zinc-400 hover:text-amber-300 bg-zinc-900/80 hover:bg-zinc-800 rounded border border-zinc-700/50 cursor-pointer"
              title="Enter Zen Mode [H / Tab]"
            >
              <Maximize2 size={13} />
            </button>

            {onTestRace && (
              <button
                onClick={(e) => {
                  (e.currentTarget as HTMLElement)?.blur();
                  (document.activeElement as HTMLElement)?.blur();
                  onTestRace();
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors shadow-md shadow-emerald-700/30 cursor-pointer ml-1"
                title="Test drive on this track!"
              >
                <Play size={12} fill="currentColor" /> TEST RACE
              </button>
            )}

            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded transition-colors cursor-pointer"
            >
              {onTestRace ? 'MENU' : 'EXIT [B]'}
            </button>
          </div>
        </header>
      )}


      {/* Placed Props Scene Drawer */}
      {showPropsDrawer && !isZen && (
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

          {/* Batch Decal Lighting per Section Controls */}
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-3 py-2 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-amber-300 flex items-center gap-1">
                <Sun size={12} className="text-amber-400" />
                <span>DECAL LIGHTING:</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const count = builder.setAllDecalsLighting(true, selectedStageFilter);
                    showToast(`Enabled lighting for ${count} decals in ${selectedStageFilter === 'all' ? 'all sections' : selectedStageFilter}`);
                    onRequestRender?.();
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 cursor-pointer"
                  title="Turn lighting ON for decals in this section (matches track lighting)"
                >
                  ALL ON
                </button>
                <button
                  onClick={() => {
                    const count = builder.setAllDecalsLighting(false, selectedStageFilter);
                    showToast(`Disabled lighting for ${count} decals in ${selectedStageFilter === 'all' ? 'all sections' : selectedStageFilter}`);
                    onRequestRender?.();
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 cursor-pointer"
                  title="Turn lighting OFF for decals in this section (raw unlit texture)"
                >
                  ALL OFF
                </button>
              </div>
            </div>
            {/* Batch Animated Props per Section Controls */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
              <span className="font-bold text-[11px] text-fuchsia-300 flex items-center gap-1">
                <Film size={12} className="text-fuchsia-400" />
                <span>ANIMATED PROPS:</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const count = builder.setAllPropsAnimated(true, selectedStageFilter);
                    showToast(`Swapped ${count} props to animated versions in ${selectedStageFilter === 'all' ? 'entire track' : selectedStageFilter}`);
                    onRequestRender?.();
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 rounded border border-fuchsia-500/40 cursor-pointer flex items-center gap-1"
                  title="Switch all props in this section to their animated versions"
                >
                  <Film size={10} /> ALL ANIMATED
                </button>
                <button
                  onClick={() => {
                    const count = builder.setAllPropsAnimated(false, selectedStageFilter);
                    showToast(`Swapped ${count} props back to still versions in ${selectedStageFilter === 'all' ? 'entire track' : selectedStageFilter}`);
                    onRequestRender?.();
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 cursor-pointer flex items-center gap-1"
                  title="Switch all animated props in this section back to still versions"
                >
                  ALL STILL
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400">Section:</span>
              <select
                value={selectedStageFilter}
                onChange={(e) => setSelectedStageFilter(e.target.value as any)}
                className="flex-1 bg-zinc-950 text-amber-200 border border-zinc-700/60 rounded px-1.5 py-0.5 text-[10px] cursor-pointer"
              >
                <option value="all">Entire Track (All Decals)</option>
                <option value="alpine">Section 1: Alpine Downhill</option>
                <option value="canyon">Section 2: Canyon & Waterfall</option>
                <option value="cavern">Section 3: Cavern & Mine</option>
                <option value="stadium">Section 4: Stadium Finish</option>
              </select>
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
      {!isZen && (selectedProps.length > 1 ? (
        <div className="pointer-events-auto self-end mr-4 mb-auto mt-4 w-80 max-h-[calc(100vh-17rem)] overflow-y-auto scrollbar-thin bg-zinc-950/95 border border-cyan-500/60 rounded-lg p-3.5 shadow-2xl backdrop-blur-md text-cyan-100 flex flex-col gap-2.5">
          <div className="sticky -top-3.5 -mx-3.5 px-3.5 pt-1 pb-2 bg-zinc-950/95 backdrop-blur-md z-10 border-b border-zinc-800 flex items-center justify-between shrink-0">
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

          {/* Batch Atmosphere Lighting Bar */}
          <div className="bg-zinc-900/80 rounded-md p-2 border border-zinc-800 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Sun size={13} className="text-amber-400" />
                <span>Atmosphere Lighting:</span>
              </span>
              <span className="text-[10px] text-zinc-400">
                {selectedProps.filter((p) => p.lit !== false).length}/{selectedProps.length} Lit
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  builder.setSelectedPropsLighting(true);
                  showToast(`Atmosphere lighting enabled for ${selectedProps.length} items`);
                  onRequestRender?.();
                }}
                className="flex-1 py-1 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold rounded border border-amber-500/40 cursor-pointer flex items-center justify-center gap-1"
                title="Enable atmosphere lighting for all selected items (matches track lighting)"
              >
                <Sun size={11} /> All ON (Lit)
              </button>
              <button
                onClick={() => {
                  builder.setSelectedPropsLighting(false);
                  showToast(`Atmosphere lighting disabled for ${selectedProps.length} items`);
                  onRequestRender?.();
                }}
                className="flex-1 py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded border border-zinc-700 cursor-pointer flex items-center justify-center gap-1"
                title="Disable atmosphere lighting for all selected items (raw unlit)"
              >
                All OFF (Unlit)
              </button>
            </div>

            {/* Batch Animated Props Controls */}
            <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Film size={13} className="text-fuchsia-400" />
                <span>Animated Versions:</span>
              </span>
              <span className="text-[10px] text-zinc-400">
                {selectedProps.filter((p) => p.animated === true || PROP_DEFINITIONS.find((d) => d.type === p.type)?.isAnimated).length}/{selectedProps.filter((p) => propHasAnimatedOption(p)).length} Animated
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  builder.setSelectedPropsAnimated(true);
                  showToast(`Swapped eligible selected props to animated versions`);
                  onRequestRender?.();
                }}
                className="flex-1 py-1 px-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 text-[11px] font-bold rounded border border-fuchsia-500/40 cursor-pointer flex items-center justify-center gap-1"
                title="Switch selected props to their animated versions"
              >
                <Film size={11} /> All Animated
              </button>
              <button
                onClick={() => {
                  builder.setSelectedPropsAnimated(false);
                  showToast(`Swapped selected props back to still versions`);
                  onRequestRender?.();
                }}
                className="flex-1 py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded border border-zinc-700 cursor-pointer flex items-center justify-center gap-1"
                title="Switch selected props back to still versions"
              >
                All Still (Back)
              </button>
            </div>
            <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400 border-t border-zinc-800/40">
              <span>All Props (Track):</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const count = builder.setAllPropsAnimated(true);
                    showToast(`Swapped all ${count} track props to animated versions`);
                    onRequestRender?.();
                  }}
                  className="px-2 py-0.5 font-bold rounded bg-fuchsia-950/70 hover:bg-fuchsia-900/90 text-fuchsia-300 border border-fuchsia-800/50 cursor-pointer flex items-center gap-1"
                  title="Switch ALL props across the entire track to animated versions"
                >
                  <Film size={10} /> Entire Track Animated
                </button>
                <button
                  onClick={() => {
                    const count = builder.setAllPropsAnimated(false);
                    showToast(`Swapped all ${count} track props back to still versions`);
                    onRequestRender?.();
                  }}
                  className="px-2 py-0.5 font-bold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
                  title="Switch ALL props across the entire track back to still versions"
                >
                  Track Still
                </button>
              </div>
            </div>
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
            <span className="text-zinc-400 font-medium">Orbit Yaw (around Centroid) [Key: R]:</span>
            <div className="grid grid-cols-7 gap-1">
              {[-90, -45, -15, 15, 45, 90, 180].map((deg) => (
                <button
                  key={deg}
                  onClick={() => {
                    builder.pushUndo();
                    builder.rotateSelectedProps((deg * Math.PI) / 180);
                    onRequestRender?.();
                  }}
                  className="px-1 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-cyan-300 rounded border border-zinc-700 cursor-pointer text-center font-mono font-bold"
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

          {/* Group Camera Facing Toggle */}
          <div className="flex items-center justify-between pt-1 pb-1 text-xs border-t border-zinc-800/60">
            <span className="text-zinc-400">Camera Facing:</span>
            <button
              onClick={() => {
                const anyNotFacing = selectedProps.some((p) => p.cameraFacing === false);
                const next = anyNotFacing;
                builder.pushUndo();
                for (const p of selectedProps) {
                  const def = PROP_DEFINITIONS.find((d) => d.type === p.type);
                  if (def?.isRamp || def?.isSlingshot || def?.is3DModel || p.isDecal) continue;
                  builder.updatePropTransform(p.id, { cameraFacing: next }, false);
                }
                builder.setCameraFacingDefault(next);
                setCameraFacingDefault(next);
                showToast(next ? 'Switched group to Camera Facing (Billboard) [Active for future placements]' : 'Switched group to Fixed 3D World Orientation [Active for future placements]');
                onRequestRender?.();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 cursor-pointer"
              title="Toggle whether selected decorations rotate to face the camera (billboard) or stay fixed in 3D world space. Also switches placement mode for all future decorations."
            >
              <Camera size={13} />
              <span>Toggle Billboard Mode</span>
            </button>
          </div>

          {/* Group Animation controls (animated sheets + stills that have one) */}
          {(() => {
            const animatedSelected = selectedProps.filter((p) => propHasAnimatedOption(p));
            if (animatedSelected.length === 0) return null;
            const playingCount = animatedSelected.filter((p) => p.animate !== false).length;
            const swapCount = animatedSelected.filter((p) => {
              const def = PROP_DEFINITIONS.find((d) => d.type === p.type);
              return def?.isAnimated === true || p.animated === true;
            }).length;
            const speeds = animatedSelected.map((p) => animSpeedFor(p));
            const uniformSpeed = speeds.every((s) => s === speeds[0]);
            const nudgeAllSpeeds = (delta: number) => {
              builder.nudgeSelectedAnimSpeed(delta);
              onRequestRender?.();
            };
            return (
              <div className="bg-zinc-900/80 rounded-md p-2 border border-zinc-800 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <Clapperboard size={13} className="text-fuchsia-400" />
                    <span>Animation:</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {playingCount}/{animatedSelected.length} Playing · {swapCount} Animated
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      builder.setSelectedPropsAnimate(true);
                      showToast(`Animation enabled for ${animatedSelected.length} items`);
                      onRequestRender?.();
                    }}
                    className="flex-1 py-1 px-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 text-[11px] font-bold rounded border border-fuchsia-500/40 cursor-pointer flex items-center justify-center gap-1"
                    title="Play animation on all selected decorations that have an animated sheet"
                  >
                    <Clapperboard size={11} /> All PLAY
                  </button>
                  <button
                    onClick={() => {
                      builder.setSelectedPropsAnimate(false);
                      showToast(`Animation paused for ${animatedSelected.length} items`);
                      onRequestRender?.();
                    }}
                    className="flex-1 py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded border border-zinc-700 cursor-pointer flex items-center justify-center gap-1"
                    title="Pause animation on all selected decorations (holds the first enabled frame)"
                  >
                    <Pause size={11} /> All PAUSE
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      builder.setSelectedPropsAnimated(true);
                      showToast(`Swapped ${animatedSelected.length} items to their animated sheets`);
                      onRequestRender?.();
                    }}
                    className="flex-1 py-1 px-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 text-[11px] font-bold rounded border border-fuchsia-500/40 cursor-pointer flex items-center justify-center gap-1"
                    title="Swap every selected still decoration to its animated 4-frame sheet"
                  >
                    <Film size={11} /> All ANIMATED
                  </button>
                  <button
                    onClick={() => {
                      builder.setSelectedPropsAnimated(false);
                      showToast(`Swapped ${animatedSelected.length} items back to still artwork`);
                      onRequestRender?.();
                    }}
                    className="flex-1 py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded border border-zinc-700 cursor-pointer flex items-center justify-center gap-1"
                    title="Swap every selected animated sheet back to its still artwork"
                  >
                    <Film size={11} /> All STILL
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px]">Speed</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => nudgeAllSpeeds(-ANIM_SPEED_STEP)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 cursor-pointer"
                      title="Slow every selected animation down"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-12 text-center font-mono text-zinc-200 text-[11px]">
                      {uniformSpeed ? `${speeds[0].toFixed(2)}x` : 'mixed'}
                    </span>
                    <button
                      onClick={() => nudgeAllSpeeds(ANIM_SPEED_STEP)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 cursor-pointer"
                      title="Speed every selected animation up"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
        <div className="pointer-events-auto self-end mr-4 mb-auto mt-4 w-80 max-h-[calc(100vh-17rem)] overflow-y-auto scrollbar-thin bg-zinc-950/95 border border-amber-500/60 rounded-lg p-3.5 shadow-2xl backdrop-blur-md text-amber-100 flex flex-col gap-2.5">
          <div className="sticky -top-3.5 -mx-3.5 px-3.5 pt-1 pb-2 bg-zinc-950/95 backdrop-blur-md z-10 border-b border-zinc-800 flex items-center justify-between shrink-0">
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

          {/* Sub-tabs: Transform, Shading, Collision, Animation */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/60 rounded text-xs overflow-hidden">
            <button
              onClick={() => setInspectorTab('transform')}
              className={`flex-1 py-1.5 font-bold text-center border-b-2 transition-all cursor-pointer ${
                inspectorTab === 'transform' ? 'border-amber-400 text-amber-300 bg-zinc-800/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Transform
            </button>
            <button
              onClick={() => setInspectorTab('shading')}
              className={`flex-1 py-1.5 font-bold text-center border-b-2 transition-all cursor-pointer ${
                inspectorTab === 'shading' ? 'border-amber-400 text-amber-300 bg-zinc-800/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Shading
            </button>
            <button
              onClick={() => setInspectorTab('collision')}
              className={`flex-1 py-1.5 font-bold text-center border-b-2 transition-all cursor-pointer ${
                inspectorTab === 'collision' ? 'border-amber-400 text-amber-300 bg-zinc-800/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Collision
            </button>
            {propHasAnimatedOption(selectedProp) && (
              <button
                onClick={() => setInspectorTab('animation')}
                className={`flex-1 py-1.5 font-bold text-center border-b-2 transition-all cursor-pointer ${
                  inspectorTab === 'animation' ? 'border-fuchsia-400 text-fuchsia-300 bg-zinc-800/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Animation
              </button>
            )}
          </div>

          {inspectorTab === 'shading' && (
            <ShadingPanel
              descriptor={selectedProp.materialDesc ?? DEFAULT_MATERIAL_DESCRIPTOR}
              onChange={(updated) => {
                const next = { ...(selectedProp.materialDesc ?? DEFAULT_MATERIAL_DESCRIPTOR), ...updated };
                builder.updatePropTransform(selectedProp.id, { materialDesc: next });
                onRequestRender?.();
              }}
            />
          )}

          {inspectorTab === 'collision' && (
            <CollisionPanel
              roleConfig={selectedProp.roleConfig ?? DEFAULT_ROLE_CONFIGS.decoration}
              onChange={(updated) => {
                const next = { ...(selectedProp.roleConfig ?? DEFAULT_ROLE_CONFIGS.decoration), ...updated };
                builder.updatePropTransform(selectedProp.id, { roleConfig: next });
                onRequestRender?.();
              }}
              patchHash={selectedProp.patchHash as string | undefined}
              triangleCount={selectedProp.triangleCount as number | undefined}
            />
          )}

          {inspectorTab === 'transform' && (
            <>
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
              <span>Rotation Y (Yaw) [Key: R]:</span>
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
            <div className="grid grid-cols-6 gap-1 pt-0.5">
              {[-90, -45, -15, 15, 45, 90].map((deg) => (
                <button
                  key={deg}
                  onClick={() => {
                    builder.pushUndo();
                    const deltaRad = (deg * Math.PI) / 180;
                    builder.updatePropTransform(selectedProp.id, {
                      rotY: (selectedProp.rotY ?? 0) + deltaRad,
                    });
                    onRequestRender?.();
                  }}
                  className="px-1 py-0.5 text-[10px] bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/50 cursor-pointer text-center font-mono font-bold"
                  title={`Rotate ${deg > 0 ? `+${deg}` : deg}°`}
                >
                  {deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>
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
              <>
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

                {/* Atmosphere Lighting Toggle for Decal */}
                <div className="flex items-center justify-between pt-1.5 pb-1 text-xs border-t border-zinc-800/60">
                  <div className="flex flex-col">
                    <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                      <Sun size={13} className={selectedProp.lit !== false ? "text-amber-400" : "text-zinc-500"} />
                      <span>Atmosphere Lighting:</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {selectedProp.lit !== false ? 'Matches sky sun, ambient & fog' : 'Raw unlit texture (original bright)'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const nextLit = selectedProp.lit === false;
                      builder.updatePropTransform(selectedProp.id, { lit: nextLit });
                      showToast(nextLit ? 'Decal lighting: ON (Matches track lighting)' : 'Decal lighting: OFF (Raw unlit texture)');
                      onRequestRender?.();
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold border transition-colors cursor-pointer ${
                      selectedProp.lit !== false
                        ? 'bg-amber-600/90 hover:bg-amber-500 text-zinc-950 border-amber-400 shadow-sm'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700'
                    }`}
                    title="Toggle whether this decal receives colored lighting and fog from the current sky atmosphere (matching the dirt track), or renders unlit at original brightness"
                  >
                    <Sun size={12} />
                    <span>{selectedProp.lit !== false ? 'ON (Lit)' : 'OFF (Unlit)'}</span>
                  </button>
                </div>

                {isDecal && (
                  <div className="pt-2 pb-1 border-t border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <Compass size={13} /> Terrain Slope Alignment
                      </span>
                      {(() => {
                        const angles = builder.getDecalAngles(selectedProp);
                        return (
                          <span className="text-[10px] font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            Pitch: {angles.pitchDeg}° | Roll: {angles.rollDeg}°
                          </span>
                        );
                      })()}
                    </div>

                    {/* Primary Alignment Action Button */}
                    <button
                      onClick={() => {
                        const res = builder.alignDecalToTerrain(selectedProp.id);
                        if (res && res.hit) {
                          showToast(`Decal aligned parallel to terrain (Pitch: ${res.pitchDeg.toFixed(1)}°, Roll: ${res.rollDeg.toFixed(1)}°)`);
                          onRequestRender?.();
                        } else {
                          showToast('Could not find terrain/track directly beneath decal');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold text-xs rounded shadow-md border border-amber-300/80 transition-all cursor-pointer"
                      title="Raycasts straight down and aligns decal perfectly parallel with the track/terrain slope beneath it"
                    >
                      <Compass size={14} />
                      <span>Align Decal Parallel to Terrain</span>
                    </button>

                    {/* Dedicated Decal Surface Heading & Spin */}
                    <div className="bg-zinc-900/90 rounded border border-emerald-500/40 p-2 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                          <RotateCw size={13} />
                          <span>Decal Surface Spin (In-Place)</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-amber-300 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                          {Math.round(((selectedProp.rotY ?? 0) * 180) / Math.PI)}°
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        Spins decal flat on the surface without detaching from slope [Key: R]:
                      </p>
                      <input
                        type="range"
                        min={-Math.PI}
                        max={Math.PI}
                        step="0.02"
                        value={selectedProp.rotY ?? 0}
                        onChange={(e) => {
                          builder.updatePropTransform(selectedProp.id, { rotY: parseFloat(e.target.value) });
                          onRequestRender?.();
                        }}
                        className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                      />
                      <div className="grid grid-cols-7 gap-1 pt-0.5">
                        {[-90, -45, -15, 15, 45, 90, 180].map((deg) => (
                          <button
                            key={deg}
                            onClick={() => {
                              builder.pushUndo();
                              const deltaRad = (deg * Math.PI) / 180;
                              builder.updatePropTransform(selectedProp.id, {
                                rotY: (selectedProp.rotY ?? 0) + deltaRad,
                              });
                              onRequestRender?.();
                            }}
                            className="px-1 py-1 text-[10px] bg-zinc-800/80 hover:bg-emerald-900/60 hover:text-emerald-300 text-zinc-200 rounded border border-zinc-700/60 cursor-pointer text-center font-mono font-bold"
                            title={`Turn ${deg > 0 ? `+${deg}` : deg}°`}
                          >
                            {deg > 0 ? `+${deg}°` : `${deg}°`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Decal Side Yellow Box Manipulators */}
                    <div className="bg-zinc-900/90 rounded border border-yellow-500/40 p-2 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-yellow-400">
                          <span className="inline-block w-3 h-3 bg-yellow-400 border border-black rounded-sm shadow-sm" />
                          <span>Decal Edge Elevators</span>
                        </div>
                        <button
                          onClick={() => {
                            builder.resetDecalFlat(selectedProp.id);
                            showToast('Decal reset flat (0° pitch & roll)');
                            onRequestRender?.();
                          }}
                          className="text-[10px] text-zinc-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 hover:border-amber-400/50 cursor-pointer"
                          title="Reset to completely flat horizontal"
                        >
                          Reset Flat
                        </button>
                      </div>

                      <p className="text-[10px] text-zinc-400 leading-tight">
                        Drag the <strong className="text-yellow-300">yellow boxes</strong> on the decal edges in 3D, or use the elevator buttons below:
                      </p>

                      {/* Grid of 4 sides */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Front Edge */}
                        <div className="bg-zinc-950/70 p-1.5 rounded border border-zinc-800/80 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-yellow-300">
                            <span>▲ Front (Downhill)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'front', -10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded border border-zinc-700 cursor-pointer"
                              title="Lower front edge by 10 units"
                            >
                              ▼ -10
                            </button>
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'front', 10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-[10px] font-bold rounded border border-yellow-500/40 cursor-pointer"
                              title="Raise front edge by 10 units"
                            >
                              ▲ +10
                            </button>
                          </div>
                        </div>

                        {/* Back Edge */}
                        <div className="bg-zinc-950/70 p-1.5 rounded border border-zinc-800/80 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-yellow-300">
                            <span>▼ Back (Uphill)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'back', -10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded border border-zinc-700 cursor-pointer"
                              title="Lower back edge by 10 units"
                            >
                              ▼ -10
                            </button>
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'back', 10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-[10px] font-bold rounded border border-yellow-500/40 cursor-pointer"
                              title="Raise back edge by 10 units"
                            >
                              ▲ +10
                            </button>
                          </div>
                        </div>

                        {/* Left Edge */}
                        <div className="bg-zinc-950/70 p-1.5 rounded border border-zinc-800/80 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-yellow-300">
                            <span>◄ Left (Bank L)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'left', -10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded border border-zinc-700 cursor-pointer"
                              title="Lower left edge by 10 units"
                            >
                              ▼ -10
                            </button>
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'left', 10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-[10px] font-bold rounded border border-yellow-500/40 cursor-pointer"
                              title="Raise left edge by 10 units"
                            >
                              ▲ +10
                            </button>
                          </div>
                        </div>

                        {/* Right Edge */}
                        <div className="bg-zinc-950/70 p-1.5 rounded border border-zinc-800/80 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-yellow-300">
                            <span>► Right (Bank R)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'right', -10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded border border-zinc-700 cursor-pointer"
                              title="Lower right edge by 10 units"
                            >
                              ▼ -10
                            </button>
                            <button
                              onClick={() => {
                                builder.nudgeDecalSide(selectedProp.id, 'right', 10, true, true);
                                onRequestRender?.();
                              }}
                              className="flex-1 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-[10px] font-bold rounded border border-yellow-500/40 cursor-pointer"
                              title="Raise right edge by 10 units"
                            >
                              ▲ +10
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
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
                    builder.pushUndo();
                    builder.updatePropTransform(selectedProp.id, { cameraFacing: next });
                    builder.setCameraFacingDefault(next);
                    setCameraFacingDefault(next);
                    showToast(next ? 'Mode: Camera Facing (Billboard) [Active for future placements]' : 'Mode: Fixed 3D World Orientation [Active for future placements]');
                    onRequestRender?.();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold border transition-colors cursor-pointer ${
                    isFacing
                      ? 'bg-amber-600/90 hover:bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'
                  }`}
                  title="Toggle whether this decoration rotates to face the camera (billboard) or stays fixed in 3D world space. Switches mode so all subsequent placements behave as such until pressed again."
                >
                  <Camera size={13} />
                  <span>{isFacing ? 'ON (Billboard)' : 'OFF (Fixed 3D)'}</span>
                </button>
              </div>
            );
          })()}
          </>
        )}

        {/* Animation panel: animated-sheet swap, playback, speed, frame skip */}
        {inspectorTab === 'animation' && (() => {
            const def = PROP_DEFINITIONS.find((d) => d.type === selectedProp.type);
            if (!def) return null;
            const twin = animatedTwinDef(def);
            const isAnimatedDef = def.isAnimated === true;
            if (!isAnimatedDef && !twin) return null; // no animated sheet behind this decoration

            const sheetDef = isAnimatedDef ? def : twin!;
            const grid = animGridFor(sheetDef);
            const total = Math.max(1, grid.cols * grid.rows);
            const frames = normalizeAnimFrames(selectedProp.animFrames, total);
            const enabledCount = frames.filter(Boolean).length;
            const speed = animSpeedFor(selectedProp);
            const usingSheet = isAnimatedDef || selectedProp.animated === true;
            const isPlaying = selectedProp.animate !== false && enabledCount > 1;
            const stillDef = isAnimatedDef
              ? PROP_DEFINITIONS.find((d) => d.type === def.stillType)
              : undefined;
            const apply = (updates: Parameters<typeof builder.setPropAnimation>[1]) => {
              builder.setPropAnimation(selectedProp.id, updates);
              onRequestRender?.();
            };
            const nudgeSpeed = (delta: number) => {
              const next = Math.min(ANIM_SPEED_MAX, Math.max(ANIM_SPEED_MIN, Math.round((speed + delta) * 100) / 100));
              apply({ animSpeed: next });
            };

            const frameDelays = normalizeAnimFrameDelays(selectedProp.animFrameDelays, total);
            const targetIdx = typeof animDelayTargetFrame === 'number' ? Math.min(total - 1, Math.max(0, animDelayTargetFrame)) : 'all';
            const currentDelay = targetIdx === 'all'
              ? (frameDelays[0] ?? 0)
              : (frameDelays[targetIdx] ?? 0);

            const nudgeDelay = (delta: number) => {
              const next = [...frameDelays];
              if (targetIdx === 'all') {
                for (let i = 0; i < total; i++) {
                  next[i] = Math.max(0, Math.min(30, Math.round(((next[i] ?? 0) + delta) * 100) / 100));
                }
                showToast(`All frames delay: ${next[0].toFixed(2)}s (${delta > 0 ? `+${delta.toFixed(1)}s` : `${delta.toFixed(1)}s`})`);
                setDelayInputStr(next[0] > 0 ? (Number.isInteger(next[0]) ? next[0].toFixed(1) : String(next[0])) : '0');
              } else {
                next[targetIdx] = Math.max(0, Math.min(30, Math.round(((next[targetIdx] ?? 0) + delta) * 100) / 100));
                showToast(`Frame ${targetIdx + 1} delay: ${next[targetIdx].toFixed(2)}s`);
                setDelayInputStr(next[targetIdx] > 0 ? (Number.isInteger(next[targetIdx]) ? next[targetIdx].toFixed(1) : String(next[targetIdx])) : '0');
              }
              apply({ animFrameDelays: next });
            };

            const setExactDelay = (val: number) => {
              const clamped = Math.max(0, Math.min(30, Math.round(val * 100) / 100));
              const next = [...frameDelays];
              if (targetIdx === 'all') {
                for (let i = 0; i < total; i++) next[i] = clamped;
                showToast(`All frames delay set to ${clamped.toFixed(2)}s`);
              } else {
                next[targetIdx] = clamped;
                showToast(`Frame ${targetIdx + 1} delay set to ${clamped.toFixed(2)}s`);
              }
              apply({ animFrameDelays: next });
            };

            return (
              <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-medium text-xs flex items-center gap-1.5">
                    <Clapperboard size={13} className="text-fuchsia-400" />
                    <span>Animation</span>
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {total}-frame sheet @ {grid.fps}fps
                  </span>
                </div>

                {/* Still <-> animated swap (still decorations that have a twin sheet) */}
                {twin && (
                  <div className="flex items-center justify-between text-xs bg-fuchsia-950/20 border border-fuchsia-800/40 rounded px-2 py-1.5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-fuchsia-200 font-medium">Animated</span>
                      <span className="text-[10px] text-zinc-400 truncate" title={`Swaps this decoration for "${twin.name}" — the 4-frame sheet cut from the same art`}>
                        {usingSheet ? `Playing "${twin.name}"` : `Swap in "${twin.name}"`}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !usingSheet;
                        apply({ animated: next });
                        showToast(next ? `Swapped to animated sheet: ${twin.name}` : 'Swapped back to the still artwork');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold border transition-colors cursor-pointer ${
                        usingSheet
                          ? 'bg-fuchsia-600/90 hover:bg-fuchsia-500 text-zinc-950 border-fuchsia-400'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'
                      }`}
                      title="Swap this decoration between its still artwork and its animated 4-frame sheet (same art, same size)"
                    >
                      <Film size={13} />
                      <span>{usingSheet ? 'ANIMATED' : 'STILL'}</span>
                    </button>
                  </div>
                )}

                {isAnimatedDef && stillDef && (
                  <div className="text-[10px] text-zinc-500 truncate" title={`This sheet was cut from the still decoration "${stillDef.name}"`}>
                    Animated version of <span className="text-zinc-400">{stillDef.name}</span>
                  </div>
                )}

                {usingSheet && (
                  <>
                    {/* Playback */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex flex-col">
                        <span className="text-zinc-400">Playback</span>
                        <span className="text-[10px] text-zinc-500">
                          {isPlaying
                            ? `Cycling ${enabledCount}/${total} frames @ ${(grid.fps * speed).toFixed(1)}fps`
                            : enabledCount > 1
                              ? `Paused on frame ${frames.indexOf(true) + 1}`
                              : `Holding frame ${frames.indexOf(true) + 1}`}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const next = !(selectedProp.animate !== false);
                          apply({ animate: next });
                          showToast(next ? 'Animation: ON (cycling frames)' : `Animation: OFF (holding frame ${frames.indexOf(true) + 1})`);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold border transition-colors cursor-pointer ${
                          selectedProp.animate !== false
                            ? 'bg-fuchsia-600/90 hover:bg-fuchsia-500 text-zinc-950 border-fuchsia-400'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'
                        }`}
                        title="Play or pause frame cycling (paused props hold their first enabled frame)"
                      >
                        {selectedProp.animate !== false ? <Clapperboard size={13} /> : <Pause size={13} />}
                        <span>{selectedProp.animate !== false ? 'PLAYING' : 'PAUSED'}</span>
                      </button>
                    </div>

                    {/* Speed +/- */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Speed</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => nudgeSpeed(-ANIM_SPEED_STEP)}
                          disabled={speed <= ANIM_SPEED_MIN}
                          className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Slow the animation down"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-12 text-center font-mono text-zinc-200">{speed.toFixed(2)}x</span>
                        <button
                          onClick={() => nudgeSpeed(ANIM_SPEED_STEP)}
                          disabled={speed >= ANIM_SPEED_MAX}
                          className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Speed the animation up"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => apply({ animSpeed: 1 })}
                          className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-pointer"
                          title="Reset speed to 1.00x"
                        >
                          RESET
                        </button>
                      </div>
                    </div>

                    {/* Per-frame checkboxes & delay targets */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Frames (On / Off)</span>
                        <span className="text-[10px] text-zinc-500">
                          {enabledCount === 0 ? 'keep at least one' : `${enabledCount} of ${total} on`}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {frames.map((on, i) => {
                          const delay = frameDelays[i] || 0;
                          const isTarget = targetIdx === i;
                          return (
                            <div
                              key={i}
                              onClick={() => setAnimDelayTargetFrame(i)}
                              className={`flex flex-col items-center gap-0.5 py-1 px-0.5 rounded border text-[10px] cursor-pointer transition-all ${
                                on
                                  ? isTarget
                                    ? 'bg-fuchsia-950/80 border-fuchsia-400 text-fuchsia-100 ring-1 ring-fuchsia-400/50 shadow-sm'
                                    : 'bg-fuchsia-950/40 border-fuchsia-700/60 text-fuchsia-200 hover:border-fuchsia-500'
                                  : isTarget
                                    ? 'bg-zinc-900 border-amber-400/80 text-zinc-400 ring-1 ring-amber-400/40 shadow-sm'
                                    : 'bg-zinc-900/80 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                              }`}
                              title={`Frame ${i + 1} — toggle checkbox to enable/disable. Click card to select for delay adjustment (${delay > 0 ? `${delay.toFixed(1)}s hold` : '0.0s delay'})`}
                            >
                              <div className="flex items-center justify-between w-full px-1">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const next = [...frames];
                                    next[i] = e.target.checked;
                                    if (!next.some(Boolean)) {
                                      showToast('Keep at least one frame enabled');
                                      return;
                                    }
                                    apply({ animFrames: next });
                                  }}
                                  className="accent-fuchsia-500 w-3 h-3 cursor-pointer"
                                />
                                <span className="font-mono font-bold">F{i + 1}</span>
                              </div>
                              <div className="text-[9px] font-mono mt-0.5 flex items-center justify-center">
                                {delay > 0 ? (
                                  <span className="text-amber-300 font-semibold bg-amber-950/70 px-1 rounded border border-amber-700/60">
                                    +{delay.toFixed(1)}s
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 text-[8px]">0.0s</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Frame Delay Box with +/- and frame selector */}
                    <div className="bg-zinc-900/70 p-2 rounded border border-zinc-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                          <Clock size={12} className="text-amber-400" />
                          <span>Frame Delay / Hold:</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-zinc-400">Target:</span>
                          <div className="flex items-center bg-zinc-950 rounded p-0.5 border border-zinc-800 text-[10px]">
                            {frames.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setAnimDelayTargetFrame(i);
                                  const d = frameDelays[i] ?? 0;
                                  setDelayInputStr(d > 0 ? (Number.isInteger(d) ? d.toFixed(1) : String(d)) : '0');
                                }}
                                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                  targetIdx === i
                                    ? 'bg-fuchsia-600 text-zinc-950 font-bold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title={`Set delay for Frame ${i + 1}`}
                              >
                                F{i + 1}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setAnimDelayTargetFrame('all');
                                const d = frameDelays[0] ?? 0;
                                setDelayInputStr(d > 0 ? (Number.isInteger(d) ? d.toFixed(1) : String(d)) : '0');
                              }}
                              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                targetIdx === 'all'
                                  ? 'bg-fuchsia-600 text-zinc-950 font-bold'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                              title="Set delay across all frames"
                            >
                              ALL
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[11px]">
                          {targetIdx === 'all' ? 'All Frames Extra Hold' : `F${targetIdx + 1} Extra Hold`}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => nudgeDelay(-0.1)}
                            disabled={currentDelay <= 0}
                            className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Decrease hold delay (-0.1s)"
                          >
                            <Minus size={12} />
                          </button>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="30"
                              value={delayInputStr}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setDelayInputStr(raw);
                                const parsed = parseFloat(raw);
                                if (!isNaN(parsed) && parsed >= 0) {
                                  setExactDelay(parsed);
                                }
                              }}
                              onBlur={() => {
                                const parsed = parseFloat(delayInputStr);
                                if (isNaN(parsed) || parsed < 0) {
                                  setExactDelay(0);
                                  setDelayInputStr('0');
                                } else {
                                  const clamped = Math.min(30, Math.round(parsed * 100) / 100);
                                  setExactDelay(clamped);
                                  setDelayInputStr(clamped > 0 ? (Number.isInteger(clamped) ? clamped.toFixed(1) : String(clamped)) : '0');
                                }
                              }}
                              className="w-16 h-6 text-center font-mono text-zinc-100 bg-zinc-950 rounded border border-zinc-700 text-xs px-1 focus:border-amber-400 focus:outline-none"
                              title="Frame hold delay in seconds (0s = default frame speed)"
                            />
                            <span className="absolute right-1 text-[10px] text-zinc-500 pointer-events-none">s</span>
                          </div>
                          <button
                            onClick={() => nudgeDelay(0.1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 cursor-pointer"
                            title="Increase hold delay (+0.1s)"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setExactDelay(0);
                              setDelayInputStr('0');
                            }}
                            disabled={currentDelay <= 0}
                            className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Reset delay to 0.0s"
                          >
                            RESET
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
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
      ) : null)}

      {/* Bottom Prop Palette */}
      {!isZen && (
        <div className="pointer-events-auto bg-zinc-950/95 border-t border-amber-500/40 backdrop-blur-md flex flex-col shadow-2xl transition-all select-none">
          {/* Top Control Bar: Mode Toggles + Search Box + Shelf Expand/Collapse */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800/80 gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => {
                  builder.setActivePropType(null);
                  showToast('Select Tool Active: Click any prop in 3D to select or delete it');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-bold transition-all cursor-pointer ${
                  !activePropType
                    ? 'bg-amber-600 text-zinc-950 shadow'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700/50'
                }`}
                title="Select / Inspect mode [V]"
              >
                <MousePointer size={13} />
                <span>SELECT [V]</span>
              </button>

              <button
                onClick={() => {
                  setClickMoveEnabled((prev) => {
                    const next = !prev;
                    showToast(next ? 'Click Move: ON' : 'Click Move: OFF');
                    return next;
                  });
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded font-bold transition-all border cursor-pointer ${
                  clickMoveEnabled
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md'
                    : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 border-zinc-700/60'
                }`}
                title="Toggle click-move mode [M]"
              >
                <Move size={12} />
                <span>MOVE: {clickMoveEnabled ? 'ON' : 'OFF'} [M]</span>
              </button>

              <button
                onClick={() => {
                  const nextAxis: 'y' | 'x' | 'z' = nudgeAxis === 'y' ? 'x' : nudgeAxis === 'x' ? 'z' : 'y';
                  setNudgeAxis(nextAxis);
                  showToast(`Nudge Axis: ${nextAxis.toUpperCase()} [5]`);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded font-bold bg-zinc-850 hover:bg-zinc-800 text-amber-300 border border-zinc-700/60 transition-all cursor-pointer"
                title="Nudge axis [5]"
              >
                <span className="text-zinc-400 text-[10px]">AXIS:</span>
                <span className="font-mono bg-zinc-800 px-1 rounded text-amber-400">{nudgeAxis.toUpperCase()}</span>
                <span className="text-[10px] text-zinc-500">[5]</span>
              </button>

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
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60 transition-all cursor-pointer hover:bg-cyan-900/60"
                  title="Group/Ungroup selected decorations [Ctrl+G / Ctrl+Shift+G]"
                >
                  <Users size={12} />
                  <span>{builder.isSelectionGrouped() ? `Group (${selectedProps.length})` : `Selected (${selectedProps.length})`}</span>
                </button>
              )}
            </div>

            {/* Prop Search Filter & Shelf Expand/Collapse */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search size={12} className="absolute left-2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search props..."
                  value={shelfSearch}
                  onChange={(e) => setShelfSearch(e.target.value)}
                  className="w-36 sm:w-52 pl-6 pr-6 py-0.5 text-xs bg-zinc-950 text-amber-100 placeholder-zinc-500 rounded border border-zinc-700/70 focus:border-amber-500 focus:outline-none transition-colors"
                />
                {shelfSearch && (
                  <button
                    onClick={() => setShelfSearch('')}
                    className="absolute right-1.5 text-zinc-400 hover:text-white p-0.5 text-xs cursor-pointer"
                    title="Clear search"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Shelf Expand/Collapse button */}
              <button
                onClick={() => setShelfExpanded(!shelfExpanded)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700/60 font-medium cursor-pointer"
                title={shelfExpanded ? 'Compact Shelf (Single Row)' : 'Expand Shelf (Multi-Row View)'}
              >
                {shelfExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                <span className="hidden sm:inline text-[11px]">{shelfExpanded ? 'Compact' : 'Expand'}</span>
              </button>
            </div>
          </div>

          {/* Category Tabs Strip */}
          <div className="flex items-center gap-0.5 px-3 pt-1 overflow-x-auto border-b border-zinc-800/80 scrollbar-none bg-zinc-950/70">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-t font-medium transition-all whitespace-nowrap cursor-pointer ${
                  category === cat.id
                    ? 'bg-zinc-900 text-amber-400 border-t-2 border-x border-amber-500 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Prop Cards Grid with Left/Right Scroll Arrows & Thick Grab Scrollbar */}
          <div className="relative flex items-center bg-zinc-950/90 w-full overflow-hidden">
            {category !== 'lanes' && (category as string) !== 'custom_models' && !shelfExpanded && (
              <button
                onClick={() => scrollShelf('left')}
                className="absolute left-1.5 z-20 p-1.5 bg-zinc-900/95 hover:bg-amber-950 text-amber-300 hover:text-white border border-amber-500/60 rounded-full shadow-2xl transition-all cursor-pointer backdrop-blur-sm"
                title="Scroll Left"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <div
              ref={shelfScrollRef}
              onWheel={(e) => {
                if (shelfScrollRef.current && e.deltaY !== 0 && !e.shiftKey && !shelfExpanded) {
                  shelfScrollRef.current.scrollLeft += e.deltaY;
                }
              }}
              className={`builder-shelf-scroll flex gap-2.5 px-6 py-2 w-full transition-all ${
                category === 'lanes'
                  ? (laneDrawerOpen ? 'overflow-auto max-h-96' : 'overflow-x-auto max-h-36')
                  : shelfExpanded
                  ? 'flex-wrap overflow-y-auto max-h-72 p-4'
                  : 'items-center overflow-x-auto max-h-40'
              }`}
            >
              {category === 'lanes' ? (
                <LanePanel
                  model={laneModel}
                  status={laneStatus}
                  isDrawerOpen={laneDrawerOpen}
                  onToggleDrawer={(open) => setLaneDrawerOpen(open)}
                  onSelectNode={(nodeId) => {
                    builder.selectLaneNode(nodeId);
                    refreshLanes();
                    onRequestRender?.();
                  }}
                  onSelectPath={(pathId) => {
                    setSelectedLanePathId(pathId);
                    refreshLanes();
                    onRequestRender?.();
                  }}
                  onMoveNode={moveLaneNodeFromPanel}
                  onCommand={runLaneCommand}
                  onInitSample={initSampleLanes}
                  onInitDefault={initDefaultLanes}
                  onFocusNode={(nodeId) => {
                    builder.focusOnLaneNode(nodeId);
                    onRequestRender?.();
                  }}
                  onSave={saveLaneDoc}
                  onExport={exportLanes}
                  onImport={importLanes}
                  onTestDrive={() => { saveLaneDoc(); onTestRace?.(); }}
                />
              ) : (category as string) === 'custom_models' ? (
                <CustomModelsTab
                  onSelectModel={(assetId, name) => {
                    builder.registerCustomModel(assetId, name);
                    showToast(`Selected custom model: ${name}. Click on track surface to place!`);
                  }}
                  activeAssetId={activePropType}
                  usedAssetIds={new Set(placedProps.map((p) => (p.customAssetId || p.type) as string))}
                />
              ) : displayedProps.length === 0 ? (
                <div className="flex items-center justify-center w-full py-8 text-zinc-500 text-xs italic">
                  No props match &ldquo;{shelfSearch}&rdquo; in this category.
                </div>
              ) : (
                displayedProps.map((p) => {
                  const isSelected = activePropType === p.type;
                  return (
                    <button
                      key={p.type}
                      onClick={() => selectPropType(p.type)}
                      className={`group relative flex flex-col items-center p-2 rounded-lg border transition-all shrink-0 w-28 bg-zinc-900/90 hover:bg-zinc-850 cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/50'
                          : 'border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {p.isAnimated && (
                        <span
                          className="absolute top-1 right-1 flex items-center gap-0.5 text-[8px] px-1 py-px rounded font-mono font-bold bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700/60"
                          title="4-frame animated sheet: shows one frame at a time in 3D"
                        >
                          <Clapperboard size={9} /> 4-FRAME
                        </span>
                      )}
                      {!p.isAnimated && p.animatedTwin && (
                        <span
                          className="absolute top-1 right-1 flex items-center gap-0.5 text-[8px] px-1 py-px rounded font-mono font-bold bg-fuchsia-950/70 text-fuchsia-300/90 border border-fuchsia-800/60"
                          title={`Has an animated 4-frame version (${p.animatedTwin}) — place it, then switch it on under Animation in the attribute window`}
                        >
                          <Film size={9} /> ANIM
                        </span>
                      )}
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
                })
              )}
            </div>

            {category !== 'lanes' && (category as string) !== 'custom_models' && !shelfExpanded && (
              <button
                onClick={() => scrollShelf('right')}
                className="absolute right-1.5 z-20 p-1.5 bg-zinc-900/95 hover:bg-amber-950 text-amber-300 hover:text-white border border-amber-500/60 rounded-full shadow-2xl transition-all cursor-pointer backdrop-blur-sm"
                title="Scroll Right"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}


      {/* Backups & Restore Modal */}
      {showBackupsModal && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-amber-500/60 rounded-xl shadow-2xl flex flex-col overflow-hidden text-amber-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900/90 border-b border-amber-500/40">
              <div className="flex items-center gap-2">
                <Database className="text-amber-400" size={18} />
                <h3 className="font-bold text-sm text-amber-300 tracking-wide uppercase">
                  Track Props & Decorations Backups
                </h3>
              </div>
              <button
                onClick={() => setShowBackupsModal(false)}
                className="p-1.5 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs scrollbar-thin">
              {/* Status Banner */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400">Current Scene:</span>
                    <span className="bg-amber-950/80 text-amber-300 border border-amber-600/50 px-2 py-0.5 rounded font-mono font-bold">
                      {placedProps.length} props placed
                    </span>
                    <span className="text-zinc-400 font-mono text-[11px] capitalize">
                      Track: {course ?? 'ridge'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <Clock size={12} className="text-amber-500" />
                    <span>Auto-backup creates periodic files in <code className="text-amber-300 font-mono">backups/props/</code> every 30s.</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveDiskBackup}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold rounded shadow transition-colors cursor-pointer"
                    title="Force immediate backup to disk file"
                  >
                    <Save size={13} />
                    <span>Save Backup Now</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={handleRestoreStarterDecorations}
                  className="flex items-center justify-center gap-1.5 p-2.5 bg-zinc-900 hover:bg-zinc-850 text-emerald-300 border border-emerald-700/50 rounded-lg font-medium transition-colors cursor-pointer"
                  title="Restore slingshot launcher, lanterns, flags, archway, decals & pine walls"
                >
                  <RefreshCw size={13} />
                  <span>Restore Starter Preset</span>
                </button>

                <button
                  onClick={handleExport}
                  className="flex items-center justify-center gap-1.5 p-2.5 bg-zinc-900 hover:bg-zinc-850 text-amber-300 border border-zinc-700/60 rounded-lg font-medium transition-colors cursor-pointer"
                  title="Download current layout as JSON"
                >
                  <Download size={13} />
                  <span>Download Current JSON</span>
                </button>

                <button
                  onClick={handleImport}
                  className="flex items-center justify-center gap-1.5 p-2.5 bg-zinc-900 hover:bg-zinc-850 text-amber-300 border border-zinc-700/60 rounded-lg font-medium transition-colors cursor-pointer"
                  title="Upload and load a JSON file from disk"
                >
                  <Upload size={13} />
                  <span>Upload & Restore File</span>
                </button>
              </div>

              {/* Disk Backups Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                    <HardDrive size={14} /> Disk Backups (backups/props/)
                  </span>
                  <button
                    onClick={refreshBackupsList}
                    disabled={isLoadingBackups}
                    className="text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={10} className={isLoadingBackups ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>

                {/* Latest Disk Backup Card */}
                {backupsList.latest ? (
                  <div className="bg-zinc-900/90 border border-amber-600/40 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-amber-950/80 border border-amber-500/50 rounded-md text-amber-400 shrink-0">
                        <HardDrive size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-200 truncate">track-props-latest.json</span>
                          <span className="bg-amber-950/80 text-amber-300 text-[10px] px-1.5 py-0.2 rounded border border-amber-600/40">
                            Latest Disk Baseline
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>{backupsList.latest.props?.length ?? backupsList.latest.count ?? 0} props</span>
                          <span>•</span>
                          <span>{backupsList.latest.timestamp ? new Date(backupsList.latest.timestamp).toLocaleString() : 'Recent'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          if (backupsList.latest?.props) {
                            handleRestoreLocalSnapshot(backupsList.latest.props);
                          } else {
                            handleRestoreFile('track-props-latest.json');
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 rounded text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDownloadSpecificBackup(backupsList.latest, 'track-props-latest.json')}
                        className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-600 cursor-pointer transition-colors"
                        title="Download track-props-latest.json"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* History Snapshots */}
                {backupsList.history && backupsList.history.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {backupsList.history.map((h: any) => (
                      <div
                        key={h.filename}
                        className="bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-lg p-2.5 flex items-center justify-between gap-2 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <History size={13} className="text-zinc-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-mono text-[11px] text-zinc-300 truncate block">
                              {h.filename}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {h.count} props • {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRestoreFile(h.filename)}
                            className="px-2 py-0.5 bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-600/50 text-zinc-300 border border-zinc-700 rounded text-[11px] cursor-pointer transition-colors"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-zinc-500 text-[11px] italic py-1">
                    No historical disk backup files yet. Changes are automatically saved every 30s.
                  </div>
                )}
              </div>

              {/* Local Storage Backups Section */}
              {backupsList.localHistory && backupsList.localHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <span className="font-bold text-zinc-400 text-xs flex items-center gap-1.5">
                    <Database size={13} /> In-Browser Local Storage Snapshots
                  </span>
                  <div className="space-y-1.5">
                    {backupsList.localHistory.map((lh: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                          <div>
                            <span className="font-medium text-[11px] text-zinc-300 block">{lh.title}</span>
                            <span className="text-[10px] text-zinc-500">
                              {lh.count} props • {lh.timestamp ? new Date(lh.timestamp).toLocaleString() : 'Recently'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRestoreLocalSnapshot(lh.props)}
                          className="px-2 py-0.5 bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-600/50 text-zinc-300 border border-zinc-700 rounded text-[11px] cursor-pointer transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/90 border-t border-zinc-800">
              <span className="text-[11px] text-zinc-400">
                Backups safeguard against browser cache clears or accidental resets.
              </span>
              <button
                onClick={() => setShowBackupsModal(false)}
                className="px-3.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 cursor-pointer font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hotkeys Cheat Sheet Modal */}
      <CheatSheet isOpen={showCheatSheet} onClose={() => setShowCheatSheet(false)} />

      {/* Zen Mode Restore Floating Button */}
      {isZen && <ZenRestore onRestore={() => setIsZen(false)} />}
    </div>
  );
}
