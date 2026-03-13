export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  }

  // Verify the backend API is reachable
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${apiUrl}/`, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      return new Response('ok', { status: 200, headers })
    }
    return new Response('api-down', { status: 502, headers })
  } catch {
    return new Response('api-unreachable', { status: 502, headers })
  }
}
