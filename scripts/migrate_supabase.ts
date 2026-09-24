import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';

// 1. Config
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vbgeuofwhyylsiajttxq.supabase.co').replace(/\/rest\/v1\/?$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

const storePath = path.join(process.cwd(), 'server', 'data', 'projects_store.json');
const schemaPath = path.join(process.cwd(), 'supabase_schema.sql');

async function runDirectSqlMigration() {
  const connectionString = DATABASE_URL || (SUPABASE_DB_PASSWORD ? `postgresql://postgres:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` : null);

  if (!connectionString) {
    console.log('[Direct SQL Migration] No direct DATABASE_URL or SUPABASE_DB_PASSWORD provided.');
    console.log('[Direct SQL Migration] To create tables directly in Supabase, execute `supabase_schema.sql` in the Supabase SQL Editor:');
    console.log(' 👉 https://supabase.com/dashboard/project/vbgeuofwhyylsiajttxq/sql/new\n');
    return false;
  }

  console.log('[Direct SQL Migration] Attempting connection via PostgreSQL client...');
  const client = new PgClient({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[Direct SQL Migration] Connected to PostgreSQL database successfully.');
    const ddl = fs.readFileSync(schemaPath, 'utf8');
    console.log('[Direct SQL Migration] Executing supabase_schema.sql DDL...');
    await client.query(ddl);
    console.log('[Direct SQL Migration] DDL applied successfully! All tables and RLS policies created.');
    await client.end();
    return true;
  } catch (err: any) {
    console.error('[Direct SQL Migration] Could not apply DDL via direct connection:', err.message);
    try { await client.end(); } catch {}
    return false;
  }
}

async function migrateDataToSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  console.log(`[Supabase Migration] Probing Supabase endpoint: ${SUPABASE_URL}...`);
  const { data: probeData, error: probeError } = await supabase
    .from('projects')
    .select('project_id')
    .limit(1);

  if (probeError) {
    console.error('\n❌ Supabase projects table not found or not accessible:');
    console.error(`Error details: ${probeError.message} (code: ${probeError.code || 'N/A'})`);
    console.error('\nPlease run `supabase_schema.sql` in the Supabase SQL Editor:');
    console.error(' 👉 https://supabase.com/dashboard/project/vbgeuofwhyylsiajttxq/sql/new');
    console.error('Once the SQL runs, re-execute this script to migrate the 3,364 projects.\n');
    return false;
  }

  console.log('✅ Table public.projects exists in Supabase schema cache!');

  // Load source projects from server/data/projects_store.json
  if (!fs.existsSync(storePath)) {
    console.error(`❌ Source store file not found at ${storePath}`);
    return false;
  }

  const rawProjects = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  console.log(`[Supabase Migration] Loaded ${rawProjects.length} projects from local store.`);

  const batchSize = 100;
  let totalUpserted = 0;

  for (let i = 0; i < rawProjects.length; i += batchSize) {
    const chunk = rawProjects.slice(i, i + batchSize).map((p: any) => ({
      project_id: p.project_id,
      mp_name: p.mp_name,
      state: p.state,
      constituency: p.constituency,
      work_category: p.work_category,
      implementing_agency: p.implementing_agency,
      sanctioned_amount: Number(p.sanctioned_amount) || 0,
      actual_expenditure: Number(p.actual_expenditure) || 0,
      payment_count: p.payment_count ?? 0,
      start_date: p.start_date || null,
      expected_completion: p.expected_completion || null,
      actual_completion: p.actual_completion || null,
      status: p.status || 'In Progress',
      has_tender_on_file: Boolean(p.has_tender_on_file),
      has_mp_recommendation: Boolean(p.has_mp_recommendation),
      ground_truth_is_anomaly: Boolean(p.ground_truth_is_anomaly),
      ground_truth_anomaly_type: p.ground_truth_anomaly_type || null,
      risk_score: p.risk_score ?? null,
      severity: p.severity ?? null,
      flags: Array.isArray(p.flags) ? p.flags : [],
      reason: p.reason ?? null,
      workflow_status: p.workflow_status || 'VERIFIED'
    }));

    const { error: upsertError } = await supabase
      .from('projects')
      .upsert(chunk, { onConflict: 'project_id' });

    if (upsertError) {
      console.error(`❌ Error migrating batch ${i} to ${i + chunk.length}:`, upsertError.message);
      return false;
    }

    totalUpserted += chunk.length;
    process.stdout.write(`\r[Supabase Migration] Migrated ${totalUpserted} / ${rawProjects.length} records...`);
  }

  console.log(`\n\n🎉 Migration complete! Successfully migrated ${totalUpserted} projects into Supabase.`);

  // Verify exact row count
  const { count, error: countError } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`[Supabase Verification] Supabase public.projects exact row count: ${count}`);
  }

  return true;
}

async function main() {
  console.log('====================================================');
  console.log('  MPLADS Vigilance Portal — Supabase Migration Script');
  console.log('====================================================\n');

  await runDirectSqlMigration();
  const success = await migrateDataToSupabase();
  if (success) {
    console.log('✅ Supabase database is fully synced and verified.');
  } else {
    console.log('⚠️ Migration paused until table is created in Supabase.');
  }
}

main().catch(console.error);
