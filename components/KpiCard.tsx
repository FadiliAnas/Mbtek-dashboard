import { formatUSD } from '@/lib/metrics'

interface KpiCardProps {
  label: string
  value: string | number
  format?: 'usd' | 'number' | 'percent' | 'raw'
  change?: number | null
  sub?: string
}

export function KpiCard({ label, value, format = 'raw', change, sub }: KpiCardProps) {
  const display =
    format === 'usd'
      ? formatUSD(Number(value))
      : format === 'percent'
        ? `${Number(value).toFixed(1)}%`
        : format === 'number'
          ? Number(value).toLocaleString()
          : String(value)

  const changeColor =
    change == null ? '' : change >= 0 ? 'text-[#2EB872]' : 'text-[#E74C3C]'
  const changeSign = change != null && change >= 0 ? '+' : ''

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-[#1A1A1A] tracking-tight">{display}</p>
      <div className="flex items-center gap-2 mt-2">
        {change != null && (
          <span className={`text-sm font-semibold ${changeColor}`}>
            {changeSign}{change.toFixed(1)}% vs last month
          </span>
        )}
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  )
}
