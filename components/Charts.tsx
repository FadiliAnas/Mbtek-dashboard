'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const ORANGE = '#F26522'
const GREEN = '#2EB872'
const DARK = '#1A1A1A'
const GRAY = '#94a3b8'
const RED = '#E74C3C'
const YELLOW = '#F39C12'

function usdFormatter(v: number) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  return `$${v}`
}

// Revenue trend - last 12 months
export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: GRAY }} />
        <YAxis tickFormatter={usdFormatter} tick={{ fontSize: 11, fill: GRAY }} width={52} />
        <Tooltip formatter={(v) => [usdFormatter(Number(v ?? 0)), 'Revenue']} />
        <Line type="monotone" dataKey="revenue" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Leads vs deals closed - last 90 days (weekly)
export function LeadsVsDealsChart({
  data,
}: {
  data: { date: string; leads: number; deals: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: GRAY }} />
        <YAxis tick={{ fontSize: 11, fill: GRAY }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="leads" stroke={ORANGE} strokeWidth={2} dot={false} name="New Leads" />
        <Line type="monotone" dataKey="deals" stroke={GREEN} strokeWidth={2} dot={false} name="Deals Won" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Pipeline by stage - horizontal bar
export function PipelineByStageChart({
  data,
}: {
  data: { stage: string; value: number; count: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tickFormatter={usdFormatter} tick={{ fontSize: 11, fill: GRAY }} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: DARK }} width={110} />
        <Tooltip formatter={(v) => [usdFormatter(Number(v ?? 0)), 'Pipeline Value']} />
        <Bar dataKey="value" fill={ORANGE} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Sales funnel
export function SalesFunnelChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <FunnelChart>
        <Tooltip formatter={(v) => [Number(v ?? 0), 'Deals']} />
        <Funnel dataKey="count" data={data} isAnimationActive>
          <LabelList position="center" fill="#fff" fontSize={12} dataKey="name" />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  )
}

// Win rate by source - bar
export function WinRateBySourceChart({
  data,
}: {
  data: { source: string; winRate: number; count: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="source" tick={{ fontSize: 10, fill: GRAY }} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 11, fill: GRAY }} unit="%" />
        <Tooltip formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, 'Win Rate']} />
        <Bar dataKey="winRate" fill={GREEN} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Lead source pie
const PIE_COLORS = [ORANGE, GREEN, '#3B82F6', '#8B5CF6', YELLOW, RED, GRAY]

export function LeadSourcePie({
  data,
}: {
  data: { source: string; count: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={100} label>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Calls per hour heatmap (vertical bar chart, 0-23h)
export function CallsHeatmapChart({ data }: { data: { hour: string; calls: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: GRAY }} interval={1} />
        <YAxis tick={{ fontSize: 11, fill: GRAY }} allowDecimals={false} />
        <Tooltip formatter={(v) => [Number(v ?? 0), 'Calls']} />
        <Bar dataKey="calls" fill={ORANGE} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// IVR breakdown - horizontal bars
export function IVRBreakdownChart({ data }: { data: { label: string; count: number; pct: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 50)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: GRAY }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: DARK }} width={100} />
        <Tooltip formatter={(v) => [Number(v ?? 0), 'Calls']} />
        <Bar dataKey="count" fill={ORANGE} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Orders by stage - horizontal bar
export function OrdersByStageChart({ data }: { data: { stage: string; count: number; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: GRAY }} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: DARK }} width={120} />
        <Tooltip formatter={(v) => [Number(v ?? 0), 'Orders']} />
        <Bar dataKey="count" fill={ORANGE} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Pipeline audit - count + value dual bars per stage
export function PipelineStageChart({ data }: { data: { stage: string; count: number; value: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">No data</p>
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: GRAY }} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: DARK }} width={110} />
        <Tooltip
          formatter={(v, name) =>
            name === 'value'
              ? ['$' + Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 }), 'Value']
              : [Number(v ?? 0), 'Count']
          }
        />
        <Legend />
        <Bar dataKey="count" name="Count" fill={ORANGE} radius={[0, 4, 4, 0]} />
        <Bar dataKey="value" name="Value ($)" fill="#2563eb" radius={[0, 4, 4, 0]} hide />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Calls volume over time — inbound + outbound by day
export function CallsVolumeChart({
  data,
}: {
  data: { date: string; inbound: number; outbound: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: GRAY }} />
        <YAxis tick={{ fontSize: 11, fill: GRAY }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="inbound" name="Inbound" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="outbound" name="Outbound" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Inbound answered vs missed over time
export function InboundTrendChart({
  data,
}: {
  data: { date: string; answered: number; missed: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: GRAY }} />
        <YAxis tick={{ fontSize: 11, fill: GRAY }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="answered" name="Answered" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="missed" name="Missed" stroke={RED} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Agent performance grouped bar chart
export function AgentPerformanceChart({
  data,
}: {
  data: {
    name: string
    inbound: number
    outbound: number
    answered: number
    missed: number
  }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: GRAY }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: DARK }} width={120} />
        <Tooltip />
        <Legend />
        <Bar dataKey="inbound" name="Inbound" fill={ORANGE} radius={[0, 3, 3, 0]} stackId="a" />
        <Bar dataKey="outbound" name="Outbound" fill="#3B82F6" radius={[0, 3, 3, 0]} stackId="a" />
        <Bar dataKey="missed" name="Missed" fill="#E74C3C" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
