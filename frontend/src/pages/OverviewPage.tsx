import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Menu, Search, Bell, Plus, WifiOff, RefreshCw } from 'lucide-react'
import { getTodos, updateTodo, deleteTodo, createTodo } from '../api/todos'
import { getCategories } from '../api/categories'
import type { Category, CreateTodo, Todo } from '../types'
import { useAuth } from '../context/AuthContext'
import { matchesToday, nextOccurrence } from '../utils/cron'
import Sidebar, { type View } from '../components/Sidebar'
import TaskItem from '../components/TaskItem'
import AddTodoModal from '../components/AddTodoModal'
import SearchOverlay from '../components/SearchOverlay'
import CategoriesView from '../components/CategoriesView'
import CategoriesManageView from '../components/CategoriesManageView'
import AnalyticsView from '../components/AnalyticsView'
import UsersView from '../components/UsersView'
import SettingsView from '../components/SettingsView'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { enqueue, getQueue, dequeueFirst, tempId, type QueuedOp } from '../utils/offlineQueue'

// Sort by urgency: non-recurring first, then recurring matching today, then by next occurrence.
// DONE always sinks to the bottom.
function sortByUrgency(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const aDone = a.status === 'DONE'
    const bDone = b.status === 'DONE'
    if (aDone !== bDone) return aDone ? 1 : -1
    if (aDone && bDone) return 0

    if (!a.is_recurrent && b.is_recurrent) return -1
    if (a.is_recurrent && !b.is_recurrent) return 1

    if (a.is_recurrent && b.is_recurrent) {
      const aToday = a.recurrency ? matchesToday(a.recurrency) : false
      const bToday = b.recurrency ? matchesToday(b.recurrency) : false
      if (aToday !== bToday) return aToday ? -1 : 1
      const aNext = a.recurrency ? (nextOccurrence(a.recurrency)?.getTime() ?? Infinity) : Infinity
      const bNext = b.recurrency ? (nextOccurrence(b.recurrency)?.getTime() ?? Infinity) : Infinity
      return aNext - bNext
    }

    return 0
  })
}

export default function OverviewPage() {
  const { auth } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<View>('overview')
  const [pendingOps, setPendingOps] = useState(() => getQueue().length)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const isOnline = useOnlineStatus()

  useEffect(() => {
    getTodos().then(setTodos).catch(console.error)
    getCategories().then(setCategories).catch(console.error)
  }, [])

  const sync = useCallback(async () => {
    if (syncingRef.current) return
    const queue = getQueue()
    if (queue.length === 0) return
    syncingRef.current = true
    setSyncing(true)
    const idMap = new Map<number, number>()
    for (const op of queue) {
      try {
        if (op.type === 'create') {
          const created = await createTodo(op.data)
          idMap.set(op.tempId, created.id)
          setTodos(prev => prev.map(t => t.id === op.tempId ? created : t))
        } else if (op.type === 'update') {
          const realId = idMap.get(op.id) ?? op.id
          const updated = await updateTodo(realId, op.data)
          setTodos(prev => prev.map(t => t.id === realId ? updated : t))
        } else if (op.type === 'delete') {
          const realId = idMap.get(op.id) ?? op.id
          await deleteTodo(realId)
        }
        dequeueFirst()
        setPendingOps(getQueue().length)
      } catch (err) {
        console.error('Sync failed at op', op, err)
        break
      }
    }
    syncingRef.current = false
    setSyncing(false)
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
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: next } : t))
    try {
      const updated = await updateTodo(todo.id, { status: next })
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
    } catch {
      track({ type: 'update', id: todo.id, data: { status: next } })
    }
  }

  async function handleDelete(id: number) {
    setTodos(prev => prev.filter(t => t.id !== id))
    try {
      await deleteTodo(id)
    } catch {
      track({ type: 'delete', id })
    }
  }

  async function handleAdd(data: CreateTodo) {
    const tid = tempId()
    const cat = data.category_id ? categories.find(c => c.id === data.category_id) : null
    const optimistic: Todo = {
      id: tid,
      title: data.title,
      category_id: data.category_id ?? null,
      category_name: cat?.name ?? null,
      category_owner_id: cat?.owner_id ?? null,
      category_is_shared: cat?.is_shared ?? false,
      user_id: auth?.sub ?? null,
      is_recurrent: data.is_recurrent ?? false,
      recurrency: data.recurrency ?? null,
      status: data.status ?? 'TODO',
      last_completed_date: null,
    }
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

  // View-specific todo sets — memoized so sortByUrgency (which calls nextOccurrence) only
  // re-runs when the todos array actually changes, not on every unrelated render.
  const overviewTodos = useMemo(() => sortByUrgency(todos), [todos])
  const myTodos = useMemo(() => sortByUrgency(todos.filter(t => !t.category_is_shared)), [todos])
  const sharedTodos = useMemo(() => todos.filter(t => t.category_is_shared), [todos])
  const sharedCategoryNames = [...new Set(sharedTodos.map(t => t.category_name).filter(Boolean))] as string[]

  const blockedCount = todos.filter(t => t.status === 'BLOCKED' || t.status === 'ON_HOLD').length

  const viewTitle: Record<View, string> = {
    overview: '', 'my-tasks': 'My Tasks', shared: 'Shared', categories: 'Categories',
    analytics: 'Analytics', users: 'Users', settings: 'Settings',
  }

  const showFab = !['analytics', 'users', 'settings', 'categories'].includes(view)

  return (
    <div className="flex flex-col min-h-dvh pb-fab-safe">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={view}
        onNavigate={v => setView(v)}
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
            onClick={() => setView('settings')}
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

      {isOnline && syncing && (
        <div className="mx-5 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple/10 border border-purple/20">
          <RefreshCw size={16} className="text-purple shrink-0 animate-spin" />
          <p className="text-purple text-xs font-medium">Syncing offline changes…</p>
        </div>
      )}

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

      {/* ── Overview: all todos sorted by urgency ── */}
      {view === 'overview' && (
        <section className="px-5 flex-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted uppercase tracking-widest">Most urgent</p>
            <span className="text-xs text-purple font-medium">
              {overviewTodos.filter(t => t.status !== 'DONE').length} remaining
            </span>
          </div>
          {overviewTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
              <span className="text-4xl">✓</span>
              <p>All done! Add a new task.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {overviewTodos.map(todo => (
                <TaskItem key={todo.id} todo={todo}
                  onToggle={() => handleToggle(todo)}
                  onDelete={() => handleDelete(todo.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── My Tasks: private todos ── */}
      {view === 'my-tasks' && (
        <section className="px-5 flex-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted uppercase tracking-widest">Private tasks</p>
            <span className="text-xs text-purple font-medium">
              {myTodos.filter(t => t.status !== 'DONE').length} remaining
            </span>
          </div>
          {myTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
              <span className="text-4xl">✓</span>
              <p>No private tasks.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myTodos.map(todo => (
                <TaskItem key={todo.id} todo={todo}
                  onToggle={() => handleToggle(todo)}
                  onDelete={() => handleDelete(todo.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Shared: todos grouped by shared category ── */}
      {view === 'shared' && (
        <div className="px-5 flex-1">
          {sharedCategoryNames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
              <span className="text-4xl">🤝</span>
              <p>No shared categories yet.</p>
              <p className="text-xs text-center">Go to Categories to share one with teammates.</p>
            </div>
          ) : (
            <CategoriesView
              todos={sharedTodos}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {view === 'categories' && (
        <CategoriesManageView
          onChanged={() => {
            getCategories().then(setCategories).catch(console.error)
            getTodos().then(setTodos).catch(console.error)
          }}
        />
      )}

      {view === 'analytics' && (
        <div className="px-5"><AnalyticsView todos={todos} /></div>
      )}

      {view === 'users' && (
        <div className="px-5"><UsersView /></div>
      )}

      {view === 'settings' && <SettingsView />}

      {showFab && (
        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-fab-safe right-6 w-14 h-14 rounded-full flex items-center justify-center
            bg-pink shadow-lg shadow-pink/40 active:scale-95 transition-transform z-10"
        >
          <Plus size={26} className="text-white" />
        </button>
      )}

      {modalOpen && (
        <AddTodoModal
          categories={categories}
          onClose={() => setModalOpen(false)}
          onAdd={handleAdd}
          onCategoryCreated={cat => setCategories(prev => [...prev, cat])}
        />
      )}
    </div>
  )
}
