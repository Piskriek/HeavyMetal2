import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { deviceFor, type DeviceProfile, type Stage } from '@hm/fidelity';
import { VAULT, VAULT_BY_ID } from '@hm/vault';
import {
  Globe,
  Moon,
  Layers,
  Share2,
  Play,
  Check,
  Copy,
  Sparkles,
  Cpu,
  Compass,
  Car,
  Swords,
  TreePine,
  Boxes,
  FileCode2,
  ArrowLeft,
  Radio,
  Zap,
  Sliders,
} from 'lucide-react';
import { FidelityLogo } from '../shell/fidelity-logo';
import { makeActivity, type Profile } from '../shell/profile';
import { bakeLookCached, type StageLook } from '../crafter/looks';
import { createMoonScene, type MoonScene } from '../crafter/moon-scene';
import { STAGE_NAMES } from '../crafter/progress';
import './studio-screen.css';

export interface StudioScreenProps {
  readonly profile: Profile;
  readonly onBack: () => void;
  readonly onUpdateProfile?: (fn: (p: Profile) => Profile) => void;
  readonly onPlayPlanet?: (activityId: string) => void;
  readonly onPlayCampaign?: () => void;
}

export type StudioTab = 'moon' | 'forge';

export interface PlanetPreset {
  readonly id: string;
  readonly name: string;
  readonly sector: string;
  readonly lore: string;
  readonly hue: number;
  readonly ring: 'none' | 'thin' | 'dense' | 'dual';
  readonly gravity: number;
  readonly biome: 'basalt' | 'foliage' | 'coral' | 'spore' | 'crystal' | 'regolith';
  readonly defaultGame: 'rover' | 'combat' | 'terraforming' | 'expedition' | 'sandbox';
  readonly icon: string;
  readonly bgGradient: string;
}

export const PLANET_PRESETS: readonly PlanetPreset[] = [
  {
    id: 'volcano',
    name: 'Ignis-IV Caldera',
    sector: 'MANTLE-RIFT // 04',
    lore: 'Active basalt calderas and glowing magma rivers under dense sulfur haze. High surface gravity.',
    hue: 18,
    ring: 'dense',
    gravity: 1.6,
    biome: 'basalt',
    defaultGame: 'rover',
    icon: 'flame',
    bgGradient: 'radial-gradient(circle at 35% 35%, #ff5722 0%, #b71c1c 55%, #3e0c0c 100%)',
  },
  {
    id: 'emerald',
    name: 'Verdant-Prime Canopy',
    sector: 'BIO-ZONE // 08',
    lore: 'Bioluminescent colossal root system and high-oxygen troposphere. Floating spore canopies.',
    hue: 140,
    ring: 'none',
    gravity: 0.7,
    biome: 'foliage',
    defaultGame: 'expedition',
    icon: 'treepine',
    bgGradient: 'radial-gradient(circle at 35% 35%, #00e676 0%, #00796b 55%, #00251a 100%)',
  },
  {
    id: 'coral',
    name: 'Thalassa-Atoll Basin',
    sector: 'AQUIFER-DEPTHS // 12',
    lore: 'Cyan shallow oceans, crystalline atolls, and silicate dunes. Standard planetary gravity.',
    hue: 195,
    ring: 'thin',
    gravity: 1.0,
    biome: 'coral',
    defaultGame: 'rover',
    icon: 'droplets',
    bgGradient: 'radial-gradient(circle at 35% 35%, #00e5ff 0%, #0097a7 55%, #00363a 100%)',
  },
  {
    id: 'spore',
    name: 'Myco-VI Steppe',
    sector: 'FUNGAL-HORIZON // 19',
    lore: 'Giant fungal ridges with drifting spore clouds in violet twilight. Hostile bio-anomalies detected.',
    hue: 275,
    ring: 'dual',
    gravity: 0.5,
    biome: 'spore',
    defaultGame: 'combat',
    icon: 'swords',
    bgGradient: 'radial-gradient(circle at 35% 35%, #b388ff 0%, #512da8 55%, #1f0b4d 100%)',
  },
  {
    id: 'prismata',
    name: 'Lumen-IX Flats',
    sector: 'CRYSTAL-EXPANSE // 22',
    lore: 'Mirrored crystalline plains and vacuum flats. Refracted solar glare and zero wind resistance.',
    hue: 45,
    ring: 'dual',
    gravity: 1.0,
    biome: 'crystal',
    defaultGame: 'terraforming',
    icon: 'zap',
    bgGradient: 'radial-gradient(circle at 35% 35%, #ffd700 0%, #ff8f00 55%, #3e2723 100%)',
  },
  {
    id: 'lunar',
    name: 'Selene Outpost',
    sector: 'LUNAR-MANTLE // 01',
    lore: 'Barren vacuum regolith, impact craters, and low lunar gravity. Ideal for bridge relay construction.',
    hue: 215,
    ring: 'none',
    gravity: 0.16,
    biome: 'regolith',
    defaultGame: 'sandbox',
    icon: 'moon',
    bgGradient: 'radial-gradient(circle at 35% 35%, #cfd8dc 0%, #546e7a 55%, #1a2327 100%)',
  },
];

export const GAME_TYPES = [
  {
    id: 'rover',
    title: 'Rover Circuit & Hazard Rally',
    desc: 'High-speed planetary checkpoints, jump ramps, boost gates, and obstacle courses.',
    icon: Car,
  },
  {
    id: 'combat',
    title: 'Daemon Containment (Monster Mash)',
    desc: 'Hostile daemon survival arena, weapon drops (shotgun/rifle), and wave containment.',
    icon: Swords,
  },
  {
    id: 'terraforming',
    title: 'Atmospheric Terraforming Rally',
    desc: 'Deploy atmospheric pylons, restore machines, and climb fidelity stages S0 to S6.',
    icon: TreePine,
  },
  {
    id: 'expedition',
    title: 'Open Expedition & Node Harvest',
    desc: 'Harvest raw pixels and vertex nodes across procedural anomalies and uncharted terrain.',
    icon: Compass,
  },
  {
    id: 'sandbox',
    title: 'Quantum Bridge Sandbox',
    desc: 'Freeform base construction with linked quantum bridge storage and fabricators.',
    icon: Boxes,
  },
] as const;

export function StudioScreen(props: StudioScreenProps): ReactElement {
  const [activeTab, setActiveTab] = useState<StudioTab>('moon');

  // ---- 1. MOON BASE GAME EDITOR STATE ----
  const [moonStage, setMoonStage] = useState<Stage>(3);
  const [moonCartridge, setMoonCartridge] = useState<string>('lunar_anorthosite');
  const [craterDepth, setCraterDepth] = useState<number>(5.0);
  const [craterRadius, setCraterRadius] = useState<number>(26.0);
  const [peakHeight, setPeakHeight] = useState<number>(7.4);
  const [pylonDensity, setPylonDensity] = useState<number>(1.2);
  const [replicatorYield, setReplicatorYield] = useState<number>(1.5);
  const [quantumBandwidth, setQuantumBandwidth] = useState<number>(40);
  const [diffModalOpen, setDiffModalOpen] = useState<boolean>(false);
  const [patchCopied, setPatchCopied] = useState<boolean>(false);
  const [patchSubmitted, setPatchSubmitted] = useState<boolean>(false);

  // ---- 2. PLANET FORGE STATE ----
  const [selectedPreset, setSelectedPreset] = useState<PlanetPreset>(PLANET_PRESETS[0]!);
  const [planetName, setPlanetName] = useState<string>(PLANET_PRESETS[0]!.name);
  const [planetLore, setPlanetLore] = useState<string>(PLANET_PRESETS[0]!.lore);
  const [planetHue, setPlanetHue] = useState<number>(PLANET_PRESETS[0]!.hue);
  const [planetRing, setPlanetRing] = useState<'none' | 'thin' | 'dense' | 'dual'>(PLANET_PRESETS[0]!.ring);
  const [planetGravity, setPlanetGravity] = useState<number>(PLANET_PRESETS[0]!.gravity);
  const [planetBiome, setPlanetBiome] = useState<string>(PLANET_PRESETS[0]!.biome);
  const [gameMode, setGameMode] = useState<'rover' | 'combat' | 'terraforming' | 'expedition' | 'sandbox'>(
    PLANET_PRESETS[0]!.defaultGame
  );
  const [lapsCount, setLapsCount] = useState<number>(3);
  const [threatLevel, setThreatLevel] = useState<'safe' | 'moderate' | 'severe' | 'nightmare'>('moderate');
  const [sharedGridSync, setSharedGridSync] = useState<boolean>(true);
  const [vehicleType, setVehicleType] = useState<'none' | 'buggy' | 'heavy' | 'skimmer'>('buggy');
  const [publishModalOpen, setPublishModalOpen] = useState<boolean>(false);
  const [publishedCode, setPublishedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  // 3D Canvas Viewport for Moon Editor
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MoonScene | null>(null);

  const device: DeviceProfile = useMemo(() => deviceFor('high'), []);
  const gridSpacing = 0.5;

  const currentLook = useMemo<StageLook>(() => {
    const cart = VAULT_BY_ID.get(moonCartridge) ?? VAULT[0]!;
    return bakeLookCached(cart, moonStage, device, gridSpacing);
  }, [moonCartridge, moonStage, device, gridSpacing]);

  // Init Moon 3D Viewport when in Moon mode
  useEffect(() => {
    if (activeTab !== 'moon') {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let scene: MoonScene;
    try {
      scene = createMoonScene({
        canvas,
        gridSpacing,
        antialias: true,
        powerPreference: 'high-performance',
        reducedMotion: false,
      });
      sceneRef.current = scene;
    } catch {
      return undefined;
    }

    const size = (): void => {
      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 500;
      scene.resize(w, h, window.devicePixelRatio || 1, 0);
    };
    size();
    window.addEventListener('resize', size);

    scene.show(currentLook);

    let raf = 0;
    let last = performance.now();
    const loop = (nowMs: number): void => {
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      scene.frame(nowMs / 1000, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [activeTab, gridSpacing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update Moon viewport when stage or cartridge changes
  useEffect(() => {
    if (activeTab === 'moon' && sceneRef.current) {
      sceneRef.current.show(currentLook);
    }
  }, [activeTab, currentLook]);

  // Switch Preset Handler
  const handleSelectPreset = useCallback((preset: PlanetPreset) => {
    setSelectedPreset(preset);
    setPlanetName(preset.name);
    setPlanetLore(preset.lore);
    setPlanetHue(preset.hue);
    setPlanetRing(preset.ring);
    setPlanetGravity(preset.gravity);
    setPlanetBiome(preset.biome);
    setGameMode(preset.defaultGame);
  }, []);

  // Keyboard navigation: Escape closes modal or backs out
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (diffModalOpen) {
          setDiffModalOpen(false);
        } else if (publishModalOpen) {
          setPublishModalOpen(false);
        } else {
          props.onBack();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [diffModalOpen, publishModalOpen, props]);

  // Weekly update patch payload
  const generatedPatch = useMemo(() => {
    const patchId = `PATCH-MOON-2026-W41-${Math.abs((craterRadius * 137 + peakHeight * 53) | 0).toString(16).toUpperCase()}`;
    return {
      patchId,
      targetSector: 'LUNAR-CRATER-001',
      author: props.profile.name || 'Pioneer',
      timestamp: new Date().toISOString(),
      substrate: {
        cartridgeId: moonCartridge,
        cartridgeName: VAULT_BY_ID.get(moonCartridge)?.name ?? 'Lunar Regolith',
        simulationStage: moonStage,
        craterRadiusM: craterRadius,
        craterDepthM: craterDepth,
        centralPeakHeightM: peakHeight,
        pylonDensityGrid: pylonDensity,
        matterReplicatorYield: replicatorYield,
        quantumRelayBandwidthGbps: quantumBandwidth,
      },
      status: 'QUEUED_FOR_WEEKLY_CONSENSUS',
      signature: `sha256:${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    };
  }, [moonCartridge, moonStage, craterRadius, craterDepth, peakHeight, pylonDensity, replicatorYield, quantumBandwidth, props.profile.name]);

  // Handle Publish to Multiverse
  const handlePublishPlanet = useCallback(() => {
    const cleanName = planetName.trim() || 'Custom Planet';
    const cleanLore = planetLore.trim() || `Activity planet in the SetMix Multiverse.`;
    const regCode = `SMX-PLN-${Math.floor(1000 + Math.random() * 9000)}-${cleanName.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X')}`;

    if (props.onUpdateProfile) {
      props.onUpdateProfile((pr) =>
        makeActivity(pr, {
          name: cleanName,
          doc: cleanLore,
          planet: { hue: planetHue, ring: planetRing !== 'none' },
        })
      );
    }

    setPublishedCode(regCode);
    setPublishModalOpen(true);
  }, [planetName, planetLore, planetHue, planetRing, props]);

  return (
    <div className="studio-root" role="main" aria-label="FIDELITY Studio Creative Suite">
      {/* 1. TOP HEADER & NAVIGATION */}
      <header className="studio-topbar">
        <div className="studio-brand-lockup">
          <FidelityLogo size={34} glow />
          <div className="studio-title-group">
            <span className="studio-app-title">FIDELITY STUDIO</span>
            <span className="studio-sub-badge">SETMIX MULTIVERSE SUITE</span>
          </div>
        </div>

        {/* Studio Center Mode Switcher */}
        <nav className="studio-tab-switcher" role="tablist" aria-label="Studio Modes">
          <button
            role="tab"
            aria-selected={activeTab === 'moon'}
            className={`studio-tab-btn ${activeTab === 'moon' ? 'active' : ''}`}
            onClick={() => setActiveTab('moon')}
          >
            <Moon size={15} />
            <span>Moon Base Game</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'forge'}
            className={`studio-tab-btn ${activeTab === 'forge' ? 'active' : ''}`}
            onClick={() => setActiveTab('forge')}
          >
            <Globe size={15} />
            <span>Planet Forge</span>
          </button>
        </nav>

        {/* Top Right Action Suite */}
        <div className="studio-top-actions">
          {activeTab === 'moon' ? (
            <>
              <button
                className="studio-btn primary"
                onClick={() => setDiffModalOpen(true)}
                title="Generate authenticated patch for the weekly base game update"
              >
                <FileCode2 size={14} />
                <span>Submit Weekly Patch</span>
              </button>
              {props.onPlayCampaign ? (
                <button
                  className="studio-btn subtle"
                  onClick={props.onPlayCampaign}
                  title="Test lunar sector modifications in campaign"
                >
                  <Play size={14} />
                  <span>Test in Campaign</span>
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                className="studio-btn primary"
                onClick={handlePublishPlanet}
                title="Publish activity planet to the SetMix Multiverse"
              >
                <Share2 size={14} />
                <span>Publish to Multiverse</span>
              </button>
            </>
          )}

          <button className="studio-btn exit" onClick={props.onBack}>
            <ArrowLeft size={14} />
            <span>Back to FIDELITY</span>
          </button>
        </div>
      </header>

      {/* 2. BODY CONTENT: MOON SUBSTRATE EDITOR */}
      {activeTab === 'moon' ? (
        <div className="studio-body moon-layout">
          {/* Main 3D Moon Surface Viewport */}
          <main className="studio-viewport-area">
            <canvas ref={canvasRef} className="studio-moon-canvas" aria-label="Interactive 3D Moon Viewport" />

            {/* Viewport HUD Overlays */}
            <div className="studio-viewport-hud top">
              <div className="hud-badge sector">
                <span className="dot pulse" />
                <span>SUBSTRATE SECTOR: LUNAR-CRATER-001</span>
              </div>
              <div className="hud-badge status">
                <span>STAGE {moonStage} // {STAGE_NAMES[moonStage]}</span>
              </div>
            </div>

            <div className="studio-viewport-hud bottom">
              <p className="viewport-hint">
                Drag mouse to orbit lunar terrain // Mouse wheel to zoom // Changes bake in real-time
              </p>
            </div>

            {/* Stage Scrub Bar Overlay */}
            <div className="studio-stage-scrubber" aria-label="Simulation Stage Simulator">
              <div className="scrubber-header">
                <span className="label">Fidelity Progression Simulator:</span>
                <span className="current">Stage {moonStage}: {STAGE_NAMES[moonStage]}</span>
              </div>
              <div className="stage-pills" role="radiogroup" aria-label="Stages">
                {([1, 2, 3, 4, 5, 6] as const).map((s) => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={moonStage === s}
                    className={`stage-pill ${moonStage === s ? 'active' : ''} ${s <= moonStage ? 'passed' : ''}`}
                    onClick={() => setMoonStage(s)}
                  >
                    <span className="num">S{s}</span>
                    <span className="name">{STAGE_NAMES[s]}</span>
                  </button>
                ))}
              </div>
            </div>
          </main>

          {/* Right Substrate Inspector & Machinery Controls */}
          <aside className="studio-inspector-panel">
            <div className="inspector-scroll">
              {/* Geological Cartridge Slotting */}
              <section className="inspector-section">
                <div className="section-title">
                  <Layers size={14} />
                  <span>Geological Cartridge (Mantle Substrate)</span>
                </div>
                <div className="cartridge-grid">
                  {VAULT.filter((c) => c.category === 'TERRAIN' || c.category === 'CRYSTAL')
                    .slice(0, 8)
                    .map((cart) => (
                      <button
                        key={cart.id}
                        className={`cartridge-card ${moonCartridge === cart.id ? 'active' : ''}`}
                        onClick={() => setMoonCartridge(cart.id)}
                      >
                        <span className="cartridge-swatch" style={{ background: cart.tint }} />
                        <div className="cartridge-meta">
                          <span className="name">{cart.name}</span>
                          <span className="tier">Tier {cart.tier} // {cart.category}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </section>

              {/* Terrain & Crater Elevation Tuning */}
              <section className="inspector-section">
                <div className="section-title">
                  <Sliders size={14} />
                  <span>Topological & Elevation Tuning</span>
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Main Crater Radius</span>
                    <span className="slider-val">{craterRadius.toFixed(1)}m</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="42"
                    step="0.5"
                    value={craterRadius}
                    onChange={(e) => setCraterRadius(parseFloat(e.target.value))}
                  />
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Crater Floor Depth</span>
                    <span className="slider-val">{craterDepth.toFixed(1)}m</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="12"
                    step="0.2"
                    value={craterDepth}
                    onChange={(e) => setCraterDepth(parseFloat(e.target.value))}
                  />
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Central Peak Elevation</span>
                    <span className="slider-val">{peakHeight.toFixed(1)}m</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="16"
                    step="0.2"
                    value={peakHeight}
                    onChange={(e) => setPeakHeight(parseFloat(e.target.value))}
                  />
                </div>
              </section>

              {/* Machinery & Grid Infrastructure */}
              <section className="inspector-section">
                <div className="section-title">
                  <Cpu size={14} />
                  <span>Substrate Machinery Grid</span>
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Atmospheric Pylon Grid Density</span>
                    <span className="slider-val">{pylonDensity.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={pylonDensity}
                    onChange={(e) => setPylonDensity(parseFloat(e.target.value))}
                  />
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Matter Replicator Node Yield</span>
                    <span className="slider-val">{replicatorYield.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="4.0"
                    step="0.25"
                    value={replicatorYield}
                    onChange={(e) => setReplicatorYield(parseFloat(e.target.value))}
                  />
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Quantum Bridge Bandwidth</span>
                    <span className="slider-val">{quantumBandwidth} Gbps</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={quantumBandwidth}
                    onChange={(e) => setQuantumBandwidth(parseInt(e.target.value, 10))}
                  />
                </div>
              </section>

              {/* Live Substrate Telemetry Card */}
              <section className="inspector-section telemetry-card">
                <div className="section-title">
                  <Radio size={14} />
                  <span>Substrate Coherence Telemetry</span>
                </div>
                <div className="telemetry-grid">
                  <div className="telemetry-item">
                    <span className="key">Resolution:</span>
                    <span className="val">2048 x 2048</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="key">Mesh Lattice:</span>
                    <span className="val">0.50m (Balanced)</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="key">Vertex Budget:</span>
                    <span className="val">32,768 vtx</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="key">Sync Drift:</span>
                    <span className="val ok">0.00ms (Pristine)</span>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {/* 3. BODY CONTENT: PLANET FORGE & ACTIVITY MAKER */}
      {activeTab === 'forge' ? (
        <div className="studio-body forge-layout">
          {/* Left Preset Selector Panel */}
          <aside className="forge-presets-sidebar">
            <div className="presets-header">
              <span className="title">Preset Planet Templates</span>
              <span className="subtitle">Pick a celestial foundation to customize</span>
            </div>

            <div className="presets-list">
              {PLANET_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`preset-card ${selectedPreset.id === p.id ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(p)}
                >
                  <div className="preset-thumb" style={{ background: p.bgGradient }}>
                    {p.ring !== 'none' ? <span className="preset-ring-viz" /> : null}
                  </div>
                  <div className="preset-details">
                    <span className="name">{p.name}</span>
                    <span className="sector">{p.sector}</span>
                    <span className="game-tag">{p.defaultGame.toUpperCase()} ACTIVITY</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Center Interactive Planet Preview & Visualizer */}
          <main className="forge-center-visualizer">
            <div className="planet-stage-display">
              {/* Spherical Animated Planet Render */}
              <div
                className="planet-orb-sphere"
                style={{
                  background: `radial-gradient(circle at 32% 32%, hsl(${planetHue} 85% 65%) 0%, hsl(${planetHue} 70% 35%) 55%, #050b14 100%)`,
                  boxShadow: `0 0 50px hsl(${planetHue} 90% 50% / 0.45), inset -16px -16px 40px #020509`,
                }}
              >
                {/* Surface texture illusion overlay */}
                <div className="planet-surface-overlay" />

                {/* Planetary Rings System */}
                {planetRing !== 'none' ? (
                  <div
                    className={`planet-rings-layer ${planetRing}`}
                    style={{
                      borderColor: `hsl(${(planetHue + 40) % 360} 70% 55% / 0.7)`,
                    }}
                  />
                ) : null}
              </div>

              {/* Atmospheric Halo */}
              <div
                className="planet-atmosphere-halo"
                style={{
                  boxShadow: `0 0 90px hsl(${planetHue} 95% 65% / 0.25)`,
                }}
              />

              {/* Live Planet Telemetry Overlay */}
              <div className="planet-stats-badge">
                <span className="stat">Gravity: <b>{planetGravity.toFixed(2)}g</b></span>
                <span className="divider">|</span>
                <span className="stat">Hue: <b>{planetHue}°</b></span>
                <span className="divider">|</span>
                <span className="stat">Rings: <b>{planetRing.toUpperCase()}</b></span>
                <span className="divider">|</span>
                <span className="stat">Biome: <b>{planetBiome.toUpperCase()}</b></span>
                <span className="divider">|</span>
                <span className="stat">Game: <b>{gameMode.toUpperCase()}</b></span>
              </div>
            </div>

            {/* Quick Share Banner */}
            <div className="forge-bottom-bar">
              <div className="share-prompt">
                <Sparkles size={16} className="sparkle-icon" />
                <span>Ready to deploy into the shared SetMix Multiverse?</span>
              </div>
              <button className="studio-btn primary large" onClick={handlePublishPlanet}>
                <Share2 size={16} />
                <span>Package & Publish Planet</span>
              </button>
            </div>
          </main>

          {/* Right Deep Planet & Game Rules Customizer */}
          <aside className="forge-customizer-panel">
            <div className="customizer-scroll">
              {/* Identity & Lore */}
              <section className="customizer-section">
                <div className="section-title">
                  <Globe size={14} />
                  <span>Planet Identity & Classification</span>
                </div>

                <div className="field-group">
                  <label htmlFor="planet-name-input">Planet Designation</label>
                  <input
                    id="planet-name-input"
                    type="text"
                    value={planetName}
                    maxLength={32}
                    onChange={(e) => setPlanetName(e.target.value)}
                    placeholder="e.g. Ignis-IV Caldera"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="planet-lore-input">Activity Briefing / Sector Lore</label>
                  <textarea
                    id="planet-lore-input"
                    rows={2}
                    value={planetLore}
                    maxLength={140}
                    onChange={(e) => setPlanetLore(e.target.value)}
                    placeholder="Brief description of activities and hazards..."
                  />
                </div>
              </section>

              {/* Atmosphere & Celestial Parameters */}
              <section className="customizer-section">
                <div className="section-title">
                  <Sparkles size={14} />
                  <span>Celestial & Atmospheric Tuning</span>
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Atmospheric Hue Spectrum</span>
                    <span className="slider-val" style={{ color: `hsl(${planetHue} 90% 65%)` }}>
                      {planetHue}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    step="1"
                    className="hue-slider"
                    value={planetHue}
                    onChange={(e) => setPlanetHue(parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="field-group">
                  <label>Planetary Ring Configuration</label>
                  <div className="segment-btn-group" role="group">
                    {(['none', 'thin', 'dense', 'dual'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={planetRing === r ? 'active' : ''}
                        onClick={() => setPlanetRing(r)}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-slider-group">
                  <div className="slider-row">
                    <span className="slider-label">Surface Gravity Multiplier</span>
                    <span className="slider-val">{planetGravity.toFixed(2)}g</span>
                  </div>
                  <input
                    type="range"
                    min="0.16"
                    max="2.5"
                    step="0.05"
                    value={planetGravity}
                    onChange={(e) => setPlanetGravity(parseFloat(e.target.value))}
                  />
                </div>
              </section>

              {/* Activity Game Design & Rules */}
              <section className="customizer-section">
                <div className="section-title">
                  <Play size={14} />
                  <span>Planet Activity Game System</span>
                </div>

                <div className="game-types-list">
                  {GAME_TYPES.map((gt) => {
                    const Icon = gt.icon;
                    return (
                      <button
                        key={gt.id}
                        type="button"
                        className={`game-type-card ${gameMode === gt.id ? 'active' : ''}`}
                        onClick={() => setGameMode(gt.id)}
                      >
                        <div className="icon-wrap">
                          <Icon size={16} />
                        </div>
                        <div className="text-wrap">
                          <span className="title">{gt.title}</span>
                          <span className="desc">{gt.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Specific Game Mode Parameters */}
                {gameMode === 'rover' ? (
                  <div className="mode-sub-params">
                    <div className="control-slider-group">
                      <div className="slider-row">
                        <span className="slider-label">Circuit Lap Count</span>
                        <span className="slider-val">{lapsCount} Laps</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={lapsCount}
                        onChange={(e) => setLapsCount(parseInt(e.target.value, 10))}
                      />
                    </div>
                    <div className="field-group" style={{ marginTop: '8px' }}>
                      <label>Chassis Class</label>
                      <div className="segment-btn-group" role="group">
                        {(['none', 'buggy', 'heavy', 'skimmer'] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={vehicleType === v ? 'active' : ''}
                            onClick={() => setVehicleType(v)}
                          >
                            {v.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {gameMode === 'combat' ? (
                  <div className="mode-sub-params">
                    <label>Daemon Threat Level</label>
                    <div className="segment-btn-group" role="group">
                      {(['safe', 'moderate', 'severe', 'nightmare'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          className={threatLevel === lvl ? 'active' : ''}
                          onClick={() => setThreatLevel(lvl)}
                        >
                          {lvl.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="field-group toggle-row">
                  <div>
                    <span className="toggle-title">Synced Planetary Grid</span>
                    <span className="toggle-desc">Allow multiverse explorers to visit in shared world</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sharedGridSync}
                    onChange={(e) => setSharedGridSync(e.target.checked)}
                  />
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {/* 4. MODAL: WEEKLY CONSENSUS PATCH DIFF */}
      {diffModalOpen ? (
        <div className="studio-modal-overlay" role="dialog" aria-modal="true" aria-label="Weekly Consensus Patch">
          <div className="studio-modal-card">
            <header className="modal-header">
              <div className="title-wrap">
                <FileCode2 size={18} className="icon-accent" />
                <h3>Substrate Patch: Weekly Update Consensus</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setDiffModalOpen(false)}>×</button>
            </header>

            <div className="modal-body">
              <p className="modal-lead">
                This patch packages your lunar elevation, pylon grids, and core geological mantle parameters into an
                authenticated SetMix diff ready for the weekly community consensus merge.
              </p>

              <div className="code-diff-viewer">
                <pre>{JSON.stringify(generatedPatch, null, 2)}</pre>
              </div>

              {patchSubmitted ? (
                <div className="patch-status-banner ok">
                  <Check size={16} />
                  <span>Patch broadcast to local quantum relay! Awaiting weekly consensus cycle.</span>
                </div>
              ) : null}
            </div>

            <footer className="modal-footer">
              <button
                className="studio-btn subtle"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(generatedPatch, null, 2));
                  setPatchCopied(true);
                  setTimeout(() => setPatchCopied(false), 2000);
                }}
              >
                {patchCopied ? <Check size={14} /> : <Copy size={14} />}
                <span>{patchCopied ? 'Diff Copied' : 'Copy Diff JSON'}</span>
              </button>

              <button
                className="studio-btn primary"
                onClick={() => setPatchSubmitted(true)}
              >
                <Zap size={14} />
                <span>Submit to Consensus Queue</span>
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* 5. MODAL: MULTIVERSE PUBLISH CONFIRMATION */}
      {publishModalOpen ? (
        <div className="studio-modal-overlay" role="dialog" aria-modal="true" aria-label="Planet Published">
          <div className="studio-modal-card">
            <header className="modal-header">
              <div className="title-wrap">
                <Sparkles size={18} className="icon-accent" />
                <h3>Planet Deployed to SetMix Multiverse!</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setPublishModalOpen(false)}>×</button>
            </header>

            <div className="modal-body">
              <div className="publish-celebration">
                <div
                  className="celebration-globe"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, hsl(${planetHue} 85% 65%), #050b14)`,
                  }}
                />
                <div className="celebration-text" style={{ flex: 1 }}>
                  <h4>{planetName}</h4>
                  <p className="reg-code">
                    MULTIVERSE ID: <b>{publishedCode}</b>
                  </p>
                </div>
                <button
                  className="studio-btn subtle mini"
                  onClick={() => {
                    if (publishedCode) {
                      navigator.clipboard.writeText(publishedCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }
                  }}
                >
                  {codeCopied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{codeCopied ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>

              <p className="modal-lead">
                Your activity planet has been registered in the SetMix Multiverse galaxy! Other explorers can visit
                via the Community Nexus or galaxy orbit.
              </p>

              <div className="share-link-box">
                <span className="link-text">https://setmix.app/multiverse/{publishedCode}</span>
                <button
                  className="studio-btn subtle mini"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://setmix.app/multiverse/${publishedCode}`);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                >
                  {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{linkCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <footer className="modal-footer">
              <button className="studio-btn subtle" onClick={() => setPublishModalOpen(false)}>
                Continue Editing
              </button>
              <button
                className="studio-btn primary"
                onClick={() => {
                  setPublishModalOpen(false);
                  if (props.onPlayPlanet && publishedCode) {
                    props.onPlayPlanet(publishedCode);
                  } else if (props.onPlayCampaign) {
                    props.onPlayCampaign();
                  } else {
                    props.onBack();
                  }
                }}
              >
                <Play size={14} />
                <span>Launch Planet Activity</span>
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
