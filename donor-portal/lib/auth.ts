const TOKEN_KEY = 'donor_token'
const USER_KEY = 'donor_user'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  // Also set as cookie for middleware
  document.cookie = `donor_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  document.cookie = 'donor_token=; path=/; max-age=0'
}

export function getUser(): Record<string, string> | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(USER_KEY)
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export function setUser(user: Record<string, string>): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
