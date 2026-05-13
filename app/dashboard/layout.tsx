import { DashboardNav } from '@/components/DashboardNav'
import { dbGetLastSync } from '@/lib/db'

async function LastSynced() {
  try {
    const ts = await dbGetLastSync()
    if (!ts) return <span className="text-xs text-gray-400">Not yet synced</span>
    const d = new Date(ts)
    const label = d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZone: 'America/New_York',
    })
    return <span className="text-xs text-gray-400">Last synced: {label} ET</span>
  } catch {
    return <span className="text-xs text-gray-400">Data refreshes daily</span>
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/mbtek-logo.png" alt="MBtek" className="h-8 w-auto" />
            <span className="text-gray-400 text-sm">Executive Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <LastSynced />
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <DashboardNav />

      {/* Page content */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
