import { Suspense } from 'react'
import { getNumberAnalytics, getAgentAnalytics } from '@/lib/justcall-analytics'
import { AgentPerformanceSection } from '@/components/AgentPerformanceSection'
import { CallsVolumeChart, IVRPieChart } from '@/components/Charts'
import { getCalls } from '@/lib/justcall'

export const revalidate = 1800

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}m ${sec}s`
}

function changePct(curr: number, prev: number) {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

function Badge({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-[#2EB872]' : 'text-[#E74C3C]'}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  )
}

function StatCard({
  label, value, sub, change, color,
}: {
  label: string
  value: string | number
  sub?: string
  change?: number | null
  color?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-[#1A1A1A]'}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {change !== undefined && <Badge value={change ?? null} />}
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">{title}</h2>
}

async function CallsData() {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const currStart = new Date(now)
  currStart.setUTCDate(now.getUTCDate() - 6)
  const currFrom = currStart.toISOString().split('T')[0]

  const prevEnd = new Date(currStart)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevEnd.getUTCDate() - 6)
  const prevFrom = prevStart.toISOString().split('T')[0]
  const prevTo = prevEnd.toISOString().split('T')[0]

  const [curr, prev, agents, rawCalls] = await Promise.all([
    getNumberAnalytics(currFrom, todayStr),
    getNumberAnalytics(prevFrom, prevTo),
    getAgentAnalytics(currFrom, todayStr),
    getCalls(currFrom, todayStr),
  ])

  // Build daily chart data
  const dayMap: Record<string, { date: string; inbound: number; outbound: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - i)
    const key = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    dayMap[key] = { date: label, inbound: 0, outbound: 0 }
  }
  rawCalls.forEach(c => {
    const key = new Date(c.call_date).toISOString().split('T')[0]
    if (!dayMap[key]) return
    if (c.direction === 'inbound') dayMap[key].inbound++
    else dayMap[key].outbound++
  })
  const dailyData = Object.values(dayMap)

  // IVR selection breakdown — inbound calls that pressed 1, 2 or 3
  const IVR_OPTIONS = [
    { digit: '1', name: 'Sales',              color: '#F26522' },
    { digit: '2', name: 'Client Care',        color: '#2EB872' },
    { digit: '3', name: 'Technical Support',  color: '#3B82F6' },
  ]
  const ivrCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0 }
  rawCalls.forEach(c => {
    if (c.direction === 'inbound' && c.ivr_digit && ivrCounts[c.ivr_digit] !== undefined) {
      ivrCounts[c.ivr_digit]++
    }
  })
  const ivrTotal = Object.values(ivrCounts).reduce((a, b) => a + b, 0)
  const ivrData = IVR_OPTIONS.map(o => ({ ...o, count: ivrCounts[o.digit] }))

  return (
    <div className="space-y-8">

      {/* ── DAILY VOLUME CHART ─────────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Daily Call Volume</p>
          <p className="text-xs text-gray-400 mb-5">Last 7 days — inbound &amp; outbound per day</p>
          <CallsVolumeChart data={dailyData} />
        </div>
      </section>

      {/* ── CALLS OVERVIEW ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Calls Overview — Last 7 Days" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Inbound Calls"
            value={curr.incoming_calls}
            change={changePct(curr.incoming_calls, prev.incoming_calls)}
            sub={`prev: ${prev.incoming_calls}`}
          />
          <StatCard
            label="Outbound Calls"
            value={curr.outgoing_calls}
            change={changePct(curr.outgoing_calls, prev.outgoing_calls)}
            sub={`prev: ${prev.outgoing_calls}`}
          />
          <StatCard
            label="Missed Calls"
            value={curr.incoming_missed_calls}
            change={changePct(curr.incoming_missed_calls, prev.incoming_missed_calls)}
            color={curr.incoming_missed_calls > 30 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Answer Rate"
            value={`${curr.incoming_answer_rate}%`}
            change={changePct(curr.incoming_answer_rate, prev.incoming_answer_rate)}
            color={curr.incoming_answer_rate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
          />
        </div>
      </section>

      {/* ── INBOUND CALLS ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Inbound Calls" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Inbound Calls"
            value={curr.incoming_calls}
            change={changePct(curr.incoming_calls, prev.incoming_calls)}
          />
          <StatCard
            label="Answer Rate"
            value={`${curr.incoming_answer_rate}%`}
            change={changePct(curr.incoming_answer_rate, prev.incoming_answer_rate)}
            color={curr.incoming_answer_rate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
          />
          <StatCard
            label="Missed Calls"
            value={curr.incoming_missed_calls}
            change={changePct(curr.incoming_missed_calls, prev.incoming_missed_calls)}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="SLA Rate (30s)"
            value={`${curr.sla_rate_30sec}%`}
            change={changePct(curr.sla_rate_30sec, prev.sla_rate_30sec)}
            color={curr.sla_rate_30sec < 70 ? 'text-[#F39C12]' : 'text-[#2EB872]'}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Avg Ring Time"
            value={fmt(curr.avg_ring_time)}
            change={changePct(curr.avg_ring_time, prev.avg_ring_time)}
          />
          <StatCard
            label="Avg Queue Time"
            value={fmt(curr.avg_queue_time)}
            change={changePct(curr.avg_queue_time, prev.avg_queue_time)}
          />
          <StatCard
            label="Avg Talk Time"
            value={fmt(curr.avg_talk_time)}
            change={changePct(curr.avg_talk_time, prev.avg_talk_time)}
          />
          <StatCard
            label="Voicemails"
            value={curr.voicemails_received}
            change={changePct(curr.voicemails_received, prev.voicemails_received)}
            color="text-[#F39C12]"
          />
        </div>
      </section>

      {/* ── MISSED CALLS DISTRIBUTION ───────────────────────────────────── */}
      <section>
        <SectionHeader title="Inbound Missed Calls Distribution" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Missed"
            value={curr.incoming_missed_calls}
            change={changePct(curr.incoming_missed_calls, prev.incoming_missed_calls)}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="After Office Hours"
            value={curr.missed_after_office_hours}
            change={changePct(curr.missed_after_office_hours, prev.missed_after_office_hours)}
          />
          <StatCard
            label="During Office Hours"
            value={curr.missed_during_agent_hours}
            change={changePct(curr.missed_during_agent_hours, prev.missed_during_agent_hours)}
            color={curr.missed_during_agent_hours > 10 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Abandoned Before Ringing"
            value={curr.missed_abandoned_before_ringing}
            change={changePct(curr.missed_abandoned_before_ringing, prev.missed_abandoned_before_ringing)}
            color="text-[#F39C12]"
          />
        </div>
      </section>

      {/* ── OUTBOUND CALLS ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Outbound Calls" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Outbound Calls"
            value={curr.outgoing_calls}
            change={changePct(curr.outgoing_calls, prev.outgoing_calls)}
          />
          <StatCard
            label="Connect Rate"
            value={`${curr.outgoing_connect_rate}%`}
            change={changePct(curr.outgoing_connect_rate, prev.outgoing_connect_rate)}
            color={curr.outgoing_connect_rate > 80 ? 'text-[#2EB872]' : 'text-[#F39C12]'}
          />
          <StatCard
            label="Connected"
            value={curr.outgoing_connected_calls}
            sub={`${curr.outgoing_not_connected_calls} not reached`}
            color="text-[#2EB872]"
          />
          <StatCard
            label="Avg Call Duration"
            value={fmt(curr.avg_call_duration)}
            change={changePct(curr.avg_call_duration, prev.avg_call_duration)}
          />
        </div>
      </section>

      {/* ── IVR SELECTION ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="ML IVR — Selection Breakdown" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stat cards */}
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
            <p className="text-xs text-gray-400 pl-1">{ivrTotal} total IVR selections this week</p>
          </div>
          {/* Donut chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center justify-center">
            {ivrTotal > 0
              ? <IVRPieChart data={ivrData} />
              : <p className="text-sm text-gray-400">No IVR data this week</p>
            }
          </div>
        </div>
      </section>

      {/* ── AGENT LEADERBOARD ──────────────────────────────────────────── */}
      <AgentPerformanceSection agents={agents} />

    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-8 animate-pulse">
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
