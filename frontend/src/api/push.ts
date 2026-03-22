import { apiFetch } from './client'

export const getVapidPublicKey = () =>
  apiFetch<{ publicKey: string }>('/push/vapid-public-key')

export const savePushSubscription = (data: {
  endpoint: string
  p256dh: string
  auth: string
}) =>
  apiFetch<void>('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const removePushSubscription = (endpoint: string) =>
  apiFetch<void>('/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })

export const sendTestPush = () =>
  apiFetch<void>('/push/test', { method: 'POST' })
