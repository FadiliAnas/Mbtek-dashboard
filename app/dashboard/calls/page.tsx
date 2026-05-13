import { Suspense } from 'react'
import { dbGetCalls } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { CallsHeatmapChart, IVRBreakdownChart } from '@/components/Charts'

// MBtek IVR digit → label mapping (1=Sales, 2=Client Care, 3=Tech Support)
const IVR_LABELS: Record<string, string> = {
  '1': 'Sales',
  '2': 'Client Care',
  '3': 'Tech Support',
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function isAfterHours(callDate: string): boolean {
  const d = new Date(callDate)
  // EDT = UTC-4. Business hours 8am–6pm EDT
  const hourEDT = (d.getUTCHours() - 4 + 24) % 24
  return hourEDT < 8 || hourEDT >= 18
}

function isSameDay(callDate: string, ref: Date): boolean {
  const d = new Date(callDate)
  return (
    d.getUTCFullYear() === ref.getUTCFullYear() &&
    d.getUTCMonth() === ref.getUTCMonth() &&
    d.getUTCDate() === ref.getUTCDate()
  )
}

async function CallsData() {
  const now = new Date()
  const calls = await dbGetCalls(90)

  const weekAgo = new Date()
  weekAgo.setDate(now.getDate() - 7)
  const monthAgo = new Date()
  monthAgo.setDate(now.getDate() - 30)

  // Time slices
  const today = calls.filter((c) => isSameDay(c.call_date, now))
  const thisWeek = calls.filter((c) => new Date(c.call_date) >= weekAgo)
  const thisMonth = calls.filter((c) => new Date(c.call_date) >= monthAgo)

  // Direction / status (use all 90d for representative stats)
  const inbound = calls.filter((c) => c.direction === 'inbound')
  const outbound = calls.filter((c) => c.direction === 'outbound')
  const missed = calls.filter((c) => c.status === 'missed')
  const answered = calls.filter((c) => c.status === 'answered')
  const voicemails = calls.filter((c) => c.status === 'voicemail')
  const voicemailsThisWeek = voicemails.filter((c) => new Date(c.call_date) >= weekAgo)

  const avgDuration =
    answered.length > 0
      ? answered.reduce((s, c) => s + (c.duration ?? 0), 0) / answered.length
      : 0

  // Outbound connect rate
  const outboundAnswered = outbound.filter((c) => c.status === 'answered')
  const outboundConnectRate = outbound.length > 0 ? (outboundAnswered.length / outbound.length) * 100 : 0

  // Missed call rate
  const missedRate = calls.length > 0 ? (missed.length / calls.length) * 100 : 0

  // IVR breakdown (inbound calls that have ivr_digit set)
  const ivrCalls = inbound.filter((c) => c.ivr_digit)
  const ivrAgg: Record<string, number> = {}
  ivrCalls.forEach((c) => {
    const digit = c.ivr_digit!
    ivrAgg[digit] = (ivrAgg[digit] ?? 0) + 1
  })
  const ivrData = Object.entries(ivrAgg)
    .map(([digit, count]) => ({
      label: IVR_LABELS[digit] ?? `IVR ${digit}`,
      count,
      pct: ivrCalls.length > 0 ? (count / ivrCalls.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Calls per hour (0–23, using 30d data so numbers are meaningful)
  const hourBuckets: number[] = Array(24).fill(0)
  thisMonth.forEach((c) => {
    const d = new Date(c.call_date)
    const hourEDT = (d.getUTCHours() - 4 + 24) % 24
    hourBuckets[hourEDT]++
  })
  const heatmapData = hourBuckets.map((calls, h) => ({
    hour: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
    calls,
  }))

  // After-hours stats (30d)
  const afterHoursCalls = thisMonth.filter((c) => isAfterHours(c.call_date))
  const afterHoursMissed = afterHoursCalls.filter((c) => c.status === 'missed')

  return (
    <>
      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Calls Today</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{today.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {today.filter((c) => c.status === 'missed').length} missed
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">This Week</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{thisWeek.length.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            {thisWeek.filter((c) => c.status === 'missed').length} missed
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">This Month</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{thisMonth.length.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">last 30 days</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Avg Duration</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{formatDuration(avgDuration)}</p>
          <p className="text-xs text-gray-400 mt-1">answered calls</p>
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Inbound Split</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">
            {calls.length > 0 ? ((inbound.length / calls.length) * 100).toFixed(0) : 0}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {inbound.length.toLocaleString()} in / {outbound.length.toLocaleString()} out
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Missed Call Rate</p>
          <p className={`text-3xl font-bold ${missedRate > 20 ? 'text-[#E74C3C]' : 'text-[#F39C12]'}`}>
            {missedRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{missed.length.toLocaleString()} missed (90d)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Outbound Connect</p>
          <p className="text-3xl font-bold text-[#2EB872]">{outboundConnectRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {outboundAnswered.length} of {outbound.length} reached
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Voicemails This Week</p>
          <p className="text-3xl font-bold text-[#F39C12]">{voicemailsThisWeek.length}</p>
          <p className="text-xs text-gray-400 mt-1">{voicemails.length} total (90d)</p>
        </div>
      </div>

      {/* IVR + After Hours */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">IVR Breakdown (90 days)</h2>
          {ivrData.length > 0 ? (
            <>
              <IVRBreakdownChart data={ivrData} />
              <div className="mt-4 space-y-2">
                {ivrData.map((row) => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-medium text-[#1A1A1A]">
                      {row.count.toLocaleString()} ({row.pct.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm">
              No IVR data available. IVR digit routing may not be configured in JustCall.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">After-Hours (30 days, EDT)</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">After-hours calls received</span>
              <span className="text-xl font-bold text-[#1A1A1A]">{afterHoursCalls.length}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">After-hours missed</span>
              <span className="text-xl font-bold text-[#E74C3C]">{afterHoursMissed.length}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">After-hours miss rate</span>
              <span className="text-xl font-bold text-[#F39C12]">
                {afterHoursCalls.length > 0
                  ? ((afterHoursMissed.length / afterHoursCalls.length) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-600">Business hours 8am–6pm EDT</span>
              <span className="text-sm text-gray-400">Mon–Fri assumed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calls per hour heatmap */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Calls by Hour of Day (30 days, EDT)</h2>
        <p className="text-xs text-gray-400 mb-4">When are most calls happening?</p>
        <CallsHeatmapChart data={heatmapData} />
      </div>

      {/* 90-day summary table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">90-Day Call Summary</h2>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500">Total Calls</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{calls.length.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Answered</p>
            <p className="text-2xl font-bold text-[#2EB872]">{answered.length.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Missed</p>
            <p className="text-2xl font-bold text-[#E74C3C]">{missed.length.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Voicemails</p>
            <p className="text-2xl font-bold text-[#F39C12]">{voicemails.length.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </>
  )
}

function CallsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-64" />
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-64" />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6 h-48" />
    </div>
  )
}

export default function CallsPage() {
  return (
    <Suspense fallback={<CallsSkeleton />}>
      <CallsData />
    </Suspense>
  )
}
