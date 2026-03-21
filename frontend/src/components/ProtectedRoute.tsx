import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { auth } = useAuth()
  return auth ? <>{children}</> : <Navigate to="/login" replace />
}
