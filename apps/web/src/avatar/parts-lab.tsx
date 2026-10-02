import { useMemo, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { HEAD_PARTS, PART_PALETTES } from '@hm/voxpartshead';
import { BODY_PARTS } from '@hm/voxpartsbody';
import type { Part } from '@hm/voxpartshead';
import { assemble, defaultGoblinSpec, randomSpec } from '@hm/assembler';
import type { VoxelModel } from '@hm/voxel';
import { partToModel, type Scheme } from './convert';
import { renderThumb } from './thumbs';
import '../shell.css';
import '../studio.css';

/**
 * Parts Lab (dev page /parts.html): every voxel character part as a thumbnail rendered from the part itself, filterable by slot, in any colour scheme.
 * This is also the picker the avatar creator will use.
 */
const ALL: Part[] = [...HEAD_PARTS, ...(BODY_PARTS as unknown as Part[])];
const SLOTS = ['avatars', 'all', ...new Set(ALL.map((p) => p.slot))];
const avatarModel = (spec: ReturnType<typeof randomSpec>): { model: VoxelModel; note: string } => {
  const r = assemble(spec, ALL as never, PART_PALETTES as never);
  const m = r.model;
  return { model: { id: spec.name, name: spec.name, size: m.size, pivot: m.pivot, palette: m.palette.map((e) => ({ ...e })), cells: m.cells } as VoxelModel, note: r.report.skipped.map((k) => k.slot + ': ' + k.reason).join('; ') };
};

function Lab(): ReactElement {
  const [slot, setSlot] = useState('avatars');
  const avatars = useMemo(() => [defaultGoblinSpec(ALL as never), ...Array.from({ length: 11 }, (_, i) => randomSpec(i + 1, ALL as never, PART_PALETTES as never))].map(avatarModel), []);
  const [scheme, setScheme] = useState(Object.keys(PART_PALETTES)[0]!);
  const [pick, setPick] = useState<Part | null>(null);
  const shown = useMemo(() => ALL.filter((p) => slot === 'all' || p.slot === slot), [slot]);
  const colours = PART_PALETTES[scheme] as Scheme;
  return (
    <div style={{ padding: 16, height: '100vh', overflow: 'auto', background: 'var(--paper)' }}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <b style={{ letterSpacing: '.16em' }}>PARTS LAB</b>
        <span className="hint">{slot === 'avatars' ? `${avatars.length} assembled goblins` : `${shown.length} parts`}</span>
        <select value={scheme} onChange={(e) => setScheme(e.target.value)}>{Object.keys(PART_PALETTES).map((k) => <option key={k}>{k}</option>)}</select>
        <span className="tabs">{SLOTS.map((s) => <button key={s} className={slot === s ? 'on' : ''} onClick={() => setSlot(s)}>{s}</button>)}</span>
      </header>
      {slot === 'avatars' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
          {avatars.map((a, i) => <div key={i} style={{ padding: 8, borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', textAlign: 'center' }}><img alt={a.model.name} width={300} height={300} src={renderThumb(a.model, 300, 28 + i * 7)} /><div className="hint">{a.model.name}{a.note ? ` (${a.note})` : ''}</div></div>)}
        </div>
      ) : null}
      <div style={{ display: slot === 'avatars' ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 0, borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
        {shown.map((p) => (
          <button key={p.id} onClick={() => setPick(p)} title={p.doc} style={{ display: 'grid', gap: 4, justifyItems: 'center', padding: 8, border: 0, borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: pick?.id === p.id ? '#ecebe4' : 'transparent' }}>
            <img alt={p.name} width={128} height={128} src={renderThumb(partToModel(p, colours), 128)} />
            <span style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>{p.name}</span>
            <span className="hint">{p.slot}</span>
          </button>
        ))}
      </div>
      {pick ? <p className="hint">{pick.name}: {pick.doc} · {pick.size.join('x')} · anchors {Object.keys(pick.anchors).join(', ')}</p> : null}
    </div>
  );
}

createRoot(document.getElementById('app')!).render(<Lab />);
