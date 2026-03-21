import { useState } from 'react'
import { X } from 'lucide-react'
import type { CreateTodo } from '../types'

interface Props {
  onClose: () => void
  onAdd: (data: CreateTodo) => void
}

export default function AddTodoModal({ onClose, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [recurrency, setRecurrency] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      category: category.trim() || undefined,
      is_recurrent: isRecurrent,
      recurrency: isRecurrent && recurrency.trim() ? recurrency.trim() : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60">
      <div className="w-full max-w-[430px] bg-card rounded-t-3xl p-6 pb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">New Task</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            autoFocus
            placeholder="Task title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
          />

          <input
            placeholder="Category (optional)"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
          />

          <label className="flex items-center gap-3 px-1 cursor-pointer">
            <div
              onClick={() => setIsRecurrent(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isRecurrent ? 'bg-purple' : 'bg-card2'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isRecurrent ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-muted">Recurring task</span>
          </label>

          {isRecurrent && (
            <input
              placeholder="Recurrence (e.g. daily, weekly)"
              value={recurrency}
              onChange={e => setRecurrency(e.target.value)}
              className="w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
            />
          )}

          <button
            type="submit"
            className="mt-2 w-full py-3 rounded-xl font-semibold text-white text-sm
              bg-gradient-to-r from-purple to-pink shadow-lg shadow-purple/30
              active:scale-95 transition-transform"
          >
            Add Task
          </button>
        </form>
      </div>
    </div>
  )
}
