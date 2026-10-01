/** One small stylesheet for the inspector. Dark theme; the tier class (hmi-play / hmi-build / hmi-pro) sets the density. */
export const CSS = `
.hmi{background:#14181d;color:#dde6ee;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px;width:100%;min-width:0;box-sizing:border-box}
.hmi *,.hmi *::before,.hmi *::after{box-sizing:border-box}
.hmi-group{margin:0 0 16px}
.hmi-group:last-child{margin-bottom:0}
.hmi-h{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8ea3b5}
.hmi-rows,.hmi-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.hmi-row,.hmi-slot{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:8px 10px;background:#1b2229;border:1px solid #242e37;border-left:3px solid #242e37;border-radius:8px}
.hmi-ov{border-left-color:#4ea1ff}
.hmi-label{flex:1 1 110px;min-width:0;overflow-wrap:anywhere;cursor:help}
.hmi-ctl{flex:2 1 150px;min-width:0;display:flex;align-items:center;gap:8px}
.hmi-in{width:100%;min-width:0;height:34px;padding:0 8px;background:#0e1216;color:inherit;border:1px solid #2f3b46;border-radius:6px;font:inherit}
.hmi-in:focus-visible,.hmi-range:focus-visible,.hmi-check:focus-visible,.hmi-reset:focus-visible{outline:2px solid #4ea1ff;outline-offset:1px}
.hmi-range{flex:1 1 auto;width:100%;min-width:0;height:34px;margin:0;accent-color:#4ea1ff}
.hmi-val{flex:0 0 auto;min-width:3.5em;text-align:right;font-variant-numeric:tabular-nums;color:#9fd0ff}
.hmi-check{width:22px;height:22px;margin:0;accent-color:#4ea1ff}
.hmi-swatch{width:56px;height:34px;padding:2px;background:#0e1216;border:1px solid #2f3b46;border-radius:6px}
.hmi-vec{display:flex;gap:6px;width:100%}
.hmi-axis{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:4px}
.hmi-axis span{color:#8ea3b5;font-size:.85em;text-transform:uppercase}
.hmi-exprwrap{display:flex;align-items:center;gap:6px;width:100%}
.hmi-fx{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;padding:0 6px;border-radius:999px;background:#2b3a52;color:#9fd0ff;font-style:italic;font-weight:700}
.hmi-sum{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:.9em ui-monospace,SFMono-Regular,Menlo,monospace;color:#9fb0bf}
.hmi-reset{flex:0 0 auto;padding:2px 10px;min-height:26px;background:transparent;color:#9fd0ff;border:1px solid #34506e;border-radius:999px;font:inherit;font-size:.85em;cursor:pointer}
.hmi-reset:hover{background:#1f3047}
.hmi-count{flex:0 0 auto;font-variant-numeric:tabular-nums;color:#9fd0ff}
.hmi-chips{flex:2 1 150px;min-width:0;display:flex;flex-wrap:wrap;gap:6px}
.hmi-chip{padding:1px 8px;background:#0e1216;border:1px solid #2f3b46;border-radius:999px;font:.9em ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.hmi-none,.hmi-empty{color:#6f8294;font-style:italic}
.hmi-play{font-size:18px;padding:14px}
.hmi-play .hmi-row{padding:12px 14px}
.hmi-play .hmi-ctl{min-height:48px}
.hmi-play .hmi-in,.hmi-play .hmi-range,.hmi-play .hmi-swatch{height:48px}
.hmi-play .hmi-swatch{width:84px}
.hmi-play .hmi-check{width:36px;height:36px}
.hmi-play .hmi-reset{min-height:48px;min-width:48px;padding:0 16px}
.hmi-pro{font-size:12px;padding:8px}
.hmi-pro .hmi-group{margin-bottom:10px}
.hmi-pro .hmi-rows,.hmi-pro .hmi-list{gap:8px}
.hmi-pro .hmi-row,.hmi-pro .hmi-slot{padding:3px 8px;gap:4px 8px}
.hmi-pro .hmi-label{flex-basis:90px}
.hmi-pro .hmi-in,.hmi-pro .hmi-range{height:24px;padding:0 6px}
.hmi-pro .hmi-swatch{height:24px;width:40px}
.hmi-pro .hmi-check{width:14px;height:14px}
.hmi-pro .hmi-reset{min-height:20px;padding:0 8px}
`;
