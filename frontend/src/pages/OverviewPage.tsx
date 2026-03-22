import { useCallback, useEffect, useState } from 'react'
import { Menu, Search, Bell, Plus, WifiOff, RefreshCw } from 'lucide-react'
import { getTodos, updateTodo, deleteTodo, createTodo } from '../api/todos'
import type { Todo, CreateTodo } from '../types'
import { useAuth } from '../context/AuthContext'
import Sidebar, { type View } from '../components/Sidebar'
import CategoryCard from '../components/CategoryCard'
import TaskItem from '../components/TaskItem'
import AddTodoModal from '../components/AddTodoModal'
import SearchOverlay from '../components/SearchOverlay'
import CategoriesView from '../components/CategoriesView'
import AnalyticsView from '../components/AnalyticsView'
import UsersView from '../components/UsersView'
import SettingsView from '../components/SettingsView'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { enqueue, getQueue, clearQueue, tempId, type QueuedOp } from '../utils/offlineQueue'

export default function OverviewPage() {
  const { auth } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<View>('overview')
  const [pendingOps, setPendingOps] = useState(() => getQueue().length)
  const [syncing, setSyncing] = useState(false)

  const isOnline = useOnlineStatus()

  useEffect(() => {
    getTodos().then(setTodos).catch(console.error)
  }, [])

  // Replay queued operations when back online
  const sync = useCallback(async () => {
    const queue = getQueue()
    if (queue.length === 0) return
    setSyncing(true)
    try {
      // id mapping: tempId → real server id (for creates)
      const idMap = new Map<number, number>()

      for (const op of queue) {
        if (op.type === 'create') {
          const created = await createTodo(op.data)
          idMap.set(op.tempId, created.id)
          // replace temp id in local state
          setTodos(prev => prev.map(t => t.id === op.tempId ? created : t))
        }
        if (op.type === 'update') {
          const realId = idMap.get(op.id) ?? op.id
          const updated = await updateTodo(realId, op.data)
          setTodos(prev => prev.map(t => t.id === realId ? updated : t))
        }
        if (op.type === 'delete') {
          const realId = idMap.get(op.id) ?? op.id
          await deleteTodo(realId)
        }
      }
      clearQueue()
      setPendingOps(0)
    } catch (err) {
      console.error('Sync failed', err)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (isOnline) sync()
  }, [isOnline, sync])

  function track(op: QueuedOp) {
    enqueue(op)
    setPendingOps(getQueue().length)
  }

  async function handleToggle(todo: Todo) {
    const next = todo.status === 'DONE' ? 'TODO' : 'DONE'
    // optimistic
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: next } : t))
    try {
      const updated = await updateTodo(todo.id, { status: next })
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
    } catch {
      track({ type: 'update', id: todo.id, data: { status: next } })
    }
  }

  async function handleDelete(id: number) {
    // optimistic
    setTodos(prev => prev.filter(t => t.id !== id))
    try {
      await deleteTodo(id)
    } catch {
      track({ type: 'delete', id })
    }
  }

  async function handleAdd(data: CreateTodo) {
    const tid = tempId()
    const optimistic: Todo = {
      id: tid, title: data.title, category: data.category ?? null,
      user_id: auth?.sub ?? null, is_recurrent: data.is_recurrent ?? false,
      recurrency: data.recurrency ?? null, status: data.status ?? 'TODO',
    }
    // optimistic
    setTodos(prev => [...prev, optimistic])
    try {
      const created = await createTodo(data)
      setTodos(prev => prev.map(t => t.id === tid ? created : t))
    } catch {
      track({ type: 'create', tempId: tid, data })
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const categories = [...new Set(todos.map(t => t.category).filter(Boolean))] as string[]
  const filtered = activeCategory ? todos.filter(t => t.category === activeCategory) : todos
  const blockedCount = todos.filter(t => t.status === 'BLOCKED' || t.status === 'ON_HOLD').length

  const viewTitle: Record<View, string> = {
    overview: '', categories: 'Categories', analytics: 'Analytics', users: 'Users', settings: 'Settings',
  }

  return (
    <div className="flex flex-col min-h-dvh pb-fab-safe">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={view}
        onNavigate={v => { setView(v); setActiveCategory(null) }}
      />

      {searchOpen && (
        <SearchOverlay
          query={searchQuery}
          onChange={setSearchQuery}
          onClose={() => { setSearchOpen(false); setSearchQuery('') }}
          todos={todos}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}

      {/* top bar */}
      <header className="flex items-center justify-between px-5 pt-header-safe pb-2">
        <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-4 text-muted">
          <button onClick={() => setSearchOpen(true)} className="hover:text-white transition-colors">
            <Search size={20} />
          </button>
          <button
            onClick={() => { setView('settings'); setActiveCategory(null) }}
            className="hover:text-white transition-colors relative"
          >
            <Bell size={20} />
            {blockedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink
                text-white text-[9px] font-bold flex items-center justify-center">
                {blockedCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* offline banner */}
      {!isOnline && (
        <div className="mx-5 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-yellow-400/10 border border-yellow-400/30">
          <WifiOff size={16} className="text-yellow-400 shrink-0" />
          <p className="text-yellow-400 text-xs font-medium flex-1">
            You're offline — changes will sync when reconnected
            {pendingOps > 0 && ` (${pendingOps} pending)`}
          </p>
        </div>
      )}

      {/* syncing banner */}
      {isOnline && syncing && (
        <div className="mx-5 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple/10 border border-purple/20">
          <RefreshCw size={16} className="text-purple shrink-0 animate-spin" />
          <p className="text-purple text-xs font-medium">Syncing offline changes…</p>
        </div>
      )}

      {/* pending ops badge (online, not syncing) */}
      {isOnline && !syncing && pendingOps > 0 && (
        <button
          onClick={sync}
          className="mx-5 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple/10 border border-purple/20"
        >
          <RefreshCw size={16} className="text-purple shrink-0" />
          <p className="text-purple text-xs font-medium flex-1">{pendingOps} change(s) pending sync</p>
          <span className="text-purple text-xs font-semibold">Sync now</span>
        </button>
      )}

      {/* page title */}
      <div className="px-5 mt-6 mb-8">
        {view === 'overview' ? (
          <>
            <p className="text-muted text-sm">{greeting()},</p>
            <h1 className="text-white text-2xl font-bold">{auth?.nickname ?? 'there'}!</h1>
          </>
        ) : (
          <h1 className="text-white text-2xl font-bold">{viewTitle[view]}</h1>
        )}
      </div>

      {view === 'overview' && (
        <>
          {categories.length > 0 && (
            <section className="mb-8">
              <p className="px-5 text-xs text-muted uppercase tracking-widest mb-3">Categories</p>
              <div className="flex gap-3 px-5 overflow-x-auto scrollbar-none pb-1">
                {categories.map(cat => (
                  <CategoryCard key={cat} name={cat}
                    count={todos.filter(t => t.category === cat).length}
                    active={activeCategory === cat}
                    onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
                  />
                ))}
              </div>
            </section>
          )}
          <section className="px-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted uppercase tracking-widest">
                {activeCategory ?? "Today's tasks"}
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
                  <TaskItem key={todo.id} todo={todo}
                    onToggle={() => handleToggle(todo)}
                    onDelete={() => handleDelete(todo.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {view === 'categories' && (
        <div className="px-5">
          <CategoriesView todos={todos} onToggle={handleToggle} onDelete={handleDelete} />
        </div>
      )}

      {view === 'analytics' && (
        <div className="px-5"><AnalyticsView todos={todos} /></div>
      )}

      {view === 'users' && (
        <div className="px-5"><UsersView /></div>
      )}

      {view === 'settings' && (
        <SettingsView />
      )}

      {view !== 'analytics' && view !== 'users' && view !== 'settings' && (
        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-fab-safe right-6 w-14 h-14 rounded-full flex items-center justify-center
            bg-pink shadow-lg shadow-pink/40 active:scale-95 transition-transform z-10"
        >
          <Plus size={26} className="text-white" />
        </button>
      )}

      {modalOpen && <AddTodoModal onClose={() => setModalOpen(false)} onAdd={handleAdd} />}
    </div>
  )
}
