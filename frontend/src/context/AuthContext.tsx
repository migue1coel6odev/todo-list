import { createContext, useContext, useState, type ReactNode } from 'react'

interface AuthPayload {
  token: string
  sub: number
  role: string
  nickname: string
}

interface AuthContextValue {
  auth: AuthPayload | null
  signIn: (token: string) => void
  signOut: () => void
}

function parseToken(token: string): Omit<AuthPayload, 'nickname'> {
  const payload = JSON.parse(atob(token.split('.')[1]!))
  return { token, sub: payload.sub as number, role: payload.role as string }
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthPayload | null>(() => {
    const token = localStorage.getItem('token')
    const nickname = localStorage.getItem('nickname') ?? ''
    if (!token) return null
    try {
      return { ...parseToken(token), nickname }
    } catch {
      return null
    }
  })

  function signIn(token: string) {
    localStorage.setItem('token', token)
    const parsed = parseToken(token)
    const nickname = localStorage.getItem('nickname') ?? ''
    setAuth({ ...parsed, nickname })
  }

  function signOut() {
    localStorage.removeItem('token')
    localStorage.removeItem('nickname')
    setAuth(null)
  }

  return <AuthContext value={{ auth, signIn, signOut }}>{children}</AuthContext>
}

export const useAuth = () => useContext(AuthContext)
