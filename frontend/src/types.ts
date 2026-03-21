export interface Todo {
  id: number
  title: string
  category: string | null
  user_id: number | null
  is_recurrent: boolean
  recurrency: string | null
  status: 'TODO' | 'DONE' | 'ON_HOLD' | 'BLOCKED'
}

export interface User {
  id: number
  nickname: string
  email: string
  role: 'ADMIN' | 'USER'
}

export interface CreateTodo {
  title: string
  category?: string
  is_recurrent?: boolean
  recurrency?: string
  status?: Todo['status']
}
