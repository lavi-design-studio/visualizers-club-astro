// The show work fan (show-work/, without its control panel), as the landing page's hero picture.
// It is drawn in the hero's picture box (#fanSlot) at first, and the box opens out to fill the screen
// over the hero's height as the page scrolls; the fan's own timeline runs over the whole section.
// The last print is the next section's magenta, so the page goes on in its colour.
import * as THREE from 'three';
import Lenis from 'lenis';
import { gsap } from 'gsap';

const fan = document.getElementById('fan'), stage = document.getElementById('fanStage'), finaleEl = document.getElementById('finale');
const heroEl = document.getElementById('hero'), slotEl = document.getElementById('fanSlot'), scrollEl = stage.querySelector('.hero-scroll');
const CW = 1.6, CH = CW * 1117 / 1728, GAP = .34;   // the pages' own shape, a 1728 × 1117 screen
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ----- the work: students' sites, four projects of three pages each -----
// Taken in turn, so no two pages of one project sit side by side. The last print is the next
// section's magenta, drawn on a canvas: it ends up filling the screen
const WORKS = [
  ['dizai-1', 'Dizai'], ['freshspawn-1', 'FreshSpawn'], ['surfclub-1', 'SurfClub'], ['simons-1', "Simon's"],
  ['dizai-2', 'Dizai'], ['freshspawn-2', 'FreshSpawn'], ['surfclub-2', 'SurfClub'], ['simons-2', "Simon's"],
  ['dizai-3', 'Dizai'], ['freshspawn-3', 'FreshSpawn'], ['surfclub-3', 'SurfClub'], ['simons-3', "Simon's"],
];
// every page is decoded before the fan is built, off the main thread, into a bitmap held rows top
// down (the shader reads it that way up), so handing it to the GPU is a copy and no frame waits on a
// decode; where createImageBitmap can't, an image decoded ahead
const pages = await Promise.all(WORKS.map(async ([file]) => {
  const url = `${import.meta.env.BASE_URL}assets/fan/${file}.webp`;   // public/assets
  try { return await createImageBitmap(await (await fetch(url)).blob()); } catch {}
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}));
// the last print is Figma's "You have enough love for design?" frame (2172:19), in its own 1728 × 1117
// pixels: drawn on a canvas for the fan, where it flies at us until it fills the screen, and the same
// drawing in the DOM (#finale), sharp, which takes over once it does. It covers the screen, so a
// screen of another shape sees only part of the frame: lastLayout sets it out for the part it sees,
// as Figma has it where all of it shows, smaller and centred where it would be cut (a phone)
const FONTS = {                                         // [family, style, weight, tracking]
  display: ['"PP Neue World", serif', 'normal', 200, 0],
  serif: ['"PP Migra", serif', 'italic', 200, 0],
  small: ['"ABC Areal", sans-serif', 'normal', 500, 0],   // Figma's -0.2px tracking, left out: canvas and SVG space it differently
  smallR: ['"ABC Areal", sans-serif', 'normal', 400, 0],  // the tablet's caption
};
const font = (f, size) => `${FONTS[f][1]} ${FONTS[f][2]} ${size}px ${FONTS[f][0]}`;
const FX = 2048, FY = Math.round(FX * CH / CW), DW = 1728, DH = 1117;
const rooster = (await fetch(`${import.meta.env.BASE_URL}assets/rooster.svg`).then(r => r.text())).match(/ d="([^"]+)"/)[1];
await Promise.all(['display', 'serif', 'small', 'smallR'].map(f => document.fonts.load(font(f, 160), 'YOU HAVE ENOUGH LOVE FOR DESIGN?() HÃY THIẾT KẾ NHƯ NHỮNG CON GÀ CHIẾN').catch(() => {})));
const ruler = document.createElement('canvas').getContext('2d');
const widthOf = (t, f, size) => { ruler.font = font(f, size); return ruler.measureText(t).width; };
const BIG = [['YOU HAVE', 'display'], ['ENOUGH LOVE', 'serif'], ['FOR DESIGN?', 'display']];
const SMALL = ['HÃY THIẾT KẾ', 'NHƯ NHỮNG CON GÀ CHIẾN'];
// Figma's frame, top to bottom from 240: three 160px lines (caps 112, 108 in Migra, 16 apart), 50.5
// down the brackets' row (the 135.957-high weathervane between them, 20 each side), 50.5 down the
// caption's two lines of 20 (caps 14.32, 22 apart), all centred. k scales all but the caption
// a tablet (600–899 wide) has its own setting, Figma's Tablet / Last print, in screen px: three 80px
// lines 8 apart, the brackets at 125 with the 81 × 115 weathervane 14 from each, the caption's two
// 14px lines, 10 between the groups, all centred on the screen. A phone has the same at 48 (s, the
// display size over the tablet's), its caption 13
function tabletLayout(w, h, d = 80, c = 14) {
  const s = d / 80, cap = .716 * c;                       // the caption's cap height
  const aspect = w / h, u = Math.min(DW, DH * aspect) / w;   // frame units per screen px
  const X = px => DW / 2 + (px - w / 2) * u, Y = py => DH / 2 + (py - h / 2) * u;
  const block = 345 * s + 2 * cap, T = h / 2 - block / 2, R = T + 192 * s, C = R + 143 * s, cx = w / 2;
  return {
    lines: [[BIG[0][0], 'display', d * u, X(cx), Y(T + 56 * s)], [BIG[1][0], 'serif', d * u, X(cx), Y(T + 118 * s)], [BIG[2][0], 'display', d * u, X(cx), Y(T + 182 * s)],
      ['(', 'display', 125 * s * u, X(cx - 74 * s), Y(R + 104 * s)], [')', 'display', 125 * s * u, X(cx + 74 * s), Y(R + 104 * s)],
      [SMALL[0], 'smallR', c * u, X(cx), Y(C + cap)], [SMALL[1], 'smallR', c * u, X(cx), Y(C + 2 * cap + 10 * s)]],
    vane: [X(cx - 40.5 * s), Y(R + 9 * s), 115 / 135.957 * s * u],
  };
}
function lastLayout(aspect) {
  const room = Math.min(DW, DH * aspect) - 64;        // the width of the frame the screen sees, less margins
  const k = Math.min(1, room / Math.max(...BIG.map(([t, f]) => widthOf(t, f, 160))));
  const cap = Math.min(1, room / widthOf(SMALL[1], 'small', 20)) * 20;
  const gap = 50.5 * Math.max(k, .6), block = 364 * k + gap + 135.957 * k + gap + 36 * cap / 20;
  const top = k === 1 ? 240 : DH / 2 - block / 2;       // Figma's own place, or centred in what is seen
  const row = top + 364 * k + gap, foot = row + 135.957 * k + gap, x = DW / 2;
  return {
    lines: [[BIG[0][0], 'display', 160 * k, x, top + 112 * k], [BIG[1][0], 'serif', 160 * k, x, top + 236 * k], [BIG[2][0], 'display', 160 * k, x, top + 364 * k],
      ['(', 'display', 160 * k, x - 92.81 * k, row + 123.98 * k], [')', 'display', 160 * k, x + 92.81 * k, row + 123.98 * k],
      [SMALL[0], 'small', cap, x, foot + 14.32 * cap / 20], [SMALL[1], 'small', cap, x, foot + 36.32 * cap / 20]],
    // the weathervane (assets/rooster.svg, 95.7 × 135.957), its arrow pointing right as Figma draws
    // it; motion.js turns it round on its mast once the print is the page's
    vane: [x - 47.85 * k, row, k],
  };
}
let last = null, lastAspect = 0, lastCanvas = null;
function finale(g, L) {
  g.setTransform(FX / DW, 0, 0, FY / DH, 0, 0);
  g.fillStyle = '#c239c7'; g.fillRect(0, 0, DW, DH);
  g.fillStyle = '#000'; g.textAlign = 'center';
  for (const [t, f, size, x, y] of L.lines) { g.font = font(f, size); g.fillText(t, x, y); }
  g.translate(L.vane[0], L.vane[1]); g.scale(L.vane[2], L.vane[2]); g.fill(new Path2D(rooster), 'evenodd');
}
// set the last print out for the screen's shape, on the canvas and in the DOM; again only when the
// shape changes enough to move it
function layLast(w, h, force) {
  const aspect = w / h, narrow = w < 900, key = narrow ? `${w}x${h}` : aspect;
  if (!force && (narrow ? key === lastAspect : typeof lastAspect === 'number' && Math.abs(aspect - lastAspect) < .01)) return;
  lastAspect = key; last = !narrow ? lastLayout(aspect) : w >= 600 ? tabletLayout(w, h) : tabletLayout(w, h, 48, 13);
  if (lastCanvas) { finale(lastCanvas.getContext('2d'), last); hero && (hero.material.uniforms.uMap.value.needsUpdate = true); }
  document.getElementById('finale').innerHTML = `<rect width="${DW}" height="${DH}" fill="#c239c7"/>` +
    last.lines.map(([t, f, size, x, y]) => `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-family='${FONTS[f][0]}' font-style="${FONTS[f][1]}" font-weight="${FONTS[f][2]}" font-size="${size.toFixed(2)}" letter-spacing="${FONTS[f][3]}">${t}</text>`).join('') +
    `<g transform="translate(${last.vane[0].toFixed(2)} ${last.vane[1].toFixed(2)}) scale(${last.vane[2].toFixed(4)})"><path id="vane" d="${rooster}" fill-rule="evenodd"/></g>`;
}

// ----- settings, as tuned on the page (2026-10-31) -----
const params = {
  tiltX: -43, tiltY: -65, tiltZ: -28, distance: .92, core: .05, wobble: true, mouse: true,
  bend: 1, softness: 1,
  dwell: 0,                                        // no settling on each print: the fan turns in one sweep
  pluckCurl: 1.17, flutter: .4, inertia: .5, lean: -68, gatherTilt: .29,
  smoothScroll: 1,
  openZoom: 1.5, openX: .513, openY: .647,        // the hero picture's crop, in the box's own terms
};

// ----- scene -----
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000);
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, .1, 200);


// A print is a sheet hinged on a thin core round the fan's axis (uR0 out from it, so no two sheets
// meet at the axis). It bends like paper: the sheet follows an arc whose curvature is uBend radians
// across its width, a little more at one corner. Every sheet in the fan bends by the same amount,
// so neighbours stay apart: each is the last one turned round the axis, and an arc that turns less
// than a right angle never crosses its own turned copy.
const BEND_MAX = 1.1;
const geo = new THREE.PlaneGeometry(CW, CH, 32, 6);
geo.translate(CW / 2, 0, 0);
const vertexShader = /* glsl */`
  uniform float uBend, uW, uR0, uMid;
  varying vec2 vUv; varying vec3 vN, vV;
  void main() {
    vUv = uv;
    float s0 = uMid * 0.5 * uW;                        // where the arc starts: the hinge, or (in flight) the middle
    float s = position.x - s0;
    float k = uBend * (1.0 + 0.4 * (uv.y - 0.5)) / uW;
    vec3 p = vec3(position.x, position.y, 0.0), n = vec3(0.0, 0.0, 1.0);
    if (abs(k) > 1e-4) {
      float a = k * s;
      p = vec3(sin(a) / k + s0, position.y, (1.0 - cos(a)) / k);
      n = vec3(-sin(a), 0.0, cos(a));
    }
    p.x += uR0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalMatrix * n; vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;
const fragmentShader = /* glsl */`
  uniform sampler2D uMap; uniform float uFlat;
  varying vec2 vUv; varying vec3 vN, vV;
  void main() {
    vec4 c = texture2D(uMap, vec2(vUv.x, 1.0 - vUv.y));   // the pictures are held rows top down (flipY off)
    // a print seen from behind is the back of the sheet: its picture only shows through, faded (most
    // of its colour gone and much darker), so the fan reads the right way round
    if (!gl_FrontFacing) c.rgb = mix(vec3(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722))), c.rgb, 0.35) * 0.4;
    vec3 n = normalize(vN), v = normalize(vV);
    if (dot(n, v) < 0.0) n = -n;                       // light the side we see
    float f = dot(n, v);                               // sheets seen edge-on go darker
    float l = max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0);
    float shade = 0.3 + 0.45 * f + 0.3 * l;            // the bend catches the light
    gl_FragColor = vec4(c.rgb * mix(shade, 1.0, uFlat), 1.0);
    #include <colorspace_fragment>
  }`;

const N = WORKS.length + 1, SLOT = Math.PI * 2 / N;
let cards = [], hero = null;
function build() {
  document.getElementById('fanList').innerHTML = WORKS.map(([, name]) => `<li>${name}</li>`).join('') + '<li>You have enough love for design? Hãy thiết kế như những con gà chiến</li>';
  cards = Array.from({ length: N }, (_, k) => {
    let t;
    if (k < WORKS.length) t = new THREE.Texture(pages[k]);
    else { lastCanvas = document.createElement('canvas'); lastCanvas.width = FX; lastCanvas.height = FY; layLast(stage.clientWidth, stage.clientHeight, true); t = new THREE.Texture(lastCanvas); }
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.flipY = false; t.needsUpdate = true;
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: t }, uFlat: { value: 0 }, uBend: { value: 0 }, uW: { value: CW }, uR0: { value: params.core }, uMid: { value: 0 } },
      vertexShader, fragmentShader, side: THREE.DoubleSide,
    }));
    scene.add(m);
    return m;
  });
  hero = cards[N - 1];
}
build();
// each print handed to the GPU in a task of its own, then the shader made (off the main thread where
// the browser can), all before the first frame is drawn, so no frame waits on them
for (const m of cards) { renderer.initTexture(m.material.uniforms.uMap.value); await new Promise(r => setTimeout(r, 0)); }
await renderer.compileAsync(scene, camera);

// ----- the timeline, all on scroll -----
//   0   → .38  the row runs in towards the hub like a conveyor; each print, as it reaches the hub,
//              turns the corner and is carried round, so the row winds itself into the fan (the axis
//              stands upright meanwhile, the row facing us; from .24 it tilts into its lean)
//   .38 → .72  the spin the row left it with whirls the fan on a few prints, springing past and
//              back, then it turns on print by print until the last one is in front again
//   .7  → 1    as the last one comes to the front the fan parts round it, still turning, and it
//              flies straight at us like a sheet of paper, growing until it fills the screen
//
// No two prints ever pass through each other, by construction. Until the pluck every print lies in
// a half-plane through the fan's axis, at least R0 out from it:
//   · prints still in the row share one half-plane, the entry, and keep their gaps along it;
//   · every other print has a half-plane of its own (its angle grows steadily with how far it has
//     wound in), and two different half-planes through an axis meet only on the axis;
//   · they bend only once all are wound in, and then all alike: an arc that turns less than a right
//     angle never crosses its own copy turned round the axis.
// For the pluck the others, flat by then, close up round the back (still each in a half-plane of its
// own), so the last one has an empty wedge ahead of it to fly out through; the overlap check
// replays it all to be sure.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);          // smootherstep: still at both ends
const phase = (p, a, b) => clamp((p - a) / (b - a));
const D2R = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const fanQ = new THREE.Quaternion(), baseQ = new THREE.Quaternion(), qB = new THREE.Quaternion(), ry = new THREE.Quaternion();
const q = new THREE.Quaternion(), eul = new THREE.Euler();
const posB = new THREE.Vector3(0, -.1, 0);
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), xAxis = new THREE.Vector3();
const out = new THREE.Vector3(), slot = new THREE.Vector3(), c = new THREE.Vector3(), c2 = new THREE.Vector3();
const qr = new THREE.Quaternion(), qH = new THREE.Quaternion(), qI = new THREE.Quaternion(), eulR = new THREE.Euler(), nH = new THREE.Vector3();
const b0 = new THREE.Vector3(), b1 = new THREE.Vector3(), b2 = new THREE.Vector3();
const SPIN_T = .25;                                  // how soon the air takes the plucked print's own turn
const FLY_D = 2;                                     // the full-screen sheet stands this far in front of the camera
const STEP = CW + GAP;                               // spacing along the row
const reach = () => params.core + CW / 2;           // axis to the centre of a print against the core

// winding: a print d past the hub has turned ramp(d)·SLOT/STEP round the axis and sits ramp(−d) out
// from the core; ramp eases the corner, is zero until −W and the identity after +W
const W = .35;
const ramp = x => x >= W ? x : x <= -W ? 0 : (x + W) * (x + W) / (4 * W);
const C0 = -.4;                                      // where the row's head starts, just short of the hub
// the row runs in faster and faster and does not stop once it is all wound in: it leaves the fan
// spinning at the speed it came in at (CONV_END of its mean), and the spin takes over from there
const CONV_END = .9, GATHER = .38;
const conveyLen = () => (N - 1) * STEP + W - C0;
const conveyorAt = p => { const t = phase(p, 0, GATHER); return C0 + conveyLen() * t * t * (3 - CONV_END + (CONV_END - 2) * t); };
// eases in and out but runs a little past the end before it settles: things land with a bounce
const backOut = (x, o = 1.2) => { const y = smooth(x) - 1; return 1 + (o + 1) * y * y * y + o * y * y; };
// while winding the fan is part way into its tilt (gatherTilt), and none of the lean; then all of
// both, tipping a little too far and back as it lands
const leanIn = p => backOut(phase(p, .24, .44));
const tiltIn = p => params.gatherTilt + (1 - params.gatherTilt) * leanIn(p);
// the hub starts left of centre so the row runs across the frame, then moves to the middle (and a
// touch past it)
const hubAt = (p, v) => v.set(-2.2 * (1 - backOut(phase(p, .16, .42), .8)), -.1, 0);
// the angle round the axis that faces the camera, for the fan's tilt at p: a print's face is Ry(θ)·z,
// so turn the direction to the camera into the fan's frame and read its angle
function frontAt(p, camZ) {
  const b = tiltIn(p);
  hubAt(p, posB);
  baseQ.setFromEuler(eul.set(params.tiltX * b * D2R, params.tiltY * b * D2R, params.tiltZ * b * D2R));
  tmp.set(-posB.x, -posB.y, camZ).normalize().applyQuaternion(baseQ.invert());
  return Math.atan2(tmp.x, tmp.z) + params.lean * leanIn(p) * D2R;
}
// n prints, one by one; with dwell the fan settles on each before moving on, less so over the last
// few, so it comes to the last one in a sweep, not a stop (the dwell fades with x itself, so the
// speed is still smooth where one print hands over to the next)
const walk = (t, n, dwell) => {
  const x = t * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  return i + f + (smooth(f) - f) * dwell * (1 - smooth(phase(x, n - 4, n - .5)));
};
// how many prints the fan has turned by p, in three movements that hand their speed on:
//   · the whirl: the spin the row left it with carries it on a few prints (WHIRL), springing past
//     the last of them and back like a top finding its feet, settled by GATHER + SETTLE;
//   · the walk: print by print round the rest of the turn, coming to the last print at .72 still
//     turning, at END of its mean speed;
//   · the run: on at that speed through the pluck, the fan never stopping while it is on screen
const END = .8, SETTLE = .15, WALK0 = .4;          // the walk starts as the whirl tires, so the fan never stands
const springZ = .45, springW = 2 * Math.PI / .14, springWd = springW * Math.sqrt(1 - springZ * springZ);
const whirlV0 = () => conveyLen() * CONV_END / GATHER / STEP;   // prints per unit of p: how fast the row ran in at the end
// as far as that speed carries a spring of this stiffness on its own, to the nearest print
const whirlCards = () => Math.max(1, Math.round(whirlV0() / (springZ * springW)));
function whirl(p) {
  if (p <= GATHER) return 0;
  const m = whirlCards(), tau = p - GATHER;
  if (tau >= SETTLE) return m;
  const A = -m, B = (whirlV0() + springZ * springW * A) / springWd;
  const rest = Math.exp(-springZ * springW * tau) * (A * Math.cos(springWd * tau) + B * Math.sin(springWd * tau));
  return m + rest * (1 - smooth(phase(tau, .6 * SETTLE, SETTLE)));   // what little is left fades out
}
// the pluck starts just before the last print reaches the front, the fan still turning
const PLUCK = .7;
// how far the fan parts round the last print: on the side it flies to, wider than its way to the
// screen turns from its plane (about 35° at the default tilt and lean) by a margin for how far it
// falls behind its place while the fan turns on (flying straight it lags even at its own speed, and
// more the further its momentum is from the fan's), and on the other side room for its bent edges.
// It stays that wide, so the fan turns as one while it is parted
const partMargin = () => (90 + 45 * Math.abs(1 - params.inertia)) * D2R;
const PART_BACK = 50 * D2R, BEND_PARTED = .6, PART_CLOSE = [.3, .55], PLUCK_TUG = 1;
// the pluck's pace: a quick tug that slows as it comes to the screen (still at both ends)
const tug = x => 1 - (1 - x) ** 3 * (1 + 3 * x);
function turnCards(p) {
  const n = N - whirlCards();
  if (p <= .72) { const t = phase(p, WALK0, .72); return whirl(p) + walk(t * t * (3 - END + (END - 2) * t), n, params.dwell); }
  return N + n * END / (.72 - WALK0) * (p - .72);   // on at the speed it reached the last one
}
// the angle the first print has turned to, row and all: what the paper feels as the fan's spin
const spinAt = (p, camZ) => entryAt(p, camZ) + ramp(conveyorAt(p)) * SLOT / STEP;
// the entry half-plane's angle: chosen so the last print, once wound in (W past the hub), faces us at .72
const entryAt = (p, camZ) => frontAt(p, camZ) - W * SLOT / STEP + turnCards(p) * SLOT;

// put a print by its centre (the mesh's origin is on the hinge side)
function place(m, centre, quat, sc) {
  m.quaternion.copy(quat); m.scale.setScalar(sc);
  xAxis.set(1, 0, 0).applyQuaternion(quat);
  m.position.copy(centre).addScaledVector(xAxis, -reach() * sc);
}

// pose every print for progress p (clock, mouse and the fan's bend passed in so a test can replay it)
function pose(p, clock, mx, my, bend) {
  const gather = phase(p, 0, GATHER), u = phase(p, PLUCK, 1);
  // the fan stays alive through the pluck: wobble, mouse and its paper bend settle only once the
  // last print is well on its way, so the camera is still before the print covers the view
  const calm = 1 - smooth(phase(u, .4, .85));

  camera.position.set(mx * .45 * calm, -my * .28 * calm, dist - smooth(gather) * .8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const wob = params.wobble ? calm : 0, b = tiltIn(p);
  hubAt(p, posB);
  eul.set((params.tiltX * b + (Math.sin(clock * .3) * 3 * wob - my * 7) * calm) * D2R,
          (params.tiltY * b + mx * 9 * calm) * D2R,
          (params.tiltZ * b + Math.cos(clock * .23) * 3 * wob) * D2R);
  fanQ.setFromEuler(eul);
  const entry = entryAt(p, dist - .8), conveyor = conveyorAt(p);
  let sheetBend = bend * smooth(phase(p, GATHER - .02, GATHER + .03)) * calm;   // the fan bends once it is (all but) whole
  const heroAngle = entry + ramp(conveyor - (N - 1) * STEP) * SLOT / STEP;
  // where the last print sits (once let go: where it was let go) and where it flies to, a sheet in
  // front of the camera covering the view. The way is judged from there, not from the place it left
  // in the fan, which turns on: judged from that, it would swing round with the fan and the wedge
  // with it, holding the prints at its edge still while the rest turn
  const camZ = dist - .8, last = conveyorAt(PLUCK) - (N - 1) * STEP;
  const th0 = u > 0 ? entryAt(PLUCK, camZ) + ramp(last) * SLOT / STEP : heroAngle;
  ry.setFromAxisAngle(Y, th0);
  qH.copy(fanQ).multiply(ry);
  out.set(1, 0, 0).applyQuaternion(qH);
  slot.copy(posB).addScaledVector(out, reach() + ramp(-(conveyor - (N - 1) * STEP)));
  fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  c2.copy(camera.position).addScaledVector(fwd, FLY_D);
  // the fan parts for the last print: as it comes to the front the others close up round the far
  // side (in order, so still each in a half-plane of its own), leaving it a clear wedge on the side
  // it flies to, wider than the turn of its way from its own plane, and a smaller one on the other
  // for its bent edges; once it has flown clear they spread out again
  tmp.subVectors(c2, slot);
  const way = Math.atan2(tmp.dot(nH.set(0, 0, 1).applyQuaternion(qH)), tmp.dot(out));
  // it opens just before the pluck and closes as soon as the print is out of the fan's reach, so the
  // fan turns as one again for most of the flight
  const part = smooth(phase(p, PLUCK - .06, PLUCK)) * (1 - smooth(phase(u, PART_CLOSE[0], PART_CLOSE[1])));
  const room = 2 * Math.PI - (N - 1) * 2 * D2R;     // the others keep at least 2° apart
  let ahead = Math.abs(way) + partMargin(), behind = PART_BACK;
  if (ahead + behind > room) ahead = room - behind;
  // ahead is the side the way turns to: the far end of the order (in front of it) when it turns to
  // its face, the near end (behind it) when to its back
  const front = way >= 0 ? ahead : behind, back = way >= 0 ? behind : ahead;
  const gapBack = SLOT + (Math.max(SLOT, back) - SLOT) * part;
  const gapFront = SLOT + (Math.max(SLOT, front) - SLOT) * part;
  // while it is parted the others bend less, so their bent edges stay out of the last print's wedge
  const bendLim = BEND_MAX - (BEND_MAX - BEND_PARTED) * part;
  sheetBend = clamp(sheetBend, -bendLim, bendLim);

  cards.forEach((m, i) => {
    const d = conveyor - i * STEP;                    // how far this print has run past the hub
    let angle = entry + ramp(d) * SLOT / STEP;
    if (part > 0 && i < N - 1) {                       // all wound in by now: (N−1−i) slots behind the last
      const f = (angle - heroAngle - SLOT) / (2 * Math.PI - 2 * SLOT);
      angle = heroAngle + gapBack + f * (2 * Math.PI - gapBack - gapFront);
    }
    ry.setFromAxisAngle(Y, angle);
    qB.copy(fanQ).multiply(ry);
    out.set(1, 0, 0).applyQuaternion(qB);
    c.copy(posB).addScaledVector(out, params.core + ramp(-d) + CW / 2);
    place(m, c, qB, 1);
    m.material.uniforms.uBend.value = sheetBend;
    m.material.uniforms.uFlat.value = 0;
  });

  // the pluck: let go of, the print flies on as it was moving, round with the fan, out through the
  // wedge the fan has opened; the air slows it and turns it to face us, and it comes in to cover the
  // view. It is a sheet of paper on the air: bent from its middle, its two edges pressed back by the
  // air it meets (more while it is fast), rocking a little, and all of it dying away as it settles
  hero.material.uniforms.uMid.value = u > 0 ? 1 : 0;
  if (u > 0) {
    const visH = 2 * FLY_D * tanH, s = Math.max(visH * camera.aspect / CW, visH / CH) * 1.002;
    // how fast it was going round as it was let go (radians per unit of p)
    const eps = 1e-3;
    const omega = (entryAt(PLUCK + eps, camZ) - entryAt(PLUCK - eps, camZ)) / (2 * eps);
    const r = reach() + ramp(-last), span = 1 - PLUCK, push = omega * span * params.inertia;
    ry.setFromAxisAngle(Y, th0);
    qI.copy(fanQ).multiply(ry);
    out.set(1, 0, 0).applyQuaternion(qI);
    b0.copy(posB).addScaledVector(out, r);
    // a curve that leaves along the way round at the speed it had (its first handle) and comes in
    // to the screen from behind it (its last); paced so it leaves at that speed and arrives at rest
    // (plus the tug of the pluck itself, towards the screen through the open wedge, so it is out of
    // the fan before the turning fan can catch it up)
    b1.copy(b0).addScaledVector(nH.set(0, 0, -1).applyQuaternion(qI), push * r / 3)
      .addScaledVector(tmp.subVectors(c2, b0).normalize(), PLUCK_TUG);
    b2.copy(c2).addScaledVector(fwd, 1.5);
    const sB = u + u * u - u * u * u, a = 1 - sB;
    c.copy(b0).multiplyScalar(a * a * a).addScaledVector(b1, 3 * a * a * sB).addScaledVector(b2, 3 * a * sB * sB).addScaledVector(c2, sB * sB * sB);
    // it keeps turning as it was, slowed by the air, while it comes round to face us
    ry.setFromAxisAngle(Y, th0 + push * SPIN_T * (1 - Math.exp(-u / SPIN_T)));
    qI.copy(fanQ).multiply(ry);
    q.slerpQuaternions(qI, camera.quaternion, tug(phase(u, 0, .75)));
    const rock = Math.sin(Math.PI * phase(u, .1, .8)) * params.flutter;
    qr.setFromEuler(eulR.set(rock * .5 * Math.sin(2 * Math.PI * 1.2 * u), rock * .7 * Math.sin(2 * Math.PI * .8 * u + .5), 0));
    q.multiply(qr);
    const sc = Math.pow(s, smooth(phase(u, .3, 1)));  // grows evenly to the eye: scale in log space
    const curl = params.pluckCurl * Math.sin(Math.PI * phase(u, .06, .86)) * (1 + .2 * Math.sin(2 * Math.PI * 1.5 * u));
    place(hero, c, q, sc);
    hero.material.uniforms.uBend.value = -curl;       // edges back, away from us: the way it flies
    hero.material.uniforms.uFlat.value = smooth(phase(u, .55, 1));
  }
  for (const m of cards) m.updateMatrixWorld();
  return { gather, u };
}

let bend = 0, bendV = 0, cur = 0, clock = 0, dist = 10, tanH = 1, lastSpin = null, active = false;

// ----- one scroll for the page and the scene -----
// Lenis eases the page's own scroll and the scene reads that same eased position in the same frame,
// so the sticky stage, the sections round it and the prints move as one: when the stage lets go,
// the last print is already full screen, and the DOM copy of it scrolls on with the page
const lerpFor = T => Math.min(1, 1 / (30 * Math.max(.02, T)));   // ~ the time the scroll takes to settle
const lenis = new Lenis({ lerp: lerpFor(params.smoothScroll), smoothWheel: !reduce });
if (document.documentElement.classList.contains('loading')) lenis.stop();   // the loader starts it again as it goes
const HOLD = .08;                                      // the last print rests full screen for this share of the section
// the section's layout, read once here and not in the frame loop: the hero's picture box (in the
// section's own terms), the stage's size and how far the section runs. Each frame works out where they
// are on screen from the scroll alone, so a frame never makes the page lay itself out again
let fanTop = 0, fanH = 1, fanRun = 1, openRun = 1, stageW = 1, stageH = 1;
const slotBox = { x: 0, y: 0, w: 1, h: 1 }, labelAt = { x: 0, y: 0 };
const measure = () => {
  fan.style.setProperty('--hero-h', `${heroEl.offsetHeight}px`);
  const f = fan.getBoundingClientRect(), r = slotEl.getBoundingClientRect();
  fanTop = f.top + scrollY; fanH = f.height;
  stageW = stage.clientWidth; stageH = stage.clientHeight;
  slotBox.x = r.left - f.left; slotBox.y = r.top - f.top; slotBox.w = r.width; slotBox.h = r.height;
  labelAt.x = scrollEl.offsetLeft; labelAt.y = scrollEl.offsetTop;
  fanRun = Math.max(1, (fanH - stageH) * (1 - HOLD));
  openRun = Math.max(1, heroEl.offsetHeight * .8);    // the box fills the screen as the hero leaves it
};
const progressAt = y => clamp((y - fanTop) / fanRun);
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
fan.addEventListener('pointermove', e => {
  mouse.tx = e.clientX / stageW * 2 - 1; mouse.ty = (e.clientY - stageTopAt(lenis.animatedScroll)) / stageH * 2 - 1;
});

// links within the page go by the same eased scroll; the hero's "scroll" goes as far as the fan
// takes to open out from the hero's picture to the whole screen
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (a?.classList.contains('hero-scroll')) {
    e.preventDefault();
    lenis.scrollTo(fanTop + openRun, { immediate: reduce, duration: 1.8 });
    return;
  }
  const to = a && document.querySelector(a.getAttribute('href'));
  if (!to) return;
  e.preventDefault();
  lenis.scrollTo(to, { immediate: reduce });
});

// resolution: as sharp as the screen, up to 2x, but never more pixels than MAX_PX (a 4K screen at 2x
// would be four times a laptop's); and lowered if the frames keep coming late (see pace below)
const MAX_PX = 8.3e6;
let dprCap = 2;
const pixelRatio = () => Math.min(devicePixelRatio, dprCap, Math.sqrt(MAX_PX / (stageW * stageH)));
const resize = () => {
  measure();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(stageW, stageH, false);
  tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  layLast(stageW, stageH);
};
addEventListener('resize', resize);
new ResizeObserver(measure).observe(heroEl);
new ResizeObserver(measure).observe(scrollEl);           // its width waits on its font
resize(); cur = progressAt(lenis.animatedScroll);

// the box the scene is framed in: the hero's picture, opening out to the whole stage. The scene is
// framed for the box but drawn over the whole stage, so the prints run on past the picture's edges
const box = { x: 0, y: 0, w: 1, h: 1 };
// the stage is sticky: it scrolls in with the section, holds at the top, and leaves with its end
const stageTopAt = y => Math.min(Math.max(fanTop - y, 0), fanTop + fanH - stageH - y);
function frameBox(y) {
  const into = clamp(y - fanTop, 0, fanH - stageH);   // how far the stage has been held: the hero has moved up by this much over it
  const t = smooth(clamp((y - fanTop) / openRun)), mix = (a, b) => a + (b - a) * t;
  box.x = mix(slotBox.x, 0); box.y = mix(slotBox.y - into, 0);
  box.w = Math.max(1, mix(slotBox.w, stageW)); box.h = Math.max(1, mix(slotBox.h, stageH));
  // the camera stands where the whole fan fits this box, as it does the prototype's screen; while the
  // box is the hero's picture it looks closer, at the part of the row the design's picture shows
  camera.aspect = box.w / box.h;
  dist = Math.max(2.3 / tanH, 2.3 / (tanH * camera.aspect)) * params.distance;
  // the box's crop of the camera's picture, then that crop widened to the stage round the box
  const z = mix(params.openZoom, 1), vw = box.w / z, vh = box.h / z;
  const ox = mix(params.openX, .5) * box.w - vw / 2, oy = mix(params.openY, .5) * box.h - vh / 2;
  camera.setViewOffset(box.w, box.h, ox - box.x / z, oy - box.y / z, stageW / z, stageH / z);
  camera.updateProjectionMatrix();
}

// pace: the frames' interval, smoothed. If it stays over a third more than the screen's refresh (the
// shortest interval seen) and slower than 50 a second, for a second, the GPU is behind, so the scene
// is drawn at a lower resolution, a fifth fewer pixels a step, down to 1x. A fast screen missing the
// odd refresh is not behind; and it does not climb back, so it never goes back and forth
const pace = { best: Infinity, avg: 0, late: 0, n: 0 };
function keepPace(ms) {
  if (++pace.n < 20) { pace.avg = ms; return; }        // the first frames after the stage comes in are uneven
  pace.best = Math.min(pace.best, ms);
  pace.avg += (ms - pace.avg) * .1;
  pace.late = pace.avg > Math.max(pace.best * 1.35, 20) ? pace.late + 1 : 0;
  if (pace.late < 60 || renderer.getPixelRatio() <= 1) return;
  dprCap = Math.max(1, renderer.getPixelRatio() * .9);  // .9² ≈ a fifth fewer pixels
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(stageW, stageH, false);
  pace.late = 0; pace.n = 0;
}

// the last print over "scroll": once it is plucked, its outline on screen is cut out of the label, so
// the label is under it and over the rest. The outline is the print's edge, bent as the vertex shader
// bends it, through its matrix and the camera, in the stage's pixels and then the label's
const EDGE = [];
for (let i = 0; i <= 8; i++) EDGE.push([i / 8, 1]);
for (let i = 1; i <= 4; i++) EDGE.push([1, 1 - i / 4]);
for (let i = 1; i <= 8; i++) EDGE.push([1 - i / 8, 0]);
for (let i = 1; i < 4; i++) EDGE.push([0, i / 4]);
const ePt = new THREE.Vector3();
let cut = false;
function overLabel(on) {
  if (!on) { if (cut) { scrollEl.style.clipPath = ''; cut = false; } return; }
  const U = hero.material.uniforms, mid = U.uMid.value * .5 * CW;
  const pts = EDGE.map(([fu, fv]) => {
    const x = fu * CW, s = x - mid, k = U.uBend.value * (1 + .4 * (fv - .5)) / CW, y = (fv - .5) * CH;
    if (Math.abs(k) > 1e-4) ePt.set(Math.sin(k * s) / k + mid, y, (1 - Math.cos(k * s)) / k); else ePt.set(x, y, 0);
    ePt.x += U.uR0.value;
    ePt.applyMatrix4(hero.matrixWorld).project(camera);
    return `${((ePt.x + 1) / 2 * stageW - labelAt.x).toFixed(1)}px ${((1 - ePt.y) / 2 * stageH - labelAt.y).toFixed(1)}px`;
  });
  // the label's box with the print's outline taken out of it (even-odd: the outline is a hole)
  scrollEl.style.clipPath = `polygon(evenodd, -9999px -9999px, 9999px -9999px, 9999px 9999px, -9999px 9999px, -9999px -9999px, ${pts.join(', ')}, ${pts[0]}, -9999px -9999px)`;
  cut = true;
}

// one frame loop for the page and the scene, on GSAP's ticker, so the page's own motion (motion.js)
// runs in the same frame: Lenis moves the page (and tells ScrollTrigger), then the scene draws where it is
let lastFinale = -1;
const tick = (time, deltaMs) => {
  const dt = Math.min(1 / 30, deltaMs / 1000);
  lenis.raf(time * 1000);
  if (!active) return;
  keepPace(deltaMs);
  cur = progressAt(lenis.animatedScroll);
  frameBox(lenis.animatedScroll);
  if (!reduce) clock += dt;
  const mk = 1 - Math.exp(-dt * 3);
  mouse.x += ((params.mouse ? mouse.tx : 0) - mouse.x) * mk; mouse.y += ((params.mouse ? mouse.ty : 0) - mouse.y) * mk;

  // paper: one damped spring for the whole fan, pulled by how fast it turns, sub-stepped so a slow frame can't kick it
  const spin = spinAt(cur, dist - .8);
  const spinVel = lastSpin === null ? 0 : (spin - lastSpin) / dt; lastSpin = spin;
  const pull = clamp(spinVel * .3 * params.bend, -BEND_MAX, BEND_MAX), K = 70 / params.softness, damp = 8 / Math.sqrt(params.softness);
  for (let i = 0; i < 4; i++) { const h = dt / 4; bendV += (pull - bend) * K * h; bendV *= Math.exp(-h * damp); bend += bendV * h; }
  bend = clamp(bend, -BEND_MAX, BEND_MAX);

  const { u } = pose(cur, clock, mouse.x, mouse.y, bend);
  // the print's last stretch is a few pixels at most, so the DOM copy fades in over it unseen;
  // once it covers the stage the scene has nothing left to show and is not drawn
  const dom = smooth(phase(u, .94, .99));
  overLabel(u > 0 && dom < 1);
  if (dom !== lastFinale) {                            // written only when it changes
    // the page hears when the last print has become its own, and when it stops being (motion.js
    // turns the weathervane then)
    if ((dom === 1) !== (lastFinale === 1)) finaleEl.dispatchEvent(new CustomEvent('finale', { detail: dom === 1 }));
    finaleEl.style.opacity = lastFinale = dom;
  }
  drawn = dom < 1;
  if (drawn) renderer.render(scene, camera);
};
let drawn = false;
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !active) { lastSpin = null; pace.n = 0; }   // no spin kick, and no late frames, from the time it sat out
  active = e.isIntersecting;
}).observe(fan);
gsap.ticker.lagSmoothing(0);                           // a slow frame moves the page as far as the time it took
gsap.ticker.add(tick);

// for the page's motion (motion.js): the one scroll
export { lenis };
// and for the loader, which deals its pile out onto the fan: where each print is on screen, as drawn
// last frame (its image's corners, top left round to bottom left, in the viewport's pixels, bent as
// the shader bends it) and how the shader lights it there (the shade it multiplies the image by)
const cPt = new THREE.Vector3(), nV = new THREE.Vector3(), vV = new THREE.Vector3(), LIGHT = new THREE.Vector3(-.4, .6, .7).normalize();
const nM = new THREE.Matrix3(), mv = new THREE.Matrix4(), vZ = new THREE.Vector3();
export function quads() {
  const top = stageTopAt(lenis.animatedScroll);
  return cards.map(m => {
    const U = m.material.uniforms, mid = U.uMid.value * .5 * CW;
    let behind = false;
    const corner = (fu, fv) => {
      const x = fu * CW, s = x - mid, k = U.uBend.value * (1 + .4 * (fv - .5)) / CW, y = (fv - .5) * CH;
      if (Math.abs(k) > 1e-4) cPt.set(Math.sin(k * s) / k + mid, y, (1 - Math.cos(k * s)) / k); else cPt.set(x, y, 0);
      cPt.x += U.uR0.value;
      cPt.applyMatrix4(m.matrixWorld);
      // a corner behind the camera projects mirrored, to the other side of the screen: say so instead
      if (vZ.copy(cPt).applyMatrix4(camera.matrixWorldInverse).z > -camera.near) behind = true;
      cPt.project(camera);
      return [(cPt.x + 1) / 2 * stageW, (1 - cPt.y) / 2 * stageH + top];
    };
    // the fragment shader's light at the print's middle: a flat print, so one shade does
    mv.multiplyMatrices(camera.matrixWorldInverse, m.matrixWorld);
    vV.set(CW / 2 + U.uR0.value, 0, 0).applyMatrix4(mv).negate().normalize();
    nV.set(0, 0, 1).applyMatrix3(nM.getNormalMatrix(mv)).normalize();
    if (nV.dot(vV) < 0) nV.negate();
    const shade = .3 + .45 * nV.dot(vV) + .3 * Math.max(nV.dot(LIGHT), 0);
    const corners = [corner(0, 1), corner(1, 1), corner(1, 0), corner(0, 0)];
    return { corners, shade, behind };
  });
}
// and for the page's x-ray: each print's edge as drawn last frame (bent as the shader bends it, cut
// where it passes behind the camera, in the viewport's pixels), its name, its picture's size, how far
// it is from the camera, and whether its face or its back is seen. Nothing while the scene is not drawn
const PAGES = [...WORKS.map(([, name], k) => [name, pages[k].naturalWidth || pages[k].width, pages[k].naturalHeight || pages[k].height]), ['You have enough love for design?', DW, DH]];
export function outlines() {
  if (!active || !drawn) return [];
  const r = renderer.domElement.getBoundingClientRect(), sx = r.width / stageW, sy = r.height / stageH, NEAR = -camera.near * 1.01;
  return cards.map((m, k) => {
    const U = m.material.uniforms, mid = U.uMid.value * .5 * CW;
    // the edge in the camera's space
    const vs = EDGE.map(([fu, fv]) => {
      const x = fu * CW, s = x - mid, kk = U.uBend.value * (1 + .4 * (fv - .5)) / CW, y = (fv - .5) * CH;
      const p = new THREE.Vector3();
      if (Math.abs(kk) > 1e-4) p.set(Math.sin(kk * s) / kk + mid, y, (1 - Math.cos(kk * s)) / kk); else p.set(x, y, 0);
      p.x += U.uR0.value;
      return p.applyMatrix4(m.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    });
    const depth = -vs.reduce((t, p) => t + p.z, 0) / vs.length;
    // cut at the camera's near plane (a point behind it would project mirrored), then onto the screen
    const cut = [];
    vs.forEach((p, i) => {
      const q = vs[(i + 1) % vs.length], pin = p.z <= NEAR, qin = q.z <= NEAR;
      if (pin) cut.push(p);
      if (pin !== qin) cut.push(p.clone().lerp(q, (NEAR - p.z) / (q.z - p.z)));
    });
    if (cut.length < 3) return null;
    const pts = cut.map(p => { p.applyMatrix4(camera.projectionMatrix); return [r.left + (p.x + 1) / 2 * stageW * sx, r.top + (1 - p.y) / 2 * stageH * sy]; });
    // the face is seen when the edge runs clockwise on the screen (the sheet's corners go top left, top right, ...)
    let area = 0;
    pts.forEach(([x0, y0], i) => { const [x1, y1] = pts[(i + 1) % pts.length]; area += x0 * y1 - x1 * y0; });
    const [name, w, h] = PAGES[k];
    return { pts, name, w, h, depth, face: area > 0, clip: r };
  }).filter(Boolean);
}
