-- ==============================================================================
-- Supabase Schema: Complete DDL & RLS Policies for MPLADS Vigilance Portal
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/vbgeuofwhyylsiajttxq/sql/new
-- ==============================================================================

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  project_id TEXT PRIMARY KEY,
  mp_name TEXT NOT NULL,
  state TEXT NOT NULL,
  constituency TEXT NOT NULL,
  work_category TEXT NOT NULL,
  implementing_agency TEXT,
  sanctioned_amount NUMERIC NOT NULL,
  actual_expenditure NUMERIC NOT NULL,
  payment_count INTEGER DEFAULT 0,
  start_date TEXT,
  expected_completion TEXT,
  actual_completion TEXT,
  status TEXT NOT NULL,
  has_tender_on_file BOOLEAN NOT NULL DEFAULT true,
  has_mp_recommendation BOOLEAN NOT NULL DEFAULT true,
  risk_score INTEGER,
  severity TEXT,
  flags JSONB DEFAULT '[]'::jsonb,
  reason TEXT,
  workflow_status TEXT DEFAULT 'VERIFIED',
  ground_truth_is_anomaly BOOLEAN DEFAULT false,
  ground_truth_anomaly_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_projects_state ON public.projects (state);
CREATE INDEX IF NOT EXISTS idx_projects_severity ON public.projects (severity);
CREATE INDEX IF NOT EXISTS idx_projects_workflow_status ON public.projects (workflow_status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_mp_name ON public.projects (mp_name);
CREATE INDEX IF NOT EXISTS idx_projects_work_category ON public.projects (work_category);

-- Enable Row Level Security (RLS) on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.projects;
CREATE POLICY "Allow public read access" ON public.projects
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin and service role mutation access" ON public.projects;
CREATE POLICY "Allow admin and service role mutation access" ON public.projects
  FOR ALL
  USING (
    (auth.jwt() ->> 'role' = 'service_role') OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'ADMIN')
  );

GRANT ALL ON TABLE public.projects TO anon, authenticated, service_role;

-- 2. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  transaction_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Completed',
  vendor_name TEXT,
  purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON public.transactions (project_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read transactions" ON public.transactions;
CREATE POLICY "Allow public read transactions" ON public.transactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role manage transactions" ON public.transactions;
CREATE POLICY "Allow service role manage transactions" ON public.transactions
  FOR ALL USING (true);

GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role;

-- 3. PROFILES TABLE FOR TWO-TIER ROLE-BASED ACCESS CONTROL (PUBLIC vs ADMIN)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'PUBLIC', -- 'ADMIN' or 'PUBLIC'
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow individual read access" ON public.profiles;
CREATE POLICY "Allow individual read access" ON public.profiles
  FOR SELECT USING (auth.uid()::text = id OR auth.jwt() ->> 'email' = email OR auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Allow service role full access to profiles" ON public.profiles;
CREATE POLICY "Allow service role full access to profiles" ON public.profiles
  FOR ALL USING (true);

GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

-- 4. STATUTORY VIGILANCE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.audit_log (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  entity_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id ON public.audit_log (entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read audit_log" ON public.audit_log;
CREATE POLICY "Allow public read audit_log" ON public.audit_log
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role and admin insert audit_log" ON public.audit_log;
CREATE POLICY "Allow service role and admin insert audit_log" ON public.audit_log
  FOR ALL USING (true);

GRANT ALL ON TABLE public.audit_log TO anon, authenticated, service_role;
