import { defineConfig } from 'vite';

export default defineConfig({
  // Deploy path, matching the other apps' deploy scripts:
  //   VITE_BASE=/link-budget/ npm run build
  // Defaults to relative URLs so a plain build works from any mount point.
  base: process.env.VITE_BASE ?? './',
});
