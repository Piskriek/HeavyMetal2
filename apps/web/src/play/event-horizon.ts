/**
 * The Stargate's event horizon (JOB-08b): the mirror-still pool, the kawoosh that bursts out of it when the gate
 * connects, and the shimmer that settles back into it.
 *
 * The whole effect is a function of three numbers — `(simTime, gateState, lastEventTime)` — and nothing else. There is
 * no `+=`, no damped spring and no per-frame accumulator anywhere in this module: the uniforms are recomputed from the
 * clock every frame, so a scrub to t = 40 s lands on exactly the frame the playthrough would have shown at 40 s, and a
 * replay of the same event is byte-identical. That is the whole reason the envelopes below are pure functions rather
 * than state machines.
 *
 * Four envelopes, each with one job:
 *
 *  - `uLockEnvelope` — the 9-chevron step build: the ninth chevron locking is the gate connecting, so the horizon is
 *    only as present as the dial has got. Nine discrete steps, never a smooth fade.
 *  - `uKawooshBurst` — the burst itself: a monotonic 0.18 s attack, a monotonic 1.1 s decay, and nothing after. It
 *    drives an outward displacement in the shader, so the pool is pushed to the rim and cools back to its steady state.
 *  - `uSteadyHorizon` — the pool's damped ripples: at full strength until the burst takes over, then back to full as the
 *    burst cools. The shader adds chromatic dispersion across those ripples.
 *  - `uShutdownFade` — the monotonic cooling to exactly 0.0 when the gate closes: it starts at 1.0 on the closing frame
 *    (so closing never pops) and reaches 0.0 at `SHUTDOWN_S`, never overshooting and never coming back.
 *
 * The aperture's edge is clamped the same way in both languages: `smoothstep(innerRadius, innerRadius - rimWidth, r)`,
 * which is exactly 0.0 at the glyph wall and exactly 1.0 at `rimWidth` inside it — no cell-edge seam, because the value
 * at the wall is reached by the curve rather than by a discard.
 */
import * as THREE from 'three';

/** Seconds of the kawoosh's rising edge (JOB-08b: 0.18 s). */
export const KAWOOSH_ATTACK_S = 0.18;
/** Seconds of the kawoosh's falling edge (JOB-08b: 1.1 s). */
export const KAWOOSH_DECAY_S = 1.1;
/** Seconds the horizon takes to cool to exactly 0.0 once the gate closes. */
export const SHUTDOWN_S = 0.9;
/** Chevrons on a Stargate (the dial's nine). */
export const CHEVRON_COUNT = 9;
/** How much of the burst survives behind closed iris blades: the rest is a shimmer, not a kawoosh. */
export const IRIS_KAWOOSH_SUPPRESSION = 0.18;
/** The rim's chromatic dispersion, in aperture-radius units. */
export const HORIZON_DISPERSION = 0.012;

/** The slice of the gate's state the horizon reads. */
export interface GateHorizonState {
  /** The gate has dialled out and is holding a connection: the pool is established. */
  readonly open: boolean;
  /** The iris is locked across the aperture: titanium blades, so only shimmers reach the ring. */
  readonly irisClosed: boolean;
  /** Chevrons the dial has locked, 0..9 (9 = connected). */
  readonly chevrons: number;
}

/** The uniforms the horizon shader takes, all evaluated from the clock (never accumulated). */
export interface EventHorizonUniforms {
  readonly uTime: number;
  readonly uLockEnvelope: number;
  readonly uKawooshBurst: number;
  readonly uSteadyHorizon: number;
  readonly uShutdownFade: number;
  readonly uIrisMask: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The burst envelope at `tau` seconds after the last gate event: 0 before the event, a monotonic rise to exactly 1.0 at
 * `KAWOOSH_ATTACK_S`, a monotonic fall to exactly 0.0 at `KAWOOSH_ATTACK_S + KAWOOSH_DECAY_S`, and 0 after that.
 */
export function kawooshBurst(tau: number): number {
  if (!(tau > 0)) return 0;
  if (tau <= KAWOOSH_ATTACK_S) return tau / KAWOOSH_ATTACK_S;
  const falling = tau - KAWOOSH_ATTACK_S;
  if (falling >= KAWOOSH_DECAY_S) return 0;
  return 1 - falling / KAWOOSH_DECAY_S;
}

/** The 9-chevron step build: nine discrete steps from 0.0 (no lock) to 1.0 (connected). */
export function lockEnvelope(chevrons: number): number {
  const n = Math.max(0, Math.min(CHEVRON_COUNT, Math.trunc(chevrons)));
  return n / CHEVRON_COUNT;
}

/** The steady pool's ripple amplitude: full while idle, pushed aside by the burst, and back to full as it cools. */
export function steadyHorizon(burst: number): number {
  return clamp01(1 - 0.85 * clamp01(burst));
}

/** The shutdown's monotonic cooling: exactly 1.0 at the closing frame and exactly 0.0 from `SHUTDOWN_S` on. */
export function shutdownFade(tau: number): number {
  if (!(tau > 0)) return 1;
  if (tau >= SHUTDOWN_S) return 0;
  return 1 - tau / SHUTDOWN_S;
}

/**
 * The aperture edge: 1.0 at `rimWidth` inside the glyph wall, exactly 0.0 on the wall itself and beyond it. The same
 * curve the shader evaluates, so the CPU can prove the boundary the GPU draws.
 */
export function horizonEdgeAt(radius: number, innerRadius: number, rimWidth: number): number {
  const x = clamp01((innerRadius - radius) / Math.max(rimWidth, 1e-6));
  return x * x * (3 - 2 * x);
}

/**
 * Every uniform the horizon draws with, from the clock and the gate's state alone. Pure: the same three arguments give
 * the same six numbers, whatever was evaluated before them.
 */
export function eventHorizonUniforms(simTimeSec: number, state: GateHorizonState, lastEventTimeSec: number): EventHorizonUniforms {
  const tau = simTimeSec - lastEventTimeSec;
  const burst = state.open ? kawooshBurst(tau) : 0;
  return {
    uTime: simTimeSec,
    uLockEnvelope: state.open ? Math.max(lockEnvelope(state.chevrons), 1 / CHEVRON_COUNT) : lockEnvelope(state.chevrons),
    uKawooshBurst: burst,
    uSteadyHorizon: steadyHorizon(burst),
    uShutdownFade: state.open ? 1 : shutdownFade(tau),
    uIrisMask: state.open && state.irisClosed ? 1 : 0,
  };
}

/** The horizon's fragment shader: a pool, its ripples, the burst's outward displacement and the rim clamp. */
export const EVENT_HORIZON_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export const EVENT_HORIZON_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uLockEnvelope;
  uniform float uKawooshBurst;
  uniform float uSteadyHorizon;
  uniform float uShutdownFade;
  uniform float uIrisMask;
  uniform float uInnerRadius;
  uniform float uRimWidth;
  uniform float uDispersion;
  uniform vec3 uPool;
  uniform vec3 uRim;
  varying vec2 vUv;

  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    // the glyph wall: exactly 0.0 at uInnerRadius, exactly 1.0 a rim's width inside it
    float edge = smoothstep(uInnerRadius, uInnerRadius - uRimWidth, r);
    float angle = atan(p.y, p.x);

    // the burst pushes the pool outward; behind locked iris blades only an impact shimmer survives
    float burst = uKawooshBurst * mix(1.0, ${IRIS_KAWOOSH_SUPPRESSION.toFixed(2)}, uIrisMask);
    float pushed = r - burst * 0.35 * (1.0 - r);

    // damped physical ripples: two crossing wave trains, their wavelength stretched by the burst
    float ripple = sin(angle * 7.0 + uTime * 2.4 + pushed * 22.0 * uSteadyHorizon);
    ripple += sin(angle * 11.0 - uTime * 3.7 + pushed * 31.0) * 0.5;
    ripple *= 0.5 + 0.5 * uSteadyHorizon;

    // chromatic dispersion across the rim: the three channels read the ripple at slightly different radii
    float disp = uDispersion * (0.35 + 0.65 * r);
    float sr = sin(angle * 7.0 + uTime * 2.4 + (pushed + disp) * 22.0);
    float sb = sin(angle * 7.0 + uTime * 2.4 + (pushed - disp) * 22.0);

    vec3 pool = uPool * (0.82 + 0.18 * ripple);
    vec3 rim = uRim * pow(clamp(r, 0.0, 1.0), 2.2) * (0.75 + 0.25 * ripple);
    vec3 col = pool + rim;
    col.r += 0.035 * sr * uSteadyHorizon;
    col.b += 0.045 * sb * uSteadyHorizon;
    col += uRim * burst * 0.5;

    float energy = uShutdownFade * (0.55 + 0.45 * uLockEnvelope);
    gl_FragColor = vec4(col * energy * edge, edge);
  }`;

/** The uniforms a horizon material starts with: seven scalars and two colours, all overwritten every frame. */
export function eventHorizonUniformValues(o: {
  readonly innerRadius: number;
  readonly rimWidth: number;
  readonly pool?: THREE.ColorRepresentation;
  readonly rim?: THREE.ColorRepresentation;
}): Record<string, THREE.IUniform> {
  return {
    uTime: { value: 0 },
    uLockEnvelope: { value: 0 },
    uKawooshBurst: { value: 0 },
    uSteadyHorizon: { value: 1 },
    uShutdownFade: { value: 0 },
    uIrisMask: { value: 0 },
    uInnerRadius: { value: o.innerRadius },
    uRimWidth: { value: o.rimWidth },
    uDispersion: { value: HORIZON_DISPERSION },
    uPool: { value: new THREE.Color(o.pool ?? '#0d2a33') },
    uRim: { value: new THREE.Color(o.rim ?? '#7fd8ff') },
  };
}

/** The horizon's material: additive, depth-write off, so the pool reads as light in the ring rather than as a panel. */
export function createEventHorizonMaterial(o: {
  readonly innerRadius: number;
  readonly rimWidth: number;
  readonly pool?: THREE.ColorRepresentation;
  readonly rim?: THREE.ColorRepresentation;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: EVENT_HORIZON_VERTEX,
    fragmentShader: EVENT_HORIZON_FRAGMENT,
    uniforms: eventHorizonUniformValues(o),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Writes one frame's uniforms into a horizon material. The values come from `eventHorizonUniforms`; this function only
 * copies them, so it holds no state of its own and the same frame written twice leaves the same pixels.
 */
export function applyEventHorizon(material: THREE.ShaderMaterial, u: EventHorizonUniforms): void {
  const set = (name: string, value: number): void => {
    const slot = material.uniforms[name];
    if (slot) slot.value = value;
  };
  set('uTime', u.uTime);
  set('uLockEnvelope', u.uLockEnvelope);
  set('uKawooshBurst', u.uKawooshBurst);
  set('uSteadyHorizon', u.uSteadyHorizon);
  set('uShutdownFade', u.uShutdownFade);
  set('uIrisMask', u.uIrisMask);
}
