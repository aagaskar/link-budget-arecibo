import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the built app works when served from any subpath
  // (e.g. nginx `alias` under /link-budget/), not just the domain root.
  base: './',
});
