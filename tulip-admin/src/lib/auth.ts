export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
}

export function setToken(token: string): void {
  localStorage.setItem('admin_token', token)
}

export function setAdmin(admin: object): void {
  localStorage.setItem('admin_user', JSON.stringify(admin))
}

export function getAdmin(): { id: string; email: string; name: string } | null {
  try {
    const stored = localStorage.getItem('admin_user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function clearAuth(): void {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
