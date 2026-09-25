import { Router, Request, Response } from 'express';
// OLD: every data endpoint read the legacy `projects` table (and an in-memory copy of it) via supabaseService,
// and transactions were synthesised from project totals by generateProjectTransactions().
// import {
//   getProjects, getProjectById, getAnomalies, getAllProjectsList, updateProjectScore, updateProjectWorkflow,
//   getSupabaseStatusInfo, syncProjectsToSupabase, forceCheckAndMigrateSupabase, checkSupabaseTableExists,
//   reloadProjectsFromCsv
// } from '../services/supabaseService';
// import { runBackfill, getBackfillStatus } from '../services/backfillService';
// import { STATES_LIST, generateProjectTransactions } from '../data/operationsData';
import {
  AggWork,
  REVIEW_ACTION_STATUS,
  WorkflowStatus,
  canonicalizeState,
  computeUtilization,
  createReviewAction,
  formatWorkKey,
  getDataStatus,
  getWorkRow,
  getMpAlert,
  getPayment,
  getPaymentsSnapshot,
  getReviewStatusIndex,
  getWork,
  getWorkScore,
  getWorksSnapshot,
  isWorksSnapshotReady,
  listAnomalies,
  listMpAlerts,
  listPayments,
  listPaymentsForWork,
  listRecentHighRiskPayments,
  listReviewActions,
  listWorks,
  parsePaymentId,
  parseWorkKey,
  reviewActionsToAuditEntries
} from '../services/worksService';
// OLD: import { scoreProject } from '../services/mlService';
import { buildV3RequestFromWork, checkMlServiceHealth, scoreWorkV3, validateV3Request } from '../services/mlService';
import { generateAnomalyExplanation, processAssistantQuery } from '../services/geminiService';
import { getAllAuditLogs, getAuditLogsForEntity, saveAuditLog, fetchAuditLogsFromSupabase } from '../services/auditService';
import {
  authMiddleware,
  requireAdminRole,
  handleLogin,
  handleSignup,
  handleVerifySession
} from '../services/authService';
import { AuditLogEntry } from '../../src/types';

export const apiRouter = Router();

// Apply auth middleware to attach authenticated user/role if bearer token is present
apiRouter.use(authMiddleware);

export function normalizeStateName(s?: string | null): string {
  if (!s) return '';
  let cleaned = s.trim().toLowerCase();
  if (cleaned.startsWith('the ')) {
    cleaned = cleaned.replace(/^the\s+/, '');
  }
  return cleaned.replace(/\s+/g, ' ');
}

export function isSameState(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeStateName(a) === normalizeStateName(b);
}

// ==========================================
// Aggregation helpers over the works snapshot (see worksService.getWorksSnapshot)
// ==========================================

const isAll = (v: unknown) => !v || v === 'ALL' || v === 'All';
const sum = (ws: AggWork[], f: (w: AggWork) => number | null) => ws.reduce((s, w) => s + (f(w) || 0), 0);
const isDuplicate = (w: AggWork) => w.flags.includes('possible_duplicate') || w.flags.includes('duplicate_paid');
const isStalled = (w: AggWork) => w.lifecycle !== 'Completed' && w.flags.includes('overdue_stalled');
const isActive = (w: AggWork) => w.lifecycle === 'In Progress' || w.lifecycle === 'Not Started';

function statesOf(works: AggWork[]): string[] {
  return Array.from(new Set(works.map(w => w.state).filter(Boolean))).sort();
}

function groupBy<K>(works: AggWork[], keyOf: (w: AggWork) => K | null): Map<K, AggWork[]> {
  const m = new Map<K, AggWork[]>();
  for (const w of works) {
    const k = keyOf(w);
    if (k === null || k === undefined) continue;
    const arr = m.get(k);
    if (arr) arr.push(w);
    else m.set(k, [w]);
  }
  return m;
}

// Unresolved = no reviewer decision that clears it (VERIFIED / RESOLVED).
function isUnresolved(key: string, reviews: Map<string, { status: WorkflowStatus }>): boolean {
  const s = reviews.get(key)?.status;
  return s !== 'VERIFIED' && s !== 'RESOLVED';
}

function filterSnapshot(works: AggWork[], f: { state?: any; district?: any; category?: any; riskLevel?: any }): AggWork[] {
  return works.filter(w =>
    (isAll(f.state) || isSameState(w.state, String(f.state))) &&
    (isAll(f.district) || (w.district || '').toLowerCase() === String(f.district).toLowerCase() || w.constituency.toLowerCase() === String(f.district).toLowerCase()) &&
    (isAll(f.category) || (w.category || '').toLowerCase() === String(f.category).toLowerCase()) &&
    (isAll(f.riskLevel) || (w.severity || '').toLowerCase() === String(f.riskLevel).toLowerCase())
  );
}

function sendError(res: Response, err: any, fallback: string) {
  console.error(`[api] ${fallback}:`, err);
  res.status(500).json({ error: err?.message || fallback });
}

// Health check
apiRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const status = await getDataStatus();
    res.json({
      status: status.errors ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      service: 'mplad-monitoring-portal-api',
      dataSource: 'supabase:works (eSAKSHI v3)',
      projectCount: status.tables.works,
      transactionCount: status.tables.payments,
      scoredCount: status.tables.work_scores,
      mpAlertCount: status.tables.mp_alerts,
      reviewActionCount: status.tables.review_actions,
      // OLD: distinct states were counted from the in-memory projects array
      distinctStatesCount: isWorksSnapshotReady() ? statesOf(await getWorksSnapshot()).length : null,
      scoreModel: status.scoreModel,
      errors: status.errors
    });
  } catch (err: any) {
    sendError(res, err, 'Health check failed');
  }
});

// GET /api/metrics - live metrics for Dashboard
apiRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const [works, reviews, flaggedTxns] = await Promise.all([
      getWorksSnapshot(),
      getReviewStatusIndex(),
      listPayments({ risk_level: 'high', page: 1, limit: 1 })
    ]);

    const totalSanctioned = sum(works, w => w.sanctioned);
    const totalDisbursed = sum(works, w => w.paid);
    const statusCount = (s: WorkflowStatus) => Array.from(reviews.values()).filter(r => r.status === s).length;
    const verifiedCount = statusCount('VERIFIED');
    const escalatedCount = statusCount('ESCALATED');
    const dismissedCount = statusCount('RESOLVED');

    // STRICT DEFINITION: flagged = high severity without a clearing reviewer decision
    const highRiskProjects = works.filter(w => w.severity === 'high' && isUnresolved(w.key, reviews)).length;
    const mediumRiskProjects = works.filter(w => w.severity === 'medium' && isUnresolved(w.key, reviews)).length;
    const lowRiskProjects = works.filter(w => w.severity === 'low' || !isUnresolved(w.key, reviews)).length;
    const unflaggedProjects = works.filter(w => w.severity === 'none' && isUnresolved(w.key, reviews)).length;

    const categoryBreakdown: Record<string, number> = {};
    for (const [cat, ws] of Array.from(groupBy(works, w => w.category)).sort((a, b) => b[1].length - a[1].length)) {
      categoryBreakdown[cat] = ws.length;
    }

    res.json({
      totalProjects: works.length,
      coveredStates: statesOf(works).length,
      totalSanctioned,
      totalDisbursed,
      overallUtilizationRate: totalSanctioned > 0 ? totalDisbursed / totalSanctioned : 0,
      flaggedProjects: highRiskProjects,
      highRiskProjects,
      underReviewProjects: mediumRiskProjects,
      mediumRiskProjects,
      lowRiskProjects,
      unflaggedProjects, // severity 'none' in work_scores
      completedProjects: works.filter(w => w.lifecycle === 'Completed').length,
      inProgressProjects: works.filter(w => w.lifecycle === 'In Progress').length,
      notStartedProjects: works.filter(w => w.lifecycle === 'Not Started').length,
      rejectedProjects: works.filter(w => w.lifecycle === 'Rejected/Withdrawn').length,
      stalledProjects: works.filter(isStalled).length, // overdue_stalled flag from work_scores
      duplicateSuspectsCount: works.filter(isDuplicate).length,
      missingTendersCount: null, // no tender data in the eSAKSHI v3 schema
      pendingReviewsCount: works.length - (verifiedCount + escalatedCount + dismissedCount),
      verifiedCount,
      escalatedCount,
      dismissedCount,
      flaggedTransactionsCount: flaggedTxns.total, // payments against high-severity works
      auditLogsCount: getAllAuditLogs().length,
      reviewActionsCount: reviews.size,
      categoryBreakdown
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to compute metrics');
  }
});

// GET /api/dashboard - live aggregated statistics
apiRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [works, reviews, recentHighRisk, flaggedTxns] = await Promise.all([
      getWorksSnapshot(),
      getReviewStatusIndex(),
      listRecentHighRiskPayments(5),
      listPayments({ risk_level: 'high', page: 1, limit: 1 })
    ]);
    const totalAllocation = sum(works, w => w.sanctioned);
    const utilizedFunds = sum(works, w => w.paid);

    const highRiskProjects = works.filter(w => w.severity === 'high' && isUnresolved(w.key, reviews)).length;
    const mediumRiskProjects = works.filter(w => w.severity === 'medium' && isUnresolved(w.key, reviews)).length;
    const lowRiskProjects = works.filter(w => w.severity === 'low' || !isUnresolved(w.key, reviews)).length;

    const categoryStats = Array.from(groupBy(works, w => w.category))
      .map(([category, ws]) => ({
        category,
        sanctioned: sum(ws, w => w.sanctioned),
        spent: sum(ws, w => w.paid),
        count: ws.length
      }))
      .sort((a, b) => b.count - a.count);

    // OLD: iterated the hard-coded STATES_LIST; states now come from the data itself
    const stateStats = Array.from(groupBy(works, w => w.state))
      .map(([state, ws]) => ({
        state,
        sanctioned: sum(ws, w => w.sanctioned),
        spent: sum(ws, w => w.paid),
        count: ws.length,
        flagged: ws.filter(w => w.severity === 'high').length,
        underReview: ws.filter(w => w.severity === 'medium').length
      }))
      .sort((a, b) => a.state.localeCompare(b.state));

    res.json({
      summary: {
        total_allocation: totalAllocation,
        utilized_funds: utilizedFunds,
        remaining_funds: Math.max(0, totalAllocation - utilizedFunds),
        active_projects: works.filter(isActive).length,
        flagged_transactions: flaggedTxns.total,
        total_projects: works.length,
        covered_states: stateStats.length,
        high_risk_projects: highRiskProjects,
        flagged_projects: highRiskProjects, // STRICT: high only
        medium_risk_projects: mediumRiskProjects,
        under_review_projects: mediumRiskProjects, // STRICT: separate bucket
        low_risk_projects: lowRiskProjects,
        average_utilization_rate: totalAllocation > 0 ? utilizedFunds / totalAllocation : 0
      },
      categoryStats,
      stateStats,
      recentHighRisk
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to compute dashboard');
  }
});

// GET /api/projects - search, filter, paginate (Supabase works + work_scores)
apiRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const { q, state, district, mp, category, status, risk_level, house, sort, page = '1', limit = '10' } = req.query;
    const result = await listWorks({
      q: q as string,
      state: state as string,
      district: district as string,
      mp: mp as string,
      category: category as string,
      status: status as string,
      risk_level: risk_level as string,
      house: house as string,
      // Risk-filtered lists (e.g. the dashboard's flagged list) default to highest risk first
      sort: (sort as any) || (isAll(risk_level) ? 'id' : 'risk'),
      page: Math.max(1, parseInt(page as string, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10))
    });

    res.json({
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      },
      source: result.source
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch works');
  }
});

// Utilization benchmark computed from real works (sanctioned works only). Never blocks on a cold snapshot.
async function benchmarkFor(state: string, wait: boolean) {
  if (!wait && !isWorksSnapshotReady()) {
    getWorksSnapshot().catch(() => {}); // warm in background
    return { state_utilization: null as number | null, national_avg: null as number | null };
  }
  const works = await getWorksSnapshot();
  return {
    state_utilization: computeUtilization(works.filter(w => isSameState(w.state, state))),
    national_avg: computeUtilization(works)
  };
}

// Shared by /projects/:id and /anomalies/:id: work + score + payments + review history (+ MP alert)
async function buildWorkDossier(id: string) {
  const key = parseWorkKey(id);
  if (!key) return null;
  const project = await getWork(key);
  if (!project) return null;

  const [transactions, reviewRows, mpAlert, benchmark] = await Promise.all([
    listPaymentsForWork(key),
    listReviewActions(key),
    getMpAlert(key.house, project.mp_name).catch(() => null),
    benchmarkFor(project.state, false)
  ]);

  return {
    project,
    transactions,
    // Reviewer history from review_actions, plus any statutory audit_log entries for this work
    auditLogs: [...reviewActionsToAuditEntries(reviewRows), ...getAuditLogsForEntity(project.project_id).filter(l => !l.id.startsWith('RA-'))],
    reviewActions: reviewRows,
    evidenceDocuments: [], // no document store in the eSAKSHI v3 schema
    mpAlert,
    benchmark: {
      project_utilization: project.expenditure_utilization,
      state_utilization: benchmark.state_utilization,
      national_avg: benchmark.national_avg,
      state: project.state
    }
  };
}

// GET /api/projects/:id - single work with score, payments and review history
apiRouter.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    // OLD: unscored projects were scored on the fly through the old ML service and written back to `projects`.
    // Scores now come exclusively from work_scores.
    const dossier = await buildWorkDossier(req.params.id);
    if (!dossier) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json(dossier);
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch project.');
  }
});

// GET /api/transactions - real payments with filters & pagination
apiRouter.get('/transactions', async (req: Request, res: Response) => {
  try {
    const { q, status, risk_level, project_id, state, page = '1', limit = '10', sortBy = 'date', sortOrder = 'desc' } = req.query;
    // OLD: filtered/sorted an in-memory array of synthetic transactions
    const result = await listPayments({
      q: q as string,
      status: status as string,
      risk_level: risk_level as string,
      project_id: project_id as string,
      state: state as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
      page: Math.max(1, parseInt(page as string, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10))
    });
    res.json({
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      },
      source: result.source
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch transactions');
  }
});

// GET /api/transactions/:id  (id = "PAY-<payments.id>")
apiRouter.get('/transactions/:id', async (req: Request, res: Response) => {
  try {
    const paymentId = parsePaymentId(req.params.id);
    const transaction = paymentId !== null ? await getPayment(paymentId) : null;
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    const key = parseWorkKey(transaction.project_id)!;
    const project = await getWork(key);

    res.json({
      transaction,
      project,
      auditLogs: getAuditLogsForEntity(transaction.transaction_id),
      evidenceDocuments: transaction.evidence_documents
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch transaction');
  }
});

// GET /api/anomalies - vigilance queue from work_scores joined with works
apiRouter.get('/anomalies', async (req: Request, res: Response) => {
  try {
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
      page = '1',
      limit = '10'
    } = req.query;

    const result = await listAnomalies({
      state: state as string,
      district: district as string,
      category: category as string,
      status: status as string,
      risk_level: risk_level as string,
      severity: severity as string,
      min_amount: min_amount ? parseFloat(min_amount as string) : undefined,
      max_amount: max_amount ? parseFloat(max_amount as string) : undefined,
      sort: sort as string,
      page: Math.max(1, parseInt(page as string, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10))
    });

    res.json({
      data: result.data,
      metrics: result.metrics,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      },
      source: result.source
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch vigilance queue from Supabase.');
  }
});

// GET /api/anomalies/:id
apiRouter.get('/anomalies/:id', async (req: Request, res: Response) => {
  try {
    const dossier = await buildWorkDossier(req.params.id);
    if (!dossier) {
      return res.status(404).json({ error: 'Anomaly record not found.' });
    }
    res.json(dossier);
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch anomaly record.');
  }
});

// GET /api/states - every state present in works, with real counts
apiRouter.get('/states', async (req: Request, res: Response) => {
  try {
    const works = await getWorksSnapshot();
    const stats = Array.from(groupBy(works, w => w.state))
      .map(([state, ws]) => ({
        state,
        projectCount: ws.length,
        sanctioned: sum(ws, w => w.sanctioned),
        spent: sum(ws, w => w.paid),
        highRiskCount: ws.filter(w => w.severity === 'high').length,
        underReviewCount: ws.filter(w => w.severity === 'medium').length,
        districts: Array.from(new Set(ws.map(w => w.district || w.constituency).filter(Boolean))).sort()
      }))
      .sort((a, b) => a.state.localeCompare(b.state));
    res.json(stats);
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch states');
  }
});

// GET /api/categories - grouped from works.work_category
apiRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const works = await getWorksSnapshot();
    const categories = Array.from(groupBy(works, w => w.category))
      .map(([category, ws]) => ({
        category,
        count: ws.length,
        sanctioned: sum(ws, w => w.sanctioned),
        spent: sum(ws, w => w.paid)
      }))
      .sort((a, b) => b.count - a.count);
    res.json(categories);
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch categories');
  }
});

// GET /api/funds - fund flow analysis (sanction_amount vs total_paid)
apiRouter.get('/funds', async (req: Request, res: Response) => {
  try {
    const [works, payments] = await Promise.all([getWorksSnapshot(), getPaymentsSnapshot()]);
    const totalSanctioned = sum(works, w => w.sanctioned);
    const totalSpent = sum(works, w => w.paid);

    const stateDistribution = Array.from(groupBy(works, w => w.state))
      .map(([state, ws]) => {
        const sanc = sum(ws, w => w.sanctioned);
        const exp = sum(ws, w => w.paid);
        const sancCr = Number((sanc / 10000000).toFixed(2));
        const expCr = Number((exp / 10000000).toFixed(2));
        const utilizationRate = sanc > 0 ? Number(((exp / sanc) * 100).toFixed(1)) : 0;
        return {
          state,
          sanctioned: sanc,
          expenditure: exp,
          sanctionedCr: sancCr,
          expenditureCr: expCr,
          utilizationPercentage: utilizationRate,
          utilizationRate,
          projectCount: ws.length
        };
      })
      .sort((a, b) => a.state.localeCompare(b.state));

    const categoryDistribution = Array.from(groupBy(works, w => w.category))
      .map(([category, ws]) => ({
        category,
        sanctioned: sum(ws, w => w.sanctioned),
        expenditure: sum(ws, w => w.paid),
        projectCount: ws.length
      }))
      .filter(c => c.sanctioned > 0)
      .sort((a, b) => b.projectCount - a.projectCount);

    res.json({
      summary: {
        totalSanctioned,
        totalSpent,
        totalSanctionedCr: Number((totalSanctioned / 10000000).toFixed(2)),
        totalExpenditureCr: Number((totalSpent / 10000000).toFixed(2)),
        nationalUtilizationRate: totalSanctioned > 0 ? Number(((totalSpent / totalSanctioned) * 100).toFixed(1)) : 0,
        coveredStatesCount: stateDistribution.length,
        totalProjectsMonitored: works.length,
        avgDelayDays: null, // no delay/expected-completion data in the eSAKSHI v3 schema
        transactionCount: payments.length,
        activeProjectsCount: works.filter(isActive).length
      },
      stateDistribution,
      categoryDistribution,
      provenance: `eSAKSHI v3 works register (${works.length.toLocaleString('en-IN')} works) and payments ledger (${payments.length.toLocaleString('en-IN')} payments)`
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to compute funds');
  }
});

// Max rows returned in /api/reports `projects` (metrics still cover the full filtered set)
const REPORT_LIST_LIMIT = 200;

// GET /api/reports - dynamic report generation with strict flagged definition
apiRouter.get('/reports', async (req: Request, res: Response) => {
  try {
    const { type, state, district, category, riskLevel } = req.query;
    const works = filterSnapshot(await getWorksSnapshot(), { state, district, category, riskLevel });

    // OLD: returned every matching project and sorted in memory. The list is now a server-side query capped
    // at REPORT_LIST_LIMIT rows. There is no tender data, so procurement_audit orders by sanctioned amount, and
    // fund_utilization orders by amount paid (a ratio cannot be ordered server-side).
    const listSort = type === 'procurement_audit' ? 'sanctioned' : type === 'fund_utilization' ? 'amount' : 'risk';
    const list = await listWorks({
      state: state as string,
      district: district as string,
      category: category as string,
      risk_level: riskLevel as string,
      duplicates_only: type === 'duplicate_cluster',
      sort: listSort,
      page: 1,
      limit: REPORT_LIST_LIMIT
    });

    const totalAllocation = sum(works, w => w.sanctioned);
    const totalSpent = sum(works, w => w.paid);
    const highRiskCount = works.filter(w => w.severity === 'high').length;
    const mediumRiskCount = works.filter(w => w.severity === 'medium').length;
    const lowRiskCount = works.filter(w => w.severity === 'low').length;

    res.json({
      metrics: {
        worksEvaluated: works.length,
        sanctionedValue: totalAllocation,
        spentValue: totalSpent,
        flaggedCount: highRiskCount, // STRICT: high only
        underReviewCount: mediumRiskCount, // STRICT: medium in separate bucket
        elevatedRiskCount: highRiskCount,
        duplicateAlertsCount: works.filter(isDuplicate).length,
        totalAllocation,
        utilizedFunds: totalSpent,
        remainingFunds: Math.max(0, totalAllocation - totalSpent),
        totalProjects: works.length,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount
      },
      projects: list.data,
      projectsListed: list.data.length,
      projectsMatching: list.total,
      listLimit: REPORT_LIST_LIMIT
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to generate report');
  }
});

// GET /api/trend-analysis
apiRouter.get('/trend-analysis', async (req: Request, res: Response) => {
  try {
    const [works, payments] = await Promise.all([getWorksSnapshot(), getPaymentsSnapshot()]);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // OLD: fixed 2023-01..2024-12 window, and sanctioned + expenditure were both bucketed by project start_date.
    // Now: sanctioned by works.sanction_date, expenditure & transaction count by payments.payment_date,
    // completions by works.completion_date, across the months actually present in the data.
    const monthKeys = [
      ...works.map(w => w.sanction_date),
      ...works.map(w => w.completion_date),
      ...payments.map(p => p.payment_date)
    ].filter((d): d is string => !!d).map(d => d.slice(0, 7)).sort();

    const monthsMap = new Map<string, {
      monthKey: string; label: string; expenditure: number; sanctioned: number;
      flaggedAnomalies: number; completedProjects: number; transactionCount: number;
    }>();
    if (monthKeys.length > 0) {
      let [y, m] = monthKeys[0].split('-').map(Number);
      const [endY, endM] = monthKeys[monthKeys.length - 1].split('-').map(Number);
      while (y < endY || (y === endY && m <= endM)) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        monthsMap.set(key, { monthKey: key, label: `${monthNames[m - 1]} ${y}`, expenditure: 0, sanctioned: 0, flaggedAnomalies: 0, completedProjects: 0, transactionCount: 0 });
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    for (const w of works) {
      if (w.sanction_date) {
        const e = monthsMap.get(w.sanction_date.slice(0, 7));
        if (e) e.sanctioned += w.sanctioned || 0;
      }
      const flaggedDate = w.sanction_date || w.recommendation_date;
      if (w.severity === 'high' && flaggedDate) {
        const e = monthsMap.get(flaggedDate.slice(0, 7));
        if (e) e.flaggedAnomalies += 1;
      }
      if (w.lifecycle === 'Completed' && w.completion_date) {
        const e = monthsMap.get(w.completion_date.slice(0, 7));
        if (e) e.completedProjects += 1;
      }
    }
    for (const p of payments) {
      if (!p.payment_date) continue;
      const e = monthsMap.get(p.payment_date.slice(0, 7));
      if (e) {
        e.expenditure += p.amount;
        e.transactionCount += 1;
      }
    }

    let cumulativeSanctioned = 0;
    let cumulativeExpenditure = 0;
    const monthlyTrends = Array.from(monthsMap.values()).map(m => {
      cumulativeSanctioned += m.sanctioned;
      cumulativeExpenditure += m.expenditure;
      return {
        month: m.label,
        monthKey: m.monthKey,
        expenditure: m.expenditure,
        sanctioned: m.sanctioned,
        cumulativeExpenditure,
        cumulativeSanctioned,
        flaggedAnomalies: m.flaggedAnomalies,
        completedProjects: m.completedProjects,
        transactionCount: m.transactionCount,
        utilizationRate: cumulativeSanctioned > 0 ? Number(((cumulativeExpenditure / cumulativeSanctioned) * 100).toFixed(1)) : 0
      };
    });

    // OLD: benchmarks came from the old ML service /utilization-benchmark. Now computed from works:
    // utilization = total_paid / sanction_amount over sanctioned works.
    const nationalAvg = computeUtilization(works) ?? 0;
    const stateBenchmarks = Array.from(groupBy(works, w => w.state))
      .map(([state, ws]) => {
        const util = computeUtilization(ws);
        if (util === null) return null;
        const diff = Number((util - nationalAvg).toFixed(3));
        return {
          state,
          state_utilization: util,
          national_avg: nationalAvg,
          difference: diff,
          status: (diff > 0.001 ? 'above' : diff < -0.001 ? 'below' : 'equal') as 'above' | 'below' | 'equal',
          provenance: 'Computed from works (total_paid / sanction_amount)'
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => a.state.localeCompare(b.state));

    const total = works.length;
    const bucket = (name: string, sev: string, fill: string) => {
      const ws = works.filter(w => w.severity === sev);
      return {
        name,
        count: ws.length,
        percentage: total > 0 ? Number(((ws.length / total) * 100).toFixed(1)) : 0,
        amount: sum(ws, w => w.sanctioned),
        fill
      };
    };
    const riskDistribution = [
      bucket('No Risk Signal', 'none', '#98A2B3'),
      bucket('Low Risk', 'low', '#12B76A'),
      bucket('Medium Risk (Under Review)', 'medium', '#F79009'),
      bucket('High Risk (Flagged)', 'high', '#F04438')
    ];

    const districtExpenditures = Array.from(groupBy(works, w => `${w.district || w.constituency}__${w.state}`))
      .map(([, ws]) => {
        const sanctioned = sum(ws, w => w.sanctioned);
        const expenditure = sum(ws, w => w.paid);
        return {
          district: ws[0].district || ws[0].constituency,
          state: ws[0].state,
          sanctioned,
          expenditure,
          projectCount: ws.length,
          flaggedCount: ws.filter(w => w.severity === 'high').length,
          utilizationRate: sanctioned > 0 ? Number(((expenditure / sanctioned) * 100).toFixed(1)) : 0
        };
      })
      .sort((a, b) => b.sanctioned - a.sanctioned);

    const totalSanctioned = sum(works, w => w.sanctioned);
    const totalExpenditure = sum(works, w => w.paid);

    res.json({
      kpis: {
        totalSanctioned,
        totalExpenditure,
        overallUtilization: totalSanctioned > 0 ? Number(((totalExpenditure / totalSanctioned) * 100).toFixed(1)) : 0,
        // OLD: nationalAvgBenchmark: 54.7 (hard-coded)
        nationalAvgBenchmark: Number((nationalAvg * 100).toFixed(1)),
        totalFlaggedAnomalies: works.filter(w => w.severity === 'high').length, // STRICT: high only
        totalUnderReview: works.filter(w => w.severity === 'medium').length,
        totalProjectsMonitored: total,
        statesAboveBenchmark: stateBenchmarks.filter(s => s.status === 'above').length,
        statesBelowBenchmark: stateBenchmarks.filter(s => s.status === 'below').length,
        statesEqualBenchmark: stateBenchmarks.filter(s => s.status === 'equal').length,
        totalStatesCount: stateBenchmarks.length
      },
      monthlyTrends,
      stateBenchmarks,
      riskDistribution,
      districtExpenditures,
      provenance: {
        benchmarks: 'Computed from eSAKSHI v3 works (total_paid / sanction_amount)',
        projects: 'eSAKSHI v3 works register (Supabase works + work_scores)',
        transactions: 'eSAKSHI v3 payments ledger (Supabase payments)'
      }
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to compute trend analysis');
  }
});

// Loads a real work, builds the v3 request from its stored row and scores it live. Nothing is persisted.
// asOfMode 'stored' pins the live call to the stored score's as_of date so the two are comparable;
// 'service' lets the ML service use its own current date.
async function scoreRealWorkV3(workId: string, asOfMode: 'stored' | 'service') {
  const key = parseWorkKey(workId);
  if (!key) {
    return { status: 400, body: { error: 'Invalid work id. Expected "<house>-<work_id>", e.g. LS-195388.' } };
  }
  const row = await getWorkRow(key);
  if (!row) {
    return { status: 404, body: { error: `Work ${workId} not found in works.` } };
  }
  const stored = row.work_scores;
  const built = buildV3RequestFromWork(row, asOfMode === 'stored' ? stored?.as_of : undefined);
  if (!built.ok) {
    // Never fill gaps: report exactly which real fields are empty for this work.
    return {
      status: 422,
      body: {
        error: `Work ${workId} cannot be scored by ML v3 without inventing values: ` +
          [...built.missing.map(f => `${f} is empty`), ...built.invalid.map(f => `${f} has an invalid type`)].join(', ') + '.',
        missing: built.missing,
        invalid: built.invalid,
        stored
      }
    };
  }
  const startedAt = Date.now();
  const live = await scoreWorkV3(built.request);
  return { status: 200, row, request: built.request, live, stored, latency_ms: Date.now() - startedAt };
}

// POST /api/ml/score - on-demand ML v3 scoring (never persisted; work_scores is not modified)
// Body: { "work_id": "LS-195388" } to score a real work, or a complete v3 WorkIn object.
apiRouter.post('/ml/score', async (req: Request, res: Response) => {
  // OLD: forwarded an old Project-schema body to the old service via scoreProject() (with defaulted values)
  // and, before that, wrote the result into the legacy `projects` table.
  try {
    const body = req.body || {};
    if (typeof body.work_id === 'string') {
      const r = await scoreRealWorkV3(body.work_id, body.as_of_mode === 'stored' ? 'stored' : 'service');
      if (r.status !== 200) return res.status(r.status).json(r.body);
      return res.json({ ...r.live, persisted: false });
    }
    const checked = validateV3Request(body);
    if (!checked.ok) {
      return res.status(422).json({
        error: 'Request does not match the ML v3 contract; no values are defaulted.',
        missing: checked.missing,
        invalid: checked.invalid
      });
    }
    const live = await scoreWorkV3(checked.request);
    res.json({ ...live, persisted: false });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'ML v3 scoring failed' });
  }
});

// POST /api/ml/test-score - ML Tester: score a REAL work live and compare with its stored work_scores row.
// Body: { "work_id": "LS-195388", "as_of_mode": "stored" | "service" }. Never persists anything.
apiRouter.post('/ml/test-score', async (req: Request, res: Response) => {
  // OLD: accepted user-typed old-schema fields (sanctioned_amount, expected_completion, has_tender_on_file, ...)
  // and substituted defaults such as mp_name 'Test MP' before calling the old service.
  const { work_id, as_of_mode } = req.body || {};
  if (!work_id || typeof work_id !== 'string') {
    return res.status(400).json({ error: 'work_id is required, e.g. "LS-195388".' });
  }
  try {
    const r = await scoreRealWorkV3(work_id, as_of_mode === 'service' ? 'service' : 'stored');
    if (r.status !== 200) return res.status(r.status).json(r.body);

    const { row, request, live, stored, latency_ms } = r as Required<typeof r>;
    const liveFlags = new Set(live.flags);
    const storedFlags = new Set(stored?.flags || []);
    res.json({
      work_id: formatWorkKey(row.house, row.work_id),
      work: {
        house: row.house,
        work_id: row.work_id,
        state: row.state,
        mp_name: row.mp_name,
        constituency: row.constituency,
        activity_type: row.activity_type,
        work_description: row.work_description,
        stage: row.stage,
        is_completed: row.is_completed
      },
      request,
      live,
      stored,
      comparison: {
        risk_score_delta: stored ? live.risk_score - stored.risk_score : null,
        severity_match: stored ? live.severity === stored.severity : null,
        flags_only_live: live.flags.filter(f => !storedFlags.has(f)),
        flags_only_stored: (stored?.flags || []).filter(f => !liveFlags.has(f))
      },
      latency_ms
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'ML v3 scoring failed' });
  }
});

// GET /api/ml/health - reachability of the v3 ML service root endpoint (GET /)
apiRouter.get('/ml/health', async (_req: Request, res: Response) => {
  // OLD: probed `${ML_SERVICE_URL || 'https://ml-sih-7txo.onrender.com'}/` inline and ignored the body
  const health = await checkMlServiceHealth();
  res.status(health.online ? 200 : 503).json(health);
});

// GET /api/ml/utilization-benchmark?state=...
apiRouter.get('/ml/utilization-benchmark', async (req: Request, res: Response) => {
  const state = canonicalizeState((req.query.state as string) || '');
  if (!state) {
    return res.status(400).json({ error: 'state query parameter is required.' });
  }
  try {
    // OLD: fetched from the old ML service /utilization-benchmark/{state}; now computed from works
    const benchmark = await benchmarkFor(state, true);
    res.json({
      state,
      state_utilization_rate: benchmark.state_utilization,
      national_average_rate: benchmark.national_avg,
      source: 'computed:works'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Benchmark retrieval failed' });
  }
});

// POST /api/ml/duplicates - duplicate signals for the given works, read from work_scores flags
apiRouter.post('/ml/duplicates', async (req: Request, res: Response) => {
  try {
    // OLD: posted project payloads (with defaulted values) to the old ML /duplicates endpoint and mutated
    // is_potential_duplicate in memory. Duplicate detection is now part of the v3 scoring pipeline
    // (flags possible_duplicate / duplicate_paid in work_scores), so we report those.
    const rawItems: any[] = req.body.projects || req.body.items || [];
    const keys = rawItems.map(item => parseWorkKey(item?.project_id || item?.id));
    const scores = await Promise.all(keys.map(k => (k ? getWorkScore(k) : Promise.resolve(null))));
    const flags = scores.map(s => !!s && Array.isArray(s.flags) && (s.flags.includes('possible_duplicate') || s.flags.includes('duplicate_paid')));
    const duplicates = rawItems.filter((_, idx) => flags[idx]);
    res.json({ success: true, flags, duplicates, source: 'supabase:work_scores' });
  } catch (err: any) {
    sendError(res, err, 'Duplicate scan failed');
  }
});

// POST /api/ai/explain - Gemini explanation
apiRouter.post('/ai/explain', async (req: Request, res: Response) => {
  try {
    const { projectId, transactionId } = req.body;
    const key = parseWorkKey(projectId);
    const project = key ? await getWork(key) : null;
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    const paymentId = transactionId ? parsePaymentId(transactionId) : null;
    const transaction = paymentId !== null ? await getPayment(paymentId) : null;
    const explanationResult = await generateAnomalyExplanation(project as any, transaction as any);
    res.json(explanationResult);
  } catch (err: any) {
    sendError(res, err, 'Failed to generate explanation');
  }
});

// Number of highest-risk works given to the assistant as context
const ASSISTANT_CONTEXT_LIMIT = 50;

// POST /api/ai/assistant - Natural language query assistant
apiRouter.post('/ai/assistant', async (req: Request, res: Response) => {
  const { query, stateFilter } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required.' });
  }
  try {
    // OLD: passed every project (optionally state-filtered) and all synthetic transactions.
    // Now: the highest-risk open works in scope, fetched server-side.
    const context = await listAnomalies({ state: stateFilter, page: 1, limit: ASSISTANT_CONTEXT_LIMIT });
    const result = await processAssistantQuery(query, context.data as any, []);
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 'Assistant query failed');
  }
});

// POST /api/actions or /api/workflow/action - reviewer workflow action
const handleWorkflowAction = async (req: Request, res: Response) => {
  try {
    const {
      entityId,
      entityType = 'project',
      action,
      remarks,
      user = req.body.userName || 'Authorized Vigilance Officer',
      userRole = 'Nodal Auditor'
    } = req.body;

    if (!entityId || !action) {
      return res.status(400).json({ error: 'Missing entityId or action.' });
    }
    const newStatus = REVIEW_ACTION_STATUS[action];
    if (!newStatus) {
      return res.status(400).json({ error: `Unsupported action. Allowed: ${Object.keys(REVIEW_ACTION_STATUS).join(', ')}` });
    }

    let previousStatus: string | undefined;
    let reviewAction = null;

    if (entityType === 'transaction') {
      // review_actions is keyed by work, with no payment reference, so payment-level decisions go to the audit log only.
      // OLD: mutated workflow_status on an in-memory synthetic transaction.
      if (parsePaymentId(entityId) === null) {
        return res.status(400).json({ error: 'Invalid transaction id.' });
      }
    } else {
      const key = parseWorkKey(entityId);
      if (!key) {
        return res.status(400).json({ error: 'Invalid work id. Expected "<house>-<work_id>", e.g. LS-195388.' });
      }
      // OLD: wrote workflow_status (and at one point severity/risk_score) onto the legacy `projects` row.
      // Reviewer decisions are now appended to review_actions; work_scores is never modified.
      const created = await createReviewAction({ key, action, remarks, actor: user });
      previousStatus = created.previousStatus || undefined;
      reviewAction = created.row;
    }

    const logEntry: AuditLogEntry = {
      id: `LOG-${Date.now().toString(36).toUpperCase()}`,
      entityId,
      entityType: entityType || 'project',
      user,
      userRole,
      action,
      timestamp: new Date().toISOString(),
      remarks: remarks || `Action ${action} executed by ${user}`,
      previousStatus,
      newStatus
    };

    await saveAuditLog(logEntry);

    return res.json({
      success: true,
      logEntry,
      newStatus,
      reviewAction
    });
  } catch (err: any) {
    console.error('[handleWorkflowAction Error]:', err);
    return res.status(500).json({
      error: err.message || 'Failed to record action.'
    });
  }
};

// Workflow Action Endpoints (ADMIN only)
apiRouter.post('/actions', requireAdminRole, handleWorkflowAction);
apiRouter.post('/workflow/action', requireAdminRole, handleWorkflowAction);

// ==========================================
// eSAKSHI v3 native endpoints (raw new-schema shapes)
// ==========================================

// GET /api/works - native list (same filters as /api/projects)
apiRouter.get('/works', async (req: Request, res: Response) => {
  try {
    const { q, state, district, mp, category, status, risk_level, house, sort = 'id', page = '1', limit = '20' } = req.query;
    const result = await listWorks({
      q: q as string, state: state as string, district: district as string, mp: mp as string,
      category: category as string, status: status as string, risk_level: risk_level as string, house: house as string,
      sort: sort as any,
      page: Math.max(1, parseInt(page as string, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20))
    });
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 'Failed to list works');
  }
});

apiRouter.get('/works/:id', async (req: Request, res: Response) => {
  try {
    const dossier = await buildWorkDossier(req.params.id);
    if (!dossier) return res.status(404).json({ error: 'Work not found.' });
    res.json({
      work: dossier.project,
      payments: dossier.transactions,
      reviewActions: dossier.reviewActions,
      mpAlert: dossier.mpAlert
    });
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch work');
  }
});

apiRouter.get('/works/:id/score', async (req: Request, res: Response) => {
  try {
    const key = parseWorkKey(req.params.id);
    const score = key ? await getWorkScore(key) : null;
    if (!score) return res.status(404).json({ error: 'Score not found.' });
    res.json(score);
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch work score');
  }
});

apiRouter.get('/works/:id/payments', async (req: Request, res: Response) => {
  try {
    const key = parseWorkKey(req.params.id);
    if (!key) return res.status(400).json({ error: 'Invalid work id.' });
    res.json(await listPaymentsForWork(key));
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch payments');
  }
});

apiRouter.get('/works/:id/review-actions', async (req: Request, res: Response) => {
  try {
    const key = parseWorkKey(req.params.id);
    if (!key) return res.status(400).json({ error: 'Invalid work id.' });
    res.json(await listReviewActions(key));
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch review actions');
  }
});

apiRouter.post('/works/:id/review-actions', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const key = parseWorkKey(req.params.id);
    if (!key) return res.status(400).json({ error: 'Invalid work id.' });
    const { action, remarks } = req.body || {};
    const actor = (req as any).user?.email || req.body?.userName || 'Authorized Vigilance Officer';
    if (!REVIEW_ACTION_STATUS[action]) {
      return res.status(400).json({ error: `Unsupported action. Allowed: ${Object.keys(REVIEW_ACTION_STATUS).join(', ')}` });
    }
    const created = await createReviewAction({ key, action, remarks, actor });
    res.status(201).json(created);
  } catch (err: any) {
    sendError(res, err, 'Failed to create review action');
  }
});

// GET /api/mp-alerts - MP-level financial summaries & alerts
apiRouter.get('/mp-alerts', async (req: Request, res: Response) => {
  try {
    const { state, house, flag, q, sort, page = '1', limit = '20' } = req.query;
    const result = await listMpAlerts({
      state: state as string, house: house as string, flag: flag as string, q: q as string, sort: sort as string,
      page: Math.max(1, parseInt(page as string, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20))
    });
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch MP alerts');
  }
});

apiRouter.get('/mp-alerts/:house/:mpName', async (req: Request, res: Response) => {
  try {
    const alert = await getMpAlert(req.params.house, req.params.mpName);
    if (!alert) return res.status(404).json({ error: 'MP alert not found.' });
    res.json(alert);
  } catch (err: any) {
    sendError(res, err, 'Failed to fetch MP alert');
  }
});

// GET /api/audit-log/:entityId
apiRouter.get('/audit-log/:entityId', (req: Request, res: Response) => {
  const logs = getAuditLogsForEntity(req.params.entityId);
  res.json(logs);
});

// GET /api/audit-logs - all immutable audit logs (ADMIN only)
apiRouter.get('/audit-logs', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const logs = await fetchAuditLogsFromSupabase();
    res.json(logs);
  } catch (err: any) {
    res.json(getAllAuditLogs());
  }
});

// Real Two-Tier Auth Endpoints (PUBLIC / ADMIN)
apiRouter.post('/auth/login', handleLogin);
apiRouter.post('/auth/signup', handleSignup);
apiRouter.post('/auth/verify-session', handleVerifySession);
apiRouter.get('/auth/me', (req: any, res: Response) => {
  res.json({ user: req.user || null });
});

// ==========================================
// ADMIN & DATASET SYNC ENDPOINTS (ADMIN only)
// ==========================================

// Legacy dataset maintenance for the old `projects` table. Disabled: scores come from work_scores and
// data is loaded into works/payments by the eSAKSHI v3 pipeline, not by this server.
const legacyDisabled = (what: string) => (req: Request, res: Response) => {
  res.status(410).json({
    error: `${what} targeted the legacy projects table and is disabled after the eSAKSHI v3 migration.`
  });
};
// OLD: apiRouter.post('/admin/backfill-scores', ...) -> runBackfill() bulk-scored every project through the old ML service
apiRouter.post('/admin/backfill-scores', requireAdminRole, legacyDisabled('ML backfill'));
// OLD: apiRouter.get('/admin/backfill-status', ...) -> getBackfillStatus()
apiRouter.get('/admin/backfill-status', requireAdminRole, legacyDisabled('ML backfill status'));
// OLD: apiRouter.post('/admin/sync-supabase', ...) -> upserted projects_store.json into `projects`
apiRouter.post('/admin/sync-supabase', requireAdminRole, legacyDisabled('Supabase projects sync'));
// OLD: apiRouter.post('/admin/reload-dataset', ...) -> re-read projects_store.json into memory
apiRouter.post('/admin/reload-dataset', requireAdminRole, legacyDisabled('Dataset reload'));

// GET /api/admin/supabase-status - live row counts of the eSAKSHI v3 tables
apiRouter.get('/admin/supabase-status', requireAdminRole, async (req: Request, res: Response) => {
  try {
    res.json(await getDataStatus());
  } catch (err: any) {
    sendError(res, err, 'Failed to read Supabase status');
  }
});
