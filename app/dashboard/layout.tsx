import { Suspense } from 'react'
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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/mbtek-logo.png" alt="MBtek" className="h-8 w-auto" />
            <span className="text-gray-400 text-sm">Executive Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <LastSynced />
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <Suspense fallback={<NavFallback />}>
        <DashboardNav />
      </Suspense>

      <main className="max-w-screen-xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}

function NavFallback() {
  const tabs = ['Executive Summary', 'Sales Pipeline', 'Client Care', 'Calls', 'Lead Sources', 'Pipelines Audit']
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-screen-xl mx-auto px-6">
        <div className="flex items-center gap-0">
          {tabs.map(t => (
            <span key={t} className="whitespace-nowrap px-4 py-4 text-sm font-medium border-b-2 border-transparent text-gray-400">{t}</span>
          ))}
        </div>
      </div>
    </nav>
  )
}
