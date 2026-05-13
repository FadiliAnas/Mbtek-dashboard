import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const password = formData.get('password') as string
  const from = (formData.get('from') as string) || '/dashboard'
  const expected = process.env.DASHBOARD_PASSWORD

  const base = new URL(request.url).origin

  if (!expected || password !== expected) {
    return NextResponse.redirect(`${base}/login?error=1`)
  }

  const response = NextResponse.redirect(`${base}${from}`)
  response.cookies.set('mbtek_dash_session', expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return response
}
