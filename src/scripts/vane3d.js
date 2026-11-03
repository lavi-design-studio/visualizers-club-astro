// The weathervane in the last print, made solid: the rooster's own outline (assets/rooster.svg) cut
// from a sheet of polished metal a few units thick, as a real vane is, lit by a studio of soft light
// and hard panels so the light runs over it as it turns, and dithered as the reference shader does
// it (niccolofanton/dithering-shader, MIT): one bit, a 4x4 Bayer threshold on the colour's summed
// channels, in big cells. Its two tones are the page's own dither shades below the magenta, black and
// the portrait's dark magenta, so it stays in the page's colours and at no angle melts into the print.
// It sits on a small canvas of its own over the DOM copy of the print, and is drawn only while that
// copy is on screen; motion.js turns it (angle), it sways a little of its own once it is still, and it
// turns toward the pointer.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { gsap } from 'gsap';

const MAST = 60.5, W = 95.7, H = 135.957, DEPTH = 4;   // in the SVG's units; the mast's x
const REACH = 1.25 * MAST;                               // from the mast to the canvas's sides: the arrow's tail swings out to MAST
const FOV = 24;

// (the print's DOM copy is redrawn when the screen changes shape, so its vane is looked up each time)
export async function mount(svg) {
  const path = () => svg.querySelector('#vane');
  const stage = svg.parentElement;
  // the outline, extruded about the mast, its y turned the right way up
  const shapes = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="${path().getAttribute('d')}"/></svg>`).paths.flatMap(p => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: true, bevelThickness: .6, bevelSize: .4, bevelSegments: 2, curveSegments: 6 });
  geo.translate(-MAST, -H / 2, -DEPTH / 2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false });
  // a canvas pixel a dither cell, CELL CSS pixels square (2 on a phone), scaled up with no smoothing
  const CELL = innerWidth < 600 ? 2 : 3;
  renderer.setPixelRatio(1 / CELL);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated', zIndex: 1, visibility: 'hidden' });
  canvas.setAttribute('aria-hidden', 'true');
  stage.append(canvas);

  const scene = new THREE.Scene();
  // a dark studio with a few hard panels of light round it, as the reference's lightformers: a flat
  // sheet of metal shows black until it turns a panel's way, then a bright band runs over it
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new THREE.Scene();
  // a dark floor, a soft sky that brightens upward, and hard panels round it: whatever way the sheet
  // faces it reflects a gradient, never one flat tone, and the panels sweep bright bands across it
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vP; void main() { float t = smoothstep(-.6, .9, vP.y + .25 * vP.x); gl_FragColor = vec4(vec3(mix(.03, .55, t)), 1.); }' }));
  studio.add(sky);
  const panel = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m); };
  panel(1.5, 9, -6, 1, 6, 5); panel(9, 1.6, 0, 8, 4, 3); panel(2.5, 7, 7, 0, 3, 4);
  panel(1.2, 8, 3, 2, -7, 5); panel(.7, 9, -1.6, 0, 9, 4);
  scene.environment = pmrem.fromScene(studio, .03).texture;
  // hammered metal: a height field of soft dents, as a normal map, so the light breaks up over the
  // flat faces instead of lying on them in one tone
  const N = 256, hc = document.createElement('canvas'); hc.width = hc.height = N;
  const hg = hc.getContext('2d'); hg.fillStyle = '#808080'; hg.fillRect(0, 0, N, N);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * N, y = Math.random() * N, r = 6 + Math.random() * 22;
    for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {   // wrapped, so the map tiles
      const gr = hg.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      hg.fillStyle = gr; hg.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    }
  }
  const hd = hg.getImageData(0, 0, N, N).data, nd = new Uint8Array(N * N * 4), at = (x, y) => hd[(((y + N) % N) * N + (x + N) % N) * 4] / 255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nx = (at(x - 1, y) - at(x + 1, y)) * 1.5, ny = (at(x, y - 1) - at(x, y + 1)) * 1.5, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
    nd[i] = (nx / l * .5 + .5) * 255; nd[i + 1] = (ny / l * .5 + .5) * 255; nd[i + 2] = (1 / l * .5 + .5) * 255; nd[i + 3] = 255;
  }
  const normalMap = new THREE.DataTexture(nd, N, N); normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(1 / 45, 1 / 45); normalMap.needsUpdate = true;   // the extrusion's uvs are the SVG's units

  const mat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: .35, envMapIntensity: 1, normalMap, normalScale: new THREE.Vector2(.4, .4) });
  // the reference's dither: a cell lights (the pale tint) where its brightness clears its 4x4 Bayer
  // threshold, and stays black where it does not; brightness is the channels' sum, as there
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDark = { value: new THREE.Vector3(0, 0, 0) };
    sh.uniforms.uLight = { value: new THREE.Vector3(97, 28, 99).divideScalar(255) };   // the portrait's dark magenta
    sh.uniforms.uGain = { value: .3 };   // the summed channels run high under this light: a third keeps the sheet mid-grey
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform vec3 uDark, uLight; uniform float uGain;
        float bayer4(ivec2 p) {
          float m[16] = float[16](16., 5., 13., 1., 8., 12., 4., 9., 14., 2., 15., 3., 6., 10., 7., 11.);
          return m[p.x * 4 + p.y] / 17.;
        }
        void main() {`)
      .replace('#include <dithering_fragment>', `
        float b = dot(gl_FragColor.rgb, vec3(1.)) * uGain;
        bool dark = b < 1. / 17. || (b <= 16. / 17. && b < bayer4(ivec2(mod(gl_FragCoord.xy, 4.))));
        gl_FragColor = vec4(dark ? uDark : uLight, 1.);`);
  };
  const vane = new THREE.Mesh(geo, mat);
  vane.scale.y = -1;                                       // the SVG's y runs down
  const pivot = new THREE.Group(); pivot.add(vane); scene.add(pivot);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 2000);

  // the canvas covers the vane's place on screen and the room it swings through; the camera stands
  // where one SVG unit at the mast is the place's own scale
  let unit = 1, on = false, angle = 0, still = 0, last = 0;
  const place = () => {
    path().style.visibility = 'hidden';
    const r = path().getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (!r.width) return;
    // the vane's box at rest (motion.js leaves its transform at 0 turns while the canvas is up)
    unit = r.height / H;
    const w = Math.ceil(2 * REACH * unit / CELL) * CELL, h = Math.ceil(H * 1.18 * unit / CELL) * CELL;   // whole cells
    const mastX = r.left - s.left + (MAST / W) * r.width, midY = r.top - s.top + r.height / 2;
    Object.assign(canvas.style, { left: `${Math.round(mastX - w / 2)}px`, top: `${Math.round(midY - h / 2)}px`, width: `${w}px`, height: `${h}px` });
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, (h / unit) / 2 / Math.tan(FOV * Math.PI / 360));
    camera.updateProjectionMatrix();
  };
  // the pointer as a breeze: the vane turns toward it on its mast (up to 35° either way, as the
  // pointer crosses the screen) and tips a little toward it, eased, so the light runs over it as the
  // pointer moves; on touch nothing follows and it keeps its own sway
  const aim = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    aim.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (innerWidth / 2)));
    aim.y = Math.max(-1, Math.min(1, (e.clientY - cy) / (innerHeight / 2)));
  }, { passive: true });
  const tick = (time, dt) => {
    if (!on) return;
    // once the turn has settled, a little sway of its own, so the light keeps moving on it
    still = time - last > .6 ? Math.min(1, still + .02) : 0;
    const k = 1 - Math.exp(-dt / 1000 * 3.5);
    lean.x += (aim.x - lean.x) * k; lean.y += (aim.y - lean.y) * k;
    pivot.rotation.y = (angle + still * 7 * Math.sin(time * 1.1) + lean.x * 35) * Math.PI / 180;
    pivot.rotation.x = (.06 * Math.sin(time * .7) * still) + lean.y * .18;
    pivot.rotation.z = -lean.x * .05;
    renderer.render(scene, camera);
  };
  // its shaders made now, off the page's thread where the browser can, not on the first frame it shows
  await renderer.compileAsync(scene, camera);
  gsap.ticker.add(tick);
  addEventListener('resize', () => on && requestAnimationFrame(place));   // after fan.js has redrawn the print
  return {
    show(v) {
      on = v;
      if (v) { place(); last = gsap.ticker.time; still = 0; }
      canvas.style.visibility = v ? 'visible' : 'hidden';
      path().style.visibility = v ? 'hidden' : '';
    },
    angle(a) { angle = a; last = gsap.ticker.time; },
  };
}
