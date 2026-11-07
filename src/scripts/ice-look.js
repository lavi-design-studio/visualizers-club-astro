// The ice the club's weathervane is cut from (assets/logo-ice.glb), shared by the landing page's hero
// (ice.js) and the sign-up page's rooster (rooster.js): its look, each colour's index of refraction,
// the shaders that bend what is behind it through it, and the model made ready to draw
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// the look, to be tuned
export const ICE = {
  pink: '#FF00AA', blue: '#3186CF', magenta: '#c239c7',
  refract: .32,      // how far the ice bends what is behind it
  aberration: .55,   // how far apart its colours go
  saturation: 1.12,
  shininess: 60, diffuseness: .03, fresnel: 7,
  turns: 1,          // how many times it turns round on the way down to the last frame
  beam: 0,           // the light fanning out of it: its brightness (0: none)
  spread: .2,        // and its width, as an angle
  palette: 0,         // how far the ice's colours are drawn into the page's (blue, magenta, pink); 0: its own spectrum
  size: .508,        // the logo's height in the hero, a share of the screen's (over the type, as it may be)
  trackLight: 60, trackShare: .6,   // how bright a place on the ice must be for the tracking to take it: a share of the frame's brightest, at least this (0-255)
  trackMax: 7,       // and how many it follows at once (the big, named ones)
  marks: 40,         // the most features it follows with small squares
  featShare: .35,    // how strongly a place must stand out to be one (a share of the strongest)
  scaffold: false,   // the box ruled round it (off: the tracking alone)
  after: 0,          // how long after the hero's rules start it begins to grow (s)
  landRun: 1.25,     // how many screens of scroll it takes to fly into the last frame's brackets, from the frame coming into view
  halo: 0,           // its own glow's strength (0: none)
  scrollGrow: .3,    // how much larger it grows as the hero scrolls away
  y: .703,           // and its middle, down the screen
};
// the vane's mast, in the model's units (its box is centred; the mast stands right of the middle)
export const MAST_X = 12.65, MAST_SVG = 60.5 / 95.7;   // (and in the SVG's outline: its share of the width)
export const IOR = { r: 1.15, y: 1.16, g: 1.18, c: 1.22, b: 1.22, v: 1.22 };

// ----- the ice -----
export const iceVert = /* glsl */`
  varying vec3 vN, vEye, vO;
  void main() {
    vO = position;
    vec4 w = modelMatrix * vec4(position, 1.);
    vN = normalize(mat3(modelMatrix) * normal);
    vEye = normalize(w.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
export const iceFrag = /* glsl */`
  uniform sampler2D uTexture;
  uniform vec2 uRes;
  uniform float uRefract, uAberration, uSaturation, uShininess, uDiffuseness, uFresnel, uTime, uGrow;
  uniform float uIorR, uIorY, uIorG, uIorC, uIorB, uIorV;
  uniform vec3 uLight, uPink, uBlue, uMag;
  uniform float uPalette, uDither, uCell;
  uniform vec2 uOrigin;   // the rooster's mast on the screen (device px): the dither's cells are laid from it, so they move with it
  varying vec3 vN, vEye, vO;
  #define LOOP 6

  float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.02; a *= .5; } return s; }
  // the last frame's dither (vane3d.js had it): one bit, a 4x4 Bayer threshold on the summed channels,
  // in cells uCell device pixels square, black and the portrait's dark magenta
  float bayer4(ivec2 p) {
    float m[16] = float[16](16., 5., 13., 1., 8., 12., 4., 9., 14., 2., 15., 3., 6., 10., 7., 11.);
    return m[p.x * 4 + p.y] / 17.;
  }
  vec3 sat(vec3 c, float k) { return mix(vec3(dot(c, vec3(.2125, .7154, .0721))), c, k); }
  // the page's colours by brightness: black, blue, magenta, pink, a pinkish white
  vec3 pal(float t) {
    vec3 c = mix(vec3(0.), uBlue * .9, smoothstep(0., .3, t));
    c = mix(c, uMag, smoothstep(.3, .6, t));
    c = mix(c, uPink, smoothstep(.6, .85, t));
    return mix(c, vec3(1., .92, 1.), smoothstep(.85, 1.2, t));
  }

  void main() {
    // grown out of frost, from the foot up; the front glows
    float frost = fbm(vO * .05);
    float front = (vO.y + 70.) / 140. * .6 + frost * .4;
    if (front > uGrow) discard;
    float edge = smoothstep(.05, 0., uGrow - front) * step(uGrow, 1.);

    vec3 N = normalize(vN);
    #ifdef BACK
      N = -N;
    #endif
    // the ice's slow ripples: the surface bent a little by a soft noise, so the light wanders over it
    vec3 q = vO * .035 + vec3(0., uTime * .05, 0.);
    N = normalize(N + .1 * (vec3(fbm(q + 3.1), fbm(q + 7.7), fbm(q + 1.3)) - .5));
    vec3 E = normalize(vEye);

    vec2 uv = gl_FragCoord.xy / uRes;
    float blur = 0.;                                        // (no mipmaps: the targets are drawn small instead, soft already)
    vec3 rR = refract(E, N, 1. / uIorR), rY = refract(E, N, 1. / uIorY), rG = refract(E, N, 1. / uIorG);
    vec3 rC = refract(E, N, 1. / uIorC), rB = refract(E, N, 1. / uIorB), rV = refract(E, N, 1. / uIorV);
    float r = 0., y = 0., g = 0., c = 0., b = 0., v = 0.;
    for (int i = 0; i < LOOP; i++) {
      float slide = float(i) / float(LOOP) * .1;
      r += texture2D(uTexture, uv + rR.xy * (uRefract + slide) * uAberration, blur).r * .5;
      vec3 sy = texture2D(uTexture, uv + rY.xy * (uRefract + slide * 2.5) * uAberration, blur).rgb;
      y += (sy.r * 2. + sy.g * 2. - sy.b) / 6.;
      g += texture2D(uTexture, uv + rG.xy * (uRefract + slide * 2.) * uAberration, blur).g * .5;
      vec3 sc = texture2D(uTexture, uv + rC.xy * (uRefract + slide * 3.) * uAberration, blur).rgb;
      c += (sc.g * 2. + sc.b * 2. - sc.r) / 6.;
      b += texture2D(uTexture, uv + rB.xy * (uRefract + slide * 4.) * uAberration, blur).b * .5;
      vec3 sv = texture2D(uTexture, uv + rV.xy * (uRefract + slide) * uAberration, blur).rgb;
      v += (sv.b * 2. + sv.r * 2. - sv.g) / 6.;
    }
    float n = float(LOOP);
    r /= n; y /= n; g /= n; c /= n; b /= n; v /= n;
    vec3 col = vec3(r + (2. * v + 2. * y - c) / 3., g + (2. * y + 2. * c - v) / 3., b + (2. * c + 2. * v - y) / 3.);
    col = sat(col, uSaturation);
    // drawn into the page's colours, so no green or yellow of the spectrum shows
    col = mix(col, pal(dot(col, vec3(.2125, .7154, .0721)) * 1.3), uPalette);

    // the ice's own cool tint, and its frost
    col = col * vec3(.9, 1., 1.1) + vec3(.01, .03, .06);
    col += vec3(.7, .85, 1.) * smoothstep(.55, .85, frost) * .12;

    // a glint and a soft light from the pointer
    vec3 L = normalize(uLight);
    vec3 H = normalize(-E + L);
    float nh = max(dot(N, H), 0.);
    float spec = pow(nh * nh, uShininess);
    float diff = max(dot(N, L), 0.) * uDiffuseness;
    // the rim, in the title's colours, down its height
    float fres = pow(1. - abs(dot(E, N)), uFresnel);
    vec3 glow = mix(uPink, uBlue, smoothstep(-60., 60., vO.y + 25. * sin(uTime * .4)));
    // (the faces are flat: a glint would light a whole face at once as it turns past the light, so it is faint)
    col += spec * .12 * vec3(.95, .98, 1.) + diff + fres * (glow * 1.1 + vec3(.04, .06, .1));
    col += mix(uPink, vec3(1.), .5) * edge * 2.5;
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.);   // (one bad pixel would black out the screen)
    if (uDither > 0.) {
      vec2 cell = floor((gl_FragCoord.xy - uOrigin) / uCell);
      float b = dot(col, vec3(1.)) * .3;
      bool dark = b < 1. / 17. || (b <= 16. / 17. && b < bayer4(ivec2(mod(cell, 4.))));
      col = mix(col, dark ? vec3(0.) : vec3(97., 28., 99.) / 255., uDither);
    }
    gl_FragColor = vec4(min(col, vec3(2.)), 1.);
  }`;

// the model, its quantized positions and normals made floats again, turned upright, its mast at x = 0:
// the geometry and its height in the model's units. buf: the file, when it was fetched already
export async function vaneGeometry(buf) {
  // (meshopt-compressed, its positions and normals quantized: 70 KB on the wire where it was 440; the
  // buffer the loader fetched (body.html), or fetched here when that is missing)
  const url = `${import.meta.env.BASE_URL}assets/logo-ice.glb`;
  buf ??= await fetch(url).then(r => r.arrayBuffer());
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buf, url.slice(0, url.lastIndexOf('/') + 1));
  let mesh;
  gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  // (its quantized positions and normals made floats again and set back in the model's own units, by
  // the node's scale and offset the compression put there, so all below is as it was)
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const a = mesh.geometry.getAttribute(name), f = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
    geo.setAttribute(name, new THREE.BufferAttribute(f, 3));
  }
  geo.setIndex(mesh.geometry.index);
  mesh.updateMatrixWorld(true); geo.applyMatrix4(mesh.matrixWorld);
  geo.rotateX(Math.PI);   // the model stands upside down: turned over, as it is seen
  geo.translate(-MAST_X, 0, 0);   // and turned about its mast, as a vane turns, not about its box
  geo.computeBoundingBox();
  const LOGO_H = geo.boundingBox.max.y - geo.boundingBox.min.y;
  return { geo, LOGO_H };
}

// the ice's uniforms, in its look
export function iceUniforms() {
  return {
    uTexture: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uRefract: { value: ICE.refract }, uAberration: { value: ICE.aberration }, uSaturation: { value: ICE.saturation },
    uShininess: { value: ICE.shininess }, uDiffuseness: { value: ICE.diffuseness }, uFresnel: { value: ICE.fresnel },
    uIorR: { value: IOR.r }, uIorY: { value: IOR.y }, uIorG: { value: IOR.g }, uIorC: { value: IOR.c }, uIorB: { value: IOR.b }, uIorV: { value: IOR.v },
    uLight: { value: new THREE.Vector3(-1, 1, 1) }, uTime: { value: 0 }, uGrow: { value: 0 },
    uPink: { value: new THREE.Color(ICE.pink) }, uBlue: { value: new THREE.Color(ICE.blue) }, uMag: { value: new THREE.Color(ICE.magenta) },
    uPalette: { value: ICE.palette }, uDither: { value: 0 }, uCell: { value: 3 }, uOrigin: { value: new THREE.Vector2() },
  };
}
