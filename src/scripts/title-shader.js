// The page's display titles, made of the rooster's ice (STYLE 'ice', below; the Voronoi cells with a
// beam across them, as first designed at shaders.com, are STYLE 'cells') The type stays real text, set and risen as before;
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
  // the letters in depth (not the cells look): the strokes' bevel and the glow's reach (em), the glow's strength by look
  bevel: .035, reach: .1, glow: { cells: 0, ice: .8, neon: 1.4, club: 1.1 },
  // the ice: how far it bends what is behind (em, as ICE.refract bends the screen for the rooster), its rim's falloff
  bend: 1, rim: 1.6,
};
// which look: ice (the rooster's), or cells, neon, club (?title= in the address picks one, to compare them)
const STYLES = ['cells', 'ice', 'neon', 'club'];
const STYLE = STYLES.find(k => k === new URLSearchParams(location.search).get('title')) ?? 'ice';

const PAD = .3;   // the canvas reaches this many em past the title's box, for the glyphs that overhang it
// the titles on black: the hero's, the price's (its lines, as the title has no box of its own), the prices
// themselves and the foot's (By Lavi's, on the magenta, stays as it is)
// (the hero's by its lines: they go up to their places one after another, each with its own)
// (and the sign-up page's, by its lines, once they have gone up to their places: dang-ky.astro)
const TITLES = ['.hero-title > .line', '.price h2 > .line', '.price-was', '.price-now', '.foot h2', '.signup-title > .line'];
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
}

// the hero's lines are drawn again once the loading is over, with their stars (left out while they turned)
const remask = [];
document.addEventListener('stars-still', () => remask.forEach(f => f()), { once: true });

// ----- the shader -----
// The letters themselves are drawn here, from three pictures of them made on the 2D canvas: their ink,
// the ink blurred a little (a height: high down a stroke's middle, falling to its edges, so each stroke
// is a rounded rod whose slopes catch the light) and the ink blurred wide (the glow round them). Four
// looks, by STYLE:
//   cells  the Voronoi and beam as designed at shaders.com, flat in the letters
//   ice    the rooster's ice: a dark clear body with the cells deep inside, the studio's light bands
//          running over its slopes, split into their colours at the edges, a pink and blue rim
//   neon   a club's sign: pink tubes, white-hot down their middle, glowing out round them; they
//          flicker on as the title comes, and hum
//   club   dark gloss lit by two coloured spotlights sweeping across, glinting as they pass
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uVP;          // the frame, in pixels
uniform float uT;          // seconds
uniform float uAge;        // seconds since this title came (the neon's flicker)
uniform int uMode;         // 0 cells, 1 ice, 2 neon, 3 club
uniform vec2 uPtr;         // the pointer, -1 to 1 across the screen (eased)
uniform vec2 uBevel;       // the strokes' slope (the height's blur, in pixels), the glow's strength
uniform vec4 uFrame;       // device px per css px, the frame's offset down the page's lines (css px), how far the ice bends (css px), the rim's falloff
uniform sampler2D uInk, uH, uGlow;
uniform vec3 uA, uB, uBorder, uIn, uOut;
uniform vec4 uCell;        // scale, seed, edgeIntensity, edgeSoftness
uniform vec4 uBeam;        // from, to (x across, y down)
uniform vec4 uBeamK;       // thickness at each end, softness at each end
uniform float uSpeed;
out vec4 o;
const vec3 PINK = vec3(1., .0, .4), BLUE = vec3(.02, .24, .62), VIOLET = vec3(.45, .05, .9), CYAN = vec3(.1, .6, 1.);
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
// the shaders.com look, in linear Display-P3 (shown as sRGB, as its canvas showed it)
vec3 cells(vec2 uv) {
  float aspect = uVP.x / max(uVP.y, 1e-6);
  vec2 dd = nearest2(vec2(uv.x * aspect, uv.y) * uCell.x, uT * uSpeed, uCell.y);
  float sum = max(dd.x + dd.y, 1e-4);
  float fill = clamp(pow(clamp(dd.x * 2. / sum, 0., 1.), 4. - uCell.z * 3.), 0., 1.);
  vec3 base = mix(uBorder, mix(uA, uB, fill), smoothstep(0., uCell.w * uCell.x / 6. + 1e-3, (dd.y - dd.x) / sum));
  vec2 a = vec2(uBeam.x * aspect, uBeam.y), b = vec2(uBeam.z * aspect, uBeam.w), p = vec2(uv.x * aspect, uv.y), ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0., 1.), dist = length(p - (a + ab * t));
  float thick = mix(uBeamK.x, uBeamK.y, t) * .25, soft = max(mix(uBeamK.z, uBeamK.w, t), 1e-4);
  float nd = dist / max(thick, 1e-4);
  float alpha = pow(1. - smoothstep(1., 1. + soft, nd), 1. + soft * 1.5);
  return mix(base, mix(uIn, uOut, smoothstep(1. - soft, 1. + soft, nd)), alpha);
}
vec3 toSrgb(vec3 c) { c = max(c, 0.); return mix(pow(c, vec3(.41666)) * 1.055 - .055, c * 12.92, vec3(lessThanEqual(c, vec3(.0031308)))); }
const vec3 ICE_PINK = vec3(1., 0., .402), ICE_BLUE = vec3(.031, .238, .624);   // ICE.pink, ICE.blue, linear, written as they are (as ice.js does)
float vhash(vec2 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * (p.x + p.y)); }
float vnoise(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(mix(vhash(i), vhash(i + vec2(1, 0)), f.x), mix(vhash(i + vec2(0, 1)), vhash(i + vec2(1, 1)), f.x), f.y); }
// what the ice has behind it, as ice.js's backdrop: fine lines across, pink and pale blue in turn, drifting
// down; a soft wash of the title's own colours; the pointer's pink light
vec3 behind(vec2 q) {
  // (soft: a bright middle fading out over a few pixels each way, as the rooster's are, drawn small)
  float l = abs(sin((q.y + uT * 6.) * .045));
  float line = pow(l, 10.) * .85 + pow(l, 3.) * .08;
  vec3 c = mix(vec3(.76, .22, .78), vec3(.6, .85, 1.), step(.5, fract(q.y * .0072))) * line;
  // (and broad soft bands of the title's pink and blue, as the hero's type is behind the rooster)
  float band = pow(.5 + .5 * sin(q.y * .028 - uT * .35 + sin(q.x * .006) * 1.5), 3.);
  c += mix(ICE_BLUE * 1.4, ICE_PINK, .5 + .5 * sin(q.x * .005 + q.y * .013 + uT * .2)) * (.18 + .5 * band);
  return c;
}
float reduce01(float x) { return clamp(x, 0., 1.05); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
// the studio's lights as the ice sees them: thin bright bands across, a few broad soft ones
float stripes(float y) { float s = fract(y); return smoothstep(.0, .02, s) * smoothstep(.12, .03, s) + .55 * smoothstep(.35, .38, s) * smoothstep(.5, .4, s) + .25 * smoothstep(.62, .64, s) * smoothstep(.68, .64, s); }
float bands(float y) { return pow(max(0., sin(y * 17.)), 28.) + .45 * pow(max(0., sin(y * 6.3 + 1.3)), 50.) + .12 * (.5 + .5 * sin(y * 2.1)); }
vec3 bandColour(float y) { float k = .5 + .5 * sin(y * 2.7); return mix(mix(BLUE, CYAN, .4), PINK, k); }
// a spotlight from above the frame, sweeping: how much of it falls here, and from where
float spot(vec2 p, vec2 from, float angle, float width) {
  vec2 d = p - from; float a = atan(d.x, d.y);
  return smoothstep(width, 0., abs(a - angle)) / (1. + .15 * length(d));
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x / uVP.x, 1. - gl_FragCoord.y / uVP.y);
  vec2 px = 1. / uVP;
  float ink = texture(uInk, uv).r;
  if (uMode == 0) { o = vec4(toSrgb(cells(uv)) * ink, ink); return; }
  // the strokes as rods: their slope from the height's gradient (y up, as light comes from above)
  float h = texture(uH, uv).r;
  float hx = texture(uH, uv + vec2(px.x, 0.)).r - texture(uH, uv - vec2(px.x, 0.)).r;
  float hy = texture(uH, uv + vec2(0., px.y)).r - texture(uH, uv - vec2(0., px.y)).r;
  vec3 n = normalize(vec3(-hx, hy, .55 / uBevel.x));
  float edge = 1. - n.z, glow = texture(uGlow, uv).r;
  vec3 col, halo; float haloA;
  if (uMode == 1) {
    // the rooster's own ice (ice.js), on the strokes: what is behind them (the fine lines across the page
    // the rooster bends, pink and pale blue, a soft wash of the title's colours) seen through them, bent
    // by their slopes and their slow ripples, each of six colours by its own index so the edges break
    // into rainbows; its cool tint, a glint toward the pointer, and its rim in pink and blue down its height
    // (in the hero title's own measure, whatever the type's size: a small title meets as many lines and
    // bends them as far, letter for letter, as the hero's does; D is the type's size in css px)
    float D = uFrame.z, S = 160. / D;
    vec2 q = (uv * uVP / uFrame.x) * S + vec2(0., uFrame.y);        // y down
    vec2 rq = q * .035 + vec2(0., uT * .05);
    vec3 N = normalize(n + .12 * (vec3(vnoise(rq + 3.1), vnoise(rq + 7.7), vnoise(rq + 1.3)) - .5));
    vec3 E = vec3(0., 0., -1.);
    vec3 rR = refract(E, N, 1. / 1.15), rY = refract(E, N, 1. / 1.16), rG = refract(E, N, 1. / 1.18);
    vec3 rC = refract(E, N, 1. / 1.22), rB = refract(E, N, 1. / 1.22), rV = refract(E, N, 1. / 1.22);
    float r = 0., y = 0., g = 0., c = 0., b = 0., v = 0.;
    for (int i = 0; i < 4; i++) {
      float slide = float(i) / 4. * .1;
      r += behind(q + rR.xy * (.32 + slide) * 160.).r * .5;
      vec3 sy = behind(q + rY.xy * (.32 + slide * 2.5) * 160.); y += (sy.r * 2. + sy.g * 2. - sy.b) / 6.;
      g += behind(q + rG.xy * (.32 + slide * 2.) * 160.).g * .5;
      vec3 sc = behind(q + rC.xy * (.32 + slide * 3.) * 160.); c += (sc.g * 2. + sc.b * 2. - sc.r) / 6.;
      b += behind(q + rB.xy * (.32 + slide * 4.) * 160.).b * .5;
      vec3 sv = behind(q + rV.xy * (.32 + slide) * 160.); v += (sv.b * 2. + sv.r * 2. - sv.g) / 6.;
    }
    r /= 4.; y /= 4.; g /= 4.; c /= 4.; b /= 4.; v /= 4.;
    col = vec3(r + (2. * v + 2. * y - c) / 3., g + (2. * y + 2. * c - v) / 3., b + (2. * c + 2. * v - y) / 3.);
    col = mix(vec3(dot(col, vec3(.2125, .7154, .0721))), col, 1.12);
    col = col * vec3(.9, 1., 1.1) + vec3(.01, .03, .06);
    // (a faint light of its own in the rim's colours, deepest down a stroke's middle, so no letter goes
    // dark between the lines)
    vec3 tint = mix(ICE_BLUE, ICE_PINK, smoothstep(.1, .9, uv.y + .25 * sin(uT * .4)));
    col += tint * (.05 + .07 * h);
    vec3 L = normalize(vec3(uPtr.x * 2. - .4, uPtr.y * 2. + 1., 1.2)), H = normalize(-E + L);
    float nh = max(dot(N, H), 0.), spec = pow(nh * nh, 60.), diff = max(dot(N, L), 0.) * .03;
    float fres = pow(1. - abs(dot(E, N)), uFrame.w);
    vec3 rim = tint;
    col += spec * .5 * vec3(.95, .98, 1.) + diff + fres * (rim * 1.5 + vec3(.04, .06, .1));
    halo = rim; haloA = pow(glow, 2.) * uBevel.y * .35;
    // grown out of frost from the foot up as the rooster grows in (ice.js), its front glowing pink (from a
    // third of the way: the plain title it takes over from never leaves a gap)
    float grow = reduce01(.35 + uAge / 1.5 * .7), front = (1. - uv.y) * .6 + vnoise(q * .05) * .4;
    float fr = smoothstep(.06, 0., grow - front) * step(grow, 1.);
    col += mix(ICE_PINK, vec3(1.), .5) * fr * 2.5;
    float shown = step(front, grow);
    ink *= shown; haloA *= smoothstep(.2, 1., grow);
  } else if (uMode == 2) {
    // neon: the tube's colour, its core white-hot, flickering on as it comes, then a faint hum
    float a = uAge, on = a < .08 ? 0. : a > 1.3 ? 1. : mix(step(.45, hash(vec2(floor(a * 16.), 3.))), 1., smoothstep(.9, 1.3, a));
    on *= .94 + .06 * sin(uT * 120.) * sin(uT * 3.1);
    vec3 tube = mix(PINK, vec3(1., .18, .85), .5 + .5 * sin(uv.x * 3. + uT * .3));
    float core = smoothstep(.45, .95, h);
    col = (tube * (.35 + .9 * h) + vec3(1., .82, .95) * core * core * 1.1 + PINK * pow(edge, 2.) * .6) * on;
    halo = tube; haloA = pow(glow, 1.4) * uBevel.y * on;
  } else {
    // club lights: two spots, pink and blue, sweep across from above; the gloss catches them
    float aspect = uVP.x / uVP.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    float a1 = .55 * sin(uT * .55), a2 = .55 * sin(uT * .43 + 2.);
    vec2 f1 = vec2(.25 * aspect, -1.2), f2 = vec2(.75 * aspect, -1.2);
    float s1 = spot(p, f1, a1, .34) * 1.6, s2 = spot(p, f2, a2, .34) * 1.6;
    vec3 l1 = normalize(vec3(f1 - p, 1.4) * vec3(1., -1., 1.)), l2 = normalize(vec3(f2 - p, 1.4) * vec3(1., -1., 1.));
    float g1 = pow(max(dot(n, normalize(l1 + vec3(0., 0., 1.))), 0.), 60.), g2 = pow(max(dot(n, normalize(l2 + vec3(0., 0., 1.))), 0.), 60.);
    float spark = step(.985, hash(floor(uv * uVP / 6.) + floor(uT * 6.))) * (s1 + s2) * edge * 3.;
    col = mix(vec3(.03, .015, .08), VIOLET * .12, h) + PINK * s1 * (.45 + 3. * g1 + 1.4 * edge) + CYAN * s2 * (.45 + 3. * g2 + 1.4 * edge) + vec3(spark) + mix(BLUE, PINK, uv.x) * pow(edge, 2.) * .35;
    halo = mix(CYAN, PINK, s1 / max(s1 + s2, 1e-3)); haloA = pow(glow, 1.6) * uBevel.y * (s1 + s2) * .9;
  }
  haloA = clamp(haloA, 0., 1.) * (1. - ink);
  // (the ice's colours are written as they are, as ice.js writes them; the others are encoded)
  if (uMode != 1) { col = toSrgb(col); halo = toSrgb(halo); }
  o = vec4(min(col, vec3(1.)) * ink + halo * haloA, ink + haloA);
}`;

// a colour as the library mixes it: its sRGB made linear, then into linear Display-P3
function colour(hex) {
  const [r, g, b] = [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return [.8225 * r + .1774 * g, .0332 * r + .9669 * g, .0171 * r + .0724 * g + .9108 * b];
}

// one WebGL 2 context for every title, its drawing copied to each title's own canvas
function renderer() {
  const gc = document.createElement('canvas');
  const gl = gc.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('title shader:', gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main() { vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); gl_Position = vec4(p, 0., 1.); }'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('title shader:', gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  gl.clearColor(0, 0, 0, 0);
  const u = n => gl.getUniformLocation(prog, n);
  gl.uniform3fv(u('uA'), colour(LOOK.a)); gl.uniform3fv(u('uB'), colour(LOOK.b)); gl.uniform3fv(u('uBorder'), colour(LOOK.border));
  gl.uniform3fv(u('uIn'), colour(LOOK.inside)); gl.uniform3fv(u('uOut'), colour(LOOK.outside));
  gl.uniform4f(u('uCell'), LOOK.scale, LOOK.seed, LOOK.edgeIntensity, LOOK.edgeSoftness);
  gl.uniform4f(u('uBeam'), ...LOOK.from, ...LOOK.to);
  gl.uniform4f(u('uBeamK'), ...LOOK.thickness, ...LOOK.softness);
  gl.uniform1f(u('uSpeed'), LOOK.speed);
  gl.uniform1i(u('uMode'), STYLES.indexOf(STYLE));
  gl.uniform1i(u('uInk'), 0); gl.uniform1i(u('uH'), 1); gl.uniform1i(u('uGlow'), 2);
  const uVP = u('uVP'), uT = u('uT'), uAge = u('uAge'), uPtr = u('uPtr'), uBevel = u('uBevel'), uFrame = u('uFrame');
  const texture = () => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  return {
    // a title's three pictures of its letters, as textures
    upload(target, pictures) {
      target.tex ??= pictures.map(texture);
      pictures.forEach((p, i) => { gl.bindTexture(gl.TEXTURE_2D, target.tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, p); });
    },
    draw(target, time, ptr) {
      const w = target.width, h = target.height;
      if (!w || !h || !target.tex) return;
      // (the shared drawing grows to the largest title, and each is drawn in its foot-left corner)
      if (gc.width < w || gc.height < h) { gc.width = Math.max(gc.width, w); gc.height = Math.max(gc.height, h); }
      gl.viewport(0, 0, gc.width, gc.height); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(0, 0, w, h);
      target.tex.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); });
      gl.uniform2f(uVP, w, h); gl.uniform1f(uT, time); gl.uniform1f(uAge, reduce ? 9 : time - target.born);
      gl.uniform2f(uPtr, ptr.x, ptr.y); gl.uniform2f(uBevel, target.bevel, LOOK.glow[STYLE]);
      gl.uniform4f(uFrame, target.k, target.lineOffset, target.fs * LOOK.bend, LOOK.rim);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const g = target.ctx;
      g.clearRect(0, 0, w, h);
      g.drawImage(gc, 0, gc.height - h, w, h, 0, 0, w, h);
    },
  };
}

// the three pictures, each on black (so the canvas's coverage is the red it gives), at the title
// canvas's own size: the ink, the ink blurred by the rods' bevel, and blurred by the glow's reach
function pictures(canvas, ink, fs) {
  const w = canvas.width, h = canvas.height, k = w / parseFloat(canvas.style.width);
  return [0, LOOK.bevel, LOOK.reach].map(blur => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = w; c.height = h;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    if (blur) g.filter = `blur(${(blur * fs * k).toFixed(2)}px)`;
    g.drawImage(ink, 0, 0, w, h);
    return c;
  });
}

const gpu = renderer();
const shown = new Set();
const t0 = performance.now();
const now = () => (reduce ? 0 : (performance.now() - t0) / 1000);
// (each title's canvas in device pixels, one and a half at most, as the library had it: the cells are soft)
const size = c => { const dpr = Math.min(devicePixelRatio || 1, 1.5); c.width = Math.round(parseFloat(c.style.width) * dpr); c.height = Math.round(parseFloat(c.style.height) * dpr); };
const seen = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? shown.add(e.target.__title) : shown.delete(e.target.__title))));
// the pointer, eased, as the rooster has it
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = 1 - e.clientY / innerHeight * 2; }, { passive: true });

// the hero's title is hidden while the loader sets it (body.html: till 'title-set'), and its letters
// are read from the page as they are set: a hero line is read only once it shows, or its picture would
// be empty (a race with the fonts: it left the lines without stars blank, as only those are read again)
const titleSet = new Promise(done => {
  if (root.classList.contains('title-set')) return done();
  new MutationObserver((_, o) => { if (root.classList.contains('title-set')) { o.disconnect(); done(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
});

function shade(el) {
  document.fonts.ready.then(() => (el.closest('.hero-title') ? titleSet : null)).then(() => {
    const canvas = document.createElement('canvas'), ink = document.createElement('canvas');
    canvas.className = 'title-shader'; canvas.setAttribute('aria-hidden', 'true');
    el.classList.add('shading'); el.append(canvas);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    // (the letters drawn again, and their pictures with them)
    const remake = () => { mask(el, canvas, ink); size(canvas); canvas.k = canvas.width / parseFloat(canvas.style.width); canvas.bevel = LOOK.bevel * fs * canvas.k; canvas.fs = fs; gpu.upload(canvas, pictures(canvas, ink, fs)); };
    remake();
    canvas.ctx = canvas.getContext('2d');
    canvas.born = now(); canvas.lineOffset = Math.random() * 140;   // (each title meets the lines somewhere else)
    // (the hero's is drawn while it loads but shown only once it has settled: it grows in from then)
    if (el.closest('.hero-title') && !root.classList.contains('hero-settled')) document.addEventListener('hero-settled', () => { canvas.born = now(); }, { once: true });
    if (el.querySelector('.star') && !reduce && root.classList.contains('loading')) remask.push(remake);
    el.__title = { canvas };
    gpu.draw(canvas, now(), ptr);
    el.classList.add('shaded');
    if (el.closest('.hero-title')) heroDone();
    seen.observe(el);
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { remake(); gpu.draw(canvas, now(), ptr); }, 150); });
  });
}

if (!gpu) document.dispatchEvent(new Event('title-shaded'));   // (the loader waits for it no longer)
else {
  // the titles on screen, drawn each frame (under reduced motion they stand still, drawn once)
  if (!reduce) gsap.ticker.add((_, dt) => {
    const k = 1 - Math.exp(-dt / 1000 * 3); ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
    if (shown.size) { const t = now(); for (const title of shown) gpu.draw(title.canvas, t, ptr); }
  });
  for (const el of TITLES.flatMap(sel => [...document.querySelectorAll(sel)])) {
    // (this file may come in after a title has risen: its class says so; under reduced motion none rise)
    const h = el.closest('h1, h2') ?? el;
    // (the hero's title at once: it is the loader, its shader rising through it as the page loads)
    if (reduce || h.classList.contains('risen') || el.closest('.hero-title')) shade(el);
    else h.addEventListener('risen', () => shade(el), { once: true });
  }
}
