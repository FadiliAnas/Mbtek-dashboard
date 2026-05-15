import { Suspense } from 'react'
import { getNumberAnalytics, getAgentAnalytics } from '@/lib/justcall-analytics'
import { AgentPerformanceSection } from '@/components/AgentPerformanceSection'
import { CallsVolumeChart, IVRPieChart } from '@/components/Charts'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const IVR_OPTIONS = [
  { digit: '1', name: 'Sales',             color: '#F26522' },
  { digit: '2', name: 'Client Care',       color: '#2EB872' },
  { digit: '3', name: 'Technical Support', color: '#3B82F6' },
]

function daysAgo(n: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split('T')[0]
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}m ${sec}s`
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

function StatCard({
  label, value, sub, color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-[#1A1A1A]'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">{title}</h2>
}

async function CallsData() {
  const from = daysAgo(30)
  const to   = daysAgo(1)

  const [summary, agents, calls] = await Promise.all([
    getNumberAnalytics(from, to),
    getAgentAnalytics(from, to),
    getStoredCalls(from, to),
  ])

  // Daily chart data
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

  const dailyData = Object.values(dayMap)
  const ivrData   = IVR_OPTIONS.map(o => ({ ...o, count: ivrCounts[o.digit] }))
  const ivrTotal  = ivrData.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-8">

      {/* ── DAILY VOLUME CHART ─────────────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Daily Call Volume</p>
          <p className="text-xs text-gray-400 mb-5">
            Inbound &amp; outbound per day · last 30 days ({from} → {to})
          </p>
          <CallsVolumeChart data={dailyData} />
        </div>
      </section>

      {/* ── CALLS OVERVIEW ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Calls Overview" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Inbound Calls"   value={summary.incoming_calls} />
          <StatCard label="Outbound Calls"  value={summary.outgoing_calls} />
          <StatCard
            label="Missed Calls"
            value={summary.incoming_missed_calls}
            color={summary.incoming_missed_calls > 30 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Answer Rate"
            value={`${summary.incoming_answer_rate}%`}
            color={summary.incoming_answer_rate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
          />
        </div>
      </section>

      {/* ── INBOUND CALLS ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Inbound Calls" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="Inbound Calls" value={summary.incoming_calls} />
          <StatCard
            label="Answer Rate"
            value={`${summary.incoming_answer_rate}%`}
            color={summary.incoming_answer_rate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
          />
          <StatCard
            label="Missed Calls"
            value={summary.incoming_missed_calls}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="SLA Rate (30s)"
            value={`${summary.sla_rate_30sec}%`}
            color={summary.sla_rate_30sec < 70 ? 'text-[#F39C12]' : 'text-[#2EB872]'}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Avg Ring Time"  value={fmt(summary.avg_ring_time)} />
          <StatCard label="Avg Queue Time" value={fmt(summary.avg_queue_time)} />
          <StatCard label="Avg Talk Time"  value={fmt(summary.avg_talk_time)} />
          <StatCard
            label="Voicemails"
            value={summary.voicemails_received}
            color="text-[#F39C12]"
          />
        </div>
      </section>

      {/* ── MISSED CALLS DISTRIBUTION ───────────────────────────────────────── */}
      <section>
        <SectionHeader title="Inbound Missed Calls Distribution" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Missed"
            value={summary.incoming_missed_calls}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="After Office Hours"
            value={summary.missed_after_office_hours}
          />
          <StatCard
            label="During Office Hours"
            value={summary.missed_during_agent_hours}
            color={summary.missed_during_agent_hours > 10 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Abandoned Before Ringing"
            value={summary.missed_abandoned_before_ringing}
            color="text-[#F39C12]"
          />
        </div>
      </section>

      {/* ── OUTBOUND CALLS ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Outbound Calls" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Outbound Calls" value={summary.outgoing_calls} />
          <StatCard
            label="Connect Rate"
            value={`${summary.outgoing_connect_rate}%`}
            color={summary.outgoing_connect_rate > 80 ? 'text-[#2EB872]' : 'text-[#F39C12]'}
          />
          <StatCard
            label="Connected"
            value={summary.outgoing_connected_calls}
            sub={`${summary.outgoing_not_connected_calls} not reached`}
            color="text-[#2EB872]"
          />
          <StatCard
            label="Avg Call Duration"
            value={fmt(summary.avg_call_duration)}
          />
        </div>
      </section>

      {/* ── IVR SELECTION ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="ML IVR — Selection Breakdown" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {ivrData.map(o => (
              <div key={o.digit} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: o.color }}>
                  {o.digit}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{o.name}</p>
                  <p className="text-2xl font-bold text-[#1A1A1A]">{o.count}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: o.color }}>
                    {ivrTotal > 0 ? Math.round((o.count / ivrTotal) * 100) : 0}%
                  </p>
                  <div className="w-20 bg-gray-100 rounded-full h-2 mt-1">
                    <div className="h-2 rounded-full" style={{ width: `${ivrTotal > 0 ? (o.count / ivrTotal) * 100 : 0}%`, backgroundColor: o.color }} />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 pl-1">{ivrTotal} total IVR selections</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center justify-center">
            {ivrTotal > 0
              ? <IVRPieChart data={ivrData} />
              : <p className="text-sm text-gray-400">No IVR data for this period</p>
            }
          </div>
        </div>
      </section>

      {/* ── AGENT LEADERBOARD ──────────────────────────────────────────────── */}
      <AgentPerformanceSection agents={agents} />

    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="bg-white rounded-xl border border-gray-100 p-6 h-48" />
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
