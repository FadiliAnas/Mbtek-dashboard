export type Period = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'last_3months'

export const PERIOD_LIST: { key: Period; label: string }[] = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'last_week',    label: 'Last 7 Days' },
  { key: 'last_month',   label: 'Last 30 Days' },
  { key: 'last_3months', label: 'Last 90 Days' },
]

export function parsePeriod(s: string | undefined | null): Period {
  if (s && ['today', 'yesterday', 'last_week', 'last_month', 'last_3months'].includes(s)) {
    return s as Period
  }
  return 'today'
}

// Returns UTC Date boundaries for a given period key
export function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayUTC = new Date(todayUTC)
  yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1)

  switch (period) {
    case 'today':
      return { from: todayUTC, to: now }
    case 'yesterday':
      return { from: yesterdayUTC, to: new Date(todayUTC.getTime() - 1) }
    case 'last_week': {
      const from = new Date(todayUTC); from.setUTCDate(todayUTC.getUTCDate() - 7)
      return { from, to: now }
    }
    case 'last_month': {
      const from = new Date(todayUTC); from.setUTCDate(todayUTC.getUTCDate() - 30)
      return { from, to: now }
    }
    case 'last_3months': {
      const from = new Date(todayUTC); from.setUTCDate(todayUTC.getUTCDate() - 90)
      return { from, to: now }
    }
  }
}
