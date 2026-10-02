import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Vec3 } from '@hm/contracts';

export interface EnvironmentRig {
  update(target: Vec3): void;
  /** Sea mode: the ground disc becomes clear tropical water at y = 0 (used when a terrain island is shown). */
  setSea(on: boolean): void;
  dispose(): void;
}

const skyVertex = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skyFragment = `
  varying vec3 vWorld;
  uniform vec3 uCenter;
  void main() {
    float h = normalize(vWorld - uCenter).y;
    float horizon = smoothstep(-0.18, 0.24, h);
    float zenith = smoothstep(0.05, 0.92, h);
    vec3 haze = vec3(0.78, 0.82, 0.82);
    vec3 blue = vec3(0.20, 0.43, 0.68);
    vec3 high = vec3(0.055, 0.15, 0.31);
    gl_FragColor = vec4(mix(mix(haze, blue, horizon), high, zenith), 1.0);
  }
`;

const makeGridTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#252a2d';
    context.fillRect(0, 0, 512, 512);
    for (let i = 0; i <= 16; i += 1) {
      const p = i * 32;
      context.strokeStyle = i % 4 === 0 ? 'rgba(184,199,201,0.17)' : 'rgba(184,199,201,0.07)';
      context.lineWidth = i % 4 === 0 ? 1.5 : 1;
      context.beginPath();
      context.moveTo(p, 0);
      context.lineTo(p, 512);
      context.moveTo(0, p);
      context.lineTo(512, p);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

export function createEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer, background: 'sky' | 'dark', shadows: boolean): EnvironmentRig {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.35;

  let sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  if (background === 'sky') {
    const material = new THREE.ShaderMaterial({
      uniforms: { uCenter: { value: new THREE.Vector3() } },
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 48, 24), material);
    sky.frustumCulled = false;
    sky.renderOrder = -100;
    scene.add(sky);
    scene.fog = new THREE.FogExp2(0xaebdc3, 0.006);
  } else {
    scene.background = new THREE.Color(0x090d13);
    scene.fog = new THREE.FogExp2(0x090d13, 0.012);
  }

  const gridTexture = makeGridTexture();
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: gridTexture,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.35,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 128), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  scene.add(ground);

  const hemisphere = new THREE.HemisphereLight(0xb9d7ff, 0x29241f, 0.55);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffddb3, 3.2);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.025;
  const camera = sun.shadow.camera;
  camera.left = -35;
  camera.right = 35;
  camera.top = 35;
  camera.bottom = -35;
  camera.near = 1;
  camera.far = 140;
  scene.add(sun, sun.target);

  const seaTint = new THREE.Color(0x1d8fa3);
  return {
    setSea(on: boolean): void {
      groundMaterial.map = on ? null : gridTexture;
      groundMaterial.color.set(on ? seaTint : 0xffffff);
      groundMaterial.transparent = on;
      groundMaterial.opacity = on ? 0.72 : 1;
      groundMaterial.roughness = on ? 0.06 : 0.94;
      groundMaterial.envMapIntensity = on ? 1.2 : 0.35;
      groundMaterial.depthWrite = !on;
      ground.position.y = on ? 0 : -0.012;
      groundMaterial.needsUpdate = true;
    },
    update(target: Vec3): void {
      sun.target.position.fromArray(target);
      sun.position.set(target[0] + 32, target[1] + 48, target[2] + 24);
      sun.target.updateMatrixWorld();
      if (sky) {
        sky.position.fromArray(target);
        (sky.material.uniforms.uCenter?.value as THREE.Vector3).fromArray(target);
      }
    },
    dispose(): void {
      scene.remove(ground, hemisphere, sun, sun.target);
      ground.geometry.dispose();
      groundMaterial.dispose();
      gridTexture.dispose();
      if (sky) {
        scene.remove(sky);
        sky.geometry.dispose();
        sky.material.dispose();
      }
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    },
  };
}