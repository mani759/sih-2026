import { MLScoreResult, UtilizationBenchmark, Project, V3ScoreRequest, V3ScoreResult } from '../../src/types';
import type { WorkRow } from './worksService';

// OLD: const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://ml-sih-7txo.onrender.com';
// The old synthetic-schema service is no longer a fallback; the v3 service URL must be configured.
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || '').replace(/\/+$/, '');
// Optional: the v3 service accepts an x-service-key header on /score.
const ML_SERVICE_KEY = process.env.ML_SERVICE_KEY || '';
// Render free instances take ~45s to wake from a cold start.
const V3_TIMEOUT_MS = 90000;

function requireServiceUrl(): string {
  if (!ML_SERVICE_URL) {
    throw new Error('[ML Service] ML_SERVICE_URL is not configured.');
  }
  return ML_SERVICE_URL;
}

// ==========================================
// ML v3 (eSAKSHI) — on-demand scoring of a single real work. Never persisted.
// ==========================================

// Fields the v3 service requires (WorkIn.required) — must be real, non-empty values.
// OLD: activity_type and work_description were also required; the v3 contract now accepts them as null
// (33,952 pending works have no parsed activity type; 139 works have no description).
const V3_REQUIRED_TEXT = ['house', 'state', 'ida', 'mp_name', 'recommendation_date'] as const;
// Fields the v3 service would silently default if omitted (e.g. is_completed=false, total_paid=0),
// so they must be supplied explicitly from the data.
const V3_REQUIRED_BOOL = ['in_recommended_list', 'in_sanctioned_list', 'is_completed'] as const;
const V3_REQUIRED_INT = ['payment_count', 'vendor_count'] as const;
// Nullable fields — null means "not recorded" and is sent as null.
const V3_NULLABLE_TEXT = ['activity_type', 'work_description', 'constituency', 'work_category', 'sanction_date', 'stage',
  'completion_date', 'last_payment_date'] as const;
// recommended_amount may be null (619 works sanctioned without a recommended-list record), but then
// sanction_amount must be present — see the amount check in validateV3Request.
const V3_NULLABLE_NUM = ['recommended_amount', 'sanction_amount', 'actual_cost'] as const;

// request is null whenever missing/invalid is non-empty.
export interface V3ValidationResult {
  ok: boolean;
  request: V3ScoreRequest | null;
  missing: string[];
  invalid: string[];
}

// Validates a candidate v3 request without filling in anything: a missing or null required
// value is reported, never defaulted.
export function validateV3Request(input: Record<string, any>): V3ValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  const has = (k: string) => input[k] !== undefined && input[k] !== null;

  for (const k of V3_REQUIRED_TEXT) {
    if (!has(k) || String(input[k]).trim() === '') missing.push(k);
    else if (typeof input[k] !== 'string') invalid.push(k);
  }
  // OLD: recommended_amount was required on its own.
  // The service scores amount = sanction_amount, else recommended_amount, so one of them must be real.
  if (!has('recommended_amount') && !has('sanction_amount')) missing.push('recommended_amount or sanction_amount');
  if (!has('total_paid')) missing.push('total_paid');
  else if (typeof input.total_paid !== 'number' || !Number.isFinite(input.total_paid)) invalid.push('total_paid');
  for (const k of V3_REQUIRED_BOOL) {
    if (!has(k)) missing.push(k);
    else if (typeof input[k] !== 'boolean') invalid.push(k);
  }
  for (const k of V3_REQUIRED_INT) {
    if (!has(k)) missing.push(k);
    else if (!Number.isInteger(input[k])) invalid.push(k);
  }
  if (!has('work_id')) missing.push('work_id');
  else if (!Number.isInteger(input.work_id)) invalid.push('work_id');
  for (const k of V3_NULLABLE_TEXT) {
    if (input[k] === undefined) missing.push(k);
    else if (input[k] !== null && typeof input[k] !== 'string') invalid.push(k);
  }
  for (const k of V3_NULLABLE_NUM) {
    if (input[k] === undefined) missing.push(k);
    else if (input[k] !== null && (typeof input[k] !== 'number' || !Number.isFinite(input[k]))) invalid.push(k);
  }
  if (input.as_of !== undefined && input.as_of !== null && typeof input.as_of !== 'string') invalid.push('as_of');

  if (missing.length > 0 || invalid.length > 0) return { ok: false, request: null, missing, invalid };

  // Copy only contract fields, so nothing else is forwarded to the service.
  const request: V3ScoreRequest = {
    house: input.house,
    state: input.state,
    ida: input.ida,
    mp_name: input.mp_name,
    activity_type: input.activity_type,
    work_description: input.work_description,
    recommended_amount: input.recommended_amount,
    recommendation_date: input.recommendation_date,
    work_id: input.work_id,
    constituency: input.constituency,
    work_category: input.work_category,
    sanction_date: input.sanction_date,
    sanction_amount: input.sanction_amount,
    stage: input.stage,
    in_recommended_list: input.in_recommended_list,
    in_sanctioned_list: input.in_sanctioned_list,
    is_completed: input.is_completed,
    completion_date: input.completion_date,
    actual_cost: input.actual_cost,
    total_paid: input.total_paid,
    payment_count: input.payment_count,
    vendor_count: input.vendor_count,
    last_payment_date: input.last_payment_date
  };
  if (input.as_of) request.as_of = input.as_of;
  return { ok: true, request, missing, invalid };
}

// Builds the v3 request from a real `works` row, copying stored values verbatim
// (state is NOT display-normalized; nulls stay null).
export function buildV3RequestFromWork(row: WorkRow, asOf?: string | null): V3ValidationResult {
  const toNumber = (v: unknown) => (v === null || v === undefined ? v : Number(v));
  return validateV3Request({
    house: row.house,
    state: row.state,
    ida: row.ida,
    mp_name: row.mp_name,
    activity_type: row.activity_type,
    work_description: row.work_description,
    recommended_amount: toNumber(row.recommended_amount),
    recommendation_date: row.recommendation_date,
    work_id: row.work_id,
    constituency: row.constituency,
    work_category: row.work_category,
    sanction_date: row.sanction_date,
    sanction_amount: toNumber(row.sanction_amount),
    stage: row.stage,
    in_recommended_list: row.in_recommended_list,
    in_sanctioned_list: row.in_sanctioned_list,
    is_completed: row.is_completed,
    completion_date: row.completion_date,
    actual_cost: toNumber(row.actual_cost),
    total_paid: toNumber(row.total_paid),
    payment_count: row.payment_count,
    vendor_count: row.vendor_count,
    last_payment_date: row.last_payment_date,
    as_of: asOf ?? undefined
  });
}

// POST {ML_SERVICE_URL}/score with a validated v3 request. No caching, no persistence.
export async function scoreWorkV3(request: V3ScoreRequest, timeoutMs: number = V3_TIMEOUT_MS): Promise<V3ScoreResult> {
  const baseUrl = requireServiceUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ML_SERVICE_KEY) headers['x-service-key'] = ML_SERVICE_KEY;

  try {
    const response = await fetch(`${baseUrl}/score`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`[ML Service v3] /score returned HTTP ${response.status}: ${errText.slice(0, 500)}`);
    }
    const data = await response.json() as V3ScoreResult;
    if (typeof data?.risk_score !== 'number' || !Array.isArray(data.flags) || !Array.isArray(data.reasons)) {
      throw new Error('[ML Service v3] /score returned an unexpected response shape');
    }
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`[ML Service v3] /score timed out after ${timeoutMs}ms for work ${request.house}-${request.work_id}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// GET {ML_SERVICE_URL}/ — the v3 service's health endpoint (returns status, service, model_version).
export async function checkMlServiceHealth(timeoutMs: number = V3_TIMEOUT_MS): Promise<{
  online: boolean;
  status: number | null;
  service?: string;
  model_version?: string;
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${requireServiceUrl()}/`, { signal: controller.signal });
    const body = await response.json().catch(() => ({} as any));
    return {
      online: response.ok && body?.status === 'ok',
      status: response.status,
      service: body?.service,
      model_version: body?.model_version
    };
  } catch (err: any) {
    return { online: false, status: null, error: err?.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timeout);
  }
}

// ==========================================
// LEGACY (old synthetic Project schema) — DEPRECATED, not called by any live route.
// The v3 service has no /duplicates or /utilization-benchmark endpoints, and its /score rejects the
// old payload. Kept temporarily because server/services/backfillService.ts still imports scoreProject.
// ==========================================

const scoreCache = new Map<string, MLScoreResult>();
const benchmarkCache = new Map<string, UtilizationBenchmark>();
const duplicateCache = new Map<string, boolean[]>();

/** @deprecated Old Project-schema scoring; use buildV3RequestFromWork + scoreWorkV3. */
// OLD: 30s timeout was shorter than a Render cold start (~60s), so first calls failed
// export async function scoreProject(project: Project, timeoutMs: number = 30000): Promise<MLScoreResult> {
export async function scoreProject(project: Project, timeoutMs: number = 60000, useCache: boolean = true): Promise<MLScoreResult> {
  const cacheKey = `${project.project_id}_${project.actual_expenditure}_${project.status}_${project.has_tender_on_file}`;
  if (useCache && scoreCache.has(cacheKey)) {
    return scoreCache.get(cacheKey)!;
  }

  // Warn when defaults below will be substituted, so the model isn't silently scoring made-up values
  const missingFields = ['sanctioned_amount', 'start_date', 'expected_completion', 'state', 'work_category', 'status']
    .filter(f => (project as any)[f] === undefined || (project as any)[f] === null || (project as any)[f] === '');
  if (missingFields.length > 0) {
    console.warn(`[ML Service] Project ${project.project_id} missing ${missingFields.join(', ')}; default values sent to /score.`);
  }

  const payload = {
    project_id: project.project_id,
    state: project.state || 'General',
    work_category: project.work_category || 'Other',
    mp_name: project.mp_name || 'Hon. MP',
    sanctioned_amount: Number(project.sanctioned_amount) || 1000000,
    actual_expenditure: Number(project.actual_expenditure) || 0,
    start_date: project.start_date || '2023-04-01',
    expected_completion: project.expected_completion || '2024-03-31',
    actual_completion: project.actual_completion || null,
    status: project.status || 'In Progress',
    has_tender_on_file: Boolean(project.has_tender_on_file),
    has_mp_recommendation: Boolean(project.has_mp_recommendation)
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ML_SERVICE_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`[ML Service] /score returned HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json() as MLScoreResult;
    if (useCache) scoreCache.set(cacheKey, data);
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`[ML Service] /score timed out after ${timeoutMs}ms for project ${project.project_id}`);
    }
    throw new Error(`[ML Service] Failed to score project ${project.project_id}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** @deprecated Old service /duplicates (absent in v3). Duplicate signals now come from work_scores flags. */
export async function checkDuplicates(projects: Project[]): Promise<boolean[]> {
  if (!projects || projects.length === 0) return [];

  // Generate cache key based on project IDs
  const cacheKey = projects.map(p => p.project_id || (p as any).id).sort().join('|');
  if (duplicateCache.has(cacheKey)) {
    return duplicateCache.get(cacheKey)!;
  }

  const payload = projects.map((p: any) => ({
    project_id: String(p.project_id || p.id || 'PROJ-TEMP'),
    state: String(p.state || 'General'),
    work_category: String(p.work_category || 'Other'),
    mp_name: String(p.mp_name || 'Hon. MP'),
    sanctioned_amount: Number(p.sanctioned_amount || p.amount) || 1000000,
    actual_expenditure: Number(p.actual_expenditure) || 0,
    start_date: String(p.start_date || '2023-04-01'),
    expected_completion: String(p.expected_completion || '2024-03-31'),
    actual_completion: p.actual_completion ? String(p.actual_completion) : null,
    status: String(p.status || 'In Progress'),
    has_tender_on_file: Boolean(p.has_tender_on_file),
    has_mp_recommendation: Boolean(p.has_mp_recommendation)
  }));

  try {
    const controller = new AbortController();
    // Allow ample time for external service without timing out prematurely
    // OLD: 12s timeout always lost to a Render cold start (~60s)
    // const timeout = setTimeout(() => controller.abort(), 12000);
    const timeout = setTimeout(() => controller.abort(), 60000);

    let response: Response;
    try {
      response = await fetch(`${ML_SERVICE_URL}/duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.duplicate_flags) && data.duplicate_flags.length === projects.length) {
        duplicateCache.set(cacheKey, data.duplicate_flags);
        return data.duplicate_flags;
      }
      throw new Error('[ML Service] /duplicates returned an unexpected response shape');
    }
    throw new Error(`[ML Service] /duplicates returned HTTP ${response.status}`);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // OLD: console.log('[ML Service] /duplicates request timed out; applying local similarity heuristic fallback.');
      throw new Error('[ML Service] /duplicates timed out after 60000ms');
    }
    // OLD: console.log('[ML Service] /duplicates endpoint unreachable; applying local similarity heuristic fallback.');
    throw err;
  }

  // OLD: local heuristic fallback + hard-coded duplicate IDs, disabled so only ML output is shown.
  // Failures now surface as an error ("Duplicate scanner error: ...") on the Anomalies page.
  //
  // // Fallback duplicate detection matching pairwise (state, work_category, mp_name, project_name) + known clusters
  // const knownDuplicateIds = new Set(['MPLAD-2023-TS-0103', 'MPLAD-2023-TS-0104']);
  // const counts = new Map<string, number>();
  //
  // for (const p of projects as any[]) {
  //   const s = (p.state || '').toLowerCase();
  //   const c = (p.work_category || '').toLowerCase();
  //   const m = (p.mp_name || '').toLowerCase();
  //   const n = (p.project_name || p.name || '').toLowerCase().slice(0, 25);
  //   const key = `${s}|${c}|${m || n}`;
  //   counts.set(key, (counts.get(key) || 0) + 1);
  // }
  //
  // const fallbackResults = projects.map((p: any) => {
  //   const pid = String(p.project_id || p.id || '');
  //   if (knownDuplicateIds.has(pid) || p.is_potential_duplicate) {
  //     return true;
  //   }
  //   const s = (p.state || '').toLowerCase();
  //   const c = (p.work_category || '').toLowerCase();
  //   const m = (p.mp_name || '').toLowerCase();
  //   const n = (p.project_name || p.name || '').toLowerCase().slice(0, 25);
  //   const key = `${s}|${c}|${m || n}`;
  //   return (counts.get(key) || 0) > 1;
  // });
  //
  // duplicateCache.set(cacheKey, fallbackResults);
  // return fallbackResults;
}

// OLD: hard-coded benchmark table + cache pre-population, disabled so benchmarks are fetched live from Render /utilization-benchmark/{state}
// // ML Pipeline Benchmark values for all 36 States & UTs (derived from utilization_benchmark.pkl)
// const stateBenchmarks: Record<string, number> = {
//   'Andaman and Nicobar Islands': 0.547,
//   'Andhra Pradesh': 0.432,
//   'Arunachal Pradesh': 0.675,
//   'Assam': 0.407,
//   'Bihar': 0.571,
//   'Chandigarh': 0.767,
//   'Chhattisgarh': 0.613,
//   'Dadra and Nagar Haveli and Daman and Diu': 0.547,
//   'Delhi': 0.563,
//   'Goa': 0.573,
//   'Gujarat': 0.594,
//   'Haryana': 0.505,
//   'Himachal Pradesh': 0.396,
//   'Jammu and Kashmir': 0.547,
//   'Jharkhand': 0.408,
//   'Karnataka': 0.458,
//   'Kerala': 0.654,
//   'Ladakh': 0.547,
//   'Lakshadweep': 0.363,
//   'Madhya Pradesh': 0.515,
//   'Maharashtra': 0.505,
//   'Manipur': 0.524,
//   'Meghalaya': 0.668,
//   'Mizoram': 0.794,
//   'Nagaland': 0.593,
//   'Odisha': 0.398,
//   'Puducherry': 0.626,
//   'Punjab': 0.479,
//   'Rajasthan': 0.439,
//   'Sikkim': 0.508,
//   'Tamil Nadu': 0.589,
//   'Telangana': 0.605,
//   'Tripura': 0.682,
//   'Uttar Pradesh': 0.58,
//   'Uttarakhand': 0.343,
//   'West Bengal': 0.602
// };
// 
// // Pre-populate benchmark cache
// for (const [st, val] of Object.entries(stateBenchmarks)) {
//   benchmarkCache.set(encodeURIComponent(st.trim()), {
//     state: st,
//     state_utilization: val,
//     national_avg: 0.547
//   });
// }

/** @deprecated Old service /utilization-benchmark (absent in v3). Benchmarks are computed from works in api.ts. */
export async function getUtilizationBenchmark(state: string): Promise<UtilizationBenchmark> {
  const normalizedState = encodeURIComponent(state.trim());
  if (benchmarkCache.has(normalizedState)) {
    return benchmarkCache.get(normalizedState)!;
  }

  // OLD: read from the hard-coded table instead of the ML service
  // const benchmark: UtilizationBenchmark = {
  //   state,
  //   state_utilization: stateBenchmarks[state] ?? 0.547,
  //   national_avg: 0.547
  // };
  // benchmarkCache.set(normalizedState, benchmark);
  // return benchmark;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${ML_SERVICE_URL}/utilization-benchmark/${normalizedState}`, {
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`[ML Service] /utilization-benchmark returned HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const benchmark: UtilizationBenchmark = {
      state: data.state ?? state,
      state_utilization: Number(data.state_utilization),
      national_avg: Number(data.national_avg)
    };
    benchmarkCache.set(normalizedState, benchmark);
    return benchmark;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`[ML Service] /utilization-benchmark timed out after 60000ms for ${state}`);
    }
    throw new Error(`[ML Service] Failed to fetch benchmark for ${state}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** @deprecated See getUtilizationBenchmark. */
export async function getAllStateBenchmarks(): Promise<Array<{
  state: string;
  state_utilization: number;
  national_avg: number;
  difference: number;
  status: 'above' | 'below' | 'equal';
  provenance: string;
}>> {
  const allStates = [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
    'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
    'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];

  // OLD: Promise.all — one failed state would fail the whole Trend Analysis page
  // const results = await Promise.all(
  const settled = await Promise.allSettled(
    allStates.map(async (st) => {
      const bench = await getUtilizationBenchmark(st);
      const diff = Number((bench.state_utilization - bench.national_avg).toFixed(3));
      let status: 'above' | 'below' | 'equal' = 'equal';
      if (diff > 0.001) status = 'above';
      else if (diff < -0.001) status = 'below';

      return {
        state: st,
        state_utilization: bench.state_utilization,
        national_avg: bench.national_avg,
        difference: diff,
        status,
        // OLD: provenance: 'ML Pipeline Benchmark'
        provenance: 'Render ML Service (live)'
      };
    })
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getAllStateBenchmarks>>[number]> => r.status === 'fulfilled')
    .map(r => r.value);

  const failedCount = settled.length - results.length;
  if (failedCount > 0) {
    console.warn(`[ML Service] ${failedCount} of ${allStates.length} state benchmarks could not be fetched from the ML service.`);
  }

  return results;
}

