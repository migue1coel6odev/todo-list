import { useEffect } from 'react'
import type { Todo } from '../types'
import { matchesToday } from '../utils/cron'

const todayKey = () => new Date().toISOString().split('T')[0]!

function alreadyNotified(id: number) {
  return localStorage.getItem(`notified_${id}_${todayKey()}`) === '1'
}

function markNotified(id: number) {
  localStorage.setItem(`notified_${id}_${todayKey()}`, '1')
}

async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

function showNotification(todo: Todo) {
  new Notification('Recurring task due today', {
    body: todo.title,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: `todo-${todo.id}`,
  })
  markNotified(todo.id)
}

export function useNotifications(todos: Todo[]) {
  useEffect(() => {
    if (todos.length === 0) return

    let active = true

    async function check() {
      if (!active) return
      const granted = await requestPermission()
      if (!granted) return

      todos
        .filter(t => t.is_recurrent && t.recurrency && t.status !== 'DONE')
        .forEach(todo => {
          if (!alreadyNotified(todo.id) && matchesToday(todo.recurrency!)) {
            showNotification(todo)
          }
        })
    }

    check()
    const id = setInterval(check, 60 * 60 * 1000) // re-check every hour

    return () => { active = false; clearInterval(id) }
  }, [todos])
}
