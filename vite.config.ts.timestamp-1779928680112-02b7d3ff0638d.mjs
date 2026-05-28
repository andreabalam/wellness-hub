// vite.config.ts
import { defineConfig } from "file:///Users/andrea/Projects/wellness-hub/node_modules/vitest/dist/config.js";
import react from "file:///Users/andrea/Projects/wellness-hub/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///Users/andrea/Projects/wellness-hub/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      // ask user before activating new SW
      injectRegister: null,
      // we register manually in main.tsx
      base: "/wellness-hub/",
      scope: "/wellness-hub/",
      manifest: {
        name: "My Wellness Hub",
        short_name: "Wellness Hub",
        description: "Personal schedule, workouts, recipes & daily tracker \u2014 works offline.",
        start_url: "/wellness-hub/",
        scope: "/wellness-hub/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#0f1510",
        background_color: "#0d0f0e",
        categories: ["health", "fitness", "lifestyle"],
        icons: [
          { src: "/wellness-hub/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/wellness-hub/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/wellness-hub/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Precache all Vite build assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Cache Google Fonts so the app loads correctly offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
  base: "/wellness-hub/",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/main.tsx", "src/test/**"]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYW5kcmVhL1Byb2plY3RzL3dlbGxuZXNzLWh1YlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2FuZHJlYS9Qcm9qZWN0cy93ZWxsbmVzcy1odWIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2FuZHJlYS9Qcm9qZWN0cy93ZWxsbmVzcy1odWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAncHJvbXB0JywgICAgICAgICAgLy8gYXNrIHVzZXIgYmVmb3JlIGFjdGl2YXRpbmcgbmV3IFNXXG4gICAgICBpbmplY3RSZWdpc3RlcjogbnVsbCwgICAgICAgICAgICAvLyB3ZSByZWdpc3RlciBtYW51YWxseSBpbiBtYWluLnRzeFxuICAgICAgYmFzZTogJy93ZWxsbmVzcy1odWIvJyxcbiAgICAgIHNjb3BlOiAnL3dlbGxuZXNzLWh1Yi8nLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ015IFdlbGxuZXNzIEh1YicsXG4gICAgICAgIHNob3J0X25hbWU6ICdXZWxsbmVzcyBIdWInLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1BlcnNvbmFsIHNjaGVkdWxlLCB3b3Jrb3V0cywgcmVjaXBlcyAmIGRhaWx5IHRyYWNrZXIgXHUyMDE0IHdvcmtzIG9mZmxpbmUuJyxcbiAgICAgICAgc3RhcnRfdXJsOiAnL3dlbGxuZXNzLWh1Yi8nLFxuICAgICAgICBzY29wZTogJy93ZWxsbmVzcy1odWIvJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBvcmllbnRhdGlvbjogJ3BvcnRyYWl0JyxcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjMGYxNTEwJyxcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwZDBmMGUnLFxuICAgICAgICBjYXRlZ29yaWVzOiBbJ2hlYWx0aCcsICdmaXRuZXNzJywgJ2xpZmVzdHlsZSddLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHsgc3JjOiAnL3dlbGxuZXNzLWh1Yi9pY29uLTE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICAgIHsgc3JjOiAnL3dlbGxuZXNzLWh1Yi9pY29uLTUxMi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICAgIHsgc3JjOiAnL3dlbGxuZXNzLWh1Yi9pY29uLTUxMi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ21hc2thYmxlJyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgLy8gUHJlY2FjaGUgYWxsIFZpdGUgYnVpbGQgYXNzZXRzXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3b2ZmLHdvZmYyfSddLFxuICAgICAgICAvLyBDYWNoZSBHb29nbGUgRm9udHMgc28gdGhlIGFwcCBsb2FkcyBjb3JyZWN0bHkgb2ZmbGluZVxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZ29vZ2xlLWZvbnRzLXN0eWxlc2hlZXRzJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiAxMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1IH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb21cXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnb29nbGUtZm9udHMtd2ViZm9udHMnLFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZTogeyBzdGF0dXNlczogWzAsIDIwMF0gfSxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiAyMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1IH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pLFxuICBdLFxuICBiYXNlOiAnL3dlbGxuZXNzLWh1Yi8nLFxuICB0ZXN0OiB7XG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBzZXR1cEZpbGVzOiBbJy4vc3JjL3Rlc3Qvc2V0dXAudHMnXSxcbiAgICBpbmNsdWRlOiBbJ3NyYy90ZXN0LyoqLyoudGVzdC50cyddLFxuICAgIGV4Y2x1ZGU6IFsnZTJlLyoqJywgJ25vZGVfbW9kdWxlcy8qKiddLFxuICAgIGNvdmVyYWdlOiB7XG4gICAgICBwcm92aWRlcjogJ3Y4JyxcbiAgICAgIHJlcG9ydGVyOiBbJ3RleHQnLCAnbGNvdiddLFxuICAgICAgaW5jbHVkZTogWydzcmMvKiovKi50cycsICdzcmMvKiovKi50c3gnXSxcbiAgICAgIGV4Y2x1ZGU6IFsnc3JjL21haW4udHN4JywgJ3NyYy90ZXN0LyoqJ10sXG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTJSLFNBQVMsb0JBQW9CO0FBQ3hULE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFHeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQTtBQUFBLE1BQ2hCLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxRQUNQLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFlBQVksQ0FBQyxVQUFVLFdBQVcsV0FBVztBQUFBLFFBQzdDLE9BQU87QUFBQSxVQUNMLEVBQUUsS0FBSyw4QkFBOEIsT0FBTyxXQUFXLE1BQU0sWUFBWTtBQUFBLFVBQ3pFLEVBQUUsS0FBSyw4QkFBOEIsT0FBTyxXQUFXLE1BQU0sWUFBWTtBQUFBLFVBQ3pFLEVBQUUsS0FBSyw4QkFBOEIsT0FBTyxXQUFXLE1BQU0sYUFBYSxTQUFTLFdBQVc7QUFBQSxRQUNoRztBQUFBLE1BQ0Y7QUFBQSxNQUNBLFNBQVM7QUFBQTtBQUFBLFFBRVAsY0FBYyxDQUFDLDJDQUEyQztBQUFBO0FBQUEsUUFFMUQsZ0JBQWdCO0FBQUEsVUFDZDtBQUFBLFlBQ0UsWUFBWTtBQUFBLFlBQ1osU0FBUztBQUFBLFlBQ1QsU0FBUztBQUFBLGNBQ1AsV0FBVztBQUFBLGNBQ1gsWUFBWSxFQUFFLFlBQVksSUFBSSxlQUFlLEtBQUssS0FBSyxLQUFLLElBQUk7QUFBQSxZQUNsRTtBQUFBLFVBQ0Y7QUFBQSxVQUNBO0FBQUEsWUFDRSxZQUFZO0FBQUEsWUFDWixTQUFTO0FBQUEsWUFDVCxTQUFTO0FBQUEsY0FDUCxXQUFXO0FBQUEsY0FDWCxtQkFBbUIsRUFBRSxVQUFVLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxjQUN4QyxZQUFZLEVBQUUsWUFBWSxJQUFJLGVBQWUsS0FBSyxLQUFLLEtBQUssSUFBSTtBQUFBLFlBQ2xFO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLElBQ0osYUFBYTtBQUFBLElBQ2IsU0FBUztBQUFBLElBQ1QsWUFBWSxDQUFDLHFCQUFxQjtBQUFBLElBQ2xDLFNBQVMsQ0FBQyx1QkFBdUI7QUFBQSxJQUNqQyxTQUFTLENBQUMsVUFBVSxpQkFBaUI7QUFBQSxJQUNyQyxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxNQUFNO0FBQUEsTUFDekIsU0FBUyxDQUFDLGVBQWUsY0FBYztBQUFBLE1BQ3ZDLFNBQVMsQ0FBQyxnQkFBZ0IsYUFBYTtBQUFBLElBQ3pDO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
