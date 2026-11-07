// The rooster on the sign-up page once it is done (Figma's Confirmed and Fully booked): the landing
// page's own, the club's weathervane (assets/logo-ice.glb) in the same clear ice (ice-look.js),
// standing where the frames have their weathervane (.vane, whose picture stays where there is no
// WebGL). What it bends is the sheet behind it: its ruled lines, on black, under two soft lights in the
// title's colours, one of them the pointer's; its edges break into rainbows and its rim is lit pink and
// blue, as the hero's.
//   It grows in out of frost as the sheet comes into view, as the hero's does, then sways as a vane in a
// light wind, turned a little by the pointer and spun by the scroll. It is drawn only while it is on
// the screen; under reduced motion it stands still, grown, drawn once.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ICE, iceVert, iceFrag, vaneGeometry, iceUniforms } from './ice-look.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// where its mast stands in the frames' weathervane (a share of its width), and how much room round it
// the canvas keeps for it to turn in
const MAST = .6, ROOM_X = 1.6, ROOM_Y = 1.12;

// the backdrop: what is behind it, drawn small (half the pixels: it is only seen bent through the ice)
const backFrag = /* glsl */`
  uniform sampler2D uPage;
  uniform vec2 uView, uPtr;
  uniform float uTime;
  uniform vec3 uPink, uBlue;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uPage, vUv).rgb;
    float asp = uView.x / uView.y;
    vec2 a = vec2(.5 + .2 * sin(uTime * .21), .55 + .16 * cos(uTime * .17));
    vec2 d1 = (vUv - a) * vec2(asp, 1.), d2 = (vUv - uPtr) * vec2(asp, 1.);
    c += uBlue * exp(-5. * dot(d1, d1)) * .22 + uPink * exp(-9. * dot(d2, d2)) * .25;
    gl_FragColor = vec4(c, 1.);
  }`;

export async function rooster(slot) {
  const sheet = slot.offsetParent;
  if (!sheet) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'rooster'; canvas.setAttribute('aria-hidden', 'true');
  slot.after(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch { canvas.remove(); return; }   // (no WebGL: the picture stays)
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 1, .1, 200);
  camera.position.set(0, 0, 26);

  // the sheet behind it: its lines where they are (a done sheet's own on a wide screen, its ruling on a
  // phone), the magenta on black
  const page = document.createElement('canvas'), pg = page.getContext('2d');
  const pageTex = new THREE.CanvasTexture(page); pageTex.colorSpace = THREE.SRGBColorSpace;
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uPage: { value: pageTex }, uView: { value: new THREE.Vector2(1, 1) }, uPtr: { value: new THREE.Vector2(.5, .5) }, uTime: { value: 0 },
      uPink: { value: new THREE.Color(ICE.pink) }, uBlue: { value: new THREE.Color(ICE.blue) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: backFrag, depthTest: false, depthWrite: false,
  }));
  const behind = new THREE.Scene(); behind.add(backdrop);

  const { geo, LOGO_H } = await vaneGeometry(null);
  const uniforms = iceUniforms();
  const backMat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(uniforms), vertexShader: iceVert, fragmentShader: iceFrag, side: THREE.BackSide, defines: { BACK: '' } });
  const frontMat = new THREE.ShaderMaterial({ uniforms, vertexShader: iceVert, fragmentShader: iceFrag, side: THREE.FrontSide });
  const logo = new THREE.Mesh(geo, frontMat);
  const pivot = new THREE.Group(); pivot.add(logo); scene.add(pivot);
  const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter });
  const behindRT = rt(), backRT = rt();
  backMat.uniforms.uTexture.value = behindRT.texture;
  frontMat.uniforms.uTexture.value = backRT.texture;

  // the canvas round the weathervane's place, with room to turn; the lines behind it read again
  let W = 1, H = 1, dpr = 1, mastX = 0, midY = 0, tall = 1;
  const fit = () => {
    const s = slot.getBoundingClientRect(), sh = sheet.getBoundingClientRect();
    if (!s.height) return;
    tall = s.height; W = Math.round(Math.max(s.width * ROOM_X, s.height * .9)); H = Math.round(s.height * ROOM_Y);
    const left = s.left - sh.left + s.width / 2 - W / 2, top = s.top - sh.top + s.height / 2 - H / 2;
    Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${W}px`, height: `${H}px` });
    mastX = s.left + s.width * MAST - (sh.left + left); midY = H / 2;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    behindRT.setSize(W * dpr / 2, H * dpr / 2); backRT.setSize(W * dpr / 2, H * dpr / 2);
    frontMat.uniforms.uRes.value.set(W * dpr, H * dpr); backMat.uniforms.uRes.value.set(W * dpr / 2, H * dpr / 2);
    backdrop.material.uniforms.uView.value.set(W, H);
    // the lines: each .rl's foot (and the first one's head), or the sheet's ruling every --line
    const k = .5; page.width = Math.round(W * k); page.height = Math.round(H * k);
    pg.setTransform(k, 0, 0, k, 0, 0); pg.fillStyle = '#000'; pg.fillRect(0, 0, W, H); pg.fillStyle = ICE.magenta;
    const oy = sh.top + top, rls = [...sheet.querySelectorAll('.rl')].filter(r => r.offsetParent);
    const ys = rls.length ? rls.flatMap((r, i) => { const b = r.getBoundingClientRect(); return i ? [b.bottom - 1] : [b.top, b.bottom - 1]; })
      : (() => { const step = parseFloat(getComputedStyle(sheet).getPropertyValue('--line')) || 28, out = []; for (let y = sh.top; y <= sh.bottom; y += step) out.push(y); return out; })();
    for (const y of ys) pg.fillRect(0, y - oy, W, 1.5);
    pageTex.needsUpdate = true;
  };
  fit();
  new ResizeObserver(fit).observe(sheet);
  addEventListener('resize', fit);
  await renderer.compileAsync(scene, camera);

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  const grow = { v: reduce ? 1.05 : 0 };
  let seen = false, began = false, lastY = scrollY, spin = 0, spinV = 0, t = 0;
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    // (grown in out of frost the first time it comes into view, as the hero's)
    if (seen && !began && !reduce) { began = true; gsap.to(grow, { v: 1.05, duration: 3.1, ease: 'power2.inOut' }); }
  }, { rootMargin: '0px 0px -10% 0px' }).observe(canvas);

  const draw = () => {
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, halfW = halfH * camera.aspect;
    const k = tall / H * 2 * halfH / LOGO_H;
    pivot.position.set((mastX / W * 2 - 1) * halfW, (1 - midY / H * 2) * halfH, 0);
    pivot.scale.setScalar(k);
    // a vane in a light wind: swaying either side of the frames' view of it, turned toward the pointer,
    // spun by the scroll
    const yaw = (reduce ? 0 : Math.sin(t * .35) * .55 + Math.sin(t * .13) * .35) + ptr.x * .25 + spin;
    pivot.rotation.set(ptr.y * .04, yaw, 0);
    backdrop.material.uniforms.uTime.value = t; backdrop.material.uniforms.uPtr.value.set((ptr.x + 1) / 2, 1 - (ptr.y + 1) / 2);
    for (const m of [frontMat, backMat]) { m.uniforms.uGrow.value = grow.v; m.uniforms.uTime.value = t; m.uniforms.uLight.value.set(ptr.x * 2 - .4, -ptr.y * 2 + 1, 1.2); }
    // the backdrop; the backdrop with the back faces over it; then the front faces, bending that
    renderer.setRenderTarget(behindRT); renderer.render(behind, flat);
    renderer.setRenderTarget(backRT); renderer.render(behind, flat);
    renderer.autoClear = false; logo.material = backMat; renderer.render(scene, camera); renderer.autoClear = true;
    renderer.setRenderTarget(null);
    logo.material = frontMat; renderer.render(scene, camera);
    slot.classList.add('iced');   // (the picture gives way to it)
  };
  if (reduce) { draw(); new ResizeObserver(() => draw()).observe(sheet); return; }
  gsap.ticker.add((_, deltaMs) => {
    if (!seen) return;
    const dt = Math.min(1 / 30, deltaMs / 1000);
    t += dt;
    const mk = 1 - Math.exp(-dt * 3);
    ptr.x += (ptr.tx - ptr.x) * mk; ptr.y += (ptr.ty - ptr.y) * mk;
    const v = scrollY - lastY; lastY = scrollY;
    spinV += v * .0015 - spin * 18 * dt; spinV *= Math.exp(-dt * 4); spin += spinV * dt * 10;
    draw();
  });
}
