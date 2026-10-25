// ============================================================================
// File: apps/web/src/shell/community.tsx
// Spec D (MENU-02 / DEC-12 / TICKET-08a):
// Canonical Dark-Glassmorphic FIDELITY Community Nexus.
// Four canon tabs:
// 1. Enclave Branches: Browse and sync community-voted planetary plots
// 2. Cartridges (.smx): Download and share custom @hm/texgraph terrain & biome cartridges
// 3. Outpost Blueprints: Share modular Sheet 13 base layouts & machine arrays
// 4. Workshop Models & Monsters: Import and share custom .glb props and S-Space monster splices
// ============================================================================

import { useState, useMemo, type ReactElement } from 'react';
import type { Profile } from './profile';
import { generateProceduralSvgSwatch } from '@hm/ui';
import './community.css';

export type NexusTab = 'enclaves' | 'cartridges' | 'blueprints' | 'workshop';

export interface EnclaveBranchListing {
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly stage: number;
  readonly plotCode: string;
  readonly machines: number;
  readonly consensusPct: number;
  readonly description: string;
  readonly tags: readonly string[];
}

export interface CartridgeListing {
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly palette: readonly [string, string, string];
  readonly pattern: 'grain' | 'strata' | 'facets' | 'moss';
  readonly price: number;
  readonly description: string;
  readonly category: 'TERRAIN' | 'CRYSTAL' | 'FLORA' | 'ROAD';
}

export interface BlueprintListing {
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly partCount: number;
  readonly powerDemandKw: number;
  readonly price: number;
  readonly description: string;
  readonly footprint: string;
}

export interface WorkshopListing {
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly kind: 'prop' | 'monster' | 'kit';
  readonly triangles: number;
  readonly price: number;
  readonly description: string;
}

const ENCLAVE_BRANCHES: readonly EnclaveBranchListing[] = [
  {
    id: 'enc-1',
    name: 'Sector 4 Hydroponic Bastion',
    author: 'Piskriek',
    stage: 4,
    plotCode: 'PLT-SEC4-H7K9-WTR',
    machines: 8,
    consensusPct: 92,
    description: 'Fully automated biosphere enclave featuring dual Heavy Water Makers, 4 Light Projectors, and fortified foundation walls.',
    tags: ['Water', 'Stage 4', 'Base'],
  },
  {
    id: 'enc-2',
    name: 'Mare Crisium Solar Array',
    author: 'Gwen_Haddy',
    stage: 3,
    plotCode: 'PLT-SOL-99X2-ENG',
    machines: 12,
    consensusPct: 88,
    description: 'High-density Power Unit array and Relay Pylon web designed to power distant radar and laser drill networks.',
    tags: ['Power', 'Stage 3', 'Energy'],
  },
  {
    id: 'enc-3',
    name: 'EGA Low-Poly Redoubt',
    author: 'RetroPilot',
    stage: 1,
    plotCode: 'PLT-EGA-01A4-FAC',
    machines: 3,
    consensusPct: 65,
    description: 'Minimalist flat-shaded Stage 1 outpost optimized for calculator hardware and 60 fps on ultra-low-spec rigs.',
    tags: ['EGA', 'Stage 1', 'Potato'],
  },
  {
    id: 'enc-4',
    name: 'Twin Gate Staging Outpost',
    author: 'Francois',
    stage: 2,
    plotCode: 'PLT-GATE-TWIN-REC',
    machines: 6,
    consensusPct: 78,
    description: 'Beachhead perimeter surrounding the Moon Twin Gate with vehicle fabricator, shelter, and battery buffer.',
    tags: ['Beachhead', 'Stage 2', 'Gate'],
  },
];

const CARTRIDGE_LISTINGS: readonly CartridgeListing[] = [
  {
    id: 'cart-1',
    name: 'Emerald Turf',
    author: 'FloraCore',
    palette: ['#1e3a1e', '#2d5a27', '#7cff4d'],
    pattern: 'moss',
    price: 0,
    description: 'Vibrant Stage 4 engineered clover and bio-moss substrate for terraformed soil plots.',
    category: 'FLORA',
  },
  {
    id: 'cart-2',
    name: 'Basalt Strata',
    author: 'GeoSynth',
    palette: ['#12161f', '#242b38', '#455168'],
    pattern: 'strata',
    price: 25,
    description: 'Tiered volcanic slate with deep normal fissures and metallic silicate veins.',
    category: 'TERRAIN',
  },
  {
    id: 'cart-3',
    name: 'Prismatic Quartz',
    author: 'OpticMesh',
    palette: ['#2a1438', '#6a2c91', '#ff3d8a'],
    pattern: 'facets',
    price: 40,
    description: 'Faceted crystal substrate that refracts light and triggers resonance near beam towers.',
    category: 'CRYSTAL',
  },
  {
    id: 'cart-4',
    name: 'Lunar Ochre Regolith',
    author: 'Argo',
    palette: ['#30261a', '#6b583e', '#ffc13d'],
    pattern: 'grain',
    price: 0,
    description: 'Canonical golden regolith dust from the Sea of Tranquility with subtle dither relief.',
    category: 'TERRAIN',
  },
  {
    id: 'cart-5',
    name: 'Hydro Aquifer Sand',
    author: 'AquiferLab',
    palette: ['#0f2b38', '#1a546d', '#3dc8ff'],
    pattern: 'grain',
    price: 30,
    description: 'Moisture-saturated beach sand that encourages pooling water and algae bloom.',
    category: 'TERRAIN',
  },
];

const BLUEPRINT_LISTINGS: readonly BlueprintListing[] = [
  {
    id: 'bp-1',
    name: 'Industrial Smelting Quad',
    author: 'IronWorks',
    partCount: 24,
    powerDemandKw: 18.5,
    price: 50,
    description: 'Four Texture Mills and two Shape Presses arranged around a central power pylon with step-up ramps.',
    footprint: '8m x 12m',
  },
  {
    id: 'bp-2',
    name: 'Fortified Gate Bastion',
    author: 'DefenseArch',
    partCount: 36,
    powerDemandKw: 8.0,
    price: 75,
    description: 'Perimeter ring of gunmetal Sheet 13 walls, window observation ports, and doorway airlock.',
    footprint: '16m x 16m',
  },
  {
    id: 'bp-3',
    name: 'Compact Rover Depot',
    author: 'TrackMaster',
    partCount: 16,
    powerDemandKw: 6.0,
    price: 20,
    description: 'Vehicle Fabricator pad flanked by repair gantry, tool rack, and dual battery cells.',
    footprint: '8m x 8m',
  },
];

const WORKSHOP_LISTINGS: readonly WorkshopListing[] = [
  {
    id: 'ws-1',
    name: 'Glitch Rift Sapper',
    author: 'S-Space Splice',
    kind: 'monster',
    triangles: 1420,
    price: 0,
    description: 'Horizontally scanline-sliced S-Space rift entity in dark obsidian with cyan telemetry veins.',
  },
  {
    id: 'ws-2',
    name: 'Heavy Drill Chassis Mk II',
    author: 'ToolForge',
    kind: 'kit',
    triangles: 2850,
    price: 45,
    description: 'Upgraded Rock Drill assembly with dual radiator stacks and rear conveyor feed hopper.',
  },
  {
    id: 'ws-3',
    name: 'Solar Transponder Tower',
    author: 'Telecom',
    kind: 'prop',
    triangles: 890,
    price: 15,
    description: 'High-gain dish beacon prop with blinking warning strobe and amber telemetry display.',
  },
];

/** Compatibility export for shell.tsx */
export const COMMUNITY_ISLANDS: readonly { readonly id: string; readonly name: string; readonly template: string; readonly by: string }[] = [
  { id: 'community-l4', name: 'Crystal island', template: 'floating-rocks', by: 'Grizzle' },
];

export interface CommunityProps {
  readonly profile: Profile;
  readonly onCredits: (delta: number) => void;
  readonly onDialCode?: (code: string) => void;
}

export function Community({ profile, onCredits, onDialCode }: CommunityProps): ReactElement {
  const [activeTab, setActiveTab] = useState<NexusTab>('enclaves');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [installedItems, setInstalledItems] = useState<ReadonlySet<string>>(new Set());

  const handleCopyCode = (id: string, code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2500);
  };

  const handleInstall = (id: string, price: number) => {
    if (installedItems.has(id)) return;
    if (price > 0) {
      if (profile.credits < price) return;
      onCredits(-price);
    }
    setInstalledItems((prev) => new Set(prev).add(id));
  };

  const q = search.trim().toLowerCase();

  const filteredEnclaves = useMemo(() => {
    return ENCLAVE_BRANCHES.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.author.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [q]);

  const filteredCartridges = useMemo(() => {
    return CARTRIDGE_LISTINGS.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.author.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredBlueprints = useMemo(() => {
    return BLUEPRINT_LISTINGS.filter(
      (b) => !q || b.name.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredWorkshop = useMemo(() => {
    return WORKSHOP_LISTINGS.filter(
      (w) => !q || w.name.toLowerCase().includes(q) || w.author.toLowerCase().includes(q) || w.kind.toLowerCase().includes(q)
    );
  }, [q]);

  return (
    <div className="nexus-container" role="region" aria-label="Community Nexus">
      {/* Nexus Header Navigation & Search Bar */}
      <div className="nexus-header-row">
        <nav className="nexus-tabs" aria-label="Community Nexus categories">
          <button
            type="button"
            className={`nexus-tab-btn ${activeTab === 'enclaves' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('enclaves')}
          >
            Enclave Branches
          </button>
          <button
            type="button"
            className={`nexus-tab-btn ${activeTab === 'cartridges' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('cartridges')}
          >
            Cartridges (.smx)
          </button>
          <button
            type="button"
            className={`nexus-tab-btn ${activeTab === 'blueprints' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('blueprints')}
          >
            Outpost Blueprints
          </button>
          <button
            type="button"
            className={`nexus-tab-btn ${activeTab === 'workshop' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('workshop')}
          >
            Workshop &amp; Monsters
          </button>
        </nav>

        <div className="nexus-search-box">
          <input
            type="text"
            className="nexus-search-input"
            placeholder="Search nexus entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Tab 1: Enclave Branches */}
      {activeTab === 'enclaves' && (
        <div className="nexus-cards-grid" role="tabpanel" aria-label="Enclave Branches">
          {filteredEnclaves.map((e) => (
            <article key={e.id} className="nexus-card">
              <div className="nexus-card-top">
                <div className="nexus-card-thumb">
                  <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="#3dc8ff" strokeWidth="1.5" strokeDasharray="3 3" />
                    <polygon points="24,8 38,16 38,32 24,40 10,32 10,16" fill="rgba(61, 200, 255, 0.15)" stroke="#3dc8ff" strokeWidth="2" />
                    <circle cx="24" cy="24" r="4" fill="#7cff4d" />
                  </svg>
                </div>
                <div className="nexus-card-info">
                  <div className="nexus-card-title-row">
                    <h4 className="nexus-card-title">{e.name}</h4>
                    <span className={`nexus-badge stage-${e.stage}`}>Stage {e.stage}</span>
                  </div>
                  <p className="nexus-card-by">by {e.author}</p>
                </div>
              </div>

              <p className="nexus-card-desc">{e.description}</p>

              <div className="nexus-telemetry-row">
                <span>Consensus: <b>{e.consensusPct}%</b></span>
                <span>Machines: <b>{e.machines}</b></span>
                <code>{e.plotCode}</code>
              </div>

              <div className="nexus-card-footer">
                <button
                  type="button"
                  className="nexus-btn secondary"
                  onClick={() => handleCopyCode(e.id, e.plotCode)}
                >
                  {copiedId === e.id ? 'Copied Code!' : 'Copy Code'}
                </button>
                {onDialCode ? (
                  <button
                    type="button"
                    className="nexus-btn primary"
                    onClick={() => onDialCode(e.plotCode)}
                  >
                    Dial Gate &rarr;
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Tab 2: Cartridges (.smx) */}
      {activeTab === 'cartridges' && (
        <div className="nexus-cards-grid" role="tabpanel" aria-label="Cartridges">
          {filteredCartridges.map((c) => {
            const swatchUrl = generateProceduralSvgSwatch({
              baseColor: c.palette[0],
              hiColor: c.palette[1],
              loColor: c.palette[0],
              accentColor: c.palette[2],
              pattern: c.pattern,
            });
            const owned = installedItems.has(c.id);
            return (
              <article key={c.id} className="nexus-card">
                <div className="nexus-card-top">
                  <div className="nexus-card-thumb">
                    <img src={swatchUrl} alt={c.name} />
                  </div>
                  <div className="nexus-card-info">
                    <div className="nexus-card-title-row">
                      <h4 className="nexus-card-title">{c.name}</h4>
                      <span className="nexus-badge stage-2">{c.category}</span>
                    </div>
                    <p className="nexus-card-by">by {c.author}</p>
                  </div>
                </div>

                <p className="nexus-card-desc">{c.description}</p>

                <div className="nexus-telemetry-row">
                  <span>Pattern: <b>{c.pattern.toUpperCase()}</b></span>
                  <span>Format: <b>.SMX CARTRIDGE</b></span>
                </div>

                <div className="nexus-card-footer">
                  <span className="nexus-price">{c.price === 0 ? 'FREE' : `${c.price} cr`}</span>
                  <button
                    type="button"
                    className={`nexus-btn ${owned ? 'secondary' : 'primary'}`}
                    disabled={owned || (c.price > 0 && profile.credits < c.price)}
                    onClick={() => handleInstall(c.id, c.price)}
                  >
                    {owned ? 'In Bandolier' : c.price === 0 ? 'Burn Cartridge' : `Buy (${c.price} cr)`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Tab 3: Outpost Blueprints */}
      {activeTab === 'blueprints' && (
        <div className="nexus-cards-grid" role="tabpanel" aria-label="Outpost Blueprints">
          {filteredBlueprints.map((b) => {
            const owned = installedItems.has(b.id);
            return (
              <article key={b.id} className="nexus-card">
                <div className="nexus-card-top">
                  <div className="nexus-card-thumb">
                    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                      <rect x="8" y="8" width="32" height="32" rx="4" fill="rgba(255, 193, 61, 0.12)" stroke="#ffc13d" strokeWidth="1.5" />
                      <line x1="16" y1="8" x2="16" y2="40" stroke="rgba(255, 193, 61, 0.3)" strokeDasharray="2 2" />
                      <line x1="32" y1="8" x2="32" y2="40" stroke="rgba(255, 193, 61, 0.3)" strokeDasharray="2 2" />
                      <line x1="8" y1="24" x2="40" y2="24" stroke="rgba(255, 193, 61, 0.3)" strokeDasharray="2 2" />
                    </svg>
                  </div>
                  <div className="nexus-card-info">
                    <div className="nexus-card-title-row">
                      <h4 className="nexus-card-title">{b.name}</h4>
                      <span className="nexus-badge stage-3">{b.footprint}</span>
                    </div>
                    <p className="nexus-card-by">by {b.author}</p>
                  </div>
                </div>

                <p className="nexus-card-desc">{b.description}</p>

                <div className="nexus-telemetry-row">
                  <span>Parts: <b>{b.partCount}</b></span>
                  <span>Power: <b>{b.powerDemandKw} kW</b></span>
                </div>

                <div className="nexus-card-footer">
                  <span className="nexus-price">{b.price === 0 ? 'FREE' : `${b.price} cr`}</span>
                  <button
                    type="button"
                    className={`nexus-btn ${owned ? 'secondary' : 'primary'}`}
                    disabled={owned || (b.price > 0 && profile.credits < b.price)}
                    onClick={() => handleInstall(b.id, b.price)}
                  >
                    {owned ? 'In Blueprint Rack' : b.price === 0 ? 'Download Blueprint' : `Buy (${b.price} cr)`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Tab 4: Workshop Models & Monsters */}
      {activeTab === 'workshop' && (
        <div className="nexus-cards-grid" role="tabpanel" aria-label="Workshop Models and Monsters">
          {filteredWorkshop.map((w) => {
            const owned = installedItems.has(w.id);
            return (
              <article key={w.id} className="nexus-card">
                <div className="nexus-card-top">
                  <div className="nexus-card-thumb">
                    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                      <polygon points="24,6 42,16 42,36 24,44 6,36 6,16" fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" strokeWidth="1.5" />
                      <circle cx="24" cy="24" r="6" fill="#a855f7" opacity="0.6" />
                    </svg>
                  </div>
                  <div className="nexus-card-info">
                    <div className="nexus-card-title-row">
                      <h4 className="nexus-card-title">{w.name}</h4>
                      <span className="nexus-badge stage-4">{w.kind}</span>
                    </div>
                    <p className="nexus-card-by">by {w.author}</p>
                  </div>
                </div>

                <p className="nexus-card-desc">{w.description}</p>

                <div className="nexus-telemetry-row">
                  <span>Geometry: <b>{w.triangles} Tris</b></span>
                  <span>Source: <b>@hm/meshops</b></span>
                </div>

                <div className="nexus-card-footer">
                  <span className="nexus-price">{w.price === 0 ? 'FREE' : `${w.price} cr`}</span>
                  <button
                    type="button"
                    className={`nexus-btn ${owned ? 'secondary' : 'primary'}`}
                    disabled={owned || (w.price > 0 && profile.credits < w.price)}
                    onClick={() => handleInstall(w.id, w.price)}
                  >
                    {owned ? 'Imported to Studio' : w.price === 0 ? 'Import Model' : `Buy (${w.price} cr)`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="nexus-banner-note">
        Community Nexus operates via local device cache and simulated peer consensus. In-game credits are earned purely through gameplay progression, never real currency.
      </p>
    </div>
  );
}

export default Community;
