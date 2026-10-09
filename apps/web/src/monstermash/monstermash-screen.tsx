import { useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import {
  parseMd2,
  parseWad,
  extractPatch,
  extractSound,
  createFidelityMobMaterial,
  setMobMaterialStage,
  searchArchive,
  type FidelityStage,
  type ArchiveSearchItem,
  type Md2ParsedModel,
  type WadArchive,
} from '@hm/shareware';
import './monstermash.css';

export function MonsterMashScreen(props: { readonly onBack: () => void }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<FidelityStage>(4);
  const [activeAnim, setActiveAnim] = useState('run');
  const [searchQuery, setSearchQuery] = useState('doom');
  const [searchResults, setSearchResults] = useState<readonly ArchiveSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Loading sample assets...');
  const [isDragging, setIsDragging] = useState(false);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const mobMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const spriteMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const wadRef = useRef<WadArchive | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Setup Three.js scene on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f12);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.1, 3.6);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Ground grid plane
    const grid = new THREE.GridHelper(10, 20, 0xff3366, 0x333b47);
    grid.position.y = 0;
    scene.add(grid);

    // Default lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 8, 4);
    scene.add(sun);

    // Initial Material for 3D model
    const mobMat = createFidelityMobMaterial({ stage: 4 });
    mobMaterialRef.current = mobMat;

    let destroyed = false;
    let animFrame = 0;
    let prevTime = performance.now();

    const loop = (time: number) => {
      if (destroyed) return;
      const dt = (time - prevTime) / 1000;
      prevTime = time;

      if (mixerRef.current) {
        mixerRef.current.update(dt);
      }

      renderer.render(scene, camera);
      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);

    // Resize handler
    const onResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Load initial MD2 & WAD assets
    async function loadInitial() {
      try {
        // 1. Fetch ogro.md2 and texture
        setStatusMsg('Loading Quake MD2 Ogro & Doom WAD...');
        const [md2Res, skinRes, wadRes] = await Promise.all([
          fetch('./shareware/ogro.md2').catch(() => null),
          fetch('./shareware/ogrobase.png').catch(() => null),
          fetch('./shareware/doom1.wad').catch(() => null),
        ]);

        if (md2Res && md2Res.ok) {
          const md2Buf = await md2Res.arrayBuffer();
          const model: Md2ParsedModel = parseMd2(md2Buf);

          if (skinRes && skinRes.ok) {
            const skinBlob = await skinRes.blob();
            const skinImg = new Image();
            skinImg.src = URL.createObjectURL(skinBlob);
            await skinImg.decode();
            const tex = new THREE.Texture(skinImg);
            tex.needsUpdate = true;
            mobMat.uniforms.uMap!.value = tex;
          }

          const mesh = new THREE.Mesh(model.geometry, mobMat);
          mesh.scale.set(0.045, 0.045, 0.045);
          mesh.position.set(-1.0, 0, 0);
          mesh.rotation.y = Math.PI / 4;
          scene.add(mesh);

          const mixer = new THREE.AnimationMixer(mesh);
          mixerRef.current = mixer;
          actionsRef.current.clear();

          for (const clip of model.animations) {
            const act = mixer.clipAction(clip);
            actionsRef.current.set(clip.name, act);
          }

          const runAct = actionsRef.current.get('run');
          if (runAct) runAct.play();
        }

        // 2. Fetch and unpack Doom SARGA1 sprite
        if (wadRes && wadRes.ok) {
          const wadBuf = await wadRes.arrayBuffer();
          const wad = parseWad(wadBuf);
          wadRef.current = wad;

          const patch = extractPatch(wad, 'SARGA1');
          const canvasEl = document.createElement('canvas');
          canvasEl.width = patch.width;
          canvasEl.height = patch.height;
          const ctx = canvasEl.getContext('2d')!;
          const imgData = ctx.createImageData(patch.width, patch.height);
          imgData.data.set(patch.data);
          ctx.putImageData(imgData, 0, 0);

          const spriteTex = new THREE.CanvasTexture(canvasEl);
          spriteTex.magFilter = THREE.NearestFilter;
          spriteTex.minFilter = THREE.NearestFilter;

          const spriteMat = createFidelityMobMaterial({ stage: 4, map: spriteTex });
          spriteMatRef.current = spriteMat;

          const spriteGeom = new THREE.PlaneGeometry((patch.width / 40) * 1.5, (patch.height / 40) * 1.5);
          const spriteMesh = new THREE.Mesh(spriteGeom, spriteMat);
          spriteMesh.position.set(0.85, 0.9, 0);
          scene.add(spriteMesh);
        }

        setStatusMsg('Monster Mash models and sprites live! Ready.');
      } catch (e: unknown) {
        setStatusMsg(`Note: Loaded with local fallback (${(e as Error).message})`);
      }
    }

    void loadInitial();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // Update fidelity stage
  const handleStageChange = (newStage: FidelityStage) => {
    setStage(newStage);
    if (mobMaterialRef.current) {
      setMobMaterialStage(mobMaterialRef.current, newStage);
    }
    if (spriteMatRef.current) {
      setMobMaterialStage(spriteMatRef.current, newStage);
    }
  };

  // Switch animation clip
  const handleAnimChange = (name: string) => {
    setActiveAnim(name);
    if (!mixerRef.current) return;
    for (const [n, act] of actionsRef.current.entries()) {
      if (n === name) {
        act.reset().play();
      } else {
        act.stop();
      }
    }
  };

  // Play DOOM sound
  const playSound = (soundName: string) => {
    if (!wadRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const snd = extractSound(wadRef.current, soundName);
      const audioBuffer = ctx.createBuffer(1, snd.samples, snd.sampleRate);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < snd.samples; i++) {
        channel[i] = ((snd.data[i] ?? 128) - 128) / 128.0;
      }
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      src.start();
    } catch (e: unknown) {
      console.warn('Sound play failed:', e);
    }
  };

  // Handle Drag and Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0]!;
    setStatusMsg(`Reading dropped file: ${file.name}...`);
    const buffer = await file.arrayBuffer();

    if (file.name.toLowerCase().endsWith('.wad')) {
      try {
        const wad = parseWad(buffer);
        wadRef.current = wad;
        setStatusMsg(`WAD loaded: ${wad.type} with ${wad.numLumps} lumps!`);
        playSound('DSSHOTGN');
      } catch (err: unknown) {
        setStatusMsg(`WAD parse error: ${(err as Error).message}`);
      }
    } else if (file.name.toLowerCase().endsWith('.md2')) {
      try {
        const model = parseMd2(buffer);
        if (sceneRef.current && mobMaterialRef.current) {
          const mesh = new THREE.Mesh(model.geometry, mobMaterialRef.current);
          mesh.scale.set(0.045, 0.045, 0.045);
          mesh.position.set(-1.0, 0, 0);
          mesh.rotation.y = Math.PI / 4;
          sceneRef.current.add(mesh);

          const mixer = new THREE.AnimationMixer(mesh);
          mixerRef.current = mixer;
          actionsRef.current.clear();
          for (const clip of model.animations) {
            actionsRef.current.set(clip.name, mixer.clipAction(clip));
          }
          const standAct = actionsRef.current.get('stand');
          if (standAct) standAct.play();
        }
        setStatusMsg(`MD2 3D model loaded: ${model.totalFrames} animation frames!`);
      } catch (err: unknown) {
        setStatusMsg(`MD2 parse error: ${(err as Error).message}`);
      }
    }
  };

  // Search Internet Archive
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchArchive(searchQuery, 8);
      setSearchResults(results);
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mm-screen">
      <header className="mm-header">
        <div className="mm-title">
          <span className="mm-badge">Monster Mash Jam Spike</span>
          <strong>Inter-Game Asset Ingestion & Fidelity Adaptation</strong>
        </div>
        <button type="button" className="mm-back-btn" onClick={props.onBack}>
          Back to SetMix
        </button>
      </header>

      <div
        className="mm-body"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="mm-canvas-wrap">
          <canvas ref={canvasRef} className="mm-canvas" />

          {isDragging && <div className="mm-drop-overlay">Drop .WAD or .MD2 file here</div>}

          <div className="mm-controls">
            <h4>Fidelity Adaptation</h4>
            <div className="mm-stage-btns">
              <button
                type="button"
                className={`mm-stage-btn ${stage === 0 ? 'active' : ''}`}
                onClick={() => handleStageChange(0)}
              >
                Stage 0: 1-Bit Bayer Dither
              </button>
              <button
                type="button"
                className={`mm-stage-btn ${stage === 1 ? 'active' : ''}`}
                onClick={() => handleStageChange(1)}
              >
                Stage 1: 16-Color EGA
              </button>
              <button
                type="button"
                className={`mm-stage-btn ${stage === 2 ? 'active' : ''}`}
                onClick={() => handleStageChange(2)}
              >
                Stage 2: 256-Color VGA (PSX Jitter)
              </button>
              <button
                type="button"
                className={`mm-stage-btn ${stage === 3 ? 'active' : ''}`}
                onClick={() => handleStageChange(3)}
              >
                Stage 3: Lit Gouraud / Diffuse
              </button>
              <button
                type="button"
                className={`mm-stage-btn ${stage === 4 ? 'active' : ''}`}
                onClick={() => handleStageChange(4)}
              >
                Stage 4: Full PBR & Emissive
              </button>
            </div>

            <h4>Quake MD2 Animations</h4>
            <div className="mm-anim-btns">
              <button
                type="button"
                className={`mm-anim-btn ${activeAnim === 'stand' ? 'active' : ''}`}
                onClick={() => handleAnimChange('stand')}
              >
                Stand
              </button>
              <button
                type="button"
                className={`mm-anim-btn ${activeAnim === 'run' ? 'active' : ''}`}
                onClick={() => handleAnimChange('run')}
              >
                Run
              </button>
              <button
                type="button"
                className={`mm-anim-btn ${activeAnim === 'attack' ? 'active' : ''}`}
                onClick={() => handleAnimChange('attack')}
              >
                Attack
              </button>
            </div>

            <h4>Audio Synthesis</h4>
            <button type="button" className="mm-sfx-btn" onClick={() => playSound('DSSHOTGN')}>
              💥 Play Doom Shotgun PCM
            </button>
            <button type="button" className="mm-sfx-btn" onClick={() => playSound('DSRXPLOD')}>
              💣 Play Doom Explosion PCM
            </button>

            <div style={{ fontSize: 11, color: '#8c9ba5', marginTop: 4 }}>
              Status: <em>{statusMsg}</em>
            </div>
          </div>
        </div>

        <aside className="mm-sidebar">
          <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: 12, color: '#8c9ba5' }}>
            Internet Archive Terminal
          </h4>
          <form className="mm-search-box" onSubmit={handleSearch}>
            <input
              type="text"
              className="mm-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search MS-DOS shareware..."
            />
            <button type="submit" className="mm-btn" disabled={searching}>
              {searching ? '...' : 'Search'}
            </button>
          </form>

          <div className="mm-results">
            {searchResults.map((item) => (
              <div key={item.identifier} className="mm-card">
                <h5>{item.title}</h5>
                <p>
                  Year: {item.year || 'Unknown'} | ID: {item.identifier}
                </p>
                <a
                  href={`https://archive.org/details/${item.identifier}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Archive.org ↗
                </a>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
