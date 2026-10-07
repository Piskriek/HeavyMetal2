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
  uniform float uWaveR, uGlitch, uTime, uLost;
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
      float dist = d >= 0.99999 ? 1e9 : length(worldAt(uv, d) - uWaveCentre);
      // once the wave has crossed, the whole picture is at the new stage (sky and far plains too)
      float inside = uWaveR < 0.0 ? 0.0 : uWaveR > 1e6 ? 1.0 : step(dist, uWaveR);
      if (inside > 0.5) {
        // stage 1: colour at low resolution, gently posterised with the same dither
        vec3 c = pow(fine.rgb, vec3(1.0 / 2.2));
        c = floor(c * 10.0 + bayer4(px)) / 10.0;
        // the wave's front: a band of light where the new look arrives
        float front = uWaveR > 1e5 ? 0.0 : smoothstep(6.0, 0.0, uWaveR - dist);
        c += vec3(1.0, 0.24, 0.54) * front * 0.55;
        gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
      } else {
        // stage 0: black and white ordered dither, in pixels twice as big
        vec2 cell = floor(px / 2.0);
        vec3 coarse = texture2D(uColour, (cell * 2.0 + 1.0) / uRes).rgb;
        float l = dot(pow(coarse, vec3(1.0 / 2.2)), vec3(0.299, 0.587, 0.114));
        // faint stars and haze drop to black; the pale rock spreads over the middle tones, so the land keeps its shapes
        l = smoothstep(0.1, 0.95, l);
        l = l * l * (1.6 - 0.6 * l);
        float on = step(bayer4(cell), l);
        vec3 c = mix(vec3(0.003, 0.0034, 0.004), vec3(0.74, 0.75, 0.72), on);
        gl_FragColor = vec4(c, 1.0);
      }
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
