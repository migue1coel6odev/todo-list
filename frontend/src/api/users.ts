import type { User } from '../types'
import { apiFetch } from './client'

export const getMe = (id: number) => apiFetch<User>(`/users/${id}`)
