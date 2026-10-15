// Shaders for the first Play: the planet's look by stage (black-and-white dither at stage 0, low-res colour from stage 1, the
// wave between), the gate's opening seen from the lab, and the marks that keep some things in colour.
//
// Alpha in the planet's render is a mark, read by the post pass: 1 = the planet (dithered by stage), 0 = the gate's opening
// (show the lab there), 0.5 = always in colour (the machines' pixels, the build ghost).

export const QUAD_VERTEX = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const POST_FRAGMENT = /* glsl */ `
  uniform sampler2D uColour, uDepth, uLab;
  uniform vec2 uRes;
  uniform mat4 uInvProj, uCamWorld;
  uniform vec3 uWaveCentre;
  /** The wave's front on the ground (metres from its centre; < 0 none, > 1e6 done), then on the sky (the sine of the elevation it
   *  has climbed to, from just below the horizon to the zenith): it never pops, it sweeps out to the horizon and up the sky. */
  uniform float uWaveR, uSkyRise, uGlitch, uTime, uLost;
  /** The stage's look outside the wave (and everywhere when no wave runs), and the look the wave brings: x and y = one look pixel
   *  in uv (the stage's resolution), z = colour levels (0 = all), w = 1 for stage 0's dither. */
  uniform vec4 uLookOut, uLookIn;
  /** Stage 0 (the stage bible, plan 27): the sun, the gate, the first machine's scan ring (uScanR < 0: none, centred on
   *  uScanCentre), the wireframe mix (1: wire outside the ring; 0: resolved) and the vertical field of view in radians. */
  uniform vec3 uSunDir, uGatePos, uScanCentre;
  uniform float uScanR, uWireMix, uFovY;
  /** The suit cam (plan 25): its strength (0 = off), the lagging exposure, the barrel k1, the grain amplitude, and the wide
   *  halation (1) or the narrow (0). */
  uniform float uSuitCam, uExposure, uSuitK1, uSuitGrain, uSuitWide;
  varying vec2 vUv;
  /** Per pixel, set at the top of main (fwidth needs every pixel of a quad to run the same code): the world point and the
   *  grid's screen footprint. */
  vec3 gPix;
  vec2 gGridFw;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float bayer4(vec2 p){
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    // the 4x4 ordered-dither matrix, row by row
    float m = 0.0;
    if (i < 0.5) m = 0.0; else if (i < 1.5) m = 8.0; else if (i < 2.5) m = 2.0; else if (i < 3.5) m = 10.0;
    else if (i < 4.5) m = 12.0; else if (i < 5.5) m = 4.0; else if (i < 6.5) m = 14.0; else if (i < 7.5) m = 6.0;
    else if (i < 8.5) m = 3.0; else if (i < 9.5) m = 11.0; else if (i < 10.5) m = 1.0; else if (i < 11.5) m = 9.0;
    else if (i < 12.5) m = 15.0; else if (i < 13.5) m = 7.0; else if (i < 14.5) m = 13.0; else m = 5.0;
    return (m + 0.5) / 16.0;
  }
  vec3 worldAt(vec2 uv, float depth){
    vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    v /= v.w;
    return (uCamWorld * v).xyz;
  }
  float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
  /** A smoothstep that also runs backwards (a > b): 0 at a, 1 at b. */
  float ramp(float x, float a, float b){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
  vec3 safeNormal(vec3 v){ float l = length(v); return l > 1e-12 ? v / l : vec3(0.0, 1.0, 0.0); }
  float breakRatio(float a, float b){ return max(a, b) / max(min(a, b), 0.001); }
  /** A depth break: the linear depths differ by more than 12% and by at least half a metre (far depth is noisy). */
  float brk(float a, float b){ return (breakRatio(a, b) > 1.12 && abs(a - b) > 0.5) ? 1.0 : 0.0; }

  /** Stage 0 (the stage bible, sections 1 to 4): one look cell is one pixel of the picture, and it is coloured by its world
   *  facet. 0a: the black fill, the 1 px edges where depth or the facet's normal breaks, the 2 m world grid converging to 180 m.
   *  0b: the cell's sun light and colour, thresholded by the world-locked Bayer matrix (the threshold follows the world
   *  direction, Obra Dinn's way, so it holds still when you turn), with a 1 px contour at depth breaks and a distance gradient.
   *  The gate's amber pool (DEC-06) turns the light ink amber within 15 m, full within 3.5 m. */
  vec3 stage0(vec4 look, vec2 uv){
    vec3 black = vec3(0.0196, 0.0235, 0.0314);
    vec2 cell = floor(uv / look.xy);
    vec2 c = (cell + 0.5) * look.xy;
    vec2 dx = vec2(look.x, 0.0), dy = vec2(0.0, look.y);
    vec3 cam = uCamWorld[3].xyz;
    float dC = texture2D(uDepth, c).x;
    if (dC >= 0.99999) return black;
    vec3 P = worldAt(c, dC);
    vec3 PR = worldAt(c + dx, texture2D(uDepth, c + dx).x);
    vec3 PL = worldAt(c - dx, texture2D(uDepth, c - dx).x);
    vec3 PU = worldAt(c + dy, texture2D(uDepth, c + dy).x);
    vec3 PD = worldAt(c - dy, texture2D(uDepth, c - dy).x);
    // the flat facet: the normal from the four neighbours, facing the camera
    vec3 N = safeNormal(cross(PR - PL, PU - PD));
    if (dot(N, cam - P) < 0.0) N = -N;
    // a crease: the normal of any one of the four quadrants turns away from the cell's own (a depth break is the other edge)
    float crease = min(
      min(abs(dot(safeNormal(cross(PR - P, PU - P)), N)), abs(dot(safeNormal(cross(P - PL, PU - P)), N))),
      min(abs(dot(safeNormal(cross(PR - P, P - PD)), N)), abs(dot(safeNormal(cross(P - PL, P - PD)), N))));
    float L = length(P - cam);
    float depthBreak = max(
      max(brk(L, length(PR - cam)), brk(L, length(PL - cam))),
      max(brk(L, length(PU - cam)), brk(L, length(PD - cam))));
    // the crease test is for near ground: far away the depth is too coarse to read a facet's normal (it drew a white band at the horizon)
    float edge = ((crease < 0.85 && L < 150.0) || depthBreak > 0.5) ? 1.0 : 0.0;
    // the gate's amber pool (DEC-06): #e8eef5 white outside, #ffc13d amber within 15 m, full within 3.5 m
    float pool = ramp(length(P - uGatePos), 15.0, 3.5);
    vec3 ink = mix(vec3(0.9098, 0.9333, 0.9608), vec3(1.0, 0.7569, 0.2392), pool);
    // the world-locked threshold: the ray through this pixel, with no depth (the brief's way), so a world point keeps its threshold
    // when the view turns; one look pixel to a Bayer cell, and the azimuth wraps in a whole number of 4-cell periods (no seam at +-pi)
    vec3 dir = normalize(worldAt(uv, 1.0) - cam);
    float pxA = uFovY * look.y;
    float cells = max(4.0, 4.0 * floor(6.2831853 / (4.0 * pxA) + 0.5));
    float size = 6.2831853 / cells;
    float raw = bayer4(vec2(floor(atan(dir.x, dir.z) / size), floor(asin(clamp(dir.y, -1.0, 1.0)) / size)));
    float thr = raw + 0.18 * ramp(L, 60.0, 600.0);
    // the scan ring: inside it the world is resolved; outside it is wire, dissolving one bit at a time after the ring holds
    float Ls = length((P - uScanCentre).xz);
    float resolved = (uScanR >= 0.0 && Ls < uScanR) ? 1.0 : 0.0;
    float wire = resolved > 0.5 ? 0.0 : step(raw, uWireMix);
    // the lum: mostly the facet's sun light (the form, world-locked), a little of the planet's colour at the cell (its texture)
    vec3 rgb = texture2D(uColour, c).rgb;
    float tone = ramp(luma(pow(rgb, vec3(1.0 / 2.2))), 0.14, 0.6);
    float facet = clamp(dot(N, normalize(uSunDir)) * 0.65 + 0.28, 0.05, 0.95);
    float lum = mix(tone, facet, 0.8);
    // the 0b contour is the depth break only: the crease test flickers as the cells move (it is kept for 0a, the wire)
    float bit = max(step(thr, lum), max(depthBreak, 0.0));
    vec3 dither = bit > 0.5 ? ink : black;
    // the wire: the 2 m world grid per pixel (so it antialiases), converging and gone by 180 m
    vec3 Pp = gPix;
    vec2 g = Pp.xz / 2.0;
    vec2 gd = abs(fract(g - 0.5) - 0.5) / max(gGridFw, vec2(1e-4));
    float grid = (1.0 - min(min(gd.x, gd.y), 1.0)) * (1.0 - ramp(length(Pp - cam), 60.0, 180.0)) * 0.45;
    vec3 wireCol = mix(black, ink, max(edge, grid));
    return mix(dither, wireCol, wire);
  }

  /** The suit cam's colour on the planet's picture (plan 25): the lateral chromatic aberration in the corners only, a 3x3
   *  luma micro-sharpen, and the warm halation of the bright neighbours (wide on Medium up and Full, narrow on Low). */
  vec3 suitColour(vec2 c, vec2 uv, vec3 rgb){
    vec2 q = uv - 0.5;
    vec2 t = 1.0 / uRes;
    vec2 ca = q * (0.0036 * dot(q, q)) * uSuitCam;
    rgb.r = texture2D(uColour, c + ca).r;
    rgb.b = texture2D(uColour, c - ca).b;
    vec3 n = texture2D(uColour, c + vec2(t.x, t.y)).rgb + texture2D(uColour, c + vec2(-t.x, t.y)).rgb
           + texture2D(uColour, c + vec2(t.x, -t.y)).rgb + texture2D(uColour, c + vec2(-t.x, -t.y)).rgb;
    rgb += (rgb - n * 0.25) * (0.30 * uSuitCam);
    float h = uSuitWide > 0.5 ? 5.0 : 2.5;
    float bright = smoothstep(0.82, 1.0, luma(texture2D(uColour, c + t * h * vec2(1.0, 1.0)).rgb))
                 + smoothstep(0.82, 1.0, luma(texture2D(uColour, c + t * h * vec2(-1.0, 1.0)).rgb))
                 + smoothstep(0.82, 1.0, luma(texture2D(uColour, c + t * h * vec2(1.0, -1.0)).rgb))
                 + smoothstep(0.82, 1.0, luma(texture2D(uColour, c + t * h * vec2(-1.0, -1.0)).rgb));
    rgb += vec3(1.0, 0.957, 0.863) * (bright * 0.25 * 0.22 * uSuitCam);
    return rgb;
  }

  /** The planet's colour for a look: its pixels (cells of the picture), its colour levels, stage 0's wire and dither, or colour. */
  vec3 lookAt(vec4 look, vec2 uv){
    if (look.w > 0.5) return stage0(look, uv);
    vec2 cell = floor(uv / look.xy);
    vec2 cellUv = (cell + 0.5) * look.xy;
    vec3 rgb = texture2D(uColour, cellUv).rgb;
    if (look.z > 0.0) {
      // the early stages' few colour levels, posterised with the same ordered dither
      vec3 c = floor(pow(rgb, vec3(1.0 / 2.2)) * look.z + bayer4(cell)) / look.z;
      return pow(c, vec3(2.2));
    }
    if (uSuitCam > 0.0) rgb = suitColour(cellUv, uv, rgb);
    return rgb;
  }

  /** The suit cam's optics on the finished colour (plan 25): the lagging exposure, the CMOS S-curve with an early warm clip, the
   *  cos^4 vignette and the grain (2.5% at most, in the midtones). All of it scales with the strength. */
  vec3 suitCam(vec3 c, vec2 uv){
    vec2 q = uv - 0.5;
    c = mix(c, c * uExposure, uSuitCam);
    vec3 rolled = mix(c, 0.78 + 0.22 * (1.0 - exp(-(c - 0.78) / 0.22 * 2.2)), step(vec3(0.78), c));
    rolled = mix(rolled, vec3(1.0, 0.988, 0.961), smoothstep(0.92, 1.0, luma(rolled)) * 0.6);
    rolled = max(rolled - 0.02 * (1.0 - smoothstep(0.0, 0.08, rolled)), 0.0);
    c = mix(c, rolled, uSuitCam);
    c *= mix(1.0, pow(cos(length(q) * 1.33), 4.0), 0.28 * uSuitCam);
    float l = luma(c);
    float grain = (hash(floor(uv * uRes) + floor(uTime * 24.0)) - 0.5) * 2.0 * uSuitGrain;
    c += grain * 4.0 * l * (1.0 - l) * uSuitCam;
    return c;
  }

  void main(){
    vec2 uv = vUv;
    // the suit cam's lens: a gentle barrel, the corners pulled in (k1 about -0.035 on Auto)
    if (uSuitCam > 0.0) {
      vec2 q = uv - 0.5;
      uv = 0.5 + q * (1.0 + uSuitK1 * dot(q, q));
    }
    // losing sync tears the picture: bands slide sideways, more as it runs out
    if (uGlitch > 0.0) {
      float band = floor(uv.y * 38.0 + floor(uTime * 9.0) * 7.0);
      float shift = (hash(vec2(band, floor(uTime * 12.0))) - 0.5) * uGlitch * uGlitch * 0.12;
      uv.x += step(1.0 - uGlitch * 0.6, hash(vec2(band, 3.0))) * shift;
    }
    // the pixel's world point and its flat facet: the derivatives of the world point give the triangle's own normal (the bible's 0b)
    gPix = worldAt(uv, texture2D(uDepth, uv).x);
    gGridFw = fwidth(gPix.xz / 2.0);
    vec2 px = uv * uRes;
    vec4 fine = texture2D(uColour, uv);
    if (fine.a < 0.25) { gl_FragColor = vec4(texture2D(uLab, uv).rgb, 1.0); return; }
    vec3 c = fine.rgb;
    if (fine.a >= 0.75) {
      float d = texture2D(uDepth, uv).x;
      // the sky writes no depth: what is drawn is ground (the plot, the plains, the neighbours), what is not is sky
      bool sky = d >= 0.99999;
      float inside = 0.0, front = 0.0;
      if (uWaveR > 1e6) inside = 1.0;
      else if (uWaveR >= 0.0) {
        if (!sky) {
          float dist = length(worldAt(uv, d) - uWaveCentre);
          inside = step(dist, uWaveR);
          // the band of light widens as the front races out, so far away it still shows
          front = smoothstep(max(6.0, uWaveR * 0.04), 0.0, uWaveR - dist);
        } else {
          // the sky: the front climbs from the horizon to the zenith once the ground is crossed
          vec3 ray = normalize(worldAt(uv, 1.0) - uCamWorld[3].xyz);
          inside = step(ray.y, uSkyRise);
          front = smoothstep(0.07, 0.0, uSkyRise - ray.y);
        }
      }
      // inside the wave the stage it brings, outside the stage the plot shows; the front is a band of light where the new look arrives
      c = inside > 0.5 ? lookAt(uLookIn, uv) : lookAt(uLookOut, uv);
      c += vec3(1.0, 0.24, 0.54) * front * inside * 0.32;
    }
    if (uSuitCam > 0.0) c = suitCam(c, uv);
    // static where sync is going, and a white-out when it is lost
    float n = hash(floor(px) + floor(uTime * 30.0));
    gl_FragColor = vec4(mix(c, vec3(n), clamp(uGlitch * uGlitch * 0.35 + uLost, 0.0, 1.0)), 1.0);
    #include <colorspace_fragment>
  }`;

/** The gate's opening, seen from the lab: the planet's picture by screen position, static while it resolves. */
export const OPENING_VERTEX = /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const OPENING_FRAGMENT = /* glsl */ `
  uniform sampler2D uView;
  uniform vec2 uScreen;
  uniform float uStatic, uTime;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = gl_FragCoord.xy / uScreen;
    vec3 view = texture2D(uView, uv).rgb;
    float n = hash(floor(gl_FragCoord.xy / 3.0) + floor(uTime * 24.0));
    float roll = 0.5 + 0.5 * sin(gl_FragCoord.y * 0.08 - uTime * 14.0);
    vec3 noise = vec3(n * (0.55 + 0.45 * roll)) * vec3(0.8, 0.85, 0.95);
    gl_FragColor = vec4(mix(view, noise, uStatic), 1.0);
    #include <colorspace_fragment>
  }`;

/** Marks for the planet's render: the gate's opening (alpha 0) and things always in colour (alpha 0.5). */
export const MARK_VERTEX = /* glsl */ `
  varying vec3 vN;
  void main(){
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    #else
      vN = normalize(mat3(modelMatrix) * normal);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * p;
  }`;
export const OPENING_MARK_FRAGMENT = /* glsl */ `void main(){ gl_FragColor = vec4(0.0); }`;
export const COLOUR_MARK_FRAGMENT = /* glsl */ `
  uniform vec3 uColour; uniform float uLit;
  varying vec3 vN;
  void main(){
    float shade = mix(1.0, 0.55 + 0.45 * max(0.0, dot(normalize(vN), normalize(vec3(0.4, 0.8, 0.3)))), uLit);
    gl_FragColor = vec4(uColour * shade, 0.5);
  }`;

/** Plume ground glow: a soft coloured glow on the ground under each pouring machine (POL-02). */
export const PLUME_GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const PLUME_GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  uniform float uStrength;
  uniform float uTime;
  varying vec2 vUv;
  void main(){
    vec2 c = vUv - vec2(0.5);
    float d = length(c) * 2.0;
    if (d >= 1.0) discard;
    float falloff = (1.0 - d * d) * (1.0 - d * d);
    float pulse = 0.9 + 0.1 * sin(uTime * 4.5 + c.x * 3.0);
    float intensity = falloff * uStrength * pulse * 1.6;
    gl_FragColor = vec4(uColour * intensity, 1.0);
  }
`;

/** Piece hologram shader: additive, fresnel rim, world-space scanlines, slow pulse (1.2s) */
export const PIECE_HOLO_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const PIECE_HOLO_FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    float rim = 1.0 - max(dot(vViewDir, vNormal), 0.0);
    rim = pow(rim, 2.0);
    float scanline = sin(vWorldPos.y * 20.0 + uTime * 4.0) * 0.15 + 0.85;
    float pulse = 0.85 + 0.15 * sin(uTime * 5.236);
    float alpha = (rim * 0.65 + 0.35) * scanline * pulse;
    vec3 col = uColour * (1.0 + rim * 0.8);
    gl_FragColor = vec4(col, alpha * 0.75);
  }
`;

