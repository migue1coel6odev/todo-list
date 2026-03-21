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
    // if a pending create was removed, no need to enqueue the delete either
    if (filtered.length < q.length && !q.find(o => o.type === 'create' && o.tempId === op.id)) {
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

/** Returns a temporary negative ID for offline-created todos */
export function tempId() {
  return -Date.now()
}
