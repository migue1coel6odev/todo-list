import type { CreateTodo, Todo } from '../types'
import { apiFetch } from './client'

export const getTodos = () => apiFetch<Todo[]>('/todos')

export const createTodo = (data: CreateTodo) =>
  apiFetch<Todo>('/todos', { method: 'POST', body: JSON.stringify(data) })

export const updateTodo = (id: number, data: Partial<CreateTodo & { status: Todo['status'] }>) =>
  apiFetch<Todo>(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteTodo = (id: number) =>
  apiFetch<void>(`/todos/${id}`, { method: 'DELETE' })
