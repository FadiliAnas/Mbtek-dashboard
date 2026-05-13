import { Suspense } from 'react'
import { dbGetOpportunities, dbGetContacts, dbGetPipelines } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { computeExecutiveSummary, formatUSD, pctChange } from '@/lib/metrics'
import { KpiCard } from '@/components/KpiCard'
import {
  RevenueChart,
  LeadsVsDealsChart,
  PipelineByStageChart,
} from '@/components/Charts'

async function DashboardData() {
  const [opportunities, contacts, pipelines] = await Promise.all([
    dbGetOpportunities(),
    dbGetContacts(),
    dbGetPipelines(),
  ])

  const s = computeExecutiveSummary(opportunities, contacts, pipelines)
  const revChange = pctChange(s.revenueThisMonth, s.revenueLastMonth)

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard
          label="Revenue This Month"
          value={s.revenueThisMonth}
          format="usd"
          change={revChange}
        />
        <KpiCard label="Open Pipeline" value={s.openPipelineValue} format="usd" />
        <KpiCard
          label="New Leads This Week"
          value={s.newLeadsThisWeek}
          format="number"
        />
        <KpiCard
          label="Deals Closed This Month"
          value={s.dealsClosedThisMonth}
          format="number"
        />
        <KpiCard label="Avg Deal Size" value={s.avgDealSize} format="usd" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue — Last 12 Months</h2>
          <RevenueChart data={s.revenueByMonth} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline by Stage</h2>
          <PipelineByStageChart data={s.pipelineByStage} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          New Leads vs Deals Won — Last 13 Weeks
        </h2>
        <LeadsVsDealsChart data={s.leadsByDay} />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Win Rate (30 days)</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">{s.winRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Revenue Last Month</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">{formatUSD(s.revenueLastMonth)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Top Lead Source</p>
          <p className="text-2xl font-bold text-[#1A1A1A] truncate">{s.topLeadSource}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Open Opportunities</p>
          <p className="text-2xl font-bold text-[#1A1A1A]">
            {opportunities.filter((o) => o.status === 'open').length}
          </p>
        </div>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 p-6 h-72" />
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-72" />
      </div>
    </div>
  )
}

export default function ExecutiveSummaryPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  )
}
