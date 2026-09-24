import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Receipt, 
  Building2, 
  Calendar, 
  CreditCard, 
  ArrowLeft, 
  ShieldAlert, 
  CheckCircle, 
  FileText,
  AlertTriangle,
  User
} from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { StatusBadge } from '../components/StatusBadge';
import { EvidencePanel } from '../components/EvidencePanel';
import { AuditTrailList } from '../components/AuditTrailList';
import { LoadingState, ErrorState } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { Transaction, Project, AuditLogEntry, EvidenceDocument } from '../types';

export const TransactionDetailPage: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { user, isAdmin, token } = useAuth();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [evidenceDocs, setEvidenceDocs] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow action state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState('Verify');
  const [actionRemarks, setActionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTransactionData = async () => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transactionId}`);
      if (!res.ok) throw new Error('Transaction record could not be loaded.');

      const data = await res.json();
      setTransaction(data.transaction);
      setProject(data.project);
      setAuditLogs(data.auditLogs || []);
      setEvidenceDocs(data.evidenceDocuments || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching transaction.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactionData();
  }, [transactionId]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !actionRemarks.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/workflow/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          entityType: 'transaction',
          entityId: transaction.transaction_id,
          action: selectedAction,
          remarks: actionRemarks.trim(),
          userName: user?.name || 'Authorized Auditor',
          userRole: user?.role || 'auditor'
        })
      });

      if (!res.ok) throw new Error('Action execution failed.');

      setActionModalOpen(false);
      setActionRemarks('');
      fetchTransactionData();
      window.dispatchEvent(new CustomEvent('mplads-workflow-action-updated'));
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Retrieving voucher audit dossier..." />;
  if (error || !transaction) return <ErrorState message={error || 'Transaction not located'} onRetry={fetchTransactionData} />;

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[
          { label: 'Transactions', href: '/transactions' },
          { label: transaction.transaction_id }
        ]}
        contextDescription={`Voucher details for ₹${(transaction.amount / 100000).toFixed(2)} Lakh paid to ${transaction.vendor_name}.`}
        badge={`Status: ${transaction.workflow_status}`}
      />

      <main className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-[#1D4E89] bg-[#EAF2F8] px-2.5 py-0.5 rounded">
                {transaction.transaction_id}
              </span>
              <StatusBadge status={transaction.workflow_status} />
              {transaction.anomaly_flag && (
                <span className="text-xs bg-red-100 text-[#D92D20] font-semibold px-2 py-0.5 rounded">
                  Flag: {transaction.anomaly_flag}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#12355B]">
              Disbursement Voucher: ₹{(transaction.amount / 100000).toFixed(2)} Lakh
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Payee: <strong className="text-[#263238]">{transaction.vendor_name}</strong> • Invoice No: <strong className="font-mono">{transaction.invoice_number}</strong>
            </p>
          </div>

          {/* Action Buttons - restricted strictly to ADMIN */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setSelectedAction('Verify'); setActionModalOpen(true); }}
                className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs font-semibold px-3.5 py-2 rounded-md shadow-2xs transition-colors"
              >
                Verify Voucher
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

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Disbursed Sum</span>
            <span className="text-xl font-bold text-[#12355B] font-mono mt-0.5 block">
              ₹{(transaction.amount / 100000).toFixed(2)} Lakh
            </span>
            <span className="text-[11px] text-gray-500">Gross Bill Amount</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Payment Channel</span>
            <span className="text-base font-bold text-[#1D4E89] mt-0.5 block">
              {transaction.payment_mode}
            </span>
            <span className="text-[11px] text-gray-500">PFMS Cleared</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Disbursement Date</span>
            <span className="text-base font-bold text-[#263238] mt-0.5 block">
              {transaction.transaction_date}
            </span>
            <span className="text-[11px] text-gray-500">Treasury Timestamp</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <span className="text-[11px] font-semibold text-[#667085] uppercase block">Associated Project</span>
            <Link
              to={`/projects/${transaction.project_id}`}
              className="text-xs font-bold text-[#1D4E89] hover:underline mt-0.5 block truncate"
            >
              {transaction.project_name}
            </Link>
            <span className="text-[10px] font-mono text-gray-500">{transaction.project_id}</span>
          </div>
        </div>

        {/* 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Description & Narrative */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#12355B] mb-2 pb-2 border-b border-[#F0F2F5]">
                Disbursement Particulars & Milestone Narrative
              </h3>
              <p className="text-xs sm:text-sm text-[#344054] leading-relaxed">
                {transaction.description || 'Milestone payment disbursed in accordance with technical engineer measurement verification.'}
              </p>

              <div className="mt-4 pt-3 border-t border-[#F0F2F5] grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#667085] block">Recipient Contractor:</span>
                  <span className="font-semibold text-[#263238]">{transaction.vendor_name}</span>
                </div>
                <div>
                  <span className="text-[#667085] block">Invoice Serial:</span>
                  <span className="font-mono text-[#263238]">{transaction.invoice_number}</span>
                </div>
              </div>
            </div>

            {/* Evidence Documents */}
            <EvidencePanel documents={evidenceDocs} />
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Audit Trail List */}
            <AuditTrailList logs={auditLogs} />
          </div>
        </div>
      </main>

      {/* Action Modal */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-[#E5E7EB] animate-in fade-in">
            <h3 className="text-base font-bold text-[#12355B] mb-1">
              Submit Voucher Determination
            </h3>
            <p className="text-xs text-[#667085] mb-4">
              Recording audit action for voucher <strong className="font-mono">{transaction.transaction_id}</strong>
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
                  <option value="Verify">Verify (Disbursement Validated)</option>
                  <option value="Request Clarification">Request Clarification on Vendor Invoicing</option>
                  <option value="Escalate">Escalate to Vigilance Directorate</option>
                  <option value="Mark False Positive">Mark False Positive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Audit Remarks (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  placeholder="Record verification notes, invoice item checks, or engineering site visit dates..."
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
                  {submitting ? 'Submitting...' : 'Record Audit Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
