/**
 * M01 · T4 — the first-person cockpit overlay.
 *
 * Everything is a painted PNG from `public/art/cockpit/` (measured by `scripts/cut-cockpit-art.mjs`
 * into `src/game/cockpit-art.json`) plus SVG needles bound to live state. No image decoding, no
 * layout thrash and no React re-render happens per frame: one `requestAnimationFrame` loop reads
 * `engine.getCockpitState()` and writes CSS transforms and a handful of text nodes through refs.
 *
 * The bezel is painted art with a genuinely transparent aperture — the WebGL canvas shows through
 * it, which is why this component never masks the viewport itself. The aperture's measured geometry
 * only positions the dials, the yoke and the arms.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  armsAt, cockpitBob, cockpitLayout, needleAngle, yokeAngleDeg,
  COCKPIT_ART, COCKPIT_MANIFEST, COCKPIT_MANIFEST as ART, type CockpitState,
} from '../game/cockpit';
import '../cockpit.css';

interface CockpitHudProps {
  /** Fills `state` for this frame. The HUD never allocates a state object of its own. */
  readonly readState: (state: CockpitState) => void;
  readonly state: CockpitState;
  readonly reducedMotion: boolean;
  /** True while the run is live (racing, the shove, or paused mid-race). */
  readonly active: boolean;
}

/** The hand's anchor inside the painted arm sprite; the CSS rotation pivots exactly here. */
const GRIP_ANCHOR = { x: ART.arm.gripFraction.x, y: ART.arm.gripFraction.y };
const SPEED_SWEEP = 240;
const SPEED_MAX = 360;
const GRADE_SWEEP = 220;

export default function CockpitHud({ readState, state, reducedMotion, active }: CockpitHudProps) {
  const layout = useMemo(
    () => cockpitLayout(typeof window === 'undefined' ? 1920 : window.innerWidth, typeof window === 'undefined' ? 1080 : window.innerHeight),
    [],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const bezelRef = useRef<HTMLImageElement>(null);
  const yokeRef = useRef<HTMLDivElement>(null);
  const armLeftRef = useRef<HTMLDivElement>(null);
  const armRightRef = useRef<HTMLDivElement>(null);
  const bobRef = useRef<HTMLDivElement>(null);
  const starterRef = useRef<HTMLDivElement>(null);
  const needles = {
    speed: useRef<SVGLineElement>(null),
    grade: useRef<SVGLineElement>(null),
    boost: useRef<SVGLineElement>(null),
    bounce: useRef<SVGLineElement>(null),
    shield: useRef<SVGLineElement>(null),
  };
  const readouts = {
    speed: useRef<HTMLSpanElement>(null),
    position: useRef<HTMLSpanElement>(null),
    time: useRef<HTMLSpanElement>(null),
    center: useRef<HTMLDivElement>(null),
    shield: useRef<HTMLSpanElement>(null),
    boost: useRef<HTMLSpanElement>(null),
    bounce: useRef<HTMLSpanElement>(null),
  };

  useEffect(() => {
    let frame = 0;
    const step = (now: number) => {
      readState(state);
      const yokeDeg = yokeAngleDeg(state.steer);
      const arms = armsAt(layout, yokeDeg);

      if (yokeRef.current) {
        yokeRef.current.style.transform = `translate(-50%, -${(COCKPIT_MANIFEST.yoke.pivot.y / COCKPIT_MANIFEST.yoke.h) * 100}%) rotate(${yokeDeg.toFixed(2)}deg)`;
      }
      for (const [ref, pose] of [[armLeftRef, arms.left], [armRightRef, arms.right]] as const) {
        const style = ref.current?.style;
        if (!style) continue;
        style.left = `${pose.x.toFixed(1)}px`;
        style.top = `${pose.y.toFixed(1)}px`;
        style.width = `${pose.w.toFixed(1)}px`;
        style.height = `${pose.h.toFixed(1)}px`;
        style.transformOrigin = `${(GRIP_ANCHOR.x * 100).toFixed(2)}% ${(GRIP_ANCHOR.y * 100).toFixed(2)}%`;
        style.transform = pose.mirrored
          ? `rotate(${pose.rotDeg.toFixed(2)}deg) scaleX(-1)`
          : `rotate(${pose.rotDeg.toFixed(2)}deg)`;
      }

      if (needles.speed.current) {
        needles.speed.current.setAttribute('transform', `rotate(${needleAngle(state.speedKmh, 0, SPEED_MAX, SPEED_SWEEP).toFixed(2)})`);
      }
      if (needles.grade.current) {
        needles.grade.current.setAttribute('transform', `rotate(${needleAngle(state.gradePct, -30, 30, GRADE_SWEEP).toFixed(2)})`);
      }
      if (needles.boost.current) {
        needles.boost.current.setAttribute('transform', `rotate(${needleAngle(state.boostCharges, 0, 2, GRADE_SWEEP).toFixed(2)})`);
      }
      if (needles.bounce.current) {
        needles.bounce.current.setAttribute('transform', `rotate(${needleAngle(state.bounceCharges, 0, 3, GRADE_SWEEP).toFixed(2)})`);
      }
      if (needles.shield.current) {
        needles.shield.current.setAttribute('transform', `rotate(${needleAngle(state.shieldSeconds, 0, 12, GRADE_SWEEP).toFixed(2)})`);
      }

      if (readouts.speed.current) readouts.speed.current.textContent = String(Math.round(state.speedKmh));
      if (readouts.position.current) readouts.position.current.textContent = `P${state.position}`;
      if (readouts.time.current) readouts.time.current.textContent = formatTime(state.raceTime);
      if (readouts.shield.current) readouts.shield.current.textContent = `${state.shieldSeconds.toFixed(1)}s`;
      if (readouts.boost.current) readouts.boost.current.textContent = `${state.boostCharges}/2`;
      if (readouts.bounce.current) readouts.bounce.current.textContent = `${state.bounceCharges}/3`;
      if (readouts.center.current) readouts.center.current.textContent = state.countdownLabel ?? '';

      const speedMeter = rootRef.current?.querySelector('[data-gauge="speed"]');
      if (speedMeter) speedMeter.setAttribute('aria-valuenow', String(Math.round(state.speedKmh)));
      if (bobRef.current) {
        const bob = active ? cockpitBob(state.speedKmh, state.grounded, reducedMotion, now / 1000) : 0;
        bobRef.current.style.transform = `translateY(${bob.toFixed(2)}px)`;
      }
      if (starterRef.current) {
        // The starter goblin's shove, 4 frames at 12 fps. Hidden the instant the push ends.
        starterRef.current.style.opacity = state.pushing ? '1' : '0';
        if (state.pushing) {
          const sheetFrame = Math.floor((now / 1000) * 12) % 4;
          starterRef.current.style.backgroundPosition = `${(sheetFrame % 2) * 100}% ${sheetFrame > 1 ? 100 : 0}%`;
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [layout, readState, state, reducedMotion, active]);

  const clusterLeft = COCKPIT_MANIFEST.clusters[0];
  const clusterRight = COCKPIT_MANIFEST.clusters[1];

  const placement = (cluster: typeof clusterLeft, dial: typeof clusterLeft.dials[number], width: number, x: number, y: number) => {
    const scale = width / cluster.w;
    return { x: x + dial.cx * scale, y: y + dial.cy * scale, size: dial.r * 2 * scale };
  };

  const leftBig = placement(clusterLeft, clusterLeft.dials[0], layout.clusters.left.w, layout.clusters.left.x, layout.clusters.left.y);
  const leftSmall = placement(clusterLeft, clusterLeft.dials[1], layout.clusters.left.w, layout.clusters.left.x, layout.clusters.left.y);
  const rightSmall = placement(clusterRight, clusterRight.dials[1], layout.clusters.right.w, layout.clusters.right.x, layout.clusters.right.y);
  const rightBig = placement(clusterRight, clusterRight.dials[0], layout.clusters.right.w, layout.clusters.right.x, layout.clusters.right.y);

  const dial = (
    box: { x: number; y: number; size: number }, file: string,
    needleRef: React.RefObject<SVGLineElement | null>, meter: string, label: string,
  ) => (
    <div className="cockpit-dial" style={{ left: box.x - box.size / 2, top: box.y - box.size / 2, width: box.size, height: box.size }}>
      <img src={file} alt="" aria-hidden="true" draggable={false} />
      <svg className="cockpit-needle" viewBox="-50 -50 100 100" aria-hidden="true">
        <line ref={needleRef} x1="0" y1="6" x2="0" y2={-46} />
      </svg>
      <span className="cockpit-dial-tag" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} data-gauge={meter}>{label}</span>
    </div>
  );

  return (
    <div className="cockpit-root" ref={rootRef} data-aperture={`${Math.round(layout.aperture.w)}x${Math.round(layout.aperture.h)}`}>
      <div className="cockpit-bob" ref={bobRef}>
        <img className="cockpit-bezel" ref={bezelRef} src={COCKPIT_ART.bezel} alt="" aria-hidden="true" draggable={false} />

        <img className="cockpit-cluster" style={{ left: layout.clusters.left.x, top: layout.clusters.left.y, width: layout.clusters.left.w }} src={COCKPIT_ART.clusters[0]} alt="" aria-hidden="true" draggable={false} />
        <img className="cockpit-cluster" style={{ left: layout.clusters.right.x, top: layout.clusters.right.y, width: layout.clusters.right.w }} src={COCKPIT_ART.clusters[1]} alt="" aria-hidden="true" draggable={false} />

        {dial(leftBig, COCKPIT_ART.dials[0], needles.grade, 'grade', 'GRADE')}
        {dial(leftSmall, COCKPIT_ART.dials[1], needles.boost, 'boost', 'BOOST')}
        {dial(rightSmall, COCKPIT_ART.dials[1], needles.bounce, 'bounce', 'BOUNCE')}
        {dial(rightBig, COCKPIT_ART.dials[0], needles.speed, 'speed', 'SPEED')}

        <div className="cockpit-center-readout" ref={readouts.center} role="status" />

        <div className="cockpit-starter" ref={starterRef} style={{ backgroundImage: `url(${COCKPIT_ART.starter})` }} aria-hidden="true" />

        <div className="cockpit-arm" ref={armLeftRef} style={{ backgroundImage: `url(${COCKPIT_ART.arm})` }} aria-hidden="true" />
        <div className="cockpit-arm" ref={armRightRef} style={{ backgroundImage: `url(${COCKPIT_ART.arm})` }} aria-hidden="true" />

        <div className="cockpit-yoke" ref={yokeRef} style={{ left: '50%', top: layout.yoke.hub.y, width: layout.yoke.w, height: layout.yoke.h }}>
          <img src={COCKPIT_ART.yoke} alt="" aria-hidden="true" draggable={false} />
        </div>
      </div>

      <div className="cockpit-readouts">
        <span className="cockpit-chip" aria-label="Race position" ref={readouts.position}>P1</span>
        <span className="cockpit-chip" aria-label="Race time" ref={readouts.time}>0:00.0</span>
        <span className="cockpit-chip" aria-label="Shield" ref={readouts.shield}>0.0s</span>
        <span className="cockpit-chip" aria-label="Boosts" ref={readouts.boost}>0/2</span>
        <span className="cockpit-chip" aria-label="Bounces" ref={readouts.bounce}>0/3</span>
        <span className="cockpit-chip cockpit-chip-speed" aria-label="Speed" ref={readouts.speed}>0</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}
