import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { STAGES } from "@/data/gdd";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const mix = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t));

export const hexToRgb = (h: string): number[] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToCss = (c: number[]) =>
  `rgb(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(
    clamp(c[2], 0, 255),
  )})`;

/** slider position (0..1) → Fidelity Index, logarithmic inside each equal-width stage */
export function fiFromT(t: number) {
  const s = clamp(Math.floor(t * 6), 0, 5);
  const local = clamp(t * 6 - s);
  const st = STAGES[s];
  if (s === 0) return Math.pow(local, 1.7) * st.fiMax;
  const lo = Math.max(st.fiMin, 1);
  return lo * Math.pow(st.fiMax / lo, local);
}

export const stageFromT = (t: number) => clamp(Math.floor(t * 6), 0, 5);

/** normalised 0..1 strength of each metric at slider position t */
export function metricsFromT(t: number) {
  return {
    pxd: clamp(Math.pow(smoothstep(0.0, 0.62, t), 0.78)),
    vtx: clamp(Math.pow(smoothstep(0.1, 0.8, t), 0.92)),
    lx: clamp(Math.pow(smoothstep(0.06, 0.9, t), 0.85)),
    aq: clamp(Math.pow(smoothstep(0.42, 0.95, t), 1.05)),
  };
}

export const METRIC_TARGETS = { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7 };

export function fmtBig(n: number) {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0) + "K";
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e8 ? 2 : 1) + "M";
  return (n / 1e9).toFixed(2) + "B";
}

export const ACCENTS = ["#8b9bb4", "#ff6fb2", "#7cff4d", "#3dc8ff", "#86e05a", "#c9a6ff"];

type Ctx = {
  t: number;
  tRef: RefObject<number>;
  setT: (v: number) => void;
  auto: boolean;
  setAuto: (v: boolean) => void;
  stage: number;
  fi: number;
  m: ReturnType<typeof metricsFromT>;
};

const FiCtx = createContext<Ctx | null>(null);

/** The authoritative dial lives in a ref (read at 60 fps by the renderer).
 *  React state is a throttled mirror so the 2,000-node document does not
 *  re-render on every animation frame. */
export function FiProvider({ children }: { children: ReactNode }) {
  const tRef = useRef(0.04);
  const [t, setMirror] = useState(0.04);
  const [auto, setAuto] = useState(false);
  const timer = useRef<number | null>(null);

  const setT = useCallback((v: number) => {
    tRef.current = clamp(v);
    if (timer.current == null) {
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setMirror(tRef.current);
      }, 45);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const n = tRef.current + dt * 0.03;
      setT(n > 1 ? 0 : n);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [auto, setT]);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const stage = stageFromT(t);
  const fi = fiFromT(t);
  const m = useMemo(() => metricsFromT(t), [t]);

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--fi-radius", `${(t * 14).toFixed(1)}px`);
    r.setProperty("--fi-sat", t.toFixed(3));
    r.setProperty("--fi-glow", (t * 0.9).toFixed(3));
    r.setProperty("--fi-grain", (0.55 - t * 0.5).toFixed(3));
    const a = ACCENTS[stage];
    r.setProperty("--fi-accent", a);
    const [rr, gg, bb] = hexToRgb(a);
    r.setProperty("--fi-accent-soft", `rgba(${rr},${gg},${bb},0.16)`);
  }, [t, stage]);

  return (
    <FiCtx.Provider value={{ t, tRef, setT, auto, setAuto, stage, fi, m }}>
      {children}
    </FiCtx.Provider>
  );
}

export function useFi() {
  const c = useContext(FiCtx);
  if (!c) throw new Error("useFi outside provider");
  return c;
}
