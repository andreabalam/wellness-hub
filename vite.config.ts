import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',          // ask user before activating new SW
      injectRegister: null,            // we register manually in main.tsx
      base: '/wellness-hub/',
      scope: '/wellness-hub/',
      manifest: {
        name: 'My Wellness Hub',
        short_name: 'Wellness Hub',
        description: 'Personal schedule, workouts, recipes & daily tracker — works offline.',
        start_url: '/wellness-hub/',
        scope: '/wellness-hub/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f1510',
        background_color: '#0d0f0e',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: '/wellness-hub/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/wellness-hub/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/wellness-hub/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache all Vite build assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Cache Google Fonts so the app loads correctly offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  base: '/wellness-hub/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/test/**'],
    },
  },
})
