'use client'

import { useState } from 'react'
import { AgentPerformanceChart } from './Charts'
import type { AgentSummary } from '@/lib/justcall-analytics'

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}m ${sec}s`
}

export function AgentPerformanceSection({ agents }: { agents: AgentSummary[] }) {
  const [view, setView] = useState<'table' | 'chart'>('table')

  const chartData = agents.map(a => ({
    name: a.agent_name,
    inbound: a.incoming_calls,
    outbound: a.outgoing_calls,
    answered: a.incoming_answered_calls,
    missed: a.incoming_missed_calls,
  }))

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">Agent Performance — Last 7 Days</h2>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              view === 'table'
                ? 'bg-white text-[#1A1A1A] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setView('chart')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              view === 'chart'
                ? 'bg-white text-[#1A1A1A] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chart
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                {['Agent', 'Total', 'Inbound', 'Outbound', 'Answered', 'Answer Rate', 'SLA Rate', 'Missed', 'Connect Rate', 'Avg Duration'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => (
                <tr key={a.agent_id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-orange-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">{a.agent_name}</td>
                  <td className="px-4 py-3 font-semibold">{a.total_calls}</td>
                  <td className="px-4 py-3 text-gray-600">{a.incoming_calls}</td>
                  <td className="px-4 py-3 text-gray-600">{a.outgoing_calls}</td>
                  <td className="px-4 py-3 text-[#2EB872] font-medium">{a.incoming_answered_calls}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${a.incoming_answer_rate < 50 ? 'text-[#E74C3C]' : a.incoming_answer_rate < 75 ? 'text-[#F39C12]' : 'text-[#2EB872]'}`}>
                      {a.incoming_calls > 0 ? `${a.incoming_answer_rate}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.incoming_calls > 0 ? `${a.sla_rate_30sec}%` : '—'}</td>
                  <td className="px-4 py-3 text-[#E74C3C]">{a.incoming_missed_calls || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${a.outgoing_connect_rate < 80 ? 'text-[#F39C12]' : 'text-[#2EB872]'}`}>
                      {a.outgoing_calls > 0 ? `${a.outgoing_connect_rate}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.avg_call_duration > 0 ? fmt(a.avg_call_duration) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-4">CALLS BY AGENT — INBOUND / OUTBOUND / MISSED</p>
          <AgentPerformanceChart data={chartData} />
        </div>
      )}
    </section>
  )
}
