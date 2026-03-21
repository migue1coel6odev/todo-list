const BASE_URL = ''

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status })
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
