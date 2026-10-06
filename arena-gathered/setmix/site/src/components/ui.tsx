import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Panel({
  children,
  className,
  label,
  right,
  accent,
  flush,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  right?: ReactNode;
  accent?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "fi-panel relative border border-line bg-panel/80 backdrop-blur-[2px]",
        className,
      )}
      style={accent ? { borderColor: accent + "55" } : undefined}
    >
      {label && (
        <div
          className="flex items-center justify-between gap-3 border-b border-line/80 px-3 py-[7px]"
          style={accent ? { borderColor: accent + "33" } : undefined}
        >
          <div className="mono flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] uppercase">
            <span
              className="inline-block h-[7px] w-[7px]"
              style={{ background: accent ?? "var(--fi-accent)" }}
            />
            <span style={{ color: accent ?? undefined }} className={accent ? "" : "text-dim"}>
              {label}
            </span>
          </div>
          {right}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </div>
  );
}

export function SectionHead({
  n,
  title,
  kicker,
  lede,
}: {
  n: string;
  title: string;
  kicker?: string;
  lede?: string;
}) {
  return (
    <header className="mb-8">
      <div className="mono mb-3 flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase">
        <span className="fi-accent-bg px-2 py-1 font-bold text-void">SEC {n}</span>
        {kicker && <span className="text-dim">{kicker}</span>}
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="text-balance text-3xl leading-[1.05] font-black tracking-tight sm:text-5xl">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-base">{lede}</p>
      )}
    </header>
  );
}

export function Tag({
  children,
  color,
  solid,
}: {
  children: ReactNode;
  color?: string;
  solid?: boolean;
}) {
  return (
    <span
      className="mono inline-block border px-[6px] py-[2px] text-[9.5px] font-bold tracking-[0.14em] whitespace-nowrap uppercase"
      style={{
        borderColor: (color ?? "#2a3242") + (solid ? "" : "66"),
        color: solid ? "#04060a" : (color ?? "#8b9bb4"),
        background: solid ? color : (color ?? "#8b9bb4") + "12",
      }}
    >
      {children}
    </span>
  );
}

export function Formula({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="fi-panel relative overflow-hidden border border-line bg-void2 p-3">
      {label && (
        <div className="mono mb-1.5 text-[9px] tracking-[0.25em] text-dim uppercase">{label}</div>
      )}
      <code className="mono block overflow-x-auto text-[12.5px] leading-relaxed whitespace-pre text-chalk/90">
        {children}
      </code>
    </div>
  );
}

export function Bar({
  v,
  color,
  h = 6,
  ghost,
}: {
  v: number;
  color: string;
  h?: number;
  ghost?: number;
}) {
  return (
    <div className="relative w-full border border-line/80 bg-void2" style={{ height: h }}>
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-200"
        style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color }}
      />
      {ghost !== undefined && (
        <div
          className="absolute inset-y-0 w-px bg-chalk/50"
          style={{ left: `${Math.min(1, ghost) * 100}%` }}
        />
      )}
    </div>
  );
}

export function KV({ k, v, color }: { k: string; v: ReactNode; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/50 py-[5px] last:border-0">
      <span className="mono text-[10px] tracking-[0.12em] text-dim uppercase">{k}</span>
      <span className="mono tnum text-right text-[11.5px] font-medium" style={{ color }}>
        {v}
      </span>
    </div>
  );
}

export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i} className="font-bold text-chalk">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.001,
  color = "#e8eef7",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  color?: string;
  className?: string;
}) {
  // local echo so dragging stays buttery even when the consumer throttles state
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={local}
      onPointerDown={() => (dragging.current = true)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onBlur={() => (dragging.current = false)}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        setLocal(v);
        onChange(v);
      }}
      className={cn("w-full", className)}
      style={{ ["--thumb" as string]: color }}
    />
  );
}
