import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'mbtek_dash_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let login page and auth API through
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE)
  const password = process.env.DASHBOARD_PASSWORD

  if (!session || !password || session.value !== password) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
