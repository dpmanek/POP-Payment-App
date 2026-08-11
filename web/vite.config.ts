import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Two things matter here:
 *
 * 1. `base` — in production the UI is served by the existing Express app at
 *    /ui, so built asset URLs must be prefixed. In dev it stays at the root.
 *
 * 2. `proxy` — the "Use live decision service" toggle calls the real POP APIs.
 *    In production the UI and the API share an origin, so requests are relative
 *    and no proxy is involved. In dev, Vite forwards /pop and /health to the
 *    backend. Point VITE_PROXY_TARGET at the deployed API Gateway URL to test
 *    against AWS instead of a local server.
 */
export default defineConfig(({ command }) => {
  const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000';

  return {
    plugins: [react()],
    base: command === 'build' ? '/ui/' : '/',
    server: {
      port: 5173,
      proxy: {
        '/pop': { target: proxyTarget, changeOrigin: true },
        '/health': { target: proxyTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
