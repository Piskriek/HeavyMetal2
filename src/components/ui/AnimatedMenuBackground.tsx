/**
 * TICKET-05 AnimatedMenuBackground
 *
 * Renders a painted fantasy backdrop (1920×1080) with optional ambient layers:
 *   - a CSS parallax tilt tied to the pointer (±8 px)
 *   - a low-cost canvas of soft glowing embers drifting up
 *   - a torch/lantern CSS brightness flicker on the painted plane
 *   - a vignette-style overlay whose tint matches the preset's `overlay` field
 *
 * The component is generic: it does not own its parent container. It mounts
 * inside the menu's `<main>`, inside dialog backdrops, and inside the
 * round-result overlay. The `className` of the parent determines which overlay
 * gradient is used.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AMBIENT_EMBER_DURATION_S,
  AMBIENT_PARALLAX_PX,
  type MenuBackdrop,
  type MenuBackdropPreset,
  clampEmberCount,
  resolveBackdrop,
} from './ambient-motion';
import './animated-background.css';

interface AnimatedMenuBackgroundProps {
  /** Which preset to render. Falls back to `main`. */
  preset?: MenuBackdropPreset | string;
  /** Override the default ember count from the preset. */
  emberCount?: number;
  /** Override the default parallax tilt (pixels). */
  parallax?: number;
  /** Force-disable all ambient motion (independent of the reduced-motion flag). */
  motionActive?: boolean;
  /** Add a CSS class to the outer wrapper. Used to attach overlay variants. */
  className?: string;
}

/**
 * Soft glowing ember. Drifts upward and gently oscillates horizontally, fading
 * in at 18% and out before it leaves the canvas.
 */
function drawEmber(context: CanvasRenderingContext2D, particle: Ember) {
  context.save();
  const alpha = particle.alpha;
  context.globalAlpha = alpha;
  const halo = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, 9);
  halo.addColorStop(0, 'rgba(255, 207, 134, 0.95)');
  halo.addColorStop(0.5, 'rgba(255, 168, 86, 0.5)');
  halo.addColorStop(1, 'rgba(255, 168, 86, 0)');
  context.fillStyle = halo;
  context.beginPath();
  context.arc(particle.x, particle.y, 9, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = alpha * 0.9;
  context.fillStyle = 'rgba(255, 240, 198, 1)';
  context.beginPath();
  context.arc(particle.x, particle.y, 1.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

interface Ember {
  x: number;
  y: number;
  alpha: number;
  speed: number;
  sway: number;
  phase: number;
  size: number;
}

/** Cheap seeded PRNG so two renders of the same backdrop look the same and
 *  particle counts are deterministic in tests. */
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export default function AnimatedMenuBackground({
  preset,
  emberCount,
  parallax,
  motionActive,
  className,
}: AnimatedMenuBackgroundProps) {
  const backdrop: MenuBackdrop = useMemo(() => resolveBackdrop(preset), [preset]);
  const emberTotal = clampEmberCount(emberCount ?? backdrop.embers);
  const parallaxPx = Math.max(0, Math.min(16, parallax ?? backdrop.parallax));
  const isReduced = motionActive === false;
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(isReduced);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Reduced-motion detection: explicit prop beats the global flag beats the media query.
  useEffect(() => {
    if (isReduced) { setReduced(true); return; }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const classFlag = () => document.documentElement.classList.contains('reduced-motion-game');
    const evaluate = () => setReduced(media.matches || classFlag());
    evaluate();
    const onChange = () => evaluate();
    media.addEventListener('change', onChange);
    const observer = new MutationObserver(evaluate);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { media.removeEventListener('change', onChange); observer.disconnect(); };
  }, [isReduced]);

  // Mouse-driven parallax: tilt the painted plane within ±parallaxPx.
  useEffect(() => {
    if (reduced || parallaxPx === 0) return;
    const handler = (event: PointerEvent) => {
      const bounds = wrapper.current?.getBoundingClientRect();
      if (!bounds) return;
      const nx = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const ny = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      setTilt({ x: -nx * parallaxPx, y: -ny * parallaxPx });
    };
    const reset = () => setTilt({ x: 0, y: 0 });
    window.addEventListener('pointermove', handler, { passive: true });
    window.addEventListener('pointerleave', reset);
    return () => {
      window.removeEventListener('pointermove', handler);
      window.removeEventListener('pointerleave', reset);
    };
  }, [reduced, parallaxPx]);

  // Ember canvas. Runs on requestAnimationFrame while the wrapper is visible
  // and stops when reduced motion is on or the canvas is off-screen.
  useEffect(() => {
    if (reduced) return;
    const node = canvas.current;
    const container = wrapper.current;
    if (!node || !container) return;
    const context = node.getContext('2d');
    if (!context) return;
    const rand = makePrng(0x5e5 + emberTotal * 17);
    const particles: Ember[] = Array.from({ length: emberTotal }, () => ({
      x: rand() * node.width,
      y: rand() * node.height,
      alpha: 0,
      speed: 4 + rand() * 9,
      sway: 6 + rand() * 18,
      phase: rand() * Math.PI * 2,
      size: 0.6 + rand() * 1.1,
    }));
    let last = performance.now();
    let frame = 0;
    let observer: IntersectionObserver | null = null;
    let visible = true;
    const handleVisible = (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry) visible = entry.isIntersecting;
    };
    observer = new IntersectionObserver(handleVisible, { root: null, threshold: 0.01 });
    observer.observe(node);
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) { raf = requestAnimationFrame(tick); return; }
      context.clearRect(0, 0, node.width, node.height);
      frame += dt;
      particles.forEach((particle, index) => {
        const progress = ((frame * particle.speed * 0.012 + index * 0.07) % 1);
        const y = node.height - progress * (node.height + 60);
        const sway = Math.sin(frame + particle.phase) * particle.sway;
        const x = (particle.x + sway + node.width) % node.width;
        const alpha = progress < 0.18 ? progress / 0.18 : progress > 0.82 ? (1 - progress) / 0.18 : 1;
        drawEmber(context, { ...particle, x, y, alpha: alpha * particle.size });
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [reduced, emberTotal]);

  // Size the canvas to its container for crisp embers at any DPR.
  useEffect(() => {
    const node = canvas.current;
    const container = wrapper.current;
    if (!node || !container) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.max(1, Math.round(rect.width * dpr));
      node.height = Math.max(1, Math.round(rect.height * dpr));
      node.style.width = `${rect.width}px`;
      node.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const planeStyle: CSSProperties = {
    backgroundImage: `url(${backdrop.url})`,
    backgroundSize: 'cover',
    backgroundPosition: backdrop.position,
    backgroundRepeat: 'no-repeat',
    transform: reduced || parallaxPx === 0 ? 'none' : `translate3d(${tilt.x}px, ${tilt.y}px, 0) scale(1.06)`,
    transition: reduced || parallaxPx === 0 ? 'none' : 'transform 220ms ease-out',
  };

  const wrapperClass = `animated-menu-bg ambient-overlay-${backdrop.overlay} ${backdrop.flicker ? 'ambient-flicker' : ''} ${className ?? ''}`.trim();
  // The data-motion attribute lets global reduced-motion CSS still pause the
  // backdrop animations even when the prop is left at its default.
  const motionAttr = reduced ? 'false' : 'true';

  return (
    <div
      ref={wrapper}
      className={wrapperClass}
      data-motion={motionAttr}
      data-preset={backdrop.preset}
      aria-hidden="true"
    >
      <div className="ambient-backdrop-plane ambient-current menu-world" style={planeStyle} />
      <div className="ambient-smoke" aria-hidden="true">
        <span style={{ left: '8%', top: '36%', animationDelay: '0s' }} />
        <span style={{ left: '24%', top: '58%', animationDelay: '-3.4s' }} />
        <span style={{ left: '52%', top: '32%', animationDelay: '-7.1s' }} />
        <span style={{ left: '74%', top: '64%', animationDelay: '-10.8s' }} />
        <span style={{ left: '88%', top: '40%', animationDelay: '-1.9s' }} />
      </div>
      <canvas ref={canvas} className="ambient-embers" aria-hidden="true" hidden={reduced} />
      <div className="ambient-vignette" aria-hidden="true" />
    </div>
  );
}

// Re-export the canonical parallax default so external tests can assert against it.
export { AMBIENT_PARALLAX_PX, AMBIENT_EMBER_DURATION_S };
