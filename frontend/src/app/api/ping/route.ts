export const dynamic = 'force-dynamic'

export async function GET() {
  // Also verify the backend API is reachable
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'
    const res = await fetch(`${apiUrl}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
    })
    if (res.ok) {
      return new Response('ok', { status: 200 })
    }
    return new Response('api-down', { status: 502 })
  } catch {
    return new Response('api-unreachable', { status: 502 })
  }
}
