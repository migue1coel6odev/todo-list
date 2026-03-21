import { useEffect, useState } from 'react'
import type { Todo } from '../types'
import { matchesToday } from '../utils/cron'

const todayKey = () => new Date().toISOString().split('T')[0]!

function alreadyNotified(id: number) {
  return localStorage.getItem(`notified_${id}_${todayKey()}`) === '1'
}
function markNotified(id: number) {
  localStorage.setItem(`notified_${id}_${todayKey()}`, '1')
}

function showNotification(todo: Todo) {
  if (Notification.permission !== 'granted') return
  new Notification('Recurring task due today', {
    body: todo.title,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: `todo-${todo.id}`,
  })
  markNotified(todo.id)
}

function checkTodos(todos: Todo[]) {
  if (Notification.permission !== 'granted') return
  todos
    .filter(t => t.is_recurrent && t.recurrency && t.status !== 'DONE')
    .forEach(todo => {
      if (!alreadyNotified(todo.id) && matchesToday(todo.recurrency!)) {
        showNotification(todo)
      }
    })
}

export type NotificationState = 'unsupported' | 'granted' | 'denied' | 'prompt'

export function useNotifications(todos: Todo[]) {
  const [permission, setPermission] = useState<NotificationState>(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission as NotificationState
  })

  // Check todos whenever permission becomes granted or todos change
  useEffect(() => {
    if (permission !== 'granted') return
    checkTodos(todos)
    const id = setInterval(() => checkTodos(todos), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [permission, todos])

  // Must be called from a user gesture (button tap)
  async function requestPermission() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result as NotificationState)
  }

  return { permission, requestPermission }
}
