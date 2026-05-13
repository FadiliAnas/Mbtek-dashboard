#!/usr/bin/env tsx
/**
 * Full data sync: GHL + JustCall → Supabase
 * Run with: npm run sync
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GHL_LOC = process.env.GHL_LOCATION_ID!
const GHL_KEY = process.env.GHL_API_KEY!
const GHL_VER = process.env.GHL_API_VERSION ?? '2021-07-28'
const JC_KEY = process.env.JUSTCALL_API_KEY!
const JC_SECRET = process.env.JUSTCALL_API_SECRET!

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE env vars')
if (!GHL_LOC || !GHL_KEY) throw new Error('Missing GHL env vars')
if (!JC_KEY || !JC_SECRET) throw new Error('Missing JUSTCALL env vars')

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${msg}\n`)
}

// Fetch with 15s timeout
async function fetchJSON(url: string, headers: Record<string, string>): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`)
    }
    return res.json()
  } finally {
    clearTimeout(t)
  }
}

function ghlHeaders() {
  return { Authorization: `Bearer ${GHL_KEY}`, Version: GHL_VER, 'Content-Type': 'application/json' }
}

function jcHeaders() {
  const auth = 'Basic ' + Buffer.from(`${JC_KEY}:${JC_SECRET}`).toString('base64')
  return { Authorization: auth, 'Content-Type': 'application/json' }
}

async function upsert(table: string, rows: Record<string, unknown>[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await (db.from(table) as any).upsert(rows.slice(i, i + batchSize), { onConflict: 'id' })
    if (error) throw new Error(`${table} upsert: ${error.message}`)
  }
  return rows.length
}

// ── GHL: Pipelines ──────────────────────────────────────────────────────────
async function syncPipelines() {
  log('Fetching pipelines...')
  const data = await fetchJSON(
    `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${GHL_LOC}`,
    ghlHeaders()
  )
  const pipelines = data.pipelines ?? []
  await upsert('ghl_pipelines', pipelines.map((p: any) => ({
    id: p.id, name: p.name, stages: p.stages, synced_at: new Date().toISOString(),
  })))
  log(`✓ Pipelines: ${pipelines.length}`)
  return pipelines
}

// ── GHL: Opportunities (all pipelines, all statuses) ──────────────────────
async function fetchOppsPage(pipelineId: string, status: string, cursor: string | null) {
  const qs = new URLSearchParams({
    location_id: GHL_LOC,
    pipeline_id: pipelineId,
    status,
    limit: '100',
    ...(cursor ? { startAfter: cursor } : {}),
  })
  return fetchJSON(`https://services.leadconnectorhq.com/opportunities/search?${qs}`, ghlHeaders())
}

async function syncPipelineStatus(pipeline: any, status: string, synced_at: string): Promise<number> {
  let cursor: string | null = null
  let page = 0
  let total = 0
  const MAX_PAGES = 200

  do {
    let data: any
    try {
      data = await fetchOppsPage(pipeline.id, status, cursor)
    } catch (e) {
      log(`  ⚠ "${pipeline.name}" [${status}] page ${page + 1}: ${e}. Stopping.`)
      break
    }

    const opps: any[] = data.opportunities ?? []
    if (opps.length > 0) {
      await upsert('ghl_opportunities', opps.map((o: any) => ({
        id: String(o.id),
        name: o.name ?? null,
        monetary_value: o.monetaryValue ?? 0,
        status: o.status ?? null,
        pipeline_id: o.pipelineId ?? null,
        pipeline_stage_id: o.pipelineStageId ?? null,
        source: o.source ?? null,
        contact_id: o.contactId ?? null,
        created_at: o.createdAt ?? null,
        updated_at: o.updatedAt ?? null,
        synced_at,
      })))
      total += opps.length
    }

    const prevCursor: string | null = cursor
    cursor = data.meta?.startAfter ?? null
    if (cursor === prevCursor || opps.length === 0) cursor = null
    page++
    if (cursor) await sleep(250)
    if (page % 10 === 0) log(`  "${pipeline.name}" [${status}]: page ${page}, ${total} so far`)
  } while (cursor && page < MAX_PAGES)

  return total
}

async function syncOpportunities(pipelines: any[]) {
  log(`Fetching opportunities across ${pipelines.length} pipelines (all statuses)...`)
  const synced_at = new Date().toISOString()
  let grandTotal = 0

  for (const pipeline of pipelines) {
    let pipelineTotal = 0
    for (const status of ['open', 'won', 'lost', 'abandoned']) {
      const count = await syncPipelineStatus(pipeline, status, synced_at)
      pipelineTotal += count
      if (count > 0) grandTotal += count
    }
    log(`  Pipeline "${pipeline.name}": ${pipelineTotal} opps`)
  }

  log(`✓ Opportunities: ${grandTotal} total`)
  return grandTotal
}

// ── GHL: Contacts ───────────────────────────────────────────────────────────
async function syncContacts() {
  log('Fetching contacts...')
  const synced_at = new Date().toISOString()
  let total = 0
  let cursor: string | null = null
  let page = 0
  const MAX_PAGES = 500 // 50,000 contacts max

  do {
    const qs = new URLSearchParams({ locationId: GHL_LOC, limit: '100', ...(cursor ? { startAfter: cursor } : {}) })
    let data: any
    try {
      data = await fetchJSON(`https://services.leadconnectorhq.com/contacts/?${qs}`, ghlHeaders())
    } catch (e) {
      log(`  ⚠ Contacts page ${page + 1} error: ${e}. Stopping.`)
      break
    }

    const contacts: any[] = data.contacts ?? []
    if (contacts.length > 0) {
      await upsert('ghl_contacts', contacts.map((c: any) => ({
        id: String(c.id),
        first_name: c.firstName ?? null,
        last_name: c.lastName ?? null,
        email: c.email ?? null,
        source: c.source ?? null,
        tags: c.tags ?? [],
        date_added: c.dateAdded ?? null,
        date_updated: c.dateUpdated ?? null,
        synced_at,
      })))
      total += contacts.length
    }

    const prev: string | null = cursor
    cursor = data.meta?.startAfter ?? null
    if (cursor === prev || contacts.length === 0) cursor = null
    page++
    if (cursor) await sleep(250)
    if (page % 10 === 0) log(`  Contacts: ${total} so far...`)
  } while (cursor && page < MAX_PAGES)

  log(`✓ Contacts: ${total} total`)
  return total
}

// ── JustCall: Calls (1 year) ────────────────────────────────────────────────
async function syncCalls() {
  log('Fetching calls (last 365 days)...')
  const now = new Date()
  const yearAgo = new Date()
  yearAgo.setDate(now.getDate() - 365)
  const from = yearAgo.toISOString().split('T')[0]
  const to = now.toISOString().split('T')[0]
  const synced_at = new Date().toISOString()

  let total = 0
  let page = 1
  let hasMore = true

  while (hasMore) {
    const qs = new URLSearchParams({ from, to, per_page: '100', page: String(page) })
    let data: any
    try {
      data = await fetchJSON(`https://api.justcall.io/v2.1/calls?${qs}`, jcHeaders())
    } catch (e) {
      log(`  ⚠ Calls page ${page} error: ${e}. Stopping.`)
      break
    }

    const raws: any[] = data.data ?? []
    if (raws.length > 0) {
      await upsert('justcall_calls', raws.map((r: any) => {
        const dir = (r.call_info?.direction ?? '').toLowerCase()
        const typ = (r.call_info?.type ?? '').toLowerCase()
        return {
          id: String(r.id),
          direction: dir.startsWith('in') ? 'inbound' : 'outbound',
          status: typ === 'not_answered' ? 'missed' : (typ || 'unknown'),
          duration: r.call_duration?.total_duration ?? 0,
          call_date: r.call_date && r.call_time ? `${r.call_date}T${r.call_time}Z` : (r.call_date ?? null),
          ivr_digit: r.ivr_info?.digit_pressed || null,
          agent_name: r.agent_name ?? null,
          synced_at,
        }
      }))
      total += raws.length
    }

    hasMore = raws.length === 100
    page++
    if (hasMore) await sleep(250)
    if (page % 10 === 0) log(`  Calls: ${total} so far...`)
  }

  log(`✓ Calls: ${total} total`)
  return total
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== MBtek Dashboard Sync ===')
  const start = Date.now()

  const pipelines = await syncPipelines()
  const opps = await syncOpportunities(pipelines)
  const contacts = await syncContacts()
  const calls = await syncCalls()

  const duration_ms = Date.now() - start
  const total = pipelines.length + opps + contacts + calls

  await db.from('sync_log').insert({
    source: 'full', records_synced: total,
    completed_at: new Date().toISOString(), duration_ms,
  })

  console.log(`\n✅ Sync complete in ${Math.round(duration_ms / 1000)}s`)
  console.log(`   Pipelines:     ${pipelines.length}`)
  console.log(`   Opportunities: ${opps}`)
  console.log(`   Contacts:      ${contacts}`)
  console.log(`   Calls:         ${calls}`)
  console.log(`   Total:         ${total} records\n`)
}

main().catch(err => {
  console.error('\n❌ Sync failed:', err.message)
  process.exit(1)
})
