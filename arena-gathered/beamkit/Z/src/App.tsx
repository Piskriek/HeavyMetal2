import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { beamEffect, createMaterials, extractionBeam, type BeamFx, type BeamMode, type LabMaterials } from './index';

type ViewEntry = {
  readonly element: HTMLElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly cameraHeight: number;
  readonly update?: (time: number) => void;
};

const makeStudio = (): THREE.Scene => {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#d9e9e8', '#141b1c', 1.65));

  const key = new THREE.DirectionalLight('#fff0d2', 4.2);
  key.position.set(-2.8, 4.6, 3.4);
  scene.add(key);

  const fill = new THREE.DirectionalLight('#8bcbd6', 1.4);
  fill.position.set(3.8, 1.3, -2.6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight('#e38f53', 1.25);
  rim.position.set(-1.2, 1.8, -4.3);
  scene.add(rim);
  return scene;
};

const makeCamera = (height: number, position: THREE.Vector3, target: THREE.Vector3): THREE.OrthographicCamera => {
  const camera = new THREE.OrthographicCamera(-height / 2, height / 2, height / 2, -height / 2, 0.01, 80);
  camera.position.copy(position);
  camera.lookAt(target);
  return camera;
};

const stageDisc = (materials: LabMaterials): THREE.Group => {
  const stage = new THREE.Group();
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.018, 48),
    new THREE.MeshStandardMaterial({ color: '#202a2d', metalness: 0.72, roughness: 0.36 }),
  );
  plinth.position.set(0, -0.195, 0);
  stage.add(plinth);
  const inlay = new THREE.Mesh(
    new THREE.TorusGeometry(0.456, 0.0022, 4, 48),
    new THREE.MeshStandardMaterial({ color: '#8a6746', metalness: 0.82, roughness: 0.26 }),
  );
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = -0.183;
  stage.add(inlay);
  const pins = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.004, 12),
    materials.copper,
  );
  pins.position.set(0.33, -0.183, 0.28);
  stage.add(pins);
  return stage;
};

const createModeScene = (
  materials: LabMaterials,
  mode: BeamMode,
  colour: string,
): { readonly scene: THREE.Scene; readonly effect: BeamFx; readonly rock: THREE.Mesh; readonly emitter: THREE.MeshStandardMaterial } => {
  const scene = makeStudio();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.2),
    new THREE.MeshStandardMaterial({ color: '#242c2a', metalness: 0.08, roughness: 0.98 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.415, 1.38);
  scene.add(ground);

  const emitter = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.105, 0.27), materials.gunmetal);
  receiver.position.set(0, -0.035, -0.245);
  emitter.add(receiver);
  const lowerShell = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.07, 0.2), materials.darkSteel);
  lowerShell.position.set(0, -0.091, -0.24);
  emitter.add(lowerShell);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.25, 14),
    materials.darkSteel,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.005, -0.055);
  emitter.add(barrel);
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.043, 0.005, 5, 16),
    materials.copper,
  );
  collar.position.set(0, 0.005, 0.055);
  emitter.add(collar);
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: '#bdf9ff',
    emissive: colour,
    emissiveIntensity: 2.2,
    metalness: 0.15,
    roughness: 0.18,
  });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.033, 16), lensMaterial);
  lens.position.set(0, 0.005, 0.061);
  emitter.add(lens);
  scene.add(emitter);

  const rockMaterial = materials.concrete.clone();
  rockMaterial.color.set('#716c60');
  rockMaterial.flatShading = true;
  rockMaterial.roughness = 0.98;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 1), rockMaterial);
  rock.name = `target-rock-${mode}`;
  rock.scale.set(1.03, 0.79, 0.91);
  rock.position.set(0, -0.17, 1.99);
  scene.add(rock);

  const oreMaterial = new THREE.MeshStandardMaterial({
    color: mode === 'extract' ? '#45d8cc' : '#4a5552',
    emissive: mode === 'extract' ? '#167d75' : '#111715',
    emissiveIntensity: mode === 'extract' ? 0.65 : 0.12,
    metalness: 0.78,
    roughness: 0.28,
  });
  for (let i = 0; i < 3; i++) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.045 + i * 0.006, 0), oreMaterial);
    shard.position.set(-0.16 + i * 0.14, -0.14 + (i % 2) * 0.09, 1.78 + i * 0.09);
    shard.rotation.set(i * 0.4, i * 0.6, i * 0.2);
    scene.add(shard);
  }

  const effect = beamEffect({ pixels: 84 });
  effect.set(new THREE.Vector3(0, 0.005, 0.065), new THREE.Vector3(0, -0.1, 1.73), mode, colour, true);
  scene.add(effect.object);

  return { scene, effect, rock, emitter: lensMaterial };
};

const renderViews = (renderer: THREE.WebGLRenderer, host: HTMLDivElement, entries: readonly ViewEntry[], time: number): void => {
  const canvasRect = renderer.domElement.getBoundingClientRect();
  renderer.setScissorTest(true);
  for (const entry of entries) {
    const rect = entry.element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) continue;

    const aspect = width / height;
    entry.camera.left = -entry.cameraHeight * aspect / 2;
    entry.camera.right = entry.cameraHeight * aspect / 2;
    entry.camera.top = entry.cameraHeight / 2;
    entry.camera.bottom = -entry.cameraHeight / 2;
    entry.camera.updateProjectionMatrix();

    const left = rect.left - canvasRect.left;
    const bottom = canvasRect.bottom - rect.bottom;
    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.clear(true, true, true);
    entry.update?.(time);
    renderer.render(entry.scene, entry.camera);
  }
  renderer.setScissorTest(false);
  void host;
};

const destroyScene = (scene: THREE.Scene): void => {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh && !(object as THREE.Points).isPoints) return;
    const drawable = object as THREE.Mesh | THREE.Points;
    drawable.geometry.dispose();
    const material = drawable.material;
    for (const item of Array.isArray(material) ? material : [material]) {
      const standard = item as THREE.MeshStandardMaterial;
      standard.emissiveMap?.dispose();
      item.dispose();
    }
  });
};

export default function App() {
  const modelCanvas = useRef<HTMLCanvasElement | null>(null);
  const effectCanvas = useRef<HTMLCanvasElement | null>(null);
  const modelHost = useRef<HTMLDivElement | null>(null);
  const effectHost = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const modelCanvasElement = modelCanvas.current;
    const effectCanvasElement = effectCanvas.current;
    const modelHostElement = modelHost.current;
    const effectHostElement = effectHost.current;
    if (!modelCanvasElement || !effectCanvasElement || !modelHostElement || !effectHostElement) return;

    const materials = createMaterials();
    const stageOne = extractionBeam(materials, { stage: 1 });
    const fullDetail = extractionBeam(materials, { stage: 6 });
    stageOne.setCartridge('#f3b848');
    stageOne.setMode('extract');
    stageOne.setCharge(0.72);
    stageOne.setFiring(0.75);
    fullDetail.setCartridge('#5df0c2');
    fullDetail.setMode('apply');
    fullDetail.setCharge(0.88);
    fullDetail.setFiring(0.72);

    const lowScene = makeStudio();
    lowScene.add(stageDisc(materials));
    lowScene.add(stageOne.group);
    const fullScene = makeStudio();
    fullScene.add(stageDisc(materials));
    fullScene.add(fullDetail.group);

    const lowElement = modelHostElement.querySelector<HTMLElement>('[data-beam-view="stage-one"]');
    const fullElement = modelHostElement.querySelector<HTMLElement>('[data-beam-view="full-detail"]');
    const extractElement = effectHostElement.querySelector<HTMLElement>('[data-beam-view="extract"]');
    const applyElement = effectHostElement.querySelector<HTMLElement>('[data-beam-view="apply"]');
    const sculptElement = effectHostElement.querySelector<HTMLElement>('[data-beam-view="sculpt"]');
    if (!lowElement || !fullElement || !extractElement || !applyElement || !sculptElement) return;

    const modeRuns = [
      createModeScene(materials, 'extract', '#5fe6d0'),
      createModeScene(materials, 'apply', '#b9ff54'),
      createModeScene(materials, 'sculpt', '#d18aff'),
    ] as const;
    const modelEntries: ViewEntry[] = [
      {
        element: lowElement,
        scene: lowScene,
        camera: makeCamera(0.63, new THREE.Vector3(1.45, 0.98, 1.55), new THREE.Vector3(0, 0, -0.01)),
        cameraHeight: 0.63,
        update: (time) => {
          stageOne.group.rotation.y = -0.24 + time * 0.075;
          stageOne.group.rotation.x = 0.018 + Math.sin(time * 0.45) * 0.025;
        },
      },
      {
        element: fullElement,
        scene: fullScene,
        camera: makeCamera(0.63, new THREE.Vector3(1.45, 0.98, 1.55), new THREE.Vector3(0, 0, -0.01)),
        cameraHeight: 0.63,
        update: (time) => {
          fullDetail.group.rotation.y = 0.22 + time * 0.075;
          fullDetail.group.rotation.x = 0.018 + Math.sin(time * 0.45 + 0.6) * 0.025;
        },
      },
    ];
    const effectEntries: ViewEntry[] = [
      { element: extractElement, scene: modeRuns[0].scene, camera: makeCamera(1.52, new THREE.Vector3(3.2, 1.75, 0.58), new THREE.Vector3(0, -0.1, 1.03)), cameraHeight: 1.52, update: (time) => { modeRuns[0].effect.update(time); modeRuns[0].rock.rotation.y = Math.sin(time * 0.3) * 0.045; } },
      { element: applyElement, scene: modeRuns[1].scene, camera: makeCamera(1.52, new THREE.Vector3(3.2, 1.75, 0.58), new THREE.Vector3(0, -0.1, 1.03)), cameraHeight: 1.52, update: (time) => { modeRuns[1].effect.update(time); modeRuns[1].rock.rotation.y = Math.sin(time * 0.3 + 0.8) * 0.045; } },
      { element: sculptElement, scene: modeRuns[2].scene, camera: makeCamera(1.52, new THREE.Vector3(3.2, 1.75, 0.58), new THREE.Vector3(0, -0.1, 1.03)), cameraHeight: 1.52, update: (time) => { modeRuns[2].effect.update(time); modeRuns[2].rock.rotation.y = Math.sin(time * 0.3 + 1.6) * 0.045; } },
    ];

    const makeRenderer = (canvas: HTMLCanvasElement): THREE.WebGLRenderer => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.setClearColor('#0b1113', 0);
      renderer.autoClear = false;
      return renderer;
    };
    const modelRenderer = makeRenderer(modelCanvasElement);
    const effectRenderer = makeRenderer(effectCanvasElement);

    const resize = (): void => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      modelRenderer.setPixelRatio(pixelRatio);
      modelRenderer.setSize(modelHostElement.clientWidth, modelHostElement.clientHeight, false);
      effectRenderer.setPixelRatio(pixelRatio);
      effectRenderer.setSize(effectHostElement.clientWidth, effectHostElement.clientHeight, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(modelHostElement);
    observer.observe(effectHostElement);
    window.addEventListener('resize', resize);

    let frame = 0;
    const draw = (now: number): void => {
      const time = now * 0.001;
      renderViews(modelRenderer, modelHostElement, modelEntries, time);
      renderViews(effectRenderer, effectHostElement, effectEntries, time);
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      observer.disconnect();
      modelRenderer.dispose();
      effectRenderer.dispose();
      for (const run of modeRuns) run.effect.dispose();
      destroyScene(lowScene);
      destroyScene(fullScene);
      for (const run of modeRuns) destroyScene(run.scene);
      for (const material of Object.values(materials)) material.dispose();
    };
  }, []);

  return (
    <div className="page-shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="HM Beamkit home">
          <span className="wordmark-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>HM / BEAMKIT</span>
        </a>
        <div className="masthead-meta">
          <span>FIELD SYSTEMS</span>
          <span className="meta-separator" />
          <span>TOOL STUDY 06.18</span>
        </div>
      </header>

      <main id="top" className="showcase">
        <section className="intro-block" aria-labelledby="page-title">
          <div className="intro-main">
            <p className="eyebrow"><span className="eyebrow-index">09</span> TERRAFORMING EQUIPMENT / HANDHELD</p>
            <h1 id="page-title"><span className="title-small">THE FIELD</span>BEAMKIT</h1>
          </div>
          <div className="intro-side">
            <p>One rifle-format instrument for taking matter out, laying matter down, and shaping the ground between.</p>
            <div className="intro-rule"><span>EXTRACTION BEAM PLATFORM</span><span>MARK II / CERES YARD</span></div>
          </div>
        </section>

        <section className="tool-study" aria-labelledby="tool-study-heading">
          <div className="section-heading">
            <h2 id="tool-study-heading"><span>01</span> RECEIVER / FORM STUDY</h2>
            <p>HAND FIT / RIFLE ANIMATION STANDARD</p>
          </div>
          <div className="model-gallery" ref={modelHost}>
            <canvas ref={modelCanvas} className="render-canvas" aria-hidden="true" />
            <div className="model-grid">
              <div className="model-view" data-beam-view="stage-one">
                <div className="view-kicker"><span>STAGE 01</span><span>FIELD CONFIGURATION</span></div>
                <div className="view-caption"><strong>Serviceable mass</strong><span>FLAT-SHADED / LOW POLY</span></div>
              </div>
              <div className="model-view" data-beam-view="full-detail">
                <div className="view-kicker"><span>STAGE 06</span><span>FULL DETAIL</span></div>
                <div className="view-caption"><strong>Induction assembly</strong><span>COIL / CELL / LOADED PORT</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mode-study" aria-labelledby="mode-heading">
          <div className="section-heading mode-heading">
            <div>
              <h2 id="mode-heading"><span>02</span> THREE WORKING MODES</h2>
              <p className="section-description">The emitter changes its cadence with the job.</p>
            </div>
            <p>LIVE PARTICLE PASS / TARGET ROCK</p>
          </div>
          <div className="mode-gallery" ref={effectHost}>
            <canvas ref={effectCanvas} className="render-canvas" aria-hidden="true" />
            <div className="mode-grid">
              <article className="mode-view" data-beam-view="extract">
                <div className="mode-label"><span className="mode-index">A</span><div><h3>EXTRACT</h3><p>ORE RETURN / INWARD FLOW</p></div></div>
                <span className="mode-swatch extract-swatch" />
              </article>
              <article className="mode-view" data-beam-view="apply">
                <div className="mode-label"><span className="mode-index">B</span><div><h3>APPLY</h3><p>CARTRIDGE PAYLOAD / PIXEL STREAM</p></div></div>
                <span className="mode-swatch apply-swatch" />
              </article>
              <article className="mode-view" data-beam-view="sculpt">
                <div className="mode-label"><span className="mode-index">C</span><div><h3>SCULPT</h3><p>PULSED BOLT / TERRAIN CONTROL</p></div></div>
                <span className="mode-swatch sculpt-swatch" />
              </article>
            </div>
          </div>
        </section>

        <footer className="spec-footer">
          <span>HUMAN-MACHINE FIELD LAB / EQUIPMENT SERIES</span>
          <span>DESIGNED TO TAKE THE GROUND SERIOUSLY</span>
          <span>HM-BK / 06</span>
        </footer>
      </main>
    </div>
  );
}