import React from 'react';
import { ShieldCheck, AlertCircle, FileClock, CheckCircle, ArrowRight, User } from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditTrailListProps {
  logs: AuditLogEntry[];
}

export const AuditTrailList: React.FC<AuditTrailListProps> = ({ logs = [] }) => {
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'Verify':
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#027A48] border border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </span>
        );
      case 'Escalate':
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-[#D92D20] border border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Escalated to Vigilance
          </span>
        );
      case 'Request Clarification':
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1D4E89] border border-blue-200">
            <FileClock className="w-3 h-3 mr-1" />
            Clarification Requested
          </span>
        );
      case 'Mark False Positive':
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Marked False Positive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
        <div>
          <h3 className="text-base font-bold text-[#12355B]">
            Immutable Audit Trail & Chain of Custody
          </h3>
          <p className="text-xs text-[#667085]">
            Chronological compliance record of vigilance actions, remarks, and administrative status transitions.
          </p>
        </div>
        <span className="text-xs font-mono bg-[#F5F7FA] text-[#475467] px-2.5 py-1 rounded border border-[#E5E7EB]">
          {logs.length} Entries
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-6 text-xs text-[#667085] bg-[#F5F7FA] rounded-md">
          No audit modifications logged yet. Initial intake record intact.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E7EB]">
          {logs.map(log => (
            <div key={log.id} className="relative group">
              {/* Bullet node on timeline */}
              <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-[#12355B] border-2 border-white ring-2 ring-[#EAF2F8]" />

              <div className="p-3 bg-[#F5F7FA] rounded-md border border-[#E5E7EB] hover:border-[#D0D5DD] transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    {getActionBadge(log.action)}
                    <span className="text-xs font-bold text-[#263238] flex items-center">
                      <User className="w-3 h-3 text-[#667085] mr-1" />
                      {log.user}
                    </span>
                    <span className="text-[11px] text-[#667085]">({log.userRole})</span>
                  </div>

                  <span className="text-[11px] font-mono text-[#667085]">
                    {new Date(log.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <p className="text-xs text-[#344054] leading-relaxed">
                  {log.remarks}
                </p>

                {log.previousStatus && log.newStatus && (
                  <div className="mt-2 text-[11px] text-[#475467] flex items-center space-x-1.5 font-mono">
                    <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">{log.previousStatus}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="px-1.5 py-0.5 bg-[#EAF2F8] text-[#1D4E89] font-bold rounded">{log.newStatus}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
