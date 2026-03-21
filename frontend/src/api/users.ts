import type { User } from '../types'
import { apiFetch } from './client'

export const getMe = (id: number) => apiFetch<User>(`/users/${id}`)

export const getUsers = () => apiFetch<User[]>('/users')

export const createUser = (data: {
  nickname: string
  email: string
  password: string
  role: User['role']
}) => apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(data) })
