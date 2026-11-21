// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Placeholder origin until the production domain is chosen (reserved decision).
  site: 'https://pathfinder.example',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  compressHTML: true,
});
