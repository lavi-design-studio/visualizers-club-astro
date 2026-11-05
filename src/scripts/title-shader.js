// The page's display titles, filled with a moving shader (shaders.com, WebGPU): Voronoi cells with a
// beam of light across them, seen only through each title's own letters. The type stays real text, set
// and risen as before; once a title is at rest (motion.js marks it 'risen': the hero's after its intro,
// the others after they rise in on the scroll) a canvas over it takes its place, masked by a picture of
// its letters drawn from the live layout, and the text goes clear under it. All of them share one GPU
// device. Where WebGPU is missing the titles stay as they are, in magenta.
//   To change the look: design it at shaders.com, Export as JavaScript, and paste the components here
// (the frame is each title's box, padded by PAD em: positions run 0-1 across it, y down)
import { createShader, createSharedDevice, isWebGPUSupported } from 'shaders/js';

const PRESET = {
  components: [   // the first is drawn at the bottom
    { type: 'Voronoi', id: 'voronoi', props: {
      stops: [{ color: '#3186CF', position: 0 }, { color: '#FC02DD', position: 1 }],
      colorBorder: '#FFBDBD', colorSpace: 'linear', scale: 6, seed: 13, edgeIntensity: .1, edgeSoftness: .105, speed: 1.2,
    } },
    { type: 'Beam', id: 'beam', props: {
      insideColor: '#FF00AA', outsideColor: '#0000FF', colorSpace: 'linear',
      startPosition: { x: .02, y: .68 }, endPosition: { x: .96, y: .94 },
      startThickness: .3, endThickness: .1, startSoftness: 2, endSoftness: 0,
    } },
  ],
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

let gpu = null;
async function shade(el) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'), ink = document.createElement('canvas');
  canvas.className = 'title-shader'; canvas.setAttribute('aria-hidden', 'true');
  el.classList.add('shading'); el.append(canvas);
  mask(el, canvas, ink);
  if (el.querySelector('.star') && !reduce && root.classList.contains('loading')) remask.push(() => mask(el, canvas, ink));
  gpu ??= createSharedDevice().catch(() => null);
  const shared = await gpu;
  const shader = await createShader(canvas, PRESET, {
    disableTelemetry: true,   // nothing sent to shaders.com
    ...(shared ? { gpu: shared } : {}),
    onReady: () => { el.classList.add('shaded'); if (reduce) shader?.pause(); if (el.closest('.hero-title')) heroDone(); },
    onError: reason => { console.warn('title shader:', reason); if (!/device-lost/.test(reason)) { el.classList.remove('shaded'); canvas.remove(); } },
  }).catch(e => { console.warn('title shader:', e); return null; });
  if (!shader) { canvas.remove(); if (el.closest('.hero-title')) heroDone(); return; }
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => mask(el, canvas, ink), 150); });
}

if (!isWebGPUSupported()) document.dispatchEvent(new Event('title-shaded'));   // (the loader waits for it no longer)
else {
  for (const el of TITLES.flatMap(sel => [...document.querySelectorAll(sel)])) {
    // (this file may come in after a title has risen: its class says so; under reduced motion none rise)
    const h = el.closest('h1, h2') ?? el;
    // (the hero's title at once: it is the loader, its shader rising through it as the page loads)
    if (reduce || h.classList.contains('risen') || el.closest('.hero-title')) shade(el);
    else h.addEventListener('risen', () => shade(el), { once: true });
  }
}
