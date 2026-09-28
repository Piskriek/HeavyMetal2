/**
 * H9 — the whole field on one line along the top of the screen: a dot per racer (up to 100) at its
 * course progress, the player's larger and ringed. Drawn on a canvas in its own animation frame from
 * a buffer the engine fills, so 100 dots cost no React renders and allocate nothing per frame.
 */
import { useEffect, useRef } from 'react';

export interface TrackStripMapProps {
  /** Fills progress (0..1, NaN = not racing yet) per racer, player first; returns the count. */
  fill: (out: Float32Array) => number;
  /** Racer colours in the same order (asked again only when the field size changes). */
  colors: () => readonly string[];
  /** Where the first split is, as a share of the course (a tick on the rail). */
  splitAt?: number;
}

const MAX_DOTS = 128;

export default function TrackStripMap({ fill, colors, splitAt }: TrackStripMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const paint = canvas?.getContext('2d');
    if (!canvas || !paint) return;
    const progress = new Float32Array(MAX_DOTS);
    let palette: readonly string[] = [];
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth; const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      paint.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint.clearRect(0, 0, width, height);
      const pad = 8; const rail = height / 2; const span = width - pad * 2;
      paint.fillStyle = 'rgba(20, 12, 6, 0.55)';
      paint.fillRect(pad, rail - 1.5, span, 3);
      if (splitAt !== undefined) {
        paint.fillStyle = 'rgba(240, 161, 91, 0.8)';
        paint.fillRect(pad + span * splitAt - 1, rail - 5, 2, 10);
      }
      const count = fill(progress);
      if (palette.length !== count) palette = colors();
      for (let i = count - 1; i >= 0; i--) { // the player (index 0) is drawn last, on top
        const at = progress[i];
        if (!Number.isFinite(at)) continue;
        const x = pad + span * at;
        paint.beginPath();
        paint.arc(x, rail, i === 0 ? 5 : 2.6, 0, Math.PI * 2);
        paint.fillStyle = i === 0 ? '#ff8a1e' : palette[i] ?? '#d8c9a3';
        paint.fill();
        if (i === 0) { paint.lineWidth = 2; paint.strokeStyle = '#fff3dc'; paint.stroke(); }
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [fill, colors, splitAt]);
  return <canvas ref={canvasRef} className="track-strip-map" aria-hidden="true" />;
}
