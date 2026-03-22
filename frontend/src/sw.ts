/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ url }: { url: URL }) =>
    ['/todos', '/users', '/push'].some(p => url.pathname.startsWith(p)),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// Show notification when a push arrives (app may be closed)
self.addEventListener('push', (event: PushEvent) => {
  console.log('[sw] push received', event.data?.text())

  if (!event.data) {
    console.warn('[sw] push event has no data, ignoring')
    return
  }

  let data: { title?: string; body?: string; tag?: string } = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Todo reminder', body: event.data.text() }
  }

  console.log('[sw] showing notification', data)

  event.waitUntil(
    self.registration
      .showNotification(data.title ?? 'Todo reminder', {
        body: data.body ?? '',
        icon: '/pwa-192x192.png',
        tag: data.tag,
      })
      .then(() => console.log('[sw] notification shown'))
      .catch((e: unknown) => console.error('[sw] showNotification failed', e)),
  )
})

// Tap notification → open/focus the app
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        const existing = clientList.find(c => c.url.includes(self.location.origin))
        return existing ? existing.focus() : self.clients.openWindow('/')
      }),
  )
})
