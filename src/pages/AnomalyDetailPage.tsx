import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  ArrowLeft, 
  Building2, 
  Calendar, 
  FileText, 
  Clock, 
  MapPin, 
  ExternalLink,
  Layers,
  Copy,
  ChevronRight
} from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { AIExplanationPanel } from '../components/AIExplanationPanel';
import { EvidencePanel } from '../components/EvidencePanel';
import { AuditTrailList } from '../components/AuditTrailList';
import { LoadingState, ErrorState } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { Project, AuditLogEntry, EvidenceDocument } from '../types';

export const AnomalyDetailPage: React.FC = () => {
  const { anomalyId } = useParams<{ anomalyId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [evidenceDocs, setEvidenceDocs] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow action state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('Request Clarification');
  const [actionRemarks, setActionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAnomalyDetails = async () => {
    if (!anomalyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${anomalyId}`);
      if (!res.ok) throw new Error('Anomaly record could not be loaded.');

      const data = await res.json();
      setProject(data.project);
      setAuditLogs(data.auditLogs || []);
      setEvidenceDocs(data.evidenceDocuments || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching anomaly record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalyDetails();
  }, [anomalyId]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !actionRemarks.trim()) return;

    setSubmitting(true);
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

      if (!res.ok) throw new Error('Failed to record action.');

      setActionModalOpen(false);
      setActionRemarks('');
      fetchAnomalyDetails();
      window.dispatchEvent(new CustomEvent('mplads-workflow-action-updated'));
    } catch (err: any) {
      alert('Action error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading anomaly investigation dossier..." />;
  if (error || !project) return <ErrorState message={error || 'Anomaly record not found'} onRetry={fetchAnomalyDetails} />;

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[
          { label: 'Investigation Queue', href: '/anomalies' },
          { label: project.project_id }
        ]}
        contextDescription="Formal investigation workspace: evaluate flags, inspect evidence, and submit statutory determinations."
        badge={`Risk Score: ${project.risk_score}/100`}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Action Banner */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-[#D92D20] bg-red-50 border border-red-200 px-2.5 py-0.5 rounded">
                FLAGGED ANOMALY
              </span>
              <RiskBadge score={project.risk_score} severity={project.severity} />
              <StatusBadge status={project.status} />
              {project.is_potential_duplicate && (
                <span className="inline-flex items-center text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                  <Copy className="w-3 h-3 mr-1" />
                  Possible Duplicate
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#12355B]">
              {project.project_name}
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Project ID: <strong className="font-mono">{project.project_id}</strong> • Recommended by <strong>{project.mp_name}</strong> ({project.constituency}, {project.state})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setSelectedAction('Verify'); setActionModalOpen(true); }}
              className="bg-[#12B76A] hover:bg-[#027A48] text-white text-xs font-semibold px-3.5 py-2 rounded-md shadow-2xs transition-colors"
            >
              Verify (Clear Flag)
            </button>
            <button
              onClick={() => { setSelectedAction('Request Clarification'); setActionModalOpen(true); }}
              className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs font-semibold px-3.5 py-2 rounded-md shadow-2xs transition-colors"
            >
              Request Clarification
            </button>
            <button
              onClick={() => { setSelectedAction('Escalate'); setActionModalOpen(true); }}
              className="bg-[#D92D20] hover:bg-red-700 text-white text-xs font-semibold px-3.5 py-2 rounded-md transition-colors"
            >
              Escalate to Vigilance
            </button>
            <button
              onClick={() => { setSelectedAction('Mark False Positive'); setActionModalOpen(true); }}
              className="bg-white hover:bg-gray-50 text-[#344054] border border-[#D0D5DD] text-xs font-semibold px-3.5 py-2 rounded-md transition-colors"
            >
              Mark False Positive
            </button>
          </div>
        </div>

        {/* Primary Anomaly Signal Card */}
        <div className="bg-red-50/80 rounded-lg border-2 border-[#D92D20]/30 p-5 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-[#D92D20] text-white rounded-md mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#D92D20] uppercase tracking-wide">
                  Automated Vigilance Trigger
                </h3>
                <span className="text-xs font-mono font-bold text-[#D92D20]">
                  Confidence: 94%
                </span>
              </div>
              <p className="text-sm text-[#263238] font-medium leading-relaxed">
                {project.reason || 'Parameter variance detected across expenditure velocity and procurement filing.'}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {project.flags?.map((flag, idx) => (
                  <span key={idx} className="bg-white text-[#D92D20] text-[11px] font-mono font-semibold px-2 py-0.5 rounded border border-red-200">
                    #{flag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Analytical Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: AI Explanation & Evidence */}
          <div className="lg:col-span-7 space-y-6">
            <AIExplanationPanel project={project} />
            <EvidencePanel documents={evidenceDocs} />
          </div>

          {/* Right Column: Financial Breakdown & Audit Trail */}
          <div className="lg:col-span-5 space-y-6">
            {/* Financial & Schedule Audit Summary */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs space-y-3 text-xs">
              <h3 className="text-sm font-bold text-[#12355B] pb-2 border-b border-[#F0F2F5]">
                Fiscal & Milestone Breakdown
              </h3>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">Sanctioned Estimate:</span>
                <span className="font-mono font-bold text-[#12355B]">₹{(project.sanctioned_amount / 100000).toFixed(2)} Lakh</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">Disbursed to Date:</span>
                <span className="font-mono font-bold text-[#D92D20]">₹{(project.actual_expenditure / 100000).toFixed(2)} Lakh</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">Statutory Public Tender:</span>
                <span className={`font-semibold ${project.has_tender_on_file ? 'text-[#027A48]' : 'text-[#D92D20]'}`}>
                  {project.has_tender_on_file ? 'Verified on e-Procurement' : 'NOT FOUND (Breach)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">Scheduled Completion:</span>
                <span className="font-mono text-[#263238]">{project.expected_completion}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#667085]">Schedule Variance:</span>
                <span className="font-semibold text-amber-700">
                  {project.delay_days ? `+${project.delay_days} days overdue` : 'On schedule'}
                </span>
              </div>
            </div>

            {/* Audit Trail */}
            <AuditTrailList logs={auditLogs} />
          </div>
        </div>
      </main>

      {/* Action Modal */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-[#E5E7EB] animate-in fade-in">
            <h3 className="text-base font-bold text-[#12355B] mb-1">
              Submit Vigilance Determination
            </h3>
            <p className="text-xs text-[#667085] mb-4">
              Recording audit action for <strong className="font-mono">{project.project_id}</strong>
            </p>

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Determination Action
                </label>
                <select
                  value={selectedAction}
                  onChange={e => setSelectedAction(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#D0D5DD] rounded-md focus:border-[#12355B]"
                >
                  <option value="Verify">Verify (Mark Cleared / Normal Variance)</option>
                  <option value="Request Clarification">Request Clarification from District Nodal Agency</option>
                  <option value="Escalate">Escalate to Central Vigilance Directorate</option>
                  <option value="Mark False Positive">Mark False Positive (Procurement Exemption Verified)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Officer Remarks / Compliance Note (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  placeholder="State evidence cited, executive engineer comments, or voucher verification details..."
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
                  disabled={submitting || !actionRemarks.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-[#12355B] hover:bg-[#1D4E89] text-white rounded shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Confirm Determination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
