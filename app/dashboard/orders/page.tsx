import { Suspense } from 'react'
import { dbGetOpportunities, dbGetPipelines } from '@/lib/db'

export const dynamic = 'force-dynamic'
import {
  formatUSD,
  startOfMonth,
  startOfLastMonth,
  endOfLastMonth,
  pctChange,
  daysAgo,
} from '@/lib/metrics'
import { OrdersByStageChart } from '@/components/Charts'

// Identify "shipped" and "delivered" stage name patterns
const SHIPPED_NAMES = new Set(['shipped', 'shipping'])
const DELIVERED_NAMES = new Set(['delivered', 'delivery', 'complete', 'completed'])
const LATE_SHIP_DAYS = 7   // orders in shipping > 7 days = late

async function OrdersData() {
  const [opportunities, pipelines] = await Promise.all([
    dbGetOpportunities(),
    dbGetPipelines(),
  ])

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfLastMonth(now)
  const lastMonthEnd = endOfLastMonth(now)
  const ninetyAgo = daysAgo(90)

  // Identify pipelines by name
  const orderPipeline = pipelines.find((p) => p.name === 'Order Pipeline')
  const refundsPipeline = pipelines.find((p) => p.name === 'Refunds')
  const supportPipeline = pipelines.find((p) =>
    p.name === 'Support Pipeline' || p.name === 'Help Desk'
  )
  const clientCarePipeline = pipelines.find((p) => p.name === 'Client Care')

  const orderOpps = orderPipeline
    ? opportunities.filter((o) => o.pipelineId === orderPipeline.id)
    : []
  const refundOpps = refundsPipeline
    ? opportunities.filter((o) => o.pipelineId === refundsPipeline.id)
    : []
  const supportOpps = supportPipeline
    ? opportunities.filter((o) => o.pipelineId === supportPipeline.id)
    : clientCarePipeline
    ? opportunities.filter((o) => o.pipelineId === clientCarePipeline.id)
    : []

  // Build stage name map for order pipeline
  const stageById: Record<string, string> = {}
  orderPipeline?.stages.forEach((s) => { stageById[s.id] = s.name })

  // Orders this month / last month
  const ordersThisMonth = orderOpps.filter((o) => new Date(o.createdAt) >= thisMonthStart)
  const ordersLastMonth = orderOpps.filter((o) => {
    const d = new Date(o.createdAt)
    return d >= lastMonthStart && d <= lastMonthEnd
  })
  const revenueThisMonth = ordersThisMonth.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)
  const revenueLastMonth = ordersLastMonth.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  // Refunds this month
  const refundsThisMonth = refundOpps.filter((o) => new Date(o.createdAt) >= thisMonthStart)
  const refundValueThisMonth = refundsThisMonth.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)
  const refundRateLast90 =
    orderOpps.filter((o) => new Date(o.createdAt) >= ninetyAgo).length > 0
      ? (refundOpps.filter((o) => new Date(o.createdAt) >= ninetyAgo).length /
          orderOpps.filter((o) => new Date(o.createdAt) >= ninetyAgo).length) *
        100
      : 0

  // Identify delivered and shipped orders
  const deliveredOrders = orderOpps.filter((o) => {
    const name = (stageById[o.pipelineStageId] ?? '').toLowerCase()
    return DELIVERED_NAMES.has(name)
  })
  const shippedOrders = orderOpps.filter((o) => {
    const name = (stageById[o.pipelineStageId] ?? '').toLowerCase()
    return SHIPPED_NAMES.has(name)
  })

  // Avg days to ship (creation to updatedAt for shipped/delivered, proxy)
  const shippedAndDelivered = [...shippedOrders, ...deliveredOrders]
  const avgDaysToShip =
    shippedAndDelivered.length > 0
      ? shippedAndDelivered.reduce((s, o) => {
          return s + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000
        }, 0) / shippedAndDelivered.length
      : 0

  // Avg days to deliver (for delivered orders only — longer pipeline time)
  const avgDaysToDeliver =
    deliveredOrders.length > 0
      ? deliveredOrders.reduce((s, o) => {
          return s + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000
        }, 0) / deliveredOrders.length
      : 0

  // Late orders: in "Shipped" stage with updatedAt > LATE_SHIP_DAYS ago
  const lateThreshold = daysAgo(LATE_SHIP_DAYS)
  const lateOrders = shippedOrders.filter((o) => new Date(o.updatedAt) < lateThreshold).length

  // Support tickets per order (last 90 days)
  const recentOrders90 = orderOpps.filter((o) => new Date(o.createdAt) >= ninetyAgo).length
  const recentSupport90 = supportOpps.filter((o) => new Date(o.createdAt) >= ninetyAgo).length
  const supportRatio = recentOrders90 > 0 ? recentSupport90 / recentOrders90 : 0

  // Orders by stage (all order pipeline opps)
  const stageAgg: Record<string, { count: number; value: number; position: number }> = {}
  orderOpps.forEach((o) => {
    const stage = orderPipeline?.stages.find((s) => s.id === o.pipelineStageId)
    const name = stage?.name ?? 'Unknown'
    const position = stage?.position ?? 999
    if (!stageAgg[name]) stageAgg[name] = { count: 0, value: 0, position }
    stageAgg[name].count++
    stageAgg[name].value += o.monetaryValue ?? 0
  })
  const byStage = Object.entries(stageAgg)
    .map(([stage, d]) => ({ stage, count: d.count, value: d.value, position: d.position }))
    .sort((a, b) => a.position - b.position)

  // Refund pipeline stages breakdown
  const refundStageAgg: Record<string, number> = {}
  refundOpps.forEach((o) => {
    const stageName = refundsPipeline?.stages.find((s) => s.id === o.pipelineStageId)?.name ?? 'Unknown'
    refundStageAgg[stageName] = (refundStageAgg[stageName] ?? 0) + 1
  })

  const orderCountChange = pctChange(ordersThisMonth.length, ordersLastMonth.length)
  const revenueChange = pctChange(revenueThisMonth, revenueLastMonth)

  return (
    <>
      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Orders This Month</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{ordersThisMonth.length}</p>
          {orderCountChange !== null && (
            <p className={`text-xs mt-1 ${orderCountChange >= 0 ? 'text-[#2EB872]' : 'text-[#E74C3C]'}`}>
              {orderCountChange >= 0 ? '▲' : '▼'} {Math.abs(orderCountChange).toFixed(1)}% vs last month
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Revenue This Month</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{formatUSD(revenueThisMonth)}</p>
          {revenueChange !== null && (
            <p className={`text-xs mt-1 ${revenueChange >= 0 ? 'text-[#2EB872]' : 'text-[#E74C3C]'}`}>
              {revenueChange >= 0 ? '▲' : '▼'} {Math.abs(revenueChange).toFixed(1)}% vs last month
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Refunds This Month</p>
          <p className="text-3xl font-bold text-[#E74C3C]">{refundsThisMonth.length}</p>
          <p className="text-xs text-gray-400 mt-1">{formatUSD(refundValueThisMonth)} value</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Refund Rate (90d)</p>
          <p className="text-3xl font-bold text-[#F39C12]">{refundRateLast90.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">refunds / orders</p>
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Avg Days to Ship</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{avgDaysToShip.toFixed(1)}d</p>
          <p className="text-xs text-gray-400 mt-1">order → shipped</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Avg Days to Deliver</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{avgDaysToDeliver.toFixed(1)}d</p>
          <p className="text-xs text-gray-400 mt-1">order → delivered</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Late Shipments</p>
          <p className={`text-3xl font-bold ${lateOrders > 0 ? 'text-[#E74C3C]' : 'text-[#2EB872]'}`}>
            {lateOrders}
          </p>
          <p className="text-xs text-gray-400 mt-1">in shipping &gt;{LATE_SHIP_DAYS} days</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Support / Order Ratio</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{supportRatio.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">tickets per order (90d)</p>
        </div>
      </div>

      {/* Orders by Stage chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Orders by Stage</h2>
          {byStage.length > 0 ? (
            <OrdersByStageChart data={byStage} />
          ) : (
            <p className="text-gray-400 text-sm">No order pipeline data found</p>
          )}
        </div>

        {/* Refund breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Refund Pipeline Breakdown</h2>
          {Object.keys(refundStageAgg).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(refundStageAgg)
                .sort((a, b) => b[1] - a[1])
                .map(([stage, count]) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 flex-1">{stage}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-[#E74C3C] h-2 rounded-full"
                        style={{
                          width: `${(count / refundOpps.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-[#1A1A1A] w-8 text-right">{count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No refund data</p>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Total refunds (all time)</span>
            <span className="font-semibold text-[#E74C3C]">{refundOpps.length}</span>
          </div>
        </div>
      </div>

      {/* Stage detail table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Order Stage Detail</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Stage</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Orders</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {byStage.length > 0 ? (
              byStage.map((row) => (
                <tr key={row.stage} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-800">{row.stage}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{row.count}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{formatUSD(row.value)}</td>
                  <td className="px-6 py-3 text-right text-gray-600">
                    {row.count > 0 ? formatUSD(row.value / row.count) : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">
                  {orderPipeline ? 'No orders found' : 'Order Pipeline not found in GHL'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Monthly comparison */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Comparison</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{ordersThisMonth.length} orders</p>
            <p className="text-sm text-gray-500">{formatUSD(revenueThisMonth)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last Month</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{ordersLastMonth.length} orders</p>
            <p className="text-sm text-gray-500">{formatUSD(revenueLastMonth)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Pipeline</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{orderOpps.length} orders</p>
            <p className="text-sm text-gray-500">
              {formatUSD(orderOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0))}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function OrdersSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-64" />
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-64" />
      </div>
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersData />
    </Suspense>
  )
}
