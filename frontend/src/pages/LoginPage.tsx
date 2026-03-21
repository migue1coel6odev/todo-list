import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { getMe } from '../api/users'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await login(email, password)
      signIn(token)

      // fetch nickname after sign-in
      const payload = JSON.parse(atob(token.split('.')[1]!))
      const user = await getMe(payload.sub as number)
      localStorage.setItem('nickname', user.nickname)
      // patch auth state with nickname via re-signIn
      signIn(token)

      navigate('/', { replace: true })
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center px-6 py-12">
      {/* Logo / title */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
          bg-gradient-to-br from-purple to-pink mb-4 shadow-lg shadow-purple/30">
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Welcome back</h1>
        <p className="text-muted text-sm mt-1">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-card rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-muted
              outline-none focus:ring-2 focus:ring-purple transition-all"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-card rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-muted
              outline-none focus:ring-2 focus:ring-purple transition-all"
          />
        </div>

        {error && (
          <p className="text-sm text-center text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 py-4 rounded-xl font-semibold text-white
            bg-gradient-to-r from-purple to-pink shadow-lg shadow-purple/30
            active:scale-95 transition-all disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
