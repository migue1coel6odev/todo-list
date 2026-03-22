import type { Todo } from '../types'
import TaskItem from './TaskItem'

interface Props {
  todos: Todo[]
  onToggle: (todo: Todo) => void
  onDelete: (id: number) => void
}

const STATUS_COLOR: Record<Todo['status'], string> = {
  TODO:    'bg-purple/20 text-purple',
  DONE:    'bg-pink/20 text-pink',
  ON_HOLD: 'bg-yellow-400/20 text-yellow-400',
  BLOCKED: 'bg-red-400/20 text-red-400',
}

export default function CategoriesView({ todos, onToggle, onDelete }: Props) {
  const uncategorized = todos.filter(t => !t.category_id)
  const categoryNames = [
    ...new Set(todos.filter(t => t.category_name).map(t => t.category_name!)),
  ]

  const groups = [
    ...categoryNames.map(name => ({
      name,
      items: todos.filter(t => t.category_name === name),
    })),
    ...(uncategorized.length ? [{ name: 'Uncategorized', items: uncategorized }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      {groups.map(group => {
        const done = group.items.filter(t => t.status === 'DONE').length
        return (
          <section key={group.name}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted uppercase tracking-widest">{group.name}</p>
              <span className="text-xs text-muted">{done}/{group.items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {group.items.map(todo => (
                <div key={todo.id} className="flex items-center gap-2">
                  <TaskItem
                    todo={todo}
                    onToggle={() => onToggle(todo)}
                    onDelete={() => onDelete(todo.id)}
                  />
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[todo.status]}`}>
                    {todo.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
