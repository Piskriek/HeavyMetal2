// The Solar Lattice overview ([M]): the seeded star system from above, its orbits, every body's stage and Four Floats, the Hohmann
// transfer windows from the home world and any harmonic conjunction. Reads the live lattice the play scene steps (solar-system-view.ts).
// Selecting a body shows its detail; travelling there is the Stargate's job (Plan 42), so this panel only reads.
import { useEffect, useState } from 'react';
import type { GalacticStarSystemSeed, OrbitalLatticeSnapshot } from '@hm/harness';

export interface SolarLatticeData {
  readonly system: GalacticStarSystemSeed;
  readonly snapshot: OrbitalLatticeSnapshot;
}

const SIZE = 460;
const C = SIZE / 2;

const INK = 'var(--ui-ink, #f2efe9)';
const DIM = 'var(--ui-dim, #a29d92)';
const ACCENT = 'var(--ui-accent, #d96b43)';
const HOUSING = 'var(--ui-housing, #141513)';
const PANEL = 'var(--ui-panel, #1b1d19)';

const STAGE_TINT: Record<string, string> = {
  S0a: '#9aa39a', S0b: '#b7b2a6', S1: '#c98a4b', S2: '#b8683f', S3: '#7fa650', S4: '#5f9a63', S5: '#4f8f8a', S6: '#6fb3d1',
};

export function SolarLatticePanel(props: { readonly read: () => SolarLatticeData | null; readonly onClose: () => void }) {
  const [data, setData] = useState<SolarLatticeData | null>(props.read());
  const [selected, setSelected] = useState<string>('body-1');
  useEffect(() => {
    const t = window.setInterval(() => setData(props.read()), 200);
    return () => window.clearInterval(t);
  }, [props]);
  if (!data) return null;
  const { system, snapshot } = data;
  const maxAu = Math.max(...system.bodies.map((b) => b.orbitRadiusAu));
  const scale = (C - 28) / (maxAu * 1000);
  const sel = snapshot.bodyPositions.find((b) => b.id === selected) ?? snapshot.bodyPositions[0];
  const selSeed = system.bodies.find((b) => b.id === sel?.id);
  const win = snapshot.transferWindows.find((w) => w.toBodyId === sel?.id);
  const pct = (v: number): number => Math.round(v * 100);

  return (
    <section
      aria-label="Solar Lattice"
      data-testid="solar-lattice"
      style={{
        position: 'fixed', inset: '8% 10%', zIndex: 1500, display: 'flex', gap: 16, padding: 16, color: INK, background: HOUSING,
        border: `2px solid ${ACCENT}`, borderRadius: 2, fontFamily: 'Oxanium, system-ui, sans-serif', boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
      }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flex: '0 0 auto', height: '100%', aspectRatio: '1', background: PANEL }}>
        {system.bodies.map((b) => (
          <circle key={b.id} cx={C} cy={C} r={b.orbitRadiusAu * 1000 * scale} fill="none" stroke={DIM} strokeOpacity={0.35} strokeDasharray="2 4" />
        ))}
        <circle cx={C} cy={C} r={9} fill="#fff1c4" />
        {snapshot.bodyPositions.map((b) => {
          const x = C + b.sectorX * scale, y = C + b.sectorZ * scale;
          const open = snapshot.transferWindows.some((w) => w.toBodyId === b.id && w.windowOpen);
          return (
            <g key={b.id} onClick={() => setSelected(b.id)} style={{ cursor: 'pointer' }}>
              {open ? <circle cx={x} cy={y} r={13} fill="none" stroke={ACCENT} strokeWidth={2} /> : null}
              {b.kind === 'stargate-ring'
                ? <circle cx={x} cy={y} r={8} fill="none" stroke="#7cf3ff" strokeWidth={3} />
                : <circle cx={x} cy={y} r={b.kind === 'moon' ? 5 : 8} fill={STAGE_TINT[b.stage] ?? '#888'} stroke={b.id === sel?.id ? INK : 'none'} strokeWidth={2} />}
              <text x={x + 11} y={y - 9} fontSize={11} fill={INK}>{b.name} · {b.stage}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Solar Lattice · {system.systemId}</h2>
        <p style={{ margin: '0 0 10px', color: DIM, fontSize: 12 }}>
          {system.zone === 'inner-core' ? 'Inner core' : 'Mid-to-outer rim'} · r {system.rGalactic} · Veil {snapshot.effectiveVeilThickness}
          {snapshot.conjunctionSignals.length > 0 ? ` · ${snapshot.conjunctionSignals.length} harmonic conjunction` : ''}
        </p>
        {sel && selSeed ? (
          <div style={{ background: PANEL, padding: 10, marginBottom: 10, borderLeft: `3px solid ${ACCENT}` }}>
            <strong>{sel.name}</strong> <span style={{ color: DIM }}>({sel.kind}, {sel.stage}) · {selSeed.shareCode}</span>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              texture {pct(selSeed.fourFloats.Pxd)} · shape {pct(selSeed.fourFloats.Vtx)} · light {pct(selSeed.fourFloats.Lx)} · water {pct(selSeed.fourFloats.Aq)}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: win?.windowOpen ? ACCENT : DIM }}>
              {sel.id === 'body-1'
                ? 'Home world.'
                : win ? `Transfer window ${win.windowOpen ? 'OPEN' : 'closed'} · phase error ${win.phaseErrorDeg}° · Δv ×${win.deltaVMultiplier}` : ''}
            </div>
          </div>
        ) : null}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12 }}>
          {snapshot.bodyPositions.map((b) => (
            <li key={b.id} onClick={() => setSelected(b.id)} style={{ padding: '3px 6px', cursor: 'pointer', background: b.id === sel?.id ? PANEL : 'transparent' }}>
              <span style={{ color: STAGE_TINT[b.stage] ?? INK }}>■</span> {b.name} · {b.stage} · {b.kind}
            </li>
          ))}
        </ul>
        <button type="button" onClick={props.onClose} style={{ marginTop: 12, background: ACCENT, color: HOUSING, border: 0, padding: '6px 12px', cursor: 'pointer' }}>
          Close [M]
        </button>
      </div>
    </section>
  );
}

