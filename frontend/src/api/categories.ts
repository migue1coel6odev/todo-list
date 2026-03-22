import type { Category, UserRoster } from '../types'
import { apiFetch } from './client'

export const getCategories = () => apiFetch<Category[]>('/categories')

export const createCategory = (name: string) =>
  apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify({ name }) })

export const updateCategory = (id: number, name: string) =>
  apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })

export const deleteCategory = (id: number) =>
  apiFetch<void>(`/categories/${id}`, { method: 'DELETE' })

export const addCategoryMember = (categoryId: number, userId: number) =>
  apiFetch<Category>(`/categories/${categoryId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })

export const removeCategoryMember = (categoryId: number, userId: number) =>
  apiFetch<void>(`/categories/${categoryId}/members/${userId}`, { method: 'DELETE' })

export const getUserRoster = () => apiFetch<UserRoster[]>('/users/roster')
