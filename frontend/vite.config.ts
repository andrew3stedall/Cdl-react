import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/Cdl-react/' : '/',
  plugins: [react()],
  build: {
    manifest: true,
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', 'browser-tests/**'],
    setupFiles: ['./src/test-setup.ts'],
  },
}));
