// src/lib/api.ts
// Global API helper — always sends Authorization: Bearer token from localStorage

const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null

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

  // If 401, clear tokens and redirect to login
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('tulip_token')
    localStorage.removeItem('tulip_refresh')
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

export function apiPatch(path: string, body: object) {
  return apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function apiDelete(path: string) {
  return apiFetch(path, { method: 'DELETE' })
}
