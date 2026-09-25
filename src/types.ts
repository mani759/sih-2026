export type ProjectStatus = 'Completed' | 'In Progress' | 'Not Started' | 'Stalled';

export type WorkflowStatus = 'FLAGGED' | 'VERIFIED' | 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface MLScoreResult {
  project_id: string;
  risk_score: number;
  severity: RiskSeverity;
  flags: string[];
  reason: string;
}

// ==========================================
// ML v3 (eSAKSHI) scoring contract — POST {ML_SERVICE_URL}/score
// ==========================================

// Request body (WorkIn). Every value is copied from a real `works` row; nullable fields are sent as null,
// never defaulted. The service's own defaults are never relied on.
export interface V3ScoreRequest {
  house: string;
  state: string;
  ida: string;
  mp_name: string;
  activity_type: string | null;
  work_description: string | null;
  recommended_amount: number | null; // null allowed only when sanction_amount is present
  recommendation_date: string;
  work_id: number;
  constituency: string | null;
  work_category: string | null;
  sanction_date: string | null;
  sanction_amount: number | null;
  stage: string | null;
  in_recommended_list: boolean;
  in_sanctioned_list: boolean;
  is_completed: boolean;
  completion_date: string | null;
  actual_cost: number | null;
  total_paid: number;
  payment_count: number;
  vendor_count: number;
  last_payment_date: string | null;
  as_of?: string | null;
}

export interface V3ScoreResult {
  work_id: number | null;
  risk_score: number;
  severity: RiskSeverity | 'none';
  flags: string[];
  reasons: string[];
  features: Record<string, unknown>;
  ml_anomaly_score: number | null;
  delay_risk: number | null;
  as_of: string;
  model_version: string;
}

// Stored batch score (Supabase work_scores) for the same work.
export interface StoredWorkScore {
  risk_score: number;
  severity: RiskSeverity | 'none';
  flags: string[];
  reasons: string[];
  ml_anomaly_score: number | null;
  delay_risk: number | null;
  as_of: string;
  model_version: string;
}

// Response of POST /api/ml/test-score (ML Tester). Nothing here is persisted.
export interface MLTesterResponse {
  work_id: string;
  work: {
    house: string;
    work_id: number;
    state: string;
    mp_name: string;
    constituency: string | null;
    activity_type: string | null;
    work_description: string | null;
    stage: string | null;
    is_completed: boolean | null;
  };
  request: V3ScoreRequest;
  live: V3ScoreResult;
  stored: StoredWorkScore | null;
  comparison: {
    risk_score_delta: number | null;
    severity_match: boolean | null;
    flags_only_live: string[];
    flags_only_stored: string[];
  };
  latency_ms: number;
}

export interface UtilizationBenchmark {
  state: string;
  state_utilization: number;
  national_avg: number;
}

export interface EvidenceDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  url?: string;
  verified: boolean;
  documentType: 'Tender Notice' | 'Work Order' | 'Inspection Report' | 'Vendor Invoice' | 'Utilization Certificate' | 'Geotagged Photo';
}

export interface AuditLogEntry {
  id: string;
  entityId: string;
  entityType: 'project' | 'transaction';
  user: string;
  userRole: string;
  action: 'Verify' | 'Request Clarification' | 'Escalate' | 'Mark False Positive' | 'Status Change' | 'Flagged by ML Engine';
  timestamp: string;
  remarks: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface Transaction {
  transaction_id: string;
  project_id: string;
  project_name?: string;
  vendor_name: string;
  amount: number; // in INR
  date: string;
  transaction_date?: string;
  description?: string;
  anomaly_flag?: string;
  evidence_documents: EvidenceDocument[];
  ai_risk_score: number;
  workflow_status: WorkflowStatus;
  remarks?: string;
  invoice_number?: string;
  payment_mode?: 'RTGS' | 'PFMS' | 'Treasury Direct' | string;
}

export interface Project {
  project_id: string;
  project_name: string;
  state: string;
  district: string;
  constituency: string;
  mp_name: string;
  work_category: string;
  sanctioned_amount: number; // in INR
  actual_expenditure: number; // in INR
  start_date: string;
  expected_completion: string;
  actual_completion: string | null;
  status: ProjectStatus;
  has_tender_on_file: boolean;
  has_mp_recommendation: boolean;
  scheme: string; // 'MPLADS'
  financial_year: string; // e.g. '2023-24'
  
  // Computed / ML fields
  risk_score?: number;
  severity?: RiskSeverity;
  flags?: string[];
  reason?: string;
  workflow_status?: WorkflowStatus;
  is_potential_duplicate?: boolean;
  expenditure_utilization?: number; // actual_expenditure / sanctioned_amount
  delay_days?: number;
  ground_truth_is_anomaly?: boolean;
  ground_truth_anomaly_type?: string | null;
  
  // Relations
  transactions?: Transaction[];
}

export type UserRole = 'ADMIN' | 'PUBLIC';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'PUBLIC' | 'auditor' | 'nodal_officer' | 'ministry_admin' | 'viewer';
  designation?: string;
  department?: string;
}

export interface DashboardSummary {
  total_allocation: number;
  utilized_funds: number;
  remaining_funds: number;
  active_projects: number;
  flagged_transactions: number;
  total_projects: number;
  high_risk_projects: number;
  medium_risk_projects: number;
  low_risk_projects: number;
  average_utilization_rate: number;
}

export interface DashboardMetrics {
  totalProjects: number;
  coveredStates?: number;
  totalSanctioned: number;
  totalDisbursed: number;
  overallUtilizationRate: number;
  flaggedProjects: number;
  highRiskProjects: number;
  underReviewProjects?: number;
  mediumRiskProjects: number;
  lowRiskProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  stalledProjects: number;
  duplicateSuspectsCount: number;
  missingTendersCount: number;
  pendingReviewsCount: number;
  verifiedCount: number;
  categoryBreakdown: Record<string, number>;
  escalatedCount?: number;
  dismissedCount?: number;
  flaggedTransactionsCount?: number;
  auditLogsCount?: number;
}

export interface FundsSummary {
  totalSanctioned: number;
  totalSpent: number;
  totalSanctionedCr: number;
  totalExpenditureCr: number;
  nationalUtilizationRate: number;
  coveredStatesCount: number;
  totalProjectsMonitored: number;
  avgDelayDays: number;
  transactionCount: number;
  activeProjectsCount: number;
}

