// The show work fan once more, at the page's foot, set out another way: the same students' pages
// round a ring, seen from a little above, so the near ones come big and low across the screen and the
// far ones small and high behind them, fading into the black. Each page is a strip of the ring's own
// cylinder, bent with it, and a page seen from behind is the right way round (its back is drawn
// mirrored back). The ring turns slowly, faster as the page scrolls; under reduced motion it stands.
// Built (three) only as the footer comes near, drawn only while it is on the screen
import * as THREE from 'three';
import { gsap } from 'gsap';

const box = document.querySelector('.foot-ring');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// the fan's pages (fan.js WORKS), taken in turn so no two of one project sit side by side
const FILES = ['dizai-1', 'freshspawn-1', 'surfclub-1', 'simons-1', 'dizai-2', 'freshspawn-2', 'surfclub-2', 'simons-2', 'dizai-3', 'freshspawn-3', 'surfclub-3', 'simons-3'];
const N = 18, R = 5.5, H = 1.5, ASPECT = 1728 / 1117;   // pages round the ring, its radius, a page's height, its shape

// a strip of the ring's cylinder, a page wide (as an angle) and tall, with its picture: the outside
// as it is, the inside (seen when the page is behind) mirrored, so it reads the same way round
function page(tex, h, a0, r) {
  const w = h * ASPECT, da = w / r;
  const geo = new THREE.CylinderGeometry(r, r, h, 32, 1, true, a0 - da / 2, da);
  const back = tex.clone(); back.wrapS = THREE.RepeatWrapping; back.repeat.x = -1; back.offset.x = 1; back.needsUpdate = true;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide })));
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: back, side: THREE.BackSide })));
  return g;
}

async function build() {
  const canvas = box.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 9, 18);           // the far side of the ring fades into the page's black
  const camera = new THREE.PerspectiveCamera(26, 1, .1, 60);
  camera.position.set(0, 2.4, 12); camera.lookAt(0, -1.1, 0);
  const ring = new THREE.Group(); scene.add(ring);
  const loader = new THREE.TextureLoader();
  const base = `${import.meta.env.BASE_URL}assets/fan/`;
  const texs = await Promise.all(FILES.map(f => loader.loadAsync(`${base}${f}.webp`).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })));
  // the pages in two rows round the ring, taken in turn: a big one on the outer row, low, then a smaller
  // one on the inner row, set higher and a clear step further in, so where two meet the outer one always
  // lies over the inner one by about the same amount, all the way round. Each keeps a little size of its own
  const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const IN = .5, OVER = .2;                              // how far in the inner row sits; how much of a page lies under the next
  const pages = Array.from({ length: N }, (_, i) => {
    const out = i % 2 === 0, h = H * (out ? .92 + .16 * rnd(i, 1) : .62 + .12 * rnd(i, 1)), r = out ? R : R - IN;
    return { out, h, r, da: h * ASPECT / r, y: out ? -.22 + (rnd(i, 3) - .5) * .12 : .38 + (rnd(i, 3) - .5) * .16 };
  });
  // the gap from one page's middle to the next, each pair alike, scaled so the row closes round the ring
  const step = pages.map((p, i) => (p.da + pages[(i + 1) % N].da) / 2 * (1 - OVER));
  const fill = Math.PI * 2 / step.reduce((s, d) => s + d, 0);
  let a = 0;
  pages.forEach((p, i) => {
    const g = page(texs[i % texs.length], p.h, a, p.r + (p.out ? (i / 2) * .004 : 0));   // outer pages a hair apart, so none flicker
    g.position.y = p.y;
    ring.add(g);
    a += step[i] * fill;
  });
  const fit = () => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // the ring a little wider than a wide screen, its near pages running off a narrow one's sides
    camera.updateProjectionMatrix();
    draw();
  };
  const draw = () => renderer.render(scene, camera);
  new ResizeObserver(fit).observe(box);
  fit();
  if (reduce) return;
  let on = false, last = scrollY, turn = 0;
  new IntersectionObserver(([e]) => { on = e.isIntersecting; }, { rootMargin: '100px' }).observe(box);
  gsap.ticker.add((time, dt) => {
    if (!on) { last = scrollY; return; }
    const v = scrollY - last; last = scrollY;
    turn += dt / 1000 * .12 + v * .0009;                 // a slow turn, quicker as the page scrolls
    ring.rotation.y = -turn;
    draw();
  });
}

if (box) {
  const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near.disconnect(); build(); } }, { rootMargin: '600px' });
  near.observe(box);
}
