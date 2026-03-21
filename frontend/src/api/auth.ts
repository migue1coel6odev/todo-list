import { apiFetch } from './client'

export const login = (email: string, password: string) =>
  apiFetch<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
