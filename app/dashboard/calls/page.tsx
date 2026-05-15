import { Suspense } from 'react'
import { getNumberAnalytics, getAgentAnalytics } from '@/lib/justcall-analytics'
import { CallsFilterView } from '@/components/CallsFilterView'
import type { CallsSnapshot } from '@/components/CallsFilterView'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const IVR_OPTIONS = [
  { digit: '1', name: 'Sales',             color: '#F26522' },
  { digit: '2', name: 'Client Care',       color: '#2EB872' },
  { digit: '3', name: 'Technical Support', color: '#3B82F6' },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split('T')[0]
}

async function getStoredCalls(from: string, to: string) {
  const PAGE = 1000
  let offset = 0
  const result: { call_date: string; direction: string; ivr_digit: string | null }[] = []
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('justcall_calls')
      .select('call_date,direction,ivr_digit')
      .gte('call_date', `${from}T00:00:00.000Z`)
      .lte('call_date', `${to}T23:59:59.999Z`)
      .range(offset, offset + PAGE - 1) as any)
    if (error || !data || data.length === 0) break
    result.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return result
}

function computeChartData(
  calls: { call_date: string; direction: string; ivr_digit: string | null }[],
  from: string,
  to: string,
) {
  const fromDt = new Date(`${from}T00:00:00Z`)
  const toDt   = new Date(`${to}T23:59:59Z`)

  const dayMap: Record<string, { date: string; inbound: number; outbound: number }> = {}
  const cur = new Date(fromDt)
  while (cur <= toDt) {
    const key   = cur.toISOString().split('T')[0]
    const label = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    dayMap[key] = { date: label, inbound: 0, outbound: 0 }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  const ivrCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0 }
  for (const c of calls) {
    const d = new Date(c.call_date)
    if (d < fromDt || d > toDt) continue
    const key = d.toISOString().split('T')[0]
    if (dayMap[key]) {
      if (c.direction === 'inbound') dayMap[key].inbound++
      else dayMap[key].outbound++
    }
    if (c.direction === 'inbound' && c.ivr_digit && ivrCounts[c.ivr_digit] !== undefined) {
      ivrCounts[c.ivr_digit]++
    }
  }

  return {
    dailyData: Object.values(dayMap),
    ivrData: IVR_OPTIONS.map(o => ({ ...o, count: ivrCounts[o.digit] })),
  }
}

async function CallsData() {
  const yesterday = daysAgo(1)

  const periods = [
    { key: 'today',        from: yesterday,   to: yesterday,   prevFrom: daysAgo(2),   prevTo: daysAgo(2)   },
    { key: 'yesterday',    from: daysAgo(2),  to: daysAgo(2),  prevFrom: daysAgo(3),   prevTo: daysAgo(3)   },
    { key: 'last_week',    from: daysAgo(7),  to: yesterday,   prevFrom: daysAgo(14),  prevTo: daysAgo(8)   },
    { key: 'last_month',   from: daysAgo(30), to: yesterday,   prevFrom: daysAgo(60),  prevTo: daysAgo(31)  },
    { key: 'last_3months', from: daysAgo(90), to: yesterday,   prevFrom: daysAgo(180), prevTo: daysAgo(91)  },
  ]

  // Fetch all stored calls once for 90 days and reuse across periods
  const allCalls = await getStoredCalls(daysAgo(90), yesterday)

  const synced_at = new Date().toISOString()

  // Fetch all periods in parallel
  const snapshots: Record<string, CallsSnapshot> = {}
  await Promise.all(
    periods.map(async (p) => {
      const [summary, prevSummary, agents] = await Promise.all([
        getNumberAnalytics(p.from, p.to),
        getNumberAnalytics(p.prevFrom, p.prevTo),
        getAgentAnalytics(p.from, p.to),
      ])
      const { dailyData, ivrData } = computeChartData(allCalls, p.from, p.to)
      snapshots[p.key] = {
        period:       p.key,
        from_date:    p.from,
        to_date:      p.to,
        summary,
        prev_summary: prevSummary,
        agents,
        daily_data:   dailyData,
        ivr_data:     ivrData,
        synced_at,
      }
    })
  )

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
