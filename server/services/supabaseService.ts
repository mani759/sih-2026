import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { RawProjectRecord, ALL_36_STATES } from './datasetGenerator';

// Read credentials from process.env
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vbgeuofwhyylsiajttxq.supabase.co/rest/v1/';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Clean the URL for supabase-js (remove trailing /rest/v1/ if present)
const cleanedUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');

if (!cleanedUrl || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('CRITICAL: Supabase credentials missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
}

export const supabaseClient: SupabaseClient = createClient(cleanedUrl, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase client is not initialized.');
  }
  return supabaseClient;
}

// ==========================================
// LEGACY `projects` TABLE ACCESS — DEPRECATED
// Everything below targets the old synthetic `projects` schema and is no longer used by
// server/routes/api.ts, which now reads works / work_scores / payments / mp_alerts /
// review_actions via ./worksService. Kept (not deleted) until the old table is retired;
// only backfillService.ts (whose route is disabled) still imports these.
// ==========================================

// In-memory cache for aggregate dashboard statistics and lightning-fast state counts
let cachedProjects: RawProjectRecord[] = [];
let isCacheLoaded = false;
let cacheLoadingPromise: Promise<RawProjectRecord[]> | null = null;

// Transform project object into DB column schema
export function toSupabaseRow(p: RawProjectRecord) {
  return {
    project_id: p.project_id,
    mp_name: p.mp_name,
    state: p.state,
    constituency: p.constituency || p.district,
    work_category: p.work_category,
    implementing_agency: p.implementing_agency || 'District Administration',
    sanctioned_amount: Number(p.sanctioned_amount),
    actual_expenditure: Number(p.actual_expenditure),
    payment_count: Number(p.payment_count || 1),
    start_date: p.start_date,
    expected_completion: p.expected_completion,
    actual_completion: p.actual_completion || null,
    status: p.status,
    has_tender_on_file: Boolean(p.has_tender_on_file),
    has_mp_recommendation: Boolean(p.has_mp_recommendation),
    risk_score: p.risk_score ?? 0,
    severity: p.severity || 'low',
    flags: Array.isArray(p.flags) ? p.flags : [],
    reason: p.reason || '',
    workflow_status: p.workflow_status || 'VERIFIED',
    ground_truth_is_anomaly: Boolean(p.ground_truth_is_anomaly),
    ground_truth_anomaly_type: p.ground_truth_anomaly_type || null
  };
}

// Hydrate DB row to UI Project structure
export function hydrateProject(row: any): RawProjectRecord {
  const sanctioned = Number(row.sanctioned_amount) || 0;
  const expenditure = Number(row.actual_expenditure) || 0;
  let state = row.state;
  if (/^the\s+dadra/i.test(state || '')) {
    state = 'Dadra and Nagar Haveli and Daman and Diu';
  }
  return {
    project_id: row.project_id,
    project_name: `${row.work_category} at ${row.constituency}`,
    state: state,
    district: row.constituency,
    constituency: row.constituency,
    mp_name: row.mp_name,
    work_category: row.work_category,
    implementing_agency: row.implementing_agency || 'District Administration',
    cost_estimate: Number(row.cost_estimate || sanctioned),
    sanctioned_amount: sanctioned,
    actual_expenditure: expenditure,
    payment_count: Number(row.payment_count || 1),
    start_date: row.start_date || '2023-04-01',
    expected_completion: row.expected_completion || '2024-03-31',
    actual_completion: row.actual_completion || null,
    status: row.status || 'In Progress',
    has_tender_on_file: Boolean(row.has_tender_on_file),
    has_mp_recommendation: Boolean(row.has_mp_recommendation),
    scheme: 'MPLADS',
    financial_year: '2023-24',
    risk_score: row.risk_score ?? 0,
    severity: row.severity || 'low',
    flags: Array.isArray(row.flags) ? row.flags : [],
    reason: row.reason || '',
    workflow_status: row.workflow_status || 'VERIFIED',
    ground_truth_is_anomaly: Boolean(row.ground_truth_is_anomaly),
    ground_truth_anomaly_type: row.ground_truth_anomaly_type || null,
    expenditure_utilization: sanctioned > 0 ? Number((expenditure / sanctioned).toFixed(3)) : 0,
    delay_days: row.status === 'Stalled' ? 240 : 0
  };
}

// Direct Supabase table check - table now exists
export async function checkSupabaseTableExists(): Promise<boolean> {
  return true;
}

// Fetch all projects from Supabase in paginated chunks to populate cache
export async function fetchAllProjectsFromSupabase(): Promise<RawProjectRecord[]> {
  const client = getSupabase();
  let allRows: any[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from('projects')
      .select('*')
      .range(from, from + pageSize - 1)
      .order('project_id', { ascending: true });

    if (error) {
      console.error('[Supabase Error] Failed to fetch projects:', error.message);
      throw new Error(`Failed to load projects from Supabase: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  cachedProjects = allRows.map(hydrateProject);
  isCacheLoaded = true;
  console.log(`[Supabase Service] Cache hydrated with ${cachedProjects.length} projects directly from Supabase`);
  return cachedProjects;
}

// Ensure cache is loaded
export function ensureCacheLoaded(): Promise<RawProjectRecord[]> {
  if (isCacheLoaded && cachedProjects.length > 0) {
    return Promise.resolve(cachedProjects);
  }
  if (!cacheLoadingPromise) {
    cacheLoadingPromise = fetchAllProjectsFromSupabase().finally(() => {
      cacheLoadingPromise = null;
    });
  }
  return cacheLoadingPromise;
}

// OLD: every import of this module downloaded the whole legacy `projects` table at startup.
// Disabled now that the API reads the new works/work_scores tables via worksService.
// ensureCacheLoaded().catch(err => {
//   console.error('[Supabase Bootstrap Error]:', err.message);
// });

// GET PROJECTS directly from Supabase (Strictly NO local-file fallback)
export async function getProjects(options: {
  q?: string;
  state?: string;
  district?: string;
  mp?: string;
  category?: string;
  status?: string;
  risk_level?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: RawProjectRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: string;
}> {
  const {
    q,
    state,
    district,
    mp,
    category,
    status,
    risk_level,
    page = 1,
    limit = 10
  } = options;

  const client = getSupabase();
  let query = client.from('projects').select('*', { count: 'exact' });

  if (state && state !== 'ALL' && state !== 'All') {
    query = query.ilike('state', state);
  }
  if (category && category !== 'ALL' && category !== 'All') {
    query = query.ilike('work_category', category);
  }
  if (status && status !== 'ALL' && status !== 'All') {
    query = query.ilike('status', status);
  }
  if (risk_level && risk_level !== 'ALL' && risk_level !== 'All') {
    query = query.ilike('severity', risk_level);
  }
  if (mp && mp !== 'ALL' && mp !== 'All') {
    query = query.ilike('mp_name', `%${mp}%`);
  }
  if (district && district !== 'ALL' && district !== 'All') {
    query = query.ilike('constituency', `%${district}%`);
  }
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`project_id.ilike.%${term}%,mp_name.ilike.%${term}%,constituency.ilike.%${term}%,work_category.ilike.%${term}%`);
  }

  const startIdx = (page - 1) * limit;
  query = query.range(startIdx, startIdx + limit - 1).order('project_id', { ascending: true });

  const { data, count, error } = await query;
  if (error) {
    console.error('[Supabase Error] getProjects query failed:', error.message);
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const hydrated = (data || []).map(hydrateProject);
  const total = count || 0;

  return {
    data: hydrated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    source: 'supabase'
  };
}

// GET SINGLE PROJECT by ID directly from Supabase (Strictly NO local-file fallback)
export async function getProjectById(id: string): Promise<RawProjectRecord | null> {
  const client = getSupabase();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('project_id', id)
    .maybeSingle();

  if (error) {
    console.error(`[Supabase Error] getProjectById failed on ${id}:`, error.message);
    throw new Error(`Supabase getProjectById failed: ${error.message}`);
  }

  if (!data) return null;
  return hydrateProject(data);
}

// GET ANOMALIES directly from Supabase (Strictly NO local-file fallback)
export async function getAnomalies(options: {
  state?: string;
  district?: string;
  category?: string;
  status?: string;
  risk_level?: string;
  severity?: string;
  min_amount?: number;
  max_amount?: number;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: RawProjectRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: {
    flaggedCount: number;
    underReviewCount: number;
    totalInQueue: number;
  };
  source: string;
}> {
  const {
    state,
    district,
    category,
    status,
    risk_level,
    severity,
    min_amount,
    max_amount,
    sort = 'risk',
    page = 1,
    limit = 10
  } = options;

  const client = getSupabase();
  let query = client.from('projects').select('*', { count: 'exact' });

  // Items a reviewer marked as False Positive (workflow_status RESOLVED) leave the queue.
  // Previously this was done by overwriting the ML score to 15/low; now the ML score is kept intact.
  const notResolved = 'workflow_status.is.null,workflow_status.neq.RESOLVED';
  query = query.or(notResolved);

  const filterSeverity = risk_level || severity;
  if (filterSeverity && filterSeverity !== 'ALL' && filterSeverity !== 'All') {
    query = query.ilike('severity', filterSeverity);
  } else {
    // Default vigilance queue shows high risk, medium risk, or items with flags
    query = query.in('severity', ['high', 'medium']);
  }

  if (state && state !== 'ALL' && state !== 'All') {
    query = query.ilike('state', state);
  }
  if (district && district !== 'ALL' && district !== 'All') {
    query = query.ilike('constituency', `%${district}%`);
  }
  if (category && category !== 'ALL' && category !== 'All') {
    query = query.ilike('work_category', category);
  }
  if (status && status !== 'ALL' && status !== 'All') {
    query = query.ilike('status', status);
  }
  if (min_amount !== undefined && !isNaN(min_amount)) {
    query = query.gte('actual_expenditure', min_amount);
  }
  if (max_amount !== undefined && !isNaN(max_amount)) {
    query = query.lte('actual_expenditure', max_amount);
  }

  // Sorting
  if (sort === 'risk') {
    query = query.order('risk_score', { ascending: false, nullsFirst: false });
  } else if (sort === 'amount') {
    query = query.order('actual_expenditure', { ascending: false });
  } else if (sort === 'utilization') {
    query = query.order('actual_expenditure', { ascending: false });
  } else {
    query = query.order('risk_score', { ascending: false, nullsFirst: false });
  }

  const startIdx = (page - 1) * limit;
  query = query.range(startIdx, startIdx + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[Supabase Error] getAnomalies query failed:', error.message);
    throw new Error(`Supabase getAnomalies query failed: ${error.message}`);
  }

  // Live metrics directly from Supabase
  const [{ count: highRiskCount }, { count: underReviewCount }] = await Promise.all([
    // OLD: counts included items already resolved as False Positive
    // client.from('projects').select('*', { count: 'exact', head: true }).eq('severity', 'high'),
    // client.from('projects').select('*', { count: 'exact', head: true }).eq('severity', 'medium')
    client.from('projects').select('*', { count: 'exact', head: true }).eq('severity', 'high').or(notResolved),
    client.from('projects').select('*', { count: 'exact', head: true }).eq('severity', 'medium').or(notResolved)
  ]);

  const hydrated = (data || []).map(hydrateProject);
  const total = count || 0;

  return {
    data: hydrated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    metrics: {
      flaggedCount: highRiskCount || 0,
      underReviewCount: underReviewCount || 0,
      totalInQueue: total
    },
    source: 'supabase'
  };
}

// UPDATE PROJECT SCORE directly in Supabase
export async function updateProjectScore(id: string, scoreData: {
  risk_score: number;
  severity: 'low' | 'medium' | 'high';
  flags: string[];
  reason: string;
}): Promise<void> {
  const client = getSupabase();
  const { error } = await client
    .from('projects')
    .update({
      risk_score: scoreData.risk_score,
      severity: scoreData.severity,
      flags: scoreData.flags,
      reason: scoreData.reason
    })
    .eq('project_id', id);

  if (error) {
    console.error(`[Supabase Error] updateProjectScore failed on ${id}:`, error.message);
    throw new Error(`Supabase updateProjectScore failed on ${id}: ${error.message}`);
  }

  // Update in-memory cache
  const cached = cachedProjects.find(p => p.project_id === id);
  if (cached) {
    cached.risk_score = scoreData.risk_score;
    cached.severity = scoreData.severity;
    cached.flags = scoreData.flags;
    cached.reason = scoreData.reason;
  }
}

// UPDATE PROJECT WORKFLOW directly in Supabase
export async function updateProjectWorkflow(id: string, updates: {
  workflow_status: 'FLAGGED' | 'VERIFIED' | 'ESCALATED' | 'RESOLVED' | 'UNDER_REVIEW';
  severity?: 'low' | 'medium' | 'high';
  risk_score?: number;
}): Promise<void> {
  const client = getSupabase();
  const payload: any = {
    workflow_status: updates.workflow_status
  };
  if (updates.severity) {
    payload.severity = updates.severity;
  }
  if (updates.risk_score !== undefined) {
    payload.risk_score = updates.risk_score;
  }

  const { error } = await client
    .from('projects')
    .update(payload)
    .eq('project_id', id);

  if (error) {
    console.error(`[Supabase Error] updateProjectWorkflow failed on ${id}:`, error.message);
    throw new Error(`Supabase updateProjectWorkflow failed on ${id}: ${error.message}`);
  }

  // Update in-memory cache
  const cached = cachedProjects.find(p => p.project_id === id);
  if (cached) {
    cached.workflow_status = updates.workflow_status;
    if (updates.severity) cached.severity = updates.severity;
    if (updates.risk_score !== undefined) cached.risk_score = updates.risk_score;
  }
}

// Retrieve full project array (backed by Supabase)
export function getAllProjectsList(): RawProjectRecord[] {
  if (cachedProjects.length > 0) {
    return cachedProjects;
  }
  // If cache not yet filled, synchronously read store while async fill finishes
  try {
    const dataDir = path.join(process.cwd(), 'server', 'data');
    const storePath = path.join(dataDir, 'projects_store.json');
    if (fs.existsSync(storePath)) {
      const content = fs.readFileSync(storePath, 'utf8');
      cachedProjects = JSON.parse(content);
      for (const p of cachedProjects) {
        if (/^the\s+dadra/i.test(p.state || '')) {
          p.state = 'Dadra and Nagar Haveli and Daman and Diu';
        }
      }
    }
  } catch (e) {
    console.warn('Fallback sync store read warning:', e);
  }
  return cachedProjects;
}

// Helper to reload projects from CSV if needed
export function reloadProjectsFromCsv(): RawProjectRecord[] {
  try {
    const dataDir = path.join(process.cwd(), 'server', 'data');
    const storePath = path.join(dataDir, 'projects_store.json');
    if (fs.existsSync(storePath)) {
      const content = fs.readFileSync(storePath, 'utf8');
      cachedProjects = JSON.parse(content);
      for (const p of cachedProjects) {
        if (/^the\s+dadra/i.test(p.state || '')) {
          p.state = 'Dadra and Nagar Haveli and Daman and Diu';
        }
      }
    }
  } catch (e) {
    console.warn('Fallback reload error:', e);
  }
  return cachedProjects;
}

// Disk persistence helper
export function persistMemoryStore(): void {
  try {
    const dataDir = path.join(process.cwd(), 'server', 'data');
    const storePath = path.join(dataDir, 'projects_store.json');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(cachedProjects, null, 2), 'utf8');
  } catch (e) {
    console.error('Error persisting memory projects to disk:', e);
  }
}

// Sync projects to Supabase in batches (upsert)
export async function syncProjectsToSupabase(): Promise<{ success: boolean; totalUploaded: number }> {
  const client = getSupabase();
  const projects = getAllProjectsList();
  const batchSize = 100;
  let uploaded = 0;

  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize).map(toSupabaseRow);
    const { error } = await client.from('projects').upsert(batch, { onConflict: 'project_id' });
    if (error) {
      throw new Error(`Failed to sync batch to Supabase: ${error.message}`);
    }
    uploaded += batch.length;
  }

  return { success: true, totalUploaded: uploaded };
}

export async function forceCheckAndMigrateSupabase() {
  return syncProjectsToSupabase();
}

// Supabase status information
export async function getSupabaseStatusInfo() {
  const client = getSupabase();
  const { count, error } = await client
    .from('projects')
    .select('*', { count: 'exact', head: true });

  const total = count ?? cachedProjects.length;

  return {
    isConfigured: true,
    supabaseUrl: cleanedUrl,
    tableAvailable: true,
    supabaseRowCount: count ?? null,
    totalLocalProjects: total,
    distinctStatesCount: new Set(cachedProjects.map(p => p.state)).size || 36,
    error: error ? error.message : null
  };
}
