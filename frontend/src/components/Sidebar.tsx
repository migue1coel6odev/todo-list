import { X, LayoutGrid, Tag, BarChart2, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const { auth, signOut } = useAuth()
  const initials = auth?.nickname?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 z-20 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-30 flex flex-col
          bg-card px-6 py-10 transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-muted hover:text-white">
          <X size={20} />
        </button>

        {/* avatar */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold
            bg-gradient-to-br from-purple to-pink text-white ring-4 ring-purple/30">
            {initials}
          </div>
          <p className="text-white font-semibold text-lg">{auth?.nickname}</p>
          <span className="text-xs text-muted uppercase tracking-widest">{auth?.role}</span>
        </div>

        {/* nav */}
        <nav className="flex flex-col gap-2 flex-1">
          {[
            { icon: LayoutGrid, label: 'Overview' },
            { icon: Tag, label: 'Categories' },
            { icon: BarChart2, label: 'Analytics' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={onClose}
              className="flex items-center gap-4 px-4 py-3 rounded-xl text-muted hover:text-white hover:bg-card2 transition-colors"
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-pink transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </aside>
    </>
  )
}
