const BASE = 'https://api.justcall.io/v2.1'

function getAuthHeader() {
  const key = process.env.JUSTCALL_API_KEY!
  const secret = process.env.JUSTCALL_API_SECRET!
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

async function analyticsGet(endpoint: string, from_date: string, to_date: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const qs = new URLSearchParams({ from_date, to_date })
    const res = await fetch(`${BASE}/calls/analytics/${endpoint}?${qs}`, {
      headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`JustCall analytics/${endpoint} → ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export interface PeriodSummary {
  total_calls: number
  outgoing_calls: number
  outgoing_connected_calls: number
  outgoing_not_connected_calls: number
  outgoing_connect_rate: number
  incoming_calls: number
  incoming_answered_calls: number
  incoming_answer_rate: number
  sla_rate_30sec: number
  incoming_missed_calls: number
  missed_during_agent_hours: number
  missed_after_office_hours: number
  missed_abandoned_before_ringing: number
  avg_ring_time: number
  avg_queue_time: number
  avg_talk_time: number
  avg_hold_time: number
  avg_call_duration: number
  voicemails_received: number
}

export interface AgentSummary extends PeriodSummary {
  agent_id: number
  agent_name: string
  agent_email: string
}

const ZERO: PeriodSummary = {
  total_calls: 0, outgoing_calls: 0, outgoing_connected_calls: 0,
  outgoing_not_connected_calls: 0, outgoing_connect_rate: 0,
  incoming_calls: 0, incoming_answered_calls: 0, incoming_answer_rate: 0,
  sla_rate_30sec: 0, incoming_missed_calls: 0, missed_during_agent_hours: 0,
  missed_after_office_hours: 0, missed_abandoned_before_ringing: 0,
  avg_ring_time: 0, avg_queue_time: 0, avg_talk_time: 0,
  avg_hold_time: 0, avg_call_duration: 0, voicemails_received: 0,
}

function sumRecords(records: { summary: PeriodSummary }[]): PeriodSummary {
  const t = { ...ZERO }
  let weightedTalkTime = 0
  let weightedRingTime = 0
  let weightedQueueTime = 0
  let weightedDuration = 0

  for (const { summary: s } of records) {
    t.total_calls += s.total_calls
    t.outgoing_calls += s.outgoing_calls
    t.outgoing_connected_calls += s.outgoing_connected_calls
    t.outgoing_not_connected_calls += s.outgoing_not_connected_calls
    t.incoming_calls += s.incoming_calls
    t.incoming_answered_calls += s.incoming_answered_calls
    t.incoming_missed_calls += s.incoming_missed_calls
    t.missed_during_agent_hours += s.missed_during_agent_hours
    t.missed_after_office_hours += s.missed_after_office_hours
    t.missed_abandoned_before_ringing += s.missed_abandoned_before_ringing
    t.voicemails_received += s.voicemails_received

    const w = s.incoming_answered_calls
    weightedTalkTime += s.avg_talk_time * w
    weightedRingTime += s.avg_ring_time * w
    weightedQueueTime += s.avg_queue_time * w
    weightedDuration += s.avg_call_duration * w
  }

  const answered = t.incoming_answered_calls
  t.incoming_answer_rate = t.incoming_calls > 0
    ? Math.round((answered / t.incoming_calls) * 100) : 0
  t.outgoing_connect_rate = t.outgoing_calls > 0
    ? Math.round((t.outgoing_connected_calls / t.outgoing_calls) * 100) : 0
  t.avg_talk_time = answered > 0 ? Math.round(weightedTalkTime / answered) : 0
  t.avg_ring_time = answered > 0 ? Math.round(weightedRingTime / answered) : 0
  t.avg_queue_time = answered > 0 ? Math.round(weightedQueueTime / answered) : 0
  t.avg_call_duration = answered > 0 ? Math.round(weightedDuration / answered) : 0

  return t
}

export async function getNumberAnalytics(from_date: string, to_date: string): Promise<PeriodSummary> {
  const data = await analyticsGet('number', from_date, to_date)
  return sumRecords(data.data?.records ?? [])
}

export async function getAgentAnalytics(from_date: string, to_date: string): Promise<AgentSummary[]> {
  const data = await analyticsGet('agent', from_date, to_date)
  const records: any[] = data.data?.records ?? []
  return records
    .filter((r: any) => r.summary.total_calls > 0)
    .map((r: any) => ({ agent_id: r.agent_id, agent_name: r.agent_name, agent_email: r.agent_email, ...r.summary }))
    .sort((a: AgentSummary, b: AgentSummary) => b.total_calls - a.total_calls)
}
