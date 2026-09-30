/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from "/" by default (dev server, Docker). The GitHub Pages demo sets
// VITE_BASE=/MeepleMark-web/ because a project site lives under a sub-path.
const base = (process.env.VITE_BASE ?? '/').replace(/\/?$/, '/')
const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const underBase = (pattern: string) => new RegExp(`^${escapedBase}${pattern}`)

// https://vite.dev/config/
export default defineConfig({
  base,
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
    },
  },
  plugins: [
    react(),
    {
      name: 'e2e-waiting-worker-fixture',
      generateBundle() {
        if (process.env.VITE_E2E !== 'true') return
        this.emitFile({
          type: 'asset',
          fileName: 'e2e-update-sw.js',
          source: "self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});self.addEventListener('fetch',()=>{});",
        })
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'MeepleMark',
        short_name: 'MeepleMark',
        description: 'A local-first board-game scorepad.',
        theme_color: '#fafafa',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,json}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackAllowlist: [
          underBase('(?:\\?.*)?$'),
          underBase('play\\/(?:new|[^/?]+)(?:\\?.*)?$'),
          underBase('collection(?:\\/[^/?]+(?:\\/template)?)?(?:\\?.*)?$'),
          underBase('players(?:\\?.*)?$'),
          underBase('account(?:\\?.*)?$'),
          underBase('conflicts(?:\\/[^/?]+)?(?:\\?.*)?$'),
          underBase('admin(?:\\?.*)?$'),
          underBase('help\\/offline(?:\\?.*)?$'),
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
