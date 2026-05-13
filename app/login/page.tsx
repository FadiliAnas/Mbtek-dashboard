import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  const cookieStore = await cookies()
  const session = cookieStore.get('mbtek_dash_session')
  const password = process.env.DASHBOARD_PASSWORD

  if (session && password && session.value === password) {
    redirect(from ?? '/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A1A]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#F26522] rounded-sm" />
            <span className="text-white font-bold text-xl">MBtek</span>
          </div>
          <p className="text-gray-400 text-sm">Executive Dashboard</p>
        </div>

        <form action="/api/auth/login" method="POST" className="bg-[#222] rounded-xl p-8 border border-gray-800">
          <h1 className="text-white text-lg font-semibold mb-6">Sign in</h1>

          <input type="hidden" name="from" value={from ?? '/dashboard'} />

          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">Password</label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="w-full bg-[#333] text-white border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#F26522] transition-colors"
              placeholder="Enter dashboard password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#F26522] hover:bg-[#d4561e] text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  )
}
