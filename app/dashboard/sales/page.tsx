import { Suspense } from 'react'
import { dbGetOpportunities, dbGetPipelines } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { computeSalesSummary, formatUSD } from '@/lib/metrics'
import {
  SalesFunnelChart,
  WinRateBySourceChart,
  PipelineByStageChart,
} from '@/components/Charts'

async function SalesData() {
  const [opportunities, pipelines] = await Promise.all([
    dbGetOpportunities(),
    dbGetPipelines(),
  ])

  const s = computeSalesSummary(opportunities, pipelines)

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Open Pipeline</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{formatUSD(s.openValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{s.openCount} deals</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Won This Month</p>
          <p className="text-3xl font-bold text-[#2EB872]">{formatUSD(s.wonThisMonthValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{s.wonThisMonth} deals</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Win Rate</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{s.winRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">all time</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Avg Sales Cycle</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{Math.round(s.avgSalesCycleDays)}d</p>
          <p className="text-xs text-gray-400 mt-1">avg deal size {formatUSD(s.avgDealSize)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Sales Funnel (Open Deals)</h2>
          {s.funnelStages.length > 0 ? (
            <SalesFunnelChart data={s.funnelStages} />
          ) : (
            <p className="text-gray-400 text-sm">No funnel data available</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Win Rate by Lead Source</h2>
          {s.bySource.length > 0 ? (
            <WinRateBySourceChart data={s.bySource} />
          ) : (
            <p className="text-gray-400 text-sm">No source data available</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Open Pipeline by Stage (with value)</h2>
        {s.byStage.filter(d => d.value > 0).length > 0 ? (
          <PipelineByStageChart data={s.byStage.filter(d => d.value > 0)} />
        ) : (
          <p className="text-gray-400 text-sm">No stages with dollar value attached</p>
        )}
      </div>

      {/* Stage table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Stage Details (all open deals)</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Stage</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Count</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {s.byStage.sort((a, b) => b.value - a.value || b.count - a.count).map((row) => (
              <tr key={row.stage} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-800">{row.stage}</td>
                <td className="px-6 py-3 text-right text-gray-600">{row.count}</td>
                <td className="px-6 py-3 text-right text-gray-600">{row.value > 0 ? formatUSD(row.value) : '—'}</td>
                <td className="px-6 py-3 text-right text-gray-600">{Math.round(row.avgDays)}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Source table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Lead Source Performance</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Source</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Total Deals</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Won</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Win Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {s.bySource
              .sort((a, b) => b.value - a.value)
              .map((row) => (
                <tr key={row.source} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-800">{row.source || 'Unknown'}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{row.count}</td>
                  <td className="px-6 py-3 text-right text-[#2EB872] font-medium">{row.wonCount}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{row.winRate.toFixed(1)}%</td>
                  <td className="px-6 py-3 text-right text-gray-600">{formatUSD(row.value)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function SalesSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 h-28" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6 h-80" />
    </div>
  )
}

export default function SalesPipelinePage() {
  return (
    <Suspense fallback={<SalesSkeleton />}>
      <SalesData />
    </Suspense>
  )
}
