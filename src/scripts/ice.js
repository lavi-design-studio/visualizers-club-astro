// The hero's picture: the club's weathervane (assets/logo-ice.glb) cut from clear ice, in place of the
// fan's prints while the hero is up. Glass as Maxime Heckel draws it ("Refraction, dispersion, and
// other shader light effects"): what is behind is caught in a texture, the ice's back faces are drawn
// over it bending it, and its front faces bend that again, each colour by its own index (red, yellow,
// green, cyan, blue, violet, sampled along a short slide), so its edges break into rainbows; then a
// glint, and a rim lit in the title's pink and blue (title-shader.js), bloomed.
//   What it bends is the page: the hero's own type and rules, drawn as they are set, over two soft
// lights in the title's colours, one of them the pointer's. It floats, turns toward the pointer, is spun
// a little by the scroll, and grows in out of frost once the loader is done; as the page scrolls and
// the fan opens out, it goes and the fan's prints come up in its place.
//   Through the fan's section it is the picture (the fan's prints are not drawn, fan.js PRINTS): it
// stands fixed in one place, its mast down the middle of the screen, and the scroll turns it round. It
// is drawn only when something changes (the scroll, the pointer, its growing in), so a page at rest
// costs nothing. The last frame (#finale), coming up after the hero, covers it from the foot up.
//   Drawn on a canvas over the page's type, black where it is not, laid on with "screen"
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { gsap } from 'gsap';

// the look, to be tuned
const ICE = {
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
const MAST_X = 12.65, MAST_SVG = 60.5 / 95.7;   // (and in the SVG's outline: its share of the width)
// the course's keywords, mostly the web's, given out in turn to the bright places the tracking finds
// on the ice (shuffled once, and none given again until a good many others have been)
const KEYWORDS = ['WEBSITE', 'LANDING PAGE', 'HERO', 'LAYOUT', 'GRID', 'BREAKPOINT', 'RESPONSIVE', 'MOBILE', 'TABLET',
  'UI', 'UX', 'WIREFRAME', 'PROTOTYPE', 'COMPONENT', 'DESIGN SYSTEM', 'TYPEFACE', 'KERNING', 'PHÂN CẤP', 'MÀU',
  'HTML', 'CSS', 'SCROLL', 'HOVER', 'INTERACTION', 'MOTION', 'ANIMATION', 'WEBGL', 'SHADER', '3D', 'CTA', 'SEO',
  'FIGMA', 'FIGMA → AI', 'CLAUDE', 'PROMPT', 'DEPLOY', 'DOMAIN', 'GO LIVE', 'QA', 'BRIEF', 'MOODBOARD', 'CONCEPT',
  'TENSION', 'NHỊP', 'CRITIQUE'].sort(() => Math.random() - .5);
// the tracking's look: 'blobs' (the keywords on the bright places on the ice, as a blob tracker draws
// them) or, to try, ?track=orbit: the keywords drawn out from the ice, called out round it
const TRACK = new URLSearchParams(location.search).get('track') === 'orbit' ? 'orbit' : 'blobs';
const ORBIT = {
  reach: .62,      // how far out the callouts stand, sideways: a share of the rooster's height (kept on the screen)
  rise: .44,       // and up and down (the same share): an ellipse round it
  side: 50,        // how far off the horizontal a callout may stand, at most (degrees): they keep to its two sides
  gap: 22,         // the least angle between two callouts on one side (degrees)
  grow: .22,       // how much of its leader a new callout draws each frame
};
const IOR = { r: 1.15, y: 1.16, g: 1.18, c: 1.22, b: 1.22, v: 1.22 };

const stage = document.getElementById('fanStage'), hero = document.getElementById('hero'), slot = document.getElementById('fanSlot'), fan = document.getElementById('fan'), finale = document.getElementById('finale');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

// ----- what is behind: the page, and its lights -----
// the hero's type and rules, as they are set, on black, in the hero's frame (half the screen's pixels)
const page = document.createElement('canvas'), pg = page.getContext('2d');
const pageTex = new THREE.CanvasTexture(page);
pageTex.colorSpace = THREE.SRGBColorSpace;
function drawPage() {
  const k = .5, W = innerWidth, H = hero.offsetHeight, hr = hero.getBoundingClientRect();
  page.width = Math.round(W * k); page.height = Math.round(H * k);
  pg.setTransform(k, 0, 0, k, 0, 0);
  pg.fillStyle = '#000'; pg.fillRect(0, 0, W, H);
  const title = hero.querySelector('.hero-title'), tr = title.getBoundingClientRect();
  const grad = pg.createLinearGradient(tr.left, tr.top, tr.right, tr.bottom);
  grad.addColorStop(0, ICE.blue); grad.addColorStop(.5, ICE.pink); grad.addColorStop(1, ICE.blue);
  const walk = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT), rg = document.createRange();
  for (let t; (t = walk.nextNode());) {
    const el = t.parentElement;
    if (!t.data.trim() || el.closest('.sr-only, svg') || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el), up = cs.textTransform === 'uppercase';
    pg.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    pg.fillStyle = title.contains(el) ? grad : ICE.magenta;
    const asc = pg.measureText('H').fontBoundingBoxAscent;
    for (let i = 0; i < t.length; i++) {
      const ch = t.data[i];
      if (!ch.trim()) continue;
      rg.setStart(t, i); rg.setEnd(t, i + 1);
      const b = rg.getBoundingClientRect();
      if (b.width) pg.fillText(up ? ch.toUpperCase() : ch, b.left - hr.left, b.top - hr.top + asc);
    }
  }
  pg.fillStyle = ICE.magenta;
  for (const i of hero.querySelectorAll('.hero-rule i')) { const r = i.getBoundingClientRect(); pg.fillRect(r.left - hr.left, r.top - hr.top, r.width, Math.max(1.5, r.height)); }
  pageTex.needsUpdate = true;
}
// the backdrop, the screen's size: the page where it is on the screen (it scrolls with the hero), fine
// lines across it as the page's rules so the ice always has lines to break, and two soft lights
const backdropFrag = /* glsl */`
  uniform sampler2D uPage;
  uniform vec2 uView;          // the screen, css px
  uniform float uHeroH, uTop, uTime;
  uniform vec2 uPtr;           // the pointer, uv
  uniform vec3 uPink, uBlue;
  varying vec2 vUv;
  void main() {
    vec2 px = vec2(vUv.x, 1. - vUv.y) * uView;             // top down
    vec2 h = vec2(px.x / uView.x, (px.y - uTop) / uHeroH);
    vec3 c = (h.y >= 0. && h.y <= 1.) ? texture2D(uPage, vec2(h.x, 1. - h.y)).rgb : vec3(0.);
    float line = smoothstep(.96, 1., abs(sin((px.y + uTime * 6.) * .045))) * .6;
    c += mix(vec3(.76, .22, .78), vec3(.6, .85, 1.), step(.5, fract(px.y * .0072))) * line;
    float asp = uView.x / uView.y;
    vec2 a = vec2(.55 + .22 * sin(uTime * .21), .55 + .18 * cos(uTime * .17));
    vec2 d1 = (vUv - a) * vec2(asp, 1.), d2 = (vUv - uPtr) * vec2(asp, 1.);
    c += uBlue * exp(-22. * dot(d1, d1)) * .1 + uPink * exp(-40. * dot(d2, d2)) * .12;
    gl_FragColor = vec4(c, 1.);
  }`;

// ----- the prism's light: a thin ray into the ice, a soft fan out of it in the page's colours -----
const beamFrag = /* glsl */`
  uniform vec2 uView, uO;      // the screen; the ice's middle (css px, y up)
  uniform float uAng, uSpread, uI, uTime, uLen;
  uniform vec3 uPink, uBlue, uMag;
  varying vec2 vUv;
  float h(float n) { return fract(sin(n) * 43758.5453); }
  float n1(float x) { float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.), f * f * (3. - 2. * f)); }
  float diff(float a, float b) { return atan(sin(a - b), cos(a - b)); }
  void main() {
    vec2 p = vUv * uView - uO;
    float r = length(p);
    if (r < 1.) { gl_FragColor = vec4(0., 0., 0., 1.); return; }   // (no angle at the very middle)
    float a = atan(p.y, p.x);
    // the fan: blue on one side, magenta down its middle, pink on the other, fine rays through it
    float t = clamp(diff(a, uAng) / uSpread, -1.5, 1.5);
    float cone = exp(-t * t * 2.2);
    vec3 tint = t < 0. ? mix(uMag, uBlue, smoothstep(0., 1., -t)) : mix(uMag, uPink, smoothstep(0., 1., t));
    float rays = .7 + .3 * n1(a * 140. + uTime * .4) * n1(a * 37. - uTime * .2);
    float fall = smoothstep(20., 140., r) * exp(-r / uLen);
    vec3 c = tint * cone * rays * fall;
    // the ray coming in from the other side: a hairline, faintly pink
    vec2 dir = vec2(cos(uAng + 3.14159 + .35), sin(uAng + 3.14159 + .35));
    float along = max(dot(p, dir), 0.), across = abs(dot(p, vec2(-dir.y, dir.x)));
    c += mix(vec3(1.), uPink, .3) * step(.001, along) * exp(-across * across / (1.5 + along * .02)) * exp(-along / uLen) * .35;
    // a small soft flare where they meet
    c += mix(vec3(1.), uMag, .4) * exp(-r * r / 400.) * .35;
    gl_FragColor = vec4(c * uI, 1.);
  }`;

// ----- the ice -----
const iceVert = /* glsl */`
  varying vec3 vN, vEye, vO;
  void main() {
    vO = position;
    vec4 w = modelMatrix * vec4(position, 1.);
    vN = normalize(mat3(modelMatrix) * normal);
    vEye = normalize(w.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const iceFrag = /* glsl */`
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

async function build() {
  const canvas = document.createElement('canvas');
  canvas.className = 'ice'; canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  // the tracking over it: a 2D canvas laid on top, drawn in the same frames as the scene (ice-track)
  const track = document.createElement('canvas'), tg = track.getContext('2d');
  track.className = 'ice-track'; track.setAttribute('aria-hidden', 'true');
  document.body.append(track);
  // and a small copy of each frame the tracking reads its bright places from
  const SW = 160, probe = document.createElement('canvas'), pgx = probe.getContext('2d', { willReadFrequently: true });
  // (clear where it is not: it lies over the page as it is, solid, over everything)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  // (no tone mapping: it shifts the pink toward orange and greys the blue; the colours stay as drawn)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, .1, 200);   // a little perspective, so the scaffold round it reads as a box
  camera.position.set(0, 0, 26);

  // the backdrop, drawn on a quad over the whole screen
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uPage: { value: pageTex }, uView: { value: new THREE.Vector2(1, 1) }, uHeroH: { value: 1 }, uTop: { value: 0 }, uTime: { value: 0 },
      uPtr: { value: new THREE.Vector2(.5, .5) }, uPink: { value: new THREE.Color(ICE.pink) }, uBlue: { value: new THREE.Color(ICE.blue) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: backdropFrag, depthTest: false, depthWrite: false,
  }));
  const behind = new THREE.Scene(); behind.add(backdrop);

  // (meshopt-compressed, its positions and normals quantized: 70 KB on the wire where it was 440; the
  // buffer the loader fetched (body.html), or fetched here when that is missing)
  const url = `${import.meta.env.BASE_URL}assets/logo-ice.glb`;
  const buf = (await window.logoGlb) ?? (await fetch(url).then(r => r.arrayBuffer()));
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
  const uniforms = {
    uTexture: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uRefract: { value: ICE.refract }, uAberration: { value: ICE.aberration }, uSaturation: { value: ICE.saturation },
    uShininess: { value: ICE.shininess }, uDiffuseness: { value: ICE.diffuseness }, uFresnel: { value: ICE.fresnel },
    uIorR: { value: IOR.r }, uIorY: { value: IOR.y }, uIorG: { value: IOR.g }, uIorC: { value: IOR.c }, uIorB: { value: IOR.b }, uIorV: { value: IOR.v },
    uLight: { value: new THREE.Vector3(-1, 1, 1) }, uTime: { value: 0 }, uGrow: { value: 0 },
    uPink: { value: new THREE.Color(ICE.pink) }, uBlue: { value: new THREE.Color(ICE.blue) }, uMag: { value: new THREE.Color(ICE.magenta) },
    uPalette: { value: ICE.palette }, uDither: { value: 0 }, uCell: { value: 3 }, uOrigin: { value: new THREE.Vector2() },
  };
  const backMat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(uniforms), vertexShader: iceVert, fragmentShader: iceFrag, side: THREE.BackSide, defines: { BACK: '' } });
  const frontMat = new THREE.ShaderMaterial({ uniforms, vertexShader: iceVert, fragmentShader: iceFrag, side: THREE.FrontSide });
  const logo = new THREE.Mesh(geo, frontMat);
  const pivot = new THREE.Group(); pivot.add(logo); scene.add(pivot);
  // the scaffold: a box round it in 3D, turning with it, ruled into a grid on each face, its edges
  // running on past its corners, a dot at each corner. In the model's units, about its middle
  const cage = new THREE.Group(); cage.visible = false; pivot.add(cage);
  const cageMats = [];
  {
    const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2;
    const BW = 150, BH = 175, BD = 150, hw = BW / 2, hh = BH / 2, hd = BD / 2, OVER = 22;
    cage.position.set(cx, 0, 0);
    // (hairlines: the edges at half strength, the faces' grid dashed and fainter still, the tracks' own
    // lines clear; each a share of the scaffold's fade, userData.k)
    const mat = (k, dashed) => { const m = dashed ? new THREE.LineDashedMaterial({ color: ICE.magenta, transparent: true, opacity: 0, dashSize: 3, gapSize: 4 })
      : new THREE.LineBasicMaterial({ color: ICE.magenta, transparent: true, opacity: 0 }); m.userData.k = k; cageMats.push(m); return m; };
    const line = mat(.5), faint = mat(.16, true);
    const seg = (arr, a, b) => arr.push(...a, ...b);
    const edges = [], grid = [];
    // the twelve edges, each run on past both its corners
    for (const y of [-hh, hh]) for (const z of [-hd, hd]) seg(edges, [-hw - OVER, y, z], [hw + OVER, y, z]);
    for (const x of [-hw, hw]) for (const z of [-hd, hd]) seg(edges, [x, -hh - OVER, z], [x, hh + OVER, z]);
    for (const x of [-hw, hw]) for (const y of [-hh, hh]) seg(edges, [x, y, -hd - OVER], [x, y, hd + OVER]);
    // a grid of thirds on each face
    for (const f of [1 / 3, 2 / 3]) {
      const x = -hw + BW * f, y = -hh + BH * f, z = -hd + BD * f;
      for (const zz of [-hd, hd]) { seg(grid, [x, -hh, zz], [x, hh, zz]); seg(grid, [-hw, y, zz], [hw, y, zz]); }
      for (const xx of [-hw, hw]) { seg(grid, [xx, -hh, z], [xx, hh, z]); seg(grid, [xx, y, -hd], [xx, y, hd]); }
      for (const yy of [-hh, hh]) { seg(grid, [x, yy, -hd], [x, yy, hd]); seg(grid, [-hw, yy, z], [hw, yy, z]); }
    }
    const lines = (arr, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const l = new THREE.LineSegments(g, m); if (m.isLineDashedMaterial) l.computeLineDistances(); return l; };
    cage.add(lines(edges, line), lines(grid, faint));
    // a dot at each corner
    const dots = [];
    for (const x of [-hw, hw]) for (const y of [-hh, hh]) for (const z of [-hd, hd]) dots.push(x, y, z);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    const dm = new THREE.PointsMaterial({ color: ICE.magenta, size: 5, sizeAttenuation: false, transparent: true, opacity: 0 }); cageMats.push(dm);
    cage.add(new THREE.Points(dg, dm));
  }
  // its own glow: a soft light behind it in the title's pink and blue, facing us however it turns
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uPink: { value: new THREE.Color(ICE.pink) }, uBlue: { value: new THREE.Color(ICE.blue) }, uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 uPink, uBlue; uniform float uA; varying vec2 vUv;
      void main() { vec2 d = (vUv - .5) * vec2(1.4, 1.); float r = length(d);
        float a = exp(-r * r * 9.) * uA; gl_FragColor = vec4(mix(uPink, uBlue, smoothstep(.2, .8, vUv.y)) * a, a); }`,
    transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true,
  }));
  halo.renderOrder = -1; scene.add(halo);

  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uView: { value: new THREE.Vector2(1, 1) }, uO: { value: new THREE.Vector2() }, uAng: { value: .8 }, uSpread: { value: ICE.spread },
      uI: { value: 0 }, uTime: { value: 0 }, uLen: { value: 600 },
      uPink: { value: new THREE.Color(ICE.pink) }, uBlue: { value: new THREE.Color(ICE.blue) }, uMag: { value: new THREE.Color(ICE.magenta) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: beamFrag, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
  }));
  beam.frustumCulled = false; beam.renderOrder = 1;
  if (ICE.beam > 0) scene.add(beam);

  // the backdrop, then the ice's back faces bending it, each in a target of its own
  // (at half the screen's pixels and without mipmaps: they are only seen bent and blurred through the ice)
  const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter });
  const behindRT = rt(), backRT = rt();
  backMat.uniforms.uTexture.value = behindRT.texture;
  frontMat.uniforms.uTexture.value = backRT.texture;


  let W = 1, H = 1, dpr = 1, fanTop = 0, finTop = 1, heroH = 1;
  const land = { x: 0, y: 0, h: 0 };   // and where it lands, in the page (css px)
  // where it lands: the last frame's weathervane between its brackets (its mast, its middle, its height);
  // fan.js draws the frame, so it is looked for again until it is there
  const measureLand = () => {
    const v = finale.querySelector('#vane')?.getBoundingClientRect();
    if (v?.height) Object.assign(land, { x: v.left + v.width * MAST_SVG, y: v.top + scrollY + v.height / 2, h: v.height });
  };
  const fit = () => {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);   // (1.5 at most: the ice is soft, and full Retina costs twice the pixels)
    fanTop = fan.offsetTop; heroH = hero.offsetHeight; finTop = finale.getBoundingClientRect().top + scrollY;   // the layout, read here and not in the frame loop
    // where it lands: the last frame's weathervane between its brackets (its mast, its middle, its height)
    measureLand();
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    const tdpr = Math.min(devicePixelRatio || 1, 2); track.width = Math.round(W * tdpr); track.height = Math.round(H * tdpr); tg.setTransform(tdpr, 0, 0, tdpr, 0, 0);
    probe.width = SW; probe.height = Math.max(1, Math.round(SW * H / W));
    camera.aspect = W / H; camera.updateProjectionMatrix();
    behindRT.setSize(W * dpr / 2, H * dpr / 2); backRT.setSize(W * dpr / 2, H * dpr / 2);
    frontMat.uniforms.uRes.value.set(W * dpr, H * dpr); backMat.uniforms.uRes.value.set(W * dpr / 2, H * dpr / 2);   // (the back faces are drawn into a half-size target)
    backdrop.material.uniforms.uView.value.set(W, H); beam.material.uniforms.uView.value.set(W, H); beam.material.uniforms.uLen.value = Math.max(W, H) * .45;
    drawPage();
    drawn = '';
  };
  let drawn = '';
  fit();
  addEventListener('resize', fit);
  new ResizeObserver(() => fit()).observe(document.body);   // (the page's height changes as it lays out: the last frame's place with it)
  document.addEventListener('hero-settled', fit);   // (the hero's height is final once its type is set)
  document.fonts.ready.then(drawPage);
  await renderer.compileAsync(scene, camera);

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  const grow = { v: 0 };
  let grown = false, lastY = scrollY, spin = 0, spinV = 0;

  // drawn only when something has changed (the scroll, the pointer, its growing in, the screen's size):
  // it stands in one place, and while nothing moves it costs nothing
  gsap.ticker.add((_, deltaMs) => {
    const clamp = x => Math.min(1, Math.max(0, x)), smooth = x => x * x * (3 - 2 * x);
    // landing: from the last frame's top coming in at the screen's foot, it flies
    // down into the brackets, smaller, and takes on the frame's dither as it settles there
    if (!land.h) measureLand();
    // (from the frame's top coming into view at the screen's foot, over landRun screens of scroll)
    const L = land.h ? smooth(clamp((scrollY - (finTop - H)) / (H * ICE.landRun))) : 0;
    const landY = land.y - scrollY;
    if (L >= 1 && landY + land.h < 0) { if (drawn !== 'gone') { renderer.setRenderTarget(null); renderer.clear(); tg.clearRect(0, 0, W, H); drawn = 'gone'; } return; }   // (scrolled on past it)
    // (last of the hero: as its rules start, once its type has come, so the page it shows through it is all there)
    if (!grown && root.classList.contains('hero-lines')) {
      grown = true; drawPage();
      gsap.to(grow, { v: 1.05, duration: reduce ? 0 : 3.1, delay: reduce ? 0 : ICE.after, ease: 'power2.inOut' });
    }
    const dt = Math.min(1 / 30, deltaMs / 1000);
    const mk = 1 - Math.exp(-dt * 3);
    ptr.x += (ptr.tx - ptr.x) * mk; ptr.y += (ptr.ty - ptr.y) * mk;
    if (Math.abs(ptr.tx - ptr.x) < 1e-3) ptr.x = ptr.tx;
    if (Math.abs(ptr.ty - ptr.y) < 1e-3) ptr.y = ptr.ty;
    const v = scrollY - lastY; lastY = scrollY;
    if (!reduce) { spinV += v * .0015 - spin * 18 * dt; spinV *= Math.exp(-dt * 4); spin += spinV * dt * 10; }
    if (Math.abs(spin) < 1e-4 && Math.abs(spinV) < 1e-4) spin = spinV = 0;

    // the scroll turns it round, all the way down (ICE.turns times on the way to the last frame)
    const yaw = scrollY / Math.max(1, finTop) * Math.PI * 2 * ICE.turns + ptr.x * .12 * (1 - L) + spin;
    const heroTop = fanTop - scrollY;   // the hero lies at the section's top
    const state = [yaw, ptr.y, grow.v, heroTop, L, W, H].map(n => n.toFixed(4)).join();
    if (state === drawn && !calling) return;   // (drawn on while a callout is still drawing itself out)
    drawn = state;
    // from its own place to the brackets', in the screen's pixels, then into the scene's units
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, halfW = halfH * camera.aspect;
    // (in the hero it stands low, under the title; as the hero scrolls away it comes to the screen's middle)
    // (and grows by scrollGrow as it does)
    const away = smooth(clamp(scrollY / Math.max(1, heroH)));
    const rest = H * (ICE.y + (.5 - ICE.y) * away), size = H * ICE.size * (1 + ICE.scrollGrow * away);
    const cx = W / 2 + (land.x - W / 2) * L, cy = rest + (landY - rest) * L, ch = size + (land.h - size) * L;
    const k = ch / H * 2 * halfH / LOGO_H;
    pivot.position.set((cx / W * 2 - 1) * halfW, (1 - cy / H * 2) * halfH, 0);
    pivot.scale.setScalar(k);
    pivot.rotation.set(ptr.y * .04 * (1 - L), yaw, 0);
    // its glow, round its middle (not its mast), fading as it becomes the frame's
    halo.position.set(pivot.position.x - MAST_X * k, pivot.position.y, -1);
    halo.scale.set(LOGO_H * k * 1.5, LOGO_H * k * 1.3, 1);
    halo.material.uniforms.uA.value = ICE.halo * Math.min(grow.v, 1) * (1 - L);
    // the scaffold: comes in as the hero goes (closing in from a little larger), goes as it lands
    const tr = smooth(clamp((scrollY - heroH * .35) / (heroH * .7))) * (1 - smooth(clamp(L / .35)));
    cage.visible = ICE.scaffold && tr > .002;
    if (cage.visible) {
      cage.scale.setScalar(1 + .25 * (1 - tr));
      for (const m of cageMats) m.opacity = tr * (m.userData.k ?? 1);
    }

    const B = backdrop.material.uniforms;
    B.uHeroH.value = heroH; B.uTop.value = heroTop; B.uPtr.value.set((ptr.x + 1) / 2, 1 - (ptr.y + 1) / 2);
    for (const m of [frontMat, backMat]) {
      m.uniforms.uGrow.value = grow.v;
      m.uniforms.uLight.value.set(ptr.x * 2 - .4, -ptr.y * 2 + 1, 1.2);
    }
    frontMat.uniforms.uDither.value = smooth(clamp((L - .7) / .3));
    frontMat.uniforms.uCell.value = 3 * dpr;
    frontMat.uniforms.uOrigin.value.set(Math.round(cx * dpr), Math.round((H - cy) * dpr));
    // the backdrop; the backdrop with the back faces over it; then the front faces, bending that
    halo.visible = false;
    renderer.setRenderTarget(behindRT); renderer.render(behind, flat);
    renderer.setRenderTarget(backRT); renderer.render(behind, flat);
    renderer.autoClear = false; logo.material = backMat; renderer.render(scene, camera); renderer.autoClear = true;
    renderer.setRenderTarget(null);
    logo.material = frontMat; halo.visible = ICE.halo > 0;
    // the rooster alone first, read by the tracking (so it follows light on the ice only); then the
    // scaffold over it, behind the rooster where the rooster stands in front of it (the depth kept)
    const cageOn = cage.visible;
    cage.visible = false;
    renderer.render(scene, camera);
    if (tr > 0) { pgx.clearRect(0, 0, probe.width, probe.height); pgx.drawImage(canvas, 0, 0, probe.width, probe.height); }
    if (cageOn) {
      cage.visible = true; logo.visible = false; halo.visible = false;
      renderer.autoClear = false; renderer.render(scene, camera); renderer.autoClear = true;
      logo.visible = true;
    }
    Object.assign(roost, { x: cx, y: cy, h: ch });
    blobTrack(tr);
  });

  // ---- the tracking, as a blob tracker does it: each frame drawn small, its bright places found (a
  // threshold, then each patch of lit cells flooded out to its box), each followed from frame to frame
  // by the nearest of the last (so it keeps its id and its keyword), and drawn as a tracker draws them:
  // a thin box eased after its patch, a mark at its middle, its keyword and a reading, and a line from
  // each to the next. It moves as the light moves over the turning ice ----
  let blobs = [], nextId = 0, feats = [], nextWord = 0;
  let calling = false;                  // a callout still drawing its leader out (callouts)
  const roost = { x: 0, y: 0, h: 1 };   // the rooster on the screen now: its mast, its middle, its height (css px)
  const MAG = ICE.magenta;
  function blobTrack(t) {
    tg.clearRect(0, 0, W, H);
    calling = false;
    if (t < .5) { blobs = []; feats = []; return; }   // (on or off, no fading: it is there once the hero is half gone)
    const sw = probe.width, sh = probe.height;   // (the frame, as it was before the scaffold was drawn over it)
    const px = pgx.getImageData(0, 0, sw, sh).data, lit = new Uint8Array(sw * sh), seen = new Uint8Array(sw * sh);
    // (the threshold follows the frame: a share of its brightest, never under trackLight, so the ice's
    // brightest places are taken however bright it is drawn)
    const lum = new Float32Array(sw * sh);
    let top = 0;
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) { lum[i] = px[j + 3] > 40 ? px[j] * .3 + px[j + 1] * .59 + px[j + 2] * .11 : 0; if (lum[i] > top) top = lum[i]; }
    const thr = Math.max(ICE.trackLight, top * ICE.trackShare);
    for (let i = 0; i < lit.length; i++) lit[i] = lum[i] > thr ? 1 : 0;
    const found = [], stack = [];
    for (let i = 0; i < lit.length; i++) {
      if (!lit[i] || seen[i]) continue;
      let x0 = sw, y0 = sh, x1 = 0, y1 = 0, n = 0;
      stack.push(i); seen[i] = 1;
      while (stack.length) {
        const k = stack.pop(), x = k % sw, y = (k / sw) | 0;
        n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const q of [k - 1, k + 1, k - sw, k + sw]) if (q >= 0 && q < lit.length && lit[q] && !seen[q] && Math.abs((q % sw) - x) <= 1) { seen[q] = 1; stack.push(q); }
      }
      // (a long thin patch is a sliver, not a place: left out)
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (n >= 4 && Math.max(bw, bh) / Math.min(bw, bh) <= 5) found.push({ x0, y0, x1: x1 + 1, y1: y1 + 1, n });
    }
    found.sort((a, b) => b.n - a.n);
    const k = W / sw, now = found.slice(0, ICE.trackMax).map(f => ({ x: f.x0 * k, y: f.y0 * k, w: (f.x1 - f.x0) * k, h: (f.y1 - f.y0) * k, n: f.n }));
    // followed: each found patch takes the nearest track of the last frame, or starts a new one
    const left = [...blobs], next = [];
    for (const f of now) {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      let best = null, bd = (Math.max(W, H) * .12) ** 2;
      for (const b of left) { const d = (b.x + b.w / 2 - cx) ** 2 + (b.y + b.h / 2 - cy) ** 2; if (d < bd) { bd = d; best = b; } }
      if (best) {
        left.splice(left.indexOf(best), 1);
        for (const key of ['x', 'y', 'w', 'h']) best[key] += (f[key] - best[key]) * .45;
        best.n = f.n; best.life = Math.min(1, best.life + .25); next.push(best);
      } else {
        // a new track takes the next keyword not already on the screen
        // (the list is long and taken in order, so a word comes back only after all the others; and never
        // while it is still on the screen)
        const used = new Set([...left, ...next, ...blobs].map(b => b.word));
        let word = KEYWORDS[nextWord % KEYWORDS.length];
        for (let i = 0; i < KEYWORDS.length && used.has(word); i++) word = KEYWORDS[++nextWord % KEYWORDS.length];
        nextWord++;
        next.push({ ...f, id: nextId++, life: .25, word });
      }
    }
    for (const b of left) { b.life -= .2; if (b.life > 0) next.push(b); }   // lost: it lingers a moment
    blobs = next;
    // drawn: lines joining them in turn, then the fine marks, then the named boxes over them
    tg.lineWidth = 1; tg.font = '400 11px "ABC Areal", sans-serif'; tg.textBaseline = 'alphabetic';
    const shown = blobs.filter(b => b.life > 0).sort((a, b) => a.id - b.id);
    // (in both looks: with the callouts it joins their rings on the ice, the tags standing off)
    {
      const on = TRACK === 'orbit' && W < 600 ? [...shown].sort((a, b) => b.n - a.n).slice(0, 5).sort((a, b) => a.id - b.id) : shown;
      tg.strokeStyle = MAG; tg.globalAlpha = .5;
      tg.beginPath();
      on.forEach((b, i) => { const x = b.x + b.w / 2, y = b.y + b.h / 2; if (i) tg.lineTo(x, y); else tg.moveTo(x, y); });
      tg.stroke();
    }
    // the fine tracking, as a feature tracker does it: each place that stands out from its neighbours
    // (its brightness and the sharpness of its edge, the highest within two cells all round) is a feature;
    // the strongest are taken, each followed from frame to frame by the nearest of the last (so it keeps
    // its id and its size), and marked with a small open square that moves with the light it holds
    const score = new Float32Array(sw * sh);
    let sTop = 0;
    for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      if (!lum[i]) continue;
      const g = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + sw] - lum[i - sw]);
      score[i] = g + lum[i] * .6; if (score[i] > sTop) sTop = score[i];
    }
    const cand = [];
    for (let y = 2; y < sh - 2; y++) for (let x = 2; x < sw - 2; x++) {
      const i = y * sw + x, v = score[i];
      if (v < sTop * ICE.featShare) continue;
      let peak = true;
      for (let dy = -2; dy <= 2 && peak; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && score[i + dy * sw + dx] > v) { peak = false; break; }
      if (peak) cand.push({ x: x + .5, y: y + .5, v });
    }
    cand.sort((a, b) => b.v - a.v);
    const take = cand.slice(0, ICE.marks), was = [...feats], keepF = [];
    for (const c of take) {
      let best = null, bd = 3.5 ** 2;   // (within a few cells of where it was)
      for (const f of was) { const d = (f.x - c.x) ** 2 + (f.y - c.y) ** 2; if (d < bd) { bd = d; best = f; } }
      if (best) { was.splice(was.indexOf(best), 1); best.x += (c.x - best.x) * .6; best.y += (c.y - best.y) * .6; best.v = c.v; best.miss = 0; keepF.push(best); }
      else keepF.push({ ...c, miss: 0, s: .4 + .6 * Math.random() });
    }
    for (const f of was) if (++f.miss < 3) keepF.push(f);   // lost: held a couple of frames
    feats = keepF;
    tg.globalAlpha = 1; tg.strokeStyle = ICE.pink;
    for (const f of feats) {
      const q = Math.round(3 + 10 * f.s * Math.min(1, f.v / sTop)), X = f.x * k, Y = f.y * k;
      tg.strokeRect(Math.round(X - q / 2) + .5, Math.round(Y - q / 2) + .5, q, q);
    }
    if (TRACK === 'orbit') { callouts(shown); return; }
    // the named tracks, over the fine ones: a solid pink box (never narrower than its name), the name
    // in its middle in white, in the page's type
    tg.font = '500 13px "ABC Areal", sans-serif'; tg.textAlign = 'center'; tg.textBaseline = 'middle';
    for (const b of shown) {
      const word = b.word, tw = tg.measureText(word).width;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, w = Math.round(Math.max(b.w + 12, tw + 14)), h = Math.round(Math.max(b.h + 12, 22));
      tg.globalAlpha = 1;
      tg.fillStyle = ICE.pink; tg.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
      tg.fillStyle = '#fff'; tg.fillText(word, Math.round(cx), Math.round(cy) + .5);
    }
    tg.textAlign = 'left'; tg.textBaseline = 'alphabetic';
    tg.globalAlpha = 1;
  }

  // ---- the callouts (?track=orbit): each named track's keyword drawn out from the ice and set off
  // round it, as a technical drawing calls out its parts. The tag stands on an ellipse round the
  // rooster, on the ray from its middle through the bright place it follows, kept to the rooster's two
  // sides (never over its head or its foot) and apart from the others on its side; a hairline leads
  // from a ring on the ice out to an elbow and along to the tag. A new one draws its leader out first,
  // and its tag comes at the end of it; under the tag, the track's reading (its number, its strength) ----
  const rad = d => d * Math.PI / 180;
  function callouts(all) {
    // (on a narrow screen the strongest few only: there is room for so many down its edges)
    const shown = W < 600 ? [...all].sort((a, b) => b.n - a.n).slice(0, 5) : all;
    const cx = roost.x, cy = roost.y, top = Math.max(1, ...shown.map(b => b.n));
    tg.font = '500 13px "ABC Areal", sans-serif';
    const rx = roost.h * ORBIT.reach, ry = roost.h * ORBIT.rise, M = 16;   // (M: the screen's margin, which the tags keep inside)
    // where each wants to stand: its angle off the middle, turned out to the side it is on and kept
    // within ORBIT.side of the horizontal; eased there from where it stood
    const side = rad(ORBIT.side);
    for (const b of shown) {
      const ax = b.x + b.w / 2, ay = b.y + b.h / 2;
      let a = Math.atan2((ay - cy) / ry, (ax - cx) / rx);
      const right = Math.cos(a) >= 0, off = Math.max(-side, Math.min(side, right ? a : (a > 0 ? Math.PI - a : -Math.PI - a)));
      b.goal = right ? off : Math.PI - off;
      if (b.ang === undefined || (Math.cos(b.ang) >= 0) !== right) b.ang = b.goal; else b.ang += (b.goal - b.ang) * .25;
      b.grow = Math.min(1, (b.grow ?? 0) + ORBIT.grow);
    }
    // kept apart on each side: by their height down it, pushed out from each other to the least gap
    const gap = rad(ORBIT.gap);
    for (const right of [true, false]) {
      const col = shown.filter(b => (Math.cos(b.ang) >= 0) === right).map(b => ({ b, t: right ? b.ang : Math.PI - b.ang })).sort((p, q) => p.t - q.t);
      for (let pass = 0; pass < 4; pass++) for (let i = 1; i < col.length; i++) {
        const d = col[i].t - col[i - 1].t;
        if (d < gap) { const push = (gap - d) / 2; col[i - 1].t -= push; col[i].t += push; }
      }
      for (const c of col) { c.t = Math.max(-side - gap, Math.min(side + gap, c.t)); c.b.ang = right ? c.t : Math.PI - c.t; }
    }
    tg.lineWidth = 1; tg.lineCap = 'square';
    for (const b of shown) {
      const ax = b.x + b.w / 2, ay = b.y + b.h / 2, right = Math.cos(b.ang) >= 0, dir = right ? 1 : -1;
      const tw = tg.measureText(b.word).width, w = Math.round(tw + 14), h = 22;
      // (its end on the ellipse, but the tag kept inside the screen: on a narrow one, down its edges)
      const py = cy + ry * Math.sin(b.ang), px = right ? Math.min(cx + rx * Math.cos(b.ang), W - M - w) : Math.max(cx + rx * Math.cos(b.ang), M + w);
      const ex = px - dir * 18, alpha = Math.min(1, b.life * 2);
      if (b.grow < 1) calling = true;
      // the leader: anchor, out to the elbow, along to the tag; drawn out as far as it has grown
      const legs = [[ax, ay], [ex, py], [px, py]];
      const len = [Math.hypot(ex - ax, py - ay), Math.abs(px - ex)], total = len[0] + len[1];
      let room = total * b.grow;
      tg.globalAlpha = .75 * alpha; tg.strokeStyle = MAG;
      tg.beginPath(); tg.moveTo(ax, ay);
      for (let i = 0; i < 2 && room > 0; i++) {
        const u = Math.min(1, room / Math.max(1e-3, len[i])), [x0, y0] = legs[i], [x1, y1] = legs[i + 1];
        tg.lineTo(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u); room -= len[i];
      }
      tg.stroke();
      // the anchor: a ring round the bright place, a dot in it
      tg.globalAlpha = alpha; tg.strokeStyle = ICE.pink; tg.fillStyle = ICE.pink;
      tg.beginPath(); tg.arc(ax, ay, 5, 0, Math.PI * 2); tg.stroke();
      tg.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 2, 2);
      if (b.grow < 1) continue;
      // the tag at the leader's end, its reading under it
      const x0 = Math.round(right ? px : px - w), y0 = Math.round(py - h / 2);
      tg.fillStyle = ICE.pink; tg.fillRect(x0, y0, w, h);
      tg.fillStyle = '#fff'; tg.textAlign = 'center'; tg.textBaseline = 'middle';
      tg.font = '500 13px "ABC Areal", sans-serif'; tg.fillText(b.word, x0 + w / 2, y0 + h / 2 + .5);
      tg.font = '400 10px "ABC Areal", sans-serif'; tg.fillStyle = MAG; tg.textAlign = right ? 'left' : 'right'; tg.textBaseline = 'top';
      tg.fillText(`T${String(b.id % 100).padStart(2, '0')}  ${(b.n / top).toFixed(2)}`, right ? x0 : x0 + w, y0 + h + 5);
      tg.font = '500 13px "ABC Areal", sans-serif';
    }
    tg.textAlign = 'left'; tg.textBaseline = 'alphabetic'; tg.globalAlpha = 1; tg.lineCap = 'butt';
  }
}

if (stage && hero && slot && fan && finale) build();
