import React, { useState } from 'react';
import { FileText, CheckCircle2, ShieldAlert, Download, Eye, ExternalLink, Plus } from 'lucide-react';
import { EvidenceDocument } from '../types';

interface EvidencePanelProps {
  documents: EvidenceDocument[];
  onUploadNew?: (docName: string, docType: string) => void;
  canVerify?: boolean;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  documents = [],
  onUploadNew,
  canVerify = true
}) => {
  const [selectedDoc, setSelectedDoc] = useState<EvidenceDocument | null>(null);

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
        <div>
          <h3 className="text-base font-bold text-[#12355B]">
            Evidence & Supporting Documents
          </h3>
          <p className="text-xs text-[#667085]">
            Attached procurement bids, measurement books, engineer logs, and digital invoices.
          </p>
        </div>
        <span className="text-xs font-semibold bg-[#EAF2F8] text-[#1D4E89] px-2.5 py-1 rounded">
          {documents.length} Records
        </span>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 bg-[#F5F7FA] rounded-md border border-dashed border-[#D0D5DD]">
          <FileText className="w-8 h-8 text-[#98A2B3] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#344054]">No evidence documents uploaded</p>
          <p className="text-xs text-[#667085] mt-1">This transaction lacks verified digital audit attachments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="p-3 bg-[#F5F7FA] hover:bg-[#EAF2F8] border border-[#E5E7EB] rounded-md flex items-start justify-between transition-colors"
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className="p-2 bg-white rounded border border-[#E5E7EB] text-[#12355B]">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[#263238] truncate" title={doc.name}>
                    {doc.name}
                  </h4>
                  <div className="flex items-center space-x-2 text-[11px] text-[#667085] mt-0.5">
                    <span className="font-semibold text-[#1D4E89]">{doc.documentType}</span>
                    <span>•</span>
                    <span>{doc.size}</span>
                    <span>•</span>
                    <span>{doc.uploadDate}</span>
                  </div>
                  <div className="mt-1.5 flex items-center space-x-1 text-[11px]">
                    {doc.verified ? (
                      <span className="inline-flex items-center text-[#027A48] font-semibold">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Auditor Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[#B54708] font-medium">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Verification Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 ml-2">
                <button
                  onClick={() => setSelectedDoc(doc)}
                  className="p-1 text-[#1D4E89] hover:bg-white rounded"
                  title="Quick View Document Metadata"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Preview for document info */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl border border-[#E5E7EB] animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h4 className="text-sm font-bold text-[#12355B]">Document Details</h4>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="py-4 space-y-2 text-xs text-[#263238]">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">File Name:</span>
                <span className="font-mono font-semibold">{selectedDoc.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">Category:</span>
                <span className="font-semibold">{selectedDoc.documentType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">Payload Size:</span>
                <span>{selectedDoc.size}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-[#667085]">Upload Timestamp:</span>
                <span>{selectedDoc.uploadDate}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#667085]">Cryptographic Hash:</span>
                <span className="font-mono text-[10px] text-gray-500">SHA256: 8f4b2...91c</span>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-200 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-3 py-1.5 bg-[#12355B] text-white text-xs font-semibold rounded hover:bg-[#1D4E89]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
