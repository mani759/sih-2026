import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  FileText, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle,
  User,
  IndianRupee,
  Cpu,
  Layers,
  FileCheck2,
  ExternalLink
} from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { EvidencePanel } from '../components/EvidencePanel';
import { AuditTrailList } from '../components/AuditTrailList';
import { AIExplanationPanel } from '../components/AIExplanationPanel';
import { UtilizationBenchmarkChart } from '../components/UtilizationBenchmarkChart';
import { LoadingState, ErrorState } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { Project, Transaction, AuditLogEntry, EvidenceDocument } from '../types';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, token } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [evidenceDocs, setEvidenceDocs] = useState<EvidenceDocument[]>([]);
  const [benchmark, setBenchmark] = useState<{ stateUtilization: number; nationalAvg: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow action modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('Verify');
  const [actionRemarks, setActionRemarks] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchProjectData = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Could not find project record.');

      const data = await res.json();
      setProject(data.project);
      setTransactions(data.transactions || []);
      setAuditLogs(data.auditLogs || []);
      setEvidenceDocs(data.evidenceDocuments || []);

      // Fetch state utilization benchmark
      if (data.project?.state) {
        const bRes = await fetch(`/api/ml/utilization-benchmark?state=${encodeURIComponent(data.project.state)}`);
        if (bRes.ok) {
          const bData = await bRes.json();
          setBenchmark({
            stateUtilization: bData.state_utilization_rate || 0.60,
            nationalAvg: bData.national_average_rate || 0.547
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !actionRemarks.trim()) return;

    setActionSubmitting(true);
    try {
      const res = await fetch('/api/workflow/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          entityType: 'project',
          entityId: project.project_id,
          action: selectedAction,
          remarks: actionRemarks.trim(),
          userName: user?.name || 'Authorized Auditor',
          userRole: user?.role || 'auditor'
        })
      });

      if (!res.ok) throw new Error('Workflow action failed.');

      const data = await res.json();
      setActionModalOpen(false);
      setActionRemarks('');
      // Refresh project and audit log
      fetchProjectData();
      window.dispatchEvent(new CustomEvent('mplads-workflow-action-updated'));
    } catch (err: any) {
      alert('Error recording audit action: ' + err.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Retrieving comprehensive project vigilance dossier..." />;
  if (error || !project) return <ErrorState message={error || 'Project record not located'} onRetry={fetchProjectData} />;

  const utilizationRate = project.expenditure_utilization || (project.actual_expenditure / project.sanctioned_amount);

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[
          { label: 'Projects', href: '/projects' },
          { label: project.project_id }
        ]}
        contextDescription={`Dossier for ${project.project_name} in ${project.district}, ${project.state}.`}
        badge={`Risk: ${project.risk_score}/100`}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Header Row with Actions */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-[#1D4E89] bg-[#EAF2F8] px-2.5 py-0.5 rounded">
                {project.project_id}
              </span>
              <RiskBadge score={project.risk_score} severity={project.severity} />
              <StatusBadge status={project.status} />
              {!project.has_tender_on_file && (
                <span className="text-xs bg-red-100 text-[#D92D20] font-semibold px-2 py-0.5 rounded">
                  Missing Tender on File
                </span>
              )}
              {project.is_potential_duplicate && (
                <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded">
                  Duplicate Proposal Flag
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#12355B] leading-tight">
              {project.project_name}
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Recommended by <strong>{project.mp_name}</strong> • Constituency: <strong>{project.constituency}</strong>
            </p>
          </div>

          {/* Action Buttons - restricted strictly to ADMIN */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setSelectedAction('Verify'); setActionModalOpen(true); }}
                className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs font-semibold px-3.5 py-2 rounded-md shadow-2xs transition-colors"
              >
                Verify Project
              </button>
              <button
                onClick={() => { setSelectedAction('Request Clarification'); setActionModalOpen(true); }}
                className="bg-white hover:bg-gray-50 text-[#344054] border border-[#D0D5DD] text-xs font-semibold px-3.5 py-2 rounded-md shadow-2xs transition-colors"
              >
                Request Clarification
              </button>
              <button
                onClick={() => { setSelectedAction('Escalate'); setActionModalOpen(true); }}
                className="bg-red-50 hover:bg-red-100 text-[#D92D20] border border-red-200 text-xs font-semibold px-3.5 py-2 rounded-md transition-colors"
              >
                Escalate to Vigilance
              </button>
            </div>
          )}
        </div>

        {/* Project Key Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Sanctioned Budget</span>
            <span className="text-xl font-bold text-[#12355B] font-mono mt-0.5 block">
              ₹{(project.sanctioned_amount / 100000).toFixed(2)} Lakh
            </span>
            <span className="text-[11px] text-gray-500">FY {project.financial_year}</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Actual Expenditure</span>
            <span className="text-xl font-bold text-[#1D4E89] font-mono mt-0.5 block">
              ₹{(project.actual_expenditure / 100000).toFixed(2)} Lakh
            </span>
            <span className="text-[11px] text-gray-500">Utilization: {(utilizationRate * 100).toFixed(1)}%</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Work Category</span>
            <span className="text-base font-bold text-[#263238] mt-0.5 block">
              {project.work_category}
            </span>
            <span className="text-[11px] text-gray-500">District: {project.district}</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Execution Timeline</span>
            <span className="text-sm font-bold text-[#263238] mt-0.5 block">
              {project.start_date} → {project.expected_completion}
            </span>
            {project.delay_days && project.delay_days > 0 ? (
              <span className="text-[11px] text-[#D92D20] font-semibold block mt-0.5">
                Delay: {project.delay_days} days overdue
              </span>
            ) : (
              <span className="text-[11px] text-[#027A48] font-semibold block mt-0.5">
                On schedule
              </span>
            )}
          </div>
        </div>

        {/* 2-Column Analytical Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: AI Vigilance Findings & Linked Transactions */}
          <div className="lg:col-span-7 space-y-6">
            {/* AI Vigilance Explanation Panel */}
            <AIExplanationPanel project={project} />

            {/* Evidence & Supporting Documents */}
            <EvidencePanel documents={evidenceDocs} />

            {/* Linked Transactions Table */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#F0F2F5] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#12355B]">
                    Linked Financial Disbursements
                  </h3>
                  <p className="text-xs text-[#667085]">
                    Vouchers and contractor payments processed under this project code.
                  </p>
                </div>
                <span className="text-xs font-semibold bg-[#EAF2F8] text-[#1D4E89] px-2.5 py-1 rounded">
                  {transactions.length} Vouchers
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#667085]">
                  No disbursement records logged for this project yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F5F7FA] text-[#667085] font-semibold border-b border-[#E5E7EB] uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Voucher ID</th>
                        <th className="py-2.5 px-4">Vendor</th>
                        <th className="py-2.5 px-4">Amount</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Audit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F2F5] text-[#263238]">
                      {transactions.map(tx => (
                        <tr key={tx.transaction_id} className="hover:bg-[#F9FAFB]">
                          <td className="py-2.5 px-4 font-mono font-bold text-[#1D4E89]">
                            <Link to={`/transactions/${tx.transaction_id}`} className="hover:underline">
                              {tx.transaction_id}
                            </Link>
                          </td>
                          <td className="py-2.5 px-4 font-medium">{tx.vendor_name}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-[#12355B]">
                            ₹{(tx.amount / 100000).toFixed(2)}L
                          </td>
                          <td className="py-2.5 px-4 text-[#667085]">{tx.transaction_date}</td>
                          <td className="py-2.5 px-4">
                            <StatusBadge status={tx.workflow_status} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Benchmark Chart & Audit Trail */}
          <div className="lg:col-span-5 space-y-6">
            {/* Display-Only Benchmark Chart (Section 8) */}
            <UtilizationBenchmarkChart
              projectUtilization={utilizationRate}
              stateUtilization={benchmark?.stateUtilization || 0.605}
              nationalAvg={benchmark?.nationalAvg || 0.547}
              stateName={project.state}
            />

            {/* Audit Flags Inspector */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#12355B] uppercase tracking-wide mb-3 flex items-center">
                <ShieldAlert className="w-4 h-4 text-[#D92D20] mr-1.5" />
                Vigilance Rules & ML Signals
              </h3>
              <div className="space-y-2 text-xs">
                {project.flags && project.flags.length > 0 ? (
                  project.flags.map((flag, idx) => (
                    <div key={idx} className="p-2.5 bg-red-50/70 border border-red-200 rounded text-[#263238] flex items-start space-x-2">
                      <span className="w-2 h-2 rounded-full bg-[#D92D20] mt-1 flex-shrink-0" />
                      <div>
                        <span className="font-mono font-bold text-[#D92D20]">{flag}</span>
                        <p className="text-[11px] text-[#475467] mt-0.5">{project.reason}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-emerald-50 text-[#027A48] rounded border border-emerald-200 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>No automated anomalies or statutory breaches detected.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Immutable Audit Trail */}
            <AuditTrailList logs={auditLogs} />
          </div>
        </div>
      </main>

      {/* Workflow Action Modal */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl border border-[#E5E7EB] animate-in fade-in">
            <h3 className="text-base font-bold text-[#12355B] mb-1">
              Record Operational Audit Action
            </h3>
            <p className="text-xs text-[#667085] mb-4">
              Action on project: <strong className="font-mono text-[#12355B]">{project.project_id}</strong>
            </p>

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Select Action Type
                </label>
                <select
                  value={selectedAction}
                  onChange={e => setSelectedAction(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#D0D5DD] rounded-md focus:border-[#12355B]"
                >
                  <option value="Verify">Verify (Pass Physical & Procedural Check)</option>
                  <option value="Request Clarification">Request Clarification from Implementing Agency</option>
                  <option value="Escalate">Escalate to Central Vigilance Directorate</option>
                  <option value="Mark False Positive">Mark False Positive (Rule Exemption Documented)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Statutory Audit Remarks & Justification (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  placeholder="Enter detailed audit observations, file numbers, or inspection notes..."
                  className="w-full text-xs p-2.5 bg-white border border-[#D0D5DD] rounded-md focus:border-[#12355B]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting || !actionRemarks.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-[#12355B] hover:bg-[#1D4E89] text-white rounded shadow-xs disabled:opacity-50"
                >
                  {actionSubmitting ? 'Recording in Audit Log...' : 'Confirm Audit Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
