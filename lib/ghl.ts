const BASE = 'https://services.leadconnectorhq.com'

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: process.env.GHL_API_VERSION ?? '2021-07-28',
    'Content-Type': 'application/json',
  }
}

export const LOC = () => process.env.GHL_LOCATION_ID!

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function ghlFetch(path: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: ghlHeaders(),
      signal: controller.signal,
      // No Next.js cache here — sync route handles freshness
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`GHL ${path} → ${res.status} ${res.statusText}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function getPipelines(): Promise<GHLPipeline[]> {
  const data = await ghlFetch(`/opportunities/pipelines?locationId=${LOC()}`)
  return data.pipelines ?? []
}

// Fetches ALL opportunities across all pipelines and all statuses
export async function getOpportunities(): Promise<GHLOpportunity[]> {
  const pipelines = await getPipelines()
  const all: GHLOpportunity[] = []

  for (const pipeline of pipelines) {
    for (const status of ['open', 'won', 'lost', 'abandoned'] as const) {
      let cursor: string | null = null
      do {
        const qs = new URLSearchParams({
          location_id: LOC(),
          pipeline_id: pipeline.id,
          status,
          limit: '100',
          ...(cursor ? { startAfter: cursor } : {}),
        })
        const data = await ghlFetch(`/opportunities/search?${qs}`)
        const opps: GHLOpportunity[] = data.opportunities ?? []
        all.push(...opps)
        const prev: string | null = cursor
        cursor = data.meta?.startAfter ?? null
        if (cursor === prev || opps.length === 0) cursor = null
        if (cursor) await sleep(250)
      } while (cursor)
    }
  }

  return all
}

// Fetches ALL contacts — no page cap
export async function getContacts(): Promise<GHLContact[]> {
  const all: GHLContact[] = []
  let cursor: string | null = null

  do {
    const qs = new URLSearchParams({
      locationId: LOC(),
      limit: '100',
      ...(cursor ? { startAfter: cursor } : {}),
    })
    const data = await ghlFetch(`/contacts/?${qs}`)
    const contacts: GHLContact[] = data.contacts ?? []
    all.push(...contacts)
    cursor = data.meta?.startAfter ?? null
    if (cursor) await sleep(250)
  } while (cursor)

  return all
}

// Types
export interface GHLPipeline {
  id: string
  name: string
  stages: { id: string; name: string; position: number }[]
}

export interface GHLOpportunity {
  id: string
  name: string
  monetaryValue: number
  status: 'open' | 'won' | 'lost' | 'abandoned'
  pipelineId: string
  pipelineStageId: string
  createdAt: string
  updatedAt: string
  source?: string
  contactId?: string
}

export interface GHLContact {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  source?: string
  tags?: string[]
  dateAdded: string
  dateUpdated?: string
}
