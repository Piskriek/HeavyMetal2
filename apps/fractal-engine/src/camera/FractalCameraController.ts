import * as THREE from 'three';
import type { IRungNode } from '../rungs/RungTypes';

export interface ViewMode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultZoom: number;
  readonly defaultPitch: number;
  readonly autoOrbitSpeed: number; // rad/sec
}

export const VIEW_MODES: readonly ViewMode[] = [
  {
    id: 'gateway',
    name: 'Octave Gateway & Triad',
    description: 'Toroidal helicity field & Triad Apex (D7)',
    defaultZoom: 0.0,
    defaultPitch: 0.35,
    autoOrbitSpeed: 0.02,
  },
  {
    id: 'ladder',
    name: 'Interactive Ladder',
    description: 'Manual navigation across 7 Rungs',
    defaultZoom: 0.166,
    defaultPitch: 0.35,
    autoOrbitSpeed: 0.02,
  },
  {
    id: 'planetary',
    name: 'Planetary Flyby',
    description: 'Four Valleys terrain & atmospheric ring',
    defaultZoom: 0.22,
    defaultPitch: 0.25,
    autoOrbitSpeed: 0.05,
  },
  {
    id: 'grid',
    name: 'Assembly & Wiregraph Grid',
    description: 'Power conduits & fabricator node view',
    defaultZoom: 0.42,
    defaultPitch: 0.40,
    autoOrbitSpeed: 0.07,
  },
  {
    id: 'rover',
    name: 'Sovereign Ego Chaser',
    description: 'Follow-cam with Golden Coherence Halo',
    defaultZoom: 0.62,
    defaultPitch: 0.28,
    autoOrbitSpeed: 0.10,
  },
  {
    id: 'parts',
    name: 'Kinematic Articulations',
    description: 'Wheel hubs & Conformal G4,1 suspension',
    defaultZoom: 0.82,
    defaultPitch: 0.20,
    autoOrbitSpeed: 0.12,
  },
  {
    id: 'atoms',
    name: 'Quantum Substrate Core',
    description: 'Crystalline Four Floats micro-lattice',
    defaultZoom: 0.98,
    defaultPitch: 0.25,
    autoOrbitSpeed: 0.18,
  },
  {
    id: 'auto-tour',
    name: 'Cinematic Auto-Tour',
    description: 'Continuous breathing voyage Universe <-> Atoms',
    defaultZoom: 0.0,
    defaultPitch: 0.35,
    autoOrbitSpeed: 0.08,
  },
];

export interface CameraState {
  readonly zoom: number; // 0.0 (Space) -> 1.0 (Atoms)
  readonly activeRungIndex: number; // 6 down to 1
  readonly activeDensity: string;
  readonly distanceM: number;
  readonly activeViewMode: ViewMode;
  readonly isAutoTour: boolean;
  readonly toastMessage: string | null;
}

export class FractalCameraController {
  public zoom: number = 0.0; // Starts at Space (Rung 6)
  public targetZoom: number = 0.0;

  // Spherical Orbit angles
  public yaw: number = 0.0;
  public targetYaw: number = 0.0;
  public pitch: number = 0.35;
  public targetPitch: number = 0.35;

  private isDragging: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;

  // View Modes & Auto-Tour
  public currentModeIndex: number = 0;
  public isAutoTour: boolean = false;
  private autoTourTimer: number = 0;

  // On-screen Toast Notification
  public toastMessage: string | null = null;
  private toastExpiry: number = 0;

  // Rung Zoom Anchor Milestones (Z in [0, 1] for 7 Rungs: 7->0.0, 6->0.166, 5->0.333, 4->0.50, 3->0.666, 2->0.833, 1->1.0)
  private readonly rungZoomAnchors: number[] = [0.0, 0.166, 0.333, 0.50, 0.666, 0.833, 1.0];

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly rungs: IRungNode[]
  ) {
    this.setupInputs();
    this.setupRemoteListeners();
  }

  public showToast(msg: string, durationSec: number = 2.5): void {
    this.toastMessage = msg;
    this.toastExpiry = performance.now() + durationSec * 1000;
  }

  public cycleViewMode(): void {
    this.currentModeIndex = (this.currentModeIndex + 1) % VIEW_MODES.length;
    const mode = VIEW_MODES[this.currentModeIndex]!;
    this.isAutoTour = mode.id === 'auto-tour';
    this.targetZoom = mode.defaultZoom;
    this.targetPitch = mode.defaultPitch;
    this.showToast(`[OK] VIEW: ${mode.name.toUpperCase()}`);
  }

  public toggleAutoTour(): void {
    this.isAutoTour = !this.isAutoTour;
    if (this.isAutoTour) {
      this.currentModeIndex = VIEW_MODES.findIndex(m => m.id === 'auto-tour');
      this.showToast('[PLAY] AUTO-TOUR: ENGAGED');
    } else {
      this.currentModeIndex = 0;
      this.showToast('[PAUSE] MANUAL LADDER CONTROL');
    }
  }

  public setRung(rungIndex: number): void {
    this.isAutoTour = false;
    const idx = 7 - rungIndex;
    if (idx >= 0 && idx < this.rungZoomAnchors.length) {
      this.targetZoom = this.rungZoomAnchors[idx]!;
      this.showToast(`RUNG ${rungIndex}: ${this.rungs[idx]?.rungName.toUpperCase()}`);
    }
  }

  public stepZoom(direction: 1 | -1): void {
    this.isAutoTour = false;
    // Step by ~1 rung level (0.166)
    const step = 0.166;
    this.targetZoom = Math.max(0.0, Math.min(1.0, this.targetZoom + direction * step));
    const rungIdx = Math.max(1, Math.min(7, Math.round(7 - this.targetZoom * 6)));
    this.showToast(direction > 0 ? `▲ ZOOM IN -> RUNG ${rungIdx}` : `▼ ZOOM OUT -> RUNG ${rungIdx}`);
  }

  public stepOrbit(direction: 1 | -1): void {
    this.targetYaw += direction * (Math.PI / 6); // 30 deg step
    this.showToast(direction > 0 ? '▶ ORBIT RIGHT' : '◀ ORBIT LEFT', 1.5);
  }

  private setupRemoteListeners(): void {
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      const c = e.keyCode;

      // Remote D-Pad / Arrow Keys
      if (k === 'ArrowUp' || c === 38) {
        e.preventDefault();
        this.stepZoom(1); // Zoom in closer
      } else if (k === 'ArrowDown' || c === 40) {
        e.preventDefault();
        this.stepZoom(-1); // Zoom out
      } else if (k === 'ArrowLeft' || c === 37) {
        e.preventDefault();
        this.stepOrbit(-1); // Orbit left
      } else if (k === 'ArrowRight' || c === 39) {
        e.preventDefault();
        this.stepOrbit(1); // Orbit right
      } else if (k === 'Enter' || c === 13) {
        // Center Select / OK
        e.preventDefault();
        this.cycleViewMode();
      } else if (k === ' ' || k === 'MediaPlayPause' || c === 179 || k === 'p' || k === 'P') {
        // Play / Pause Button
        e.preventDefault();
        this.toggleAutoTour();
      } else if (k === 'Escape' || k === 'Backspace' || k === 'BrowserBack' || c === 27 || c === 8) {
        // Back Button
        e.preventDefault();
        this.setRung(7); // Return to Gateway Apex
      } else if (c >= 49 && c <= 55) {
        // Keys 1 to 7
        this.setRung(c - 48);
      }
    });
  }

  private setupInputs(): void {
    // Mouse wheel zoom across orders of magnitude
    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.isAutoTour = false;
      const delta = e.deltaY * 0.0008;
      this.targetZoom = Math.max(0.0, Math.min(1.0, this.targetZoom + delta));
    }, { passive: false });

    // Drag Orbit
    this.domElement.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.isAutoTour = false;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      this.targetYaw -= dx * 0.005;
      this.targetPitch = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, this.targetPitch + dy * 0.005));
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support for mobile / tablets
    let touchDist = 0;
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.isAutoTour = false;
        this.prevMouseX = e.touches[0]!.clientX;
        this.prevMouseY = e.touches[0]!.clientY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
        const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
        touchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0]!.clientX - this.prevMouseX;
        const dy = e.touches[0]!.clientY - this.prevMouseY;
        this.prevMouseX = e.touches[0]!.clientX;
        this.prevMouseY = e.touches[0]!.clientY;
        this.targetYaw -= dx * 0.005;
        this.targetPitch = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, this.targetPitch + dy * 0.005));
      } else if (e.touches.length === 2) {
        const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
        const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);
        const delta = (touchDist - newDist) * 0.002;
        touchDist = newDist;
        this.targetZoom = Math.max(0.0, Math.min(1.0, this.targetZoom + delta));
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  public update(dt: number, focusTarget: THREE.Vector3): CameraState {
    const activeMode = VIEW_MODES[this.currentModeIndex]!;

    // Auto-Tour smooth breathing oscillation
    if (this.isAutoTour) {
      this.autoTourTimer += dt * 0.12; // Complete cycle in ~50 sec
      // Smooth descent and ascent from 0.0 (Space) to 0.98 (Atoms)
      this.targetZoom = 0.49 - 0.49 * Math.cos(this.autoTourTimer);
      this.targetYaw += activeMode.autoOrbitSpeed * dt;
    } else if (activeMode.autoOrbitSpeed > 0 && !this.isDragging) {
      // Gentle ambient orbit rotation
      this.targetYaw += activeMode.autoOrbitSpeed * dt;
    }

    // Smooth interpolations
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1.0, dt * 6.0);
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1.0, dt * 8.0);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1.0, dt * 8.0);

    // Toast expiration
    if (this.toastMessage && performance.now() > this.toastExpiry) {
      this.toastMessage = null;
    }

    // Compute logarithmic distance across 10 orders of magnitude
    const minLog = -1.35; // 0.045m
    const maxLog = 6.80;  // 6,300,000m (Gateway Torus scale)
    const currentLog = maxLog - this.zoom * (maxLog - minLog);
    const distanceM = Math.pow(10, currentLog);

    // Dynamic near/far clipping calculation to eliminate z-fighting
    this.camera.near = Math.max(0.0005, distanceM * 0.005);
    this.camera.far = Math.max(10.0, distanceM * 200.0);
    this.camera.updateProjectionMatrix();

    // Spherical orbit position relative to focus target
    const cosPitch = Math.cos(this.pitch);
    const cx = distanceM * cosPitch * Math.sin(this.yaw);
    const cy = distanceM * Math.sin(this.pitch);
    const cz = distanceM * cosPitch * Math.cos(this.yaw);

    this.camera.position.set(
      focusTarget.x + cx,
      focusTarget.y + Math.max(0.01, cy),
      focusTarget.z + cz
    );
    this.camera.lookAt(focusTarget);

    // Determine active rung index (7 down to 1)
    let activeRung = 7;
    if (this.zoom > 0.91) activeRung = 1;
    else if (this.zoom > 0.75) activeRung = 2;
    else if (this.zoom > 0.58) activeRung = 3;
    else if (this.zoom > 0.41) activeRung = 4;
    else if (this.zoom > 0.25) activeRung = 5;
    else if (this.zoom > 0.08) activeRung = 6;
    else activeRung = 7;

    // Cross-fade rungs based on proximity to their scale
    for (const rung of this.rungs) {
      const targetAnchor = this.rungZoomAnchors[7 - rung.rungIndex]!;
      const diff = Math.abs(this.zoom - targetAnchor);
      const isDirectFocus = rung.rungIndex === activeRung;
      const alpha = Math.max(0.0, Math.min(1.0, 1.0 - (diff / 0.28)));
      rung.setTransitionAlpha(alpha, isDirectFocus);
    }

    const densityNames: Record<number, string> = {
      7: 'D7 Gateway',
      6: 'D6 Space',
      5: 'D5 World',
      4: 'D4 Assembly',
      3: 'D3 Vessel',
      2: 'D2 Parts',
      1: 'D1 Atoms',
    };

    return {
      zoom: this.zoom,
      activeRungIndex: activeRung,
      activeDensity: densityNames[activeRung] ?? 'D3',
      distanceM,
      activeViewMode: activeMode,
      isAutoTour: this.isAutoTour,
      toastMessage: this.toastMessage,
    };
  }
}
