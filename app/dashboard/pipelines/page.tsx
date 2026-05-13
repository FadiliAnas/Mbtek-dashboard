import { dbGetOpportunities, dbGetPipelines } from '@/lib/db'
import { PipelinesAuditClient } from '@/components/PipelinesAuditClient'

export const dynamic = 'force-dynamic'

export default async function PipelinesAuditPage() {
  const [pipelines, opportunities] = await Promise.all([
    dbGetPipelines(),
    dbGetOpportunities(),
  ])

  // Build per-pipeline breakdown server-side, pass serializable data to client
  const pipelineData = pipelines.map((pipeline) => {
    const opps = opportunities.filter((o) => o.pipelineId === pipeline.id)

    const stageAgg: Record<string, { count: number; value: number }> = {}
    for (const s of pipeline.stages) stageAgg[s.id] = { count: 0, value: 0 }

    for (const o of opps) {
      const sid = o.pipelineStageId
      if (!stageAgg[sid]) stageAgg[sid] = { count: 0, value: 0 }
      stageAgg[sid].count++
      stageAgg[sid].value += o.monetaryValue ?? 0
    }

    const statusTotals: Record<string, number> = {}
    for (const o of opps) {
      const st = o.status ?? 'unknown'
      statusTotals[st] = (statusTotals[st] ?? 0) + 1
    }

    const stages = pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      count: stageAgg[s.id]?.count ?? 0,
      value: stageAgg[s.id]?.value ?? 0,
      avgValue:
        (stageAgg[s.id]?.count ?? 0) > 0
          ? (stageAgg[s.id]?.value ?? 0) / stageAgg[s.id].count
          : 0,
    }))

    return {
      id: pipeline.id,
      name: pipeline.name,
      stages,
      totalCount: opps.length,
      totalValue: opps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0),
      withValue: opps.filter((o) => (o.monetaryValue ?? 0) > 0).length,
      statusTotals,
    }
  })

  return <PipelinesAuditClient pipelines={pipelineData} />
}
