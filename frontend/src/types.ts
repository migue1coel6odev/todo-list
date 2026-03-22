export interface Todo {
  id: number
  title: string
  category_id: number | null
  category_name: string | null
  category_owner_id: number | null
  category_is_shared: boolean
  user_id: number | null
  is_recurrent: boolean
  recurrency: string | null
  status: 'TODO' | 'DONE' | 'ON_HOLD' | 'BLOCKED'
  last_completed_date: string | null
}

export interface CreateTodo {
  title: string
  category_id?: number
  is_recurrent?: boolean
  recurrency?: string
  status?: Todo['status']
}

export interface User {
  id: number
  nickname: string
  email: string
  role: 'ADMIN' | 'USER'
}

export interface UserRoster {
  id: number
  nickname: string
}

export interface Category {
  id: number
  name: string
  owner_id: number
  owner_nickname: string
  is_shared: boolean
  members: { user_id: number; nickname: string }[]
}
