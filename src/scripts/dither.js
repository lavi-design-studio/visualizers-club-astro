// The portrait's Dither effect as Figma has it on the image (Bayer 8x8, mono in the magenta, 3 levels,
// brightness 69, contrast 1, size 1), worked out the way Figma's shader does it, on a 2D canvas: the
// image covers the box, and each pixel's luma, pushed by its Bayer threshold, falls to one of three
// shades of the mono colour. One cell per CSS pixel (Figma's size 1), redone when the box changes
// size; photo.cell makes the cells bigger, which the page's motion uses to bring the portrait in.
// The footer's clip is dithered the same way, frame by frame while it plays on screen.
const params = { levels: 3, brightness: 69, contrast: 1, mono: [0.7624493837356567, 0.22324037551879883, 0.7791259288787842] };

// the Bayer tile, as the shader builds it
function bayerMatrix(N) {
  if (N === 1) return [[0]];
  const small = bayerMatrix(N / 2), m = N / 2, out = [];
  for (let y = 0; y < N; y++) {
    out[y] = new Array(N);
    for (let x = 0; x < N; x++) {
      const v = small[y % m][x % m] * 4;
      const qx = Math.floor(x / m), qy = Math.floor(y / m);
      const qoff = (qy === 0 && qx === 0) ? 0 : (qy === 0 && qx === 1) ? 2 : (qy === 1 && qx === 0) ? 3 : 1;
      out[y][x] = v + qoff;
    }
  }
  return out;
}
function flattenBayer(N) {
  const m = bayerMatrix(N), data = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) data[y * N + x] = (m[y][x] + 0.5) / (N * N);
  return { data, size: N };
}
export const tile = flattenBayer(8);              // the page's seam (motion.js) dithers with it too

// WGSL's round() goes to even on a half
export const roundEven = x => { const r = Math.round(x); return (r - x === 0.5 && r % 2) ? r - 1 : r; };

// the dithered cells, one pixel each; shown scaled up with no smoothing, as the shader's present pass does
const cells = document.createElement('canvas');
// src is an image or a video, BW × BH the box in CSS pixels; brightness as Figma's (100 leaves it).
// The canvas is drawn in the screen's own pixels and a cell is a whole number of them (a CSS pixel's
// worth, rounded), so no row or column of cells is ever stretched to fill a fractional box: a doubled
// one shifts the Bayer pattern from there on, and the picture looks cut in two
export function draw(canvas, src, cell, cssW, cssH, brightness = params.brightness) {
  const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
  if (!sw || !sh) return;
  const dpr = devicePixelRatio || 1, BW = Math.max(1, Math.round(cssW * dpr)), BH = Math.max(1, Math.round(cssH * dpr));
  cell = Math.max(1, Math.round(cell * dpr));
  const W = Math.ceil(BW / cell), H = Math.ceil(BH / cell);
  cells.width = W; cells.height = H;
  const g = cells.getContext('2d', { willReadFrequently: true });
  // object-fit: cover, sampled at the cells' centres
  const s = Math.max(W * cell / sw, H * cell / sh) / cell, w = sw * s, h = sh * s;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, (BW / cell - w) / 2, (BH / cell - h) / 2, w, h);
  const px = g.getImageData(0, 0, W, H), d = px.data;
  const L = params.levels - 1, bright = (brightness - 100) / 200, k = params.contrast, [mr, mg, mb] = params.mono;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const c = ch => Math.min(1, Math.max(0, (d[i + ch] / 255 - 0.5) * k + 0.5 + bright));
    const luma = 0.2126 * c(0) + 0.7152 * c(1) + 0.0722 * c(2);
    const th = tile.data[(y % tile.size) * tile.size + (x % tile.size)];
    const q = Math.min(1, Math.max(0, roundEven((luma + (th - 0.5) / L) * L) / L));
    d[i] = Math.round(mr * q * 255); d[i + 1] = Math.round(mg * q * 255); d[i + 2] = Math.round(mb * q * 255); d[i + 3] = 255;
  }
  g.putImageData(px, 0, 0);
  if (canvas.width !== BW || canvas.height !== BH) {
    canvas.width = BW; canvas.height = BH;
    Object.assign(canvas.style, { width: `${BW / dpr}px`, height: `${BH / dpr}px` });   // one canvas pixel a screen pixel
  }
  const out = canvas.getContext('2d');
  out.imageSmoothingEnabled = false;
  out.drawImage(cells, 0, 0, W * cell, H * cell);
}

const canvas = document.getElementById('laviDither'), img = document.getElementById('laviPhoto');
const ready = img.complete && img.naturalWidth ? Promise.resolve() : new Promise(r => img.addEventListener('load', r, { once: true }));
let loaded = false, box = [1, 1];
export const photo = {
  cell: 1,
  setCell(n) {
    n = Math.max(1, Math.round(n));
    if (n === this.cell) return;
    this.cell = n;
    if (loaded) draw(canvas, img, n, ...box);
  },
};
ready.then(() => {
  loaded = true;
  let last = '';
  // the figure's box, as laid out (the canvas takes its size from draw, in whole screen pixels)
  new ResizeObserver(([e]) => {
    const dpr = devicePixelRatio || 1, key = `${Math.round(e.contentRect.width * dpr)}x${Math.round(e.contentRect.height * dpr)}`;
    if (key === last) return;
    last = key; box = [e.contentRect.width, e.contentRect.height];
    draw(canvas, img, photo.cell, ...box);
    canvas.parentElement.classList.add('dithered');
  }).observe(canvas.parentElement);
});

// the footer's clip: each new frame of the video, while it is on screen, drawn dithered over it (the
// video stays under the canvas, seen by the browser, so it keeps playing)
// a darker picture than the portrait, so lifted where the portrait is lowered (69), to read on black
const CLIP_BRIGHTNESS = 160;
const clip = document.querySelector('.foot-clip video'), clipOut = document.querySelector('.foot-clip canvas');
if (clip && clipOut) {
  let size = [1, 1], seen = false;
  const frame = () => { draw(clipOut, clip, 1, ...size, CLIP_BRIGHTNESS); clipOut.parentElement.classList.add('dithered'); };
  const each = () => { if (seen) frame(); next(); };
  const next = () => (clip.requestVideoFrameCallback ? clip.requestVideoFrameCallback(each) : setTimeout(each, 100));
  new ResizeObserver(([e]) => { size = [e.contentRect.width, e.contentRect.height]; if (clip.readyState >= 2) frame(); }).observe(clipOut.parentElement);
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen && clip.readyState >= 2) frame(); }).observe(clipOut);
  clip.addEventListener('loadeddata', frame);         // the first frame, and the only one if it stands still
  next();
}
