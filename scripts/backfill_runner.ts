import fs from 'fs';
import path from 'path';

interface ProjectRecord {
  project_id: string;
  state: string;
  work_category: string;
  mp_name: string;
  sanctioned_amount: number;
  actual_expenditure: number;
  start_date: string;
  expected_completion: string;
  actual_completion: string | null;
  status: string;
  has_tender_on_file: boolean;
  has_mp_recommendation: boolean;
  risk_score: number | null;
  severity: 'low' | 'medium' | 'high' | null;
  flags: string[];
  reason: string | null;
  [key: string]: any;
}

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://ml-sih-7txo.onrender.com';
const storePath = path.join(process.cwd(), 'server', 'data', 'projects_store.json');

async function warmUpMLService(): Promise<boolean> {
  console.log(`[Backfill Runner] Step 1: Sending warm-up GET probe to ${ML_SERVICE_URL}/...`);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${ML_SERVICE_URL}/`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        console.log(`[Backfill Runner] ML Service is awake and returned HTTP ${res.status}!`);
        return true;
      }
      console.warn(`[Backfill Runner] Warmup attempt ${attempt} returned HTTP ${res.status}`);
    } catch (e: any) {
      console.warn(`[Backfill Runner] Warmup attempt ${attempt} failed: ${e.message}`);
    }
    if (attempt < maxAttempts) {
      console.log(`[Backfill Runner] Waiting 5s before attempt ${attempt + 1}...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return false;
}

async function scoreSingleProject(p: ProjectRecord, timeoutMs = 30000): Promise<{ risk_score: number; severity: 'low' | 'medium' | 'high'; flags: string[]; reason: string }> {
  const payload = {
    project_id: p.project_id,
    state: p.state || 'General',
    work_category: p.work_category || 'Other',
    mp_name: p.mp_name || 'Hon. MP',
    sanctioned_amount: Number(p.sanctioned_amount) || 1000000,
    actual_expenditure: Number(p.actual_expenditure) || 0,
    start_date: p.start_date || '2023-04-01',
    expected_completion: p.expected_completion || '2024-03-31',
    actual_completion: p.actual_completion || null,
    status: p.status || 'In Progress',
    has_tender_on_file: Boolean(p.has_tender_on_file),
    has_mp_recommendation: Boolean(p.has_mp_recommendation)
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ML_SERVICE_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data = await res.json() as any;
    return {
      risk_score: Number(data.risk_score),
      severity: data.severity,
      flags: Array.isArray(data.flags) ? data.flags : [],
      reason: data.reason || 'Scored by ML Engine'
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log('========================================================');
  console.log('[Backfill Runner] Commencing ML Backfill for MPLADS Projects');
  console.log('========================================================');

  // 1. Warm-up
  const isHealthy = await warmUpMLService();
  if (!isHealthy) {
    console.error('[Backfill Runner] Warning: ML service did not return 200 on warmup, proceeding with retries...');
  }

  // 2. Read projects
  if (!fs.existsSync(storePath)) {
    console.error(`[Backfill Runner] Error: Store file not found at ${storePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(storePath, 'utf8');
  const projects: ProjectRecord[] = JSON.parse(rawData);
  console.log(`[Backfill Runner] Loaded ${projects.length} projects from ${storePath}`);

  // Count unscored
  const unscored = projects.filter(p => p.risk_score === null || p.risk_score === undefined);
  console.log(`[Backfill Runner] Unscored projects count: ${unscored.length} / ${projects.length}`);

  if (unscored.length === 0) {
    console.log('[Backfill Runner] All projects already scored! Nothing to backfill.');
    printSummary(projects);
    return;
  }

  // 3. Concurrency pool
  const concurrency = 16;
  console.log(`[Backfill Runner] Starting first pass with concurrency ${concurrency}...`);

  let currentIndex = 0;
  let successful = 0;
  let failedProjects: { project: ProjectRecord; error: string }[] = [];
  const startTime = Date.now();

  const saveToDisk = () => {
    fs.writeFileSync(storePath, JSON.stringify(projects, null, 2), 'utf8');
  };

  const worker = async (workerId: number) => {
    while (currentIndex < projects.length) {
      const idx = currentIndex++;
      const p = projects[idx];

      // Skip if already scored
      if (p.risk_score !== null && p.risk_score !== undefined) {
        continue;
      }

      try {
        const result = await scoreSingleProject(p, 30000);
        p.risk_score = result.risk_score;
        p.severity = result.severity;
        p.flags = result.flags;
        p.reason = result.reason;
        successful++;
      } catch (err: any) {
        const errMsg = err?.name === 'AbortError' ? 'Timeout (30s)' : err.message;
        failedProjects.push({ project: p, error: errMsg });
        console.warn(`[Backfill Worker ${workerId}] Failed ${p.project_id}: ${errMsg}`);
      }

      const processedCount = successful + failedProjects.length;
      if (processedCount % 50 === 0 || processedCount === unscored.length) {
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (processedCount / (Number(elapsedSec) || 1)).toFixed(1);
        console.log(`[Backfill Progress] ${processedCount}/${unscored.length} processed (${successful} ok, ${failedProjects.length} failed) in ${elapsedSec}s (${rate} req/s)`);
        saveToDisk();
      }
    }
  };

  const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  saveToDisk();

  console.log(`\n[Backfill First Pass Done] ${successful} successful, ${failedProjects.length} failures.`);

  // 4. Retry Pass for Failed Projects
  if (failedProjects.length > 0) {
    console.log(`\n[Backfill Retry Pass] Retrying ${failedProjects.length} failed projects with 4 workers and 45s timeout...`);
    const retryList = [...failedProjects];
    failedProjects = []; // reset for retry tracking

    let retryIdx = 0;
    const retryWorker = async () => {
      while (retryIdx < retryList.length) {
        const { project: p } = retryList[retryIdx++];
        try {
          const result = await scoreSingleProject(p, 45000);
          p.risk_score = result.risk_score;
          p.severity = result.severity;
          p.flags = result.flags;
          p.reason = result.reason;
          successful++;
          console.log(`[Backfill Retry OK] Successfully scored ${p.project_id} on retry!`);
        } catch (err: any) {
          const errMsg = err?.name === 'AbortError' ? 'Timeout (45s)' : err.message;
          failedProjects.push({ project: p, error: errMsg });
          console.error(`[Backfill Retry Failed] ${p.project_id} still failed: ${errMsg}`);
        }
      }
    };

    await Promise.all(Array.from({ length: 4 }, () => retryWorker()));
    saveToDisk();
  }

  // 5. Final Summary & Verification
  printSummary(projects);

  if (failedProjects.length > 0) {
    console.warn(`\n[Backfill Warning] ${failedProjects.length} projects could not be scored:`);
    failedProjects.forEach(f => console.warn(` - ${f.project.project_id}: ${f.error}`));
  }

  // 6. Trigger API reload if running
  try {
    const reloadRes = await fetch('http://localhost:3000/api/admin/reload-dataset', { method: 'POST' });
    if (reloadRes.ok) {
      console.log('[Backfill Runner] Triggered dev server reload-dataset: Server memory state updated!');
    }
  } catch (e: any) {
    console.log('[Backfill Runner] Dev server notification: ' + e.message);
  }

  console.log('[Backfill Runner] Backfill script complete.');
}

function printSummary(projects: ProjectRecord[]) {
  const nullRisk = projects.filter(p => p.risk_score === null || p.risk_score === undefined).length;
  const highRisk = projects.filter(p => p.severity === 'high').length;
  const medRisk = projects.filter(p => p.severity === 'medium').length;
  const lowRisk = projects.filter(p => p.severity === 'low').length;

  console.log('\n========================================================');
  console.log('[Backfill Verification Summary]');
  console.log('--------------------------------------------------------');
  console.log(`Total projects:                ${projects.length}`);
  console.log(`Unscored (risk_score IS NULL): ${nullRisk}`);
  console.log(`High Risk count:               ${highRisk}`);
  console.log(`Medium Risk count:             ${medRisk}`);
  console.log(`Low Risk count:                ${lowRisk}`);
  console.log(`Total Scored (High+Med+Low):   ${highRisk + medRisk + lowRisk}`);
  console.log('========================================================\n');
}

main().catch(err => {
  console.error('[Backfill Fatal Error]:', err);
  process.exit(1);
});
