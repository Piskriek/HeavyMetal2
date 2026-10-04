import { useEffect, useRef, type ReactElement } from 'react';
import type { ToolPreset } from '@hm/buildkit';
import type { StampKind } from '@hm/terrainops';
import { litDraft, paintDraft, rememberDraft, sculptDraft, undoDraft, type DraftHistory, type TexDraft, type TexPaintWay } from './texture-draft';

/**
 * Texture mode's bench (MASTER_PLAN 6.4): the tile you stepped into, big and lit, three by three so you see it repeat; the island waits dimmed
 * behind it. Use the hotbar on it as on the ground: Paint's ways put the palette's colour on, Sculpt's ways change its height (watch the light
 * catch the bumps), the right button does the other way. Every change shows on the island a moment later.
 */
export function TextureBench(props: {
  readonly name: string;
  readonly draft: TexDraft;
  /** Its undo and redo (Ctrl+Z, Ctrl+Y while you are in the texture). */
  readonly history: DraftHistory;
  /** The tool in your hand (null: a tab without tools). */
  readonly tool: ToolPreset | null;
  readonly tab: string;
  readonly colour: readonly [number, number, number];
  readonly shape: StampKind;
  /** The tile changed (the island redraws it, a little later). */
  readonly onChange: () => void;
  readonly onSay: (text: string) => void;
}): ReactElement {
  const { draft } = props;
  const view = useRef<HTMLCanvasElement>(null);
  const tile = useRef<HTMLCanvasElement | null>(null);
  const dirty = useRef(true);
  const live = useRef(props);
  live.current = props;

  // redraw when something changed, at most once a frame
  useEffect(() => {
    let raf = 0;
    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      if (!dirty.current || !view.current) return;
      dirty.current = false;
      const size = draft.size;
      tile.current ??= document.createElement('canvas');
      const t = tile.current;
      t.width = t.height = size;
      t.getContext('2d')?.putImageData(new ImageData(litDraft(draft) as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
      const v = view.current, ctx = v.getContext('2d');
      if (!ctx) return;
      v.width = v.height = size * 3;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(t, x * size, y * size);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [draft]);

  // painting and sculpting with the mouse
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    let down = false, alt = false, last: [number, number] | null = null, seed = 1;
    const at = (e: PointerEvent): [number, number] => {
      const r = v.getBoundingClientRect(), size = draft.size;
      return [(((e.clientX - r.left) / r.width) * 3 * size) % size, (((e.clientY - r.top) / r.height) * 3 * size) % size];
    };
    const dab = (x: number, y: number, first: boolean): boolean => {
      const p = live.current, tool = p.tool, size = draft.size;
      if (!tool) return false;
      const radius = Math.max(2, (tool.size * size) / 24) * (alt && tool.tab === 'paint' ? 0.5 : 1);
      if (tool.tab === 'paint' && tool.way) {
        if ((tool.way === 'fill' || tool.way === 'stamp' || tool.way === 'pattern') && !first) return false;
        return paintDraft(draft, (tool.way === 'clone' ? 'brush' : tool.way) as TexPaintWay, x, y, radius, tool.strength, p.colour, seed++);
      }
      if (tool.tab === 'sculpt') {
        const way = tool.action === 'sculpt' ? tool.sculpt : tool.action === 'dig' ? 'lower' : tool.action;
        if (way === 'stamp' || tool.action === 'mound' || tool.action === 'crater' || tool.action === 'plateau' || tool.action === 'ridge' || tool.action === 'dune') {
          if (!first) return false;
          const shape = (tool.action === 'sculpt' ? p.shape : tool.action) as StampKind;
          return sculptDraft(draft, 'stamp', x, y, radius, tool.strength, alt, shape);
        }
        if (way === 'grab') return false;
        return sculptDraft(draft, way as Parameters<typeof sculptDraft>[1], x, y, radius, tool.strength, alt);
      }
      return false;
    };
    const stroke = (e: PointerEvent, first: boolean): void => {
      const [x, y] = at(e);
      const p = live.current;
      if (!p.tool) { if (first) p.onSay(p.tab === 'animate' ? 'Animate: pick how it moves in the palette (Tab)' : 'Paint and Sculpt work on the texture'); return; }
      let changed = false;
      if (last && !first) {
        // dab along the drag so a fast stroke leaves no gaps (the shorter way round the tile's wrap)
        const size = draft.size;
        let dx = x - last[0], dy = y - last[1];
        if (dx > size / 2) dx -= size; else if (dx < -size / 2) dx += size;
        if (dy > size / 2) dy -= size; else if (dy < -size / 2) dy += size;
        const steps = Math.min(30, Math.floor(Math.hypot(dx, dy) / Math.max(2, (p.tool.size * size) / 80)));
        for (let k = 1; k <= steps; k++) changed = dab(last[0] + (dx * k) / (steps + 1), last[1] + (dy * k) / (steps + 1), false) || changed;
      }
      changed = dab(x, y, first) || changed;
      last = [x, y];
      if (changed) { dirty.current = true; p.onChange(); }
    };
    const onDown = (e: PointerEvent): void => { e.preventDefault(); e.stopPropagation(); if (!live.current.tool) { stroke(e, true); return; } rememberDraft(draft, live.current.history); down = true; alt = e.button === 2; last = null; v.setPointerCapture(e.pointerId); stroke(e, true); };
    // undo and redo inside the texture (before the island's own Ctrl+Z, which would undo the island)
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase(), redo = k === 'y' || (k === 'z' && e.shiftKey);
      if (k !== 'z' && k !== 'y') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const p = live.current;
      if (undoDraft(draft, p.history, redo)) { dirty.current = true; p.onChange(); p.onSay(redo ? 'Redone' : 'Undone'); } else p.onSay(redo ? 'Nothing to redo' : 'Nothing to undo in this texture');
    };
    window.addEventListener('keydown', onKey, true);
    const onMove = (e: PointerEvent): void => { if (down) { e.stopPropagation(); stroke(e, false); } };
    const onUp = (e: PointerEvent): void => { down = false; last = null; try { v.releasePointerCapture(e.pointerId); } catch { /* not captured */ } };
    const noMenu = (e: MouseEvent): void => e.preventDefault();
    v.addEventListener('pointerdown', onDown);
    v.addEventListener('pointermove', onMove);
    v.addEventListener('pointerup', onUp);
    v.addEventListener('contextmenu', noMenu);
    return () => { window.removeEventListener('keydown', onKey, true); v.removeEventListener('pointerdown', onDown); v.removeEventListener('pointermove', onMove); v.removeEventListener('pointerup', onUp); v.removeEventListener('contextmenu', noMenu); };
  }, [draft]);

  return (
    <div className="tex-bench" role="region" aria-label={`${props.name} texture`} data-ui="island.texture-bench">
      <canvas ref={view} className="tb-view" aria-label={`${props.name}, three by three`} />
    </div>
  );
}
