import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Todo } from '../types'
import TaskItem from './TaskItem'

interface Props {
  query: string
  onChange: (q: string) => void
  onClose: () => void
  todos: Todo[]
  onToggle: (todo: Todo) => void
  onDelete: (id: number) => void
}

export default function SearchOverlay({ query, onChange, onClose, todos, onToggle, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = query.trim()
    ? todos.filter(t => t.title.toLowerCase().includes(query.toLowerCase())
        || t.category?.toLowerCase().includes(query.toLowerCase()))
    : []

  return (
    <div className="fixed inset-0 z-40 bg-navy flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-header-safe pb-4">
        <input
          ref={inputRef}
          value={query}
          onChange={e => onChange(e.target.value)}
          placeholder="Search tasks…"
          className="flex-1 bg-card rounded-xl px-4 py-3 text-white text-sm
            placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
        />
        <button onClick={onClose} className="text-muted hover:text-white p-1">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-3">
        {query.trim() && results.length === 0 && (
          <p className="text-muted text-sm text-center mt-10">No tasks found.</p>
        )}
        {results.map(todo => (
          <TaskItem key={todo.id} todo={todo}
            onToggle={() => onToggle(todo)}
            onDelete={() => onDelete(todo.id)}
          />
        ))}
      </div>
    </div>
  )
}
