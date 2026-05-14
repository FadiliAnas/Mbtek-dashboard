import { Suspense } from 'react'
import { getNumberAnalytics, getAgentAnalytics } from '@/lib/justcall-analytics'
import { getCalls } from '@/lib/justcall'
import { CallsVolumeChart, InboundTrendChart, IVRBreakdownChart } from '@/components/Charts'

// Refresh every 30 minutes — matches JustCall's own dashboard refresh cadence
export const revalidate = 1800

const IVR_LABELS: Record<string, string> = {
  '1': 'Sales',
  '2': 'Client Care',
  '3': 'Tech Support',
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}m ${sec}s`
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}

function changePct(curr: number, prev: number) {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// ── Change badge ─────────────────────────────────────────────────────────────
function Badge({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-[#2EB872]' : 'text-[#E74C3C]'}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────
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
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-[#1A1A1A]">{title}</h2>
    </div>
  )
}

// ── Main data component ──────────────────────────────────────────────────────
async function CallsData() {
  // "Last 7 Days" = today + prior 6 calendar days (matches JustCall's definition)
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

  // Fetch pre-aggregated analytics + raw calls (for IVR & volume charts) in parallel
  const [curr, prev, agents, rawCalls] = await Promise.all([
    getNumberAnalytics(currFrom, todayStr),
    getNumberAnalytics(prevFrom, prevTo),
    getAgentAnalytics(currFrom, todayStr),
    getCalls(currFrom, todayStr),
  ])

  // ── IVR breakdown from raw calls ────────────────────────────────────────
  const ivrCalls = rawCalls.filter(c => c.direction === 'inbound' && c.ivr_digit)
  const ivrAgg: Record<string, number> = {}
  ivrCalls.forEach(c => { ivrAgg[c.ivr_digit!] = (ivrAgg[c.ivr_digit!] ?? 0) + 1 })
  const ivrData = Object.entries(ivrAgg)
    .map(([digit, count]) => ({
      label: IVR_LABELS[digit] ?? `IVR ${digit}`,
      count,
      pct: ivrCalls.length > 0 ? (count / ivrCalls.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ── Volume over time chart (last 7 days, by day) ─────────────────────────
  const dayMap: Record<string, { inbound: number; outbound: number; answered: number; missed: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - i)
    const key = d.toISOString().split('T')[0]
    dayMap[key] = { inbound: 0, outbound: 0, answered: 0, missed: 0 }
  }
  rawCalls.forEach(c => {
    const key = new Date(c.call_date).toISOString().split('T')[0]
    if (!dayMap[key]) return
    if (c.direction === 'inbound') {
      dayMap[key].inbound++
      if (c.status === 'answered') dayMap[key].answered++
      else if (!['voicemail'].includes(c.status)) dayMap[key].missed++
    } else {
      dayMap[key].outbound++
    }
  })
  const volumeData = Object.entries(dayMap).map(([date, v]) => ({ date: dayLabel(date), ...v }))

  return (
    <div className="space-y-8">

      {/* ── CALLS OVERVIEW ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Calls Overview — Last 7 Days" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-4">CALLS VOLUME OVER TIME</p>
          <CallsVolumeChart data={volumeData} />
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-4">INBOUND — ANSWERED VS MISSED</p>
          <InboundTrendChart data={volumeData} />
        </div>
      </section>

      {/* ── MISSED CALLS DISTRIBUTION ───────────────────────────────────── */}
      <section>
        <SectionHeader title="Inbound Missed Calls Distribution" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            sub="outside business hours"
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

        {ivrData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-4">IVR ROUTING BREAKDOWN</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <IVRBreakdownChart data={ivrData} />
              <div className="space-y-3">
                {ivrData.map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div className="bg-[#F26522] h-2 rounded-full" style={{ width: `${row.pct}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-[#1A1A1A] w-16 text-right">
                        {row.count} ({row.pct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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

      {/* ── AGENT LEADERBOARD ──────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Agent Performance — Last 7 Days" />
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                {['Agent', 'Total', 'Inbound', 'Outbound', 'Answered', 'Answer Rate', 'Missed', 'Connect Rate', 'Avg Duration'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => (
                <tr key={a.agent_id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-orange-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">{a.agent_name}</td>
                  <td className="px-4 py-3 font-semibold">{a.total_calls}</td>
                  <td className="px-4 py-3 text-gray-600">{a.incoming_calls}</td>
                  <td className="px-4 py-3 text-gray-600">{a.outgoing_calls}</td>
                  <td className="px-4 py-3 text-[#2EB872] font-medium">{a.incoming_answered_calls}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${a.incoming_answer_rate < 50 ? 'text-[#E74C3C]' : a.incoming_answer_rate < 75 ? 'text-[#F39C12]' : 'text-[#2EB872]'}`}>
                      {a.incoming_answer_rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#E74C3C]">{a.incoming_missed_calls}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${a.outgoing_connect_rate < 80 ? 'text-[#F39C12]' : 'text-[#2EB872]'}`}>
                      {a.outgoing_calls > 0 ? `${a.outgoing_connect_rate}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.avg_call_duration > 0 ? fmt(a.avg_call_duration) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
