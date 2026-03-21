import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:3000'

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
        workbox: {
          runtimeCaching: [
            {
              urlPattern: ({ url }: { url: URL }) =>
                ['/todos', '/users'].some(p => url.pathname.startsWith(p)),
              handler: 'NetworkFirst' as const,
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: 'TodoList',
          short_name: 'Todos',
          description: 'Your personal todo manager',
          theme_color: '#0B1437',
          background_color: '#0B1437',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: 'pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
            { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    server: {
      proxy: {
        '/auth':  apiUrl,
        '/todos': apiUrl,
        '/users': apiUrl,
      },
    },
  }
})
