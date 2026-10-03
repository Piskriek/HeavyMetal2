import type { ReactElement } from 'react';

/**
 * One stylesheet for every full-screen UI. Colours come from CSS variables with fallbacks, so a theme can override them.
 * Render <ScreenStyles /> once near the root; animations are skipped when `reducedMotion` is set or the user prefers less motion.
 */
export const SCREEN_CSS = `
.hms { --a: var(--hm-accent, #ffd24a); --t: var(--hm-text, #dde6ee); --d: var(--hm-dim, #8fa0b1); --p: var(--hm-panel, #151a21); --l: var(--hm-line, #26303b); --ok: var(--hm-ok, #5fd38d); --bad: var(--hm-danger, #ff6b5e);
  zoom: var(--hms-scale, 1); position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 20px 16px; box-sizing: border-box; overflow: auto; color: var(--t); font-family: inherit; text-align: center; }
.hms * { box-sizing: border-box; }
.hms-bg { background: radial-gradient(120% 90% at 50% 0%, #1d3a46 0%, #0f1a22 55%, #090e13 100%); }
.hms-dim { background: rgba(7, 12, 17, 0.72); backdrop-filter: blur(5px); }
.hms h1, .hms h2, .hms h3, .hms p { margin: 0; }
.hms-logo { font-size: clamp(34px, 9vw, 76px); font-weight: 900; letter-spacing: 0.04em; line-height: 0.95; background: linear-gradient(180deg, #fff3b8 0%, var(--a) 55%, #d98a1f 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 0 rgba(0,0,0,0.35)); }
.hms-sub { color: var(--d); font-size: 13px; }
.hms-btn { appearance: none; min-height: 52px; min-width: 220px; padding: 10px 26px; font: inherit; font-size: 18px; font-weight: 700; color: var(--t); background: linear-gradient(180deg, #243845, #172531); border: 1px solid #36505f; border-radius: 14px; cursor: pointer; box-shadow: 0 5px 0 #0b141b, 0 10px 22px rgba(0,0,0,0.35); transition: transform .08s, background .15s, box-shadow .08s; }
.hms-btn:hover { background: linear-gradient(180deg, #2c4656, #1c2f3d); }
.hms-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #0b141b, 0 4px 10px rgba(0,0,0,0.35); }
.hms-btn:focus-visible, .hms-card:focus-visible, .hms-seg button:focus-visible, .hms input:focus-visible { outline: 3px solid var(--a); outline-offset: 2px; }
.hms-btn.go { color: #1b1300; background: linear-gradient(180deg, #ffe27a, var(--a) 60%, #e6a417); border-color: #ffefb0; box-shadow: 0 5px 0 #8a5d00, 0 10px 22px rgba(255,190,40,0.25); }
.hms-btn.go:hover { filter: brightness(1.06); }
.hms-btn[disabled] { opacity: 0.45; cursor: not-allowed; box-shadow: none; transform: none; }
.hms-btn.quiet { min-width: 0; min-height: 44px; font-size: 15px; background: transparent; box-shadow: none; border-color: var(--l); }
.hms-col { display: flex; flex-direction: column; gap: 14px; align-items: center; }
.hms-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; }
.hms-panel { background: rgba(21, 26, 33, 0.92); border: 1px solid var(--l); border-radius: 16px; padding: 16px 18px; width: min(560px, 100%); text-align: left; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.hms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; width: min(900px, 100%); }
.hms-card { appearance: none; text-align: left; font: inherit; color: var(--t); background: var(--p); border: 2px solid var(--l); border-radius: 14px; padding: 10px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; min-height: 44px; transition: transform .12s, border-color .12s, background .12s; }
.hms-card:hover { background: #1b222b; }
.hms-card[aria-pressed="true"] { border-color: var(--a); background: #232a22; transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.4); }
.hms-name { font-weight: 800; font-size: 14px; line-height: 1.15; }
.hms-bar { display: grid; grid-template-columns: 52px 1fr 18px; gap: 6px; align-items: center; font-size: 11px; color: var(--d); }
.hms-bar i { display: block; height: 7px; border-radius: 4px; background: #0b1117; position: relative; overflow: hidden; }
.hms-bar i b { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #7fe3a0, var(--a)); border-radius: 4px; }
.hms-bar span { text-align: right; color: var(--t); font-variant-numeric: tabular-nums; }
.hms-hint { color: var(--d); font-size: 13px; line-height: 1.4; }
.hms-seg { display: inline-flex; border: 1px solid var(--l); border-radius: 12px; overflow: hidden; }
.hms-seg button { appearance: none; min-height: 44px; padding: 8px 14px; font: inherit; font-size: 14px; color: var(--t); background: transparent; border: 0; border-right: 1px solid var(--l); cursor: pointer; }
.hms-seg button:last-child { border-right: 0; }
.hms-seg button[aria-pressed="true"] { background: var(--a); color: #1b1300; font-weight: 800; }
.hms-field { display: grid; grid-template-columns: 1fr minmax(120px, 2fr) 46px; gap: 10px; align-items: center; min-height: 44px; font-size: 15px; }
.hms-field input[type=range] { width: 100%; accent-color: var(--a); min-height: 30px; }
.hms-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; font-size: 15px; }
.hms-toggle input { width: 24px; height: 24px; accent-color: var(--a); }
.hms-progress { width: min(420px, 90%); height: 14px; border-radius: 8px; background: #0b1117; border: 1px solid var(--l); overflow: hidden; }
.hms-progress b { display: block; height: 100%; background: linear-gradient(90deg, #7fe3a0, var(--a)); border-radius: 8px; transition: width .15s; }
.hms-count { font-size: clamp(90px, 28vw, 220px); font-weight: 900; line-height: 1; color: #fff; text-shadow: 0 6px 0 rgba(0,0,0,0.4), 0 0 40px rgba(255,210,74,0.5); }
.hms-count.go { color: var(--a); }
.hms-pod { display: flex; align-items: flex-end; justify-content: center; gap: 8px; width: min(520px, 100%); }
.hms-pod > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.hms-pod .blk { width: 100%; border-radius: 10px 10px 0 0; background: linear-gradient(180deg, #34505f, #1a2a35); display: grid; place-items: center; font-size: 30px; font-weight: 900; color: var(--a); }
.hms-pod [data-podium="1"] .blk { height: 110px; background: linear-gradient(180deg, #ffd24a, #b7790c); color: #261a00; }
.hms-pod [data-podium="2"] .blk { height: 78px; }
.hms-pod [data-podium="3"] .blk { height: 56px; }
.hms table { width: min(560px, 100%); border-collapse: collapse; font-size: 15px; text-align: left; }
.hms th { color: var(--d); font-weight: 600; font-size: 12px; padding: 4px 8px; }
.hms td { padding: 7px 8px; border-top: 1px solid var(--l); font-variant-numeric: tabular-nums; }
.hms tr[data-me="true"] td { background: rgba(255, 210, 74, 0.13); font-weight: 800; }
.hms-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; vertical-align: -1px; }
.hms-meter { height: 6px; border-radius: 3px; background: #0b1117; overflow: hidden; margin-top: 4px; }
.hms-meter b { display: block; height: 100%; background: linear-gradient(90deg, #7fe3a0, var(--a)); }
@keyframes hms-roll { from { transform: translateX(-24px) rotate(-14deg); } to { transform: translateX(24px) rotate(14deg); } }
@keyframes hms-pop { from { transform: scale(1.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes hms-rise { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.hms-motion .hms-ball { animation: hms-roll 1.8s ease-in-out infinite alternate; }
.hms-motion .hms-count { animation: hms-pop .5s ease-out; }
.hms-motion .hms-pod > div { animation: hms-rise .6s ease-out backwards; }
.hms-motion .hms-pod > div:nth-child(1) { animation-delay: .25s; } .hms-motion .hms-pod > div:nth-child(2) { animation-delay: .5s; } .hms-motion .hms-pod > div:nth-child(3) { animation-delay: 0s; }
@media (prefers-reduced-motion: reduce) { .hms-motion .hms-ball, .hms-motion .hms-count, .hms-motion .hms-pod > div { animation: none; } }
@media (max-width: 420px) { .hms-btn { min-width: 0; width: 100%; } .hms-field { grid-template-columns: 1fr 46px; } .hms-field input { grid-column: 1 / -1; grid-row: 2; } }
`;

export function ScreenStyles(): ReactElement {
  return <style data-screens="styles" dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />;
}

/** The class list of a screen root: base, background style and whether it animates. */
export const rootClass = (bg: 'bg' | 'dim', reducedMotion?: boolean): string => `hms hms-${bg}${reducedMotion ? '' : ' hms-motion'}`;
