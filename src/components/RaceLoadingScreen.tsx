import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpFromLine, Keyboard, X, Zap } from 'lucide-react';
import { formatKey, loadBindings, type KeyBindings } from '../game/controls';
import Brand from './Brand';
import OrnateCorners from './OrnateCorners';

const loadingWide = '/art/loading-wide.webp';
const loadingTall = '/art/loading-tall.webp';

interface RaceLoadingScreenProps {
  /** Current bindings – if omitted, loads from storage */
  bindings?: KeyBindings;
  /** True when assets are ready and the grid can be entered */
  ready?: boolean;
  /** Progress 0-100 while decoding assets */
  progress?: number;
  /** Called when user chooses to enter the grid (click or key) */
  onEnter: () => void;
  /** Optional extra tip cycling */
  tips?: string[];
}

const DEFAULT_TIPS = [
  'Bumping rivals at high speeds deflects them off-course',
  'Air springs provide extra aerial hang time',
  'Touch the chevrons for a fresh boost charge',
  'Heavy capsules shove harder — light ones jump higher',
  'A rival that wobbles is about to shove: steer away or shield up',
];

export default function RaceLoadingScreen({ bindings, ready, progress = 0, onEnter, tips }: RaceLoadingScreenProps) {
  const resolved = useMemo(() => bindings ?? loadBindings(), [bindings]);
  const tipList = tips ?? DEFAULT_TIPS;
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (ready) return;
    const iv = window.setInterval(() => setTipIndex((i) => (i + 1) % tipList.length), 3200);
    return () => clearInterval(iv);
  }, [ready, tipList.length]);

  useEffect(() => {
    if (!ready) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (['Escape', 'Enter', 'Space'].includes(e.code) || ['Escape', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ready, onEnter]);

  // Helper to get display label – fallback to first entry if empty
  const label = (action: keyof KeyBindings, fallback: string) => {
    const codes = resolved[action as keyof KeyBindings];
    if (!codes || codes.length === 0) return fallback;
    return codes.map(formatKey).join(' / ');
  };

  const steerLabel = `${label('steerLeft', 'A')} / ${label('steerRight', 'D')}`;
  const bounceLabel = label('bounce', 'SPACE');
  const boostLabel = label('boost', 'SHIFT');

  return (
    <div
      className="race-loading-screen"
      role="dialog"
      aria-label="Race controls and protocols"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && ready) onEnter(); }}
    >
      <div className="race-loading-backdrop-art" aria-hidden="true">
        <picture className="race-loading-backdrop">
          <source media="(max-width: 640px)" srcSet={loadingTall} />
          <img src={loadingWide} alt="" draggable={false} />
        </picture>
        <div className="race-loading-vignette" />
        <div className="race-loading-grain" />
      </div>

      <div className="race-loading-content modal fantasy-dialog" onClick={(e) => e.stopPropagation()}>
        <OrnateCorners />

        <div className="race-loading-header">
          <div className="race-loading-header-bar">
            <Brand variant="emblem" decorative />
            <div className="race-loading-title-group">
              <span className="eyebrow orange-text">
                <img src="/art/flag-checkered.png" alt="" className="loading-flag-img" aria-hidden="true" />
                {ready ? 'GRID READY — ENGINES HOT' : 'ASSEMBLING A VERY BAD IDEA'}
              </span>
              <h2 className="race-loading-title">{ready ? 'RACE CONTROLS & PROTOCOLS' : 'LOADING THE TRACK'}</h2>
            </div>
            {ready && (
              <button
                className="icon-button modal-close race-loading-close"
                onClick={onEnter}
                aria-label="Close controls and take grid"
                title="Enter grid (Esc)"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <p className="race-loading-subtitle">
            {ready ? 'Review your flight controls below. Press Enter, Space, Esc, or the launch button to take your lane.' : 'Decoding capsules, scenery, and a worrying amount of dynamite…'}
          </p>
          {!ready && (
            <div className="race-loading-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <div className="race-loading-progress-track">
                <div className="race-loading-progress-fill" style={{ width: `${Math.max(8, progress)}%` }} />
              </div>
              <span className="race-loading-progress-label">{`${Math.round(progress)}% • PLEASE STAND BY`}</span>
            </div>
          )}
        </div>

        <div className="race-loading-keys" aria-label="Current controls">
          <div className="race-loading-keys-header">
            <Keyboard size={14} />
            <h3>YOUR CONTROLS</h3>
            <span>Live from your Settings</span>
          </div>

          <div className="race-loading-grid">
            <div className="race-loading-key-card">
              <span className="race-key-glyphs" aria-hidden="true">
                <span className="glyph-pill">{label('steerLeft', 'A')}</span>
                <span className="glyph-sep">/</span>
                <span className="glyph-pill">{label('steerRight', 'D')}</span>
              </span>
              <div className="race-key-info">
                <strong>
                  <span className="kbd-mini">{steerLabel}</span> → Switch Lanes / Shoulder Rivals
                </strong>
                <p>Tap to change lanes. Contact shoves rivals sideways. Heavier balls push harder.</p>
              </div>
              <ArrowLeft size={16} className="race-key-icon" aria-hidden="true" />
              <ArrowRight size={16} className="race-key-icon" aria-hidden="true" />
            </div>

            <div className="race-loading-key-card">
              <span className="race-key-glyphs" aria-hidden="true">
                <span className="glyph-pill accent-orange large">{bounceLabel}</span>
              </span>
              <div className="race-key-info">
                <strong>
                  <span className="kbd-mini">{bounceLabel}</span> → Air Bounce off Ground & Springs
                </strong>
                <p>Spend one of your midair bounces. Spring pads refill charges automatically.</p>
              </div>
              <ArrowUpFromLine size={18} className="race-key-icon" aria-hidden="true" />
            </div>

            <div className="race-loading-key-card race-key-card-span">
              <span className="race-key-glyphs" aria-hidden="true">
                <span className="glyph-pill accent-amber">{boostLabel}</span>
              </span>
              <div className="race-key-info">
                <strong>
                  <span className="kbd-mini">{boostLabel}</span> → Turbo Nitro Boost
                </strong>
                <p>Instant rocket speed forward. Boost pads refill fresh charges along the track.</p>
              </div>
              <Zap size={18} className="race-key-icon" aria-hidden="true" />
            </div>
          </div>

          <div className="race-loading-diagram" aria-hidden="true">
            <div className="diagram-keyboard">
              <div className="diagram-row">
                <span className={`diagram-key ${resolved.steerLeft.includes('KeyQ') || resolved.steerLeft.includes('KeyA') ? 'is-active' : ''}`}>A</span>
                <span className={`diagram-key ${resolved.steerRight.includes('KeyD') ? 'is-active' : ''}`}>D</span>
              </div>
              <div className="diagram-row">
                <span className="diagram-key wide is-active">{formatKey(resolved.bounce[0] ?? 'Space')}</span>
              </div>
              <div className="diagram-row">
                <span className="diagram-key wide is-active">{formatKey(resolved.boost[0] ?? 'ShiftLeft')}</span>
              </div>
            </div>
            <div className="diagram-caption">Keyboard layout — highlighted keys are your current bindings</div>
            <div className="diagram-caption">Also: <strong>V</strong> camera · <strong>[</strong> <strong>]</strong> slow motion · <strong>{formatKey(resolved.pause[0] ?? 'KeyP')}</strong> pause</div>
          </div>
        </div>

        <div className="race-loading-tips" aria-live="polite">
          <span className="tip-label">GOBLIN WISDOM</span>
          <p className="tip-text">“{tipList[tipIndex]}.”</p>
          <div className="tip-dots" aria-hidden="true">
            {tipList.map((_, i) => (
              <i key={i} className={i === tipIndex ? 'is-active' : ''} />
            ))}
          </div>
        </div>

        <div className="race-loading-footer">
          {ready ? (
            <button
              className="forged-menu-button forged-primary race-loading-enter"
              onClick={(e) => { e.stopPropagation(); onEnter(); }}
              autoFocus
            >
              <span>ENTER THE GRID & LAUNCH →</span>
            </button>
          ) : (
            <span className="race-loading-wait">
              <span className="loading-spinner" aria-hidden="true" />
              Tightening the loose bolts…
            </span>
          )}
          <span className="race-loading-hint">Tip: rebind keys in Settings → Controls at any time. Press Esc or Enter to start.</span>
        </div>
      </div>

      <style>{`
        .race-loading-screen {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px; overflow-y: auto;
          background: #050a06c8; backdrop-filter: blur(8px);
        }
        .race-loading-backdrop-art {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.35;
        }
        .race-loading-backdrop { position: absolute; inset: 0; }
        .race-loading-backdrop img { width: 100%; height: 100%; object-fit: cover; filter: saturate(0.85) brightness(0.5); }
        .race-loading-vignette {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 90% 70% at 50% 38%, transparent 35%, #050908f0 85%);
        }
        .race-loading-grain {
          position: absolute; inset: 0; opacity: .12; pointer-events: none;
          background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
        }
        .race-loading-content {
          position: relative; z-index: 2;
          width: min(860px, 95vw); max-height: calc(100dvh - 40px);
          overflow-y: auto; overflow-x: hidden; scrollbar-width: thin;
          padding: 24px 28px 20px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .race-loading-header { text-align: left; padding: 2px 2px 0; }
        .race-loading-header-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
        }
        .race-loading-header-bar > .brand-emblem { width: 44px; height: 44px; flex-shrink: 0; }
        .race-loading-title-group { flex: 1; text-align: left; }
        .race-loading-header-bar .modal-close {
          width: 36px; height: 36px; flex-shrink: 0;
          background: #101b14; color: #c3af7b;
          border: 1px solid #88744088; border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .race-loading-header-bar .modal-close:hover {
          color: #fff0cb; border-color: #d6b771;
        }
        .race-loading-eyebrow {
          display: inline-flex; align-items: center; gap: 7px; color: #f0a15b; font: 7px var(--mono); letter-spacing: 1.4px;
        }
        .race-loading-eyebrow svg { color: #f0a15b; }
        .race-loading-title {
          margin-top: 4px;
          font: 800 24px/1.2 var(--display, 'Cinzel', serif); letter-spacing: .5px; color: #ececdb; text-transform: uppercase;
          text-shadow: 0 2px 8px #000000aa;
        }
        .race-loading-subtitle { margin-top: 6px; font-size: 11px; line-height: 1.5; color: #aab8a0; }
        .race-loading-progress { margin-top: 10px; display: flex; flex-direction: column; gap: 7px; align-items: center; }
        .race-loading-progress-track {
          width: min(420px, 100%); height: 7px; border-radius: 9999px; overflow: hidden;
          background: #1a2520; border: 1px solid #3a4a3a; padding: 2px;
        }
        .race-loading-progress-fill {
          height: 100%; border-radius: 9999px;
          background: linear-gradient(90deg, #f0a15b, #e07a2a);
          box-shadow: 0 0 8px #f0a15b66;
          transition: width 400ms ease;
        }
        .race-loading-progress-label { font: 6px var(--mono); letter-spacing: 1.1px; color: #8ea094; }

        .race-loading-keys {
          background: #0f1814cc; border: 1px solid #2e3827; border-radius: 8px; padding: 12px 14px;
        }
        .race-loading-keys-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
          font: 7px var(--mono); letter-spacing: 1.1px; color: #f0a15b;
        }
        .race-loading-keys-header h3 { font: 700 12px var(--display); letter-spacing: .8px; color: #ececdb; margin-right: auto; }
        .race-loading-keys-header span { color: #7f8d7a; font: 7px var(--mono); }
        .race-loading-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .race-loading-key-card.race-key-card-span { grid-column: 1 / -1; }
        .race-loading-key-card {
          position: relative;
          display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center;
          padding: 10px 12px; border-radius: 6px;
          background: linear-gradient(180deg, #1a2420 0%, #121a17 100%);
          border: 1px solid #3b4a3a;
          box-shadow: inset 0 1px 0 #ffffff0a, 0 2px 8px #0000002e;
        }
        .race-key-glyphs { display: inline-flex; flex-direction: column; gap: 4px; align-items: center; min-width: 68px; }
        .glyph-pill {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 42px; height: 28px; padding: 0 8px; border-radius: 6px;
          background: linear-gradient(180deg, #2b3530, #1e2823); border: 1px solid #4a5a48; border-bottom-width: 3px;
          font: 700 11px var(--mono); color: #ececdb; letter-spacing: .5px;
          box-shadow: inset 0 1px 0 #ffffff10, 0 2px 4px #0000003a;
        }
        .glyph-pill.accent-green { border-color: #5a8a6a; color: #c8f0d4; }
        .glyph-pill.accent-orange { border-color: #b56a2e; color: #ffd9b3; }
        .glyph-pill.accent-amber { border-color: #8a6a2a; color: #ffe8a3; }
        .glyph-pill.large { min-width: 68px; }
        .glyph-sep { font: 700 10px var(--mono); color: #7f8d7a; }
        .glyph-alt { font: 6px var(--mono); color: #8b9a7d; letter-spacing: .3px; text-align: center; }
        .race-key-info strong { display: block; font: 600 11px/1.2 var(--display); letter-spacing: .35px; color: #ececdb; text-transform: uppercase; }
        .race-key-info p { margin-top: 3px; font-size: 9px; line-height: 1.4; color: #9aa68d; }
        .kbd-mini { display: inline-block; background: #1e2823; border: 1px solid #3a4a3a; border-bottom-width: 2px; border-radius: 4px; padding: 1px 5px; font: 700 8px var(--mono); color: #e8e8d8; }
        .race-key-icon { color: #f0a15b; opacity: .9; flex-shrink: 0; }

        .race-loading-diagram {
          margin-top: 10px; padding: 8px 10px; border-radius: 6px;
          background: #0a120f; border: 1px dashed #2e3827;
          display: flex; flex-direction: column; gap: 6px; align-items: center;
        }
        .diagram-keyboard { display: flex; flex-direction: column; gap: 5px; align-items: center; }
        .diagram-row { display: flex; gap: 5px; }
        .diagram-key {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 34px; height: 28px; padding: 0 8px; border-radius: 4px;
          background: #1c2520; border: 1px solid #2e3b2e; border-bottom-width: 3px;
          font: 700 10px var(--mono); color: #7f8d7a;
        }
        .diagram-key.is-active { background: #f0a15b; color: #1a1208; border-color: #ffcc8a; box-shadow: 0 2px 8px #f0a15b44; }
        .diagram-key.wide { min-width: 108px; }
        .diagram-caption { font: 6px var(--mono); letter-spacing: .6px; color: #7f8d7a; text-align: center; }

        .race-loading-tips {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          padding: 8px 12px; border-radius: 6px; background: #121a17; border: 1px solid #2e3827;
          text-align: center;
        }
        .tip-label { font: 600 6px var(--mono); letter-spacing: 1.2px; color: #f0a15b; }
        .tip-text { font: italic 600 11px var(--display); letter-spacing: .3px; color: #d9e2c9; line-height: 1.4; max-width: 620px; }
        .tip-dots { display: flex; gap: 5px; margin-top: 2px; }
        .tip-dots i { width: 5px; height: 5px; border-radius: 50%; background: #2e3827; transition: all 200ms; }
        .tip-dots i.is-active { background: #f0a15b; box-shadow: 0 0 6px #f0a15b66; }

        .race-loading-footer { display: flex; flex-direction: column; gap: 8px; align-items: center; padding: 4px 0 0; }
        .race-loading-enter {
          display: inline-flex; align-items: center; justify-content: center;
          width: 100%; min-height: 48px; padding: 10px 24px;
          font: 700 14px var(--fantasy, 'Cinzel', serif); letter-spacing: 1.1px;
          cursor: pointer; text-transform: uppercase;
        }
        .race-loading-wait {
          display: inline-flex; align-items: center; gap: 10px;
          font: 600 11px var(--display); letter-spacing: .5px; color: #aab8a0; text-transform: uppercase;
        }
        .loading-spinner {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid #2e3827; border-top-color: #f0a15b; border-right-color: #f0a15b66;
          animation: spin 0.9s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .race-loading-hint { font: 7px var(--mono); letter-spacing: .6px; color: #7f8d7a; }

        @media (max-width: 740px) {
          .race-loading-content { padding: 16px 14px 12px; gap: 10px; max-height: 94vh; }
          .race-loading-title { font-size: 20px; }
          .race-loading-subtitle { font-size: 10px; }
          .race-loading-grid { grid-template-columns: 1fr; gap: 6px; }
          .race-loading-key-card { padding: 8px; gap: 6px; }
          .race-key-info strong { font-size: 10px; }
          .race-key-info p { font-size: 8px; }
          .diagram-key { min-width: 30px; height: 24px; font-size: 9px; }
          .diagram-key.wide { min-width: 90px; }
          .tip-text { font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
