import type { CSSProperties, ReactElement } from 'react';
import { card, cards as cardGrid, chip, meta, panel, picker, search, tagChip, thumb } from './styles';
import type { Tier } from './BrushPanel';

export interface PresetCard {
  id: string;
  name: string;
  kind: string;
  tags: readonly string[];
  tier: Tier;
  thumb?: string;
}

export interface PresetFilter {
  text: string;
  kind: string | null;
  tag: string | null;
}

export interface PresetBrowserProps {
  cards: readonly PresetCard[];
  filter: PresetFilter;
  onFilter: (patch: Partial<PresetFilter>) => void;
  onPick: (id: string) => void;
  onFork?: (id: string) => void;
  tier: Tier;
}

const fork: CSSProperties = {
  ...chip,
  alignSelf: 'flex-start',
  color: 'var(--hm-accent, #ffd24a)',
  border: '1px solid var(--hm-accent, #ffd24a)',
};

const name: CSSProperties = { fontWeight: 600, overflowWrap: 'anywhere' };

const empty: CSSProperties = { fontSize: 13, color: 'var(--hm-dim, #8fa0b1)' };

export function filterPresets(cards: readonly PresetCard[], filter: PresetFilter): PresetCard[] {
  const words = filter.text.toLowerCase().split(/\s+/).filter((word) => word !== '');
  const kept = cards.filter((preset) => {
    if (filter.kind !== null && preset.kind !== filter.kind) return false;
    if (filter.tag !== null && !preset.tags.includes(filter.tag)) return false;
    const haystack = [
      preset.name.toLowerCase(),
      preset.kind.toLowerCase(),
      ...preset.tags.map((tag) => tag.toLowerCase()),
    ];
    return words.every((word) => haystack.some((entry) => entry.includes(word)));
  });
  return kept.sort((a, b) => a.name.localeCompare(b.name));
}

function hueOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 33 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

export function PresetBrowser(props: PresetBrowserProps): ReactElement {
  const shown = filterPresets(props.cards, props.filter);
  const kinds: string[] = [];
  for (const preset of props.cards) {
    if (!kinds.includes(preset.kind)) kinds.push(preset.kind);
  }
  const pill = (active: boolean): CSSProperties =>
    active ? { ...chip, color: 'var(--hm-accent, #ffd24a)', border: '1px solid var(--hm-accent, #ffd24a)' } : chip;

  return (
    <div data-kit="presets" style={panel}>
      <input
        type="search"
        data-field="search"
        placeholder="Search presets"
        aria-label="Search presets"
        value={props.filter.text}
        onChange={(event) => props.onFilter({ text: event.target.value })}
        style={search}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-kind=""
          aria-pressed={props.filter.kind === null}
          onClick={() => props.onFilter({ kind: null })}
          style={pill(props.filter.kind === null)}
        >
          All
        </button>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            data-kind={kind}
            aria-pressed={props.filter.kind === kind}
            onClick={() => props.onFilter({ kind })}
            style={pill(props.filter.kind === kind)}
          >
            {kind}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p role="status" style={empty}>
          No presets match
        </p>
      ) : (
        <div style={cardGrid}>
          {shown.map((preset) => (
            <article key={preset.id} data-id={preset.id} style={card}>
              <button
                type="button"
                title={preset.name}
                onClick={() => props.onPick(preset.id)}
                style={picker}
              >
                {preset.thumb ? (
                  <img alt="" src={preset.thumb} style={thumb} />
                ) : (
                  <span style={{ ...thumb, background: `hsl(${hueOf(preset.name)} 42% 44%)` }} />
                )}
                <span style={name}>{preset.name}</span>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {preset.tags.slice(0, 3).map((tag) => (
                    <span key={tag} style={tagChip}>
                      {tag}
                    </span>
                  ))}
                </span>
                <span style={meta}>{preset.kind}</span>
              </button>
              {props.onFork && props.tier !== 'play' ? (
                <button
                  type="button"
                  data-action="fork"
                  title={`Fork ${preset.name}`}
                  onClick={() => props.onFork?.(preset.id)}
                  style={fork}
                >
                  Fork
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
