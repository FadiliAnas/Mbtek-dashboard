import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'mbtek_dash_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Login page and auth API always pass through
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Cron / manual sync — allow if Authorization header matches CRON_SECRET
  if (pathname === '/api/sync') {
    const auth = request.headers.get('authorization')
    const secret = process.env.CRON_SECRET
    if (!secret || auth === `Bearer ${secret}`) {
      return NextResponse.next()
    }
  }

  // All other routes require a valid session cookie
  const session = request.cookies.get(SESSION_COOKIE)
  const password = process.env.DASHBOARD_PASSWORD

  if (!session || !password || session.value !== password) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const proxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
