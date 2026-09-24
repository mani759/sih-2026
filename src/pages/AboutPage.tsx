import React from 'react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { ShieldCheck, BookOpen, Scale, Award, Database, Cpu, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AboutPage: React.FC = () => {
  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      <BreadcrumbContextStrip
        items={[{ label: 'About MPLAD Monitoring' }]}
        contextDescription="Institutional context, statutory scheme guidelines, and vigilance objectives under MoSPI."
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Intro Card */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 sm:p-8 shadow-xs">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-[#EAF2F8] text-[#12355B] rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#12355B]">
                About the MPLAD Monitoring Portal
              </h1>
              <p className="text-xs text-[#667085]">
                SIH Problem Statement 26102 — Intelligent Governance & Public Financial Integrity
              </p>
            </div>
          </div>

          <div className="prose prose-sm text-[#344054] max-w-none space-y-4 leading-relaxed">
            <p>
              The <strong>Members of Parliament Local Area Development Scheme (MPLADS)</strong> is a Central Sector Scheme formulated in 1993 to enable Hon'ble Members of Parliament to recommend works of developmental nature with emphasis on the creation of durable community assets in their respective constituencies.
            </p>
            <p>
              Under the revised MPLADS Guidelines issued in 2023, the annual entitlement per MP is ₹5 Crore, released by the Ministry of Statistics and Programme Implementation (MoSPI) to District Authorities in two installments of ₹2.5 Crore upon receipt of necessary utilization certificates and physical progress audit trails.
            </p>
          </div>
        </div>

        {/* 3 Pillars of Problem Statement */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-xs">
            <div className="w-10 h-10 rounded-md bg-red-50 text-[#D92D20] flex items-center justify-center mb-3">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#12355B] mb-2">The Vigilance Challenge</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Historical audits by the Comptroller and Auditor General (CAG) noted challenges regarding duplicate sanctioning of community assets, missing public tenders, milestone stalling, and delays between fund sanction and field execution.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-xs">
            <div className="w-10 h-10 rounded-md bg-blue-50 text-[#1D4E89] flex items-center justify-center mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#12355B] mb-2">The AI / ML Solution</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Automated anomaly scoring using an Isolation Forest ML model combined with heuristic rule checks and TF-IDF duplicate work clustering to highlight deviations without human subjectivity.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-xs">
            <div className="w-10 h-10 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#12355B] mb-2">Audit Compliance</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Auditors and District Nodal Officers review flagged items, inspect digitized invoices and measurement logs, request clarifications from implementing agencies, and record unalterable audit trails.
            </p>
          </div>
        </div>

        {/* Call to action */}
        <div className="bg-[#12355B] rounded-lg p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Authorized Officer Access</h3>
            <p className="text-xs text-blue-200 mt-1">
              Sign in with your government email (NIC / GOV) or test auditor credentials to view the operational queues.
            </p>
          </div>
          <Link
            to="/login"
            className="bg-white text-[#12355B] hover:bg-blue-50 px-5 py-2.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap"
          >
            Access Portal Login
          </Link>
        </div>
      </main>
    </div>
  );
};
