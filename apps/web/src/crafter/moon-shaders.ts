// The planet's shaders. One ground shader draws three things (by define):
//   PLOT   your plot: the look it had and the look the wave brings, blended by distance to the plot's centre, fading into the
//          plains at its rim; the wave front is three thin rings, red, green and blue: the planet's pixels being written
//   DISC   a neighbour's plot: its look, fading into the plains at its rim
//   RING   the plains, out to the horizon, in the base look (the planet as it was before anyone came)
// Sunlight is baked per point (aShade: shadows of hills, crater walls and boulders), so the low sun costs nothing per frame.

/** Shared: the wave's blend, and how far the curved planet's ground falls away. */
const COMMON = /* glsl */ `
uniform float uRadius;
uniform float uBand;
uniform float uPlanetR;
float waveT(float d) {
  float t = clamp((uRadius - d) / uBand, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float drop(vec2 xz) { return dot(xz, xz) / (2.0 * uPlanetR); }`;

/** A look's uniforms: colour and maps textures, the look numbers, the sky it lights with, metres per tile. */
const look = (name: string): string => /* glsl */ `
uniform sampler2D u${name}Colour;
uniform sampler2D u${name}Maps;
uniform vec4 u${name}Look;
uniform vec3 u${name}Sky;
uniform float u${name}Tile;`;

/** Lighting shared by the ground and the boulders. */
const LIGHT = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uFogColour;
uniform float uFogDensity;
/* fewer tones of brightness, same hue: stepping each channel apart turned near-greys blue and black */
vec3 steps(vec3 c, float levels) {
  if (levels < 0.5) return c;
  float lum = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  float stepped = pow(floor(pow(lum, 1.0 / 2.2) * levels + 0.5) / levels, 2.2);
  return c * (stepped / lum);
}
/* look: x colour steps (0 = full colour), y smooth shading (0 facets .. 1 smooth), z normal-map strength, w light */
vec3 light(vec3 albedo, vec4 maps, vec4 look, vec3 sky, vec3 n, vec3 toEye, float sun) {
  float ndl = max(dot(n, uSunDir), 0.0) * sun;
  // the void lends only a faint cold fill (light off the planet in the sky); a sky lends its own colour
  vec3 ambient = mix(vec3(0.030, 0.036, 0.048), sky * 0.42, look.w);
  // bare regolith brightens looking down-sun (the opposition surge): the dust that makes airless worlds glow
  float surge = 1.0 + 0.35 * pow(max(dot(toEye, uSunDir), 0.0), 6.0) * (1.0 - look.w);
  vec3 colour = albedo * (ambient + ndl * mix(1.55, 1.05, look.w) * surge);
  vec3 h = normalize(uSunDir + toEye);
  float rough = maps.g;
  float shine = pow(max(dot(n, h), 0.0), mix(6.0, 80.0, 1.0 - rough)) * (1.0 - rough) * look.w * sun;
  return colour + shine * 0.5;
}
vec3 haze(vec3 colour, vec3 world) {
  float dist = length(cameraPosition - world);
  return mix(colour, uFogColour, 1.0 - exp(-dist * uFogDensity));
}`;

export const GROUND_VERTEX = /* glsl */ `
${COMMON}
attribute float aShade;
#ifdef PLOT
attribute float aTo;
attribute vec3 aNormalTo;
attribute float aBase;
attribute vec3 aNormalBase;
uniform float uPlotR;
uniform float uEdge;
varying vec3 vNormalTo;
varying vec3 vNormalBase;
#endif
varying vec3 vWorld;
varying vec3 vNormal;
varying float vShade;
void main() {
  float y = position.y;
#ifdef PLOT
  float d = length(position.xz);
  float inside = 1.0 - smoothstep(uPlotR - uEdge, uPlotR, d);
  y = mix(aBase, mix(position.y, aTo, waveT(d)), inside);
  vNormalTo = aNormalTo;
  vNormalBase = aNormalBase;
#endif
  vec3 p = vec3(position.x, y - drop(position.xz), position.z);
  vWorld = p;
  vNormal = normal;
  vShade = aShade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const GROUND_FRAGMENT = /* glsl */ `
${COMMON}
${look('Base')}
${look('To')}
#ifdef PLOT
${look('From')}
uniform float uGlow;
varying vec3 vNormalTo;
varying vec3 vNormalBase;
#endif
uniform vec2 uCentre;
uniform float uPlotR;
uniform float uEdge;
${LIGHT}
varying vec3 vWorld;
varying vec3 vNormal;
varying float vShade;

vec3 shade(sampler2D colourTex, sampler2D mapTex, vec4 look, vec3 sky, float tile, vec3 smoothNormal, vec3 facetNormal, vec3 toEye) {
  vec2 uv = vWorld.xz / tile;
  vec3 albedo = steps(texture2D(colourTex, uv).rgb, look.x);
  vec4 maps = texture2D(mapTex, uv);
  vec3 n = normalize(mix(facetNormal, smoothNormal, look.y));
  // the texture's own normals, laid flat on the ground (planar mapping: x and z are its across and down)
  vec2 bend = (maps.ba * 2.0 - 1.0) * look.z;
  n = normalize(n + vec3(bend.x, 0.0, bend.y));
  return light(albedo, maps, look, sky, n, toEye, vShade);
}
${['Base', 'From', 'To'].map((l) => `#define SHADE_${l}(N) shade(u${l}Colour, u${l}Maps, u${l}Look, u${l}Sky, u${l}Tile, normalize(N), facet, toEye)`).join('\n')}

void main() {
  vec3 toEye = normalize(cameraPosition - vWorld);
  vec3 facet = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (dot(facet, toEye) < 0.0) facet = -facet;
  vec3 colour;
#ifdef RING
  colour = SHADE_Base(vNormal);
#else
  float d = length(vWorld.xz - uCentre);
#ifdef PLOT
  // the ring of plains carries on from the plot's rim
  if (d > uPlotR) discard;
  vec3 baseNormal = vNormalBase;
#else
  vec3 baseNormal = vNormal;
#endif
  float inside = 1.0 - smoothstep(uPlotR - uEdge, uPlotR, d);
  vec3 plot = vec3(0.0), base = vec3(0.0);
  if (inside < 1.0) base = SHADE_Base(baseNormal);
  if (inside > 0.0) {
#ifdef PLOT
    float t = waveT(d);
    if (t < 0.001) plot = SHADE_From(vNormal);
    else if (t > 0.999) plot = SHADE_To(vNormalTo);
    else plot = mix(SHADE_From(vNormal), SHADE_To(vNormalTo), t);
    // the front: red just ahead, green on it, blue just behind; never thinner than about a pixel and a bit
    float w = max(0.2, fwidth(d) * 1.3);
    vec3 rings = vec3(
      exp(-pow((d - uRadius - 0.42) / w, 2.0)),
      exp(-pow((d - uRadius) / w, 2.0)),
      exp(-pow((d - uRadius + 0.42) / w, 2.0)));
    plot += rings * uGlow * 1.3;
#else
    plot = SHADE_To(vNormal);
#endif
  }
  colour = mix(base, plot, inside);
#endif
  gl_FragColor = vec4(haze(colour, vWorld), 1.0);
  #include <colorspace_fragment>
}`;

/** Boulders: smooth meshes wearing the ground's own cartridge, mapped on from three sides (triplanar). */
export const ROCK_VERTEX = /* glsl */ `
attribute float aAo;
attribute float aSun;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vAo;
varying float vSun;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(m) * normal);
  vAo = aAo;
  vSun = aSun;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const ROCK_FRAGMENT = /* glsl */ `
${COMMON}
${look('Base')}
${look('From')}
${look('To')}
uniform float uPlotR;
uniform float uEdge;
${LIGHT}
varying vec3 vWorld;
varying vec3 vNormal;
varying float vAo;
varying float vSun;

vec3 rock(sampler2D colourTex, sampler2D mapTex, vec4 look, vec3 sky, float tile, vec3 n, vec3 toEye) {
  // a rock is small: its texture is drawn four times finer than the ground's, and a shade darker
  vec3 p = vWorld / (tile * 0.25);
  vec3 w = pow(abs(n), vec3(4.0));
  w /= w.x + w.y + w.z;
  vec3 albedo = texture2D(colourTex, p.zy).rgb * w.x + texture2D(colourTex, p.xz).rgb * w.y + texture2D(colourTex, p.xy).rgb * w.z;
  vec4 maps = texture2D(mapTex, p.zy) * w.x + texture2D(mapTex, p.xz) * w.y + texture2D(mapTex, p.xy) * w.z;
  albedo = steps(albedo * 0.82, look.x);
  // the sun reaches a boulder's top whatever lies at its foot; its underside sits in its own shadow
  float sun = mix(vSun, 1.0, smoothstep(0.1, 0.7, n.y));
  return light(albedo, maps, look, sky, n, toEye, sun) * (0.45 + 0.55 * vAo);
}
${['Base', 'From', 'To'].map((l) => `#define ROCK_${l} rock(u${l}Colour, u${l}Maps, u${l}Look, u${l}Sky, u${l}Tile, n, toEye)`).join('\n')}

void main() {
  vec3 n = normalize(vNormal), toEye = normalize(cameraPosition - vWorld);
  float d = length(vWorld.xz);
  float inside = 1.0 - smoothstep(uPlotR - uEdge, uPlotR, d);
  vec3 colour;
  if (inside <= 0.0) colour = ROCK_Base;
  else {
    float t = waveT(d);
    vec3 plot = t < 0.001 ? ROCK_From : t > 0.999 ? ROCK_To : mix(ROCK_From, ROCK_To, t);
    colour = inside >= 1.0 ? plot : mix(ROCK_Base, plot, inside);
  }
  gl_FragColor = vec4(haze(colour, vWorld), 1.0);
  #include <colorspace_fragment>
}`;

/** A neighbour's air: a glowing bubble over their plot, brightest at its edge and on the sunny side. */
export const DOME_VERTEX = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const DOME_FRAGMENT = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uSunDir;
uniform float uStrength;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal), toEye = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(n, toEye)), 2.2);
  float lit = 0.55 + 0.45 * max(dot(n, uSunDir), 0.0);
  vec3 colour = uTint * (0.05 + rim * 0.75) * lit * uStrength;
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;

export const WATER_VERTEX = /* glsl */ `
${COMMON}
uniform float uFromLevel;
uniform float uToLevel;
uniform float uTime;
varying vec3 vWorld;
void main() {
  // behind the wave the water rises to its new level; it starts just under it, so it floods rather than walls up
  float from = max(uFromLevel, uToLevel - 3.0);
  float y = mix(from, uToLevel, waveT(length(position.xz))) - drop(position.xz);
  vec3 p = vec3(position.x, y, position.z);
  vWorld = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uSkyColour;
uniform float uLight;
${LIGHT}
varying vec3 vWorld;
void main() {
  if (vWorld.y < -50.0) discard;
  vec2 p = vWorld.xz;
  // small slow ripples from a few crossing waves (cheap: no texture)
  vec2 slope = 0.05 * vec2(
    cos(p.x * 0.9 + uTime * 0.8) + cos((p.x + p.y) * 0.55 - uTime * 0.6),
    cos(p.y * 0.8 - uTime * 0.7) + cos((p.x - p.y) * 0.6 + uTime * 0.5));
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 toEye = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(n, toEye), 0.0), 3.0);
  vec3 deep = vec3(0.015, 0.12, 0.16), shallow = vec3(0.05, 0.34, 0.38);
  vec3 colour = mix(deep, shallow, 0.3 + 0.4 * uLight);
  colour = mix(colour, uSkyColour, 0.15 + fresnel * 0.7);
  vec3 h = normalize(uSunDir + toEye);
  colour += pow(max(dot(n, h), 0.0), 120.0) * 0.8 * uLight;
  gl_FragColor = vec4(haze(colour, vWorld), 0.9);
  #include <colorspace_fragment>
}`;

export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  // the direction from the eye, normalised per pixel (the sphere is centred on the eye every frame)
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

/**
 * The sky: black space with a faint band of the galaxy, the sun, and the goblin planet hanging over the plains (lit by
 * the same sun: a fat crescent). As the air thickens the blue sky drowns them out, the planet last, like a daytime moon.
 */
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uAtmosphere;
uniform vec3 uSunDir;
uniform vec3 uPlanetDir;
uniform float uPlanetSize;
varying vec3 vDir;

float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int o = 0; o < 4; o++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }

void main() {
  vec3 dir = normalize(vDir);
  // the galaxy: a soft band with dark dust lanes through it
  vec3 bandAxis = normalize(vec3(0.35, 0.62, 0.70));
  float across = dot(dir, bandAxis);
  float band = exp(-across * across / 0.045);
  float dust = fbm(dir * 6.0);
  vec3 space = band * (0.006 + 0.05 * smoothstep(0.35, 0.8, dust) * (1.0 - 0.7 * smoothstep(0.55, 0.7, fbm(dir * 11.0 + 4.0))))
             * mix(vec3(0.62, 0.7, 1.0), vec3(1.0, 0.86, 0.7), exp(-across * across / 0.01));
  // the sun: a hard white disc with a glare round it, even with no air
  float cs = max(dot(dir, uSunDir), 0.0);
  space += vec3(1.0, 0.97, 0.92) * (smoothstep(0.99993, 0.99997, cs) * 8.0 + pow(cs, 900.0) * 1.2 + pow(cs, 40.0) * 0.05);
  // the goblin planet
  vec3 planetCol = vec3(0.0);
  float planetA = 0.0;
  float cp = dot(dir, uPlanetDir), sr = sin(uPlanetSize);
  vec3 off = dir - uPlanetDir * cp;
  float s = length(off) / sr;
  if (cp > 0.0 && s < 1.25) {
    vec3 side = off / max(length(off), 1e-5);
    if (s < 1.0) {
      vec3 n = side * s - uPlanetDir * sqrt(1.0 - s * s);
      float l = dot(n, uSunDir);
      float land = smoothstep(0.5, 0.56, fbm(n * 2.6 + 7.0));
      float cloud = smoothstep(0.52, 0.75, fbm(n * 5.0 + vec3(3.0, 1.0, 2.0)));
      // the goblin planet is green and ochre, no blue seas (the concept art): deep green lowlands, green uplands, ochre highlands
      vec3 albedo = mix(vec3(0.06, 0.14, 0.06), mix(vec3(0.16, 0.34, 0.12), vec3(0.46, 0.36, 0.17), smoothstep(0.58, 0.72, fbm(n * 6.0))), land);
      albedo = mix(albedo, vec3(0.85), cloud * 0.8);
      vec3 lit = albedo * smoothstep(-0.08, 0.35, l) * 1.6;
      // its air: a blue-green rim on the lit side
      float rim = pow(s, 6.0) * smoothstep(-0.25, 0.35, l);
      vec3 disc = lit + vec3(0.25, 0.55, 0.75) * rim * 0.9;
      // the planet hides the stars and the galaxy behind it
      space = disc;
      planetCol = disc;
      planetA = 1.0 - smoothstep(0.97, 1.0, s);
    } else {
      float glow = (1.0 - smoothstep(1.0, 1.25, s)) * smoothstep(-0.3, 0.4, dot(side, uSunDir));
      space += vec3(0.2, 0.45, 0.65) * glow * 0.35;
    }
  }
  // the air: smooth through the horizon (a power curve has an infinite slope there, which drew a hard line across the sky)
  vec3 sky = mix(uHorizon, uZenith, smoothstep(-0.04, 0.75, dir.y));
  float sunInAir = pow(cs, 220.0) * 1.2 + pow(cs, 8.0) * 0.18;
  vec3 colour = mix(space, sky + sunInAir * vec3(1.0, 0.95, 0.85) + space * 0.25, uAtmosphere);
  // through air the planet still shows, paled by the sky like a daytime moon
  colour = mix(colour, planetCol + sky * 0.22, planetA * uAtmosphere * 0.8);
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;
