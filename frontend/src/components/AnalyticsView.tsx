import type { Todo } from '../types'

interface Props { todos: Todo[] }

const STATUSES: { key: Todo['status']; label: string; color: string }[] = [
  { key: 'TODO',    label: 'To Do',    color: 'bg-purple' },
  { key: 'DONE',    label: 'Done',     color: 'bg-pink'   },
  { key: 'ON_HOLD', label: 'On Hold',  color: 'bg-yellow-400' },
  { key: 'BLOCKED', label: 'Blocked',  color: 'bg-red-400'   },
]

export default function AnalyticsView({ todos }: Props) {
  const total = todos.length
  const categories = [...new Set(todos.map(t => t.category).filter(Boolean))] as string[]

  return (
    <div className="flex flex-col gap-6">
      {/* summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card2 rounded-2xl p-4">
          <p className="text-3xl font-bold text-white">{total}</p>
          <p className="text-xs text-muted mt-1">Total tasks</p>
        </div>
        <div className="bg-card2 rounded-2xl p-4">
          <p className="text-3xl font-bold text-pink">
            {todos.filter(t => t.status === 'DONE').length}
          </p>
          <p className="text-xs text-muted mt-1">Completed</p>
        </div>
        <div className="bg-card2 rounded-2xl p-4">
          <p className="text-3xl font-bold text-purple">
            {todos.filter(t => t.is_recurrent).length}
          </p>
          <p className="text-xs text-muted mt-1">Recurring</p>
        </div>
        <div className="bg-card2 rounded-2xl p-4">
          <p className="text-3xl font-bold text-yellow-400">
            {todos.filter(t => t.status === 'BLOCKED' || t.status === 'ON_HOLD').length}
          </p>
          <p className="text-xs text-muted mt-1">Blocked / On hold</p>
        </div>
      </div>

      {/* status breakdown */}
      <section>
        <p className="text-xs text-muted uppercase tracking-widest mb-3">By Status</p>
        <div className="flex flex-col gap-3">
          {STATUSES.map(({ key, label, color }) => {
            const count = todos.filter(t => t.status === key).length
            const pct = total ? Math.round((count / total) * 100) : 0
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/70">{label}</span>
                  <span className="text-muted">{count} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-card2 overflow-hidden">
                  <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* category breakdown */}
      {categories.length > 0 && (
        <section>
          <p className="text-xs text-muted uppercase tracking-widest mb-3">By Category</p>
          <div className="flex flex-col gap-2">
            {categories.map(cat => {
              const count = todos.filter(t => t.category === cat).length
              const done  = todos.filter(t => t.category === cat && t.status === 'DONE').length
              return (
                <div key={cat} className="flex items-center justify-between bg-card2 px-4 py-3 rounded-xl">
                  <span className="text-sm text-white font-medium">#{cat}</span>
                  <span className="text-xs text-muted">{done}/{count} done</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
