import { useEffect, useState } from 'react'
import { getVapidPublicKey, savePushSubscription, removePushSubscription } from '../api/push'

/** Convert a base64url VAPID public key to the Uint8Array expected by pushManager.subscribe */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export type PushState = 'unsupported' | 'loading' | 'prompt' | 'subscribed' | 'denied'

export function useNotifications() {
  const [state, setState] = useState<PushState>('loading')

  // On mount: check current subscription status
  useEffect(() => {
    if (!isPushSupported()) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setState(sub ? 'subscribed' : 'prompt'))
      .catch(() => setState('prompt'))
  }, [])

  /** Called from a user gesture — requests permission, subscribes, saves to backend */
  async function subscribe() {
    if (!isPushSupported()) return
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'prompt')
        return
      }

      const { publicKey } = await getVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = sub.toJSON()
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.['p256dh'] ?? '',
        auth:   json.keys?.['auth']   ?? '',
      })

      setState('subscribed')
    } catch (e) {
      console.error('[push] subscribe failed:', e)
      setState('prompt')
    }
  }

  async function unsubscribe() {
    if (!isPushSupported()) return
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('prompt')
    } catch (e) {
      console.error('[push] unsubscribe failed:', e)
      setState('subscribed')
    }
  }

  return { state, subscribe, unsubscribe }
}
