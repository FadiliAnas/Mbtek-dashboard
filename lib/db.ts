import { supabase } from './supabase'
import type { GHLPipeline, GHLOpportunity, GHLContact } from './ghl'
import type { JCCall } from './justcall'

export async function dbGetPipelines(): Promise<GHLPipeline[]> {
  const { data, error } = await supabase
    .from('ghl_pipelines')
    .select('id, name, stages')
  if (error) throw new Error(`dbGetPipelines: ${error.message}`)
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    stages: r.stages as GHLPipeline['stages'],
  }))
}

export async function dbGetOpportunities(fromDate?: Date, toDate?: Date): Promise<GHLOpportunity[]> {
  // Fetch in pages of 1000 (Supabase default limit is 1000)
  const all: GHLOpportunity[] = []
  let from = 0
  const PAGE = 1000

  while (true) {
    let q = supabase
      .from('ghl_opportunities')
      .select('id, name, monetary_value, status, pipeline_id, pipeline_stage_id, source, contact_id, created_at, updated_at')
    if (fromDate) q = (q as any).gte('created_at', fromDate.toISOString())
    if (toDate)   q = (q as any).lte('created_at', toDate.toISOString())
    const { data, error } = await (q as any).range(from, from + PAGE - 1)

    if (error) throw new Error(`dbGetOpportunities: ${error.message}`)
    if (!data || data.length === 0) break

    all.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...data.map((r: any) => ({
        id: r.id,
        name: r.name ?? '',
        monetaryValue: Number(r.monetary_value ?? 0),
        status: r.status as GHLOpportunity['status'],
        pipelineId: r.pipeline_id,
        pipelineStageId: r.pipeline_stage_id,
        source: r.source ?? undefined,
        contactId: r.contact_id ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }))
    )

    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

export async function dbGetContacts(fromDate?: Date, toDate?: Date): Promise<GHLContact[]> {
  const all: GHLContact[] = []
  let from = 0
  const PAGE = 1000

  while (true) {
    let q = supabase
      .from('ghl_contacts')
      .select('id, first_name, last_name, email, source, tags, date_added, date_updated')
    if (fromDate) q = (q as any).gte('date_added', fromDate.toISOString())
    if (toDate)   q = (q as any).lte('date_added', toDate.toISOString())
    const { data, error } = await (q as any).range(from, from + PAGE - 1)

    if (error) throw new Error(`dbGetContacts: ${error.message}`)
    if (!data || data.length === 0) break

    all.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...data.map((r: any) => ({
        id: r.id,
        firstName: r.first_name ?? undefined,
        lastName: r.last_name ?? undefined,
        email: r.email ?? undefined,
        source: r.source ?? undefined,
        tags: (r.tags as string[]) ?? [],
        dateAdded: r.date_added,
        dateUpdated: r.date_updated ?? undefined,
      }))
    )

    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

export async function dbGetCalls(daysBack = 90): Promise<JCCall[]> {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const all: JCCall[] = []
  let from = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('justcall_calls')
      .select('id, direction, status, duration, call_date, ivr_digit, agent_name')
      .gte('call_date', since.toISOString())
      .order('call_date', { ascending: false })
      .range(from, from + PAGE - 1)

    if (error) throw new Error(`dbGetCalls: ${error.message}`)
    if (!data || data.length === 0) break

    all.push(
      ...data.map((r) => ({
        id: r.id,
        direction: r.direction as JCCall['direction'],
        status: r.status as JCCall['status'],
        duration: r.duration ?? 0,
        call_date: r.call_date,
        ivr_digit: r.ivr_digit ?? undefined,
        agent_name: r.agent_name ?? undefined,
      }))
    )

    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

// Last sync timestamp
export async function dbGetLastSync(): Promise<string | null> {
  const { data } = await supabase
    .from('sync_log')
    .select('completed_at')
    .is('error', null)
    .order('completed_at', { ascending: false })
    .limit(1)
  return data?.[0]?.completed_at ?? null
}
