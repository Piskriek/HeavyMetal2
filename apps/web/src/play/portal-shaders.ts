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
   *  in uv (the stage's resolution), z = colour levels (0 = all), w = 1 for stage 0's black-and-white dither. */
  uniform vec4 uLookOut, uLookIn;
  varying vec2 vUv;

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
  /** The planet at a stage's look: its pixels (cells of the picture), its colour levels, or stage 0's black and white. */
  vec3 lookAt(vec4 look, vec2 uv){
    vec2 cell = floor(uv / look.xy);
    vec3 rgb = texture2D(uColour, (cell + 0.5) * look.xy).rgb;
    if (look.w > 0.5) {
      // stage 0: faint stars and haze drop to black; the ground's gentle middle tones are stretched apart, so lit and shaded
      // slopes, stones and patches still read as land in one bit
      float l = smoothstep(0.14, 0.6, dot(pow(rgb, vec3(1.0 / 2.2)), vec3(0.299, 0.587, 0.114)));
      return mix(vec3(0.003, 0.0034, 0.004), vec3(0.74, 0.75, 0.72), step(bayer4(cell), l));
    }
    if (look.z > 0.0) {
      // the early stages' few colour levels, posterised with the same ordered dither
      vec3 c = floor(pow(rgb, vec3(1.0 / 2.2)) * look.z + bayer4(cell)) / look.z;
      return pow(c, vec3(2.2));
    }
    return rgb;
  }

  void main(){
    vec2 uv = vUv;
    // losing sync tears the picture: bands slide sideways, more as it runs out
    if (uGlitch > 0.0) {
      float band = floor(uv.y * 38.0 + floor(uTime * 9.0) * 7.0);
      float shift = (hash(vec2(band, floor(uTime * 12.0))) - 0.5) * uGlitch * uGlitch * 0.12;
      uv.x += step(1.0 - uGlitch * 0.6, hash(vec2(band, 3.0))) * shift;
    }
    vec2 px = uv * uRes;
    vec4 fine = texture2D(uColour, uv);
    if (fine.a < 0.25) { gl_FragColor = vec4(texture2D(uLab, uv).rgb, 1.0); return; }
    if (fine.a < 0.75) { gl_FragColor = vec4(fine.rgb, 1.0); }
    else {
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
      vec3 c = inside > 0.5 ? lookAt(uLookIn, uv) : lookAt(uLookOut, uv);
      c += vec3(1.0, 0.24, 0.54) * front * inside * 0.32;
      gl_FragColor = vec4(c, 1.0);
    }
    // static where sync is going, and a white-out when it is lost
    float n = hash(floor(px) + floor(uTime * 30.0));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(n), clamp(uGlitch * uGlitch * 0.35 + uLost, 0.0, 1.0));
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
    vNormal = normalize(normalMatrix * normal);
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

