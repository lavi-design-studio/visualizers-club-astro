# Rebuilds this Astro project from the static landing page (visualizers-club-prototypes/landing),
# its source: copies fonts and assets into public/, the scripts into src/scripts (the fan's and the
# ring's pictures taken from the base URL), the styles and markup apart, and writes index.astro.
# Run with: python tools/sync-from-static.py
import shutil, re, os, sys
src = 'C:/Users/Lavi/Documents/visualizers-club-prototypes/landing'
dst = 'C:/Users/Lavi/Documents/visualizers-club-astro'
for d in ('fonts', 'assets'):
    shutil.copytree(f'{src}/{d}', f'{dst}/public/{d}', dirs_exist_ok=True)
for f in ('favicon.ico', 'favicon.svg'):
    if os.path.exists(f'{dst}/public/{f}'): os.remove(f'{dst}/public/{f}')
os.makedirs(f'{dst}/src/scripts', exist_ok=True); os.makedirs(f'{dst}/src/styles', exist_ok=True); os.makedirs(f'{dst}/src/partials', exist_ok=True)
for f in ('motion.js', 'fan.js', 'dither.js', 'vane3d.js', 'ring.js'):
    s = open(f'{src}/{f}', encoding='utf-8').read()
    if f == 'fan.js':
        a = "img.src = new URL(`assets/fan/${file}.webp`, import.meta.url).href;"
        assert a in s; s = s.replace(a, "img.src = `${import.meta.env.BASE_URL}assets/fan/${file}.webp`;   // public/assets")
        a = "await fetch(new URL('assets/rooster.svg', import.meta.url))"
        assert a in s; s = s.replace(a, "await fetch(`${import.meta.env.BASE_URL}assets/rooster.svg`)")
    if f == 'ring.js':
        a = "new URL('assets/fan/', import.meta.url).href"
        assert a in s; s = s.replace(a, "`${import.meta.env.BASE_URL}assets/fan/`")
    open(f'{dst}/src/scripts/{f}', 'w', encoding='utf-8', newline='\n').write(s)
h = open(f'{src}/index.html', encoding='utf-8').read()
head = h[h.index('<head>') + 6:h.index('<style>')]
css = h[h.index('<style>') + 7:h.index('</style>')]
body = h[h.index('<body>') + 6:h.index('<script type="importmap">')]
css = css.replace('url(fonts/', 'url(/fonts/').replace('url(assets/', 'url(/assets/')
open(f'{dst}/src/styles/landing.css', 'w', encoding='utf-8', newline='\n').write(css.strip() + '\n')
body = re.sub(r'(src|poster|href)="(assets|fonts)/', r'\1="/\2/', body)
open(f'{dst}/src/partials/body.html', 'w', encoding='utf-8', newline='\n').write(body.strip() + '\n')
head = head.replace('href="fonts/', 'href="/fonts/').replace('<script>', '<script is:inline>')
page = """---
// The landing page, as the static one in visualizers-club-prototypes/landing has it: its markup
// (src/partials/body.html, set as written: its type uses braces Astro would read as code), its styles
// (src/styles/landing.css) and its scripts (src/scripts), bundled; GSAP, Lenis and three from npm,
// where the static page took them from a CDN by an import map
import '../styles/landing.css';
import body from '../partials/body.html?raw';
---
<!doctype html>
<html lang="vi">
<head>""" + head.rstrip() + """
</head>
<body>
<Fragment set:html={body} />
<script>
  import '../scripts/dither.js';
  import '../scripts/fan.js';
  import '../scripts/motion.js';
  import '../scripts/ring.js';
</script>
</body>
</html>
"""
open(f'{dst}/src/pages/index.astro', 'w', encoding='utf-8', newline='\n').write(page)
open(f'{dst}/astro.config.mjs', 'w', encoding='utf-8', newline='\n').write("""// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // fan.js waits at its top level (top-level await), which needs the newest output
  vite: { build: { target: 'esnext' } },
});
""")
print('ported')
