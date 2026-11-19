import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Web: live app → dist/, demo → dist/demo/ (VITE_DEMO=1).
// Android: VITE_ROLE = worker | admin, OUT_DIR=build/<role>, no service worker.
const DEMO = !!process.env.VITE_DEMO;
const ROLE = process.env.VITE_ROLE || '';

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify(DEMO ? '1' : ''), 'import.meta.env.VITE_ROLE': JSON.stringify(ROLE) },
  plugins: [
    react(),
    VitePWA({
      disable: !!ROLE,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: DEMO ? 'shiftmark-demo' : 'shiftmark',
        name: DEMO ? 'ShiftMark — Demo' : 'ShiftMark',
        short_name: DEMO ? 'SM Demo' : 'ShiftMark',
        description: 'Shift attendance: automatic clock-in at the office, hours, overtime and pay',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: DEMO ? [] : ['demo/**'],
        navigateFallbackDenylist: DEMO ? [] : [/\/demo\//],
        runtimeCaching: [{ urlPattern: /supabase\.co\//, handler: 'NetworkOnly' }],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: { outDir: process.env.OUT_DIR || (DEMO ? 'dist/demo' : 'dist'), emptyOutDir: !DEMO, chunkSizeWarningLimit: 1500 },
});
