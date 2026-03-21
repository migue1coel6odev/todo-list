import { Trash2, RefreshCw } from 'lucide-react'
import type { Todo } from '../types'
import { describeCron } from '../utils/cron'

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
    <div className="flex items-start gap-4 px-4 py-3 rounded-2xl bg-card2 group w-full">
      <button
        onClick={onToggle}
        className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
          ${statusColor[todo.status]}`}
      >
        {done && (
          <svg viewBox="0 0 10 8" className="w-3 h-3 fill-none stroke-white stroke-2">
            <polyline points="1,4 4,7 9,1" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${done ? 'line-through text-muted' : 'text-white'}`}>
          {todo.title}
        </span>
        {todo.category && (
          <span className="ml-2 text-xs text-purple font-normal">#{todo.category}</span>
        )}
        {todo.is_recurrent && todo.recurrency && (
          <p className="flex items-center gap-1 text-[11px] text-muted mt-0.5">
            <RefreshCw size={10} className="shrink-0" />
            {describeCron(todo.recurrency)}
          </p>
        )}
      </div>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted hover:text-pink transition-all mt-0.5 shrink-0"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
