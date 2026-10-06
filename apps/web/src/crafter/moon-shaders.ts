// The moon's shaders. The ground draws two looks at once, the one it had and the one the wave brings, and blends them
// per pixel by distance to the chimney: behind the front the new look, ahead the old, a C1 band between where heights swell.
// The front itself is three thin rings, red, green and blue, a little apart: the moon's pixels being written.

/** Shared by the ground and the water: how much of the new look a point at distance d shows, and how far a small moon's ground falls away. */
const WAVE_GLSL = /* glsl */ `
uniform float uRadius;
uniform float uBand;
float waveT(float d) {
  float t = clamp((uRadius - d) / uBand, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float moonDrop(vec2 xz) { return dot(xz, xz) / 760.0; }`;

export const GROUND_VERTEX = /* glsl */ `
attribute float aTo;
attribute vec3 aNormalTo;
${WAVE_GLSL}
varying vec3 vWorld;
varying vec3 vNormalFrom;
varying vec3 vNormalTo;
void main() {
  float t = waveT(length(position.xz));
  vec3 p = vec3(position.x, mix(position.y, aTo, t) - moonDrop(position.xz), position.z);
  vWorld = p;
  vNormalFrom = normal;
  vNormalTo = aNormalTo;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const GROUND_FRAGMENT = /* glsl */ `
${WAVE_GLSL}
uniform sampler2D uFromColour;
uniform sampler2D uFromMaps;
uniform sampler2D uToColour;
uniform sampler2D uToMaps;
/* each look: x colour steps (0 = full colour), y smooth shading (0 facets .. 1 smooth), z normal-map strength, w light */
uniform vec4 uFromLook;
uniform vec4 uToLook;
uniform vec3 uFromSky;
uniform vec3 uToSky;
uniform float uFromTile;
uniform float uToTile;
uniform float uGlow;
uniform vec3 uSunDir;
uniform vec3 uFogColour;
uniform float uFogDensity;
varying vec3 vWorld;
varying vec3 vNormalFrom;
varying vec3 vNormalTo;

/* fewer tones of brightness, same hue: stepping each channel apart turned near-greys blue and black */
vec3 steps(vec3 c, float levels) {
  if (levels < 0.5) return c;
  float lum = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  float stepped = pow(floor(pow(lum, 1.0 / 2.2) * levels + 0.5) / levels, 2.2);
  return c * (stepped / lum);
}

vec3 shade(sampler2D colourTex, sampler2D mapTex, vec4 look, vec3 sky, vec3 smoothNormal, vec3 facetNormal, vec2 uv, vec3 toEye) {
  vec3 albedo = steps(texture2D(colourTex, uv).rgb, look.x);
  vec4 maps = texture2D(mapTex, uv);
  vec3 n = normalize(mix(facetNormal, smoothNormal, look.y));
  // the texture's own normals, laid flat on the ground (planar mapping: x and z are its across and down)
  vec2 bend = (maps.ba * 2.0 - 1.0) * look.z;
  n = normalize(n + vec3(bend.x, 0.0, bend.y));
  float ndl = max(dot(n, uSunDir), 0.0);
  // the void lends a dim grey fill; a sky lends its own colour
  vec3 ambient = mix(vec3(0.07, 0.075, 0.085), sky * 0.42, look.w);
  vec3 colour = albedo * (ambient + ndl * mix(1.25, 0.98, look.w));
  // shine, once there is light to shine with
  vec3 h = normalize(uSunDir + toEye);
  float rough = maps.g;
  float shine = pow(max(dot(n, h), 0.0), mix(6.0, 80.0, 1.0 - rough)) * (1.0 - rough) * look.w;
  return colour + shine * 0.5;
}

void main() {
  vec3 toEye = normalize(cameraPosition - vWorld);
  vec3 facetNormal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (dot(facetNormal, toEye) < 0.0) facetNormal = -facetNormal;
  float d = length(vWorld.xz);
  float t = waveT(d);
  vec3 colour = mix(
    shade(uFromColour, uFromMaps, uFromLook, uFromSky, normalize(vNormalFrom), facetNormal, vWorld.xz / uFromTile, toEye),
    shade(uToColour, uToMaps, uToLook, uToSky, normalize(vNormalTo), facetNormal, vWorld.xz / uToTile, toEye),
    t);
  // the front: red just ahead, green on it, blue just behind
  // never thinner than about a pixel and a bit, so it does not shimmer far away or at a grazing angle
  float w = max(0.2, fwidth(d) * 1.3);
  vec3 rings = vec3(
    exp(-pow((d - uRadius - 0.42) / w, 2.0)),
    exp(-pow((d - uRadius) / w, 2.0)),
    exp(-pow((d - uRadius + 0.42) / w, 2.0)));
  colour += rings * uGlow * 1.3;
  float dist = length(cameraPosition - vWorld);
  // the patch ends in a round horizon, not a square edge
  float edge = smoothstep(46.0, 62.0, d);
  colour = mix(colour, uFogColour, max(edge, 1.0 - exp(-pow(dist * uFogDensity, 2.0))));
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;

export const WATER_VERTEX = /* glsl */ `
${WAVE_GLSL}
uniform float uFromLevel;
uniform float uToLevel;
uniform float uTime;
varying vec3 vWorld;
void main() {
  // behind the wave the water rises to its new level; it starts just under it, so it floods rather than walls up
  float from = max(uFromLevel, uToLevel - 3.0);
  float y = mix(from, uToLevel, waveT(length(position.xz))) - moonDrop(position.xz);
  vec3 p = vec3(position.x, y, position.z);
  vWorld = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSkyColour;
uniform vec3 uFogColour;
uniform float uFogDensity;
uniform float uLight;
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
  float dist = length(cameraPosition - vWorld);
  float edge = smoothstep(46.0, 62.0, length(vWorld.xz));
  colour = mix(colour, uFogColour, max(edge, 1.0 - exp(-pow(dist * uFogDensity, 2.0))));
  gl_FragColor = vec4(colour, 0.9);
  #include <colorspace_fragment>
}`;

export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  // the position itself, normalised per pixel: normalising here and interpolating left an edge at every ring of the sphere
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uAtmosphere;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 dir = normalize(vDir);
  // smooth through the horizon (a power curve has an infinite slope there, which drew a hard line across the sky)
  vec3 sky = mix(uHorizon, uZenith, smoothstep(-0.04, 0.75, dir.y));
  // a soft sun once there is air to scatter it
  float sun = pow(max(dot(dir, uSunDir), 0.0), 220.0) * 1.2 + pow(max(dot(dir, uSunDir), 0.0), 8.0) * 0.18;
  vec3 colour = mix(vec3(0.0), sky + sun * vec3(1.0, 0.95, 0.85), uAtmosphere);
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;
