import { getToken, clearToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401 && typeof window !== 'undefined') {
    clearToken()
    window.location.href = '/login'
  }

  return res
}

export function apiGet(path: string) {
  return apiFetch(path, { method: 'GET' })
}

export function apiPost(path: string, body: object) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPut(path: string, body: object) {
  return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) })
}
