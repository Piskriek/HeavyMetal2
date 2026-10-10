// Arena prompt sender, run inside the arena.ai page (browser tool's javascript_exec; it does not survive a reload).
// Defines window.__arenaSend(text) -> { ok, why }. Works on both pages:
//   Code Arena (battle) — a plain <textarea>;  Agent mode — a TipTap/ProseMirror editor (needs a paste event).
// It only reports ok when the input is empty again AND the text shows up outside the input (the sent message),
// so a prompt left sitting in the box is never mistaken for sent (the bug of 2026-10-10: the editor's own text matched).
// The send button is clicked as an element (not by screen coordinates), choosing the visible enabled one nearest the input.
window.__arenaSend = async (text) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s ?? '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const input = () => [...document.querySelectorAll('.tiptap.ProseMirror')].find(visible) ?? [...document.querySelectorAll('textarea')].find(visible) ?? null;
  const valueOf = (e) => (e ? (e.tagName === 'TEXTAREA' ? e.value : e.innerText) : '');
  const snippet = norm(text).slice(0, 80);
  const count = (hay) => hay.split(snippet).length - 1;
  const outside = () => count(norm(document.body.innerText)) - count(norm(valueOf(input())));

  let el = input();
  if (!el) return { ok: false, why: 'no input on the page' };
  const before = outside();
  if (el.tagName === 'TEXTAREA') {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    el.focus();
    document.execCommand('selectAll');           // replace anything already in the editor
    const dt = new DataTransfer(); dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }
  await sleep(500);
  el = input();
  if (!norm(valueOf(el)).includes(snippet)) return { ok: false, why: 'the input did not take the text' };

  for (let attempt = 0; attempt < 3; attempt++) {
    const r0 = el.getBoundingClientRect(), cx = r0.x + r0.width / 2, cy = r0.y + r0.height / 2;
    const btn = [...document.querySelectorAll('button[aria-label="Send message"], button[type="submit"]')]
      .filter((b) => visible(b) && !b.disabled)
      .sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.hypot(ra.x - cx, ra.y - cy) - Math.hypot(rb.x - cx, rb.y - cy); })[0];
    if (!btn) { await sleep(500); continue; }
    btn.click();
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const now = input();
      if (norm(valueOf(now)) === '' && outside() > before) return { ok: true, why: '' };
    }
    el = input() ?? el;
  }
  return { ok: false, why: norm(valueOf(input())) ? 'still in the input after 3 clicks' : 'input cleared but the message never appeared' };
};
'__arenaSend ready';
