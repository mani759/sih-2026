import { MLScoreResult, UtilizationBenchmark, Project } from '../../src/types';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://ml-sih-7txo.onrender.com';

const scoreCache = new Map<string, MLScoreResult>();
const benchmarkCache = new Map<string, UtilizationBenchmark>();
const duplicateCache = new Map<string, boolean[]>();

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

