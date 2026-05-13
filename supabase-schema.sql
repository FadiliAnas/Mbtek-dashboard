-- Run this in your Supabase project: SQL Editor → New Query → paste & run

-- GHL Pipelines
CREATE TABLE IF NOT EXISTS ghl_pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- GHL Opportunities
CREATE TABLE IF NOT EXISTS ghl_opportunities (
  id TEXT PRIMARY KEY,
  name TEXT,
  monetary_value NUMERIC DEFAULT 0,
  status TEXT,
  pipeline_id TEXT,
  pipeline_stage_id TEXT,
  source TEXT,
  contact_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opps_pipeline ON ghl_opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opps_status ON ghl_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opps_updated ON ghl_opportunities(updated_at);

-- GHL Contacts
CREATE TABLE IF NOT EXISTS ghl_contacts (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  source TEXT,
  tags JSONB DEFAULT '[]',
  date_added TIMESTAMPTZ,
  date_updated TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_date ON ghl_contacts(date_added);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON ghl_contacts(source);

-- JustCall Calls
CREATE TABLE IF NOT EXISTS justcall_calls (
  id TEXT PRIMARY KEY,
  direction TEXT,
  status TEXT,
  duration INTEGER DEFAULT 0,
  call_date TIMESTAMPTZ,
  ivr_digit TEXT,
  agent_name TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_date ON justcall_calls(call_date);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON justcall_calls(direction);
CREATE INDEX IF NOT EXISTS idx_calls_status ON justcall_calls(status);

-- Sync log
CREATE TABLE IF NOT EXISTS sync_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  records_synced INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error TEXT
);
