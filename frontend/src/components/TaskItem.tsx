import { Trash2 } from 'lucide-react'
import type { Todo } from '../types'

interface Props {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
}

const statusColor: Record<Todo['status'], string> = {
  TODO:     'border-muted',
  DONE:     'border-pink bg-pink',
  ON_HOLD:  'border-yellow-400',
  BLOCKED:  'border-red-400',
}

export default function TaskItem({ todo, onToggle, onDelete }: Props) {
  const done = todo.status === 'DONE'

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-card2 group">
      <button
        onClick={onToggle}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
          ${statusColor[todo.status]}`}
      >
        {done && (
          <svg viewBox="0 0 10 8" className="w-3 h-3 fill-none stroke-white stroke-2">
            <polyline points="1,4 4,7 9,1" />
          </svg>
        )}
      </button>

      <span className={`flex-1 text-sm font-medium text-left ${done ? 'line-through text-muted' : 'text-white'}`}>
        {todo.title}
        {todo.category && (
          <span className="ml-2 text-xs text-purple font-normal">#{todo.category}</span>
        )}
      </span>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted hover:text-pink transition-all"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
