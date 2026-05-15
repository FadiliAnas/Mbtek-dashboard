import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { CallsFilterView } from '@/components/CallsFilterView'
import type { CallsSnapshot } from '@/components/CallsFilterView'

export const revalidate = 1800

const PERIOD_KEYS = ['today', 'yesterday', 'last_week', 'last_month', 'last_3months'] as const

async function CallsData() {
  const snapshots: Record<string, CallsSnapshot> = {}

  await Promise.all(
    PERIOD_KEYS.map(async (period) => {
      const { data, error } = await supabase.storage
        .from('analytics-cache')
        .download(`snapshots/${period}.json`)
      if (error || !data) return
      try {
        const text = await data.text()
        snapshots[period] = JSON.parse(text) as CallsSnapshot
      } catch {
        // skip malformed snapshots
      }
    })
  )

  if (Object.keys(snapshots).length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-sm font-medium">No analytics data yet.</p>
        <p className="text-gray-400 text-xs mt-2">
          Data syncs daily at 4 AM UTC. Trigger a manual sync at{' '}
          <code className="bg-gray-100 px-1 rounded">/api/sync</code>.
        </p>
      </div>
    )
  }

  return <CallsFilterView snapshots={snapshots} />
}

function Skeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-9 w-28 bg-gray-100 rounded-lg" />)}
      </div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="space-y-4">
          <div className="h-4 w-48 bg-gray-100 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(j => <div key={j} className="bg-gray-100 rounded-xl h-24" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CallsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <CallsData />
    </Suspense>
  )
}
