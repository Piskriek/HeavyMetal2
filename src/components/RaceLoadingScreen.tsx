import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpFromLine, Flag, Keyboard, MoveUp, Zap } from 'lucide-react';
import { formatKey, loadBindings, type KeyBindings } from '../game/controls';
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
      e.preventDefault();
      onEnter();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ready, onEnter]);

  // Helper to get display label – fallback to first entry if empty
  const label = (action: keyof KeyBindings, fallback: string) => {
    const codes = resolved[action as keyof KeyBindings];
    if (!codes || codes.length === 0) return fallback;
    // Join all bound keys for that action, e.g. "A / ←"
    return codes.map(formatKey).join(' / ');
  };

  const steerLabel = `${label('steerLeft', 'A')} / ${label('steerRight', 'D')}`;
  const hopLabel = label('hop', 'W');
  const bounceLabel = label('bounce', 'SPACE');
  const boostLabel = label('boost', 'SHIFT');

  return (
    <div
      className="race-loading-screen"
      role="dialog"
      aria-label="Loading race and controls"
      aria-modal="true"
      onClick={() => ready && onEnter()}
    >
      <picture className="race-loading-backdrop" aria-hidden="true">
        <source media="(max-width: 640px)" srcSet={loadingTall} />
        <img src={loadingWide} alt="" draggable={false} />
      </picture>
      <div className="race-loading-vignette" aria-hidden="true" />
      <div className="race-loading-grain" aria-hidden="true" />

      <div className="race-loading-content">
        <div className="race-loading-header">
          <span className="eyebrow race-loading-eyebrow">
            <Flag size={12} />
            {ready ? 'GRID READY — ENGINES HOT' : 'ASSEMBLING A VERY BAD IDEA'}
          </span>
          <h2 className="race-loading-title">{ready ? 'ENTER THE GRID' : 'LOADING THE TRACK'}</h2>
          <p className="race-loading-subtitle">
            {ready ? 'Your bindings are locked in. Press any key or click to take your lane.' : 'Decoding capsules, scenery, and a worrying amount of dynamite…'}
          </p>
          <div className="race-loading-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ready ? 100 : Math.round(progress)}>
            <div className="race-loading-progress-track">
              <div className="race-loading-progress-fill" style={{ width: `${ready ? 100 : Math.max(8, progress)}%` }} />
            </div>
            <span className="race-loading-progress-label">{ready ? 'READY' : `${Math.round(progress)}% • PLEASE STAND BY`}</span>
          </div>
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
                <p>Tap to change lanes. Contact at speed shoves rivals sideways. Heavy balls push harder.</p>
              </div>
              <ArrowLeft size={16} className="race-key-icon" aria-hidden="true" />
              <ArrowRight size={16} className="race-key-icon" aria-hidden="true" />
            </div>

            <div className="race-loading-key-card">
              <span className="race-key-glyphs" aria-hidden="true">
                <span className="glyph-pill accent-green">{hopLabel.split(' / ')[0] || hopLabel}</span>
                {label('hop', 'W').includes(' / ') && <small className="glyph-alt">also {hopLabel.split(' / ').slice(1).join(' / ')}</small>}
              </span>
              <div className="race-key-info">
                <strong>
                  <span className="kbd-mini">{hopLabel}</span> → Bunny Hop Ground Obstacles
                </strong>
                <p>Quick hop from the ground. Gaps affect specific lanes — steer or jump.</p>
              </div>
              <MoveUp size={18} className="race-key-icon" aria-hidden="true" />
            </div>

            <div className="race-loading-key-card">
              <span className="race-key-glyphs" aria-hidden="true">
                <span className="glyph-pill accent-orange large">{bounceLabel}</span>
              </span>
              <div className="race-key-info">
                <strong>
                  <span className="kbd-mini">{bounceLabel}</span> → Air Bounce off Springs
                </strong>
                <p>Spend one of three midair bounces. Spring pads refill a charge.</p>
              </div>
              <ArrowUpFromLine size={18} className="race-key-icon" aria-hidden="true" />
            </div>

            <div className="race-loading-key-card">
              <span className="race-key-glyphs" aria-hidden="true">
                <span className="glyph-pill accent-amber">{boostLabel}</span>
              </span>
              <div className="race-key-info">
                <strong>
                  <span className="kbd-mini">{boostLabel}</span> → Turbo Nitro Boost
                </strong>
                <p>Instant speed + fresh charge. CPU goblins use the same physics.</p>
              </div>
              <Zap size={18} className="race-key-icon" aria-hidden="true" />
            </div>
          </div>

          <div className="race-loading-diagram" aria-hidden="true">
            <div className="diagram-keyboard">
              <div className="diagram-row">
                <span className={`diagram-key ${resolved.steerLeft.includes('KeyQ') || resolved.steerLeft.includes('KeyA') ? 'is-active' : ''}`}>A</span>
                <span className={`diagram-key ${resolved.hop.includes('KeyW') ? 'is-active' : ''}`}>W</span>
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
            <button className="race-loading-enter" onClick={(e) => { e.stopPropagation(); onEnter(); }} autoFocus>
              PRESS ANY KEY / CLICK TO ENTER GRID →
            </button>
          ) : (
            <span className="race-loading-wait">
              <span className="loading-spinner" aria-hidden="true" />
              Tightening the loose bolts…
            </span>
          )}
          <span className="race-loading-hint">Tip: rebind keys in Settings → Controls at any time.</span>
        </div>
      </div>

      <style>{`
        .race-loading-screen {
          position: absolute; inset: 0; z-index: 4;
          display: flex; align-items: center; justify-content: center;
          padding: 18px; overflow: hidden;
          cursor: ${ready ? 'pointer' : 'default'};
        }
        .race-loading-backdrop { position: absolute; inset: 0; }
        .race-loading-backdrop img { width: 100%; height: 100%; object-fit: cover; filter: saturate(0.95) brightness(0.78) contrast(1.06); }
        .race-loading-vignette {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 90% 70% at 50% 38%, transparent 45%, #0a0f0e 88%),
            linear-gradient(180deg, #0a0f0e66 0%, #0a0f0e 100%);
        }
        .race-loading-grain {
          position: absolute; inset: 0; opacity: .18; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E");
        }
        .race-loading-content {
          position: relative; z-index: 1;
          width: min(860px, 100%); max-height: min(92vh, 820px);
          overflow: auto; scrollbar-width: thin;
          background: linear-gradient(180deg, #141e1acc 0%, #0f1814f2 100%);
          border: 1px solid #6b5426; border-radius: 12px;
          box-shadow: 0 20px 60px #00000088, inset 0 1px 0 #ffffff14;
          backdrop-filter: blur(6px);
          padding: 22px 22px 16px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .race-loading-header { text-align: center; padding: 6px 6px 0; }
        .race-loading-eyebrow {
          justify-content: center; gap: 7px; color: #f0a15b; font: 7px var(--mono); letter-spacing: 1.4px;
        }
        .race-loading-eyebrow svg { color: #f0a15b; }
        .race-loading-title {
          margin-top: 8px;
          font: 800 34px/1 var(--display); letter-spacing: .8px; color: #ececdb; text-transform: uppercase;
          text-shadow: 0 2px 12px #00000088;
        }
        .race-loading-subtitle { margin-top: 8px; font-size: 11px; line-height: 1.6; color: #aab8a0; max-width: 560px; margin-left: auto; margin-right: auto; }
        .race-loading-progress { margin-top: 14px; display: flex; flex-direction: column; gap: 7px; align-items: center; }
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
          background: #0f1814cc; border: 1px solid #2e3827; border-radius: 10px; padding: 14px;
        }
        .race-loading-keys-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
          font: 7px var(--mono); letter-spacing: 1.1px; color: #f0a15b;
        }
        .race-loading-keys-header h3 { font: 700 12px var(--display); letter-spacing: .8px; color: #ececdb; margin-right: auto; }
        .race-loading-keys-header span { color: #7f8d7a; font: 7px var(--mono); }
        .race-loading-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .race-loading-key-card {
          position: relative;
          display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center;
          padding: 11px 12px; border-radius: 8px;
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
        .race-key-info p { margin-top: 4px; font-size: 9px; line-height: 1.5; color: #9aa68d; }
        .kbd-mini { display: inline-block; background: #1e2823; border: 1px solid #3a4a3a; border-bottom-width: 2px; border-radius: 4px; padding: 1px 5px; font: 700 8px var(--mono); color: #e8e8d8; }
        .race-key-icon { color: #f0a15b; opacity: .9; flex-shrink: 0; }

        .race-loading-diagram {
          margin-top: 12px; padding: 10px; border-radius: 8px;
          background: #0a120f; border: 1px dashed #2e3827;
          display: flex; flex-direction: column; gap: 8px; align-items: center;
        }
        .diagram-keyboard { display: flex; flex-direction: column; gap: 6px; align-items: center; }
        .diagram-row { display: flex; gap: 6px; }
        .diagram-key {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 36px; height: 30px; padding: 0 8px; border-radius: 5px;
          background: #1c2520; border: 1px solid #2e3b2e; border-bottom-width: 3px;
          font: 700 10px var(--mono); color: #7f8d7a;
        }
        .diagram-key.is-active { background: #f0a15b; color: #1a1208; border-color: #ffcc8a; box-shadow: 0 2px 8px #f0a15b44; }
        .diagram-key.wide { min-width: 108px; }
        .diagram-caption { font: 6px var(--mono); letter-spacing: .6px; color: #7f8d7a; text-align: center; }

        .race-loading-tips {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 10px 14px; border-radius: 8px; background: #121a17; border: 1px solid #2e3827;
          text-align: center;
        }
        .tip-label { font: 600 6px var(--mono); letter-spacing: 1.2px; color: #f0a15b; }
        .tip-text { font: italic 600 11px var(--display); letter-spacing: .3px; color: #d9e2c9; line-height: 1.5; max-width: 620px; }
        .tip-dots { display: flex; gap: 5px; margin-top: 2px; }
        .tip-dots i { width: 5px; height: 5px; border-radius: 50%; background: #2e3827; transition: all 200ms; }
        .tip-dots i.is-active { background: #f0a15b; box-shadow: 0 0 6px #f0a15b66; }

        .race-loading-footer { display: flex; flex-direction: column; gap: 8px; align-items: center; padding: 4px 0 2px; }
        .race-loading-enter {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; min-height: 44px; padding: 0 18px; border-radius: 8px;
          background: linear-gradient(180deg, #f0a15b 0%, #d47a2e 100%);
          border: 1px solid #ffcc8a; color: #1a1208;
          font: 800 12px var(--display); letter-spacing: .7px; text-transform: uppercase;
          box-shadow: 0 6px 18px #0000003a, inset 0 1px 0 #ffffff66;
          animation: pulse-enter 1.6s ease-in-out infinite;
        }
        .race-loading-enter:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .race-loading-enter:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        @keyframes pulse-enter { 0%,100% { box-shadow: 0 6px 18px #0000003a, 0 0 0 0 #f0a15b00; } 50% { box-shadow: 0 6px 18px #0000003a, 0 0 0 8px #f0a15b18; } }
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
        .race-loading-hint { font: 6px var(--mono); letter-spacing: .6px; color: #7f8d7a; }

        @media (max-width: 740px) {
          .race-loading-content { padding: 16px 14px 12px; gap: 12px; max-height: 94vh; }
          .race-loading-title { font-size: 26px; }
          .race-loading-subtitle { font-size: 10px; }
          .race-loading-grid { grid-template-columns: 1fr; gap: 8px; }
          .race-loading-key-card { padding: 10px; gap: 8px; }
          .race-key-info strong { font-size: 10px; }
          .race-key-info p { font-size: 8px; }
          .diagram-key { min-width: 32px; height: 26px; font-size: 9px; }
          .diagram-key.wide { min-width: 96px; }
          .tip-text { font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
