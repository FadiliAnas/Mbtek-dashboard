const BASE = 'https://api.justcall.io/v2.1'

function getAuthHeader() {
  const key = process.env.JUSTCALL_API_KEY!
  const secret = process.env.JUSTCALL_API_SECRET!
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function justcallFetch(path: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`JustCall ${path} → ${res.status} ${res.statusText}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// Raw shape returned by JustCall v2.1 /calls endpoint
interface RawJCCall {
  id: string | number
  call_date: string       // "2026-05-08"
  call_time: string       // "17:38:45" UTC
  agent_name?: string
  call_info?: {
    direction?: string    // "Outgoing" | "Incoming"
    type?: string         // "answered" | "missed" | "voicemail" | "not_answered" | "busy"
  }
  call_duration?: {
    total_duration?: number  // seconds
  }
  ivr_info?: {
    digit_pressed?: string
  }
}

function normalizeCall(raw: RawJCCall): JCCall {
  const dir = (raw.call_info?.direction ?? '').toLowerCase()
  const typ = (raw.call_info?.type ?? '').toLowerCase()

  const direction: 'inbound' | 'outbound' = dir.startsWith('in') ? 'inbound' : 'outbound'

  let status: JCCall['status']
  if (typ === 'answered') status = 'answered'
  else if (typ === 'voicemail') status = 'voicemail'
  else if (typ === 'missed' || typ === 'not_answered') status = 'missed'
  else if (typ === 'busy') status = 'busy'
  else status = typ || 'unknown'

  // Combine date + time into ISO string (JustCall times are UTC)
  const callDatetime =
    raw.call_date && raw.call_time
      ? `${raw.call_date}T${raw.call_time}Z`
      : raw.call_date ?? ''

  return {
    id: raw.id,
    direction,
    status,
    duration: raw.call_duration?.total_duration ?? 0,
    call_date: callDatetime,
    ivr_digit: raw.ivr_info?.digit_pressed || undefined,
    agent_name: raw.agent_name,
  }
}

// Fetches ALL calls between from/to — no page cap
export async function getCalls(from: string, to: string): Promise<JCCall[]> {
  const all: JCCall[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const qs = new URLSearchParams({ from, to, per_page: '100', page: String(page) })
    const data = await justcallFetch(`/calls?${qs}`)
    const raws: RawJCCall[] = data.data ?? []
    all.push(...raws.map(normalizeCall))
    hasMore = raws.length === 100
    page++
    if (hasMore) await sleep(250)
  }

  return all
}

export interface JCCall {
  id: string | number
  direction: 'inbound' | 'outbound'
  status: 'answered' | 'missed' | 'busy' | 'voicemail' | string
  duration: number          // seconds
  call_date: string         // ISO datetime string
  ivr_digit?: string
  agent_name?: string
}
