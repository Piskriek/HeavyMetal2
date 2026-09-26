/**
 * M01 · T4 / WIRE-3 — The first-person cockpit overlay.
 *
 * All painted art from `public/art/cockpit/` (measured by `scripts/cut-cockpit-art.mjs`
 * into `src/game/cockpit-art.json`):
 * - Glass grime and painted spiderweb cracks (PNGs with screen blend, no SVG path art)
 * - Painted large and small needles rotating around measured hub anchors
 * - Painted animated speed lines overlay inside the aperture at >80% top speed
 * - Dashboard trinkets with a spring-damper responding to steering, jolts, and bob
 * - Painted bezel, gauge clusters, starter goblin, yoke, and goblin arms
 *
 * No layout thrash, no per-frame React state re-render: one rAF loop reads
 * `engine.getCockpitState()` and updates CSS transforms via refs.
 */
import { gapLabel } from '../game/gap';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CRACK_THRESHOLD, NEEDLE_ANCHORS, SPEED_MAX, armsAt, cockpitBob, cockpitLayout, crackOpacity,
  crackTransform, driverGesture, needleAngle, speedLinesOpacity, yokeAngleDeg, yokeJolt,
  COCKPIT_ART, COCKPIT_MANIFEST, COCKPIT_MANIFEST as ART, type CockpitState,
} from '../game/cockpit';
import {
  TRINKET_DEFS, createTrinketSpringState, readDashboardTrinkets, stepTrinketSpring,
  type DashboardTrinkets, type TrinketDef,
} from '../game/cockpit-trinkets';
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
const GRADE_SWEEP = 220;

export default function CockpitHud({ readState, state, reducedMotion, active }: CockpitHudProps) {
  const layout = useMemo(
    () => cockpitLayout(typeof window === 'undefined' ? 1920 : window.innerWidth, typeof window === 'undefined' ? 1080 : window.innerHeight),
    [],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const bezelRef = useRef<HTMLImageElement>(null);
  const yokeRef = useRef<HTMLDivElement>(null);

  /** P2 & WIRE-3: painted glass crack and speed lines */
  const crackImgRef = useRef<HTMLImageElement>(null);
  const speedLinesRef = useRef<HTMLDivElement>(null);
  const crack = useRef({ at: -1e9, seed: 0, lastImpact: 0 });

  const armLeftRef = useRef<HTMLDivElement>(null);
  const armRightRef = useRef<HTMLDivElement>(null);
  const bobRef = useRef<HTMLDivElement>(null);
  const starterRef = useRef<HTMLDivElement>(null);

  /** WIRE-3: painted needles as HTMLImageElements (zero SVG lines) */
  const needles = {
    speed: useRef<HTMLImageElement>(null),
    grade: useRef<HTMLImageElement>(null),
    boost: useRef<HTMLImageElement>(null),
    bounce: useRef<HTMLImageElement>(null),
    shield: useRef<HTMLImageElement>(null),
  };

  /** WIRE-3 / X12: dashboard trinkets */
  const [trinkets, setTrinkets] = useState<DashboardTrinkets>(() => readDashboardTrinkets());
  const trinket1Ref = useRef<HTMLDivElement>(null);
  const trinket2Ref = useRef<HTMLDivElement>(null);
  const trinket1HeadRef = useRef<HTMLImageElement>(null);
  const trinket2HeadRef = useRef<HTMLImageElement>(null);
  const spring1 = useRef(createTrinketSpringState());
  const spring2 = useRef(createTrinketSpringState());
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setTrinkets(e.detail);
      else setTrinkets(readDashboardTrinkets());
    };
    window.addEventListener('goblin-trinkets-changed' as any, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('goblin-trinkets-changed' as any, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const readouts = {
    speed: useRef<HTMLSpanElement>(null),
    position: useRef<HTMLSpanElement>(null),
    gap: useRef<HTMLSpanElement>(null),
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
      const dt = lastTimeRef.current > 0 ? Math.min(0.05, (now - lastTimeRef.current) / 1000) : 0.016;
      lastTimeRef.current = now;

      // P2 & WIRE-3: a new big hit cracks the glass at its side with a painted crack PNG
      const cracks = crack.current;
      if (!reducedMotion && state.impact >= CRACK_THRESHOLD && state.impact > cracks.lastImpact + 0.15) {
        cracks.at = now;
        cracks.seed += 1;
        const tf = crackTransform(cracks.seed, state.impactSide, layout.aperture.w, layout.aperture.h);
        if (crackImgRef.current) {
          crackImgRef.current.src = tf.file;
          crackImgRef.current.style.left = `${tf.x.toFixed(1)}px`;
          crackImgRef.current.style.top = `${tf.y.toFixed(1)}px`;
          crackImgRef.current.style.transform = `translate(-50%, -50%) rotate(${tf.rotDeg}deg) scale(${tf.scale.toFixed(2)})`;
        }
      }
      cracks.lastImpact = state.impact;
      if (crackImgRef.current) {
        crackImgRef.current.style.opacity = reducedMotion ? '0' : crackOpacity((now - cracks.at) / 1000).toFixed(3);
      }

      // WIRE-3: speed lines appear above ~80% top speed, fading in and out; off under reduced motion
      if (speedLinesRef.current) {
        const spdOpacity = speedLinesOpacity(state.speedKmh, reducedMotion);
        speedLinesRef.current.style.opacity = spdOpacity.toFixed(3);
        if (spdOpacity > 0) {
          const sheetFrame = Math.floor((now / 1000) * 12) % 4;
          speedLinesRef.current.style.backgroundPosition = `${(sheetFrame % 2) * 100}% ${sheetFrame > 1 ? 100 : 0}%`;
        }
      }

      // H8: a hit jolts the yoke (and the hands on it); with reduced motion the cockpit flashes
      const jolt = yokeJolt(state.impact, state.impactSide, now / 1000, reducedMotion);
      const yokeDeg = yokeAngleDeg(state.steer) + jolt.rotDeg;

      // P3: the arms flinch, pump or brace with the race (still under reduced motion)
      const gesture = driverGesture(state, reducedMotion);
      const arms = armsAt(layout, yokeDeg, gesture.gesture, gesture.intensity, now / 1000);

      if (yokeRef.current) {
        yokeRef.current.style.transform = `translate(-50%, calc(-${(COCKPIT_MANIFEST.yoke.pivot.y / COCKPIT_MANIFEST.yoke.h) * 100}% + ${jolt.dropPx.toFixed(1)}px)) rotate(${yokeDeg.toFixed(2)}deg)`;
      }
      if (bobRef.current) bobRef.current.style.filter = jolt.flash > 0 ? `brightness(${(1 + 0.35 * jolt.flash).toFixed(3)})` : '';
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

      // WIRE-3: rotate painted needles about their measured hub anchor
      const setNeedleAngle = (img: HTMLImageElement | null, angle: number, isLarge: boolean) => {
        if (!img) return;
        const anchor = isLarge ? NEEDLE_ANCHORS.large : NEEDLE_ANCHORS.small;
        const hubYPercent = (anchor.hubFraction.y * 100).toFixed(2);
        img.style.transform = `translate(-50%, -${hubYPercent}%) rotate(${angle.toFixed(2)}deg)`;
      };

      setNeedleAngle(needles.speed.current, needleAngle(state.speedKmh, 0, SPEED_MAX, SPEED_SWEEP), true);
      setNeedleAngle(needles.grade.current, needleAngle(state.gradePct, -30, 30, GRADE_SWEEP), false);
      setNeedleAngle(needles.boost.current, needleAngle(state.boostCharges, 0, 2, GRADE_SWEEP), false);
      setNeedleAngle(needles.bounce.current, needleAngle(state.bounceCharges, 0, 3, GRADE_SWEEP), false);
      setNeedleAngle(needles.shield.current, needleAngle(state.shieldSeconds, 0, 12, GRADE_SWEEP), false);

      if (readouts.speed.current) readouts.speed.current.textContent = String(Math.round(state.speedKmh));
      if (readouts.position.current) readouts.position.current.textContent = `P${state.position}`;

      // H9: the gap to the rider ahead, coloured by whether it is closing
      const gapChip = readouts.gap.current;
      if (gapChip) {
        const show = state.gapPlace > 0;
        gapChip.hidden = !show;
        if (show) {
          gapChip.textContent = gapLabel({ place: state.gapPlace, seconds: state.gapSeconds });
          gapChip.dataset.trend = state.gapTrend;
        }
      }
      if (readouts.time.current) readouts.time.current.textContent = formatTime(state.raceTime);
      if (readouts.shield.current) readouts.shield.current.textContent = `${state.shieldSeconds.toFixed(1)}s`;
      if (readouts.boost.current) readouts.boost.current.textContent = `${state.boostCharges}/2`;
      if (readouts.bounce.current) readouts.bounce.current.textContent = `${state.bounceCharges}/3`;
      if (readouts.center.current) readouts.center.current.textContent = state.countdownLabel ?? '';

      const speedMeter = rootRef.current?.querySelector('[data-gauge="speed"]');
      if (speedMeter) speedMeter.setAttribute('aria-valuenow', String(Math.round(state.speedKmh)));

      const bob = active ? cockpitBob(state.speedKmh, state.grounded, reducedMotion, now / 1000) : 0;
      if (bobRef.current) {
        bobRef.current.style.transform = `translateY(${bob.toFixed(2)}px)`;
      }

      // WIRE-3 / X12: step trinket spring-dampers and update transforms
      const motionInput = {
        steer: state.steer,
        bob,
        impact: state.impact,
        impactSide: state.impactSide,
        reducedMotion,
        dt,
      };
      const s1 = stepTrinketSpring(spring1.current, motionInput);
      const s2 = stepTrinketSpring(spring2.current, motionInput);

      const def1 = TRINKET_DEFS[trinkets.slot1];
      const def2 = TRINKET_DEFS[trinkets.slot2];

      if (trinket1Ref.current && def1 && def1.id !== 'none') {
        if (def1.type === 'bobblehead') {
          trinket1Ref.current.style.transform = `translateY(${s1.yPx.toFixed(1)}px)`;
          if (trinket1HeadRef.current) {
            trinket1HeadRef.current.style.transform = `translateX(-50%) rotate(${s1.angleDeg.toFixed(2)}deg) translateY(${s1.yPx.toFixed(1)}px)`;
          }
        } else if (def1.type === 'hanging') {
          trinket1Ref.current.style.transformOrigin = `${(def1.anchorFraction.x * 100).toFixed(0)}% ${(def1.anchorFraction.y * 100).toFixed(0)}%`;
          trinket1Ref.current.style.transform = `rotate(${s1.angleDeg.toFixed(2)}deg) translateY(${s1.yPx.toFixed(1)}px)`;
        } else {
          trinket1Ref.current.style.transformOrigin = `${(def1.anchorFraction.x * 100).toFixed(0)}% ${(def1.anchorFraction.y * 100).toFixed(0)}%`;
          trinket1Ref.current.style.transform = `rotate(${s1.angleDeg.toFixed(2)}deg) translateY(${s1.yPx.toFixed(1)}px)`;
        }
      }

      if (trinket2Ref.current && def2 && def2.id !== 'none') {
        if (def2.type === 'bobblehead') {
          trinket2Ref.current.style.transform = `translateY(${s2.yPx.toFixed(1)}px)`;
          if (trinket2HeadRef.current) {
            trinket2HeadRef.current.style.transform = `translateX(-50%) rotate(${s2.angleDeg.toFixed(2)}deg) translateY(${s2.yPx.toFixed(1)}px)`;
          }
        } else if (def2.type === 'hanging') {
          trinket2Ref.current.style.transformOrigin = `${(def2.anchorFraction.x * 100).toFixed(0)}% ${(def2.anchorFraction.y * 100).toFixed(0)}%`;
          trinket2Ref.current.style.transform = `rotate(${s2.angleDeg.toFixed(2)}deg) translateY(${s2.yPx.toFixed(1)}px)`;
        } else {
          trinket2Ref.current.style.transformOrigin = `${(def2.anchorFraction.x * 100).toFixed(0)}% ${(def2.anchorFraction.y * 100).toFixed(0)}%`;
          trinket2Ref.current.style.transform = `rotate(${s2.angleDeg.toFixed(2)}deg) translateY(${s2.yPx.toFixed(1)}px)`;
        }
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
  }, [layout, readState, state, reducedMotion, active, trinkets]);

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

  /** WIRE-3: dial with painted needle image (no SVG paths/lines) */
  const dial = (
    box: { x: number; y: number; size: number },
    faceFile: string,
    needleRef: React.RefObject<HTMLImageElement | null>,
    meter: string,
    label: string,
    isLarge = false,
  ) => {
    const anchor = isLarge ? NEEDLE_ANCHORS.large : NEEDLE_ANCHORS.small;
    const needleFile = isLarge ? COCKPIT_ART.needles.large : COCKPIT_ART.needles.small;
    const reach = (box.size / 2) * 0.86;
    const needleH = reach / anchor.hubFraction.y;
    const needleW = needleH * anchor.aspect;
    const hubYPercent = (anchor.hubFraction.y * 100).toFixed(2);

    return (
      <div className="cockpit-dial" style={{ left: box.x - box.size / 2, top: box.y - box.size / 2, width: box.size, height: box.size }}>
        <img src={faceFile} alt="" aria-hidden="true" draggable={false} />
        <img
          ref={needleRef}
          className={`cockpit-needle-img ${isLarge ? 'cockpit-needle-large' : 'cockpit-needle-small'}`}
          src={needleFile}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            left: '50%',
            top: '50%',
            width: `${needleW.toFixed(1)}px`,
            height: `${needleH.toFixed(1)}px`,
            transformOrigin: `50% ${hubYPercent}%`,
            transform: `translate(-50%, -${hubYPercent}%) rotate(0deg)`,
          }}
        />
        <span className="cockpit-dial-tag" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} data-gauge={meter}>{label}</span>
      </div>
    );
  };

  /** WIRE-3: render a dashboard trinket sprite on the ledge */
  const renderTrinket = (def: TrinketDef, slotRef: React.RefObject<HTMLDivElement | null>, headRef: React.RefObject<HTMLImageElement | null>, x: number, y: number) => {
    if (def.id === 'none') return null;

    if (def.type === 'bobblehead' && def.bodyFile && def.headFile) {
      return (
        <div
          ref={slotRef}
          className="cockpit-trinket cockpit-trinket-bobble"
          style={{
            left: `${x}px`,
            top: `${y}px`,
            width: `${def.width}px`,
            height: `${def.height}px`,
            transform: 'none',
          }}
        >
          <img src={def.bodyFile} alt="" className="cockpit-trinket-sheep-body" draggable={false} />
          <img ref={headRef} src={def.headFile} alt="" className="cockpit-trinket-sheep-head" draggable={false} />
        </div>
      );
    }

    return (
      <div
        ref={slotRef}
        className="cockpit-trinket"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${def.width}px`,
          height: `${def.height}px`,
          transformOrigin: `${(def.anchorFraction.x * 100).toFixed(0)}% ${(def.anchorFraction.y * 100).toFixed(0)}%`,
          transform: 'none',
        }}
      >
        <img src={def.file} alt="" style={{ width: '100%', height: '100%' }} draggable={false} />
      </div>
    );
  };

  // Dashboard ledge coordinates: right under the aperture bottom edge
  const ledgeY = layout.aperture.y + layout.aperture.h;
  const trinket1Def = TRINKET_DEFS[trinkets.slot1];
  const trinket2Def = TRINKET_DEFS[trinkets.slot2];
  const trinket1X = layout.aperture.x + layout.aperture.w * 0.28;
  const trinket1Y = ledgeY - trinket1Def.height * 0.78;
  const trinket2X = layout.aperture.x + layout.aperture.w * 0.72 - trinket2Def.width;
  const trinket2Y = ledgeY - trinket2Def.height * 0.78;

  return (
    <div className="cockpit-root" ref={rootRef} data-aperture={`${Math.round(layout.aperture.w)}x${Math.round(layout.aperture.h)}`} data-reduced-motion={reducedMotion ? 'true' : 'false'}>
      <div className="cockpit-bob" ref={bobRef}>
        {/* P2 & WIRE-3: painted glass in the window (grime, cracks, and speed lines) */}
        <div
          className="cockpit-glass"
          aria-hidden="true"
          style={{
            left: layout.aperture.x,
            top: layout.aperture.y,
            width: layout.aperture.w,
            height: layout.aperture.h,
            borderRadius: layout.aperture.radius,
          }}
        >
          <img className="cockpit-glass-grime" src={COCKPIT_ART.glassGrime} alt="" aria-hidden="true" draggable={false} />
          <img
            ref={crackImgRef}
            className="cockpit-glass-crack"
            src={COCKPIT_ART.cracks[0]}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{ opacity: 0 }}
          />
          <div ref={speedLinesRef} className="cockpit-speed-lines" aria-hidden="true" style={{ opacity: 0 }} />
        </div>

        <img className="cockpit-bezel" ref={bezelRef} src={COCKPIT_ART.bezel} alt="" aria-hidden="true" draggable={false} />

        <img className="cockpit-cluster" style={{ left: layout.clusters.left.x, top: layout.clusters.left.y, width: layout.clusters.left.w }} src={COCKPIT_ART.clusters[0]} alt="" aria-hidden="true" draggable={false} />
        <img className="cockpit-cluster" style={{ left: layout.clusters.right.x, top: layout.clusters.right.y, width: layout.clusters.right.w }} src={COCKPIT_ART.clusters[1]} alt="" aria-hidden="true" draggable={false} />

        {/* WIRE-3 / X12: dashboard ledge trinkets */}
        {renderTrinket(trinket1Def, trinket1Ref, trinket1HeadRef, trinket1X, trinket1Y)}
        {renderTrinket(trinket2Def, trinket2Ref, trinket2HeadRef, trinket2X, trinket2Y)}

        {dial(leftBig, COCKPIT_ART.dials[0], needles.grade, 'grade', 'GRADE', false)}
        {dial(leftSmall, COCKPIT_ART.dials[1], needles.boost, 'boost', 'BOOST', false)}
        {dial(rightSmall, COCKPIT_ART.dials[1], needles.bounce, 'bounce', 'BOUNCE', false)}
        {dial(rightBig, COCKPIT_ART.dials[0], needles.speed, 'speed', 'SPEED', true)}

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
        <span className="cockpit-chip cockpit-chip-gap" aria-label="Gap to the rider ahead" ref={readouts.gap} hidden />
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
