// @ts-check
import { defineConfig } from 'astro/config';

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The page's scripts are imported only once its first frame is painted (index.astro), so that paint
// never waits on them; but then they are only asked for then, one hop after the page's own script, and
// on a phone's connection that is most of a second. Each is named in the page's head as a modulepreload
// (fetched now, beside the fonts, and run only when imported), read from the built page's own script
const preloadScripts = () => ({
  name: 'preload-scripts',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const out = fileURLToPath(dir), page = `${out}index.html`;
      let html = readFileSync(page, 'utf8');
      // (each of the page's module scripts: the one that imports the rest, and any beside it)
      const srcs = [...html.matchAll(/<script type="module" src="\/(_astro\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
      if (!srcs.length) throw new Error('preload-scripts: the page has no module script');
      const deps = [...new Set(srcs.flatMap(src => {
        const js = readFileSync(`${out}${src}`, 'utf8');
        return [...[...js.matchAll(/from"\.\/([^"]+\.js)"/g)].map(m => `_astro/${m[1]}`), ...JSON.parse(js.match(/m\.f=(\[[^\]]*\])/)?.[1] ?? '[]')];
      }))];
      if (!deps.length) throw new Error('preload-scripts: no chunks found in ' + srcs.join(', '));
      html = html.replace('</head>', deps.map(d => `<link rel="modulepreload" href="/${d}">`).join('') + '</head>');
      writeFileSync(page, html);
    },
  },
});

// https://astro.build/config
export default defineConfig({
  integrations: [preloadScripts()],
  vite: {
    // fan.js waits at its top level (top-level await), which needs the newest output
    build: { target: 'esnext' },
  },
  // the page's CSS in the page itself, so nothing holds up its first paint (it is one page, 9 KB)
  build: { inlineStylesheets: 'always' },
});
