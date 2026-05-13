import type { GHLOpportunity, GHLContact, GHLPipeline } from './ghl'
import type { JCCall } from './justcall'

export function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function startOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function startOfLastMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
}

export function endOfLastMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0, 23, 59, 59))
}

export function daysAgo(n: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// Month label: "Jan 25"
export function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

// MBtek revenue stages: Sales pipeline "Won"/"Closed Won" + Order Pipeline fulfillment stages
const WON_STAGE_NAMES = new Set(['won', 'closed won', 'processed', 'shipped', 'delivered'])

// Pipelines that represent refunds/tickets (excluded from sales open-pipeline value)
const NON_REVENUE_PIPELINE_NAMES = new Set(['refunds'])

export function buildStageNameById(pipelines: GHLPipeline[]): Record<string, string> {
  const m: Record<string, string> = {}
  pipelines.forEach((p) => p.stages.forEach((s) => { m[s.id] = s.name }))
  return m
}

export function buildPipelineIdByStageId(pipelines: GHLPipeline[]): Record<string, string> {
  const m: Record<string, string> = {}
  pipelines.forEach((p) => p.stages.forEach((s) => { m[s.id] = p.id }))
  return m
}

export function isWon(opp: GHLOpportunity, stageNameById: Record<string, string>): boolean {
  if (opp.status === 'won') return true
  const stageName = (stageNameById[opp.pipelineStageId] ?? '').toLowerCase().trim()
  return WON_STAGE_NAMES.has(stageName)
}

export function isNonRevenuePipeline(pipeline: GHLPipeline): boolean {
  return NON_REVENUE_PIPELINE_NAMES.has(pipeline.name.toLowerCase())
}

export interface ExecutiveSummary {
  revenueThisMonth: number
  revenueLastMonth: number
  openPipelineValue: number
  newLeadsThisWeek: number
  dealsClosedThisMonth: number
  avgDealSize: number
  winRate: number
  topLeadSource: string
  revenueByMonth: { month: string; revenue: number }[]
  leadsByDay: { date: string; leads: number; deals: number }[]
  pipelineByStage: { stage: string; value: number; count: number }[]
}

export function computeExecutiveSummary(
  opportunities: GHLOpportunity[],
  contacts: GHLContact[],
  pipelines: GHLPipeline[]
): ExecutiveSummary {
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfLastMonth(now)
  const lastMonthEnd = endOfLastMonth(now)
  const weekAgo = daysAgo(7)
  const thirtyAgo = daysAgo(30)
  const ninetyAgo = daysAgo(90)

  const stageNameById = buildStageNameById(pipelines)

  // Non-revenue pipeline IDs (refunds, etc.) — excluded from open pipeline value
  const nonRevenuePipelineIds = new Set(
    pipelines.filter(isNonRevenuePipeline).map((p) => p.id)
  )

  // Revenue this month = won/fulfilled deals updated/closed this month
  const wonThisMonth = opportunities.filter((o) => {
    if (!isWon(o, stageNameById)) return false
    const d = new Date(o.updatedAt)
    return d >= thisMonthStart
  })
  const revenueThisMonth = wonThisMonth.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  // Revenue last month
  const wonLastMonth = opportunities.filter((o) => {
    if (!isWon(o, stageNameById)) return false
    const d = new Date(o.updatedAt)
    return d >= lastMonthStart && d <= lastMonthEnd
  })
  const revenueLastMonth = wonLastMonth.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  // Open pipeline — exclude non-revenue pipelines (refunds, etc.)
  const openOpps = opportunities.filter(
    (o) => o.status === 'open' && !nonRevenuePipelineIds.has(o.pipelineId)
  )
  const openPipelineValue = openOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  // New leads this week (contacts)
  const newLeadsThisWeek = contacts.filter((c) => new Date(c.dateAdded) >= weekAgo).length

  // Deals closed this month
  const dealsClosedThisMonth = wonThisMonth.length

  // Avg deal size (all won last 90 days)
  const wonLast90 = opportunities.filter((o) => {
    if (!isWon(o, stageNameById)) return false
    return new Date(o.updatedAt) >= ninetyAgo
  })
  const avgDealSize =
    wonLast90.length > 0
      ? wonLast90.reduce((s, o) => s + (o.monetaryValue ?? 0), 0) / wonLast90.length
      : 0

  // Win rate (last 30 days closed/lost)
  const closedLast30 = opportunities.filter((o) => {
    const d = new Date(o.updatedAt)
    if (d < thirtyAgo) return false
    return isWon(o, stageNameById) || o.status === 'lost'
  })
  const winRate =
    closedLast30.length > 0
      ? (closedLast30.filter((o) => isWon(o, stageNameById)).length / closedLast30.length) * 100
      : 0

  // Top lead source this month
  const sourceCount: Record<string, number> = {}
  contacts
    .filter((c) => new Date(c.dateAdded) >= thisMonthStart)
    .forEach((c) => {
      const src = c.source || 'Unknown'
      sourceCount[src] = (sourceCount[src] ?? 0) + 1
    })
  const topLeadSource =
    Object.entries(sourceCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

  // Revenue by month (last 12 months)
  const revenueByMonth: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    revenueByMonth[monthLabel(d)] = 0
  }
  opportunities.forEach((o) => {
    if (!isWon(o, stageNameById)) return
    const d = new Date(o.updatedAt)
    const lbl = monthLabel(d)
    if (lbl in revenueByMonth) {
      revenueByMonth[lbl] += o.monetaryValue ?? 0
    }
  })
  const revenueByMonthArr = Object.entries(revenueByMonth).map(([month, revenue]) => ({
    month,
    revenue,
  }))

  // Leads vs deals last 13 weeks (weekly buckets)
  const leadsByDay: { date: string; leads: number; deals: number }[] = []
  for (let i = 12; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - i * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const leads = contacts.filter((c) => {
      const d = new Date(c.dateAdded)
      return d >= weekStart && d < weekEnd
    }).length

    const deals = opportunities.filter((o) => {
      if (!isWon(o, stageNameById)) return false
      const d = new Date(o.updatedAt)
      return d >= weekStart && d < weekEnd
    }).length

    leadsByDay.push({
      date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      leads,
      deals,
    })
  }

  // Pipeline by stage (open opps)
  const stageMap: Record<string, { name: string; pipeline: string }> = {}
  pipelines.forEach((p) => {
    p.stages.forEach((s) => {
      stageMap[s.id] = { name: s.name, pipeline: p.name }
    })
  })

  const stageAgg: Record<string, { value: number; count: number }> = {}
  // Use ALL opps (won + open) for the stage chart, excluding non-revenue pipelines
  opportunities
    .filter((o) => !nonRevenuePipelineIds.has(o.pipelineId))
    .forEach((o) => {
      const stageName = stageMap[o.pipelineStageId]?.name ?? 'Unknown Stage'
      if (!stageAgg[stageName]) stageAgg[stageName] = { value: 0, count: 0 }
      stageAgg[stageName].value += o.monetaryValue ?? 0
      stageAgg[stageName].count++
    })
  const pipelineByStage = Object.entries(stageAgg)
    .map(([stage, { value, count }]) => ({ stage, value, count }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)

  return {
    revenueThisMonth,
    revenueLastMonth,
    openPipelineValue,
    newLeadsThisWeek,
    dealsClosedThisMonth,
    avgDealSize,
    winRate,
    topLeadSource,
    revenueByMonth: revenueByMonthArr,
    leadsByDay,
    pipelineByStage,
  }
}

export interface SalesSummary {
  openCount: number
  openValue: number
  wonThisMonth: number
  wonThisMonthValue: number
  wonThisQuarter: number
  lostThisMonth: number
  winRate: number
  avgDealSize: number
  avgSalesCycleDays: number
  byStage: { stage: string; count: number; value: number; avgDays: number }[]
  bySource: { source: string; count: number; value: number; wonCount: number; winRate: number; avgDealSize: number; avgDaysToConvert: number }[]
  funnelStages: { name: string; count: number }[]
}

export function computeSalesSummary(
  opportunities: GHLOpportunity[],
  pipelines: GHLPipeline[]
): SalesSummary {
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const quarterStart = new Date(
    Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)
  )

  const stageNameById = buildStageNameById(pipelines)
  const stageMap: Record<string, { name: string; position: number }> = {}
  pipelines.forEach((p) => p.stages.forEach((s) => (stageMap[s.id] = s)))

  // Exclude non-revenue pipelines (Refunds) from all sales metrics
  const nonRevenuePipelineIds = new Set(
    pipelines.filter(isNonRevenuePipeline).map((p) => p.id)
  )

  const open = opportunities.filter(
    (o) => o.status === 'open' && !nonRevenuePipelineIds.has(o.pipelineId)
  )
  const wonMonth = opportunities.filter(
    (o) => isWon(o, stageNameById) && new Date(o.updatedAt) >= thisMonthStart
  )
  const wonQuarter = opportunities.filter(
    (o) => isWon(o, stageNameById) && new Date(o.updatedAt) >= quarterStart
  )
  const lostMonth = opportunities.filter(
    (o) => o.status === 'lost' && new Date(o.updatedAt) >= thisMonthStart
  )

  const closedAll = opportunities.filter((o) => isWon(o, stageNameById) || o.status === 'lost')
  const winRate =
    closedAll.length > 0 ? (closedAll.filter((o) => isWon(o, stageNameById)).length / closedAll.length) * 100 : 0

  const wonAll = opportunities.filter((o) => isWon(o, stageNameById))
  const avgDealSize =
    wonAll.length > 0 ? wonAll.reduce((s, o) => s + (o.monetaryValue ?? 0), 0) / wonAll.length : 0

  // Avg sales cycle (creation to won)
  const cycleDays = wonAll
    .filter((o) => o.createdAt && o.updatedAt)
    .map((o) => (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000)
  const avgSalesCycleDays =
    cycleDays.length > 0 ? cycleDays.reduce((s, d) => s + d, 0) / cycleDays.length : 0

  // By stage (open deals, excluding non-revenue pipelines)
  const stageAgg: Record<string, { count: number; value: number; totalDays: number }> = {}
  open.forEach((o) => {
    const name = stageMap[o.pipelineStageId]?.name ?? 'Unknown'
    if (!stageAgg[name]) stageAgg[name] = { count: 0, value: 0, totalDays: 0 }
    stageAgg[name].count++
    stageAgg[name].value += o.monetaryValue ?? 0
    stageAgg[name].totalDays += (now.getTime() - new Date(o.createdAt).getTime()) / 86400000
  })
  const byStage = Object.entries(stageAgg).map(([stage, d]) => ({
    stage,
    count: d.count,
    value: d.value,
    avgDays: d.count > 0 ? d.totalDays / d.count : 0,
  }))

  // By source
  const sourceAgg: Record<string, { count: number; value: number; wonCount: number; wonValue: number; totalDays: number }> = {}
  opportunities.forEach((o) => {
    const src = o.source || 'Unknown'
    if (!sourceAgg[src]) sourceAgg[src] = { count: 0, value: 0, wonCount: 0, wonValue: 0, totalDays: 0 }
    sourceAgg[src].count++
    sourceAgg[src].value += o.monetaryValue ?? 0
    if (isWon(o, stageNameById)) {
      sourceAgg[src].wonCount++
      sourceAgg[src].wonValue += o.monetaryValue ?? 0
      sourceAgg[src].totalDays += (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000
    }
  })
  const bySource = Object.entries(sourceAgg).map(([source, d]) => ({
    source,
    count: d.count,
    value: d.value,
    wonCount: d.wonCount,
    winRate: d.count > 0 ? (d.wonCount / d.count) * 100 : 0,
    avgDealSize: d.wonCount > 0 ? d.wonValue / d.wonCount : 0,
    avgDaysToConvert: d.wonCount > 0 ? d.totalDays / d.wonCount : 0,
  }))

  // Funnel: use "Sales Pipeline New" if available, else first pipeline
  const salesPipeline =
    pipelines.find((p) => p.name === 'Sales Pipeline New') ?? pipelines[0]
  const funnelOrder = salesPipeline?.stages.sort((a, b) => a.position - b.position) ?? []
  const funnelStages = funnelOrder
    .map((stage) => ({
      name: stage.name,
      count: opportunities.filter(
        (o) => o.pipelineStageId === stage.id && o.status === 'open'
      ).length,
    }))
    .filter((s) => s.count > 0)

  return {
    openCount: open.length,
    openValue: open.reduce((s, o) => s + (o.monetaryValue ?? 0), 0),
    wonThisMonth: wonMonth.length,
    wonThisMonthValue: wonMonth.reduce((s, o) => s + (o.monetaryValue ?? 0), 0),
    wonThisQuarter: wonQuarter.length,
    lostThisMonth: lostMonth.length,
    winRate,
    avgDealSize,
    avgSalesCycleDays,
    byStage,
    bySource,
    funnelStages,
  }
}
