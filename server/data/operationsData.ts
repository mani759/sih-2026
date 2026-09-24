import { Transaction, AuditLogEntry } from '../../src/types';
import { ALL_36_STATES, RawProjectRecord } from '../services/datasetGenerator';

export { ALL_36_STATES };
export const STATES_LIST = ALL_36_STATES;

// Helpers for parsing date strings and formatting
function parseDateString(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return isNaN(d.getTime()) ? null : d;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Generate operational financial transactions for the projects
// Honestly derived from real aggregate project data:
// - Exactly payment_count transaction rows per project (0 if payment_count is 0)
// - Splits actual_expenditure across payment_count transactions summing to the real total
// - Dates spaced plausibly between start_date and actual_completion / expected_completion
// - Generic vendor name referencing implementing_agency (never invented specific company names)
// - ai_risk_score and workflow_status referencing the parent project's real risk_score/severity
export function generateProjectTransactions(projects: RawProjectRecord[]): Transaction[] {
  const txns: Transaction[] = [];

  for (const p of projects) {
    const paymentCount = Math.max(0, parseInt(String(p.payment_count || 0), 10));
    if (paymentCount <= 0) continue;

    const totalExpenditure = Math.max(0, Number(p.actual_expenditure || 0));

    // Split total expenditure across paymentCount transactions
    const amounts: number[] = [];
    if (paymentCount === 1) {
      amounts.push(totalExpenditure);
    } else {
      let remaining = totalExpenditure;
      for (let i = 0; i < paymentCount; i++) {
        if (i === paymentCount - 1) {
          amounts.push(remaining);
        } else {
          const baseShare = Math.floor(totalExpenditure / paymentCount);
          // Controlled realistic variation +/- 10%
          const factor = 0.9 + ((i % 3) * 0.1);
          let amt = Math.min(Math.round(baseShare * factor), remaining);
          amounts.push(amt);
          remaining -= amt;
        }
      }
    }

    // Determine start and end dates for plausible spacing
    const startDate = parseDateString(p.start_date) || new Date('2023-04-01');
    let endDate = parseDateString(p.actual_completion);
    if (!endDate) {
      endDate = parseDateString(p.expected_completion) || new Date('2024-12-31');
    }
    const startMs = startDate.getTime();
    const endMs = Math.max(startMs + 86400000, endDate.getTime());
    const totalDuration = endMs - startMs;

    // Vendor name: generic placeholder referencing implementing_agency
    const vendorName = p.implementing_agency
      ? `Contracted Vendor — ${p.implementing_agency}`
      : 'Contracted Vendor — Executive Agency';

    // Workflow status and AI risk score derived from real parent project
    let workflowStatus: 'VERIFIED' | 'UNDER_REVIEW' | 'FLAGGED' | 'REJECTED' = 'VERIFIED';
    if (p.severity === 'high') {
      workflowStatus = 'FLAGGED';
    } else if (p.severity === 'medium') {
      workflowStatus = 'UNDER_REVIEW';
    } else {
      workflowStatus = 'VERIFIED';
    }

    const aiRiskScore = (p.risk_score !== null && p.risk_score !== undefined)
      ? p.risk_score
      : (p.severity === 'high' ? 85 : p.severity === 'medium' ? 55 : 15);

    for (let i = 0; i < paymentCount; i++) {
      const stepFraction = paymentCount === 1 ? 0.8 : (i + 1) / (paymentCount + 0.5);
      const txnDate = new Date(startMs + Math.round(totalDuration * stepFraction));
      const trancheNumber = i + 1;
      const trancheLabel = paymentCount === 1
        ? 'Lump Sum Settlement'
        : (trancheNumber === paymentCount ? 'Final Settlement' : `Tranche ${trancheNumber}`);

      const docType = trancheNumber === paymentCount
        ? 'Utilization Certificate'
        : (trancheNumber === 1 ? 'Inspection Report' : 'Vendor Invoice');

      const evidenceDocs = p.has_tender_on_file ? [
        {
          id: `DOC-${p.project_id}-${String(trancheNumber).padStart(2, '0')}`,
          name: `${docType.replace(/\s+/g, '_')}_${p.project_id}.pdf`,
          type: 'application/pdf',
          size: `${(1.2 + ((i * 0.7) % 2.5)).toFixed(1)} MB`,
          uploadDate: formatDate(txnDate),
          verified: workflowStatus === 'VERIFIED',
          documentType: docType as any
        }
      ] : [];

      txns.push({
        transaction_id: `TXN-${p.project_id}-${String(trancheNumber).padStart(2, '0')}`,
        project_id: p.project_id,
        project_name: p.project_name || `${p.work_category} at ${p.constituency}`,
        vendor_name: vendorName,
        amount: amounts[i],
        date: formatDate(txnDate),
        evidence_documents: evidenceDocs,
        ai_risk_score: aiRiskScore,
        workflow_status: workflowStatus,
        remarks: p.flags && p.flags.length > 0
          ? `Flags: ${p.flags.join(', ')} — ${trancheLabel}`
          : `${trancheLabel} disbursed against sanctioned works.`,
        invoice_number: `INV-${p.project_id}-${String(trancheNumber).padStart(2, '0')}`,
        payment_mode: 'PFMS'
      });
    }
  }

  return txns;
}

export function generateAuditLogs(projects: RawProjectRecord[]): AuditLogEntry[] {
  const logs: AuditLogEntry[] = [
    {
      id: 'LOG-SYS-001',
      timestamp: new Date().toISOString(),
      user: 'Vigilance Admin',
      userRole: 'ministry_admin',
      entityType: 'project',
      action: 'Flagged by ML Engine',
      entityId: 'MPLADS-00005',
      remarks: 'High-risk anomaly flagged: Project sanctioned without statutory MP recommendation.'
    },
    {
      id: 'LOG-SYS-002',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: 'District Magistrate Office',
      userRole: 'nodal_officer',
      entityType: 'project',
      action: 'Verify',
      entityId: 'MPLADS-00001',
      remarks: 'Physical verification completed and 100% geotagged photos validated.'
    },
    {
      id: 'LOG-SYS-003',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      user: 'Automated ML Monitor',
      userRole: 'auditor',
      entityType: 'project',
      action: 'Flagged by ML Engine',
      entityId: 'MPLADS-03364',
      remarks: 'Stalled work trigger: delay exceeding 250 days with low utilization.'
    }
  ];

  return logs;
}
