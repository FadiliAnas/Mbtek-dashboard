import { NextResponse } from 'next/server'
import { getPipelines, getOpportunities, getContacts } from '@/lib/ghl'
import { getCalls } from '@/lib/justcall'
import { supabase } from '@/lib/supabase'

// Vercel Cron + manual trigger
// Cron: every hour via vercel.json
// Manual: POST /api/sync  (no auth needed locally, CRON_SECRET required in production)
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
  // Auth check — required in production (Vercel Cron sends this header)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    // Allow unauthenticated in dev (no CRON_SECRET set) or if header matches
    if (auth !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

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
    const opportunities = await getOpportunities()
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

    // ── 4. JustCall Calls (last 90 days) ───────────────────────────────────
    console.log('[sync] fetching calls...')
    const now = new Date()
    const yearAgo = new Date()
    yearAgo.setDate(now.getDate() - 365)
    const calls = await getCalls(
      yearAgo.toISOString().split('T')[0],
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

    // ── Log success ────────────────────────────────────────────────────────
    const duration_ms = Date.now() - started
    await supabase.from('sync_log').insert({
      source: 'full',
      records_synced:
        Number(results.pipelines) +
        Number(results.opportunities) +
        Number(results.contacts) +
        Number(results.calls),
      completed_at: new Date().toISOString(),
      duration_ms,
    })

    return NextResponse.json({
      ok: true,
      duration_ms,
      synced: results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync] error:', msg)
    await supabase.from('sync_log').insert({
      source: 'full',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      error: msg,
    })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
