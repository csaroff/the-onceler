import { defineConfig } from 'vite';

// GitHub Pages serves the game from /<repository name>/, so the build is told where it will live.
export default defineConfig({ base: process.env.PAGES_BASE || '/' });
