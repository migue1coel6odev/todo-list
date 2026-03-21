import { useEffect, useState } from 'react'
import { Menu, Search, Bell, Plus } from 'lucide-react'
import { getTodos, updateTodo, deleteTodo, createTodo } from '../api/todos'
import type { Todo, CreateTodo } from '../types'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import CategoryCard from '../components/CategoryCard'
import TaskItem from '../components/TaskItem'
import AddTodoModal from '../components/AddTodoModal'

export default function OverviewPage() {
  const { auth } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    getTodos().then(setTodos).catch(console.error)
  }, [])

  // derive categories from todos
  const categories = [...new Set(todos.map(t => t.category).filter(Boolean))] as string[]

  const filtered = activeCategory
    ? todos.filter(t => t.category === activeCategory)
    : todos

  async function handleToggle(todo: Todo) {
    const next = todo.status === 'DONE' ? 'TODO' : 'DONE'
    const updated = await updateTodo(todo.id, { status: next })
    setTodos(prev => prev.map(t => (t.id === todo.id ? updated : t)))
  }

  async function handleDelete(id: number) {
    await deleteTodo(id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function handleAdd(data: CreateTodo) {
    const todo = await createTodo(data)
    setTodos(prev => [...prev, todo])
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="flex flex-col min-h-dvh pb-24">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* top bar */}
      <header className="flex items-center justify-between px-5 pt-10 pb-2">
        <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-4 text-muted">
          <button className="hover:text-white transition-colors"><Search size={20} /></button>
          <button className="hover:text-white transition-colors relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink" />
          </button>
        </div>
      </header>

      {/* greeting */}
      <div className="px-5 mt-6 mb-8">
        <p className="text-muted text-sm">{greeting()},</p>
        <h1 className="text-white text-2xl font-bold">{auth?.nickname ?? 'there'}!</h1>
      </div>

      {/* categories */}
      {categories.length > 0 && (
        <section className="mb-8">
          <p className="px-5 text-xs text-muted uppercase tracking-widest mb-3">Categories</p>
          <div className="flex gap-3 px-5 overflow-x-auto scrollbar-none pb-1">
            {categories.map(cat => (
              <CategoryCard
                key={cat}
                name={cat}
                count={todos.filter(t => t.category === cat).length}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(prev => (prev === cat ? null : cat))}
              />
            ))}
          </div>
        </section>
      )}

      {/* tasks */}
      <section className="px-5 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted uppercase tracking-widest">
            {activeCategory ? activeCategory : "Today's tasks"}
          </p>
          <span className="text-xs text-purple font-medium">{filtered.length} tasks</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
            <span className="text-4xl">✓</span>
            <p>All done! Add a new task.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(todo => (
              <TaskItem
                key={todo.id}
                todo={todo}
                onToggle={() => handleToggle(todo)}
                onDelete={() => handleDelete(todo.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* FAB */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full flex items-center justify-center
          bg-pink shadow-lg shadow-pink/40 active:scale-95 transition-transform z-10"
      >
        <Plus size={26} className="text-white" />
      </button>

      {modalOpen && <AddTodoModal onClose={() => setModalOpen(false)} onAdd={handleAdd} />}
    </div>
  )
}
