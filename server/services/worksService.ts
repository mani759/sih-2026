// eSAKSHI v3 data access layer.
// Source of truth: Supabase tables works, work_scores, payments, mp_alerts, review_actions.
// Works are keyed by the composite (house, work_id) — work_id alone is NOT unique across LS/RS.
// Nothing in this module reads the legacy `projects` table, projects_store.json, or the old ML service.
import { getSupabase } from './supabaseService';

// ==========================================
// Row types (mirror the Supabase schema)
// ==========================================

export interface WorkRow {
  house: string;
  work_id: number;
  state: string;
  ida: string | null;
  constituency: string | null;
  mp_name: string;
  work_category: string | null;
  activity_type: string | null;
  work_description: string | null;
  recommendation_date: string | null;
  recommended_amount: number | null;
  sanction_date: string | null;
  sanction_amount: number | null;
  stage: string | null;
  in_recommended_list: boolean | null;
  in_sanctioned_list: boolean | null;
  is_completed: boolean | null;
  completion_date: string | null;
  actual_cost: number | null;
  completion_attachment: boolean | null;
  payment_count: number | null;
  total_paid: number | null;
  first_payment_date: string | null;
  last_payment_date: string | null;
  vendor_count: number | null;
  main_vendor_name: string | null;
  ia_name: string | null;
}

export interface WorkScoreRow {
  house: string;
  work_id: number;
  risk_score: number;
  severity: string; // 'high' | 'medium' | 'low' | 'none'
  flags: string[];
  reasons: string[];
  ml_anomaly_score: number | null;
  delay_risk: number | null;
  as_of: string;
  model_version: string;
}

export interface PaymentRow {
  id: number;
  house: string;
  work_id: number;
  state: string | null;
  ida: string | null;
  ia_name: string | null;
  mp_name: string | null;
  constituency: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  payment_date: string | null;
  amount: number | null;
  payment_status: string | null;
}

export interface MpAlertRow {
  house: string;
  mp_name: string;
  state: string | null;
  allocated: number | null;
  recommended: number | null;
  paid: number | null;
  utilisation: number | null;
  top_vendor: string | null;
  top_vendor_share: number | null;
  flags: string[];
  reasons: string[];
  mp_key: string | null;
  term_start: string | null;
  works: number | null;
  pay_total: number | null;
  paid_works: number | null;
  top_vendor_amt: number | null;
}

export interface ReviewActionRow {
  id: number;
  house: string;
  work_id: number;
  action: string;
  remarks: string | null;
  actor: string;
  created_at: string;
}

export type WorkWithScore = WorkRow & { work_scores: Omit<WorkScoreRow, 'house' | 'work_id'> | null };

// ==========================================
// Keys, constants & small helpers
// ==========================================

export interface WorkKey {
  house: string;
  work_id: number;
}

export type WorkflowStatus = 'VERIFIED' | 'UNDER_REVIEW' | 'ESCALATED' | 'RESOLVED';

// review_actions.action is constrained (review_actions_action_check) to these codes,
// and each implies a workflow status for the work.
const DB_ACTION_STATUS: Record<string, WorkflowStatus> = {
  verified: 'VERIFIED',
  clarification_requested: 'UNDER_REVIEW',
  under_review: 'UNDER_REVIEW',
  escalated: 'ESCALATED',
  false_positive: 'RESOLVED',
  resolved: 'RESOLVED'
};

// UI action labels (what the frontend sends) -> review_actions.action code.
const UI_ACTION_TO_DB: Record<string, string> = {
  'Verify': 'verified',
  'Request Clarification': 'clarification_requested',
  'Escalate': 'escalated',
  'Mark False Positive': 'false_positive'
};
const DB_ACTION_TO_UI: Record<string, string> = Object.fromEntries(Object.entries(UI_ACTION_TO_DB).map(([ui, db]) => [db, ui]));

// Reviewer actions accepted by the API (UI labels), and the workflow status each one implies.
export const REVIEW_ACTION_STATUS: Record<string, WorkflowStatus> = Object.fromEntries(
  Object.entries(UI_ACTION_TO_DB).map(([ui, db]) => [ui, DB_ACTION_STATUS[db]])
);

// Accepts a UI label ("Mark False Positive") or a raw DB code ("false_positive").
function toDbAction(action: string): string | null {
  if (UI_ACTION_TO_DB[action]) return UI_ACTION_TO_DB[action];
  return DB_ACTION_STATUS[action] ? action : null;
}

// Stages before any execution has begun (see works.stage domain).
const PRE_EXECUTION_STAGES = ['Pending for Sanction', 'Sanction', 'Time Estimation'];
const REJECTED_STAGE = 'Rejected/Withdrawn';
const DUPLICATE_FLAGS = ['possible_duplicate', 'duplicate_paid'];
const STALLED_FLAG = 'overdue_stalled';

const WORK_COLUMNS = '*';
const SCORE_COLUMNS = 'risk_score,severity,flags,reasons,ml_anomaly_score,delay_risk,as_of,model_version';

export function formatWorkKey(house: string, workId: number | string): string {
  return `${house}-${workId}`;
}

// Accepts "LS-195388" (API form) as well as "LS:195388" / "LS_195388".
// works contains some negative work_ids (e.g. "LS--26"), so the sign is part of the id.
export function parseWorkKey(id: string | undefined | null): WorkKey | null {
  if (!id) return null;
  const m = String(id).trim().match(/^(LS|RS)[-:_](-?\d+)$/i);
  if (!m) return null;
  return { house: m[1].toUpperCase(), work_id: Number(m[2]) };
}

export function parsePaymentId(id: string | undefined | null): number | null {
  if (!id) return null;
  const m = String(id).trim().match(/^(?:PAY-)?(\d+)$/i);
  return m ? Number(m[1]) : null;
}

function isSet(v?: string | null): v is string {
  return !!v && v !== 'ALL' && v !== 'All' && v.trim() !== '';
}

// Strip characters that would break PostgREST or()/ilike filter syntax.
function sanitizeTerm(term: string): string {
  return term.replace(/[,()"'\\%*]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Display-name normalization only: "The Dadra And Nagar Haveli..." -> "Dadra and Nagar Haveli...".
export function canonicalizeState(state: string | null | undefined): string {
  if (!state) return '';
  return state.trim().replace(/^the\s+/i, '').replace(/\bAnd\b/g, 'and');
}

// "BATHINDA(DEPUTY COMMISSIONER BHATINDA_IDA)" -> "BATHINDA"
export function districtFromIda(ida: string | null | undefined): string | null {
  if (!ida) return null;
  const name = ida.split('(')[0].trim();
  return name || null;
}

// Indian financial year of a real date, e.g. 2025-08-20 -> "2025-26".
function financialYearOf(date: string | null): string | null {
  if (!date) return null;
  const [y, m] = date.split('-').map(Number);
  if (!y || !m) return null;
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function lifecycleStatus(w: Pick<WorkRow, 'is_completed' | 'stage'>): string {
  if (w.is_completed) return 'Completed';
  if (w.stage === REJECTED_STAGE) return 'Rejected/Withdrawn';
  if (w.stage && PRE_EXECUTION_STAGES.includes(w.stage)) return 'Not Started';
  return 'In Progress';
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ==========================================
// Frontend-compatible adapters (Project / Transaction shaped)
// ==========================================

// Project-shaped view of a work. Only real columns are used; fields with no source column are null.
export function toProjectView(row: WorkWithScore, workflowStatus: WorkflowStatus | null = null) {
  const score = row.work_scores;
  const sanctioned = toNum(row.sanction_amount);
  const paid = toNum(row.total_paid) ?? 0;
  const flags = Array.isArray(score?.flags) ? score!.flags : [];
  const reasons = Array.isArray(score?.reasons) ? score!.reasons : [];

  return {
    project_id: formatWorkKey(row.house, row.work_id),
    house: row.house,
    work_id: row.work_id,
    project_name: row.work_description || row.activity_type || '',
    work_description: row.work_description,
    activity_type: row.activity_type,
    state: canonicalizeState(row.state),
    district: districtFromIda(row.ida),
    constituency: row.constituency || '',
    ida: row.ida,
    mp_name: row.mp_name,
    work_category: row.work_category,
    implementing_agency: row.ia_name,
    stage: row.stage,
    status: lifecycleStatus(row),

    recommended_amount: toNum(row.recommended_amount),
    recommendation_date: row.recommendation_date,
    in_recommended_list: row.in_recommended_list,
    sanctioned_amount: sanctioned,
    sanction_date: row.sanction_date,
    in_sanctioned_list: row.in_sanctioned_list,
    actual_expenditure: paid,
    actual_cost: toNum(row.actual_cost),
    payment_count: row.payment_count ?? 0,
    vendor_count: row.vendor_count ?? 0,
    main_vendor_name: row.main_vendor_name,
    first_payment_date: row.first_payment_date,
    last_payment_date: row.last_payment_date,

    start_date: row.sanction_date,
    expected_completion: null as string | null, // no source column
    actual_completion: row.completion_date,
    is_completed: Boolean(row.is_completed),
    completion_attachment: row.completion_attachment,
    has_tender_on_file: null as boolean | null, // no source column
    has_mp_recommendation: Boolean(row.in_recommended_list),
    scheme: 'MPLADS',
    financial_year: financialYearOf(row.sanction_date || row.recommendation_date),

    risk_score: score ? score.risk_score : null,
    severity: score ? score.severity : null,
    flags,
    reasons,
    reason: reasons.join(' '),
    ml_anomaly_score: score ? toNum(score.ml_anomaly_score) : null,
    delay_risk: score ? toNum(score.delay_risk) : null,
    score_as_of: score ? score.as_of : null,
    model_version: score ? score.model_version : null,

    workflow_status: workflowStatus,
    is_potential_duplicate: flags.some(f => DUPLICATE_FLAGS.includes(f)),
    expenditure_utilization: sanctioned && sanctioned > 0 ? Number((paid / sanctioned).toFixed(3)) : null,
    delay_days: null as number | null // no source column
  };
}

export type ProjectView = ReturnType<typeof toProjectView>;

type PaymentWithWork = PaymentRow & {
  works: (Pick<WorkRow, 'work_description' | 'activity_type' | 'work_category'> & {
    work_scores: Pick<WorkScoreRow, 'risk_score' | 'severity' | 'flags'> | null;
  }) | null;
};

const PAYMENT_SELECT = (innerWork: boolean, innerScore: boolean) =>
  `*, works${innerWork || innerScore ? '!inner' : ''}(work_description,activity_type,work_category,work_scores${innerScore ? '!inner' : ''}(risk_score,severity,flags))`;

// Transaction-shaped view of a real payment row.
// ai_risk_score / risk_severity are the PARENT WORK's score (payments are not scored individually).
// workflow_status: the work's latest reviewer decision if any, else derived from the work's severity
// (high -> FLAGGED, medium -> UNDER_REVIEW, otherwise PENDING = not reviewed).
export function toTransactionView(row: PaymentWithWork, workReviewStatus: WorkflowStatus | null = null) {
  const score = row.works?.work_scores || null;
  const derived = score?.severity === 'high' ? 'FLAGGED' : score?.severity === 'medium' ? 'UNDER_REVIEW' : 'PENDING';
  return {
    transaction_id: `PAY-${row.id}`,
    payment_id: row.id,
    project_id: formatWorkKey(row.house, row.work_id),
    project_name: row.works?.work_description || row.works?.activity_type || undefined,
    vendor_name: row.vendor_name || '',
    vendor_id: row.vendor_id,
    amount: toNum(row.amount) ?? 0,
    date: row.payment_date || '',
    transaction_date: row.payment_date || '',
    payment_status: row.payment_status,
    implementing_agency: row.ia_name,
    state: canonicalizeState(row.state),
    constituency: row.constituency,
    mp_name: row.mp_name,
    evidence_documents: [] as any[], // no document store in the new schema
    ai_risk_score: score ? score.risk_score : null,
    risk_severity: score ? score.severity : null,
    work_flags: Array.isArray(score?.flags) ? score!.flags : [],
    workflow_status: workReviewStatus || derived
  };
}

export type TransactionView = ReturnType<typeof toTransactionView>;

// ==========================================
// Review actions (reviewer workflow — never touches work_scores)
// ==========================================

let reviewIndexCache: { at: number; latest: Map<string, { status: WorkflowStatus; action: ReviewActionRow }> } | null = null;
const REVIEW_INDEX_TTL_MS = 60_000;

// Latest reviewer decision per work. review_actions is a small, human-written table.
export async function getReviewStatusIndex(force = false) {
  if (!force && reviewIndexCache && Date.now() - reviewIndexCache.at < REVIEW_INDEX_TTL_MS) {
    return reviewIndexCache.latest;
  }
  const client = getSupabase();
  const latest = new Map<string, { status: WorkflowStatus; action: ReviewActionRow }>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('review_actions')
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase review_actions read failed: ${error.message}`);
    for (const r of (data || []) as ReviewActionRow[]) {
      const status = DB_ACTION_STATUS[r.action];
      if (status) latest.set(formatWorkKey(r.house, r.work_id), { status, action: r });
    }
    if (!data || data.length < pageSize) break;
  }
  reviewIndexCache = { at: Date.now(), latest };
  return latest;
}

function keysWithStatus(index: Map<string, { status: WorkflowStatus }>, status: WorkflowStatus): WorkKey[] {
  const out: WorkKey[] = [];
  for (const [k, v] of index) {
    if (v.status === status) {
      const key = parseWorkKey(k);
      if (key) out.push(key);
    }
  }
  return out;
}

export async function listReviewActions(key: WorkKey): Promise<ReviewActionRow[]> {
  const { data, error } = await getSupabase()
    .from('review_actions')
    .select('*')
    .eq('house', key.house)
    .eq('work_id', key.work_id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(`Supabase review_actions read failed: ${error.message}`);
  return (data || []) as ReviewActionRow[];
}

export async function createReviewAction(input: {
  key: WorkKey;
  action: string;
  remarks?: string | null;
  actor: string;
}): Promise<{ row: ReviewActionRow; previousStatus: WorkflowStatus | null; newStatus: WorkflowStatus }> {
  const dbAction = toDbAction(input.action);
  if (!dbAction) {
    throw new Error(`Unsupported review action "${input.action}". Allowed: ${Object.keys(UI_ACTION_TO_DB).join(', ')}`);
  }
  const newStatus = DB_ACTION_STATUS[dbAction];
  const client = getSupabase();

  // Validate the work exists so review_actions never references a non-existent work.
  const { data: work, error: workErr } = await client
    .from('works')
    .select('house,work_id')
    .eq('house', input.key.house)
    .eq('work_id', input.key.work_id)
    .maybeSingle();
  if (workErr) throw new Error(`Supabase works lookup failed: ${workErr.message}`);
  if (!work) throw new Error(`Work ${formatWorkKey(input.key.house, input.key.work_id)} not found.`);

  const history = await listReviewActions(input.key);
  const last = history[history.length - 1];
  const previousStatus = last ? DB_ACTION_STATUS[last.action] || null : null;

  const { data, error } = await client
    .from('review_actions')
    .insert({
      house: input.key.house,
      work_id: input.key.work_id,
      action: dbAction,
      remarks: input.remarks || null,
      actor: input.actor
    })
    .select('*')
    .single();
  if (error) throw new Error(`Supabase review_actions insert failed: ${error.message}`);

  reviewIndexCache = null; // next read reflects the new decision
  return { row: data as ReviewActionRow, previousStatus, newStatus };
}

// Map review_actions history to the AuditLogEntry shape the UI's audit trail renders.
export function reviewActionsToAuditEntries(rows: ReviewActionRow[]) {
  let prev: string | undefined;
  return rows.map(r => {
    const next = DB_ACTION_STATUS[r.action];
    const entry = {
      id: `RA-${r.id}`,
      entityId: formatWorkKey(r.house, r.work_id),
      entityType: 'project' as const,
      user: r.actor,
      userRole: '',
      action: DB_ACTION_TO_UI[r.action] || r.action,
      timestamp: r.created_at,
      remarks: r.remarks || '',
      previousStatus: prev,
      newStatus: next
    };
    prev = next;
    return entry;
  }).reverse(); // newest first, like the legacy audit trail
}

// ==========================================
// Works queries (server-side filter / sort / paginate)
// ==========================================

export interface WorkFilters {
  q?: string;
  state?: string;
  district?: string;
  mp?: string;
  category?: string;
  status?: string;
  risk_level?: string;
  house?: string;
  min_amount?: number;
  max_amount?: number;
  duplicates_only?: boolean;
}

function needsScoreFilter(f: WorkFilters): boolean {
  return isSet(f.risk_level) || (isSet(f.status) && f.status!.toLowerCase() === 'stalled') || !!f.duplicates_only;
}

// Two query shapes over the same (house, work_id) relationship:
//  - 'works'  : base works, left-joined work_scores. Used for plain listing.
//  - 'scores' : base work_scores, inner-joined works. Used whenever the query is driven by the score
//               (severity/flag filters, risk ordering) — 2-4x faster than filtering through the embed.
type QueryBase = 'works' | 'scores';

function selectFor(base: QueryBase): string {
  return base === 'works'
    ? `${WORK_COLUMNS}, work_scores(${SCORE_COLUMNS})`
    : `house,work_id,${SCORE_COLUMNS}, works!inner(${WORK_COLUMNS})`;
}

// Normalizes either query shape to a works row with an embedded work_scores object.
function toWorkWithScore(base: QueryBase, row: any): WorkWithScore {
  if (base === 'works') return row as WorkWithScore;
  const { works, house, work_id, ...score } = row;
  return { ...works, house, work_id, work_scores: score } as WorkWithScore;
}

// Applies filters for either query shape. house/work_id exist on both tables and are always filtered on the base.
function applyWorkFilters(query: any, f: WorkFilters, base: QueryBase): any {
  const w = (c: string) => (base === 'works' ? c : `works.${c}`); // works column
  const s = (c: string) => (base === 'works' ? `work_scores.${c}` : c); // work_scores column
  const orWorks = (expr: string) => (base === 'works' ? query.or(expr) : query.or(expr, { referencedTable: 'works' }));
  const orScores = (expr: string) => (base === 'works' ? query.or(expr, { referencedTable: 'work_scores' }) : query.or(expr));

  if (isSet(f.house)) query = query.eq('house', f.house.toUpperCase());
  if (isSet(f.state)) {
    const st = sanitizeTerm(canonicalizeState(f.state));
    // Stored names use "And" and sometimes a leading "The"; ilike is case-insensitive.
    query = orWorks(`state.ilike.${st},state.ilike.The ${st}`);
  }
  if (isSet(f.district)) {
    const d = sanitizeTerm(f.district);
    query = orWorks(`ida.ilike.${d}%,constituency.ilike.%${d}%`);
  }
  if (isSet(f.mp)) query = query.ilike(w('mp_name'), `%${sanitizeTerm(f.mp)}%`);
  if (isSet(f.category)) query = query.ilike(w('work_category'), sanitizeTerm(f.category));
  if (isSet(f.status)) {
    switch (f.status.toLowerCase()) {
      case 'completed':
        query = query.eq(w('is_completed'), true);
        break;
      case 'not started':
        query = query.eq(w('is_completed'), false).in(w('stage'), PRE_EXECUTION_STAGES);
        break;
      case 'in progress':
        query = query.eq(w('is_completed'), false)
          .not(w('stage'), 'in', `(${[...PRE_EXECUTION_STAGES, REJECTED_STAGE].map(x => `"${x}"`).join(',')})`);
        break;
      case 'rejected':
      case 'rejected/withdrawn':
        query = query.eq(w('stage'), REJECTED_STAGE);
        break;
      case 'stalled':
        // No lifecycle "stalled" column: use the scoring engine's overdue_stalled flag.
        query = query.eq(w('is_completed'), false).filter(s('flags'), 'cs', JSON.stringify([STALLED_FLAG]));
        break;
      default:
        query = query.eq(w('stage'), f.status); // allow raw stage values
    }
  }
  if (isSet(f.risk_level)) query = query.eq(s('severity'), f.risk_level.toLowerCase());
  if (f.duplicates_only) {
    query = orScores(DUPLICATE_FLAGS.map(fl => `flags.cs.${JSON.stringify([fl])}`).join(','));
  }
  if (f.min_amount !== undefined && !isNaN(f.min_amount)) query = query.gte(w('total_paid'), f.min_amount);
  if (f.max_amount !== undefined && !isNaN(f.max_amount)) query = query.lte(w('total_paid'), f.max_amount);
  if (isSet(f.q)) {
    const term = sanitizeTerm(f.q);
    const key = parseWorkKey(term);
    if (key) {
      query = query.eq('house', key.house).eq('work_id', key.work_id);
    } else if (/^-?\d+$/.test(term)) {
      query = query.eq('work_id', Number(term));
    } else if (term) {
      query = orWorks(
        ['work_description', 'activity_type', 'mp_name', 'constituency', 'ida']
          .map(c => `${c}.ilike.%${term}%`).join(',')
      );
    }
  }
  return query;
}

type WorkSort = 'id' | 'risk' | 'amount' | 'sanctioned';

function applyWorkSort(query: any, sort: WorkSort, base: QueryBase): any {
  const opts = { ascending: false, nullsFirst: false };
  if (sort === 'risk') query = query.order(base === 'works' ? 'work_scores(risk_score)' : 'risk_score', opts);
  else if (sort === 'amount') query = query.order(base === 'works' ? 'total_paid' : 'works(total_paid)', opts);
  else if (sort === 'sanctioned') query = query.order(base === 'works' ? 'sanction_amount' : 'works(sanction_amount)', opts);
  return query.order('house', { ascending: true }).order('work_id', { ascending: true });
}

// Excludes a set of composite keys: AND over houses of (house <> H OR work_id NOT IN ids_H).
function applyExcludeKeys(query: any, keys: WorkKey[]): any {
  const byHouse = new Map<string, number[]>();
  for (const k of keys) {
    const ids = byHouse.get(k.house) || [];
    ids.push(k.work_id);
    byHouse.set(k.house, ids);
  }
  for (const [house, ids] of byHouse) {
    query = query.or(`house.neq.${house},work_id.not.in.(${ids.join(',')})`);
  }
  return query;
}

// Restricts to a set of composite keys (small sets only — used for review-status filters).
function applyIncludeKeys(query: any, keys: WorkKey[]): any {
  return query.or(keys.map(k => `and(house.eq.${k.house},work_id.eq.${k.work_id})`).join(','));
}

interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: string;
}

function toPage<T>(data: T[], total: number, page: number, limit: number): Page<T> {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit), source: 'supabase:works' };
}

export async function listWorks(f: WorkFilters & {
  page?: number;
  limit?: number;
  sort?: WorkSort;
}): Promise<Page<ProjectView>> {
  const page = f.page || 1;
  const limit = f.limit || 10;
  const sort = f.sort || 'id';
  // Measured: the scores base is fastest when a score filter narrows the rows, or for an unfiltered risk ranking;
  // with only works-side filters (e.g. state) the works base is ~5x faster even when sorting by risk.
  const hasWorksFilter = [f.q, f.state, f.district, f.mp, f.category].some(isSet) ||
    (isSet(f.status) && f.status!.toLowerCase() !== 'stalled') || f.min_amount !== undefined || f.max_amount !== undefined;
  const base: QueryBase = needsScoreFilter(f) || (sort === 'risk' && !hasWorksFilter) ? 'scores' : 'works';

  let query = getSupabase().from(base === 'works' ? 'works' : 'work_scores').select(selectFor(base), { count: 'exact' });
  query = applyWorkFilters(query, f, base);
  query = applyWorkSort(query, sort, base);

  const from = (page - 1) * limit;
  const [{ data, count, error }, reviews] = await Promise.all([
    query.range(from, from + limit - 1),
    getReviewStatusIndex()
  ]);
  if (error) throw new Error(`Supabase works query failed: ${error.message}`);

  const rows = ((data || []) as any[]).map(raw => {
    const r = toWorkWithScore(base, raw);
    return toProjectView(r, reviews.get(formatWorkKey(r.house, r.work_id))?.status || null);
  });
  return toPage(rows, count || 0, page, limit);
}

// Raw works row exactly as stored (no display normalization), with its work_scores row embedded.
// Used where real column values matter, e.g. building the v3 ML /score request.
export async function getWorkRow(key: WorkKey): Promise<WorkWithScore | null> {
  const { data, error } = await getSupabase()
    .from('works')
    .select(selectFor('works'))
    .eq('house', key.house)
    .eq('work_id', key.work_id)
    .maybeSingle();
  if (error) throw new Error(`Supabase works lookup failed: ${error.message}`);
  return (data as unknown as WorkWithScore) || null;
}

export async function getWork(key: WorkKey): Promise<ProjectView | null> {
  const [row, reviews] = await Promise.all([getWorkRow(key), getReviewStatusIndex()]);
  if (!row) return null;
  return toProjectView(row, reviews.get(formatWorkKey(key.house, key.work_id))?.status || null);
}

export async function getWorkScore(key: WorkKey): Promise<WorkScoreRow | null> {
  const { data, error } = await getSupabase()
    .from('work_scores')
    .select('*')
    .eq('house', key.house)
    .eq('work_id', key.work_id)
    .maybeSingle();
  if (error) throw new Error(`Supabase work_scores lookup failed: ${error.message}`);
  return (data as WorkScoreRow) || null;
}

// Vigilance queue: scored works at high/medium severity (or the requested severity),
// excluding works a reviewer has marked as false positive. ML scores are never modified.
export async function listAnomalies(f: WorkFilters & {
  severity?: string;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const page = f.page || 1;
  const limit = f.limit || 10;
  const client = getSupabase();
  const reviews = await getReviewStatusIndex();
  const resolved = keysWithStatus(reviews, 'RESOLVED');

  const filterSeverity = isSet(f.risk_level) ? f.risk_level : isSet(f.severity) ? f.severity : undefined;
  let query = client.from('work_scores').select(selectFor('scores'), { count: 'exact' });
  query = applyWorkFilters(query, { ...f, risk_level: filterSeverity }, 'scores');
  if (!filterSeverity) query = query.in('severity', ['high', 'medium']);
  if (resolved.length > 0) query = applyExcludeKeys(query, resolved);
  // 'utilization' cannot be ordered server-side (ratio of two columns); it falls back to amount paid.
  query = applyWorkSort(query, f.sort === 'amount' || f.sort === 'utilization' ? 'amount' : 'risk', 'scores');

  const from = (page - 1) * limit;
  const countSeverity = (sev: string) => {
    let q = client.from('work_scores').select('house', { count: 'exact', head: true }).eq('severity', sev);
    if (resolved.length > 0) q = applyExcludeKeys(q, resolved);
    return q;
  };

  const [{ data, count, error }, high, medium] = await Promise.all([
    query.range(from, from + limit - 1),
    countSeverity('high'),
    countSeverity('medium')
  ]);
  if (error) throw new Error(`Supabase anomalies query failed: ${error.message}`);
  if (high.error || medium.error) {
    throw new Error(`Supabase anomaly metrics failed: ${(high.error || medium.error)!.message}`);
  }

  const rows = ((data || []) as any[]).map(raw => {
    const r = toWorkWithScore('scores', raw);
    return toProjectView(r, reviews.get(formatWorkKey(r.house, r.work_id))?.status || null);
  });
  const total = count || 0;
  return {
    ...toPage(rows, total, page, limit),
    source: 'supabase:works+work_scores',
    metrics: {
      flaggedCount: high.count || 0,
      underReviewCount: medium.count || 0,
      totalInQueue: total
    }
  };
}

// ==========================================
// Payments
// ==========================================

export async function listPaymentsForWork(key: WorkKey, limit = 1000): Promise<TransactionView[]> {
  const [{ data, error }, reviews] = await Promise.all([
    getSupabase()
      .from('payments')
      .select(PAYMENT_SELECT(false, false))
      .eq('house', key.house)
      .eq('work_id', key.work_id)
      .order('payment_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(limit),
    getReviewStatusIndex()
  ]);
  if (error) throw new Error(`Supabase payments query failed: ${error.message}`);
  const status = reviews.get(formatWorkKey(key.house, key.work_id))?.status || null;
  return ((data || []) as unknown as PaymentWithWork[]).map(p => toTransactionView(p, status));
}

export async function listPayments(f: {
  q?: string;
  status?: string;
  risk_level?: string;
  project_id?: string;
  state?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}): Promise<Page<TransactionView>> {
  const page = f.page || 1;
  const limit = f.limit || 10;
  const client = getSupabase();
  const reviews = await getReviewStatusIndex();

  // Transaction "audit status" is derived from the parent work (see toTransactionView).
  let severityFilter: string[] | null = null;
  let includeKeys: WorkKey[] | null = null;
  if (isSet(f.status)) {
    const s = f.status.toUpperCase();
    if (s === 'FLAGGED') severityFilter = ['high'];
    else if (s === 'UNDER_REVIEW') severityFilter = ['medium'];
    else if (s === 'PENDING') severityFilter = ['low', 'none'];
    else if (s === 'VERIFIED' || s === 'ESCALATED' || s === 'RESOLVED') includeKeys = keysWithStatus(reviews, s as WorkflowStatus);
  }
  if (isSet(f.risk_level)) severityFilter = [f.risk_level.toLowerCase()];
  if (includeKeys && includeKeys.length === 0) return toPage([], 0, page, limit);

  let query = client.from('payments').select(PAYMENT_SELECT(false, !!severityFilter), { count: 'exact' });
  if (severityFilter) query = query.in('works.work_scores.severity', severityFilter);
  if (includeKeys) query = applyIncludeKeys(query, includeKeys);
  if (isSet(f.state)) {
    const s = sanitizeTerm(canonicalizeState(f.state));
    query = query.or(`state.ilike.${s},state.ilike.The ${s}`);
  }
  if (isSet(f.project_id)) {
    const key = parseWorkKey(f.project_id);
    if (!key) return toPage([], 0, page, limit);
    query = query.eq('house', key.house).eq('work_id', key.work_id);
  }
  if (isSet(f.q)) {
    const term = sanitizeTerm(f.q);
    const key = parseWorkKey(term);
    const payId = /^pay-\d+$/i.test(term) ? parsePaymentId(term) : null;
    if (key) query = query.eq('house', key.house).eq('work_id', key.work_id);
    else if (payId !== null) query = query.eq('id', payId);
    else if (term) query = query.or(`vendor_name.ilike.%${term}%,mp_name.ilike.%${term}%,ia_name.ilike.%${term}%`);
  }

  const ascending = f.sortOrder === 'asc';
  if (f.sortBy === 'amount') query = query.order('amount', { ascending, nullsFirst: false });
  else query = query.order('payment_date', { ascending, nullsFirst: false }); // 'risk' sort is not supported across payments→works→work_scores
  query = query.order('id', { ascending });

  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1);
  if (error) throw new Error(`Supabase payments query failed: ${error.message}`);

  const rows = ((data || []) as unknown as PaymentWithWork[]).map(p =>
    toTransactionView(p, reviews.get(formatWorkKey(p.house, p.work_id))?.status || null)
  );
  return { ...toPage(rows, count || 0, page, limit), source: 'supabase:payments' };
}

export async function getPayment(id: number): Promise<TransactionView | null> {
  const [{ data, error }, reviews] = await Promise.all([
    getSupabase().from('payments').select(PAYMENT_SELECT(false, false)).eq('id', id).maybeSingle(),
    getReviewStatusIndex()
  ]);
  if (error) throw new Error(`Supabase payment lookup failed: ${error.message}`);
  if (!data) return null;
  const p = data as unknown as PaymentWithWork;
  return toTransactionView(p, reviews.get(formatWorkKey(p.house, p.work_id))?.status || null);
}

// Recent payments against high-severity works (dashboard feed).
export async function listRecentHighRiskPayments(limit = 5): Promise<TransactionView[]> {
  const res = await listPayments({ risk_level: 'high', sortBy: 'date', sortOrder: 'desc', page: 1, limit });
  return res.data;
}

// ==========================================
// MP alerts
// ==========================================

export async function listMpAlerts(f: {
  state?: string;
  house?: string;
  flag?: string;
  q?: string;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<Page<MpAlertRow>> {
  const page = f.page || 1;
  const limit = f.limit || 20;
  let query = getSupabase().from('mp_alerts').select('*', { count: 'exact' });
  if (isSet(f.house)) query = query.eq('house', f.house.toUpperCase());
  if (isSet(f.state)) {
    const s = sanitizeTerm(canonicalizeState(f.state));
    query = query.or(`state.ilike.${s},state.ilike.The ${s}`);
  }
  if (isSet(f.flag)) query = query.filter('flags', 'cs', JSON.stringify([f.flag]));
  if (isSet(f.q)) query = query.ilike('mp_name', `%${sanitizeTerm(f.q)}%`);

  const sortable = ['utilisation', 'paid', 'allocated', 'recommended', 'top_vendor_share', 'works', 'pay_total'];
  if (f.sort && sortable.includes(f.sort)) query = query.order(f.sort, { ascending: false, nullsFirst: false });
  query = query.order('house', { ascending: true }).order('mp_name', { ascending: true });

  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1);
  if (error) throw new Error(`Supabase mp_alerts query failed: ${error.message}`);
  const rows = ((data || []) as MpAlertRow[]).map(r => ({ ...r, state: r.state ? canonicalizeState(r.state) : r.state }));
  return { ...toPage(rows, count || 0, page, limit), source: 'supabase:mp_alerts' };
}

// mp_alerts is keyed by (house, mp_name); works.mp_name casing can differ, so match case-insensitively.
export async function getMpAlert(house: string, mpName: string): Promise<MpAlertRow | null> {
  const { data, error } = await getSupabase()
    .from('mp_alerts')
    .select('*')
    .eq('house', house.toUpperCase())
    .ilike('mp_name', sanitizeTerm(mpName))
    .limit(1);
  if (error) throw new Error(`Supabase mp_alerts lookup failed: ${error.message}`);
  const row = (data || [])[0] as MpAlertRow | undefined;
  return row ? { ...row, state: row.state ? canonicalizeState(row.state) : row.state } : null;
}

// ==========================================
// Aggregate snapshot (PostgREST aggregates are disabled on this project)
// A lean projection of every work + its score, loaded once and cached with a TTL.
// It is NOT loaded per request; stale snapshots are served while a refresh runs in the background.
// ==========================================

export interface AggWork {
  key: string;
  house: string;
  state: string;
  district: string | null;
  constituency: string;
  category: string | null;
  sanctioned: number | null;
  paid: number;
  lifecycle: string;
  sanction_date: string | null;
  recommendation_date: string | null;
  completion_date: string | null;
  risk_score: number | null;
  severity: string | null;
  flags: string[];
}

export interface AggPayment {
  payment_date: string | null;
  amount: number;
}

const SNAPSHOT_TTL_MS = 15 * 60_000;
const SCAN_PAGE = 1000; // PostgREST max-rows on this project
const SCAN_CONCURRENCY = 12;

interface CacheSlot<T> { at: number; data: T[]; loading: Promise<T[]> | null }
const worksSnapshot: CacheSlot<AggWork> = { at: 0, data: [], loading: null };
const paymentsSnapshot: CacheSlot<AggPayment> = { at: 0, data: [], loading: null };

async function scanTable(table: string, columns: string, order: string[]): Promise<any[]> {
  const client = getSupabase();
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Supabase ${table} count failed: ${error.message}`);
  const total = count || 0;
  const offsets: number[] = [];
  for (let o = 0; o < total; o += SCAN_PAGE) offsets.push(o);

  const out: any[] = [];
  for (let b = 0; b < offsets.length; b += SCAN_CONCURRENCY) {
    const batch = await Promise.all(offsets.slice(b, b + SCAN_CONCURRENCY).map(async o => {
      let q: any = client.from(table).select(columns);
      for (const col of order) q = q.order(col, { ascending: true });
      const { data, error: e } = await q.range(o, o + SCAN_PAGE - 1);
      if (e) throw new Error(`Supabase ${table} scan failed at offset ${o}: ${e.message}`);
      return data || [];
    }));
    for (const rows of batch) out.push(...rows);
  }
  return out;
}

function loadSlot<T>(slot: CacheSlot<T>, loader: () => Promise<T[]>): Promise<T[]> {
  const fresh = slot.at > 0 && Date.now() - slot.at < SNAPSHOT_TTL_MS;
  if (fresh) return Promise.resolve(slot.data);
  if (!slot.loading) {
    slot.loading = loader()
      .then(data => { slot.data = data; slot.at = Date.now(); return data; })
      .finally(() => { slot.loading = null; });
  }
  // Serve the stale snapshot while refreshing, if we have one.
  if (slot.at > 0) {
    slot.loading.catch(err => console.error('[worksService] snapshot refresh failed:', err.message));
    return Promise.resolve(slot.data);
  }
  return slot.loading;
}

export function getWorksSnapshot(): Promise<AggWork[]> {
  return loadSlot(worksSnapshot, async () => {
    const started = Date.now();
    // Two plain scans merged in memory: ~5x faster than scanning works with an embedded work_scores join.
    const [rows, scoreRows] = await Promise.all([
      scanTable(
        'works',
        'house,work_id,state,ida,constituency,work_category,sanction_amount,total_paid,is_completed,stage,sanction_date,recommendation_date,completion_date',
        ['house', 'work_id']
      ),
      scanTable('work_scores', 'house,work_id,risk_score,severity,flags', ['house', 'work_id'])
    ]);
    const scores = new Map<string, any>();
    for (const s of scoreRows) scores.set(formatWorkKey(s.house, s.work_id), s);
    for (const r of rows) r.work_scores = scores.get(formatWorkKey(r.house, r.work_id)) || null;
    const data: AggWork[] = rows.map((r: any) => ({
      key: formatWorkKey(r.house, r.work_id),
      house: r.house,
      state: canonicalizeState(r.state),
      district: districtFromIda(r.ida),
      constituency: r.constituency || '',
      category: r.work_category,
      sanctioned: toNum(r.sanction_amount),
      paid: toNum(r.total_paid) ?? 0,
      lifecycle: lifecycleStatus(r),
      sanction_date: r.sanction_date,
      recommendation_date: r.recommendation_date,
      completion_date: r.completion_date,
      risk_score: r.work_scores ? r.work_scores.risk_score : null,
      severity: r.work_scores ? r.work_scores.severity : null,
      flags: Array.isArray(r.work_scores?.flags) ? r.work_scores.flags : []
    }));
    console.log(`[worksService] works snapshot loaded: ${data.length} rows in ${Date.now() - started}ms`);
    return data;
  });
}

export function getPaymentsSnapshot(): Promise<AggPayment[]> {
  return loadSlot(paymentsSnapshot, async () => {
    const started = Date.now();
    const rows = await scanTable('payments', 'id,payment_date,amount', ['id']);
    const data = rows.map((r: any) => ({ payment_date: r.payment_date, amount: toNum(r.amount) ?? 0 }));
    console.log(`[worksService] payments snapshot loaded: ${data.length} rows in ${Date.now() - started}ms`);
    return data;
  });
}

export function isWorksSnapshotReady(): boolean {
  return worksSnapshot.at > 0;
}

export function snapshotInfo() {
  return {
    worksRows: worksSnapshot.data.length,
    worksLoadedAt: worksSnapshot.at ? new Date(worksSnapshot.at).toISOString() : null,
    paymentsRows: paymentsSnapshot.data.length,
    paymentsLoadedAt: paymentsSnapshot.at ? new Date(paymentsSnapshot.at).toISOString() : null,
    ttlMs: SNAPSHOT_TTL_MS
  };
}

// Real utilization benchmark: total_paid / sanction_amount over sanctioned works.
export function computeUtilization(works: AggWork[]): number | null {
  let sanctioned = 0;
  let paid = 0;
  for (const w of works) {
    if (w.sanctioned && w.sanctioned > 0) {
      sanctioned += w.sanctioned;
      paid += w.paid;
    }
  }
  return sanctioned > 0 ? Number((paid / sanctioned).toFixed(3)) : null;
}

// ==========================================
// Status / health
// ==========================================

export async function getDataStatus() {
  const client = getSupabase();
  const tables = ['works', 'work_scores', 'payments', 'mp_alerts', 'review_actions'];
  const counts = await Promise.all(tables.map(t => client.from(t).select('*', { count: 'exact', head: true })));
  const { data: scoreMeta } = await client.from('work_scores').select('as_of,model_version').limit(1);
  const result: Record<string, number | null> = {};
  const errors: Record<string, string> = {};
  tables.forEach((t, i) => {
    result[t] = counts[i].count ?? null;
    if (counts[i].error) errors[t] = counts[i].error!.message;
  });
  return {
    isConfigured: true,
    tables: result,
    scoreModel: scoreMeta?.[0] || null,
    snapshot: snapshotInfo(),
    errors: Object.keys(errors).length > 0 ? errors : null
  };
}
