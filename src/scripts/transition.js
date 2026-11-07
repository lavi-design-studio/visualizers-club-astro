// The way between the landing page and the sign-up page, in WebGL: a front of dithered cells sweeps up
// the screen, as the portrait is dithered (dither.js: Bayer 8x8, three levels of the one magenta, here
// in cells of 10 css px), and leaves the magenta whole behind it, the page it goes to named on it in
// black, in its own title's type (Neue World, Migra, Neue World). The page goes to the other then, and
// opens on the same card (html.passing, set in each page's head before it is drawn); and the front
// carries on up, the cells giving way to the page from the foot. One motion across the two pages.
//   Only for a plain click on a link from one to the other; not under reduced motion, nor where there
// is no WebGL2 (the link just goes). A page come back to from the browser's history is shown as it was.
import { gsap } from 'gsap';

const KEY = 'vsc-pass';
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGES = { '/': ['the', 'visualizers', 'club'], '/dang-ky': ['sign up', 'first season'] };
const path = p => (p.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/');
const CELL = 10, BAND = .42, MONO = [0.7624493837356567, 0.22324037551879883, 0.7791259288787842];

const frag = `#version 300 es
precision highp float;
uniform vec2 uRes;          // device px
uniform float uP, uCell, uBand, uMode, uTime;
uniform vec3 uMono;
uniform sampler2D uText;    // the name, white on black, the screen's size
out vec4 o;
float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float b4(vec2 a) { return b2(.5 * a) * .25 + b2(a); }
float b8(vec2 a) { return b4(.5 * a) * .25 + b2(a); }
float h(float n) { return fract(sin(n) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.), f * f * (3. - 2. * f)); }
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);                 // (y up: the foot is row 0)
  vec2 cells = uRes / uCell;
  // how far up the screen this cell's row is, the front a little uneven across, slowly moving
  float s = (cell.y + .5) / cells.y + (n1(cell.x * .09 + uTime * .3) - .5) * .08;
  float v = clamp((uP * (1. + uBand) - s) / uBand, 0., 1.);
  if (uMode > .5) v = 1. - v;                                   // (opening: the page from the foot up)
  // three levels, as the portrait's: Figma's dither on v as its luma
  float th = b8(cell);
  float q = clamp(floor((v + (th - .5) / 2.) * 2. + .5) / 2., 0., 1.);
  if (q <= 0.) { o = vec4(0.); return; }
  vec3 c = uMono * q;
  // the page's name, in black on the magenta where it is whole
  float t = texture(uText, vec2(gl_FragCoord.x / uRes.x, 1. - gl_FragCoord.y / uRes.y)).r;
  if (q >= 1.) c = mix(c, vec3(0.), t);
  o = vec4(c, 1.);
}`;

function setup() {
  const canvas = document.createElement('canvas');
  canvas.className = 'pass'; canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '2147483647', pointerEvents: 'none', display: 'none' });
  document.body.append(canvas);
  // (its drawing kept, so the last frame can be read back: it is the card the next page opens on)
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) { canvas.remove(); return null; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return null; }
  gl.useProgram(prog);
  const U = n => gl.getUniformLocation(prog, n);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const text = document.createElement('canvas'), tg = text.getContext('2d');
  let dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  // the name of the page it goes to, as that page's title is set: centred, a line apart by .15 of its size
  const name = to => {
    const lines = PAGES[to] ?? PAGES['/'];
    text.width = Math.round(innerWidth * dpr); text.height = Math.round(innerHeight * dpr);
    tg.setTransform(dpr, 0, 0, dpr, 0, 0);
    tg.fillStyle = '#000'; tg.fillRect(0, 0, innerWidth, innerHeight);
    const fs = Math.max(innerWidth < 600 ? 44 : 64, Math.min(innerWidth / 1728, innerHeight / 1117) * 160);
    const fonts = lines.map((_, i) => (i % 2 ? `italic 200 ${fs}px "PP Migra", serif` : `200 ${fs}px "PP Neue World", serif`));
    const capH = fs * .7, gap = fs * .15, total = lines.length * capH + (lines.length - 1) * gap;
    tg.fillStyle = '#fff'; tg.textAlign = 'center'; tg.textBaseline = 'alphabetic';
    lines.forEach((l, i) => {
      tg.font = fonts[i];
      // (wider than the screen: made to fit it)
      const w = tg.measureText(l.toUpperCase()).width, k = Math.min(1, (innerWidth - 32) / w);
      tg.save(); tg.translate(innerWidth / 2, (innerHeight - total) / 2 + capH * (i + 1) + gap * i); tg.scale(k, k);
      tg.fillText(l.toUpperCase(), 0, 0); tg.restore();
    });
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text);
  };
  const draw = (p, mode, t) => {
    gl.uniform2f(U('uRes'), canvas.width, canvas.height); gl.uniform1f(U('uP'), p); gl.uniform1f(U('uMode'), mode);
    gl.uniform1f(U('uCell'), Math.max(1, Math.round(CELL * dpr))); gl.uniform1f(U('uBand'), BAND); gl.uniform1f(U('uTime'), t);
    gl.uniform3f(U('uMono'), ...MONO); gl.uniform1i(U('uText'), 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  return { canvas, gl, size, name, draw, tex };
}

// the fonts the name is set in, loaded (a little while at most)
const fontsFor = () => Promise.race([Promise.all(['200 40px "PP Neue World"', 'italic 200 40px "PP Migra"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 600))]);

let gfx = null, running = null;
const ready = () => (gfx ??= setup());

// going: the cover drawn up the screen, then to the page. Its last frame, the card, is kept with the way
// (a picture of it): the next page opens on that picture from its first paint (html.passing, its head),
// so the card never leaves the screen while the page loads, and the same card drawn again takes over
function go(href, to) {
  const g = ready();
  if (!g) { location.href = href; return; }
  g.size();
  fontsFor().then(() => {
    nameAndRun(g, to, 0, () => {
      let img = '';
      try { img = g.canvas.toDataURL('image/webp', .9); } catch {}
      try { sessionStorage.setItem(KEY, JSON.stringify({ to, at: Date.now(), img })); } catch { try { sessionStorage.setItem(KEY, JSON.stringify({ to, at: Date.now() })); } catch {} }
      location.href = href;
    });
  });
}
// the card drawn, then (when the page is ready for it to go: wait) the front run across the screen
function nameAndRun(g, to, mode, done, wait = Promise.resolve()) {
  g.name(to);
  g.canvas.style.display = 'block';
  // (the front's time is the clock's, so it moves as evenly as the frames come; it runs on a little past
  // the screen's top going, so the card is whole when it is kept)
  const s = { p: 0 }, t0 = performance.now(), at = () => (performance.now() - t0) / 1000;
  g.draw(0, mode, 0);
  if (mode) root.classList.remove('passing');   // (the card is drawn: the page's own cover can go)
  running?.kill();
  wait.then(() => {
    running = gsap.to(s, { p: mode ? 1 : 1.12, duration: mode ? 1.25 : .9, ease: 'power3.inOut', delay: mode ? .05 : 0,
      onUpdate: () => g.draw(s.p, mode, at()), onComplete: done });
  });
}

if (!reduce) {
  // a link from one page to the other, plainly clicked
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return;
    const to = path(u.pathname), here = path(location.pathname);
    if (!(to in PAGES) || to === here || u.hash && to === here) return;
    if (!ready()) return;
    e.preventDefault();
    go(u.href, to);
  });
  // the page it goes to fetched as soon as the pointer is on the way there
  const fetched = new Set();
  document.addEventListener('pointerover', e => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const u = new URL(a.href, location.href), to = path(u.pathname);
    if (u.origin !== location.origin || !(to in PAGES) || to === path(location.pathname) || fetched.has(u.href)) return;
    fetched.add(u.href);
    const l = document.createElement('link'); l.rel = 'prefetch'; l.href = u.href; document.head.append(l);
  });
}

// coming: opened on the card, the front carrying on up and away
let pass = null;
try { pass = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch {}
if (root.classList.contains('passing')) {
  const g = pass && !reduce ? ready() : null;
  if (!g) root.classList.remove('passing');
  else {
    // (a page that sets itself out first says when it is ready to be seen, html[data-pass-wait],
    // 'pass-ready': the sign-up page once its title is in the screen's middle, the landing page once its
    // shaders are built, so the front never stutters over its work; the card waits, 2.5 s at most)
    const wait = root.hasAttribute('data-pass-wait') ? new Promise(r => { for (const ev of ['pass-ready', 'title-shaded']) document.addEventListener(ev, r, { once: true }); setTimeout(r, 2500); }) : undefined;
    g.size(); fontsFor().then(() => nameAndRun(g, pass.to, 1, () => { g.canvas.style.display = 'none'; }, wait));
  }
}
// (left for the other page, the cover taken off it as it goes, so that coming back to it from the
// history, as it was left, it is shown as it is)
const bare = () => { root.classList.remove('passing'); running?.kill(); if (gfx) gfx.canvas.style.display = 'none'; };
addEventListener('pagehide', bare);
addEventListener('pageshow', e => { if (e.persisted) bare(); });
addEventListener('resize', () => { if (gfx && gfx.canvas.style.display === 'block') gfx.size(); });
