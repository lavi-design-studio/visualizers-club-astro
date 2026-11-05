// @ts-check
import { defineConfig } from 'astro/config';

// The shaders.com components the title's shader uses (src/scripts/title-shader.js): the library's
// registry holds all 200 and more of them (2.5 MB), so it is cut down to these as it is bundled.
// A component added to the title's preset is added here too, by its type
const SHADERS = ['Beam', 'Voronoi'];
const shadersOnly = () => ({
  name: 'shaders-only',
  enforce: /** @type {'pre'} */ ('pre'),
  transform(code, id) {
    // the registry's entry only re-exports its chunk: the rest are bare imports of every component
    if (/shaders\/dist\/core\/registry\.js$/.test(id)) return code.replace(/^import "[^"]+";\n/gm, '');
    if (!/shaders\/dist\/core\/shaderRegistry-[^/]+\.js$/.test(id)) return;
    // the chunk: each component imported as componentDefinition$n and listed by name; all but ours go
    const listed = [...code.matchAll(/^\t\t(\w+): (componentDefinition(?:\$\d+)?),$/gm)];
    const drop = new Set(listed.filter(([, name]) => !SHADERS.includes(name)).map(([, , def]) => def));
    return code
      .replace(/^\t\t(\w+): (componentDefinition(?:\$\d+)?),\n/gm, (line, name) => (SHADERS.includes(name) ? line : ''))
      .replace(/^import \{ \w+ as (componentDefinition(?:\$\d+)?) \} from "[^"]+";\n/gm, (line, def) => (drop.has(def) ? '' : line));
  },
});

// https://astro.build/config
export default defineConfig({
  vite: {
    // fan.js waits at its top level (top-level await), which needs the newest output
    build: { target: 'esnext' },
    plugins: [shadersOnly()],
    // (left out of the dev server's prebundling, so it is cut down there too, as it will be built)
    optimizeDeps: { exclude: ['shaders'] },
  },
  // the page's CSS in the page itself, so nothing holds up its first paint (it is one page, 9 KB)
  build: { inlineStylesheets: 'always' },
});
