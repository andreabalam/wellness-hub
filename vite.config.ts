import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Exposed to the app (see src/vite-env.d.ts) for error-log tagging.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // ask user before activating new SW
      injectRegister: null, // we register manually in main.tsx
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
          {
            src: '/wellness-hub/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
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
    include: ['src/test/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/lib/sync.ts', // Supabase network layer — covered by E2E
        'src/components/AuthButton.tsx', // Supabase auth flow — covered by E2E
        'src/components/TrackerTab/RemindersSection.tsx', // Supabase sync + complex UI — covered by E2E
        'src/components/RecipesTab/CookingMode.tsx', // Wake Lock API + keyboard — covered by E2E
        'src/components/common/**', // Tiny presentational primitives
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 75, // UI branches (ternaries, null guards) are harder to exhaust
      },
    },
  },
})
