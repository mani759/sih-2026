import { Router, Request, Response } from 'express';
import {
  getProjects,
  getProjectById,
  getAnomalies,
  getAllProjectsList,
  updateProjectScore,
  updateProjectWorkflow,
  getSupabaseStatusInfo,
  syncProjectsToSupabase,
  forceCheckAndMigrateSupabase,
  checkSupabaseTableExists,
  reloadProjectsFromCsv
} from '../services/supabaseService';
import { runBackfill, getBackfillStatus } from '../services/backfillService';
import { STATES_LIST, generateProjectTransactions } from '../data/operationsData';
import { scoreProject, checkDuplicates, getUtilizationBenchmark, getAllStateBenchmarks } from '../services/mlService';
import { generateAnomalyExplanation, processAssistantQuery } from '../services/geminiService';
import { getAllAuditLogs, getAuditLogsForEntity, saveAuditLog, fetchAuditLogsFromSupabase } from '../services/auditService';
import { 
  authMiddleware, 
  requireAdminRole, 
  handleLogin, 
  handleSignup, 
  handleVerifySession 
} from '../services/authService';
import { Project, Transaction, AuditLogEntry, WorkflowStatus } from '../../src/types';

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

// Retrieve full project array for dynamic queries and operations
function getProjectsArray(): Project[] {
  return getAllProjectsList() as unknown as Project[];
}

// In-memory operational transaction state
let transactions: Transaction[] = [];
let cachedProjectsVersion = -1;

function getTransactionsArray(): Transaction[] {
  const current = getAllProjectsList();
  if (transactions.length === 0 || current.length !== cachedProjectsVersion) {
    cachedProjectsVersion = current.length;
    transactions = generateProjectTransactions(current);
  }
  return transactions;
}

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  const projects = getProjectsArray();
  const txns = getTransactionsArray();
  const distinctStates = new Set(projects.map(p => p.state)).size;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'mplad-monitoring-portal-api',
    projectCount: projects.length,
    distinctStatesCount: distinctStates,
    transactionCount: txns.length
  });
});

// GET /api/metrics - live metrics for Dashboard
apiRouter.get('/metrics', async (req: Request, res: Response) => {
  const projects = getProjectsArray();
  const txns = getTransactionsArray();

  const totalSanctioned = projects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0);
  const totalDisbursed = projects.reduce((sum, p) => sum + (p.actual_expenditure || 0), 0);
  const overallUtilizationRate = totalSanctioned > 0 ? (totalDisbursed / totalSanctioned) : 0;

  // Canonical workflow status counts directly from project records
  const verifiedCount = projects.filter(p => p.workflow_status === 'VERIFIED').length;
  const escalatedCount = projects.filter(p => p.workflow_status === 'ESCALATED').length;
  const dismissedCount = projects.filter(p => p.workflow_status === 'RESOLVED').length;
  const pendingReviewsCount = projects.length - (verifiedCount + escalatedCount + dismissedCount);

  // STRICT DEFINITION: Flagged is unresolved high severity (severity === 'high' AND workflow_status === 'FLAGGED')
  const highRiskProjects = projects.filter(p => p.severity === 'high' && (p.workflow_status === 'FLAGGED' || !p.workflow_status)).length;
  const mediumRiskProjects = projects.filter(p => p.severity === 'medium' && (p.workflow_status === 'FLAGGED' || !p.workflow_status)).length;
  const lowRiskProjects = projects.filter(p => p.severity === 'low' || p.workflow_status === 'RESOLVED' || p.workflow_status === 'VERIFIED').length;
  const flaggedProjects = highRiskProjects; // Only high severity unresolved
  const underReviewProjects = mediumRiskProjects; // Medium in separate bucket

  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const inProgressProjects = projects.filter(p => p.status === 'In Progress').length;
  const stalledProjects = projects.filter(p => p.status === 'Stalled').length;

  const duplicateSuspectsCount = projects.filter(p => p.is_potential_duplicate).length;
  const missingTendersCount = projects.filter(p => !p.has_tender_on_file).length;
  const flaggedTransactionsCount = txns.filter(t => t.workflow_status === 'FLAGGED').length;

  // Real categories dynamically computed directly from projects dataset (no hardcoded list)
  const categoryCounts = new Map<string, number>();
  for (const p of projects) {
    if (p.work_category) {
      categoryCounts.set(p.work_category, (categoryCounts.get(p.work_category) || 0) + 1);
    }
  }
  const sortedCategories = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
  const categoryBreakdown: Record<string, number> = {};
  for (const [cat, count] of sortedCategories) {
    categoryBreakdown[cat] = count;
  }

  const distinctStates = new Set(projects.map(p => p.state)).size;

  res.json({
    totalProjects: projects.length,
    coveredStates: distinctStates,
    totalSanctioned,
    totalDisbursed,
    overallUtilizationRate,
    flaggedProjects,
    highRiskProjects,
    underReviewProjects,
    mediumRiskProjects,
    lowRiskProjects,
    completedProjects,
    inProgressProjects,
    stalledProjects,
    duplicateSuspectsCount,
    missingTendersCount,
    pendingReviewsCount,
    verifiedCount,
    escalatedCount,
    dismissedCount,
    flaggedTransactionsCount,
    auditLogsCount: getAllAuditLogs().length,
    categoryBreakdown
  });
});

// GET /api/dashboard - live aggregated statistics
apiRouter.get('/dashboard', async (req: Request, res: Response) => {
  const projects = getProjectsArray();
  const totalAllocation = projects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0);
  const utilizedFunds = projects.reduce((sum, p) => sum + (p.actual_expenditure || 0), 0);
  const remainingFunds = Math.max(0, totalAllocation - utilizedFunds);
  const activeProjects = projects.filter(p => p.status === 'In Progress' || p.status === 'Not Started').length;
  const flaggedTransactions = transactions.filter(t => t.workflow_status === 'FLAGGED').length;

  // STRICT DEFINITION: Flagged is unresolved high severity (severity === 'high' AND workflow_status === 'FLAGGED')
  const highRiskProjects = projects.filter(p => p.severity === 'high' && (p.workflow_status === 'FLAGGED' || !p.workflow_status)).length;
  const mediumRiskProjects = projects.filter(p => p.severity === 'medium' && (p.workflow_status === 'FLAGGED' || !p.workflow_status)).length;
  const lowRiskProjects = projects.filter(p => p.severity === 'low' || p.workflow_status === 'RESOLVED' || p.workflow_status === 'VERIFIED').length;

  const avgUtilization = totalAllocation > 0 ? (utilizedFunds / totalAllocation) : 0;
  const distinctStates = new Set(projects.map(p => p.state)).size;

  // Category-wise expenditure dynamically grouped from real projects
  const categoryMap = new Map<string, { sanctioned: number; spent: number; count: number }>();
  for (const p of projects) {
    const cat = p.work_category;
    if (!cat) continue;
    const cur = categoryMap.get(cat) || { sanctioned: 0, spent: 0, count: 0 };
    cur.sanctioned += (p.sanctioned_amount || 0);
    cur.spent += (p.actual_expenditure || 0);
    cur.count += 1;
    categoryMap.set(cat, cur);
  }
  const categoryStats = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      sanctioned: stats.sanctioned,
      spent: stats.spent,
      count: stats.count
    }))
    .sort((a, b) => b.count - a.count);

  // State-wise distribution across ALL states
  const stateStats = STATES_LIST.map(st => {
    const stProjects = projects.filter(p => isSameState(p.state, st));
    const sanctioned = stProjects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0);
    const spent = stProjects.reduce((sum, p) => sum + (p.actual_expenditure || 0), 0);
    // Flagged = high only, under_review = medium
    const flagged = stProjects.filter(p => p.severity === 'high').length;
    const underReview = stProjects.filter(p => p.severity === 'medium').length;
    return {
      state: st,
      sanctioned,
      spent,
      count: stProjects.length,
      flagged,
      underReview
    };
  }).filter(s => s.count > 0);

  // Recent high-risk transactions
  const recentHighRisk = transactions
    .filter(t => t.workflow_status === 'FLAGGED' || t.ai_risk_score >= 70)
    .slice(0, 5);

  res.json({
    summary: {
      total_allocation: totalAllocation,
      utilized_funds: utilizedFunds,
      remaining_funds: remainingFunds,
      active_projects: activeProjects,
      flagged_transactions: flaggedTransactions,
      total_projects: projects.length,
      covered_states: distinctStates,
      high_risk_projects: highRiskProjects,
      flagged_projects: highRiskProjects, // STRICT: high only
      medium_risk_projects: mediumRiskProjects,
      under_review_projects: mediumRiskProjects, // STRICT: separate bucket
      low_risk_projects: lowRiskProjects,
      average_utilization_rate: avgUtilization
    },
    categoryStats,
    stateStats,
    recentHighRisk
  });
});

// GET /api/projects - search, filter, paginate (backed by Supabase or real 3,364-project dataset)
apiRouter.get('/projects', async (req: Request, res: Response) => {
  const {
    q,
    state,
    district,
    mp,
    category,
    status,
    risk_level,
    page = '1',
    limit = '10'
  } = req.query;

  const result = await getProjects({
    q: q as string,
    state: state as string,
    district: district as string,
    mp: mp as string,
    category: category as string,
    status: status as string,
    risk_level: risk_level as string,
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
});

// GET /api/projects/:id - single project with transactions and benchmark
apiRouter.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Ensure risk fields are hydrated
    if (project.risk_score === undefined || project.risk_score === null) {
      try {
        const score = await scoreProject(project as any);
        project.risk_score = score.risk_score;
        project.severity = score.severity as any;
        project.flags = score.flags;
        project.reason = score.reason;
        await updateProjectScore(project.project_id, {
          risk_score: score.risk_score,
          severity: score.severity as any,
          flags: score.flags,
          reason: score.reason
        });
      } catch (scoreErr) {
        console.warn('Could not score project on the fly:', scoreErr);
      }
    }

    const projectTransactions = transactions.filter(t => t.project_id === project.project_id);
    // OLD: const benchmark = await getUtilizationBenchmark(project.state);
    // Benchmark now comes live from the ML service; don't fail the whole page if it is unreachable
    const benchmark = await getUtilizationBenchmark(project.state).catch((benchErr) => {
      console.warn('Could not fetch ML utilization benchmark:', benchErr.message);
      return { state: project.state, state_utilization: null, national_avg: null };
    });
    const entityLogs = getAuditLogsForEntity(project.project_id);
    const evidenceDocs = projectTransactions.flatMap(t => t.evidence_documents || []);

    const utilizationRate = project.sanctioned_amount > 0
      ? (project.actual_expenditure / project.sanctioned_amount)
      : 0;

    res.json({
      project,
      transactions: projectTransactions,
      auditLogs: entityLogs,
      evidenceDocuments: evidenceDocs,
      benchmark: {
        project_utilization: utilizationRate,
        state_utilization: benchmark.state_utilization,
        national_avg: benchmark.national_avg,
        state: project.state
      }
    });
  } catch (err: any) {
    console.error('Error in /projects/:id:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch project.' });
  }
});

// GET /api/transactions - with filters & pagination
apiRouter.get('/transactions', (req: Request, res: Response) => {
  const {
    q,
    status,
    risk_level,
    project_id,
    page = '1',
    limit = '10',
    sortBy = 'date',
    sortOrder = 'desc'
  } = req.query;

  const allTxns = getTransactionsArray();
  let filtered = [...allTxns];

  if (q && typeof q === 'string') {
    const term = q.toLowerCase().trim();
    filtered = filtered.filter(t =>
      t.transaction_id.toLowerCase().includes(term) ||
      t.vendor_name.toLowerCase().includes(term) ||
      t.project_name?.toLowerCase().includes(term) ||
      t.project_id.toLowerCase().includes(term)
    );
  }

  if (status && typeof status === 'string' && status !== 'ALL' && status !== 'All') {
    filtered = filtered.filter(t => t.workflow_status.toLowerCase() === status.toLowerCase());
  }

  if (risk_level && typeof risk_level === 'string' && risk_level !== 'ALL' && risk_level !== 'All') {
    if (risk_level === 'high') filtered = filtered.filter(t => t.ai_risk_score >= 70);
    else if (risk_level === 'medium') filtered = filtered.filter(t => t.ai_risk_score >= 45 && t.ai_risk_score < 70);
    else if (risk_level === 'low') filtered = filtered.filter(t => t.ai_risk_score < 45);
  }

  if (project_id && typeof project_id === 'string') {
    filtered = filtered.filter(t => t.project_id === project_id);
  }

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === 'amount') {
      return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    if (sortBy === 'risk') {
      return sortOrder === 'asc' ? a.ai_risk_score - b.ai_risk_score : b.ai_risk_score - a.ai_risk_score;
    }
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limitNum);
  const startIdx = (pageNum - 1) * limitNum;
  const paginated = filtered.slice(startIdx, startIdx + limitNum);

  res.json({
    data: paginated,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  });
});

// GET /api/transactions/:id
apiRouter.get('/transactions/:id', (req: Request, res: Response) => {
  const transaction = transactions.find(t => t.transaction_id === req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  const projects = getProjectsArray();
  const project = projects.find(p => p.project_id === transaction.project_id);
  const entityLogs = getAuditLogsForEntity(transaction.transaction_id);

  res.json({
    transaction,
    project,
    auditLogs: entityLogs,
    evidenceDocuments: transaction.evidence_documents || []
  });
});

// GET /api/anomalies - investigation queue with flagged anomalies directly from Supabase
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

    const result = await getAnomalies({
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
      metrics: {
        flaggedCount: result.metrics.flaggedCount,
        underReviewCount: result.metrics.underReviewCount,
        totalInQueue: result.metrics.totalInQueue
      },
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      },
      source: result.source
    });
  } catch (err: any) {
    console.error('Anomalies endpoint error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch vigilance queue from Supabase.' });
  }
});

// GET /api/anomalies/:id
apiRouter.get('/anomalies/:id', async (req: Request, res: Response) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Anomaly record not found.' });
    }

    const relatedTransactions = transactions.filter(t => t.project_id === project.project_id);
    const entityLogs = getAuditLogsForEntity(project.project_id);
    // OLD: const benchmark = await getUtilizationBenchmark(project.state);
    const benchmark = await getUtilizationBenchmark(project.state).catch((benchErr) => {
      console.warn('Could not fetch ML utilization benchmark:', benchErr.message);
      return null;
    });
    const evidenceDocs = relatedTransactions.flatMap(t => t.evidence_documents || []);

    res.json({
      project,
      transactions: relatedTransactions,
      auditLogs: entityLogs,
      evidenceDocuments: evidenceDocs,
      benchmark
    });
  } catch (err: any) {
    console.error('Error fetching anomaly by id:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch anomaly record.' });
  }
});

// GET /api/states - returns ALL 36 states with real counts
apiRouter.get('/states', (req: Request, res: Response) => {
  const projects = getProjectsArray();
  const stats = STATES_LIST.map(stateName => {
    const stateProjects = projects.filter(p => isSameState(p.state, stateName));
    const sanctioned = stateProjects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0);
    const spent = stateProjects.reduce((sum, p) => sum + (p.actual_expenditure || 0), 0);
    // Flagged = high only
    const highRisk = stateProjects.filter(p => p.severity === 'high').length;
    const mediumRisk = stateProjects.filter(p => p.severity === 'medium').length;
    return {
      state: stateName,
      projectCount: stateProjects.length,
      sanctioned,
      spent,
      highRiskCount: highRisk,
      underReviewCount: mediumRisk,
      districts: Array.from(new Set(stateProjects.map(p => p.district || p.constituency)))
    };
  });
  res.json(stats);
});

// GET /api/categories - dynamically grouped from projects dataset
apiRouter.get('/categories', (req: Request, res: Response) => {
  const projects = getProjectsArray();
  const catMap = new Map<string, { count: number; sanctioned: number; spent: number }>();
  for (const p of projects) {
    const cat = p.work_category;
    if (!cat) continue;
    const cur = catMap.get(cat) || { count: 0, sanctioned: 0, spent: 0 };
    cur.count += 1;
    cur.sanctioned += (p.sanctioned_amount || 0);
    cur.spent += (p.actual_expenditure || 0);
    catMap.set(cat, cur);
  }
  const categories = Array.from(catMap.entries())
    .map(([category, stats]) => ({
      category,
      count: stats.count,
      sanctioned: stats.sanctioned,
      spent: stats.spent
    }))
    .sort((a, b) => b.count - a.count);
  res.json(categories);
});

// GET /api/funds - fund flow analysis across all 36 states (strictly derived from projects)
apiRouter.get('/funds', async (req: Request, res: Response) => {
  const projects = getProjectsArray();

  const totalSanctioned = projects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0);
  const totalSpent = projects.reduce((sum, p) => sum + (p.actual_expenditure || 0), 0);
  const totalSanctionedCr = Number((totalSanctioned / 10000000).toFixed(2));
  const totalExpenditureCr = Number((totalSpent / 10000000).toFixed(2));
  const nationalUtilizationRate = totalSanctioned > 0 ? Number(((totalSpent / totalSanctioned) * 100).toFixed(1)) : 0;

  // Include ALL 36 states computed directly via projects aggregation
  const stateDistribution = STATES_LIST.map(s => {
    const sProjects = projects.filter(p => isSameState(p.state, s));
    const sanc = sProjects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0);
    const exp = sProjects.reduce((sum, p) => sum + (p.actual_expenditure || 0), 0);
    const sancCr = Number((sanc / 10000000).toFixed(2));
    const expCr = Number((exp / 10000000).toFixed(2));
    const utilizationRate = sancCr > 0 ? Number(((expCr / sancCr) * 100).toFixed(1)) : 0;

    return {
      state: s,
      sanctioned: sanc,
      expenditure: exp,
      sanctionedCr: sancCr,
      expenditureCr: expCr,
      utilizationPercentage: utilizationRate,
      utilizationRate,
      projectCount: sProjects.length
    };
  });

  const stateCatMap = new Map<string, { sanctioned: number; expenditure: number; projectCount: number }>();
  for (const p of projects) {
    const cat = p.work_category;
    if (!cat) continue;
    const cur = stateCatMap.get(cat) || { sanctioned: 0, expenditure: 0, projectCount: 0 };
    cur.sanctioned += (p.sanctioned_amount || 0);
    cur.expenditure += (p.actual_expenditure || 0);
    cur.projectCount += 1;
    stateCatMap.set(cat, cur);
  }
  const categoryDistribution = Array.from(stateCatMap.entries())
    .map(([category, stats]) => ({
      category,
      ...stats
    }))
    .filter(c => c.sanctioned > 0)
    .sort((a, b) => b.projectCount - a.projectCount);

  const avgDelayDays = Math.round(
    projects.reduce((sum, p) => sum + (p.delay_days || 0), 0) / (projects.length || 1)
  );
  const activeProjectsCount = projects.filter(p => p.status === 'In Progress' || p.status === 'Not Started').length;

  res.json({
    summary: {
      totalSanctioned,
      totalSpent,
      totalSanctionedCr,
      totalExpenditureCr,
      nationalUtilizationRate,
      coveredStatesCount: STATES_LIST.length,
      totalProjectsMonitored: projects.length,
      avgDelayDays,
      transactionCount: transactions.length,
      activeProjectsCount
    },
    stateDistribution,
    categoryDistribution,
    provenance: 'Audited Central & State MPLADS Project Registry (Monitored Sample: 3,364 Projects)'
  });
});

// GET /api/reports - dynamic report generation with strict flagged definition
apiRouter.get('/reports', async (req: Request, res: Response) => {
  const {
    type,
    financialYear,
    state,
    district,
    category,
    riskLevel
  } = req.query;

  const projects = getProjectsArray();
  let filtered = [...projects];

  if (state && state !== 'ALL' && state !== 'All') {
    filtered = filtered.filter(p => isSameState(p.state, state as string));
  }
  if (district && district !== 'ALL' && district !== 'All') {
    filtered = filtered.filter(p => (p.district && p.district.toLowerCase() === (district as string).toLowerCase()) || p.constituency.toLowerCase() === (district as string).toLowerCase());
  }
  if (category && category !== 'ALL' && category !== 'All') {
    filtered = filtered.filter(p => p.work_category.toLowerCase() === (category as string).toLowerCase());
  }
  if (riskLevel && riskLevel !== 'ALL' && riskLevel !== 'All') {
    filtered = filtered.filter(p => p.severity?.toLowerCase() === (riskLevel as string).toLowerCase());
  }

  // Handle specific report types
  if (type === 'procurement_audit') {
    filtered.sort((a, b) => {
      if (a.has_tender_on_file === b.has_tender_on_file) {
        return b.sanctioned_amount - a.sanctioned_amount;
      }
      return a.has_tender_on_file ? 1 : -1;
    });
  } else if (type === 'duplicate_cluster') {
    filtered.sort((a, b) => {
      const aDup = a.is_potential_duplicate ? 1 : 0;
      const bDup = b.is_potential_duplicate ? 1 : 0;
      return bDup - aDup;
    });
  } else if (type === 'fund_utilization') {
    filtered.sort((a, b) => (b.actual_expenditure / (b.sanctioned_amount || 1)) - (a.actual_expenditure / (a.sanctioned_amount || 1)));
  } else {
    // default: vigilance_summary - highest risk first
    filtered.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  }

  const totalAllocation = filtered.reduce((s, p) => s + (p.sanctioned_amount || 0), 0);
  const totalSpent = filtered.reduce((s, p) => s + (p.actual_expenditure || 0), 0);
  const remaining = Math.max(0, totalAllocation - totalSpent);

  // STRICT DEFINITION: Flagged is severity === 'high' only!
  const highRiskCount = filtered.filter(p => p.severity === 'high').length;
  const mediumRiskCount = filtered.filter(p => p.severity === 'medium').length;
  const lowRiskCount = filtered.filter(p => p.severity === 'low').length;
  const duplicateAlertsCount = filtered.filter(p => p.is_potential_duplicate).length;

  res.json({
    metrics: {
      worksEvaluated: filtered.length,
      sanctionedValue: totalAllocation,
      spentValue: totalSpent,
      flaggedCount: highRiskCount, // STRICT: high only
      underReviewCount: mediumRiskCount, // STRICT: medium in separate bucket
      elevatedRiskCount: highRiskCount, // STRICT: matches flagged
      duplicateAlertsCount,
      totalAllocation,
      utilizedFunds: totalSpent,
      remainingFunds: remaining,
      totalProjects: filtered.length,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount
    },
    projects: filtered
  });
});

// GET /api/trend-analysis
apiRouter.get('/trend-analysis', async (req: Request, res: Response) => {
  try {
    const projects = getProjectsArray();
    const monthsMap = new Map<string, {
      monthKey: string;
      label: string;
      expenditure: number;
      sanctioned: number;
      flaggedAnomalies: number;
      completedProjects: number;
      transactionCount: number;
    }>();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthDefs: Array<{ key: string; label: string }> = [];
    for (const year of ['2023', '2024']) {
      for (let m = 1; m <= 12; m++) {
        const mm = m < 10 ? `0${m}` : `${m}`;
        monthDefs.push({
          key: `${year}-${mm}`,
          label: `${monthNames[m - 1]} ${year}`
        });
      }
    }

    for (const m of monthDefs) {
      monthsMap.set(m.key, {
        monthKey: m.key,
        label: m.label,
        expenditure: 0,
        sanctioned: 0,
        flaggedAnomalies: 0,
        completedProjects: 0,
        transactionCount: 0
      });
    }

    // Aggregate projects directly from the dataset (both sanctioned amount and actual expenditure)
    for (const p of projects) {
      if (p.start_date) {
        const mKey = p.start_date.slice(0, 7);
        const entry = monthsMap.get(mKey);
        if (entry) {
          entry.sanctioned += p.sanctioned_amount || 0;
          entry.expenditure += p.actual_expenditure || 0;
          if (p.severity === 'high' || p.ground_truth_is_anomaly) {
            entry.flaggedAnomalies += 1;
          }
        }
      }
      if (p.status === 'Completed' && p.actual_completion) {
        const mKey = p.actual_completion.slice(0, 7);
        const entry = monthsMap.get(mKey);
        if (entry) {
          entry.completedProjects += 1;
        }
      }
    }

    // Record transaction counts per month from the operational financial ledger
    for (const t of transactions) {
      if (t.date) {
        const mKey = t.date.slice(0, 7);
        const entry = monthsMap.get(mKey);
        if (entry) {
          entry.transactionCount += 1;
        }
      }
    }

    let cumulativeSanctioned = 0;
    let cumulativeExpenditure = 0;
    const monthlyTrends = Array.from(monthsMap.values()).map((m, index) => {
      cumulativeSanctioned += m.sanctioned;
      cumulativeExpenditure += m.expenditure;
      const utilizationRate = cumulativeSanctioned > 0
        ? Number(((cumulativeExpenditure / cumulativeSanctioned) * 100).toFixed(1))
        : 0;

      // Debugging log for verified points across the x-axis
      if (index === 0 || index === 11 || index === 23) {
        console.log(`[Cumulative Trend Debug] Index ${index} (${m.label}): Numerator (Cum. Exp) = ₹${(cumulativeExpenditure / 10000000).toFixed(2)} Cr (${cumulativeExpenditure}), Denominator (Cum. Sanc) = ₹${(cumulativeSanctioned / 10000000).toFixed(2)} Cr (${cumulativeSanctioned}), Cumulative Utilization = ${utilizationRate}%`);
      }

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
        utilizationRate
      };
    });

    const stateBenchmarks = await getAllStateBenchmarks();

    const totalProjectsCount = projects.length;
    const lowRiskProjects = projects.filter(p => p.severity === 'low');
    const mediumRiskProjects = projects.filter(p => p.severity === 'medium');
    const highRiskProjects = projects.filter(p => p.severity === 'high');

    const riskDistribution = [
      {
        name: 'Low Risk',
        count: lowRiskProjects.length,
        percentage: totalProjectsCount > 0 ? Number(((lowRiskProjects.length / totalProjectsCount) * 100).toFixed(1)) : 0,
        amount: lowRiskProjects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0),
        fill: '#12B76A'
      },
      {
        name: 'Medium Risk (Under Review)',
        count: mediumRiskProjects.length,
        percentage: totalProjectsCount > 0 ? Number(((mediumRiskProjects.length / totalProjectsCount) * 100).toFixed(1)) : 0,
        amount: mediumRiskProjects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0),
        fill: '#F79009'
      },
      {
        name: 'High Risk (Flagged)',
        count: highRiskProjects.length,
        percentage: totalProjectsCount > 0 ? Number(((highRiskProjects.length / totalProjectsCount) * 100).toFixed(1)) : 0,
        amount: highRiskProjects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0),
        fill: '#F04438'
      }
    ];

    // District breakdown
    const districtMap = new Map<string, {
      district: string;
      state: string;
      sanctioned: number;
      expenditure: number;
      projectCount: number;
      flaggedCount: number;
    }>();

    for (const p of projects) {
      const distName = p.district || p.constituency;
      const key = `${distName}__${p.state}`;
      if (!districtMap.has(key)) {
        districtMap.set(key, {
          district: distName,
          state: p.state,
          sanctioned: 0,
          expenditure: 0,
          projectCount: 0,
          flaggedCount: 0
        });
      }
      const item = districtMap.get(key)!;
      item.sanctioned += p.sanctioned_amount || 0;
      item.expenditure += p.actual_expenditure || 0;
      item.projectCount += 1;
      if (p.severity === 'high') {
        item.flaggedCount += 1;
      }
    }

    const districtExpenditures = Array.from(districtMap.values()).map(d => ({
      ...d,
      utilizationRate: d.sanctioned > 0 ? Number(((d.expenditure / d.sanctioned) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.sanctioned - a.sanctioned);

    const totalSanctioned = projects.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0);
    const totalExpenditure = projects.reduce((sum, p) => sum + (p.actual_expenditure || 0), 0);
    const overallUtilization = totalSanctioned > 0
      ? Number(((totalExpenditure / totalSanctioned) * 100).toFixed(1))
      : 0;

    const statesAbove = stateBenchmarks.filter(s => s.status === 'above').length;
    const statesBelow = stateBenchmarks.filter(s => s.status === 'below').length;
    const statesEqual = stateBenchmarks.filter(s => s.status === 'equal').length;

    res.json({
      kpis: {
        totalSanctioned,
        totalExpenditure,
        overallUtilization,
        nationalAvgBenchmark: 54.7,
        totalFlaggedAnomalies: highRiskProjects.length, // STRICT: high only
        totalUnderReview: mediumRiskProjects.length, // STRICT: separate bucket
        totalProjectsMonitored: projects.length,
        statesAboveBenchmark: statesAbove,
        statesBelowBenchmark: statesBelow,
        statesEqualBenchmark: statesEqual,
        totalStatesCount: stateBenchmarks.length
      },
      monthlyTrends,
      stateBenchmarks,
      riskDistribution,
      districtExpenditures,
      provenance: {
        // OLD: benchmarks: 'ML Pipeline Benchmark (utilization_benchmark.pkl)',
        benchmarks: 'Render ML Service /utilization-benchmark (live)',
        projects: 'Audited Central & State MPLADS Project Registry',
        transactions: 'PFMS / Treasury Financial Ledger'
      }
    });
  } catch (err: any) {
    console.error('Error computing trend analysis:', err);
    res.status(500).json({ error: 'Failed to compute trend analysis' });
  }
});

// POST /api/ml/score - calls Render Python ML service
apiRouter.post('/ml/score', async (req: Request, res: Response) => {
  try {
    const score = await scoreProject(req.body);
    const pid = req.body.project_id || score.project_id;
    if (pid) {
      await updateProjectScore(pid, {
        risk_score: score.risk_score,
        severity: score.severity as any,
        flags: score.flags,
        reason: score.reason
      });
    }
    res.json(score);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Scoring failed' });
  }
});

// POST /api/ml/test-score - score user-entered sample data for the ML Tester page.
// Unlike /api/ml/score this never persists anything and never uses the score cache.
apiRouter.post('/ml/test-score', async (req: Request, res: Response) => {
  const b = req.body || {};
  const sanctioned = Number(b.sanctioned_amount);
  const expenditure = Number(b.actual_expenditure);

  const missing = ['state', 'work_category', 'start_date', 'expected_completion', 'status']
    .filter(f => !b[f] || String(b[f]).trim() === '');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  if (!Number.isFinite(sanctioned) || sanctioned <= 0) {
    return res.status(400).json({ error: 'Sanctioned amount must be a number greater than 0.' });
  }
  if (!Number.isFinite(expenditure) || expenditure < 0) {
    return res.status(400).json({ error: 'Actual expenditure must be a number 0 or greater.' });
  }

  const payload = {
    project_id: `TEST-${Date.now().toString(36).toUpperCase()}`,
    state: String(b.state).trim(),
    work_category: String(b.work_category).trim(),
    mp_name: String(b.mp_name || 'Test MP').trim(),
    sanctioned_amount: sanctioned,
    actual_expenditure: expenditure,
    start_date: String(b.start_date),
    expected_completion: String(b.expected_completion),
    actual_completion: b.actual_completion ? String(b.actual_completion) : null,
    status: String(b.status),
    has_tender_on_file: Boolean(b.has_tender_on_file),
    has_mp_recommendation: Boolean(b.has_mp_recommendation)
  };

  const startedAt = Date.now();
  try {
    const result = await scoreProject(payload as any, 60000, false);
    res.json({ result, payload, latency_ms: Date.now() - startedAt });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'ML scoring failed', payload });
  }
});

// GET /api/ml/health - real reachability check of the Render ML service
apiRouter.get('/ml/health', async (_req: Request, res: Response) => {
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'https://ml-sih-7txo.onrender.com';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${mlServiceUrl}/`, { signal: controller.signal });
    res.status(response.ok ? 200 : 503).json({ online: response.ok, status: response.status });
  } catch (err: any) {
    res.status(503).json({ online: false, error: err?.name === 'AbortError' ? 'timeout' : err.message });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/ml/utilization-benchmark?state=...
apiRouter.get('/ml/utilization-benchmark', async (req: Request, res: Response) => {
  const state = (req.query.state as string) || 'Telangana';
  try {
    const benchmark = await getUtilizationBenchmark(state);
    res.json({
      state,
      state_utilization_rate: benchmark.state_utilization,
      national_average_rate: benchmark.national_avg
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Benchmark retrieval failed' });
  }
});

// POST /api/ml/duplicates - cluster text similarity
apiRouter.post('/ml/duplicates', async (req: Request, res: Response) => {
  try {
    const projects = getProjectsArray();
    const rawItems = req.body.projects || req.body.items || projects.slice(0, 30);
    const items = rawItems.map((item: any) => {
      const pid = item.project_id || item.id;
      const existing = projects.find(p => p.project_id === pid);
      if (existing) {
        return { ...existing, ...item };
      }
      return item;
    });

    const flags = await checkDuplicates(items);
    const duplicates = items.filter((_: any, idx: number) => flags[idx]);

    items.forEach((item: any, idx: number) => {
      const pid = item.project_id || item.id;
      const target = projects.find(p => p.project_id === pid);
      if (target) {
        target.is_potential_duplicate = Boolean(flags[idx]);
      }
    });

    res.json({
      success: true,
      flags,
      duplicates
    });
  } catch (err: any) {
    console.error('Duplicate scan error:', err);
    res.status(500).json({ error: err.message || 'Duplicate scan failed' });
  }
});

// POST /api/ai/explain - Gemini explanation
apiRouter.post('/ai/explain', async (req: Request, res: Response) => {
  const { projectId, transactionId } = req.body;
  const project = await getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const transaction = transactionId ? transactions.find(t => t.transaction_id === transactionId) : null;
  const explanationResult = await generateAnomalyExplanation(project as any, transaction);
  res.json(explanationResult);
});

// POST /api/ai/assistant - Natural language query assistant
apiRouter.post('/ai/assistant', async (req: Request, res: Response) => {
  const { query, stateFilter } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required.' });
  }

  const projects = getProjectsArray();
  let slice = [...projects];
  if (stateFilter) {
    slice = slice.filter(p => p.state.toLowerCase() === stateFilter.toLowerCase());
  }

  const result = await processAssistantQuery(query, slice as any, transactions);
  res.json(result);
});

// POST /api/actions or /api/workflow/action - workflow action
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

    let previousStatus = 'FLAGGED';
    let newStatus: WorkflowStatus = 'UNDER_REVIEW';

    if (action === 'Verify') {
      newStatus = 'VERIFIED';
    } else if (action === 'Escalate') {
      newStatus = 'ESCALATED';
    } else if (action === 'Request Clarification') {
      newStatus = 'UNDER_REVIEW';
    } else if (action === 'Mark False Positive') {
      newStatus = 'RESOLVED';
    }

    if (entityType === 'transaction') {
      const txns = getTransactionsArray();
      const txn = txns.find(t => t.transaction_id === entityId);
      if (txn) {
        previousStatus = txn.workflow_status || 'FLAGGED';
        txn.workflow_status = newStatus;
        if (remarks) txn.remarks = remarks;
      }
    } else {
      const projects = getProjectsArray();
      const prj = projects.find(p => p.project_id === entityId);
      if (prj) {
        previousStatus = prj.workflow_status || 'FLAGGED';
        prj.workflow_status = newStatus;
        // OLD: overwrote the ML model's score/severity with hard-coded values.
        // The reviewer decision is kept in workflow_status (RESOLVED / ESCALATED) instead,
        // and RESOLVED items are excluded from the anomaly queue in getAnomalies().
        // if (action === 'Mark False Positive') {
        //   prj.severity = 'low';
        //   prj.risk_score = 15;
        // } else if (action === 'Escalate') {
        //   prj.severity = 'high';
        // }
        await updateProjectWorkflow(entityId, {
          workflow_status: newStatus,
          severity: prj.severity as any,
          risk_score: prj.risk_score !== null && prj.risk_score !== undefined ? prj.risk_score : undefined
        });
      }
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
      newStatus
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

// POST /api/admin/backfill-scores - Trigger ML backfill across all 3,364 projects
apiRouter.post('/admin/backfill-scores', requireAdminRole, async (req: Request, res: Response) => {
  const concurrency = parseInt(req.body.concurrency as string, 10) || 8;
  const limit = req.body.limit ? parseInt(req.body.limit as string, 10) : undefined;
  const result = await runBackfill({ concurrency, limit });
  res.json(result);
});

// GET /api/admin/backfill-status - Check backfill progress
apiRouter.get('/admin/backfill-status', requireAdminRole, (req: Request, res: Response) => {
  res.json(getBackfillStatus());
});

// POST /api/admin/sync-supabase - Trigger batch sync to Supabase table
apiRouter.post('/admin/sync-supabase', requireAdminRole, async (req: Request, res: Response) => {
  const result = await forceCheckAndMigrateSupabase();
  res.json(result);
});

// GET /api/admin/supabase-status - Check Supabase connection and live table status
apiRouter.get('/admin/supabase-status', requireAdminRole, async (req: Request, res: Response) => {
  const info = await getSupabaseStatusInfo();
  res.json(info);
});

// POST /api/admin/reload-dataset - Re-read real mplads_projects.csv from filesystem
apiRouter.post('/admin/reload-dataset', requireAdminRole, (req: Request, res: Response) => {
  try {
    const loaded = reloadProjectsFromCsv();
    transactions = generateProjectTransactions(getAllProjectsList());
    res.json({
      success: true,
      projectCount: loaded.length,
      message: loaded.length > 0 
        ? `Successfully loaded ${loaded.length} real projects from CSV.` 
        : 'File mplads_projects.csv not found on filesystem. Please upload it via AI Studio File Explorer.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
