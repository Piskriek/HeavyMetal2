// The preset bench's Soul Harness page (plan 47, Pillar 3): the 8 canonical vessel souls first, then the soul
// tuned on 6 curated sliders. The pinned turntable runs the REAL @hm/mobsim inception loop headlessly at 50 Hz —
// the scout kit leans with the plant's lateral state, the four HUD instruments read the live state vector, and
// [Fire 130 dB Stress Impulse] lets the player watch their tuning anneal the trench (or, with the Higher-Self
// bridge off, watch the unbuffered panic lock in). Previews drive play: the same code path the driven rover runs.
// The cartridge goes in the beam rifle (Ray-7 violet port); entering a vehicle with it loaded binds the soul.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CAYLEY_PADE_OUT_LENGTH, StateIdx } from '@hm/harness';
import { stepRoverEscortHarness, type IRoverActuatorOutput, type IRoverPhysicalInput } from '@hm/mobsim';
import {
  CONTEXT_MODE_NAMES,
  ETHICAL_CONSTRAINT_NAMES,
  HARNESS_SHELF_PRESETS,
  encodeHarnessCartridgeCode,
  toHarnessTuning,
  toVesselPreset,
  type ContextModeCode,
  type EthicalConstraintCode,
  type HarnessPrintSpec,
  type IHarnessCartridgeSpec,
} from '@hm/cartlab';
import { HarnessTelemetryHud, computeHarnessHudViewModel, type IHarnessHudViewModel } from '../base/ui/harness-telemetry-hud';
import { plotVehicleKit } from './plot-kits';
import { createTurntable } from './turntable';
import './bench-parts.css';

export interface BenchHarnessProps {
  /** Whether printing this harness can start now, and why not (the bench, the blank, the power). */
  readonly check: (spec: HarnessPrintSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (spec: HarnessPrintSpec) => void;
  readonly printLabel?: string;
  /** The number of the first step on this page (the lab bench's step 1 is picking the blank). */
  readonly firstStep?: number;
}

const SIM_DT = 0.02;
/** The stress window: 0.9 s of 130 dB flatbed concussion, with a 45 N lateral recoil kick in its first 0.12 s. */
const STRESS_SECONDS = 0.9;
const STRESS_KICK_UNTIL = STRESS_SECONDS - 0.12;

const SHELF_IDS = Object.keys(HARNESS_SHELF_PRESETS);

/** A soul drawn as a small aura ball: violet for stewards, cyan for embodied vessels. */
const soulBall = (spec: IHarnessCartridgeSpec): React.CSSProperties => {
  const hex = spec.tier === 3 ? '#b84dff' : '#3dc8ff';
  return {
    background: `radial-gradient(circle at 50% 45%, #ffffff 0%, ${hex} 40%, rgba(0, 0, 0, 0.55) 100%)`,
    boxShadow: `0 0 10px ${hex}`,
  };
};

export const BenchHarness: React.FC<BenchHarnessProps> = ({ check, onPrint, printLabel = 'Start printing', firstStep = 2 }) => {
  const [shelfId, setShelfId] = useState('harness:escort-steadfast');
  const [tunedFields, setTunedFields] = useState<Pick<IHarnessCartridgeSpec,
    'relativeAwarenessCeiling' | 'baselinePrecisionPi0' | 'annealRateAlpha' | 'syntropicDampingNspm' | 'defaultContextMode' | 'ethicalConstraint'> | null>(null);
  const [bridgeOn, setBridgeOn] = useState(true);
  const [vm, setVm] = useState<IHarnessHudViewModel | null>(null);

  const shelf = HARNESS_SHELF_PRESETS[shelfId] ?? HARNESS_SHELF_PRESETS['harness:escort-steadfast']!;
  const spec = useMemo<IHarnessCartridgeSpec>(() => {
    if (!tunedFields) return shelf;
    const tuned = { ...shelf, ...tunedFields };
    if (JSON.stringify(tuned) === JSON.stringify(shelf)) return shelf;
    return { ...tuned, id: 'harness:bench-tuned', name: `Tuned ${shelf.name}` };
  }, [shelf, tunedFields]);
  const ref = useMemo(() => encodeHarnessCartridgeCode(spec), [spec]);
  const printSpec = useMemo<HarnessPrintSpec>(() => ({ name: spec.name, ref }), [spec, ref]);
  const can = check(printSpec);

  // The live inception-loop runtime: caller-owned buffers, exactly as the driven rover holds them.
  const simState = useRef(new Float32Array(24));
  const simTel = useRef(new Float32Array(4));
  const simLedger = useRef(new Float64Array(4));
  const simLatch = useRef(new Int8Array(1));
  const simLatchAccum = useRef(new Float32Array(1));
  const simMastery = useRef(new Float32Array(1));
  const simScratch = useRef(new Float64Array(CAYLEY_PADE_OUT_LENGTH));
  const simActuator = useRef<IRoverActuatorOutput>({
    steerAngleRad: 0, driveTorqueNm: 0, activeSuspensionDampingNspm: 0,
    lateralErrorM: 0, tractionSlipRatio: 0, graduatedToSquadLeader: false,
  });
  const stressLeft = useRef(0);

  useEffect(() => {
    const vessel = toVesselPreset(spec);
    const tuning = toHarnessTuning(spec);
    const s = simState.current;
    s.fill(0);
    s[StateIdx.E_RESERVE] = 5.0;
    s[StateIdx.PI_KIN] = tuning.piBase;
    s[StateIdx.PI_THERM] = 1.0;
    s[StateIdx.PI_ACOUST] = 1.0;
    s[StateIdx.PI_PRIOR] = tuning.piBase;
    s[StateIdx.A_AWARE] = 0.12;
    s[StateIdx.H_COHERENCE] = 0.5;
    simTel.current.fill(0);
    simLedger.current.fill(0);
    simLatch.current[0] = 0;
    simLatchAccum.current[0] = 0;
    simMastery.current[0] = 0;
    stressLeft.current = 0;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastPush = 0;
    const loop = (now: number): void => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= SIM_DT) {
        stressLeft.current = Math.max(0, stressLeft.current - SIM_DT);
        const input: IRoverPhysicalInput = {
          escortLineTargetX: 0,
          escortSpeedTargetMps: 6.0,
          flatbedGunfireDb: stressLeft.current > 0 ? 130.0 : 0.0,
          gunfireIsFriendlyAllies: true,
          surfaceGripMu: 0.45,
          lateralImpulseN: stressLeft.current > STRESS_KICK_UNTIL ? 45.0 : 0.0,
        };
        stepRoverEscortHarness(
          simState.current, simTel.current, simLedger.current, simLatch.current, simLatchAccum.current,
          simMastery.current, simScratch.current, vessel, tuning, input, SIM_DT, bridgeOn, simActuator.current,
        );
        acc -= SIM_DT;
      }
      if (now - lastPush > 80) {
        setVm(computeHarnessHudViewModel(
          simState.current, simLedger.current, simLatch.current[0]!, simMastery.current[0]!,
          vessel.evaluator.masteryWindowSec, vessel.relativeAwarenessCeiling,
        ));
        lastPush = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spec, bridgeOn]);

  // The pinned turntable: the scout kit leaning with the live plant state (suspension sway + body roll).
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = createTurntable(canvas);
    const build = plotVehicleKit('scout', 'mid', 3);
    if (build) {
      const box = new THREE.Box3().setFromObject(build.group);
      stage.scene.add(build.group);
      stage.fit([box.min.x, box.min.y, box.min.z], [box.max.x, box.max.y, box.max.z]);
      stage.onFrame = () => {
        const s = simState.current;
        build.group.rotation.z = -s[StateIdx.QX]! * 0.22;
        build.group.position.x = s[StateIdx.QX]! * 0.08;
      };
    }
    return () => stage.dispose();
  }, []);

  const set = (patch: Partial<NonNullable<typeof tunedFields>>): void =>
    setTunedFields((t) => ({
      relativeAwarenessCeiling: shelf.relativeAwarenessCeiling,
      baselinePrecisionPi0: shelf.baselinePrecisionPi0,
      annealRateAlpha: shelf.annealRateAlpha,
      syntropicDampingNspm: shelf.syntropicDampingNspm,
      defaultContextMode: shelf.defaultContextMode,
      ethicalConstraint: shelf.ethicalConstraint,
      ...t,
      ...patch,
    }));

  const shown = tunedFields ? { ...shelf, ...tunedFields } : shelf;

  return (
    <div className="bench-parts bench-harness" data-testid="bench-harness">
      <div className="bench-parts-stage bench-harness-stage">
        <figure className="part-preview">
          <canvas ref={canvasRef} />
          <div className="bench-harness-hud" aria-hidden="true"><HarnessTelemetryHud vm={vm} /></div>
        </figure>
        <div className="bench-harness-tests">
          <button data-testid="bench-harness-stress" onClick={() => { stressLeft.current = STRESS_SECONDS; }}>
            💥 Fire 130 dB Stress Impulse
          </button>
          <button className={bridgeOn ? 'on' : ''} aria-pressed={bridgeOn} data-testid="bench-harness-bridge"
            onClick={() => setBridgeOn((b) => !b)}>
            Higher-Self bridge {bridgeOn ? 'linked' : 'severed'}
          </button>
        </div>
      </div>

      <div className="play-carts">
        <h4>{firstStep}. Pick a vessel soul</h4>
        <div className="bench-parts-gens">
          {SHELF_IDS.map((id) => {
            const p = HARNESS_SHELF_PRESETS[id]!;
            return (
              <button key={id} className={shelfId === id ? 'on' : ''} data-testid={`bench-harness-${id.slice('harness:'.length)}`}
                onClick={() => { setShelfId(id); setTunedFields(null); }}>
                <i aria-hidden="true" className="bench-light-ball" style={soulBall(p)} />
                <b>{p.name}</b>
              </button>
            );
          })}
        </div>
      </div>

      <div className="play-carts">
        <h4>{firstStep + 1}. Tune it</h4>
        <label className="bench-parts-row">
          <span>Awareness cap</span>
          <output>{shown.relativeAwarenessCeiling.toFixed(2)}</output>
          <input type="range" min={0.1} max={1} step={0.01} value={shown.relativeAwarenessCeiling}
            data-testid="bench-harness-awareness" onChange={(e) => set({ relativeAwarenessCeiling: Number(e.currentTarget.value) })} />
        </label>
        <label className="bench-parts-row">
          <span>Baseline Π₀</span>
          <output>{shown.baselinePrecisionPi0.toFixed(2)}</output>
          <input type="range" min={0.5} max={5} step={0.05} value={shown.baselinePrecisionPi0}
            data-testid="bench-harness-pi0" onChange={(e) => set({ baselinePrecisionPi0: Number(e.currentTarget.value) })} />
        </label>
        <label className="bench-parts-row">
          <span>Anneal rate α</span>
          <output>{shown.annealRateAlpha.toFixed(1)}</output>
          <input type="range" min={4} max={30} step={0.5} value={shown.annealRateAlpha}
            data-testid="bench-harness-alpha" onChange={(e) => set({ annealRateAlpha: Number(e.currentTarget.value) })} />
        </label>
        <label className="bench-parts-row">
          <span>Syntropic damping</span>
          <output>{shown.syntropicDampingNspm.toFixed(1)} N·s/m</output>
          <input type="range" min={0.5} max={8} step={0.1} value={shown.syntropicDampingNspm}
            data-testid="bench-harness-rsyn" onChange={(e) => set({ syntropicDampingNspm: Number(e.currentTarget.value) })} />
        </label>
        <div className="bench-parts-ops" role="radiogroup" aria-label="Context mode">
          {CONTEXT_MODE_NAMES.map((name, code) => (
            <button key={name} role="radio" aria-checked={shown.defaultContextMode === code}
              className={shown.defaultContextMode === code ? 'on' : ''} data-testid={`bench-harness-ctx-${code}`}
              onClick={() => set({ defaultContextMode: code as ContextModeCode })}>
              {name.replaceAll('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>
        <div className="bench-parts-ops" role="radiogroup" aria-label="Ethical constraint">
          {ETHICAL_CONSTRAINT_NAMES.map((name, code) => (
            <button key={name} role="radio" aria-checked={shown.ethicalConstraint === code}
              className={shown.ethicalConstraint === code ? 'on' : ''} data-testid={`bench-harness-eth-${code}`}
              onClick={() => set({ ethicalConstraint: code as EthicalConstraintCode })}>
              {name.replaceAll('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="bench-parts-cost">
        <b>{spec.name}</b><span className="bench-parts-cost-sep">. </span>
        A harness takes a blank and the bench's time, like a written material. Load it in the rifle and enter a vehicle to bind its soul.
      </p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(printSpec)} data-testid="bench-print-harness">{printLabel}</button>
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </div>
  );
};
