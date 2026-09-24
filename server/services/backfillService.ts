import { getAllProjectsList, updateProjectScore, persistMemoryStore, checkSupabaseTableExists, syncProjectsToSupabase } from './supabaseService';
import { scoreProject } from './mlService';

export interface BackfillProgress {
  status: 'idle' | 'in_progress' | 'completed' | 'failed';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentBatch: number;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

let activeProgress: BackfillProgress = {
  status: 'idle',
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  currentBatch: 0,
  startedAt: null,
  completedAt: null,
  lastError: null
};

export function getBackfillStatus(): BackfillProgress {
  return { ...activeProgress };
}

export async function runBackfill(options?: { concurrency?: number; limit?: number }) {
  if (activeProgress.status === 'in_progress') {
    return { message: 'Backfill is already running', progress: getBackfillStatus() };
  }

  const concurrency = options?.concurrency || 8;
  const projects = getAllProjectsList();
  const targetProjects = options?.limit ? projects.slice(0, options.limit) : projects;

  activeProgress = {
    status: 'in_progress',
    total: targetProjects.length,
    processed: 0,
    successful: 0,
    failed: 0,
    currentBatch: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastError: null
  };

  // Step 1: Warm up the ML service with 60s timeout
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'https://ml-sih-7txo.onrender.com';
  console.log(`[Backfill] Step 1: Sending warm-up request to ${mlServiceUrl}...`);
  try {
    const warmupController = new AbortController();
    const timeoutId = setTimeout(() => warmupController.abort(), 60000);
    const warmupRes = await fetch(`${mlServiceUrl}/`, { signal: warmupController.signal });
    clearTimeout(timeoutId);
    if (warmupRes.ok) {
      console.log('[Backfill] ML service is awake and returned HTTP 200!');
    } else {
      console.warn(`[Backfill] ML service warm-up returned HTTP ${warmupRes.status}`);
    }
  } catch (err: any) {
    console.warn('[Backfill] Warm-up probe warning:', err.message);
  }

  // Step 2 & 4: Controlled concurrency loop (5-10 in flight)
  (async () => {
    try {
      console.log(`[Backfill] Commencing scoring for ${targetProjects.length} projects with concurrency ${concurrency}...`);
      let index = 0;

      const worker = async () => {
        while (index < targetProjects.length) {
          const currentIndex = index++;
          const p = targetProjects[currentIndex];

          try {
            // Exactly the required fields: project_id, state, work_category, mp_name, sanctioned_amount, actual_expenditure, start_date, expected_completion, actual_completion, status, has_tender_on_file, has_mp_recommendation
            const scoreResult = await scoreProject({
              project_id: p.project_id,
              state: p.state,
              work_category: p.work_category,
              mp_name: p.mp_name,
              sanctioned_amount: p.sanctioned_amount,
              actual_expenditure: p.actual_expenditure,
              start_date: p.start_date,
              expected_completion: p.expected_completion,
              actual_completion: p.actual_completion || null,
              status: p.status,
              has_tender_on_file: p.has_tender_on_file,
              has_mp_recommendation: p.has_mp_recommendation
            } as any, 60000);

            await updateProjectScore(p.project_id, {
              risk_score: scoreResult.risk_score,
              severity: scoreResult.severity as any,
              flags: scoreResult.flags,
              reason: scoreResult.reason
            });

            activeProgress.successful++;
          } catch (err: any) {
            activeProgress.failed++;
            activeProgress.lastError = err.message;
          } finally {
            activeProgress.processed++;
            if (activeProgress.processed % 100 === 0 || activeProgress.processed === targetProjects.length) {
              console.log(`[Backfill Progress] ${activeProgress.processed} / ${targetProjects.length} scored (${activeProgress.successful} ok, ${activeProgress.failed} fallback/err)`);
              persistMemoryStore();
            }
          }
        }
      };

      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);

      // Persist final scores
      persistMemoryStore();

      // If Supabase table exists, sync final scores
      const tableExists = await checkSupabaseTableExists();
      if (tableExists) {
        console.log('[Backfill] Syncing scored dataset to Supabase table...');
        await syncProjectsToSupabase();
      }

      activeProgress.status = 'completed';
      activeProgress.completedAt = new Date().toISOString();
      console.log(`[Backfill Complete] All ${targetProjects.length} projects scored successfully!`);
    } catch (fatalError: any) {
      console.error('[Backfill Fatal Error]:', fatalError);
      activeProgress.status = 'failed';
      activeProgress.lastError = fatalError.message;
    }
  })();

  return { message: 'Backfill job initiated', progress: getBackfillStatus() };
}
