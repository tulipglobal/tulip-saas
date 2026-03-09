import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const isDonorSubdomain = host.startsWith('donor.')

  if (!isDonorSubdomain) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Already on a /donor/* path — allow through
  if (pathname.startsWith('/donor')) return NextResponse.next()

  // Allow public pages that donors might need
  if (pathname.startsWith('/verify') || pathname.startsWith('/accept-invite')) {
    return NextResponse.next()
  }

  // Allow static assets, _next, api routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/embed') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Redirect everything else on donor subdomain to /donor/*
  // / → /donor/login
  // /login → /donor/login
  // /dashboard → /donor/dashboard
  const donorPath = pathname === '/' || pathname === '/login'
    ? '/donor/login'
    : pathname === '/dashboard'
      ? '/donor/dashboard'
      : `/donor/login`

  const url = request.nextUrl.clone()
  url.pathname = donorPath
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
