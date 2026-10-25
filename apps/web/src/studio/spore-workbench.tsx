/** Rung 4/5 card shelf. Uses the same StudioViewport, kit builder, and beauty renderer as the rest of Studio. */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { CREATURE_ARCHETYPE_GENOMES } from '@hm/creature';
import { MATERIAL_SHELF } from '@hm/matstack';
import { auditSporeCreation, type SporeCard } from '@hm/cartlab';
import { ALL_MACHINE_VEHICLE_KIT_IDS, GAME_PRESETS, gameRigKit, type MultiverseGamePresetSpec } from '../play/game-presets';
import { buildSporeModel, preloadSporeCreation } from './spore-model';
import { downloadSporeCard } from './spore-card';
import { StudioViewport } from './studio-viewport';

function card(title: string, creation: SporeCard['creation']): SporeCard { return { schema: 'hm2:spore-card:v1', title, author: 'FIDELITY Studio', creation }; }
const LIBRARY: readonly SporeCard[] = [
  ...GAME_PRESETS.map((p) => card(p.title, { kind: 'game', spec: p })),
  ...CREATURE_ARCHETYPE_GENOMES.map((g) => card(g.id, { kind: 'creature', spec: g })),
  ...ALL_MACHINE_VEHICLE_KIT_IDS.map((id) => { const rig = gameRigKit(id)!; return card(id.slice(4), { kind: 'kit', spec: rig.kit, preset: rig.preset }); }),
  ...Object.entries(MATERIAL_SHELF).map(([id, spec]) => card(id, { kind: 'material', spec })),
];

export function SporeWorkbench({ imported, onPlay }: { readonly imported: SporeCard | null; readonly onPlay?: (preset: MultiverseGamePresetSpec) => void }): ReactElement {
  const [selected, setSelected] = useState<SporeCard>(imported ?? LIBRARY[0]!);
  const [note, setNote] = useState('One PNG, a complete mathematical preset. Drop a card on any Studio canvas to import.');
  const host = useRef<HTMLDivElement>(null);
  const [author, setAuthor] = useState(selected.author);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (imported) { setSelected(imported); setAuthor(imported.author); } }, [imported]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const resources = new Set<{ dispose(): void }>();
    const keep = <T extends { dispose(): void }>(x: T): T => { resources.add(x); return x; };
    let vp: StudioViewport | null = null;
    let alive = true;
    void (async () => { try {
      auditSporeCreation(selected.creation);
      await preloadSporeCreation(selected.creation);
      if (!alive) return;
      const build = buildSporeModel(selected.creation, keep);
      vp = new StudioViewport(el, { onDragStart: () => {}, onDrag: () => {}, onDragEnd: () => {} });
      vp.show([{ key: 'spore', label: selected.title, raw: build.group, slot: [0, 0, 0], tweak: null }], {
        anchor: null, transform: null, overlay: 'solid', figure: false, context: 'none', size: [3, 3, 3], reframe: true,
      });
      setNote(auditSporeCreation(selected.creation));
    } catch (e) { if (alive) setNote(e instanceof Error ? e.message : 'Preview unavailable'); } })();
    return () => { alive = false; vp?.dispose(); for (const resource of resources) resource.dispose(); };
  }, [selected]);
  const share = async (): Promise<void> => {
    setBusy(true);
    try { await downloadSporeCard({ ...selected, author }); setNote('512 × 512 beauty PNG exported. Preset JSON is embedded losslessly in zTXt.'); }
    catch (e) { setNote(e instanceof Error ? e.message : 'Export refused'); }
    finally { setBusy(false); }
  };
  return <div className="sx-tab-pane sx-scene-pane" data-testid="spore-workbench">
    <div className="sx-view sx-scene-view" ref={host} />
    <aside className="sx-panel sx-scene-side">
      <section className="sx-block">
        <h2>Spore Cards <span className="sx-count">Rung 4 / 5</span></h2>
        <label className="sx-select"><span>Creation</span><select aria-label="Spore creation" value={LIBRARY.indexOf(selected)} onChange={(e) => { const next = LIBRARY[Number(e.target.value)]; if (next) setSelected(next); }}>
          {LIBRARY.indexOf(selected) < 0 ? <option value={-1}>{selected.title} (imported)</option> : null}
          {LIBRARY.map((c, i) => <option key={`${c.creation.kind}:${c.title}`} value={i}>{c.creation.kind} / {c.title}</option>)}
        </select></label>
        <h3>{selected.title}</h3>
        <p className="sx-dim">{selected.creation.kind.toUpperCase()} / schema V1 / PNG zTXt</p>
        <label className="sx-select"><span>Author</span><input aria-label="Spore author" value={author} maxLength={64} onChange={(e) => setAuthor(e.target.value)} /></label>
        <p role="status">{note}</p>
        <div className="sx-cluster">
          <button type="button" className="sx-go" disabled={busy} onClick={() => void share()}>{busy ? 'Capturing beauty…' : 'Export PNG Spore Card'}</button>
          {selected.creation.kind === 'game' && onPlay ? <button type="button" onClick={() => { if (selected.creation.kind === 'game') onPlay(selected.creation.spec); }}>Play this preset</button> : null}
        </div>
        <p className="sx-dim">Imports verify every chunk CRC, a 256 KiB decompression budget, frozen schemas, and the same anatomy audit agents use. A green image stamp is not trusted.</p>
      </section>
    </aside>
  </div>;
}
