import { Suspense } from 'react'
import { getNumberAnalytics, getAgentAnalytics } from '@/lib/justcall-analytics'
import type { PeriodSummary, AgentSummary } from '@/lib/justcall-analytics'

export const revalidate = 1800

function fmt(s: number) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

function dateRange() {
  const now = new Date()
  const start = new Date(now)
  start.setUTCDate(now.getUTCDate() - 6)
  return {
    from: start.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  }
}

// ── Number table ─────────────────────────────────────────────────────────────
function NumberRow({ label, curr, field, fmt: fmtFn }: {
  label: string
  curr: PeriodSummary
  field: keyof PeriodSummary
  fmt?: (v: number) => string
}) {
  const val = curr[field] as number
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-4 py-2.5 text-sm text-gray-500">{label}</td>
      <td className="px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]">{fmtFn ? fmtFn(val) : val}</td>
    </tr>
  )
}

async function AnalyticsData() {
  const { from, to } = dateRange()

  const [byNumber, byAgent] = await Promise.all([
    getNumberAnalytics(from, to),
    getAgentAnalytics(from, to),
  ])

  const numRows: { label: string; field: keyof PeriodSummary; fmt?: (v: number) => string }[] = [
    { label: 'Total Calls', field: 'total_calls' },
    { label: 'Inbound Calls', field: 'incoming_calls' },
    { label: 'Inbound Answered', field: 'incoming_answered_calls' },
    { label: 'Answer Rate', field: 'incoming_answer_rate', fmt: v => `${v}%` },
    { label: 'SLA Rate (30s)', field: 'sla_rate_30sec', fmt: v => `${v}%` },
    { label: 'Missed Calls', field: 'incoming_missed_calls' },
    { label: 'After Office Hours', field: 'missed_after_office_hours' },
    { label: 'During Office Hours', field: 'missed_during_agent_hours' },
    { label: 'Abandoned Before Ringing', field: 'missed_abandoned_before_ringing' },
    { label: 'Outbound Calls', field: 'outgoing_calls' },
    { label: 'Outbound Connected', field: 'outgoing_connected_calls' },
    { label: 'Outbound Not Connected', field: 'outgoing_not_connected_calls' },
    { label: 'Connect Rate', field: 'outgoing_connect_rate', fmt: v => `${v}%` },
    { label: 'Voicemails', field: 'voicemails_received' },
    { label: 'Avg Ring Time', field: 'avg_ring_time', fmt },
    { label: 'Avg Queue Time', field: 'avg_queue_time', fmt },
    { label: 'Avg Talk Time', field: 'avg_talk_time', fmt },
    { label: 'Avg Hold Time', field: 'avg_hold_time', fmt },
    { label: 'Avg Call Duration', field: 'avg_call_duration', fmt },
  ]

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-bold text-[#1A1A1A] mb-1">Analytics Test Page</h1>
        <p className="text-sm text-gray-400">Raw data from <code className="bg-gray-100 px-1 rounded">JustCall /v2.1/calls/analytics</code> — {from} to {to}</p>
      </div>

      {/* ── By Number (aggregated) ─────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Summary — All Numbers Combined</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden w-full max-w-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Metric</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Value</th>
              </tr>
            </thead>
            <tbody>
              {numRows.map(r => (
                <NumberRow key={r.field} label={r.label} curr={byNumber} field={r.field} fmt={r.fmt} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── By Agent ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">By Agent</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                {[
                  'Agent', 'Email', 'Total',
                  'Inbound', 'Answered', 'Answer%', 'SLA%', 'Missed',
                  'Outbound', 'Connected', 'Connect%',
                  'Avg Ring', 'Avg Queue', 'Avg Talk', 'Avg Duration',
                ].map(h => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byAgent.map((a: AgentSummary) => (
                <tr key={a.agent_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-[#1A1A1A]">{a.agent_name}</td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{a.agent_email}</td>
                  <td className="px-3 py-2.5 font-semibold">{a.total_calls}</td>
                  <td className="px-3 py-2.5">{a.incoming_calls}</td>
                  <td className="px-3 py-2.5 text-[#2EB872]">{a.incoming_answered_calls}</td>
                  <td className="px-3 py-2.5">
                    <span className={a.incoming_answer_rate < 50 ? 'text-[#E74C3C]' : a.incoming_answer_rate < 75 ? 'text-[#F39C12]' : 'text-[#2EB872]'}>
                      {a.incoming_calls > 0 ? `${a.incoming_answer_rate}%` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{a.incoming_calls > 0 ? `${a.sla_rate_30sec}%` : '—'}</td>
                  <td className="px-3 py-2.5 text-[#E74C3C]">{a.incoming_missed_calls || '—'}</td>
                  <td className="px-3 py-2.5">{a.outgoing_calls}</td>
                  <td className="px-3 py-2.5 text-[#2EB872]">{a.outgoing_connected_calls}</td>
                  <td className="px-3 py-2.5">{a.outgoing_calls > 0 ? `${a.outgoing_connect_rate}%` : '—'}</td>
                  <td className="px-3 py-2.5">{fmt(a.avg_ring_time)}</td>
                  <td className="px-3 py-2.5">{fmt(a.avg_queue_time)}</td>
                  <td className="px-3 py-2.5">{fmt(a.avg_talk_time)}</td>
                  <td className="px-3 py-2.5">{fmt(a.avg_call_duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function AnalyticsTestPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400 animate-pulse">Loading analytics…</div>}>
      <AnalyticsData />
    </Suspense>
  )
}
