// The page's motion, around the fan (fan.js), which stays the one big moment. Everything here moves
// the way the course thinks: things are set into the page's grid. All of it is off under reduced
// motion, where the page shows as it is designed, still.
//   0. the loader tosses the students' sites onto a pile, then deals it out onto the fan's own prints
//   1. the hero's type rises into place through a mask, the rest after it in reading order
//   1b. every section's title rises the same way as it scrolls in, then drifts a little with the page
//   2. G shows the page's grid anywhere
//   3. the portrait's dither resolves from coarse cells to Figma's own
//   3b. Level up's black eats up through By Lavi along a ragged, dithered front
//   4. the LEVEL UP stairs run on and on, every tag stepping in to the tier above it, and the clock behind them ticks
//   4b. the last print's weathervane turns twice round on its mast
//   4c. every block of text rises into view from its own foot, and bends with the scroll's speed
//   5. the old price is struck through, and the new one's first digit rolls down from 8 to 5
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import { photo, tile, roundEven, draw as ditherDraw } from './dither.js';

gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;

// ----- 0. the loader -----
// it waits for its pile (index.html: every site in), the fonts and the fan, but never past six seconds;
// then it deals the stack out onto the fan, as GridFlow flies its loader's images out: each card flies
// from the stack to where the same print is on screen in the 3D fan, growing to half the screen on its
// way and shrinking again as it lands (its picture zooming a little in its frame), corner for corner (fan.js quads, read again every frame, so it lands on
// the print as it is drawn), shaded as the scene shades it, the black going as they go. Once they
// are down the fan is shown under them and they fade, so the 3D prints take over in place. Only
// then does the page scroll and the hero's type come up (the intro)
const DEAL = .7, STEP = .035;                           // seconds a card flies, and between cards: each well off before the next leaves
// the CSS matrix3d that lays a w × h box on four points (top left round to bottom left)
function onQuad(w, h, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`;
}
// (setup, the page's own motion set up while the loader still covers it, runs as soon as the fonts and
// the fan are in, while the pile is still coming, so the frame the deal hands over in has nothing left
// to build, and the deal never waits for it after the pile is done; enter, the hero's type coming up,
// starts while the last cards are still in the air)
async function loader(setup, enter) {
  const el = $('#loader');
  const fanP = import('./fan.js').catch(() => null);
  const setupP = Promise.all([document.fonts.ready, fanP]).then(([, f]) => setup?.(f));
  await Promise.race([Promise.all([window.loaderPile, setupP]), new Promise(r => setTimeout(r, 6000))]);
  const fan = await Promise.race([fanP, null]);
  await setupP;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // its work off the deal's first frame
  const open = () => { el?.remove(); root.classList.remove('loading'); gsap.set('.fan-stage', { autoAlpha: 1 }); fan?.lenis.start(); };
  // (the loader is a plain count now, with no pile to deal: it fades)
  if (!el || !fan || reduce || !$('.loader-card', el)) { if (el) gsap.to(el, { autoAlpha: 0, duration: .6, onComplete: open }); else open(); return; }
  scrollTo(0, 0);
  // each card, out of the pile's flow, at its corners as it lies (the pile's box, moved and turned)
  const p = $('.loader-pile', el).getBoundingClientRect(), w = p.width, h = p.height;
  const cards = $$('.loader-card', el).map(c => {
    const r = c.dataset.r * Math.PI / 180, cx = p.left + w / 2 + c.dataset.tx / 100 * w, cy = p.top + h / 2 + c.dataset.ty / 100 * h;
    const at = ([x, y]) => [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)];
    c.getAnimations().forEach(an => an.cancel());       // the last card's pop onto the pile (index.html) may still run: its scale would hold the card at the corner
    Object.assign(c.style, { position: 'fixed', inset: 'auto', left: 0, top: 0, width: `${w}px`, height: `${h}px`, transformOrigin: '0 0' });
    const veil = document.createElement('i'); veil.className = 'loader-veil'; c.append(veil);
    return { el: c, img: c.querySelector('img'), veil, k: +c.dataset.k, from: [at([-w / 2, -h / 2]), at([w / 2, -h / 2]), at([w / 2, h / 2]), at([-w / 2, h / 2])] };
  }).sort((a, b) => a.k - b.k);
  // the pile lies in the fan's order, the last print on top: it is dealt first, off the top, and the
  // first print, at the bottom, last, onto its place in the hero's picture
  const order = c => cards.length - 1 - c.k;
  const ease = gsap.parseEase('power3.inOut'), clock = { t: 0 }, total = DEAL + STEP * (cards.length - 1);
  const away = c => c.from.map(([x, y]) => [x + innerWidth * 1.2, y]);
  // a quad drawn with its corners in turn is convex, its turns all one way; one that is not would make
  // a matrix3d that throws the card across the screen, so that frame keeps the card where it was
  const convex = q => { let sign = 0; for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4], [cx, cy] = q[(i + 2) % 4], z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(z) < 1e-6) return false; if (sign && Math.sign(z) !== sign) return false; sign = Math.sign(z); } return true; };
  const place = () => {
    const to = fan.quads();
    for (const c of cards) {
      const t = Math.min(1, Math.max(0, (clock.t - STEP * order(c)) / DEAL)), f = ease(t), q = to[c.k];
      // the growth on the way: a smooth swell to the middle of the flight and back (sin²), never past
      // 1.6 times the card's size there, so the cards in the air keep clear of one another
      const bump = Math.sin(Math.PI * t) ** 2;
      // a print that is off the screen in the fan (further down the row) has its card slide out to the
      // right at its own size, where the row runs on, and not leap to a print far away or huge
      const xs = q.corners.map(([x]) => x), ys = q.corners.map(([, y]) => y);
      const off = q.behind || Math.min(...xs) > innerWidth || Math.max(...xs) < 0 || Math.min(...ys) > innerHeight || Math.max(...ys) < 0 || Math.max(...xs) - Math.min(...xs) > innerWidth * 1.5;
      const target = off ? away(c) : q.corners;
      let now = c.from.map(([x, y], i) => [x + (target[i][0] - x) * f, y + (target[i][1] - y) * f]);
      const mx = now.reduce((a, [x]) => a + x, 0) / 4, my = now.reduce((a, [, y]) => a + y, 0) / 4;
      const hq = Math.hypot(now[3][0] - now[0][0], now[3][1] - now[0][1]) || 1;
      const k = 1 + bump * Math.min(.6, Math.max(0, innerHeight * .4 / hq - 1));
      now = now.map(([x, y]) => [mx + (x - mx) * k, my + (y - my) * k]);
      c.img.style.transform = `scale(${(1 + bump * .35).toFixed(3)})`;
      if (!convex(now)) continue;
      // on the pile a card lies in the pile's order; a quarter of its way off the pile it goes over the
      // cards dealt before it (well off the pile by then), so it never passes under one already down,
      // and the pile's top never changes under a card still lying on it
      c.el.style.zIndex = f > .25 ? 100 + order(c) : c.k;
      c.el.style.transform = onQuad(w, h, now);
      // the scene's shade, as a black veil's opacity (composited, where a filter would repaint)
      c.veil.style.opacity = ((1 - (off ? 1 : Math.min(1, q.shade))) * f).toFixed(3);
    }
  };
  place();
  // the 3D fan stays hidden until the cards are down on it: the intro, which starts while they are
  // still in the air (enter), would otherwise let it show under them (two sets of the same prints)
  gsap.set('.fan-stage', { autoAlpha: 0 });
  const dealt = new Promise(r => gsap.timeline({ onComplete: () => { open(); r(); } })
    .to($('.loader-count', el), { autoAlpha: 0, duration: .3 }, 0)
    .to(clock, { t: total, duration: total, ease: 'none', onUpdate: place }, 0)
    .to(el, { backgroundColor: 'rgba(0, 0, 0, 0)', duration: .4, ease: 'power1.inOut' }, .1)
    .call(() => enter?.(), null, .45)
    // the dealt cards lie on the 3D prints now: show those under them, and let the cards go
    .set('.fan-stage', { autoAlpha: 1 }, total)
    .to(cards.map(c => c.el), { autoAlpha: 0, duration: .25, ease: 'power1.inOut', onUpdate: place }, total));
  // the loader is the fan's first moment: the page stays still until the prints are down and the 3D
  // fan has them
  await dealt;
}

// ----- 1. the hero -----
// each display line rises inside its own box, cut off .3em under its baseline (index.html .line.masked),
// from far enough down to start out of sight: a line's box is its cap height (.68-.7em) and its ink
// reaches .07em over it, so it starts 165% of its height (1.1em) down
const RISE = 165;
const riseIn = lines => lines.map(line => {
  const rise = document.createElement('span');
  rise.className = 'rise';
  rise.append(...line.childNodes);
  line.append(rise);
  line.classList.add('masked');
  return rise;
});
// the rules of the hero's small type, as ruled paper, across the page between its margins: the type is
// on one line grid (index.html: every line a line-height apart, in every column), and the rules are that
// grid's, evenly a line apart, each line centred, its marks and all (from a capital's mark over it to the
// dot under), between the rule over it and the rule under it,
// from over the first line to under the last, empty lines ruled too. A rule never crosses a mark: it
// breaks round the ink of every letter it would run through (the letter's own ink, measured, as
// text-decoration-skip-ink does)
const RULED = '.hero-intro p, .hero-refund, .hero-promise .stack > *';
// the ink of some runs of text, against origin (a DOMRect): every letter's box and its glyph's own ink
// (measured), and the lines' cap middles, the middles of their marks too (a Vietnamese capital's mark
// over it to the dot under), and pitch (but not of the runs skip names, as numbers in another face), the
// what is only for a screen reader left out.
// The baseline is the browser's own, read off a probe set on it (the canvas's ascent is whole pixels).
// With only lines asked for (inkOf.LINES), each run of text is read a line at a time, not a letter
const inkG = document.createElement('canvas').getContext('2d'), inkCache = new Map();
const glyph = (font, ch) => {                            // a letter's ink in a font, measured once
  const key = font + ' ' + ch;
  let m = inkCache.get(key);
  if (!m) { inkG.font = font; const t = inkG.measureText(ch); m = { a: t.actualBoundingBoxAscent, d: t.actualBoundingBoxDescent, fa: t.fontBoundingBoxAscent }; inkCache.set(key, m); }
  return m;
};
function inkOf(els, origin, skip = () => false, only = '') {
  const range = document.createRange();
  const lines = [], ink = [];
  for (const el of els) {
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), up = cs.textTransform === 'uppercase', counts = !skip(el);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if (only === inkOf.LINES && !counts) continue;
    const mH = glyph(font, 'H'), cap = mH.a;
    const marks = (glyph(font, 'Ẩ').a - glyph(font, 'Ọ').d) / 2;
    let asc = mH.fa;
    {
      const first = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => t.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }).nextNode();
      if (first && first.parentElement === el) {
        const k = first.data.search(/\S/), probe = document.createElement('span');
        probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        range.setStart(first, k); range.setEnd(first, k + 1);
        const top = range.getBoundingClientRect().top;
        el.insertBefore(probe, first);    // on the first line's baseline, the space before it collapsed
        const base = probe.getBoundingClientRect().bottom;
        probe.remove();
        if (Math.abs(base - top - asc) < 2) asc = base - top;
      }
    }
    const pitch = parseFloat(cs.lineHeight) || fs * 1.2;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => t.parentElement.closest('.sr-only') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const line = base => { if (counts && !lines.some(l => Math.abs(l.base - base) < 1)) lines.push({ base, mid: base - cap / 2, marks: base - marks, pitch, fs }); };
    if (only === inkOf.LINES) {
      // a line of a run is a box of its own (its letters' boxes share its top)
      for (let t; (t = walk.nextNode());) {
        if (!t.data.trim()) continue;
        range.selectNodeContents(t);
        for (const r of range.getClientRects()) if (r.width) line(r.top - origin.top + asc);
      }
      continue;
    }
    for (let t; (t = walk.nextNode());) for (let k = 0; k < t.length; k++) {
      const ch = t.data[k];
      if (!ch.trim()) continue;
      range.setStart(t, k); range.setEnd(t, k + 1);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      const base = r.top - origin.top + asc, m = glyph(font, up ? ch.toUpperCase() : ch);
      ink.push({ x0: r.left - origin.left, x1: r.right - origin.left, top: base - m.a, bottom: base + m.d, fs });
      line(base);
    }
  }
  return { lines: lines.sort((a, b) => a.mid - b.mid), ink };
}
inkOf.LINES = 'lines';
// the letters the rules break round, measured ahead under the loader, a few elements a task (glyph
// keeps them), so the rules' own measures are quick: every run of type byRules, pageRules and rules read
const INKED = [RULED, '.by-label, .by-syllabus li > *, .by-note div p:last-child',
  '.price-first p, .price-fund p, .price-fund li > :last-child, .price-year, .price-gets p, .price-gets li > :last-child',
  '.foot h2 .line, .foot-media figcaption, .foot-note, .foot-note span, .foot-label, .foot-links a, .foot-mark, .foot-made > span'].join(', ');
async function warmGlyphs(pause) {
  let t = performance.now();
  for (const el of $$(INKED)) {
    const cs = getComputedStyle(el), font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, up = cs.textTransform === 'uppercase';
    for (const ch of 'HẨỌ' + el.textContent) {
      if (ch.trim()) glyph(font, up ? ch.toUpperCase() : ch);
      if (performance.now() - t > 8) { await pause(); t = performance.now(); }
    }
  }
}
// inkOf a few elements a task (pause as byRules takes it; without it, one call), the same as one call
async function inkOfSliced(els, origin, skip, only, pause) {
  if (!pause) return inkOf(els, origin, skip, only);
  const lines = [], ink = [];
  let t = performance.now();
  for (const el of els) {
    const r = inkOf([el], origin, skip, only);
    for (const l of r.lines) if (!lines.some(m => Math.abs(m.base - l.base) < 1)) lines.push(l);
    ink.push(...r.ink);
    if (performance.now() - t > 8) { await pause(); t = performance.now(); }
  }
  return { lines: lines.sort((a, b) => a.mid - b.mid), ink };
}
// hairlines at ys across left to right, in box, each broken round the ink of every letter it would run
// through, a little either side of it, as text-decoration-skip-ink does: no mark is ever crossed
// (each on a whole device pixel of the page, not of its box, which may sit between two, and as thick
// as the others: --hair, a whole number of device pixels)
function lay(box, ys, left, right, ink, cls = '', keep = false) {
  const dpr = devicePixelRatio || 1, off = box.getBoundingClientRect().top - root.getBoundingClientRect().top;   // against the page, not the rounded scroll
  root.style.setProperty('--hair', `${Math.max(1, Math.round(dpr)) / dpr}px`);
  if (!box._watched) { box._watched = true; queueMicrotask(() => watchRules(box)); }
  if (!keep) box.replaceChildren();
  return ys.map(y => {
    const want = y;
    y = Math.round((off + y) * dpr) / dpr - off;
    const gaps = ink.filter(c => c.top - 1.5 <= y + 1 && c.bottom + 1.5 >= y).map(c => [c.x0 - .14 * c.fs, c.x1 + .14 * c.fs]).sort((a, b) => a[0] - b[0]);
    const rule = document.createElement('div');
    if (cls) rule.className = cls;
    rule.style.top = `${y}px`; rule.dataset.y = want;
    let x = left;
    for (const [g0, g1] of [...gaps, [right, right]]) {
      const end = Math.min(g0, right);
      if (end - x > 1.5) { const i = document.createElement('i'); i.style.left = `${x}px`; i.style.width = `${end - x}px`; rule.append(i); }
      x = Math.max(x, g1);
    }
    box.append(rule);
    return rule;
  });
}
// the rules put back on whole device pixels when what is above them moves them by a fraction of one
// (Level up's pin making room, the fan's stage, a resize): each from where it was meant to be
function snapRules(boxes = $$('.hero-rules, .by-rules, .page-rules')) {
  const dpr = devicePixelRatio || 1;
  root.style.setProperty('--hair', `${Math.max(1, Math.round(dpr)) / dpr}px`);
  for (const box of boxes) {
    const off = box.getBoundingClientRect().top - root.getBoundingClientRect().top;
    for (const rule of box.children) if (rule.dataset.y) rule.style.top = `${Math.round((off + +rule.dataset.y) * dpr) / dpr - off}px`;
  }
}
// and again as each set comes near the screen, whatever moved it since
const nearing = new IntersectionObserver(es => snapRules(es.filter(e => e.isIntersecting).map(e => e.target)), { rootMargin: '50% 0px' });
const watchRules = box => nearing.observe(box);
let snapping = 0;
const snapSoon = () => { cancelAnimationFrame(snapping); snapping = requestAnimationFrame(() => snapRules()); };
{ const ro = new ResizeObserver(snapSoon); for (const el of [document.body, $('main'), ...$$('main > *')]) ro.observe(el); }
addEventListener('load', snapSoon);
function rules() {
  const hero = $('.hero');
  let box = $('.hero-rules', hero);
  if (!box) { box = document.createElement('div'); box.className = 'hero-rules'; box.setAttribute('aria-hidden', 'true'); hero.prepend(box); }
  const hr = hero.getBoundingClientRect(), hs = getComputedStyle(hero);
  const { lines, ink } = inkOf($$(RULED, hero), hr, el => el.matches('.num'));
  if (!lines.length) return [];
  const P = lines[0].pitch, c0 = lines[0].marks, rows = Math.round((lines.at(-1).marks - c0) / P) + 1;
  const ys = Array.from({ length: rows + 1 }, (_, k) => c0 - P / 2 + k * P);
  return lay(box, ys, parseFloat(hs.paddingLeft), hr.width - parseFloat(hs.paddingRight), ink, 'hero-rule');
}
let ruling = 0, settled = false, fanLenis = null;   // settled: the hero's intro is over and its type at rest
// told to the page too (the root's class and an event, 'hero-settled'; the title marked 'risen'), for the
// titles' shader (title-shader.js) and the ice (ice.js)
const risen = h => { h?.classList.add('risen'); h?.dispatchEvent(new Event('risen')); };
const settle = () => { settled = true; root.classList.add('hero-settled'); document.dispatchEvent(new Event('hero-settled')); risen($('.hero-title')); };
addEventListener('resize', () => { cancelAnimationFrame(ruling); ruling = requestAnimationFrame(() => rules()); });

// ----- 2b. By Lavi -----
// the syllabus on one line grid with the left's rules, as the Figma's Frame 20 has it: the session's rule
// is the first, the syllabus is set so its first line's caps are centred under it, and the rules go on a
// line apart from there to one empty line under its last (on a narrow screen, to the strip's top, which
// is moved onto the grid); they run from the page's edge to the strip (across the screen when narrow)
// and break round the letters' ink. Measured with the scroll's reveal off (.measuring)
// (pause, when given: awaited between its measures, so under the loader none is a long task; without
// it, as on a resize, it runs through at once)
async function byRules(pause) {
  const frame = $('.by-frame'), left = $('.by-left'), ruled = $('.by-ruled'), time = $('.by-time'), stripEl = $('.by-strip');
  const narrow = matchMedia('(max-width: 899px)').matches;
  let box = $('.by-rules', frame);
  if (!box) { box = document.createElement('div'); box.className = 'by-rules'; box.setAttribute('aria-hidden', 'true'); frame.append(box); }
  root.classList.add('measuring');
  ruled.style.marginTop = ''; left.style.paddingBottom = '';
  const texts = () => $$('.by-label, .by-syllabus li > *', frame), num = el => el.matches('.serif');
  let fr = frame.getBoundingClientRect();
  const first = time.getBoundingClientRect().bottom - fr.top - 1;
  const { lines } = inkOf(texts(), fr, num, inkOf.LINES);
  if (!lines.length) { root.classList.remove('measuring'); return; }
  if (pause) await pause();
  const P = lines[0].pitch;
  // (on a narrow screen, where the lines are loose, each is centred with its marks: from a capital's
  // mark over it to the dot under, so the rule over it is as far from its marks as the one under from
  // its foot)
  ruled.style.marginTop = `${first + P / 2 - (narrow ? lines[0].marks : lines[0].mid)}px`;
  fr = frame.getBoundingClientRect();
  let last;
  if (narrow) {
    const end = left.getBoundingClientRect().bottom - fr.top, n = Math.ceil((end - first) / P - .01);
    last = first + n * P; left.style.paddingBottom = `${last - end}px`;
  } else {
    const { lines: set } = inkOf(texts(), fr, num, inkOf.LINES);
    last = first + (Math.ceil((set.at(-1).mid - first) / P) + 2) * P;   // the rule under the last line, an empty line, then this (not drawn)
  }
  if (pause) await pause();
  fr = frame.getBoundingClientRect();
  const { ink } = await inkOfSliced(texts(), fr, num, '', pause);
  const ys = [];
  for (let y = first + P; y < last - P / 2; y += P) ys.push(y);
  lay(box, ys, 0, narrow ? fr.width : stripEl.getBoundingClientRect().left - fr.left, ink);
  if (pause) await pause();
  // on the right, the list under "chuẩn bị" ruled the same way, from the strip to the page's edge: a
  // rule over its first line, one under each
  if (!narrow) {
    const list = $('.by-note div p:last-child'), { lines: rows, ink: marks } = inkOf([list], fr);
    if (rows.length) {
      const Q = rows[0].pitch, at = Array.from({ length: rows.length + 1 }, (_, k) => rows[0].mid - Q / 2 + k * Q);
      lay(box, at, stripEl.getBoundingClientRect().right - fr.left, fr.width, marks, '', true);
    }
  }
  root.classList.remove('measuring');
}
let byRuling = 0;
addEventListener('resize', () => { cancelAnimationFrame(byRuling); byRuling = requestAnimationFrame(() => byRules()); });

// ----- 2c. the price's and the footer's rules -----
// hairlines across the page as Figma's Frames 21 and 22 have them, each broken round the letters' ink:
// in the price, ruled paper under its small type, each line centred, its marks and all, between two rules
// a line apart, empty lines ruled too; in the footer, ruled paper set by its note (so it scales
// with the type): each of the note's lines centred, its marks and all, between two rules a line apart,
// and on up from there evenly a line apart, to the last that keeps at least five sixths of a line
// under the title and the clip. Measured as the type rests (.measuring)
// (pause as byRules takes it)
async function pageRules(pause) {
  root.classList.add('measuring');
  const layer = sec => {
    let b = $(':scope > .page-rules', sec);
    if (!b) { b = document.createElement('div'); b.className = 'page-rules'; b.setAttribute('aria-hidden', 'true'); sec.prepend(b); }
    return b;
  };
  const fsOf = el => parseFloat(getComputedStyle(el).fontSize);
  // no stubs: a piece of a rule shorter than 12 between a letter and the page's edge is left out
  const tidy = rules => rules.forEach(r => [...r.children].forEach(i => { if (parseFloat(i.style.width) < 12) i.remove(); }));
  {
    const sec = $('.price'), sr = sec.getBoundingClientRect();
    const small = $$('.price-first p, .price-fund p, .price-fund li > :last-child, .price-year, .price-gets p, .price-gets li > :last-child', sec);
    // the type is on one line grid (index.html): a rule half a line either side of each line's middle,
    // empty lines too, so they are evenly a line apart
    const { lines, ink } = await inkOfSliced(small, sr, undefined, '', pause);
    if (lines.length) {
      const top = Math.min(...lines.map(l => l.marks)), end = Math.max(...lines.map(l => l.marks));
      const P = lines[0].pitch, n = Math.round((end - top) / P);
      // each rule a line of the grid, but under the lines it keeps to the type's own middles, the lowest
      // where the columns differ a little, so no line ever drifts off the middle of its two
      const at = k => { const y = top + (k - .5) * P, on = lines.filter(l => Math.abs(l.marks + P / 2 - y) < P / 2); return on.length ? Math.max(...on.map(l => l.marks)) + P / 2 : y; };
      tidy(lay(layer(sec), Array.from({ length: n + 2 }, (_, k) => at(k)), 0, sr.width, ink));
    }
  }
  if (pause) await pause();
  {
    const sec = $('.foot'), sr = sec.getBoundingClientRect();
    const at = el => { const r = el.getBoundingClientRect(); return { top: r.top - sr.top, bottom: r.bottom - sr.top }; };
    const lines = $$('h2 .line', sec), note = $('.foot-note', sec);
    // the note's row lowered (--nudge) so "liên hệ qua" is a whole number of its lines over it
    sec.style.setProperty('--nudge', '0px');
    {
      const [n0] = inkOf([note], sr, undefined, inkOf.LINES).lines, [l0] = inkOf([$('.foot-label', sec)], sr, undefined, inkOf.LINES).lines;
      if (n0 && l0) { const d = n0.marks - l0.marks, k = Math.max(1, Math.round(d / n0.pitch)); sec.style.setProperty('--nudge', `${k * n0.pitch - d}px`); }
    }
    const nt = at(note).top, ys = [], { lines: rows } = inkOf([note], sr, undefined, inkOf.LINES);
    if (rows.length) {
      // at the note's 24: half a line either side of each line's middle (from a capital's mark over it
      // to the dot under), the rest 24 apart up to 20 or more under the title
      const P = rows[0].pitch, above = Math.max(...[...lines, $('.foot-media', sec)].map(at).map(b => b.bottom).filter(b => b < nt));
      ys.push(...rows.map(r => r.marks + P / 2));
      do ys.unshift(ys[0] - P); while (ys[0] - P >= above + 5 * P / 6);
    }
    if (pause) await pause();
    const { ink } = await inkOfSliced($$('h2 .line, .foot-media figcaption, .foot-note span, .foot-label, .foot-links a, .foot-mark, .foot-made > span', sec), sr, undefined, '', pause);
    { const q = $('.qr', sec).getBoundingClientRect(); if (q.width) ink.push({ x0: q.left - sr.left, x1: q.right - sr.left, top: q.top - sr.top, bottom: q.bottom - sr.top, fs: 12 }); }   // the QR code broken round too
    tidy(lay(layer(sec), ys, 0, sr.width, ink));
  }
  root.classList.remove('measuring');
}
let pageRuling = 0;
addEventListener('resize', () => { cancelAnimationFrame(pageRuling); pageRuling = requestAnimationFrame(() => pageRules()); });

// the quote in the strip, running down it as a marquee does (its words read upward), along the band on
// a narrow screen; quicker as the page scrolls. Still under reduced motion
const QUOTE = 'The highest honour is the one held in the fans’ hearts.';
function strip(lenis) {
  const el = $('.by-strip'), run = $('.by-strip-run');
  let unit = 0, at = 0, up = true;
  const build = () => {
    up = !matchMedia('(max-width: 899px)').matches;
    const span = () => { const s = document.createElement('span'); s.textContent = `${QUOTE} {*}`; return s; };
    run.replaceChildren(span());
    unit = run.firstChild.getBoundingClientRect().width;
    const length = up ? el.clientHeight : el.clientWidth;
    for (let i = 1; i < Math.ceil(length / unit) + 2; i++) run.append(span());
    run.style.transformOrigin = '0 0';
  };
  const place = () => { run.style.transform = up ? `rotate(-90deg) translate(${-at}px, -50%)` : `translate(${-at}px, -50%)`; };
  build(); place();
  addEventListener('resize', () => requestAnimationFrame(() => { build(); place(); }));
  if (reduce) return;
  const st = onScreen(el);
  gsap.ticker.add((time, dt) => {
    if (!st.isActive || !unit) return;
    const v = lenis ? Math.abs(lenis.velocity) : 0;
    at = (at + dt / 1000 * (up ? 34 : 28) + v * .6) % unit;
    place();
  });
}
const onScreen = el => ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top' });

// the picture in the corner: one the visitor puts in (picked, or dropped on the frame), dithered as the
// portrait above is (the same Bayer 8x8 in the magenta's three shades, dither.js), under the class's
// name; downloaded as a picture with the whole frame, the magenta round it and the name on it. Nothing
// leaves the page
function camera() {
  const cam = $('.by-cam'), box = $('.by-cam-box'), cv = $('canvas', box), idle = $('.by-cam-idle p', cam), file = $('.by-cam-file', cam);
  let pic = null;
  const paint = () => { if (!pic) return; const r = box.getBoundingClientRect(); ditherDraw(cv, pic, 2, r.width, r.height, 92); };
  const take = async f => {
    if (!f || !f.type.startsWith('image/')) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.src = url;
    try { await img.decode(); } catch { URL.revokeObjectURL(url); idle.textContent = 'không mở được ảnh này, thử ảnh JPG hoặc PNG'; return; }
    if (pic) URL.revokeObjectURL(pic.src);
    pic = img; paint(); cam.classList.add('live');
  };
  const save = () => {
    const b = box.getBoundingClientRect(), tag = $('.by-cam-tag', cam), t = tag.getBoundingClientRect();
    // three times the frame's size, the magenta 24 round it, the frame and the name, on every side
    const words = [...tag.children].map(w => { const r = document.createRange(); r.selectNodeContents(w); return r.getBoundingClientRect(); }), c = { left: Math.min(b.left, ...words.map(w => w.left)), top: b.top, right: Math.max(b.right, ...words.map(w => w.right)) };
    const k = 3, m = 24, out = document.createElement('canvas'), g = out.getContext('2d');
    out.width = Math.round((c.right - c.left + 2 * m) * k); out.height = Math.round((t.bottom - c.top + 2 * m) * k);
    g.fillStyle = '#c239c7'; g.fillRect(0, 0, out.width, out.height);
    g.translate(m * k, m * k);
    const x = (b.left - c.left) * k, y = (b.top - c.top) * k, w = b.width * k, h = b.height * k, r = parseFloat(getComputedStyle(box).borderTopLeftRadius) * k;
    g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
    g.imageSmoothingEnabled = false; g.drawImage(cv, x, y, w, h); g.restore();
    const stroke = 2 * (parseFloat(getComputedStyle(tag).getPropertyValue('--r')) || 8);   // the ground's width, either side
    // every word's ground first, then every word, so no ground covers a word
    for (const pass of ['ground', 'type']) for (const s of tag.children) {
      const cs = getComputedStyle(s), sb = s.getBoundingClientRect();
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
      g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      const word = s.textContent.toUpperCase(), cx = (sb.left + sb.width / 2 - c.left) * k, base = (sb.bottom - c.top) * k;
      if (pass === 'ground') { g.lineWidth = stroke * k; g.strokeStyle = '#c239c7'; g.strokeText(word, cx, base); }
      else { g.fillStyle = '#000'; g.fillText(word, cx, base); }
    }
    out.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'the-visualizers-club.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
  };
  cam.addEventListener('click', e => {
    const what = e.target.closest('[data-cam]')?.dataset.cam;
    if (what === 'pick') file.click(); else if (what === 'save') save();
  });
  file.addEventListener('change', () => { take(file.files[0]); file.value = ''; });
  box.addEventListener('dragover', e => { e.preventDefault(); cam.classList.add('over'); });
  box.addEventListener('dragleave', () => cam.classList.remove('over'));
  box.addEventListener('drop', e => { e.preventDefault(); cam.classList.remove('over'); take(e.dataTransfer.files[0]); });
  new ResizeObserver(paint).observe(box);   // drawn again, cells and all, when the frame changes size
}

// ----- 1a. the x-ray -----
// a lens that follows the pointer over the whole page and shows its make-up as a designer reads it,
// measured from the live layout of what is on the screen: the 12 columns, the letters as outlines, each
// block of type's box, its lines' cap heights and baselines, its face, size and tracking, the spaces
// between blocks, the order the eye reads them in (by size), the pictures' frames and sizes (left open,
// so the pictures show through), each of the fan's prints framed where it is as it turns, and the
// page's ruled lines, faint. Drawn on a canvas the screen's size
// as the page slows under the lens and every third of a second while it is open, sliding with the page
// between (it closes while the page scrolls fast); the lens only moves, a transform. On a mouse only:
// on touch nothing hovers. A switch in the screen's bottom right corner turns it off and on again
// ("Reveal On" / "Reveal Off"), remembered on this browser
// What the lens shows, each part on (true) or off (false), to be picked as the site's owners like.
// Type under outlineFrom px stays solid, as it reads on the page; type that size and over is drawn
// as outlines (0: all of it outlined, Infinity: all of it solid)
const LENS = {
  outlineFrom: 48,   // the size (px) from which type is drawn as outlines
  columns: true,     // the 12 columns, numbered, with the margin, gutter and column widths
  pictures: true,    // the pictures' frames and sizes
  rules: true,       // the page's ruled lines, faint
  boxes: true,       // each block of type's box, dashed
  lines: true,       // each line's cap height and baseline
  labels: true,      // each block's name, face, size and tracking
  ranks: true,       // the order the eye reads the blocks in (by size)
  spaces: true,      // the spaces between blocks
  marquee: true,     // By Lavi's running strip
  level: true,       // Level up's stairs
  prints: true,      // the fan's prints, framed and named
  clock: true,       // the clock's names
};
function xray() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let enabled = true;
  try { enabled = localStorage.getItem('reveal') !== 'off'; } catch {}
  // a switch: "Reveal", its state, and a track the knob slides along
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'xr-toggle'; toggle.setAttribute('role', 'switch');
  toggle.innerHTML = '<span class="xr-name">Reveal</span><span class="xr-state"></span><span class="xr-track" aria-hidden="true"><span class="xr-knob"></span></span>';
  const show = () => { $('.xr-state', toggle).textContent = enabled ? 'On' : 'Off'; toggle.setAttribute('aria-checked', String(enabled)); };
  toggle.addEventListener('click', () => { enabled = !enabled; show(); try { localStorage.setItem('reveal', enabled ? 'on' : 'off'); } catch {} });
  show(); document.body.append(toggle);
  const lens = document.createElement('div'), map = document.createElement('canvas'), ring = document.createElement('div');
  lens.className = 'xr-lens'; ring.className = 'xr-ring'; lens.setAttribute('aria-hidden', 'true');
  const live = document.createElement('canvas'), lg = live.getContext('2d');   // the type that moves, drawn every frame
  lens.append(map, live, ring); document.body.append(lens);
  const g = map.getContext('2d'), meas = document.createElement('canvas').getContext('2d'), R = 160, MAG = '#c239c7';
  Object.assign(lens.style, { width: `${2 * R}px`, height: `${2 * R}px` });
  const label = (text, x, y, align = 'left') => {
    g.font = '400 11px "ABC Areal", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    const w = g.measureText(text).width + 10, lx = align === 'right' ? x - w : x;
    g.fillStyle = '#000'; g.fillRect(lx, y - 8, w, 16);
    g.fillStyle = MAG; g.fillText(text, lx + 5, y + .5);
  };
  // a box of type holds only inline content (or nothing shown, or the slip's copies of its text, or what
  // has no text: a strike, a rule; or what is only for a screen reader or not drawn at all, as the
  // price's rolling digit once it has rolled)
  const inline = el => {
    const d = getComputedStyle(el).display;
    return d.startsWith('inline') || d === 'none' || el.tagName === 'BR'
      || !el.textContent.trim() || !!el.closest('.sr-only') || !el.getClientRects().length;
  };
  // a run of text that is drawn: not the slip's copies, nor for a screen reader only, nor hidden
  const drawn = t => { const p = t.parentElement; return !p.closest('.sr-only') && p.getClientRects().length && getComputedStyle(p).visibility !== 'hidden'; };
  const shown = el => { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > .05; };
  const draw = () => {
    const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
    map.width = Math.round(W * dpr); map.height = Math.round(H * dpr);
    Object.assign(map.style, { width: `${W}px`, height: `${H}px` });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const on = r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
    // the pictures: left open, framed and sized
    // (a canvas over most of the screen is a backdrop, the fan's or Level up's turn, not a picture: the fan's
    // own frame stands for it while the hero is up)
    const pics = $$('.by :is(img, canvas, video)').filter(e => { const r = e.getBoundingClientRect(); return on(r) && r.width * r.height > 2500 && r.width * r.height < .5 * W * H && shown(e) && !e.closest('.xr-lens, .fan-stage, .title-shader'); });
    const slot = $('#fanSlot'), fanCanvas = $('.fan-stage canvas');
    if (scrollY < innerHeight * .4) { if (on(slot.getBoundingClientRect())) pics.push(slot); }
    else if (fanCanvas && shown(fanCanvas) && on(fanCanvas.getBoundingClientRect())) pics.push(fanCanvas);
    // (the type turned on its side and running, the strip's quote and Level up's stairs, and the
    // clock's names in the SVG, are drawn in the lens's live layer, every frame: drawLive)
    for (const e of pics) { const r = e.getBoundingClientRect(); g.clearRect(r.left, r.top, r.width, r.height); }
    // the columns
    const m = 16 * W / 1728, cw = (W - 2 * m - 11 * m) / 12;
    if (LENS.columns) {
      for (let i = 0; i < 12; i++) {
        const x = m + i * (cw + m);
        g.fillStyle = 'rgba(194,57,199,.11)'; g.fillRect(x, 0, cw, H);
        label(String(i + 1), x, H - 14);
      }
      label(`Lề ${Math.round(m)} · rãnh ${Math.round(m)} · cột ${cw.toFixed(1)}`, W - m, H - 34, 'right');
    }
    g.lineWidth = 1;
    if (LENS.pictures) for (const e of pics) {
      const r = e.getBoundingClientRect(), kind = e === slot ? 'Logo băng · 3D (WebGL)' : e === fanCanvas ? 'Show work · fan 3D (WebGL)' : e.tagName === 'IMG' ? 'Ảnh' : e.tagName === 'VIDEO' ? 'Video' : 'Canvas';
      g.strokeStyle = MAG; g.setLineDash([6, 4]); g.strokeRect(Math.max(0, r.left) + .5, Math.max(0, r.top) + .5, Math.min(W, r.right) - Math.max(0, r.left) - 1, Math.min(H, r.bottom) - Math.max(0, r.top) - 1); g.setLineDash([]);
      label(`${kind} · ${Math.round(r.width)} × ${Math.round(r.height)}`, Math.max(0, r.left) + 8, Math.max(0, r.top) + 14);
    }
    // the page's ruled lines, faint
    g.strokeStyle = 'rgba(194,57,199,.35)';
    if (LENS.rules) for (const i of $$('.hero-rule i, .by-rules i, .page-rules i')) { const r = i.getBoundingClientRect(); if (on({ ...r.toJSON(), height: 1 })) { g.beginPath(); g.moveTo(r.left, r.top + .5); g.lineTo(r.right, r.top + .5); g.stroke(); } }
    // the blocks of type on the screen: boxes holding only inline content
    const blocks = [];
    for (const e of $$('.by *')) {   // (it opens over By Lavi only: its type only)
      if (e.closest('.sr-only, .xr-lens, svg, .by-strip, .level-stack') || inline(e) || !e.textContent.trim()) continue;
      const r = e.getBoundingClientRect();
      if (!on(r) || !shown(e) || ![...e.querySelectorAll('*')].every(inline)) continue;
      blocks.push(e);
    }
    const info = [];
    for (const e of blocks) {
      const cs = getComputedStyle(e), fs = parseFloat(cs.fontSize), up = cs.textTransform === 'uppercase';
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      meas.font = font;
      const mH = meas.measureText('H'), asc = mH.fontBoundingBoxAscent, cap = mH.actualBoundingBoxAscent;
      const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: t => drawn(t) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }), rg = document.createRange();
      const lines = [];
      g.font = font; g.textBaseline = 'alphabetic'; g.strokeStyle = g.fillStyle = MAG;
      const solid = fs < LENS.outlineFrom;
      for (let t; (t = walk.nextNode());) for (let k = 0; k < t.length; k++) {
        const ch = t.data[k];
        if (!ch.trim()) continue;
        rg.setStart(t, k); rg.setEnd(t, k + 1);
        const b = rg.getBoundingClientRect();
        if (!b.width || b.bottom < 0 || b.top > H) continue;
        const base = b.top + asc;
        if (solid) g.fillText(up ? ch.toUpperCase() : ch, b.left, base); else g.strokeText(up ? ch.toUpperCase() : ch, b.left, base);
        const l = lines.find(l => Math.abs(l.base - base) < 1);
        if (l) { l.x0 = Math.min(l.x0, b.left); l.x1 = Math.max(l.x1, b.right); } else lines.push({ base, x0: b.left, x1: b.right });
      }
      if (!lines.length) continue;
      const b = e.getBoundingClientRect(), ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / fs * 100;
      const big = fs >= 48 || !!e.closest('h1, h2');
      info.push({ name: big ? 'Tiêu đề' : 'Chữ', fs, ls, cap, lines, face: cs.fontFamily.split(',')[0].replace(/"/g, ''), italic: cs.fontStyle === 'italic', box: { x: b.left, y: b.top, w: b.width, h: b.height } });
    }
    const sizes = [...new Set(info.map(i => Math.round(i.fs)))].sort((a, b) => b - a);
    for (const i of info) {
      const { x, y, w, h } = i.box;
      if (LENS.boxes) { g.strokeStyle = MAG; g.setLineDash([3, 3]); g.strokeRect(x + .5, y + .5, w - 1, h - 1); g.setLineDash([]); }
      if (LENS.lines) for (const l of i.lines) {
        g.strokeStyle = 'rgba(194,57,199,.45)'; g.beginPath(); g.moveTo(l.x0 - 6, l.base - i.cap + .5); g.lineTo(l.x1 + 6, l.base - i.cap + .5); g.stroke();
        g.strokeStyle = MAG; g.beginPath(); g.moveTo(l.x0 - 6, l.base + .5); g.lineTo(l.x1 + 6, l.base + .5); g.stroke();
      }
      if (LENS.ranks) {
        const rank = sizes.indexOf(Math.round(i.fs)) + 1;
        g.fillStyle = MAG; g.beginPath(); g.arc(x - 12, y + 6, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#000'; g.font = '500 10px "ABC Areal", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(rank), x - 12, y + 6.5); g.textAlign = 'left';
      }
      if (LENS.labels) label(`${i.name} · ${i.face}${i.italic ? ' Italic' : ''} · ${Math.round(i.fs)}px · tracking ${i.ls.toFixed(0)}%`, x, y - 10);
    }
    // the spaces: from each block to the nearest one under it that shares some width with it
    if (LENS.spaces) for (const a of info) {
      let best = null;
      for (const b of info) {
        if (b === a || b.box.y < a.box.y + a.box.h - 1) continue;
        const o0 = Math.max(a.box.x, b.box.x), o1 = Math.min(a.box.x + a.box.w, b.box.x + b.box.w);
        if (o1 - o0 < 4) continue;
        if (!best || b.box.y < best.b.box.y) best = { b, x: (o0 + o1) / 2 };
      }
      if (!best) continue;
      const y0 = a.box.y + a.box.h, y1 = best.b.box.y;
      if (y1 - y0 < 2) continue;
      g.strokeStyle = MAG; g.beginPath();
      g.moveTo(best.x + .5, y0); g.lineTo(best.x + .5, y1); g.moveTo(best.x - 4, y0 + .5); g.lineTo(best.x + 5, y0 + .5); g.moveTo(best.x - 4, y1 - .5); g.lineTo(best.x + 5, y1 - .5); g.stroke();
      if (y1 - y0 > 14) label(`${Math.round(y1 - y0)}`, best.x + 6, (y0 + y1) / 2);
    }
  };
  // ---- the live layer: type that turns and runs as the lens looks, drawn where it is this frame ----
  // an element's own box mapped to the screen through every transform between it and an unmoved box
  // (stop): its offsets and transforms, about their origins, up its offset parents
  const toScreen = (el, stop) => {
    let m = new DOMMatrix();
    for (let e = el; e && e !== stop; e = e.offsetParent) {
      const cs = getComputedStyle(e);
      let t = new DOMMatrix();
      if (cs.transform !== 'none') { const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat); t = new DOMMatrix().translate(ox, oy).multiply(new DOMMatrix(cs.transform)).translate(-ox, -oy); }
      m = new DOMMatrix().translate(e.offsetLeft, e.offsetTop).multiply(t).multiply(m);
    }
    const r = stop.getBoundingClientRect();
    return new DOMMatrix().translate(r.left, r.top).multiply(m);
  };
  const clockText = () => $$('.level-clock text');
  let fanMod = null;
  import('./fan.js').then(m => { fanMod = m; }, () => {});
  const drawLive = () => {
    const dpr = devicePixelRatio || 1, S = 2 * R;
    if (live.width !== Math.round(S * dpr)) { live.width = live.height = Math.round(S * dpr); Object.assign(live.style, { position: 'absolute', left: 0, top: 0, width: `${S}px`, height: `${S}px` }); }
    const ox = at.x - R, oy = at.y - R, view = new DOMMatrix().scale(dpr, dpr).translate(-ox, -oy);
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, live.width, live.height);
    const near = el => { const r = el.getBoundingClientRect(); return r.right > ox && r.left < ox + S && r.bottom > oy && r.top < oy + S; };
    // the stairs' tags and the strip's words: outlined where they are, turned and scaled as they are,
    // inside the box that clips them, with their box, cap line and baseline, and named
    const groups = [...(LENS.level ? $$('.level-col').map(col => [$$('.level-tag > span', col), col, col.offsetParent, 'Level up']) : []),
      ...(LENS.marquee ? [[$$('.by-strip-run > span'), $('.by-strip'), $('.by-strip'), 'Marquee']] : [])];
    let named = 0;
    for (const [spans, clip, stop, name] of groups) {
      if (!clip || !near(clip)) continue;
      lg.save();
      const mc = clip === stop ? new DOMMatrix().translate(stop.getBoundingClientRect().left, stop.getBoundingClientRect().top) : toScreen(clip, stop);
      lg.setTransform(view.multiply(mc)); lg.beginPath(); lg.rect(0, 0, clip.offsetWidth, clip.offsetHeight); lg.clip();
      for (const sp of spans) {
        const cs = getComputedStyle(sp), fs = parseFloat(cs.fontSize), m = toScreen(sp, stop);
        meas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const mH = meas.measureText('H'), cap = mH.actualBoundingBoxAscent, w = sp.offsetWidth, h = sp.offsetHeight;
        // a trimmed run (a tag's) sits on its box's foot; an untrimmed one (the strip's) on its line's baseline
        const base = cs.textBoxTrim && cs.textBoxTrim !== 'none' ? h : (h - (mH.fontBoundingBoxAscent + mH.fontBoundingBoxDescent)) / 2 + mH.fontBoundingBoxAscent;
        lg.setTransform(view.multiply(m));
        const k = Math.hypot(m.a, m.b) || 1;
        lg.lineWidth = 1 / k;
        lg.font = meas.font; lg.textBaseline = 'alphabetic'; lg.textAlign = 'left';
        const word = cs.textTransform === 'uppercase' ? sp.textContent.toUpperCase() : sp.textContent;
        lg.strokeStyle = lg.fillStyle = MAG;
        if (fs * k < LENS.outlineFrom) lg.fillText(word, 0, base); else lg.strokeText(word, 0, base);
        if (LENS.lines) {
          lg.strokeStyle = 'rgba(194,57,199,.45)'; lg.beginPath(); lg.moveTo(-6, base - cap); lg.lineTo(w + 6, base - cap); lg.stroke();
          lg.strokeStyle = MAG; lg.beginPath(); lg.moveTo(-6, base); lg.lineTo(w + 6, base); lg.stroke();
        }
        if (LENS.boxes) { lg.setLineDash([3 / k, 3 / k]); lg.strokeRect(0, 0, w, h); lg.setLineDash([]); }
      }
      lg.restore();
      // its name, once, upright, at the first of its runs in the lens
      const first = spans.find(near);
      if (first && named < 3 && LENS.labels) {
        named++;
        const r = first.getBoundingClientRect(), cs = getComputedStyle(first), m = toScreen(first, stop), k = Math.hypot(m.a, m.b);
        lg.setTransform(view);
        g2label(`${name} · ${cs.fontFamily.split(',')[0].replace(/"/g, '')}${cs.fontStyle === 'italic' ? ' Italic' : ''} · ${Math.round(parseFloat(cs.fontSize) * k)}px · xoay 90°`, Math.max(ox + 8, r.left), Math.max(oy + 14, r.top - 10));
      }
    }
    // the fan's prints, each framed where it is this frame, bent as it is: a print seen face on in
    // magenta, one seen from behind faint, each named with its picture's size
    const prints = LENS.prints ? fanMod?.outlines() ?? [] : [];
    if (prints.length) {
      const c = prints[0].clip;
      lg.save(); lg.setTransform(view); lg.beginPath(); lg.rect(c.left, c.top, c.width, c.height); lg.clip();
      lg.lineWidth = 1; lg.setLineDash([6, 4]);
      for (const p of prints) {
        const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
        if (Math.max(...xs) < ox || Math.min(...xs) > ox + S || Math.max(...ys) < oy || Math.min(...ys) > oy + S) continue;
        lg.strokeStyle = p.face ? MAG : 'rgba(194,57,199,.35)';
        lg.beginPath(); p.pts.forEach(([x, y], i) => (i ? lg.lineTo(x, y) : lg.moveTo(x, y))); lg.closePath(); lg.stroke();
      }
      lg.setLineDash([]); lg.restore();
      lg.setTransform(view);
      // named nearest first, at the edge's top left where it is in the lens (the whole name inside its
      // circle) and not under a nearer print
      const inPoly = (pts, x, y) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) k = !k; } return k; };
      const cx = ox + R, cy = oy + R, within = (x, y) => Math.hypot(x - cx, y - cy) < R - 2;
      const order = [...prints].sort((a, b) => a.depth - b.depth);
      lg.font = '400 11px "ABC Areal", sans-serif';
      let n = 0;
      order.forEach((p, i) => {
        if (n >= 3) return;
        const text = `${p.name} · ảnh ${p.w} × ${p.h}${p.face ? '' : ' · mặt sau'}`, tw = lg.measureText(text).width + 10;
        // beside each point of its edge, the name running right from it, or left where the right has no
        // room: the whole name over this print, none of it over a nearer one
        const over = (x, y) => [0, .25, .5, .75, 1].every(f => { const at = x + 2 + f * (tw - 4); return inPoly(p.pts, at, y) && !order.slice(0, i).some(q => inPoly(q.pts, at, y)); });
        const spots = p.pts.flatMap(([x, y]) => [[x + 6, y + 12], [x - 6 - tw, y + 12]]).filter(([x, y]) => x > c.left && y - 8 > c.top
          && within(x, y - 8) && within(x + tw, y - 8) && within(x, y + 8) && within(x + tw, y + 8) && over(x, y));
        if (!spots.length) return;
        const [x, y] = spots.reduce((a, b) => (b[0] + b[1] < a[0] + a[1] ? b : a));
        g2label(text, x, y); n++;
      });
    }
    // the clock's names, upright, in its SVG's scale
    const svg = $('.level-clock');
    if (LENS.clock && svg && near(svg)) {
      const sr = svg.getBoundingClientRect(), sc = sr.width / 1117;
      lg.setTransform(view);
      for (const t of clockText()) {
        const cs = getComputedStyle(t), fs = parseFloat(cs.fontSize) * sc, x = sr.left + +t.getAttribute('x') * sc, y = sr.top + +t.getAttribute('y') * sc;
        lg.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
        const word = t.textContent.toUpperCase(), w = lg.measureText(word).width, anchor = t.getAttribute('text-anchor');
        const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
        if (x0 + w < ox || x0 > ox + S || y < oy || y - fs > oy + S) continue;
        lg.lineWidth = 1; lg.strokeStyle = lg.fillStyle = MAG; lg.textAlign = 'left'; lg.textBaseline = 'alphabetic';
        if (fs < LENS.outlineFrom) lg.fillText(word, x0, y); else lg.strokeText(word, x0, y);
        if (LENS.lines) { lg.beginPath(); lg.moveTo(x0 - 6, y + .5); lg.lineTo(x0 + w + 6, y + .5); lg.stroke(); }
        if (LENS.labels) g2label(`Chữ · ${cs.fontFamily.split(',')[0].replace(/"/g, '')} · ${Math.round(fs)}px`, x0, y - fs - 10);
      }
    }
  };
  // a name tag on the live layer, in screen pixels
  const g2label = (text, x, y) => {
    lg.font = '400 11px "ABC Areal", sans-serif'; lg.textBaseline = 'middle'; lg.textAlign = 'left';
    const w = lg.measureText(text).width + 10;
    lg.fillStyle = '#000'; lg.fillRect(x, y - 8, w, 16);
    lg.fillStyle = MAG; lg.fillText(text, x + 5, y + .5);
  };
  // the lens: eased toward the pointer; open once the hero's intro is done, while the page is at rest
  // (drawn afresh each time it comes to rest), closed while it scrolls or the pointer is off the page
  const byEl = $('.by');
  const at = { x: 0, y: 0, r: 0 }, go = { x: gsap.quickTo(at, 'x', { duration: .35, ease: 'power3' }), y: gsap.quickTo(at, 'y', { duration: .35, ease: 'power3' }) };
  let px = -1, py = -1, over = false, open = false, still = 0, drawnAt = NaN, last = 0, prevY = scrollY;
  addEventListener('pointermove', e => { if (!over) { at.x = e.clientX; at.y = e.clientY; } over = true; px = e.clientX; py = e.clientY; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { over = false; });
  addEventListener('blur', () => { over = false; });
  addEventListener('resize', () => { drawnAt = NaN; });
  gsap.ticker.add((time, dt) => {
    // open while the page is still or gliding slowly (the eased scroll glides on for seconds after the
    // wheel stops); the screen's drawing slides with the page as it glides, and is drawn afresh every
    // third of a second, so the outlines stay on the type, the rising reveals and the sticky fan too
    // (only over By Lavi: it opens as the pointer comes into that section and closes as it leaves, not
    // as the page scrolls; the drawing slides with the page between its redrawings)
    prevY = scrollY;
    const by = byEl.getBoundingClientRect();
    const want = enabled && over && settled && py >= by.top && py <= by.bottom;
    // (and always every 0.4 s while it is open: a block may start rising in after the page has stopped)
    if (want && (isNaN(drawnAt) || Math.abs(scrollY - drawnAt) > innerHeight * .3 || time - last > .4)) { draw(); drawnAt = scrollY; last = time; }
    if (want !== open) { open = want; gsap.to(at, { r: open ? R : 0, duration: open ? .6 : .45, ease: open ? 'power3.out' : 'power3.in', overwrite: 'auto' }); }   // grown in, shrunk out
    if (!open && at.r < .5) { if (lens.style.visibility !== 'hidden') lens.style.visibility = 'hidden'; return; }
    lens.style.visibility = 'visible';
    go.x(px); go.y(py);
    lens.style.transform = `translate(${at.x - R}px, ${at.y - R}px)`;
    map.style.transform = `translate(${R - at.x}px, ${R - at.y + (drawnAt - scrollY || 0)}px)`;
    lens.style.clipPath = `circle(${at.r.toFixed(1)}px at 50% 50%)`;
    drawLive();
  });
}

let heroRuled = null;
// the rules drawn in from both ends to the middle: a clip of two pieces, one from each side, growing to
// meet (a polygon whose middle part, between them, has no area)
const SIDES = a => `polygon(0% 0%, ${a}% 0%, ${a}% 100%, ${100 - a}% 100%, ${100 - a}% 0%, 100% 0%, 100% 100%, 0% 100%)`;
function intro() {
  const ruled = heroRuled ?? rules(), lines = $$('.hero-title > .line');
  // the title, in the screen's middle while the page loaded, goes up to its place line by line
  gsap.to(lines, { y: 0, duration: 1.8, ease: 'expo.inOut', stagger: .12, onComplete: () => { lines.forEach(l => { l.style.transform = ''; }); settle(); } });
  // as it goes, the hero's small type is uncovered where it stands, each block from its own side
  // (from the left on the screen's left, the right on its right, from its middle out in the middle);
  // then its rules are drawn in from both sides to the middle, the lowest first and up from there; and
  // as they start, the rooster grows in (ice.js, on 'hero-lines'): last, as it shows the page through
  // its ice, once there is the whole page to show
  const REST = .2, LINES = REST + .5;   // (the rest starts .2 s into the title's going up)
  const small = [...$$('.hero-bar > *'), ...$$('.hero-intro > *'), $('.hero-refund'), ...$$('.hero-promise > li'), $('.hero-scroll')].filter(Boolean);
  const from = small.map(e => {
    const r = e.getBoundingClientRect(), c = (r.left + r.width / 2) / innerWidth;
    // (reaching past the trimmed box above and below, so no accent is cut off as it goes)
    return c < .4 ? 'inset(-.6em 100% -.4em 0%)' : c > .6 ? 'inset(-.6em 0% -.4em 100%)' : 'inset(-.6em 50% -.4em 50%)';
  });
  gsap.set(small, { clipPath: i => from[i] });
  gsap.delayedCall(REST, () => root.classList.remove('intro'));
  gsap.to(small, { clipPath: 'inset(-.6em 0% -.4em 0%)', duration: .8, ease: 'power2.out', stagger: .03, delay: REST, clearProps: 'clipPath' });
  gsap.delayedCall(LINES - .3, () => { root.classList.add('hero-lines'); document.dispatchEvent(new Event('hero-lines')); });   // (the rooster, .3 s ahead of its rules)
  gsap.fromTo([...ruled].reverse(), { clipPath: SIDES(0) }, { clipPath: SIDES(50), duration: .9, stagger: .06, ease: 'expo.inOut', delay: LINES,
    onComplete() { this.targets().forEach(r => { r.style.clipPath = ''; }); } });
}

// By Lavi's rules, as the section comes into view: drawn in one after another, from the left and from the
// right in turn (the only motion the section has as it comes)
function byRulesIn() {
  const rs = $$('.by-rules > *');
  if (!rs.length || reduce) return;
  const from = rs.map((_, i) => (i % 2 ? 'inset(0 0% 0 100%)' : 'inset(0 100% 0 0%)'));
  gsap.set(rs, { clipPath: i => from[i] });
  gsap.to(rs, { clipPath: 'inset(0 0% 0 0%)', duration: .9, ease: 'expo.inOut', stagger: .035, clearProps: 'clipPath',
    scrollTrigger: { trigger: '.by', start: 'top 75%', once: true } });
}

// ----- 1b. the headings -----
// every section's title is at rest on the design's grid from the start, filled with its shader
function headings() {
  // (they no longer rise in: they are at rest from the start, so their shader is there at once, title-shader.js)
  for (const sel of ['.by-head h2', '.price h2', '.foot h2']) risen($(sel));
}

// ----- 2. the grid -----
function columns(parent, cls) {
  const g = document.createElement('div');
  g.className = cls; g.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 12; i++) g.append(document.createElement('span'));
  parent.prepend(g);
  return g;
}
// G: the page's grid, laid over everything, the way Figma shows a frame's layout grid
function gridKey() {
  const over = columns(document.body, 'grid-overlay');
  const size = () => over.style.setProperty('--w', `${$('main').clientWidth}px`);
  size(); addEventListener('resize', size);
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'g' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    over.classList.toggle('on');
  });
}

// ----- 3. the portrait -----
function portrait() {
  photo.setCell(10);
  const s = { cell: 10 };
  gsap.to(s, {
    cell: 1, duration: 1.6, ease: 'power3.inOut', onUpdate: () => photo.setCell(s.cell),
    scrollTrigger: { trigger: '.by-photo', start: 'top 80%', once: true },
  });
}

// ----- 3b. Level up's turn -----
// the noise behind Level up's dithered front, as Ironhill's section dissolve (Animmaster's rebuild): a
// level line pushed about by fractal noise (three octaves of value noise, half its strength as deep
// again), so it comes up in tongues and leaves islands behind and specks ahead; across its thin edge
// the cells step through the portrait's three levels of the magenta (Bayer 8x8), CELL Figma pixels
// square, drawn a canvas pixel a cell and scaled up a whole number of device pixels
const CELL = 4, SOFT = 260, SPREAD = 900, GRAIN = 260;    // in Figma's pixels: a cell, the edge's depth, how far the noise pushes it, its features' size
const hash = (x, y) => { const h = Math.sin(x * 37.1 + y * 61.7 + 12.4) * 3758.5453123; return h - Math.floor(h); };
const vnoise = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const fbm = (x, y) => vnoise(x, y) * .5 + vnoise(x * 2, y * 2) * .25 + vnoise(x * 4, y * 4) * .125;   // 0 … .875
// fbm over a W × H grid of cells, value for value as fbm(x * k + ox, y * k + oy), with each octave's
// lattice hashed once (a few hundred corners) instead of four times a cell, and each cell's own
// column weights and row weights worked out once per column and row
function fbmField(W, H, k, ox, oy) {
  const out = new Float32Array(W * H);
  for (const [s, amp] of [[1, .5], [2, .25], [4, .125]]) {
    const ix = new Int32Array(W), fx = new Float64Array(W), iy = new Int32Array(H), fy = new Float64Array(H);
    for (let x = 0; x < W; x++) { const v = (x * k + ox) * s; ix[x] = Math.floor(v); const f = v - ix[x]; fx[x] = f * f * (3 - 2 * f); }
    for (let y = 0; y < H; y++) { const v = (y * k + oy) * s; iy[y] = Math.floor(v); const f = v - iy[y]; fy[y] = f * f * (3 - 2 * f); }
    const x0 = ix[0], y0 = iy[0], nx = ix[W - 1] - x0 + 2, ny = iy[H - 1] - y0 + 2, lat = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) lat[j * nx + i] = hash(x0 + i, y0 + j);
    for (let y = 0; y < H; y++) {
      const r = (iy[y] - y0) * nx, gy = fy[y];
      for (let x = 0; x < W; x++) {
        const c0 = r + ix[x] - x0, a = lat[c0], b = lat[c0 + 1], c = lat[c0 + nx], d = lat[c0 + nx + 1], gx = fx[x];
        out[y * W + x] += amp * (a + (b - a) * gx + (c - a) * gy + (a - b - c + d) * gx * gy);
      }
    }
  }
  return out;
}
// Level up, spacers and all, comes in in its colours turned about (a magenta ground going on from By
// Lavi's) and is turned back as its middle is reached, along the front coming up it from its foot: a
// magenta layer over it in difference (index.html .level-flip), drawn where it is still turned
function flipper() {
  const canvas = $('.level-flip'), g = canvas.getContext('2d'), band = $('.level');
  const cells = document.createElement('canvas'), cg = cells.getContext('2d');
  let img = null, W = 0, H = 0, unit = 1, cell = 1, field = null, p = -1;
  // the cells' size and count for the band as it is laid out now
  const measure = () => {
    const dpr = devicePixelRatio || 1, px = $('main').clientWidth / 1728;
    const u = Math.max(1, Math.round(CELL * px * dpr)), c = u / dpr;    // a cell in device pixels, whole
    return [u, c, Math.ceil(band.clientWidth / c), Math.ceil(band.clientHeight / c)];
  };
  const fit = () => {
    [unit, cell, W, H] = measure();
    Object.assign(canvas.style, { width: `${W * cell}px`, height: `${H * cell}px` });
    canvas.width = W * unit; canvas.height = H * unit; cells.width = W; cells.height = H;
    img = cg.createImageData(W, H);
    const spread = SPREAD / CELL;
    field = fbmField(W, H, CELL / GRAIN, 3.1, 7.7);
    for (let i = 0; i < field.length; i++) field[i] = (field[i] - .44) * spread;
  };
  // q: how far the band is turned back, 0 (all turned about) to 1 (all its own colours). It is turned
  // back as the middle comes up from half way down the screen to its top (levelUp): the front starts
  // at the screen's foot then (half a screen and the spacer down the band) and is past the band's top
  // by the end
  const draw = q => {
    if (q === p && img) return;
    if (!img) fit();
    p = q;
    const L = 2, d = img.data, soft = SOFT / CELL, reach = SPREAD / CELL / 2;   // in rows
    const from = (innerHeight / 2 + parseFloat(getComputedStyle(band).paddingTop)) / cell + reach + soft;
    const mid = from - q * (from + reach + soft);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = Math.min(1, Math.max(0, (mid - (y + .5) + field[i]) / soft + .5));
      const th = tile.data[(y % tile.size) * tile.size + (x % tile.size)];
      const c = Math.min(1, Math.max(0, roundEven((v + (th - .5) / L) * L) / L)), o = i * 4;
      d[o] = 194 * c; d[o + 1] = 57 * c; d[o + 2] = 199 * c; d[o + 3] = c ? 255 : 0;
    }
    cg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(cells, 0, 0, W * unit, H * unit);
  };
  // (made again only when the cells change: the observer's first call, as it starts, changes nothing)
  new ResizeObserver(() => {
    if (img && measure().join() === [unit, cell, W, H].join()) return;
    img = null; if (p >= 0) { const q = p; p = -1; draw(q); }
  }).observe(band);
  draw.fit = fit;                                      // (the cells and their field made ahead, by levelUp)
  return draw;
}

// ----- 4. level up -----
// the stairs: every tag steps in to the tier above it, a quarter smaller each time, a new one comes in
// from the page's edge and the smallest goes out of sight at the inner end. The tiers are one series
// (each three quarters of the next), so the steps have no seam. The band comes in in its colours turned
// about (flipper) and is turned back as its middle, a screen tall, comes up the screen; pinned then,
// and each stretch of scrolling steps the stair up one tier and the clock on one of the course's eight
// levels, and only when all eight are done does the page go on to the price.
// The places, in Figma's pixels down the column (see index.html): the biggest tag's height H and the
// column's length Y; tier t (3 the biggest, 4 the one coming in) is scaled .75^(3 - t) and sits past
// the tiers bigger than it
// the course's eight levels, as the syllabus names them
const LEVELS = ['brief', 'grid', 'chữ', 'màu', 'claude', 'website', 'motion', 'critique'];
// masks of the page's dither, from none of a cell's pixels kept to all of them, a Bayer 4x4 tile each,
// in device pixels (a cell about 2 CSS pixels before the tag's own scale); made as Level up is set up
// (each a PNG made off the page's thread, toBlob, and used by its blob URL)
let MASKS;
const tileURL = c => new Promise(r => c.toBlob(b => r(`url(${URL.createObjectURL(b)})`)));
const masksOf = () => {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], dpr = devicePixelRatio || 1, cell = Math.max(1, Math.round(2 * dpr));
  return Promise.all(Array.from({ length: 17 }, async (_, k) => {
    const c = document.createElement('canvas'); c.width = c.height = 4 * cell;
    const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) if (m[i] < k) g.fillRect((i % 4) * cell, (i >> 2) * cell, cell, cell);
    return { url: await tileURL(c), size: `${4 * cell / dpr}px` };
  }));
};
// (pause as byRules takes it)
async function levelUp(pause) {
  MASKS = await masksOf();
  if (pause) await pause();
  const R = .75, H = 245.4733, Y = 670.2942;
  const tags = $$('.level-col').map(col => $$('.level-tag', col));
  // a tag's dither: the smallest is half dust at the stair's inner end and keeps it as it shrinks away
  // there, the one coming in at the page's edge comes out of it; set only when its level of the 17 changes
  const dust = (el, d) => {
    const k = Math.round(Math.min(1, Math.max(0, d)) * 16);
    if (el._dust === k) return;
    el._dust = k;
    const v = k === 16 ? 'none' : `${MASKS[k].url} 0 0 / ${MASKS[k].size} repeat`;
    el.style.mask = v; el.style.webkitMask = v;
  };
  const place = phase => {
    for (const col of tags) col.forEach((el, i) => {
      const t = i - phase, top = t => { const k = R ** (3 - t); return Y - H * (1 - k) / (1 - R) - H * k; };   // past the tiers bigger than it, then its own height
      // the smallest, stepping on past the inner end, shrinks away to nothing there instead, against
      // the tag stepping in to its place (and kept off the end, where the column would cut it)
      const k = t >= 0 ? R ** (3 - t) : R ** 3 * Math.max(0, 1 + t), y = t >= 0 ? top(t) : Math.max(top(0), top(t + 1) - H * k);
      el.style.setProperty('--y', y.toFixed(3)); el.style.setProperty('--k', k.toFixed(5));
      dust(el, Math.min((Math.max(t, 0) + .35) / .9, (4.15 - t) / .7));
    });
  };
  // the levels round the clock: the hand on the level reached, the arc behind it the way come, the
  // level named under "it's time"
  const hand = $('.level-hand'), arc = $('.level-arc'), marks = $$('.level-mark'), num = $('.level-num'), name = $('.level-name');
  let shown = -1;
  const show = i => {
    if (i === shown) return;
    shown = i;
    marks.forEach((m, j) => m.classList.toggle('on', j <= i));
    num.textContent = `lv.${String(i + 1).padStart(2, '0')}`; name.textContent = LEVELS[i];
    gsap.fromTo([num, name], { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: reduce ? 0 : .45, ease: 'power3.out', stagger: .05, overwrite: true });
  };
  // tiers: how far the stair has stepped, 0 to 8, a level a tier
  const set = tiers => {
    const steps = Math.floor(tiers);
    place(tiers - steps);
    show(Math.min(7, steps));
    // (the SVG's own attribute: a tween set up every frame reads the hand's matrix back each time)
    hand.setAttribute('transform', `rotate(${(Math.min(tiers, 7) * 45).toFixed(3)} 558.5 558.5)`);
    arc.setAttribute('stroke-dasharray', `${(tiers / 8).toFixed(4)} 1`);
  };
  const turn = flipper();
  if (reduce) { set(8); turn(1); return; }
  set(0);
  if (pause) await pause();
  turn.fit();
  if (pause) await pause();
  turn(0);
  if (pause) await pause();
  // turned back by the scroll, as its middle comes up from half way down the screen to fill it
  const STEP = .45, pad = () => parseFloat(getComputedStyle($('.level')).paddingTop);
  ScrollTrigger.create({
    trigger: '.level', start: () => `top+=${pad()} center`, end: () => `top+=${pad()} top`, invalidateOnRefresh: true,
    onUpdate: st => turn(st.progress), onRefresh: st => turn(st.progress),
  });
  if (pause) await pause();
  // pinned as its middle fills the screen: the eight levels, STEP screens of scrolling each; then it
  // lets go, the spacer under it coming up after
  ScrollTrigger.create({
    trigger: '.level', start: () => `top+=${pad()} top`, end: () => `+=${innerHeight * 8 * STEP}`, pin: true, invalidateOnRefresh: true,
    onUpdate: st => set(st.progress * 8),
  });
  if (pause) await pause();
  // "it's time" comes up between them as the band scrolls in
  gsap.fromTo('.level-mid', { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, ease: 'power2.out', scrollTrigger: { trigger: '.level', start: 'top 70%', end: 'center 55%', scrub: .6 } });
}

// ----- 4b. the weathervane -----
// once the fan's last print is the page's, its rooster turns twice round on its mast, as in a gust:
// about the upright axis, seen side on, so it narrows to the mast and comes back the other way round,
// and it swings a little either side of where it stops, as a vane does. SVG has no 3D, so the turn is
// drawn as what it looks like from in front: the width times the angle's cosine, about the mast
// (x 60.5 in assets/rooster.svg). It is put back, unseen, when the print goes back to being the fan's
// Where WebGL is there, the rooster is a solid metal vane instead (vane3d.js), turned in 3D, and the
// flat one only stands in for it while the print is the fan's. The solid one is built as the fan is
// first scrolled into (a third of the way down it, long before its last print), not as the page loads
const MAST = 60.5;
function vane() {
  const finale = $('#finale'), turn = { a: 0 };
  let solid = null, up = false;
  const build = () => import('./vane3d.js').then(m => m.mount(finale)).then(s => { solid = s; $('#vane').removeAttribute('transform'); if (up) { s.show(true); draw(); } }, () => {});
  ScrollTrigger.create({ trigger: '#fan', start: 'top+=30% top', once: true, onEnter: build });
  const draw = () => solid ? solid.angle(turn.a)
    : $('#vane').setAttribute('transform', `translate(${MAST} 0) scale(${Math.cos(turn.a * Math.PI / 180).toFixed(4)} 1) translate(${-MAST} 0)`);
  let tl;
  finale.addEventListener('finale', e => {
    up = e.detail;
    tl?.kill(); turn.a = 0; draw();
    solid?.show(e.detail);
    if (!e.detail) return;
    tl = gsap.timeline({ onUpdate: draw })
      .to(turn, { a: 720, duration: 2.4, ease: 'power3.inOut' })
      .to(turn, { a: 738, duration: .3, ease: 'sine.out' })
      .to(turn, { a: 720, duration: 1.1, ease: 'elastic.out(1, .35)' });
  });
}

// ----- 4c. the scroll text -----
// after the scroll-text demo (WebGLText + its post-process), done to the page's own text so it stays
// text, in its fonts, for readers and search:
//  - each block of type rises into place from below its own box when it comes into view, its top
//    showing first as the box clips it at its foot (the demo's uProgress: the mesh lowered by its
//    height times 1 - progress, and cut off below where its foot was), 1.8 s, easing out; and it is
//    let go again when it leaves, so it rises each time it comes back;
//  - as the page scrolls, every block bends with the scroll's speed, as the demo's wave: across the
//    screen it shifts sideways by sin(its height on screen * f + time) (f = 4 + speed), a transform,
//    composited; the type stays whole, in its colour, with nothing slipping out from under it. The
//    speed is Lenis's, eased by 0.15 a frame, as the demo's; at rest it all comes off
const REVEAL = ['.by-time', '.by-side > *', '.by-cam', '.by-syllabus li',
  '.price-first > *', '.price-fund > p', '.price-fund li', '.price-year', '.price-label', '.price-was', '.price-terms',
  '.foot-media figcaption', '.foot-note', '.foot-label', '.foot-links li', '.foot-mark', '.foot-made'];
const WARP = ['.hero-title', '.hero-bar', '.hero-intro > *', '.hero-refund', '.hero-promise li', '.by-head h2',
  '.price h2 .line', '.price-now', '.foot h2', '.level-time', '.by-label', ...REVEAL];   // the label doesn't rise, it only bends
function reveal() {
  const els = REVEAL.flatMap(sel => $$(sel));
  els.forEach(e => { e.classList.add('rv'); e.style.setProperty('--rv', 0); });
  for (const e of els) {
    const show = () => gsap.to(e, { '--rv': 1, duration: 1.8, ease: 'power4.out', overwrite: true });
    const hide = () => gsap.set(e, { '--rv': 0, overwrite: true });
    ScrollTrigger.create({ trigger: e, start: 'top bottom', end: 'bottom top', onEnter: show, onEnterBack: show, onLeave: hide, onLeaveBack: hide });
  }
}
function warp(lenis) {
  const els = [...new Set(WARP.flatMap(sel => $$(sel)))].filter(e => !e.matches('.by-photo, .by-cam'));
  let v = 0, on = false;
  const lit = els.map(() => false);
  gsap.ticker.add((time, dt) => {
    // Lenis eases the scroll over a second, so a wheel flick runs at only ~12px a frame at its peak:
    // full strength there, with a curve that lifts the slower part of the glide; eased as the demo's
    const raw = Math.min(1, Math.abs(lenis.velocity) / 12) ** .6 * Math.sign(lenis.velocity);
    v += (raw - v) * (1 - Math.pow(1 - .15, dt / 16.67));
    const live = Math.abs(v) > .02;
    if (live !== on && !live) { els.forEach((e, i) => { e.style.translate = ''; lit[i] = false; }); }
    on = live;
    if (!live) return;
    const H = innerHeight, amp = v * .012 * innerWidth, f = 4 + Math.abs(v);
    // the wave across the screen: read every block's place first, then move the ones on screen
    const ys = els.map(e => { const r = e.getBoundingClientRect(); return r.bottom < -40 || r.top > H + 40 ? null : (r.top + r.height / 2) / H; });
    els.forEach((e, i) => {
      const seen = ys[i] !== null;
      if (seen) e.style.translate = `${(amp * Math.sin(ys[i] * f + time)).toFixed(1)}px 0`;
      if (seen !== lit[i]) { lit[i] = seen; if (!seen) e.style.translate = ''; }
    });
  });
}

// ----- 5. the price -----
function price() {
  const was = $('.price-was'), now = $('.price-now');
  // the strike, drawn left to right over the old price
  const amount = document.createElement('span');
  amount.className = 'amount';
  amount.append(...[...was.childNodes].filter(n => !(n.classList?.contains('sr-only'))));
  const strike = document.createElement('span');
  strike.className = 'strike'; amount.append(strike);
  was.append(amount); was.classList.add('drawn');
  // the new price: its first digit rolls down from the old one's
  const label = now.querySelector('.sr-only');
  const value = [...now.childNodes].filter(n => n !== label).map(n => n.textContent).join('').trim();
  now.textContent = '';
  now.append(label, Object.assign(document.createElement('span'), { className: 'sr-only', textContent: value }));
  const shown = document.createElement('span');
  shown.setAttribute('aria-hidden', 'true');
  shown.innerHTML = `<span class="roll"><span class="roll-final">${value[0]}</span><span class="roll-win"><span class="roll-col"><span>5</span><span>6</span><span>7</span><span>8</span></span></span></span>${value.slice(1)}`;
  now.append(shown);
  const roll = $('.roll', now), col = $('.roll-col', now), final = $('.roll-final', now);
  // a digit's box is its line, taller than the digit: the window shows only the band of the price's
  // caps (the price is trimmed to them), so the next digit never shows under the baseline as it rolls
  const fit = () => {
    const f = final.getBoundingClientRect(), n = now.getBoundingClientRect();
    roll.style.setProperty('--cell', `${f.height}px`);
    roll.style.setProperty('--cap-top', `${n.top - f.top}px`); roll.style.setProperty('--cap-h', `${n.height}px`);
  };
  fit(); addEventListener('resize', fit);
  // (no longer drawn and rolled on the scroll: struck and at 5 from the start, so its shader is there at once)
  roll.classList.add('done'); risen(was); risen(now);
}

async function start() {
  gridKey();
  // the footer's clip stands still under reduced motion
  if (reduce) { root.classList.remove('intro'); root.classList.add('hero-lines'); $$('.hero-title > .line').forEach(l => { l.style.transform = ''; }); $('.foot-media video')?.pause(); await loader(); rules(); byRules(); pageRules(); strip(); camera(); settle(); return; }
  // (each part set up in a task of its own, so the page is never held up long while the loader shows)
  const pause = () => new Promise(r => setTimeout(r, 0));
  let entered = false;
  const enter = () => { if (!entered) { entered = true; intro(); } };
  await loader(async fan => {
    await pause();
    await warmGlyphs(pause); await pause();
    await byRules(pause); byRulesIn(); await pause();
    await pageRules(pause); await pause();
    strip(fan?.lenis);
    camera(); await pause();
    headings(); await pause();
    portrait(); await pause();
    await levelUp(pause); await pause();
    xray();
    // (the last frame's dithered weathervane is gone: the ice one, ice.js, is the page's rooster now)
    price(); await pause();
    // the fan's eased scroll drives the triggers, in the same frame as the scene
    fanLenis = fan?.lenis;
    fan?.lenis.on('scroll', ScrollTrigger.update);
    // the hero's rules, laid where its type will rest and hidden for the intro to draw (as intro would)
    heroRuled = rules(); gsap.set(heroRuled, { clipPath: SIDES(0) });
    await pause();
    ScrollTrigger.sort();                                // by where they sit: Level up's pin makes room for what comes after it
    ScrollTrigger.addEventListener('refresh', snapSoon);
    ScrollTrigger.addEventListener('scrollEnd', snapSoon);   // Level up's pin moves what follows it by a fraction while it holds
    ScrollTrigger.refresh();
  }, enter);
  enter();
}
start();
