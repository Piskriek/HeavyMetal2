// The preset bench's Sounds page (plan 43, step 4): the shelf of stems — a machine's hum, the rifle's verbs, the gate's dial
// and lock, the music bed — written onto a blank as a recursive synth patch, played at the Fidelity Stage's own hardware. The
// preview is the real render (`renderStem`), so Stage 0 buzzes in one bit and Stage 6 places the stem in stereo. The cartridge
// goes in the beam rifle; Apply gives its hum to the machine it is fired at.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SoundPrintSpec, SoundRole } from '@hm/cartlab';
import { renderStem, STEM_SHELF, waveformBins, type StemPreset } from '@hm/soundlab';
import { gameAudio } from '../audio/game-audio';
import { soundCode, soundPrintFromStem, soundVoices, stemAtStage, stemFromSoundPrint } from './sprite-sound-cartridge';
import type { MyPreset } from './my-presets';
import './bench-parts.css';

export interface BenchSoundsProps {
  /** Whether printing this sound can start now, and why not (the bench, the blank, the power). */
  readonly check: (spec: SoundPrintSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (spec: SoundPrintSpec) => void;
  readonly printLabel?: string;
  /** The number of the first step on this page (the lab bench's step 1 is picking the blank). */
  readonly firstStep?: number;
  /** The player's saved sounds ("Yours"). */
  readonly mine?: readonly MyPreset[];
  readonly onSave?: (spec: SoundPrintSpec) => void;
}

/** What each role is called on the shelf, in the order the page lists them. */
const ROLE_SECTIONS: readonly { readonly role: SoundRole; readonly label: string }[] = [
  { role: 'machine', label: 'Machine hums' },
  { role: 'rifle', label: 'Beam rifle verbs' },
  { role: 'gate', label: 'The Gate' },
  { role: 'music', label: 'Music stems' },
];

const STAGES: readonly { readonly stage: number; readonly label: string }[] = [
  { stage: 0, label: 'S0 speaker' }, { stage: 1, label: 'S1 FM' }, { stage: 2, label: 'S2 FM+noise' },
  { stage: 3, label: 'S3 sampled' }, { stage: 4, label: 'S4 spatial' }, { stage: 5, label: 'S5' }, { stage: 6, label: 'S6' },
];

const shelfOf = (role: SoundRole): readonly StemPreset[] => Object.values(STEM_SHELF).filter((s) => s.role === role);

/** The stem's cycle drawn as a waveform: what the stage's hardware actually produces. */
const WaveView: React.FC<{ readonly spec: SoundPrintSpec }> = ({ spec }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const bins = useMemo(() => {
    const { stem } = stemAtStage(spec, spec.stage);
    const rendered = renderStem(stem, spec.stage, 7);
    return waveformBins(rendered.channels[0]!, 96);
  }, [spec]);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#6de0c8';
    ctx.beginPath();
    const mid = canvas.height / 2;
    bins.forEach((b, i) => {
      const x = (i / Math.max(1, bins.length - 1)) * canvas.width;
      ctx.moveTo(x, mid - b.max * mid * 0.95);
      ctx.lineTo(x, mid - b.min * mid * 0.95);
    });
    ctx.stroke();
  }, [bins]);
  return <canvas ref={ref} width={240} height={56} className="bench-sound-wave" data-testid="bench-sound-wave" style={{ borderRadius: 4 }} />;
};

export const BenchSounds: React.FC<BenchSoundsProps> = ({ check, onPrint, printLabel = 'Start printing', firstStep = 2, mine = [], onSave }) => {
  const [spec, setSpec] = useState<SoundPrintSpec>(() => soundPrintFromStem(STEM_SHELF['gate-chevron-lock'] ?? Object.values(STEM_SHELF)[0]!, 4));
  const [playing, setPlaying] = useState(false);
  const stop = (): void => {
    gameAudio.stopPrintSamples('bench-sound');
    setPlaying(false);
  };
  // a page change or an unmount takes the preview with it
  useEffect(() => stop, []);
  const can = check(spec);
  const heard = useMemo(() => stemAtStage(spec, spec.stage), [spec]);
  const play = (): void => {
    if (playing) {
      stop();
      return;
    }
    const rendered = renderStem(stemFromSoundPrint(spec), spec.stage, 7);
    const seconds = gameAudio.playPrintSamples(rendered.channels, rendered.sampleRateHz, { key: 'bench-sound', gain: 0.5 });
    setPlaying(seconds > 0);
  };
  const mineSpecs = mine.flatMap((p) => ('sound' in p.print ? [{ id: p.id, name: p.name, spec: p.print.sound }] : []));
  return (
    <div className="bench-parts bench-sounds" data-testid="bench-sounds">
      <p className="bench-parts-pos" data-step={firstStep}>Choose a stem</p>
      {ROLE_SECTIONS.map((section) => {
        const stems = shelfOf(section.role);
        if (stems.length === 0) return null;
        return (
          <div key={section.role} className="bench-sounds-section">
            <p className="bench-parts-shelf">{section.label}</p>
            <div className="bench-parts-gens">
              {stems.map((stem) => (
                <button key={stem.id} className={spec.name === stem.name ? 'on' : ''} aria-pressed={spec.name === stem.name}
                  data-testid={`bench-sound-stem-${stem.id}`} onClick={() => { stop(); setSpec(soundPrintFromStem(stem, spec.stage)); }}>
                  {stem.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {mineSpecs.length > 0 ? (
        <>
          <p className="bench-parts-yours">Yours</p>
          <div className="bench-parts-gens">
            {mineSpecs.map((m) => (
              <button key={m.id} className="bench-parts-mine" data-testid={`bench-sound-mine-${m.id}`}
                onClick={() => { stop(); setSpec(m.spec); }}>{m.name}</button>
            ))}
          </div>
        </>
      ) : null}

      <div className="bench-parts-row">
        <WaveView spec={spec} />
        <div className="bench-parts-col">
          <div className="bench-parts-ops" role="radiogroup" aria-label="Stage">
            {STAGES.map((s) => (
              <button key={s.stage} role="radio" aria-checked={spec.stage === s.stage} className={spec.stage === s.stage ? 'on' : ''}
                data-testid={`bench-sound-stage-${s.stage}`} onClick={() => { stop(); setSpec({ ...spec, stage: s.stage }); }}>{s.label}</button>
            ))}
          </div>
          <div className="play-machine-actions">
            <button onClick={play} data-testid="bench-sound-play">{playing ? 'Stop' : 'Play'}</button>
          </div>
        </div>
      </div>

      <p className="bench-parts-cost">
        <b>{spec.name}</b><span className="bench-parts-cost-sep">. </span>
        {soundVoices(spec)} {soundVoices(spec) === 1 ? 'voice' : 'voices'} in the patch, heard as {heard.stem.patch.children?.length ?? heard.stem.patch.atoms?.length ?? 0} at this stage,
        one cycle of {Math.round(heard.lengthMs)} ms. Takes a blank and the bench's time: a patch is data, not matter.
      </p>
      <p className="bench-parts-code" data-testid="bench-sound-code"><code>{soundCode(spec).slice(0, 28)}…</code></p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(spec)} data-testid="bench-print-sound">{printLabel}</button>
        {onSave ? <button onClick={() => onSave(spec)} data-testid="bench-save-sound">Save as preset</button> : null}
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </div>
  );
};
