// The page's display titles, filled with a moving shader: Voronoi cells with a beam of light across
// them, seen only through each title's own letters. The type stays real text, set and risen as before;
// once a title is at rest (motion.js marks it 'risen': the hero's after its intro, the others after they
// rise in on the scroll) a canvas over it takes its place, masked by a picture of its letters drawn from
// the live layout, and the text goes clear under it. Where WebGL 2 is missing the titles stay as they
// are, in magenta.
//   The look was designed at shaders.com (its Voronoi under its Beam); this draws the same shader the
// library made of it (its WGSL, in GLSL here, its numbers as it sets them), without the library and its
// 1.3 MB runtime: one small WebGL context for every title, each title's frame drawn into it and copied to
// the title's own canvas, and only while the title is on screen. Colours are mixed as the library mixes
// them, in linear Display-P3, and its result shown as sRGB, as its canvas showed it (the softer pinks
// and blues the titles had)
// (the frame is each title's box, padded by PAD em: positions run 0-1 across it, y down)
import { gsap } from 'gsap';

const LOOK = {
  // Voronoi: the cells' colour from the middle (a) to the edge (b), the lines between them, the cells
  // across the frame's height, their drift, the pattern's seed, how far the edge colour reaches in, the lines' width
  a: '#3186CF', b: '#FC02DD', border: '#FFBDBD', scale: 6, speed: 1.2, seed: 13, edgeIntensity: .1, edgeSoftness: .105,
  // Beam: its colour inside and at its edge, from and to (0-1 across the frame, y down), its thickness
  // and its edge's softness at each end
  inside: '#FF00AA', outside: '#0000FF', from: [.02, .68], to: [.96, .94], thickness: [.3, .1], softness: [2, 0],
};

const PAD = .3;   // the canvas reaches this many em past the title's box, for the glyphs that overhang it
// the titles on black: the hero's, the price's (its lines, as the title has no box of its own), the prices
// themselves and the foot's (By Lavi's, on the magenta, stays as it is)
// (the hero's by its lines: they go up to their places one after another, each with its own)
const TITLES = ['.hero-title > .line', '.price h2 > .line', '.price-was', '.price-now', '.foot h2'];
const HERO = document.querySelectorAll('.hero-title > .line').length;
let heroReady = 0;
const heroDone = () => { if (++heroReady === HERO) document.dispatchEvent(new Event('title-shaded')); };

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

// a picture of a title's letters, white where they are, in its canvas's frame: each glyph set where the
// page sets it (measured with every transform off, as it rests)
function mask(el, canvas, ink) {
  root.classList.add('measuring');
  const fs = parseFloat(getComputedStyle(el).fontSize), pad = PAD * fs;
  const w = el.offsetWidth + 2 * pad, h = el.offsetHeight + 2 * pad, tr = el.getBoundingClientRect();
  Object.assign(canvas.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${w}px`, height: `${h}px` });
  const dpr = Math.min(devicePixelRatio || 1, 2), g = ink.getContext('2d');
  ink.width = Math.round(w * dpr); ink.height = Math.round(h * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = document.createRange();
  for (let t; (t = walk.nextNode());) {
    if (t.parentElement.closest('.sr-only')) continue;
    // (the stars turn while it loads: left plain till they are still, 'stars-still')
    if (t.parentElement.closest('.star') && (t.parentElement.closest('.turning') || (!reduce && root.classList.contains('loading')))) continue;
    const cs = getComputedStyle(t.parentElement), up = cs.textTransform === 'uppercase';
    if (cs.visibility === 'hidden') continue;   // (the price's rolling digits, once rolled)
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const asc = g.measureText('H').fontBoundingBoxAscent;
    for (let k = 0; k < t.length; k++) {
      const ch = t.data[k];
      if (!ch.trim()) continue;
      rg.setStart(t, k); rg.setEnd(t, k + 1);
      const b = rg.getBoundingClientRect();
      if (b.width) g.fillText(up ? ch.toUpperCase() : ch, b.left - tr.left + pad, b.top - tr.top + pad + asc);
    }
  }
  // the old price's strike, drawn with the letters
  for (const s of el.querySelectorAll('.strike')) { const b = s.getBoundingClientRect(); g.fillRect(b.left - tr.left + pad, b.top - tr.top + pad, b.width, Math.max(1, b.height)); }
  root.classList.remove('measuring');
  canvas.style.maskImage = canvas.style.webkitMaskImage = `url(${ink.toDataURL()})`;
}

// the hero's lines are drawn again once the loading is over, with their stars (left out while they turned)
const remask = [];
document.addEventListener('stars-still', () => remask.forEach(f => f()), { once: true });

// ----- the shader -----
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uVP;          // the frame, in pixels
uniform float uT;          // the cells' time (seconds by their speed)
uniform vec3 uA, uB, uBorder, uIn, uOut;
uniform vec4 uCell;        // scale, seed, edgeIntensity, edgeSoftness
uniform vec4 uBeam;        // from, to (x across, y down)
uniform vec4 uBeamK;       // thickness at each end, softness at each end
out vec4 o;
vec2 cellHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec2 nearest2(vec2 q, float t, float seed) {
  vec2 cell = floor(q), local = fract(q);
  float d1 = 10., d2 = 10.;
  for (int ny = -1; ny <= 1; ny++) for (int nx = -1; nx <= 1; nx++) {
    vec2 off = vec2(float(nx), float(ny));
    vec2 h = cellHash2(cell + off + seed);
    vec2 pt = clamp(vec2(h.x + sin(t + h.x * 6.283185307179586) * .15, h.y + cos(t * .7 + h.y * 6.283185307179586) * .15), .05, .95);
    float d = length(local - (off + pt));
    d2 = min(d2, max(d, d1));
    d1 = min(d1, d);
  }
  return vec2(d1, d2);
}
vec3 toSrgb(vec3 c) { return mix(pow(c, vec3(.41666)) * 1.055 - .055, c * 12.92, vec3(lessThanEqual(c, vec3(.0031308)))); }
void main() {
  vec2 uv = vec2(gl_FragCoord.x / uVP.x, 1. - gl_FragCoord.y / uVP.y);
  float aspect = uVP.x / max(uVP.y, 1e-6);
  // the cells: coloured by how near the middle of their own (a) or the next (b), lined where two meet
  vec2 dd = nearest2(vec2(uv.x * aspect, uv.y) * uCell.x, uT, uCell.y);
  float sum = max(dd.x + dd.y, 1e-4);
  float fill = clamp(pow(clamp(dd.x * 2. / sum, 0., 1.), 4. - uCell.z * 3.), 0., 1.);
  vec3 base = mix(uBorder, mix(uA, uB, fill), smoothstep(0., uCell.w * uCell.x / 6. + 1e-3, (dd.y - dd.x) / sum));
  // the beam: a tapered segment's glow, its colour from inside to its edge, laid over the cells
  vec2 a = vec2(uBeam.x * aspect, uBeam.y), b = vec2(uBeam.z * aspect, uBeam.w), p = vec2(uv.x * aspect, uv.y), ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0., 1.), dist = length(p - (a + ab * t));
  float thick = mix(uBeamK.x, uBeamK.y, t) * .25, soft = max(mix(uBeamK.z, uBeamK.w, t), 1e-4);
  float nd = dist / max(thick, 1e-4);
  float alpha = pow(1. - smoothstep(1., 1. + soft, nd), 1. + soft * 1.5);
  vec3 beam = mix(uIn, uOut, smoothstep(1. - soft, 1. + soft, nd));
  o = vec4(toSrgb(beam * alpha + base * (1. - alpha)), 1.);
}`;

// a colour as the library mixes it: its sRGB made linear, then into linear Display-P3
function colour(hex) {
  const [r, g, b] = [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return [.8225 * r + .1774 * g, .0332 * r + .9669 * g, .0171 * r + .0724 * g + .9108 * b];
}

// one WebGL 2 context for every title, its drawing copied to each title's own canvas
function renderer() {
  const gc = document.createElement('canvas');
  const gl = gc.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main() { vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); gl_Position = vec4(p, 0., 1.); }'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('title shader:', gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  const u = n => gl.getUniformLocation(prog, n);
  gl.uniform3fv(u('uA'), colour(LOOK.a)); gl.uniform3fv(u('uB'), colour(LOOK.b)); gl.uniform3fv(u('uBorder'), colour(LOOK.border));
  gl.uniform3fv(u('uIn'), colour(LOOK.inside)); gl.uniform3fv(u('uOut'), colour(LOOK.outside));
  gl.uniform4f(u('uCell'), LOOK.scale, LOOK.seed, LOOK.edgeIntensity, LOOK.edgeSoftness);
  gl.uniform4f(u('uBeam'), ...LOOK.from, ...LOOK.to);
  gl.uniform4f(u('uBeamK'), ...LOOK.thickness, ...LOOK.softness);
  const uVP = u('uVP'), uT = u('uT');
  return {
    draw(target, time) {
      const w = target.width, h = target.height;
      if (!w || !h) return;
      // (the shared drawing grows to the largest title, and each is drawn in its foot-left corner)
      if (gc.width < w || gc.height < h) { gc.width = Math.max(gc.width, w); gc.height = Math.max(gc.height, h); }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uVP, w, h); gl.uniform1f(uT, time * LOOK.speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const g = target.ctx;
      g.clearRect(0, 0, w, h);
      g.drawImage(gc, 0, gc.height - h, w, h, 0, 0, w, h);
    },
  };
}

const gpu = renderer();
const shown = new Set();
const t0 = performance.now();
const now = () => (reduce ? 0 : (performance.now() - t0) / 1000);
// (each title's canvas in device pixels, one and a half at most, as the library had it: the cells are soft)
const size = c => { const dpr = Math.min(devicePixelRatio || 1, 1.5); c.width = Math.round(parseFloat(c.style.width) * dpr); c.height = Math.round(parseFloat(c.style.height) * dpr); };
const seen = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? shown.add(e.target.__title) : shown.delete(e.target.__title))));

function shade(el) {
  document.fonts.ready.then(() => {
    const canvas = document.createElement('canvas'), ink = document.createElement('canvas');
    canvas.className = 'title-shader'; canvas.setAttribute('aria-hidden', 'true');
    el.classList.add('shading'); el.append(canvas);
    mask(el, canvas, ink); size(canvas);
    canvas.ctx = canvas.getContext('2d');
    if (el.querySelector('.star') && !reduce && root.classList.contains('loading')) remask.push(() => mask(el, canvas, ink));
    el.__title = { canvas };
    gpu.draw(canvas, now());
    el.classList.add('shaded');
    if (el.closest('.hero-title')) heroDone();
    seen.observe(el);
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { mask(el, canvas, ink); size(canvas); gpu.draw(canvas, now()); }, 150); });
  });
}

if (!gpu) document.dispatchEvent(new Event('title-shaded'));   // (the loader waits for it no longer)
else {
  // the titles on screen, drawn each frame (under reduced motion they stand still, drawn once)
  if (!reduce) gsap.ticker.add(() => { if (shown.size) { const t = now(); for (const title of shown) gpu.draw(title.canvas, t); } });
  for (const el of TITLES.flatMap(sel => [...document.querySelectorAll(sel)])) {
    // (this file may come in after a title has risen: its class says so; under reduced motion none rise)
    const h = el.closest('h1, h2') ?? el;
    // (the hero's title at once: it is the loader, its shader rising through it as the page loads)
    if (reduce || h.classList.contains('risen') || el.closest('.hero-title')) shade(el);
    else h.addEventListener('risen', () => shade(el), { once: true });
  }
}
