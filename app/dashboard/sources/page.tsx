import { Suspense } from 'react'
import { dbGetOpportunities, dbGetContacts, dbGetPipelines } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { formatUSD, buildStageNameById, isWon } from '@/lib/metrics'
import { LeadSourcePie } from '@/components/Charts'

async function SourcesData() {
  const [opportunities, contacts, pipelines] = await Promise.all([
    dbGetOpportunities(),
    dbGetContacts(),
    dbGetPipelines(),
  ])

  const stageNameById = buildStageNameById(pipelines)

  // Leads by source
  const leadsBySource: Record<string, number> = {}
  contacts.forEach((c) => {
    const src = c.source || 'Unknown'
    leadsBySource[src] = (leadsBySource[src] ?? 0) + 1
  })
  const pieData = Object.entries(leadsBySource)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Source aggregation from opportunities
  const sourceAgg: Record<string, {
    count: number
    wonCount: number
    wonValue: number
    totalDaysToConvert: number
  }> = {}

  opportunities.forEach((o) => {
    const src = o.source || 'Unknown'
    if (!sourceAgg[src]) sourceAgg[src] = { count: 0, wonCount: 0, wonValue: 0, totalDaysToConvert: 0 }
    sourceAgg[src].count++
    if (isWon(o, stageNameById)) {
      sourceAgg[src].wonCount++
      sourceAgg[src].wonValue += o.monetaryValue ?? 0
      const daysToConvert =
        (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000
      sourceAgg[src].totalDaysToConvert += daysToConvert
    }
  })

  const sourceRows = Object.entries(sourceAgg)
    .map(([source, d]) => ({
      source,
      leads: leadsBySource[source] ?? 0,
      deals: d.count,
      won: d.wonCount,
      revenue: d.wonValue,
      convRate: d.count > 0 ? (d.wonCount / d.count) * 100 : 0,
      avgDealSize: d.wonCount > 0 ? d.wonValue / d.wonCount : 0,
      avgDaysToConvert: d.wonCount > 0 ? d.totalDaysToConvert / d.wonCount : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const totalLeads = contacts.length
  const totalWon = opportunities.filter((o) => isWon(o, stageNameById)).length
  const totalRevenue = opportunities
    .filter((o) => isWon(o, stageNameById))
    .reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  return (
    <>
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Leads</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{totalLeads.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Won</p>
          <p className="text-3xl font-bold text-[#2EB872]">{totalWon.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Revenue (Won)</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{formatUSD(totalRevenue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Leads by Source</h2>
          {pieData.length > 0 ? (
            <LeadSourcePie data={pieData} />
          ) : (
            <p className="text-gray-400 text-sm">No data available</p>
          )}
        </div>

        {/* Source bar summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Sources by Leads</h2>
          <div className="space-y-3">
            {pieData.slice(0, 7).map((row) => (
              <div key={row.source} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-28 truncate" title={row.source}>
                  {row.source}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-[#F26522] h-2 rounded-full"
                    style={{
                      width: `${totalLeads > 0 ? (row.count / totalLeads) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-[#1A1A1A] w-16 text-right">
                  {row.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full source performance table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Source Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Source</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Leads</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Deals</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Won</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Conv. Rate</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Deal Size</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Days to Win</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sourceRows.length > 0 ? (
                sourceRows.map((row) => (
                  <tr key={row.source} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-800">{row.source || 'Unknown'}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{row.leads.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{row.deals}</td>
                    <td className="px-6 py-3 text-right text-[#2EB872] font-medium">{row.won}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{row.convRate.toFixed(1)}%</td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {row.won > 0 ? formatUSD(row.avgDealSize) : '—'}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {row.won > 0 ? `${Math.round(row.avgDaysToConvert)}d` : '—'}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-[#1A1A1A]">
                      {row.revenue > 0 ? formatUSD(row.revenue) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400 text-sm">
                    No source data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default function SourcesPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6 h-72" />
            <div className="bg-white rounded-xl border border-gray-100 p-6 h-72" />
          </div>
        </div>
      }
    >
      <SourcesData />
    </Suspense>
  )
}
