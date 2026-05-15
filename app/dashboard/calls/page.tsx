import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { CallsFilterView } from '@/components/CallsFilterView'
import type { CallsSnapshot } from '@/components/CallsFilterView'

export const revalidate = 1800

async function CallsData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('justcall_analytics_snapshots')
    .select('*') as any)

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-[#E74C3C] text-sm font-medium">Failed to load analytics data.</p>
        <p className="text-gray-400 text-xs mt-1">{error.message}</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
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

  const snapshots = Object.fromEntries(
    (data as CallsSnapshot[]).map(s => [s.period, s])
  ) as Record<string, CallsSnapshot>

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
