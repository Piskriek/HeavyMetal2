/**
 * @file apps/web/src/studio/audio-tab.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Phase 4 & Aspect 10):
 * Real Web Audio API Synthesis Engine + `@hm/soundlab` Deterministic Recipe Renderer +
 * Live Waveform Oscilloscope & Frequency Spectrum Analyzer Canvas.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ENGINE_SPEC,
  engineParamsFor,
  renderRecipe,
  validateRecipe,
  type SfxRecipe,
  type Wave,
} from '@hm/soundlab';
import type { StudioState, StudioStore } from './state/studio-store';

export interface AudioTabProps {
  state: StudioState;
  store: StudioStore;
}

export interface StudioAudioStem {
  id: string;
  label: string;
  stageUnlock: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  wave: Wave;
  freqStart: number;
  freqEnd: number;
  cutoffHz: number;
  resonanceQ: number;
  volume: number;
  durationMs: number;
}

const INITIAL_STEMS: StudioAudioStem[] = [
  {
    id: 'stem:mill-motor',
    label: 'Texture Mill Motor Hum',
    stageUnlock: 0,
    wave: 'sawtooth',
    freqStart: 110,
    freqEnd: 115,
    cutoffHz: 820,
    resonanceQ: 2.4,
    volume: 0.65,
    durationMs: 1200,
  },
  {
    id: 'stem:stargate-kawoosh',
    label: 'Stargate Vortex & Chevron Lock',
    stageUnlock: 0,
    wave: 'sine',
    freqStart: 65,
    freqEnd: 320,
    cutoffHz: 1450,
    resonanceQ: 4.2,
    volume: 0.78,
    durationMs: 1500,
  },
  {
    id: 'stem:capacitor-arc',
    label: 'Capacitor Bank Harmonic Drone',
    stageUnlock: 1,
    wave: 'square',
    freqStart: 60,
    freqEnd: 180,
    cutoffHz: 960,
    resonanceQ: 3.5,
    volume: 0.6,
    durationMs: 1100,
  },
  {
    id: 'stem:wind-frost',
    label: 'Crater Rim Frost Wind',
    stageUnlock: 2,
    wave: 'noise',
    freqStart: 220,
    freqEnd: 440,
    cutoffHz: 680,
    resonanceQ: 1.8,
    volume: 0.55,
    durationMs: 1600,
  },
  {
    id: 'stem:meltwater-trickle',
    label: 'Meltwater Basin Trickle',
    stageUnlock: 3,
    wave: 'triangle',
    freqStart: 340,
    freqEnd: 680,
    cutoffHz: 2200,
    resonanceQ: 5.0,
    volume: 0.65,
    durationMs: 1200,
  },
  {
    id: 'stem:biosphere-chorus',
    label: 'S6 Living Canopy Harmonics',
    stageUnlock: 6,
    wave: 'sine',
    freqStart: 261.6,
    freqEnd: 523.2,
    cutoffHz: 3200,
    resonanceQ: 1.5,
    volume: 0.75,
    durationMs: 1800,
  },
];

function stemToSfxRecipe(stem: StudioAudioStem, rpmFactor: number): SfxRecipe {
  const f0 = Math.max(20, Math.min(8000, stem.freqStart * rpmFactor));
  const f1 = Math.max(20, Math.min(8000, stem.freqEnd * rpmFactor));
  return {
    id: stem.id,
    category: 'game',
    durationMs: stem.durationMs,
    layers: [
      {
        wave: stem.wave,
        freq: [f0, f1],
        gain: stem.volume,
        attackMs: 120,
        decayMs: Math.max(100, stem.durationMs - 120),
        filter: {
          type: 'lowpass',
          freq: [stem.cutoffHz, Math.max(80, stem.cutoffHz * 0.75)],
          q: stem.resonanceQ,
        },
      },
      {
        wave: 'sine',
        freq: [f0 * 0.5, f1 * 0.5],
        gain: stem.volume * 0.45,
        attackMs: 80,
        decayMs: Math.max(100, stem.durationMs - 80),
      },
    ],
  };
}

export const AudioTab: React.FC<AudioTabProps> = ({ state, store }) => {
  const [stems, setStems] = useState<StudioAudioStem[]>(INITIAL_STEMS);
  const [playingStemId, setPlayingStemId] = useState<string | null>(null);
  const [motorDroneActive, setMotorDroneActive] = useState<boolean>(false);

  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const motorOscRef = useRef<OscillatorNode | null>(null);
  const motorGainRef = useRef<GainNode | null>(null);
  const motorFilterRef = useRef<BiquadFilterNode | null>(null);

  const selectedStem =
    stems.find((s) => s.id === state.audioSelectedStemId) ?? stems[0]!;
  const rpmFactor = state.audioMotorRpm / 1200;

  // Synthesize deterministic @hm/soundlab buffer for the selected stem + current RPM + Stage Bit-Crush
  const synthesizedSamples = React.useMemo(() => {
    const recipe = stemToSfxRecipe(selectedStem, rpmFactor);
    const raw = renderRecipe(recipe, 22050, 42);
    if (!state.audioBitCrushEnabled && state.audioAuditionStage >= 2) {
      return raw;
    }
    // Apply Stage 0/1 or 12-Bit Crunch sample-rate & bit-depth mirror (DEC-07)
    const crushed = new Float32Array(raw.length);
    const levels = state.audioAuditionStage === 0 ? 8 : 24;
    const holdStep = state.audioAuditionStage === 0 ? 4 : 2;
    let held = 0;
    for (let i = 0; i < raw.length; i++) {
      if (i % holdStep === 0) {
        held = Math.round(raw[i]! * levels) / levels;
      }
      crushed[i] = held;
    }
    return crushed;
  }, [
    selectedStem,
    rpmFactor,
    state.audioBitCrushEnabled,
    state.audioAuditionStage,
  ]);

  // Draw live Waveform Oscilloscope & Frequency Spectrum on the 2 canvases
  useEffect(() => {
    const scopeCanvas = scopeCanvasRef.current;
    const specCanvas = spectrumCanvasRef.current;
    if (scopeCanvas) {
      const ctx = scopeCanvas.getContext('2d');
      if (ctx) {
        const w = scopeCanvas.width;
        const h = scopeCanvas.height;
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, w, h);

        // Center zero-line & grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Waveform trace
        ctx.strokeStyle = playingStemId ? '#10b981' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const step = Math.max(1, Math.floor(synthesizedSamples.length / w));
        for (let x = 0; x < w; x++) {
          const sample = synthesizedSamples[Math.min(synthesizedSamples.length - 1, x * step)] ?? 0;
          const y = h * 0.5 - sample * (h * 0.42);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    if (specCanvas) {
      const ctx = specCanvas.getContext('2d');
      if (ctx) {
        const w = specCanvas.width;
        const h = specCanvas.height;
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, w, h);

        // Compute 32-band energy spectrum from synthesized samples
        const bands = 32;
        const barW = Math.floor(w / bands) - 2;
        for (let b = 0; b < bands; b++) {
          const freqRatio = (b + 1) / bands;
          const cutoffRatio = Math.min(1, selectedStem.cutoffHz / 4000);
          let energy = 0;
          const stride = Math.max(1, b + 1);
          for (let i = 0; i < Math.min(2048, synthesizedSamples.length); i += stride) {
            energy += Math.abs(synthesizedSamples[i]!);
          }
          energy = (energy / (2048 / stride)) * (freqRatio <= cutoffRatio ? 1.25 : 0.35);
          const barH = Math.max(4, Math.min(h - 8, energy * h * 1.6));
          ctx.fillStyle = freqRatio <= cutoffRatio ? '#38bdf8' : '#64748b';
          ctx.fillRect(b * (barW + 2) + 2, h - barH, barW, barH);
        }
      }
    }
  }, [synthesizedSamples, selectedStem, playingStemId]);

  // Update continuous Motor RPM oscillator frequency & filter in real time when dragging RPM slider!
  useEffect(() => {
    const engineParams = engineParamsFor(
      DEFAULT_ENGINE_SPEC,
      state.audioMotorRpm,
      0.8,
      3600,
    );
    if (motorOscRef.current && audioCtxRef.current) {
      motorOscRef.current.frequency.setValueAtTime(
        engineParams.freq,
        audioCtxRef.current.currentTime,
      );
    }
    if (motorFilterRef.current && audioCtxRef.current) {
      motorFilterRef.current.frequency.setValueAtTime(
        engineParams.filterFreq,
        audioCtxRef.current.currentTime,
      );
    }
    if (motorGainRef.current && audioCtxRef.current) {
      motorGainRef.current.gain.setValueAtTime(
        engineParams.gain,
        audioCtxRef.current.currentTime,
      );
    }
  }, [state.audioMotorRpm]);

  const getOrInitAudioContext = (): AudioContext | null => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctx =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctx) return null;
    audioCtxRef.current = new Ctx();
    return audioCtxRef.current;
  };

  // Play / Stop synthesized stem via Web Audio API
  const handlePlayStem = (stem: StudioAudioStem) => {
    store.setAudioStem(stem.id);
    if (playingStemId === stem.id) {
      try {
        activeSourceRef.current?.stop();
      } catch {
        // Ignore if already stopped
      }
      activeSourceRef.current = null;
      setPlayingStemId(null);
      return;
    }

    const ctx = getOrInitAudioContext();
    if (!ctx) {
      setPlayingStemId(stem.id);
      setTimeout(() => setPlayingStemId(null), stem.durationMs);
      return;
    }

    try {
      activeSourceRef.current?.stop();
    } catch {
      // Ignore
    }

    const recipe = stemToSfxRecipe(stem, rpmFactor);
    const samples = renderRecipe(recipe, ctx.sampleRate, 42);
    const audioBuf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    audioBuf.getChannelData(0).set(samples);

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    const gainNode = ctx.createGain();
    gainNode.gain.value = stem.volume;
    src.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.onended = () => {
      setPlayingStemId((cur) => (cur === stem.id ? null : cur));
    };
    src.start();
    activeSourceRef.current = src;
    setPlayingStemId(stem.id);
  };

  // Toggle live continuous Motor RPM Oscillator Drone
  const toggleMotorDrone = () => {
    if (motorDroneActive) {
      try {
        motorOscRef.current?.stop();
      } catch {
        // Ignore
      }
      motorOscRef.current = null;
      setMotorDroneActive(false);
      return;
    }
    const ctx = getOrInitAudioContext();
    if (!ctx) {
      setMotorDroneActive(true);
      return;
    }
    const engineParams = engineParamsFor(DEFAULT_ENGINE_SPEC, state.audioMotorRpm, 0.8, 3600);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = engineParams.freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = engineParams.filterFreq;
    filter.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.value = engineParams.gain;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    motorOscRef.current = osc;
    motorFilterRef.current = filter;
    motorGainRef.current = gain;
    setMotorDroneActive(true);
  };

  const updateSelectedStem = (patch: Partial<StudioAudioStem>) => {
    setStems((prev) =>
      prev.map((s) => (s.id === selectedStem.id ? { ...s, ...patch } : s)),
    );
  };

  const handleAddStem = () => {
    const newId = `stem:custom-${stems.length + 1}`;
    const newStem: StudioAudioStem = {
      id: newId,
      label: `Custom Synth Stem #${stems.length + 1}`,
      stageUnlock: state.audioAuditionStage,
      wave: 'sawtooth',
      freqStart: 180,
      freqEnd: 360,
      cutoffHz: 1400,
      resonanceQ: 2.5,
      volume: 0.7,
      durationMs: 1200,
    };
    setStems((prev) => [...prev, newStem]);
    store.setAudioStem(newId);
  };

  const recipeCheck = validateRecipe(stemToSfxRecipe(selectedStem, rpmFactor));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 390px',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        background: '#090d16',
        color: '#e2e8f0',
      }}
    >
      {/* Left: Oscilloscope + Spectrum Analyzer + Interactive Stem Cards */}
      <div
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
              @hm/soundlab &amp; Web Audio API Synthesizer — Stage-Quantized Audio Ladder
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>
              Live Waveform Oscilloscope &amp; 32-Band FFT Spectrum ({synthesizedSamples.length} samples)
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleMotorDrone}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #fbbf24',
                background: motorDroneActive ? '#f59e0b' : 'rgba(245, 158, 11, 0.14)',
                color: motorDroneActive ? '#0f172a' : '#fde68a',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {motorDroneActive ? '⏹ Stop Live Motor Drone' : '🔁 Loop Live Motor Drone'}
            </button>
            <button
              onClick={handleAddStem}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#0284c7',
                color: '#fff',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              + Add Audio Stem
            </button>
          </div>
        </div>

        {/* Dual Live Canvases: Waveform Oscilloscope + FFT Spectrum */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: '#111827',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
              Time-Domain Waveform Oscilloscope — {selectedStem.label}
            </div>
            <canvas
              ref={scopeCanvasRef}
              data-testid="audio-oscilloscope-canvas"
              width={420}
              height={120}
              style={{ width: '100%', height: 120, borderRadius: 6, display: 'block' }}
            />
          </div>

          <div
            style={{
              background: '#111827',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
              Frequency Spectrum (Low-Pass Cutoff: {selectedStem.cutoffHz} Hz, Q: {selectedStem.resonanceQ.toFixed(1)})
            </div>
            <canvas
              ref={spectrumCanvasRef}
              data-testid="audio-spectrum-canvas"
              width={420}
              height={120}
              style={{ width: '100%', height: 120, borderRadius: 6, display: 'block' }}
            />
          </div>
        </div>

        {/* Global Stage Bit-Crush & Motor RPM Bar */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#111827',
            border: '1px solid #1e293b',
            display: 'flex',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, flex: 1 }}>
            <span>
              Audition Stage Bit-Depth Mirror: <strong>S{state.audioAuditionStage}</strong>{' '}
              ({state.audioAuditionStage === 0 ? '8 kHz 4-bit' : state.audioAuditionStage === 1 ? '11 kHz 8-bit' : '48 kHz Full Stereo'})
            </span>
            <input
              type="range"
              min={0}
              max={6}
              step={1}
              value={state.audioAuditionStage}
              onChange={(e) =>
                store.setAudioAuditionStage(
                  parseInt(e.target.value, 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
                )
              }
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, flex: 1 }}>
            <span>
              Machine Motor RPM: <strong style={{ color: '#38bdf8' }}>{state.audioMotorRpm} RPM</strong>
            </span>
            <input
              type="range"
              min={120}
              max={3600}
              step={20}
              value={state.audioMotorRpm}
              onChange={(e) => store.setAudioMotorRpm(parseInt(e.target.value, 10))}
            />
          </label>

          <button
            onClick={() => store.setAudioBitCrushEnabled(!state.audioBitCrushEnabled)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #38bdf8',
              background: state.audioBitCrushEnabled ? '#0284c7' : '#0f172a',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            12-Bit Crunch: {state.audioBitCrushEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Stem Cards with Working Play/Stop Audition Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {stems.map((stem) => {
            const active = selectedStem.id === stem.id;
            const isPlaying = playingStemId === stem.id;
            return (
              <div
                key={stem.id}
                onClick={() => store.setAudioStem(stem.id)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: active ? 'rgba(56, 189, 248, 0.14)' : '#111827',
                  border: active ? '1.5px solid #38bdf8' : '1px solid #1e293b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                    {stem.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    Wave: <strong>{stem.wave}</strong> | {stem.freqStart}→{stem.freqEnd} Hz | Cutoff:{' '}
                    {stem.cutoffHz} Hz | Stage S{stem.stageUnlock}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayStem(stem);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: isPlaying ? '#ef4444' : '#10b981',
                    color: isPlaying ? '#fff' : '#052e16',
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {isPlaying ? '⏹ Stop' : '▶ Play'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Selected Stem Synth Inspector (Volume, Pitch, Filter Cutoff, Resonance, Wave) */}
      <div
        style={{
          borderLeft: '1px solid #1e293b',
          background: '#0f172a',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
              @hm/soundlab Synth Stem Inspector
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
              {selectedStem.label}
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              color: recipeCheck.ok ? '#34d399' : '#f87171',
              fontWeight: 700,
            }}
          >
            {recipeCheck.ok ? '✓ Valid Recipe' : '⚠ Invalid'}
          </span>
        </div>

        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Oscillator Waveform
          <select
            value={selectedStem.wave}
            onChange={(e) => updateSelectedStem({ wave: e.target.value as Wave })}
            style={{
              padding: 7,
              borderRadius: 6,
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
              fontSize: 11,
            }}
          >
            <option value="sine">Sine (Pure Harmonic)</option>
            <option value="sawtooth">Sawtooth (Rich Motor/Brass)</option>
            <option value="square">Square (Hollow Retro Pulse)</option>
            <option value="triangle">Triangle (Warm Flute/Sub)</option>
            <option value="noise">Noise (Wind / Steam / Gravel)</option>
          </select>
        </label>

        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Volume / Gain</span>
            <span style={{ color: '#34d399' }}>{Math.round(selectedStem.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1.0}
            step={0.01}
            value={selectedStem.volume}
            onChange={(e) => updateSelectedStem({ volume: parseFloat(e.target.value) })}
          />
        </label>

        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Start Frequency (Hz)</span>
            <span style={{ color: '#38bdf8' }}>{selectedStem.freqStart} Hz</span>
          </div>
          <input
            type="range"
            min={30}
            max={1200}
            step={5}
            value={selectedStem.freqStart}
            onChange={(e) => updateSelectedStem({ freqStart: parseFloat(e.target.value) })}
          />
        </label>

        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>End Frequency Glide (Hz)</span>
            <span style={{ color: '#38bdf8' }}>{selectedStem.freqEnd} Hz</span>
          </div>
          <input
            type="range"
            min={30}
            max={1600}
            step={5}
            value={selectedStem.freqEnd}
            onChange={(e) => updateSelectedStem({ freqEnd: parseFloat(e.target.value) })}
          />
        </label>

        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Low-Pass Filter Cutoff (Hz)</span>
            <span style={{ color: '#fbbf24' }}>{selectedStem.cutoffHz} Hz</span>
          </div>
          <input
            type="range"
            min={120}
            max={4000}
            step={20}
            value={selectedStem.cutoffHz}
            onChange={(e) => updateSelectedStem({ cutoffHz: parseFloat(e.target.value) })}
          />
        </label>

        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Filter Resonance (Q)</span>
            <span style={{ color: '#fbbf24' }}>{selectedStem.resonanceQ.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={12.0}
            step={0.1}
            value={selectedStem.resonanceQ}
            onChange={(e) => updateSelectedStem({ resonanceQ: parseFloat(e.target.value) })}
          />
        </label>

        <button
          onClick={() => handlePlayStem(selectedStem)}
          style={{
            marginTop: 8,
            padding: '10px 14px',
            borderRadius: 6,
            border: 'none',
            background: playingStemId === selectedStem.id ? '#ef4444' : '#10b981',
            color: playingStemId === selectedStem.id ? '#fff' : '#052e16',
            fontWeight: 800,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {playingStemId === selectedStem.id
            ? '⏹ Stop Audition'
            : `▶ Audition "${selectedStem.label}"`}
        </button>
      </div>
    </div>
  );
};
