// Collects one Code Arena answer's project files and hands them to the local receiver (scripts/arena-recv.mjs) by a navigation,
// so the code lands in arena-out/<name>/ without passing through the agent's context (Opus does not read battle code since
// 2026-10-17: Argo reviews it). Run inside the chat page, with the wanted option's code view open (switch the option tab with a
// real click first; a JS click does not switch it). Then reopen the chat URL.
//   (0,eval)(await (await fetch(rawUrl)).text()); await window.__arenaFiles('plotbiome-a')
// Returns only the paths and sizes; with { go: false } it does not navigate (a dry run).
window.__arenaFiles = async (name, { go = true } = {}) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // the chat log names each file's full path ("Created src/plotbiome.ts"); the tree shows base names only
  const fullPath = new Map();
  for (const b of document.querySelectorAll('button')) {
    const m = /^(?:Created|Edited)\s+(\S+)$/.exec(b.textContent.trim());
    if (m) fullPath.set(m[1].split('/').pop(), m[1]);
  }
  const tree = [...document.querySelectorAll('button')].filter((b) => /^[\w.-]+\.(ts|tsx|js|jsx|mjs|html|css|json|md)$/.test(b.textContent.trim()));
  const files = {};
  for (const b of tree) {
    if (/lock\.json$/.test(b.textContent.trim())) continue; // lock files only bloat the URL
    const base = b.textContent.trim();
    b.click();
    await sleep(900);
    const view = document.querySelector('.cm-content')?.cmTile?.view;
    if (!view) continue;
    files[fullPath.get(base) ?? base] = view.state.doc.toString();
  }
  const json = JSON.stringify({ files });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const summary = { name, count: Object.keys(files).length, bytes: json.length, paths: Object.fromEntries(Object.entries(files).map(([p, t]) => [p, t.length])) };
  if (go) setTimeout(() => { location.href = `http://127.0.0.1:8791/put?name=${encodeURIComponent(name)}&d=${b64}`; }, 50);
  return summary;
};
