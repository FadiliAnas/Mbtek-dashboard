import { NextResponse } from 'next/server'
import { getPipelines, getOpportunities, getContacts } from '@/lib/ghl'
import { getCalls } from '@/lib/justcall'
import { supabase } from '@/lib/supabase'

// Vercel Cron calls this daily at midnight EST with Authorization: Bearer <CRON_SECRET>
// Manual full resync: POST /api/sync?full=true
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
  // Daily cron uses incremental (last 2 days). Pass ?full=true for a complete historical resync.
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

    // ── 3. GHL Contacts ────────────────────────────────────────────────────
    console.log('[sync] fetching contacts...')
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
