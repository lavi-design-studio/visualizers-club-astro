// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // fan.js waits at its top level (top-level await), which needs the newest output
  vite: { build: { target: 'esnext' } },
});
