const API_URL = process.env.NEXT_PUBLIC_API_URL

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
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

export function apiDelete(path: string, body?: object) {
  return apiFetch(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) })
}

export function apiUpload(path: string, file: File, fieldName = 'file') {
  const token = getToken()
  const formData = new FormData()
  formData.append(fieldName, file)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData })
}
