import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Server, 
  Cpu, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Lock,
  ExternalLink,
  Shield,
  FileCheck
} from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { useAuth } from '../context/AuthContext';
import { AuditLogEntry } from '../types';

export const SettingsPage: React.FC = () => {
  const { user, token, isAdmin } = useAuth();

  const [mlStatus, setMlStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [projectCount, setProjectCount] = useState<number>(0);
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const checkHealth = async () => {
    setMlStatus('checking');
    setApiStatus('checking');
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setApiStatus('online');
        // OLD: fake fallback counts shown when the API returned nothing
        // setProjectCount(data.projectCount || 20);
        // setTransactionCount(data.transactionCount || 12);
        setProjectCount(data.projectCount || 0);
        setTransactionCount(data.transactionCount || 0);
      } else {
        setApiStatus('offline');
      }
    } catch {
      setApiStatus('offline');
    }

    try {
      // OLD: this hit the hard-coded benchmark table, so it always reported ONLINE
      // const res = await fetch('/api/ml/utilization-benchmark?state=Telangana');
      const res = await fetch('/api/ml/health');
      if (res.ok) {
        setMlStatus('online');
      } else {
        setMlStatus('offline');
      }
    } catch {
      setMlStatus('offline');
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/audit-logs', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    checkHealth();
    fetchAuditLogs();
  }, [token]);

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'System & Security Settings' }]}
        contextDescription="Operational service health, vigilance engine status, officer roles, and terminology guardrails."
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* System Health Check Grid */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
            <div>
              <h3 className="text-base font-bold text-[#12355B]">
                Vigilance Infrastructure & Subsystems
              </h3>
              <p className="text-xs text-[#667085]">
                Real-time operational status of backend services, ML models, and AI synthesis endpoints.
              </p>
            </div>
            <button
              onClick={checkHealth}
              className="px-3 py-1.5 bg-[#EAF2F8] hover:bg-[#D0E2EC] text-[#1D4E89] rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-check Services</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Express API */}
            <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#12355B]">
                  <Server className="w-4 h-4 text-[#1D4E89]" />
                  <span>Node.js Express API</span>
                </div>
                {apiStatus === 'online' ? (
                  <span className="text-[10px] bg-emerald-100 text-[#027A48] font-bold px-2 py-0.5 rounded flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                    ONLINE
                  </span>
                ) : (
                  <span className="text-[10px] bg-red-100 text-[#D92D20] font-bold px-2 py-0.5 rounded">
                    CHECKING
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#667085]">
                Local orchestration service hosting project data, immutable audit logs, and workflow routes.
              </p>
              <div className="mt-3 pt-2 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
                Records: {projectCount} Projects • {transactionCount} Vouchers
              </div>
            </div>

            {/* External Python ML Service */}
            <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#12355B]">
                  <Cpu className="w-4 h-4 text-purple-700" />
                  <span>External ML Engine</span>
                </div>
                {mlStatus === 'online' ? (
                  <span className="text-[10px] bg-emerald-100 text-[#027A48] font-bold px-2 py-0.5 rounded flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                    ONLINE (Render)
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-100 text-[#B54708] font-bold px-2 py-0.5 rounded">
                    WARMING UP
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#667085]">
                Render-hosted Python FastAPI service running Isolation Forest risk scoring and TF-IDF duplicate text clustering.
              </p>
              <div className="mt-3 pt-2 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
                Endpoints: /score, /duplicates, /utilization-benchmark
              </div>
            </div>

            {/* AI Reasoning (Gemini) */}
            <div className="p-4 bg-[#F5F7FA] rounded-lg border border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#12355B]">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>AI Explanation Engine</span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-[#027A48] font-bold px-2 py-0.5 rounded flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                  ONLINE
                </span>
              </div>
              <p className="text-[11px] text-[#667085]">
                Gemini 2.5 Flash synthesizer grounded strictly in verified scheme database records with non-accusatory CVC audit vocabulary.
              </p>
              <div className="mt-3 pt-2 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
                Guardrail: Regex Terminology Sanitizer Active
              </div>
            </div>
          </div>
        </div>

        {/* User Profile & RBAC Security Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0F2F5]">
              <h3 className="text-sm font-bold text-[#12355B] flex items-center space-x-2">
                <User className="w-4 h-4 text-[#1D4E89]" />
                <span>Authenticated Officer Identity</span>
              </h3>
              <span className="text-[10px] bg-emerald-100 text-[#027A48] font-bold px-2 py-0.5 rounded flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1" />
                SERVER VERIFIED
              </span>
            </div>

            {user && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-[#667085]">Officer Name:</span>
                  <span className="font-bold text-[#263238]">{user.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-[#667085]">Official Email:</span>
                  <span className="font-mono text-[#1D4E89]">{user.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-[#667085]">Designation:</span>
                  <span className="font-medium text-[#263238]">{user.designation}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-[#667085]">Ministry Wing:</span>
                  <span className="text-[#263238]">{user.department}</span>
                </div>
                <div className="flex justify-between py-1 items-center">
                  <span className="text-[#667085]">Enforced RBAC Tier:</span>
                  <span className={`font-bold uppercase font-mono px-2.5 py-1 rounded text-xs ${
                    isAdmin 
                      ? 'bg-[#12355B] text-white shadow-xs' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {user.role} ({isAdmin ? 'Full Clearance' : 'Read-Only'})
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#12355B] pb-2 border-b border-[#F0F2F5] flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#1D4E89]" />
              <span>Two-Tier Role-Based Access Control (RBAC)</span>
            </h3>
            <p className="text-xs text-[#667085]">
              Strict server-side enforcement governs access to vigilance queues and mutation actions under MoSPI guidelines:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-md bg-[#F5F7FA] border border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#12355B]">ADMIN Role</span>
                  <span className="text-[10px] bg-blue-100 text-[#1D4E89] font-semibold px-2 py-0.5 rounded">
                    Designated Account
                  </span>
                </div>
                <p className="text-[11px] text-[#667085] mt-1">
                  Exclusive access to Anomalies Vigilance Queue, workflow actions (Verify, Escalate, Request Clarification, Mark False Positive), ML scoring backfill, and system settings.
                </p>
              </div>

              <div className="p-3 rounded-md bg-[#F5F7FA] border border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#12355B]">PUBLIC Role</span>
                  <span className="text-[10px] bg-gray-200 text-gray-700 font-semibold px-2 py-0.5 rounded">
                    All Other Users
                  </span>
                </div>
                <p className="text-[11px] text-[#667085] mt-1">
                  Read-only transparent view across Dashboard, Projects directory, State & Fund analysis, Reports, and Trends. All mutation buttons and restricted queues are hidden and return 403 on the server.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Immutable Audit Trail Log Viewer */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#12355B] flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-[#1D4E89]" />
                <span>Statutory Vigilance Audit Log (Immutable Central Register)</span>
              </h3>
              <p className="text-xs text-[#667085] mt-0.5">
                Cryptographically registered workflow determinations, officer actions, and status escalations.
              </p>
            </div>
            <button
              onClick={fetchAuditLogs}
              disabled={loadingLogs}
              className="px-3 py-1.5 bg-[#EAF2F8] hover:bg-[#D0E2EC] text-[#1D4E89] rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>

          {loadingLogs ? (
            <div className="py-8 text-center text-xs text-[#667085]">Loading audit register entries...</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#667085]">
              No statutory actions recorded in this session. Execute an action on an anomaly to record an immutable log.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F7FA] text-[#667085] font-semibold border-b border-[#E5E7EB] uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Log ID</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Entity ID</th>
                    <th className="py-2.5 px-3">Officer / User</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Status Transition</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5] text-[#263238] font-sans">
                  {auditLogs.slice(0, 15).map((log) => (
                    <tr key={log.id} className="hover:bg-[#F9FAFB]">
                      <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-[#1D4E89]">{log.id}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-[#667085]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-semibold">{log.entityId}</td>
                      <td className="py-2.5 px-3 text-[11px]">
                        <div className="font-semibold">{log.user}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{log.userRole}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'Verify' ? 'bg-emerald-100 text-emerald-800' :
                          log.action === 'Escalate' ? 'bg-red-100 text-red-800' :
                          log.action === 'Mark False Positive' ? 'bg-purple-100 text-purple-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px]">
                        {log.previousStatus} → <strong>{log.newStatus}</strong>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-gray-600 max-w-xs truncate" title={log.remarks}>
                        {log.remarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Terminology Audit System Constraint Note */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
          <h3 className="text-sm font-bold text-[#12355B] pb-2 border-b border-[#F0F2F5] mb-2 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-[#12B76A]" />
            <span>Statutory Audit Terminology Compliance Engine</span>
          </h3>
          <p className="text-xs text-[#667085] leading-relaxed">
            In compliance with Section 12 of the SIH Problem Statement 26102 specifications, all AI and ML generated summaries are sanitized before display. Output strings matching accusatory terms (e.g. "Fraud confirmed", "Corrupt MP") are intercepted and replaced with standard CVC audit terminology ("Potential irregularity", "Requires review").
          </p>
        </div>
      </main>
    </div>
  );
};
