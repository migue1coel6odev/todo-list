import { useEffect, useState } from 'react'
import { Plus, Trash2, UserPlus, X, ChevronDown, ChevronUp, LogOut } from 'lucide-react'
import type { Category, UserRoster } from '../types'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  addCategoryMember,
  removeCategoryMember,
  getUserRoster,
} from '../api/categories'
import { useAuth } from '../context/AuthContext'

export default function CategoriesManageView() {
  const { auth } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [roster, setRoster] = useState<UserRoster[]>([])
  const [newName, setNewName] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [addingMemberFor, setAddingMemberFor] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error)
    getUserRoster().then(setRoster).catch(console.error)
  }, [])

  const mine = categories.filter(c => c.owner_id === auth?.sub)
  const sharedWithMe = categories.filter(c => c.owner_id !== auth?.sub)

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const cat = await createCategory(newName.trim())
      setCategories(prev => [...prev, cat])
      setNewName('')
    } catch (err) {
      console.error(err)
    }
  }

  async function handleRename(id: number) {
    if (!editName.trim()) return
    try {
      const updated = await updateCategory(id, editName.trim())
      setCategories(prev => prev.map(c => c.id === id ? updated : c))
      setEditingId(null)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCategory(id)
      setCategories(prev => prev.filter(c => c.id !== id))
      if (expanded === id) setExpanded(null)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleAddMember(categoryId: number) {
    const userId = parseInt(selectedUserId)
    if (!userId) return
    try {
      const updated = await addCategoryMember(categoryId, userId)
      setCategories(prev => prev.map(c => c.id === categoryId ? updated : c))
      setAddingMemberFor(null)
      setSelectedUserId('')
    } catch (err) {
      console.error(err)
    }
  }

  async function handleRemoveMember(categoryId: number, userId: number) {
    try {
      await removeCategoryMember(categoryId, userId)
      setCategories(prev => prev.map(c =>
        c.id === categoryId
          ? { ...c, members: c.members.filter(m => m.user_id !== userId), is_shared: c.members.length > 1 }
          : c,
      ))
    } catch (err) {
      console.error(err)
    }
  }

  async function handleLeave(categoryId: number) {
    if (!auth) return
    try {
      await removeCategoryMember(categoryId, auth.sub)
      setCategories(prev => prev.filter(c => c.id !== categoryId))
    } catch (err) {
      console.error(err)
    }
  }

  // Members that can still be added (not yet in this category, not the owner)
  function eligibleMembers(cat: Category) {
    const existingIds = new Set(cat.members.map(m => m.user_id))
    existingIds.add(cat.owner_id)
    return roster.filter(u => !existingIds.has(u.id))
  }

  return (
    <div className="px-5 flex flex-col gap-6">

      {/* Create new category */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
        />
        <button
          type="submit"
          className="w-12 h-12 rounded-xl bg-purple flex items-center justify-center shrink-0 active:bg-purple/80"
        >
          <Plus size={18} className="text-white" />
        </button>
      </form>

      {/* My categories */}
      {mine.length > 0 && (
        <section>
          <p className="text-xs text-muted uppercase tracking-widest mb-3">My Categories</p>
          <div className="flex flex-col gap-2">
            {mine.map(cat => (
              <div key={cat.id} className="bg-card2 rounded-2xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {editingId === cat.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                      onBlur={() => handleRename(cat.id)}
                      className="flex-1 bg-transparent text-white text-sm outline-none border-b border-purple"
                    />
                  ) : (
                    <button
                      className="flex-1 text-left text-white text-sm font-medium"
                      onClick={() => { setEditingId(cat.id); setEditName(cat.name) }}
                    >
                      {cat.name}
                      {cat.is_shared && (
                        <span className="ml-2 text-[10px] text-purple font-normal">shared</span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => setExpanded(prev => prev === cat.id ? null : cat.id)}
                    className="text-muted hover:text-white transition-colors"
                  >
                    {expanded === cat.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="text-muted hover:text-pink transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Expanded: members */}
                {expanded === cat.id && (
                  <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-2">
                    {cat.members.length === 0 ? (
                      <p className="text-xs text-muted">No members yet. Add someone below.</p>
                    ) : (
                      cat.members.map(m => (
                        <div key={m.user_id} className="flex items-center justify-between">
                          <span className="text-sm text-white">{m.nickname}</span>
                          <button
                            onClick={() => handleRemoveMember(cat.id, m.user_id)}
                            className="text-muted hover:text-pink transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}

                    {addingMemberFor === cat.id ? (
                      <div className="flex gap-2 mt-1">
                        <select
                          value={selectedUserId}
                          onChange={e => setSelectedUserId(e.target.value)}
                          className="flex-1 bg-card rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-purple"
                        >
                          <option value="">Select user…</option>
                          {eligibleMembers(cat).map(u => (
                            <option key={u.id} value={u.id}>{u.nickname}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddMember(cat.id)}
                          className="px-3 py-2 rounded-xl bg-purple text-white text-xs font-semibold"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingMemberFor(null); setSelectedUserId('') }}
                          className="text-muted hover:text-white"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      eligibleMembers(cat).length > 0 && (
                        <button
                          onClick={() => setAddingMemberFor(cat.id)}
                          className="flex items-center gap-2 text-xs text-purple mt-1"
                        >
                          <UserPlus size={13} />
                          Add member
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shared with me */}
      {sharedWithMe.length > 0 && (
        <section>
          <p className="text-xs text-muted uppercase tracking-widest mb-3">Shared With Me</p>
          <div className="flex flex-col gap-2">
            {sharedWithMe.map(cat => (
              <div key={cat.id} className="bg-card2 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{cat.name}</p>
                  <p className="text-muted text-xs mt-0.5">by {cat.owner_nickname}</p>
                </div>
                <button
                  onClick={() => handleLeave(cat.id)}
                  className="text-muted hover:text-pink transition-colors flex items-center gap-1.5 text-xs"
                >
                  <LogOut size={14} />
                  Leave
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {categories.length === 0 && (
        <p className="text-center text-muted text-sm py-8">
          No categories yet. Create one above.
        </p>
      )}
    </div>
  )
}
