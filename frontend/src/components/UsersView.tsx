import { useEffect, useState } from 'react'
import { Plus, X, ShieldCheck, User as UserIcon } from 'lucide-react'
import { getUsers, createUser } from '../api/users'
import type { User } from '../types'

export default function UsersView() {
  const [users, setUsers] = useState<User[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error)
  }, [])

  function handleCreated(user: User) {
    setUsers(prev => [...prev, user])
    setModalOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {users.map(user => (
        <div key={user.id} className="flex items-center gap-4 bg-card2 px-4 py-3 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple to-pink
            flex items-center justify-center text-sm font-bold text-white shrink-0">
            {user.nickname.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.nickname}</p>
            <p className="text-muted text-xs truncate">{user.email}</p>
          </div>
          {user.role === 'ADMIN'
            ? <ShieldCheck size={16} className="text-pink shrink-0" />
            : <UserIcon size={16} className="text-muted shrink-0" />}
        </div>
      ))}

      {users.length === 0 && (
        <p className="text-muted text-sm text-center py-10">No users yet.</p>
      )}

      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-fab-safe right-6 w-14 h-14 rounded-full flex items-center justify-center
          bg-pink shadow-lg shadow-pink/40 active:scale-95 transition-transform z-10"
      >
        <Plus size={26} className="text-white" />
      </button>

      {modalOpen && <CreateUserModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </div>
  )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: User) => void }) {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<User['role']>('USER')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await createUser({ nickname, email, password, role })
      onCreated(user)
    } catch {
      setError('Failed to create user. Email or nickname may already exist.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60">
      <div className="w-full max-w-[430px] bg-card rounded-t-3xl p-6 pb-modal-safe">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">New User</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            autoFocus
            placeholder="Nickname"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            required
            className="w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
          />

          {/* role toggle */}
          <div className="flex gap-3">
            {(['USER', 'ADMIN'] as User['role'][]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all
                  ${role === r
                    ? 'bg-purple text-white shadow-lg shadow-purple/30'
                    : 'bg-card2 text-muted hover:text-white'}`}
              >
                {r === 'ADMIN' ? <ShieldCheck size={15} /> : <UserIcon size={15} />}
                {r}
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 rounded-xl font-semibold text-white text-sm
              bg-linear-to-r from-purple to-pink shadow-lg shadow-purple/30
              active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  )
}
