import { sprayDataUri, type Tokens } from '@hm/doodletheme';

/**
 * Re-skins the game screens (title, character select, results ...) for a doodle theme. The screens package ships with a dark look hard-coded in its
 * own stylesheet; these rules come after it and win by specificity, so a theme change is one preset variable and no screen changes.
 */
export function screensThemeCss(t: Tokens, doodles: boolean): string {
  const edge = `var(--ink, ${t.ink})`;
  const wobble = '255px 15px 225px 15px / 15px 225px 15px 255px';
  const bg = doodles ? `url("${sprayDataUri(5, 1000, 700, t, 1.2)}") center / cover no-repeat, ` : '';
  return `
.hms.hms-bg { background: ${bg}${t.bg}; }
.hms.hms-dim { background: ${t.bg}ee; backdrop-filter: blur(3px); }
.hms .hms-logo { font-family: var(--font-display); font-weight: 400; letter-spacing: 0.02em; background: none; -webkit-background-clip: initial; background-clip: initial; color: ${t.ink}; filter: none;
  text-shadow: 3px 3px 0 ${t.accent}, 6px 6px 0 ${t.accent2}; transform: rotate(-2deg); }
.hms .hms-btn { font-family: var(--font-display); font-weight: 400; color: ${t.ink}; background: ${t.wall}; border: ${t.stroke}px solid ${edge}; border-radius: ${wobble}; box-shadow: 4px 5px 0 ${edge}; text-transform: none; }
.hms .hms-btn:hover { background: ${t.accent3}; transform: rotate(-1.5deg) translateY(-1px); }
.hms .hms-btn.go { color: ${t.onAccent}; background: ${t.accent}; box-shadow: 5px 6px 0 ${edge}; }
.hms .hms-btn.go:hover { background: ${t.accent2}; color: #fff; }
.hms .hms-btn.quiet { background: transparent; box-shadow: none; border-style: dashed; }
.hms .hms-panel { background: ${t.wall}; border: ${t.stroke}px solid ${edge}; border-radius: ${wobble}; box-shadow: 6px 8px 0 ${edge}; color: ${t.ink}; }
.hms .hms-card { background: ${t.wall}; color: ${t.ink}; border: ${t.stroke}px solid ${edge}; border-radius: ${wobble}; box-shadow: 3px 4px 0 ${edge}; }
.hms .hms-card:hover { background: ${t.bg}; }
.hms .hms-card[aria-pressed="true"] { border-color: ${t.accent2}; background: ${t.wall}; box-shadow: 5px 6px 0 ${t.accent2}; }
.hms .hms-seg button { color: ${t.ink}; border-right-color: ${edge}; }
.hms .hms-seg button[aria-pressed="true"] { background: ${t.accent}; color: ${t.onAccent}; }
.hms .hms-bar i, .hms .hms-meter, .hms .hms-progress { background: ${t.bg}; border-color: ${edge}; }
.hms .hms-bar i b, .hms .hms-meter b, .hms .hms-progress b { background: ${t.accent2}; }
.hms .hms-pod .blk { background: ${t.accent3}; color: ${t.ink}; border: ${t.stroke}px solid ${edge}; }
.hms .hms-pod [data-podium="1"] .blk { background: ${t.accent}; color: ${t.ink}; }
.hms tr[data-me="true"] td { background: ${t.accent}55; }
.hms, .hms td, .hms th { color: ${t.ink}; }
`;
}
