import { Suspense } from 'react'
import { dbGetCalls } from '@/lib/db'
import { CallsVolumeChart, InboundTrendChart, IVRBreakdownChart } from '@/components/Charts'

export const dynamic = 'force-dynamic'

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

function isAfterHours(callDate: string) {
  const h = (new Date(callDate).getUTCHours() - 4 + 24) % 24
  return h < 8 || h >= 18
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

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-[#1A1A1A]">{title}</h2>
    </div>
  )
}

// ── Main data component ──────────────────────────────────────────────────────
async function CallsData() {
  const calls = await dbGetCalls(21)

  const now = new Date()
  const d7 = new Date(); d7.setDate(now.getDate() - 7)
  const d14 = new Date(); d14.setDate(now.getDate() - 14)

  const curr = calls.filter(c => new Date(c.call_date) >= d7)
  const prev = calls.filter(c => new Date(c.call_date) >= d14 && new Date(c.call_date) < d7)

  // ── Overview ────────────────────────────────────────────────────────────
  const currIn  = curr.filter(c => c.direction === 'inbound')
  const currOut = curr.filter(c => c.direction === 'outbound')
  const currAnswered = curr.filter(c => c.status === 'answered')

  const prevIn  = prev.filter(c => c.direction === 'inbound')
  const prevOut = prev.filter(c => c.direction === 'outbound')
  const prevAnswered = prev.filter(c => c.status === 'answered')

  // "Missed" = everything not answered or voicemail (missed + abandoned + busy)
  // — matches JustCall's definition which includes Abandoned Before Ringing
  const isNotReached = (s: string) => !['answered', 'voicemail'].includes(s)
  const currNotReached = curr.filter(c => isNotReached(c.status))
  const prevNotReached = prev.filter(c => isNotReached(c.status))

  // Answer rate = inbound answered / total inbound (JustCall definition)
  const inboundAnswered = currIn.filter(c => c.status === 'answered')
  const prevInboundAnswered = prevIn.filter(c => c.status === 'answered')
  const answerRate = pct(inboundAnswered.length, currIn.length)
  const prevAnswerRate = pct(prevInboundAnswered.length, prevIn.length)

  // ── Inbound detail ───────────────────────────────────────────────────────
  const inboundNotReached = currIn.filter(c => isNotReached(c.status))
  const inboundAbandoned  = currIn.filter(c => c.status === 'abandoned')
  const inboundAnswerRate = answerRate

  const inAnsweredDur = inboundAnswered.map(c => c.duration).filter(d => d > 0)
  const avgInDuration = inAnsweredDur.length
    ? inAnsweredDur.reduce((a, b) => a + b, 0) / inAnsweredDur.length
    : 0

  const allAnsweredDur = currAnswered.map(c => c.duration).filter(d => d > 0)
  const avgDuration = allAnsweredDur.length
    ? allAnsweredDur.reduce((a, b) => a + b, 0) / allAnsweredDur.length
    : 0

  const prevInAnswerRate = pct(prevInboundAnswered.length, prevIn.length)
  const prevInDur = prevInboundAnswered.map(c => c.duration).filter(d => d > 0)
  const prevAvgInDur = prevInDur.length ? prevInDur.reduce((a, b) => a + b, 0) / prevInDur.length : 0

  // ── Missed calls detail ──────────────────────────────────────────────────
  // After/during hours applies to all not-reached inbound calls
  const notReachedInbound = currIn.filter(c => isNotReached(c.status))
  const missedAfterHours  = notReachedInbound.filter(c => isAfterHours(c.call_date))
  const missedDuringHours = notReachedInbound.filter(c => !isAfterHours(c.call_date))
  const abandoned = curr.filter(c => c.status === 'abandoned')

  const prevMissedAfterHours = prevIn.filter(c => isNotReached(c.status) && isAfterHours(c.call_date))

  // ── Outbound detail ──────────────────────────────────────────────────────
  const outAnswered = currOut.filter(c => c.status === 'answered')
  const connectRate = pct(outAnswered.length, currOut.length)
  const prevOutAnswered = prevOut.filter(c => c.status === 'answered')
  const prevConnectRate = pct(prevOutAnswered.length, prevOut.length)

  const outDur = outAnswered.map(c => c.duration).filter(d => d > 0)
  const avgOutDuration = outDur.length ? outDur.reduce((a, b) => a + b, 0) / outDur.length : 0
  const prevOutDur = prevOutAnswered.map(c => c.duration).filter(d => d > 0)
  const prevAvgOutDur = prevOutDur.length ? prevOutDur.reduce((a, b) => a + b, 0) / prevOutDur.length : 0

  // ── IVR breakdown ────────────────────────────────────────────────────────
  const ivrCalls = currIn.filter(c => c.ivr_digit)
  const ivrAgg: Record<string, number> = {}
  ivrCalls.forEach(c => { ivrAgg[c.ivr_digit!] = (ivrAgg[c.ivr_digit!] ?? 0) + 1 })
  const ivrData = Object.entries(ivrAgg)
    .map(([digit, count]) => ({
      label: IVR_LABELS[digit] ?? `IVR ${digit}`,
      count,
      pct: ivrCalls.length > 0 ? (count / ivrCalls.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ── Volume over time (by day) ────────────────────────────────────────────
  const dayMap: Record<string, { inbound: number; outbound: number; answered: number; missed: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(now.getDate() - i)
    const key = d.toISOString().split('T')[0]
    dayMap[key] = { inbound: 0, outbound: 0, answered: 0, missed: 0 }
  }
  curr.forEach(c => {
    const key = new Date(c.call_date).toISOString().split('T')[0]
    if (!dayMap[key]) return
    if (c.direction === 'inbound') {
      dayMap[key].inbound++
      if (c.status === 'answered') dayMap[key].answered++
      if (isNotReached(c.status)) dayMap[key].missed++
    } else {
      dayMap[key].outbound++
    }
  })
  const volumeData = Object.entries(dayMap).map(([date, v]) => ({ date: dayLabel(date), ...v }))

  // ── Agent leaderboard ────────────────────────────────────────────────────
  const agentMap: Record<string, { total: number; inbound: number; outbound: number; answered: number; missed: number; duration: number }> = {}
  curr.forEach(c => {
    const a = c.agent_name || 'Unknown'
    if (!agentMap[a]) agentMap[a] = { total: 0, inbound: 0, outbound: 0, answered: 0, missed: 0, duration: 0 }
    agentMap[a].total++
    if (c.direction === 'inbound') agentMap[a].inbound++
    else agentMap[a].outbound++
    if (c.status === 'answered') { agentMap[a].answered++; agentMap[a].duration += c.duration ?? 0 }
    if (c.status === 'missed') agentMap[a].missed++
  })
  const agents = Object.entries(agentMap)
    .map(([name, s]) => ({
      name,
      ...s,
      answerRate: pct(s.answered, s.total),
      avgDuration: s.answered > 0 ? Math.round(s.duration / s.answered) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-8">

      {/* ── CALLS OVERVIEW ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Calls Overview — Last 7 Days" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Inbound Calls"
            value={currIn.length}
            change={changePct(currIn.length, prevIn.length)}
            sub={`prev: ${prevIn.length}`}
          />
          <StatCard
            label="Outbound Calls"
            value={currOut.length}
            change={changePct(currOut.length, prevOut.length)}
            sub={`prev: ${prevOut.length}`}
          />
          <StatCard
            label="Missed Calls"
            value={currNotReached.length}
            change={changePct(currNotReached.length, prevNotReached.length)}
            color={currNotReached.length > 30 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Answer Rate"
            value={`${answerRate}%`}
            change={changePct(answerRate, prevAnswerRate)}
            color={answerRate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
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
            value={currIn.length}
            change={changePct(currIn.length, prevIn.length)}
          />
          <StatCard
            label="Answer Rate"
            value={`${inboundAnswerRate}%`}
            change={changePct(inboundAnswerRate, prevInAnswerRate)}
            color={inboundAnswerRate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
          />
          <StatCard
            label="Not Reached"
            value={inboundNotReached.length}
            change={changePct(inboundNotReached.length, prevIn.filter(c => isNotReached(c.status)).length)}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="Abandoned"
            value={inboundAbandoned.length}
            sub={`${pct(inboundAbandoned.length, currIn.length)}% of inbound`}
            color="text-[#F39C12]"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Avg Call Duration"
            value={fmt(avgInDuration)}
            change={changePct(Math.round(avgInDuration), Math.round(prevAvgInDur))}
          />
          <StatCard label="Avg Talk Time" value={fmt(avgDuration)} sub="all answered" />
          <StatCard
            label="Voicemails"
            value={curr.filter(c => c.status === 'voicemail').length}
            sub="this week"
            color="text-[#F39C12]"
          />
          <StatCard
            label="IVR Routed"
            value={ivrCalls.length}
            sub={`${pct(ivrCalls.length, currIn.length)}% of inbound`}
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-4">INBOUND CALLS OVER TIME — ANSWERED VS MISSED</p>
          <InboundTrendChart data={volumeData} />
        </div>
      </section>

      {/* ── MISSED CALLS ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Missed Calls Distribution" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Missed"
            value={currNotReached.length}
            change={changePct(currNotReached.length, prevNotReached.length)}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="After Office Hours"
            value={missedAfterHours.length}
            change={changePct(missedAfterHours.length, prevMissedAfterHours.length)}
            sub="outside 8am–6pm ET"
          />
          <StatCard
            label="During Office Hours"
            value={missedDuringHours.length}
            sub="8am–6pm ET"
            color={missedDuringHours.length > 10 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Abandoned"
            value={abandoned.length}
            sub="hung up before answer"
            color="text-[#F39C12]"
          />
        </div>

        {/* IVR breakdown */}
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
            value={currOut.length}
            change={changePct(currOut.length, prevOut.length)}
          />
          <StatCard
            label="Connect Rate"
            value={`${connectRate}%`}
            change={changePct(connectRate, prevConnectRate)}
            color={connectRate > 80 ? 'text-[#2EB872]' : 'text-[#F39C12]'}
          />
          <StatCard
            label="Avg Call Duration"
            value={fmt(avgOutDuration)}
            change={changePct(Math.round(avgOutDuration), Math.round(prevAvgOutDur))}
          />
          <StatCard
            label="Not Reached"
            value={currOut.length - outAnswered.length}
            sub={`${100 - connectRate}% of outbound`}
            color="text-[#E74C3C]"
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
                {['Agent', 'Total', 'Inbound', 'Outbound', 'Answered', 'Answer Rate', 'Missed', 'Avg Duration'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => (
                <tr key={a.name} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-orange-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">{a.name}</td>
                  <td className="px-4 py-3 font-semibold">{a.total}</td>
                  <td className="px-4 py-3 text-gray-600">{a.inbound}</td>
                  <td className="px-4 py-3 text-gray-600">{a.outbound}</td>
                  <td className="px-4 py-3 text-[#2EB872] font-medium">{a.answered}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${a.answerRate < 50 ? 'text-[#E74C3C]' : a.answerRate < 75 ? 'text-[#F39C12]' : 'text-[#2EB872]'}`}>
                      {a.answerRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#E74C3C]">{a.missed}</td>
                  <td className="px-4 py-3 text-gray-600">{a.avgDuration > 0 ? fmt(a.avgDuration) : '—'}</td>
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
