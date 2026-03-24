import type { CreateTodo, Todo } from '../types'

export type QueuedOp =
  | { type: 'create'; tempId: number; data: CreateTodo }
  | { type: 'update'; id: number; data: Partial<CreateTodo & { status: Todo['status'] }> }
  | { type: 'delete'; id: number }

const KEY = 'todo_offline_queue'

export function getQueue(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function enqueue(op: QueuedOp) {
  const q = getQueue()
  // Collapse redundant ops: delete cancels any pending create/update for same id
  if (op.type === 'delete') {
    const filtered = q.filter(o => {
      if (o.type === 'create' && o.tempId === op.id) return false
      if ((o.type === 'update') && o.id === op.id) return false
      return true
    })
    // if a pending create was removed, the item never reached the server — no need to enqueue the delete
    if (q.find(o => o.type === 'create' && o.tempId === op.id)) {
      localStorage.setItem(KEY, JSON.stringify(filtered))
      return
    }
    localStorage.setItem(KEY, JSON.stringify([...filtered, op]))
    return
  }
  localStorage.setItem(KEY, JSON.stringify([...q, op]))
}

export function clearQueue() {
  localStorage.removeItem(KEY)
}

/** Remove the first item from the queue (call after each successfully synced op) */
export function dequeueFirst() {
  const q = getQueue()
  if (q.length === 0) return
  localStorage.setItem(KEY, JSON.stringify(q.slice(1)))
}

/** Returns a temporary negative ID for offline-created todos */
export function tempId() {
  return -Date.now()
}
