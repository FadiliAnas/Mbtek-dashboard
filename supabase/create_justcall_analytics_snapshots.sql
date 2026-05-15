-- Run this in Supabase SQL Editor to create the calls analytics snapshots table
create table if not exists justcall_analytics_snapshots (
  period        text primary key,   -- 'today' | 'yesterday' | 'last_week' | 'last_month' | 'last_3months'
  from_date     text not null,      -- ISO date e.g. '2026-05-14'
  to_date       text not null,
  summary       jsonb not null,     -- PeriodSummary (aggregated analytics/number)
  prev_summary  jsonb,              -- previous period for % change badges
  agents        jsonb not null,     -- AgentSummary[]
  daily_data    jsonb not null,     -- [{date, inbound, outbound}]
  ivr_data      jsonb not null,     -- [{digit, name, color, count}]
  synced_at     timestamptz not null default now()
);
