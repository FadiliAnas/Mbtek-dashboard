import { NextResponse } from 'next/server'
import { getPipelines, getOpportunities, getContacts } from '@/lib/ghl'
import { getCalls } from '@/lib/justcall'
import { getNumberAnalytics, getAgentAnalytics } from '@/lib/justcall-analytics'
import { supabase } from '@/lib/supabase'

export const maxDuration = 300

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

async function upsertBatched(
  table: string,
  rows: Record<string, unknown>[],
  batchSize = 500
) {
  let total = 0
  for (const batch of chunk(rows, batchSize)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table) as any).upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(`${table} upsert: ${error.message}`)
    total += batch.length
  }
  return total
}

// Returns yyyy-mm-dd string for N days before today (UTC)
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split('T')[0]
}

const IVR_OPTIONS = [
  { digit: '1', name: 'Sales', color: '#F26522' },
  { digit: '2', name: 'Client Care', color: '#2EB872' },
  { digit: '3', name: 'Technical Support', color: '#3B82F6' },
]

// Fetch all stored calls from Supabase for a date range (paginated)
async function getStoredCalls(from: string, to: string) {
  const PAGE = 1000
  let offset = 0
  const result: { call_date: string; direction: string; ivr_digit: string | null }[] = []
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('justcall_calls')
      .select('call_date,direction,ivr_digit')
      .gte('call_date', `${from}T00:00:00.000Z`)
      .lte('call_date', `${to}T23:59:59.999Z`)
      .range(offset, offset + PAGE - 1) as any)
    if (error) throw new Error(`getStoredCalls: ${error.message}`)
    if (!data || data.length === 0) break
    result.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return result
}

function computeChartData(
  calls: { call_date: string; direction: string; ivr_digit: string | null }[],
  from: string,
  to: string
) {
  const fromDt = new Date(`${from}T00:00:00Z`)
  const toDt = new Date(`${to}T23:59:59Z`)

  // Build day map with all dates in range
  const dayMap: Record<string, { date: string; inbound: number; outbound: number }> = {}
  const cur = new Date(fromDt)
  while (cur <= toDt) {
    const key = cur.toISOString().split('T')[0]
    const label = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    dayMap[key] = { date: label, inbound: 0, outbound: 0 }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  const ivrCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0 }

  for (const call of calls) {
    const d = new Date(call.call_date)
    if (d < fromDt || d > toDt) continue
    const key = d.toISOString().split('T')[0]
    if (dayMap[key]) {
      if (call.direction === 'inbound') dayMap[key].inbound++
      else dayMap[key].outbound++
    }
    if (call.direction === 'inbound' && call.ivr_digit && ivrCounts[call.ivr_digit] !== undefined) {
      ivrCounts[call.ivr_digit]++
    }
  }

  const dailyData = Object.values(dayMap)
  const ivrData = IVR_OPTIONS.map(o => ({ ...o, count: ivrCounts[o.digit] }))

  return { dailyData, ivrData }
}

async function syncCallsAnalytics() {
  const yesterday = daysAgo(1)

  const periods = [
    { key: 'today',        from: yesterday,   to: yesterday,   prevFrom: daysAgo(2),   prevTo: daysAgo(2)   },
    { key: 'yesterday',    from: daysAgo(2),  to: daysAgo(2),  prevFrom: daysAgo(3),   prevTo: daysAgo(3)   },
    { key: 'last_week',    from: daysAgo(7),  to: yesterday,   prevFrom: daysAgo(14),  prevTo: daysAgo(8)   },
    { key: 'last_month',   from: daysAgo(30), to: yesterday,   prevFrom: daysAgo(60),  prevTo: daysAgo(31)  },
    { key: 'last_3months', from: daysAgo(90), to: yesterday,   prevFrom: daysAgo(180), prevTo: daysAgo(91)  },
  ]

  // Fetch all calls for the widest period once — reuse for all shorter periods
  const longestFrom = daysAgo(90)
  console.log('[sync] loading stored calls from Supabase...')
  const allStoredCalls = await getStoredCalls(longestFrom, yesterday)
  console.log(`[sync] ${allStoredCalls.length} stored calls loaded`)

  const synced_at = new Date().toISOString()
  const snapshots = []

  for (const p of periods) {
    console.log(`[sync] analytics snapshot: ${p.key} (${p.from} → ${p.to})`)

    const [summary, prevSummary, agents] = await Promise.all([
      getNumberAnalytics(p.from, p.to),
      getNumberAnalytics(p.prevFrom, p.prevTo),
      getAgentAnalytics(p.from, p.to),
    ])

    const { dailyData, ivrData } = computeChartData(allStoredCalls, p.from, p.to)

    snapshots.push({
      period: p.key,
      from_date: p.from,
      to_date: p.to,
      summary,
      prev_summary: prevSummary,
      agents,
      daily_data: dailyData,
      ivr_data: ivrData,
      synced_at,
    })
  }

  // Store each snapshot as a JSON file in Supabase Storage (no table DDL required)
  for (const snap of snapshots) {
    const { error } = await supabase.storage
      .from('analytics-cache')
      .upload(`snapshots/${snap.period}.json`, JSON.stringify(snap), {
        upsert: true,
        contentType: 'application/json',
      })
    if (error) throw new Error(`analytics-cache upload (${snap.period}): ${error.message}`)
  }

  return snapshots.length
}

export async function GET(request: Request) {
  return handleSync(request)
}

export async function POST(request: Request) {
  return handleSync(request)
}

async function handleSync(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const url = new URL(request.url)
  const isFull = url.searchParams.get('full') === 'true'
  const callDays = isFull ? 365 : 2

  const started = Date.now()
  const results: Record<string, number | string> = {}

  try {
    // ── 1. GHL Pipelines ──────────────────────────────────────────────────
    console.log('[sync] fetching pipelines...')
    const pipelines = await getPipelines()
    const pipelineRows = pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      stages: p.stages,
      synced_at: new Date().toISOString(),
    }))
    results.pipelines = await upsertBatched('ghl_pipelines', pipelineRows)
    console.log(`[sync] pipelines: ${results.pipelines}`)

    // ── 2. GHL Opportunities ──────────────────────────────────────────────
    console.log('[sync] fetching opportunities...')
    const rawOpportunities = await getOpportunities()
    const opportunities = [...new Map(rawOpportunities.map((o) => [o.id, o])).values()]
    const oppRows = opportunities.map((o) => ({
      id: String(o.id),
      name: o.name,
      monetary_value: o.monetaryValue ?? 0,
      status: o.status,
      pipeline_id: o.pipelineId,
      pipeline_stage_id: o.pipelineStageId,
      source: o.source ?? null,
      contact_id: o.contactId ?? null,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
      synced_at: new Date().toISOString(),
    }))
    results.opportunities = await upsertBatched('ghl_opportunities', oppRows)
    console.log(`[sync] opportunities: ${results.opportunities}`)

    // ── 3. GHL Contacts (full sync only — too slow for daily cron) ───────────
    if (isFull) {
      console.log('[sync] fetching contacts...')
      try {
        const contacts = await getContacts()
        const contactRows = contacts.map((c) => ({
          id: String(c.id),
          first_name: c.firstName ?? null,
          last_name: c.lastName ?? null,
          email: c.email ?? null,
          source: c.source ?? null,
          tags: c.tags ?? [],
          date_added: c.dateAdded,
          date_updated: c.dateUpdated ?? null,
          synced_at: new Date().toISOString(),
        }))
        results.contacts = await upsertBatched('ghl_contacts', contactRows)
        console.log(`[sync] contacts: ${results.contacts}`)
      } catch (contactErr) {
        const msg = contactErr instanceof Error ? contactErr.message : String(contactErr)
        console.warn(`[sync] contacts skipped: ${msg}`)
        results.contacts = `skipped: ${msg}`
      }
    } else {
      results.contacts = 'skipped (incremental)'
    }

    // ── 4. JustCall Calls ─────────────────────────────────────────────────
    console.log(`[sync] fetching calls (last ${callDays} days)...`)
    const now = new Date()
    const fromDate = new Date()
    fromDate.setDate(now.getDate() - callDays)
    const calls = await getCalls(
      fromDate.toISOString().split('T')[0],
      now.toISOString().split('T')[0]
    )
    const callRows = calls.map((c) => ({
      id: String(c.id),
      direction: c.direction,
      status: c.status,
      duration: c.duration ?? 0,
      call_date: c.call_date,
      ivr_digit: c.ivr_digit ?? null,
      agent_name: c.agent_name ?? null,
      synced_at: new Date().toISOString(),
    }))
    results.calls = await upsertBatched('justcall_calls', callRows)
    console.log(`[sync] calls: ${results.calls}`)

    // ── 5. JustCall Analytics Snapshots ───────────────────────────────────
    console.log('[sync] computing analytics snapshots...')
    results.analytics_snapshots = await syncCallsAnalytics()
    console.log(`[sync] analytics snapshots: ${results.analytics_snapshots}`)

    const duration_ms = Date.now() - started
    await supabase.from('sync_log').insert({
      source: isFull ? 'full' : 'incremental',
      records_synced:
        Number(results.pipelines) +
        Number(results.opportunities) +
        Number(results.contacts) +
        Number(results.calls),
      completed_at: new Date().toISOString(),
      duration_ms,
    })

    return NextResponse.json({ ok: true, mode: isFull ? 'full' : 'incremental', duration_ms, synced: results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync] error:', msg)
    await supabase.from('sync_log').insert({
      source: isFull ? 'full' : 'incremental',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      error: msg,
    })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
