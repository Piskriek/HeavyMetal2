/**
 * Plan 58 Wave 3 (Tracks 1, 2 & 3):
 * - Track 1: Live Harvested Shelf Browser (lazy-indexed 2,606 presets across 8 games).
 * - Track 2: LitRPG Appraisal / Inspect Lens (`ui:appraise-panel` — Krout / Kong Style), validated by `validateScreen`
 *   and rendered via `<UiPanelView />`.
 * - Track 3: Ra's 7-Station Archetypical Mind Blueprint (`evaluateSevenStationCycle`, `invokeArchetype`) & `@hm/soundlab`
 *   Somatic Voice Filter preview.
 */
import { useMemo, useState, type ReactElement } from 'react';
import {
  APPRAISE_COMMANDS,
  APPRAISE_LENS_SCREEN,
  APPRAISE_PANEL,
  APPRAISE_SOURCES,
  validateScreen,
} from '@hm/hudlayout';
import {
  BODY_ZONES,
  HARVESTED_CATEGORIES,
  HARVESTED_SOURCE_GAMES,
  evaluateSevenStationCycle,
  invokeArchetype,
  queryHarvestedShelf,
  type BodyState,
  type HarvestedCategory,
  type HarvestedShelfEntry,
  type HarvestedSourceGame,
} from '@hm/harness';
import type { Mem } from '@hm/shorthand';
import type { WireGraphSpec } from '@hm/wiregraph';
import { UiPanelView } from './ui-panel';

export type AppraiseTarget =
  | {
      readonly kind: 'harvested';
      readonly entry: HarvestedShelfEntry;
      readonly wiregraph?: WireGraphSpec;
    }
  | {
      readonly kind: 'ai-being';
      readonly id: string;
      readonly name: string;
      readonly roleTitle: string;
      readonly author: string;
      readonly mem: Mem;
      readonly body?: BodyState | null;
      readonly fourFloats?: {
        readonly pxd: number;
        readonly vtx: number;
        readonly lx: number;
        readonly aq: number;
      };
    };

/** Validates `APPRAISE_LENS_SCREEN` against `APPRAISE_SOURCES` and `APPRAISE_COMMANDS` (must be `[]`). */
export const appraiseLensIssues = (): ReturnType<typeof validateScreen> =>
  validateScreen(APPRAISE_LENS_SCREEN, APPRAISE_SOURCES, APPRAISE_COMMANDS);

function summarizeBodyZones(mem: Mem, body?: BodyState | null): string {
  if (body) {
    const strained = body.zones.filter((z) => z.mode !== 'flowing' || z.signal !== null);
    if (strained.length === 0) return 'All 7 energy centers flowing cleanly.';
    return strained
      .map((z) => {
        const place = BODY_ZONES[z.ray - 1]?.mechanical ?? `Ray ${z.ray}`;
        return `R${z.ray} (${place}): ${z.mode}${z.sickness ? ` [${z.sickness}]` : ''}${z.signal ? ` (${z.signal})` : ''}`;
      })
      .join(' · ');
  }
  const activeRays: string[] = [];
  for (let i = 0; i < mem.charge.length; i++) {
    const c = mem.charge[i] ?? 0;
    if (Math.abs(c) > 4) {
      const place = BODY_ZONES[i]?.organic ?? `Ray ${i + 1}`;
      activeRays.push(`R${i + 1} ${place} (${c > 0 ? `+${c} blocked` : `${c} starved`})`);
    }
  }
  return activeRays.length > 0 ? activeRays.join(' · ') : 'All 7 rays at rest (flowing).';
}

/**
 * Pure helper computing the `APPRAISE_SOURCES` dictionary for any `AppraiseTarget` (harvested `elem:`, `kit:`,
 * `logic:`, `mot:`, `loc:` preset or an `ai-being`). Unapplicable fields return `null` so `UiPanelView` omits them.
 */
export function buildAppraiseValues(
  target: AppraiseTarget,
): Readonly<Record<string, string | number | boolean | null>> {
  if (target.kind === 'harvested') {
    const { entry, wiregraph } = target;
    const portsText = wiregraph
      ? `${wiregraph.sensors.length} sensors → ${wiregraph.nodes.length} nodes → ${wiregraph.actuators.length} actuators`
      : entry.metrics.sockets > 0
        ? `${entry.metrics.sockets} attachment sockets / ports`
        : null;

    return {
      'appraise.name': `${entry.name} (${entry.id})`,
      'appraise.kind': `Rung ${entry.rung} · ${entry.category}`,
      'appraise.author': `Transduced · ${entry.sourceGame}`,
      'appraise.pxd': entry.fourFloats.pxd,
      'appraise.vtx': entry.fourFloats.vtx,
      'appraise.lx': entry.fourFloats.lx,
      'appraise.aq': entry.fourFloats.aq,
      'appraise.massKg': entry.metrics.massKg > 0 ? entry.metrics.massKg : null,
      'appraise.thrustKn': entry.metrics.thrustKn > 0 ? entry.metrics.thrustKn : null,
      'appraise.powerMW': entry.metrics.powerMW > 0 ? entry.metrics.powerMW : null,
      'appraise.ports': portsText,
      'appraise.archetype': null,
      'appraise.polarity': null,
      'appraise.balance': null,
      'appraise.bodyZone': null,
    };
  }

  const eval7 = evaluateSevenStationCycle(target.mem, target.body ?? null);
  const floats = target.fourFloats ?? { pxd: 85, vtx: 80, lx: 92, aq: 74 };
  const poleLabel =
    eval7.crossWiring.pole === 'intent'
      ? 'Masculine (Mind=Magician, Body=Hermit)'
      : eval7.crossWiring.pole === 'context'
        ? 'Feminine (Mind=High Priestess, Body=Balanced Working)'
        : 'Balanced Synthesis (Matrix + Potentiator)';

  return {
    'appraise.name': `${target.name} (${target.id})`,
    'appraise.kind': target.roleTitle,
    'appraise.author': target.author,
    'appraise.pxd': floats.pxd,
    'appraise.vtx': floats.vtx,
    'appraise.lx': floats.lx,
    'appraise.aq': floats.aq,
    'appraise.massKg': null,
    'appraise.thrustKn': null,
    'appraise.powerMW': null,
    'appraise.ports': `${target.mem.ep.length} episodes · ${target.mem.cause.filter((c) => c.open).length} open causes`,
    'appraise.archetype': `Mind: ${eval7.mindStation.tarotName} (#${eval7.mindStation.number}) · Body: ${eval7.bodyStation.tarotName} (#${eval7.bodyStation.number})`,
    'appraise.polarity': `${poleLabel} [pol=${eval7.crossWiring.pol}]`,
    'appraise.balance': Math.round(target.mem.bal * 100) / 100,
    'appraise.bodyZone': summarizeBodyZones(target.mem, target.body),
  };
}

export interface HarvestedShelfAndAppraiseDeckProps {
  readonly aiBeings?: readonly Extract<AppraiseTarget, { readonly kind: 'ai-being' }>[];
  readonly onInvokeVirginMind?: (beingId: string, resultLine: string, nextMem: Mem) => void;
  readonly onSelectPresetCode?: (code: string, entry: HarvestedShelfEntry) => void;
}

export function HarvestedShelfAndAppraiseDeck(props: HarvestedShelfAndAppraiseDeckProps): ReactElement {
  const [category, setCategory] = useState<HarvestedCategory | 'all'>('all');
  const [sourceGame, setSourceGame] = useState<HarvestedSourceGame | 'all'>('all');
  const [search, setSearch] = useState<string>('');
  const [pageOffset, setPageOffset] = useState<number>(0);
  const pageSize = 12;

  const page = useMemo(
    () =>
      queryHarvestedShelf({
        category,
        sourceGame,
        search,
        offset: pageOffset,
        limit: pageSize,
      }),
    [category, sourceGame, search, pageOffset],
  );

  const [selectedTarget, setSelectedTarget] = useState<AppraiseTarget | null>(() =>
    page.items[0] ? { kind: 'harvested', entry: page.items[0] } : null,
  );
  const [statusFeedback, setStatusFeedback] = useState<string>('');

  const activeTarget: AppraiseTarget | null =
    selectedTarget ?? (page.items[0] ? { kind: 'harvested', entry: page.items[0] } : null);

  const values = activeTarget ? buildAppraiseValues(activeTarget) : {};

  const handleCopyCode = (): void => {
    if (!activeTarget) return;
    const code = activeTarget.kind === 'harvested' ? activeTarget.entry.id : activeTarget.id;
    try {
      void navigator.clipboard?.writeText(code);
    } catch {
      // ignore
    }
    setStatusFeedback(`Copied ${code} to clipboard.`);
    if (activeTarget.kind === 'harvested') {
      props.onSelectPresetCode?.(activeTarget.entry.id, activeTarget.entry);
    }
  };

  const handleInvokeVirginMind = (): void => {
    if (!activeTarget || activeTarget.kind !== 'ai-being') return;
    const res = invokeArchetype(activeTarget.mem, 'virgin-mind', activeTarget.body ?? null);
    setSelectedTarget({
      ...activeTarget,
      mem: res.mem,
      body: res.body,
    });
    setStatusFeedback(res.systemLine);
    props.onInvokeVirginMind?.(activeTarget.id, res.systemLine, res.mem);
  };

  const actions: Readonly<Record<string, () => void>> = {
    'appraise.copyCode': handleCopyCode,
    ...(activeTarget?.kind === 'ai-being' ? { 'appraise.invokeVirginMind': handleInvokeVirginMind } : {}),
  };

  return (
    <div
      data-testid="harvested-shelf-and-appraise-deck"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1.35fr) minmax(260px, 1fr)',
        gap: '12px',
        padding: '12px',
        borderRadius: 'var(--ui-radius, 4px)',
        border: '1px solid var(--ui-line, #353831)',
        background: 'var(--ui-inset, #232621)',
      }}
    >
      {/* Left Column: Lazy-Indexed 2,606 Harvested Presets + AI Beings Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Harvested Multiverse Shelf ({page.matchedCount} / {page.totalCatalogCount} Presets)
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              disabled={pageOffset <= 0}
              onClick={() => setPageOffset((o) => Math.max(0, o - pageSize))}
              style={{ padding: '2px 7px', fontSize: '10px', cursor: pageOffset > 0 ? 'pointer' : 'default' }}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={pageOffset + pageSize >= page.matchedCount}
              onClick={() => setPageOffset((o) => o + pageSize)}
              style={{ padding: '2px 7px', fontSize: '10px', cursor: pageOffset + pageSize < page.matchedCount ? 'pointer' : 'default' }}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <select
            aria-label="Filter by Harvested Category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as HarvestedCategory | 'all');
              setPageOffset(0);
            }}
            style={{ fontSize: '11px', padding: '3px 6px', background: 'var(--ui-panel)', color: 'var(--ui-ink)', border: '1px solid var(--ui-line)' }}
          >
            <option value="all">All Categories ({page.totalCatalogCount})</option>
            {HARVESTED_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({page.byCategory[cat]})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Source Game"
            value={sourceGame}
            onChange={(e) => {
              setSourceGame(e.target.value as HarvestedSourceGame | 'all');
              setPageOffset(0);
            }}
            style={{ fontSize: '11px', padding: '3px 6px', background: 'var(--ui-panel)', color: 'var(--ui-ink)', border: '1px solid var(--ui-line)' }}
          >
            <option value="all">All 8 Games</option>
            {HARVESTED_SOURCE_GAMES.map((g) => (
              <option key={g} value={g}>
                {g} ({page.byGame[g]})
              </option>
            ))}
          </select>

          <input
            type="search"
            placeholder="Search iron, thrust, recipe..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageOffset(0);
            }}
            style={{ flex: 1, minWidth: '110px', fontSize: '11px', padding: '3px 6px', background: 'var(--ui-panel)', color: 'var(--ui-ink)', border: '1px solid var(--ui-line)' }}
          />
        </div>

        {/* AI Beings Row (for Appraising Archetypes, Polarity & Body Zones) */}
        {props.aiBeings && props.aiBeings.length > 0 ? (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingBottom: '4px', borderBottom: '1px solid var(--ui-line)' }}>
            <span style={{ fontSize: '10px', color: 'var(--ui-dim)', alignSelf: 'center', marginRight: '4px' }}>
              Appraise AI Being:
            </span>
            {props.aiBeings.map((b) => {
              const isSelected = activeTarget?.kind === 'ai-being' && activeTarget.id === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onMouseEnter={() => setSelectedTarget(b)}
                  onClick={() => setSelectedTarget(b)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: 'var(--ui-radius, 2px)',
                    border: `1px solid ${isSelected ? 'var(--ui-accent)' : 'var(--ui-line)'}`,
                    background: isSelected ? 'var(--ui-accent)' : 'var(--ui-panel)',
                    color: isSelected ? 'var(--ui-accent-ink)' : 'var(--ui-ink)',
                    cursor: 'pointer',
                  }}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Lazy Page Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '6px' }}>
          {page.items.map((item) => {
            const isSelected = activeTarget?.kind === 'harvested' && activeTarget.entry.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setSelectedTarget({ kind: 'harvested', entry: item })}
                onClick={() => {
                  setSelectedTarget({ kind: 'harvested', entry: item });
                  props.onSelectPresetCode?.(item.id, item);
                }}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  borderRadius: 'var(--ui-radius, 2px)',
                  border: `1px solid ${isSelected ? 'var(--ui-accent)' : 'var(--ui-line)'}`,
                  background: isSelected ? 'var(--ui-hover, #2d312b)' : 'var(--ui-panel, #1b1d19)',
                  color: 'var(--ui-ink)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--ui-dim)' }}>
                  {item.sourceGame} · R{item.rung}
                </div>
                <div style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: 'var(--ui-accent)' }}>
                  {item.id}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: LitRPG Appraisal Lens (`APPRAISE_PANEL` via `UiPanelView`) */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--ui-radius, 4px)',
          border: '1px solid var(--ui-line)',
          background: 'var(--ui-panel, #1b1d19)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ui-line)', paddingBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ui-accent)' }}>
            LitRPG Appraisal Lens (<code>ui:appraise-panel</code>)
          </span>
          <span style={{ fontSize: '10px', color: 'var(--ui-dim)' }}>Hover any preset or being</span>
        </div>

        {activeTarget ? (
          <UiPanelView
            panel={APPRAISE_PANEL}
            sources={APPRAISE_SOURCES}
            values={values}
            actions={actions}
            meterMax={{
              'app-pxd': 100,
              'app-vtx': 100,
              'app-lx': 100,
              'app-aq': 100,
              'app-bal': 1,
            }}
          />
        ) : (
          <p style={{ fontSize: '11px', color: 'var(--ui-dim)' }}>Select or hover a preset to appraise its Four-Float composition.</p>
        )}

        {statusFeedback ? (
          <div style={{ fontSize: '10px', color: 'var(--ui-ok, #56b886)', fontFamily: 'ui-monospace, monospace' }}>
            {statusFeedback}
          </div>
        ) : null}
      </div>
    </div>
  );
}

