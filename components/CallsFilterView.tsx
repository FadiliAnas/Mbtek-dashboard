'use client'

import { useState } from 'react'
import { AgentPerformanceSection } from './AgentPerformanceSection'
import { CallsVolumeChart, IVRPieChart } from './Charts'
import type { PeriodSummary, AgentSummary } from '@/lib/justcall-analytics'

export interface CallsSnapshot {
  period: string
  from_date: string
  to_date: string
  summary: PeriodSummary
  prev_summary: PeriodSummary | null
  agents: AgentSummary[]
  daily_data: { date: string; inbound: number; outbound: number }[]
  ivr_data: { digit: string; name: string; color: string; count: number }[]
  synced_at: string
}

const PERIODS = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'last_week',    label: 'Last 7 Days' },
  { key: 'last_month',   label: 'Last 30 Days' },
  { key: 'last_3months', label: 'Last 90 Days' },
] as const

type PeriodKey = typeof PERIODS[number]['key']

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

interface Props {
  snapshots: Record<string, CallsSnapshot>
}

export function CallsFilterView({ snapshots }: Props) {
  const [period, setPeriod] = useState<PeriodKey>('last_week')
  const snap = snapshots[period]

  return (
    <div className="space-y-6">

      {/* ── Period filter ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(p => {
          const available = !!snapshots[p.key]
          return (
            <button
              key={p.key}
              onClick={() => available && setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                period === p.key
                  ? 'bg-[#F26522] text-white shadow-sm'
                  : available
                    ? 'bg-white border border-gray-200 text-gray-600 hover:border-[#F26522] hover:text-[#F26522]'
                    : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              {p.label}
            </button>
          )
        })}
        {snap && (
          <span className="text-xs text-gray-400 ml-1">
            {snap.from_date === snap.to_date ? snap.from_date : `${snap.from_date} → ${snap.to_date}`}
            {' · '}synced {new Date(snap.synced_at).toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {!snap ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">No data for this period yet.</p>
          <p className="text-gray-300 text-xs mt-1">Run a sync to populate analytics snapshots.</p>
        </div>
      ) : (
        <SnapshotContent snap={snap} />
      )}
    </div>
  )
}

function SnapshotContent({ snap }: { snap: CallsSnapshot }) {
  const curr = snap.summary
  const prev = snap.prev_summary
  const ivrData = snap.ivr_data
  const ivrTotal = ivrData.reduce((s, d) => s + d.count, 0)
  const showDailyChart = snap.period !== 'today' && snap.period !== 'yesterday'

  const chg = (c: number, p: number) => prev ? changePct(c, p) : undefined

  return (
    <div className="space-y-8">

      {/* ── DAILY VOLUME CHART ─────────────────────────────────────────────── */}
      {showDailyChart && (
        <section>
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Daily Call Volume</p>
            <p className="text-xs text-gray-400 mb-5">Inbound &amp; outbound per day</p>
            <CallsVolumeChart data={snap.daily_data} />
          </div>
        </section>
      )}

      {/* ── CALLS OVERVIEW ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Calls Overview" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Inbound Calls"
            value={curr.incoming_calls}
            change={chg(curr.incoming_calls, prev?.incoming_calls ?? 0)}
            sub={prev ? `prev: ${prev.incoming_calls}` : undefined}
          />
          <StatCard
            label="Outbound Calls"
            value={curr.outgoing_calls}
            change={chg(curr.outgoing_calls, prev?.outgoing_calls ?? 0)}
            sub={prev ? `prev: ${prev.outgoing_calls}` : undefined}
          />
          <StatCard
            label="Missed Calls"
            value={curr.incoming_missed_calls}
            change={chg(curr.incoming_missed_calls, prev?.incoming_missed_calls ?? 0)}
            color={curr.incoming_missed_calls > 30 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Answer Rate"
            value={`${curr.incoming_answer_rate}%`}
            change={chg(curr.incoming_answer_rate, prev?.incoming_answer_rate ?? 0)}
            color={curr.incoming_answer_rate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
          />
        </div>
      </section>

      {/* ── INBOUND CALLS ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Inbound Calls" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Inbound Calls"
            value={curr.incoming_calls}
            change={chg(curr.incoming_calls, prev?.incoming_calls ?? 0)}
          />
          <StatCard
            label="Answer Rate"
            value={`${curr.incoming_answer_rate}%`}
            change={chg(curr.incoming_answer_rate, prev?.incoming_answer_rate ?? 0)}
            color={curr.incoming_answer_rate < 60 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}
          />
          <StatCard
            label="Missed Calls"
            value={curr.incoming_missed_calls}
            change={chg(curr.incoming_missed_calls, prev?.incoming_missed_calls ?? 0)}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="SLA Rate (30s)"
            value={`${curr.sla_rate_30sec}%`}
            change={chg(curr.sla_rate_30sec, prev?.sla_rate_30sec ?? 0)}
            color={curr.sla_rate_30sec < 70 ? 'text-[#F39C12]' : 'text-[#2EB872]'}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Avg Ring Time"
            value={fmt(curr.avg_ring_time)}
            change={chg(curr.avg_ring_time, prev?.avg_ring_time ?? 0)}
          />
          <StatCard
            label="Avg Queue Time"
            value={fmt(curr.avg_queue_time)}
            change={chg(curr.avg_queue_time, prev?.avg_queue_time ?? 0)}
          />
          <StatCard
            label="Avg Talk Time"
            value={fmt(curr.avg_talk_time)}
            change={chg(curr.avg_talk_time, prev?.avg_talk_time ?? 0)}
          />
          <StatCard
            label="Voicemails"
            value={curr.voicemails_received}
            change={chg(curr.voicemails_received, prev?.voicemails_received ?? 0)}
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
            value={curr.incoming_missed_calls}
            change={chg(curr.incoming_missed_calls, prev?.incoming_missed_calls ?? 0)}
            color="text-[#E74C3C]"
          />
          <StatCard
            label="After Office Hours"
            value={curr.missed_after_office_hours}
            change={chg(curr.missed_after_office_hours, prev?.missed_after_office_hours ?? 0)}
          />
          <StatCard
            label="During Office Hours"
            value={curr.missed_during_agent_hours}
            change={chg(curr.missed_during_agent_hours, prev?.missed_during_agent_hours ?? 0)}
            color={curr.missed_during_agent_hours > 10 ? 'text-[#E74C3C]' : 'text-[#1A1A1A]'}
          />
          <StatCard
            label="Abandoned Before Ringing"
            value={curr.missed_abandoned_before_ringing}
            change={chg(curr.missed_abandoned_before_ringing, prev?.missed_abandoned_before_ringing ?? 0)}
            color="text-[#F39C12]"
          />
        </div>
      </section>

      {/* ── OUTBOUND CALLS ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Outbound Calls" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Outbound Calls"
            value={curr.outgoing_calls}
            change={chg(curr.outgoing_calls, prev?.outgoing_calls ?? 0)}
          />
          <StatCard
            label="Connect Rate"
            value={`${curr.outgoing_connect_rate}%`}
            change={chg(curr.outgoing_connect_rate, prev?.outgoing_connect_rate ?? 0)}
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
            change={chg(curr.avg_call_duration, prev?.avg_call_duration ?? 0)}
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
      <AgentPerformanceSection agents={snap.agents} />

    </div>
  )
}
