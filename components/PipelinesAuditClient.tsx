'use client'

import { useState } from 'react'
import { PipelineStageChart } from '@/components/Charts'

interface StageRow {
  id: string
  name: string
  count: number
  value: number
  avgValue: number
}

interface PipelineRow {
  id: string
  name: string
  stages: StageRow[]
  totalCount: number
  totalValue: number
  withValue: number
  statusTotals: Record<string, number>
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const STATUS_COLOR: Record<string, string> = {
  open: 'text-blue-600',
  won: 'text-green-600',
  lost: 'text-red-500',
  abandoned: 'text-gray-400',
}

// ── All-pipelines summary view ───────────────────────────────────────────────
function AllSummary({ pipelines }: { pipelines: PipelineRow[] }) {
  const grandCount = pipelines.reduce((s, p) => s + p.totalCount, 0)
  const grandValue = pipelines.reduce((s, p) => s + p.totalValue, 0)
  const grandWithValue = pipelines.reduce((s, p) => s + p.withValue, 0)

  return (
    <div className="space-y-4">
      {/* Grand totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Records', value: grandCount.toLocaleString() },
          { label: 'Total Value', value: grandValue > 0 ? fmt(grandValue) : '—' },
          { label: 'Records with Value', value: grandWithValue.toLocaleString() },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 px-6 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3">Pipeline</th>
              <th className="text-right px-4 py-3">Records</th>
              <th className="text-right px-4 py-3">With Value</th>
              <th className="text-right px-4 py-3">Total Value</th>
              <th className="text-left px-6 py-3">Status Breakdown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pipelines.map((p) => (
              <tr key={p.id} className={p.totalCount === 0 ? 'opacity-40' : 'hover:bg-gray-50'}>
                <td className="px-6 py-3 font-medium text-[#1A1A1A]">{p.name}</td>
                <td className="px-4 py-3 text-right text-gray-700">{p.totalCount}</td>
                <td className="px-4 py-3 text-right text-gray-500">{p.withValue}</td>
                <td className="px-4 py-3 text-right text-gray-700 font-medium">
                  {p.totalValue > 0 ? fmt(p.totalValue) : '—'}
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-3 flex-wrap text-xs">
                    {Object.entries(p.statusTotals).map(([st, n]) => (
                      <span key={st}>
                        <span className={STATUS_COLOR[st] ?? 'text-gray-500'}>{n}</span>
                        <span className="text-gray-400 ml-1">{st}</span>
                      </span>
                    ))}
                    {p.totalCount === 0 && <span className="text-gray-400 italic">empty</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-[#1A1A1A]">
              <td className="px-6 py-3">Total</td>
              <td className="px-4 py-3 text-right">{grandCount.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-gray-500">{grandWithValue}</td>
              <td className="px-4 py-3 text-right">{grandValue > 0 ? fmt(grandValue) : '—'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Single pipeline detail view ───────────────────────────────────────────────
function PipelineDetail({ pipeline }: { pipeline: PipelineRow }) {
  const activeStages = pipeline.stages.filter((s) => s.count > 0)

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Records', value: pipeline.totalCount.toLocaleString() },
          { label: 'Total Value', value: pipeline.totalValue > 0 ? fmt(pipeline.totalValue) : '—' },
          { label: 'Records with Value', value: pipeline.withValue.toLocaleString() },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 px-6 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {pipeline.totalCount === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center text-gray-400">
          No opportunities synced for this pipeline.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {/* Stage table */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-4">
                <p className="text-sm font-semibold text-[#1A1A1A]">Stage Breakdown</p>
                <div className="flex gap-3 text-xs">
                  {Object.entries(pipeline.statusTotals).map(([st, n]) => (
                    <span key={st}>
                      <span className={STATUS_COLOR[st] ?? 'text-gray-500'}>{n}</span>
                      <span className="text-gray-400 ml-1">{st}</span>
                    </span>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2">Stage</th>
                    <th className="text-right pb-2">Count</th>
                    <th className="text-right pb-2">Total Value</th>
                    <th className="text-right pb-2">Avg Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pipeline.stages.map((s) => (
                    <tr key={s.id} className={s.count === 0 ? 'opacity-30' : ''}>
                      <td className="py-2 font-medium text-[#1A1A1A]">{s.name}</td>
                      <td className="py-2 text-right text-gray-700">{s.count}</td>
                      <td className="py-2 text-right text-gray-700">
                        {s.value > 0 ? fmt(s.value) : '—'}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {s.avgValue > 0 ? fmt(s.avgValue) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-semibold text-[#1A1A1A]">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right">{pipeline.totalCount}</td>
                    <td className="pt-2 text-right">
                      {pipeline.totalValue > 0 ? fmt(pipeline.totalValue) : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Chart */}
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-[#1A1A1A] mb-4">Records per Stage</p>
              {activeStages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No active stages</p>
              ) : (
                <PipelineStageChart
                  data={activeStages.map((s) => ({
                    stage: s.name,
                    count: s.count,
                    value: s.value,
                  }))}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root client component ─────────────────────────────────────────────────────
export function PipelinesAuditClient({ pipelines }: { pipelines: PipelineRow[] }) {
  const [selected, setSelected] = useState<string>('all')

  const activePipeline = selected === 'all' ? null : pipelines.find((p) => p.id === selected) ?? null

  return (
    <div className="space-y-5">
      {/* Page header + filter */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Pipelines Audit</h1>
          <p className="text-sm text-gray-500 mt-1">
            Raw data per pipeline — verify numbers against GHL
          </p>
        </div>

        {/* Pipeline selector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-sm text-gray-500 whitespace-nowrap">View pipeline:</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#F26522]/30 focus:border-[#F26522] cursor-pointer"
          >
            <option value="all">All Pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.totalCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {selected === 'all' ? (
        <AllSummary pipelines={pipelines} />
      ) : activePipeline ? (
        <PipelineDetail pipeline={activePipeline} />
      ) : null}
    </div>
  )
}
