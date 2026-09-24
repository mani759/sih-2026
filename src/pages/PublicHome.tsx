import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  AlertTriangle, 
  TrendingUp, 
  Cpu, 
  FileCheck2, 
  Layers, 
  ArrowRight,
  Database,
  Award
} from 'lucide-react';

export const PublicHome: React.FC = () => {
  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Hero Executive Banner */}
      <section className="bg-white border-b border-[#E5E7EB] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center space-x-2 bg-[#EAF2F8] text-[#1D4E89] px-3 py-1 rounded-md text-xs font-semibold border border-[#1D4E89]/20">
                <Cpu className="w-3.5 h-3.5" />
                <span>Smart India Hackathon • Problem Statement 26102</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#12355B] tracking-tight leading-tight">
                AI-Powered Detection of Anomalies, Inefficiencies & Fraud in MPLAD Scheme Implementation
              </h1>
              <p className="text-base text-[#475467] leading-relaxed max-w-3xl">
                A mission-critical operational intelligence portal for the Ministry of Statistics and Programme Implementation (MoSPI) and District Nodal Authorities. Integrating machine learning anomaly isolation, text embedding duplicate clustering, and explainable audit reasoning.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-sm font-semibold px-6 py-3 rounded-md shadow-xs flex items-center space-x-2 transition-all"
                >
                  <span>Access Officer Vigilance Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="bg-white hover:bg-gray-50 text-[#12355B] border border-[#D0D5DD] text-sm font-semibold px-5 py-3 rounded-md transition-colors"
                >
                  View ML Architecture & Methodology
                </Link>
              </div>
            </div>

            {/* National Scheme Live Indicator Card */}
            <div className="lg:col-span-4">
              <div className="bg-[#12355B] rounded-xl text-white p-6 shadow-md border border-[#1D4E89]">
                <div className="flex items-center justify-between pb-3 border-b border-white/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                    Scheme Vigilance Scope
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="mt-4 space-y-4 text-xs">
                  <div>
                    <span className="text-white/70 block">Annual Entitlement per MP</span>
                    <span className="text-2xl font-bold font-sans">₹5.00 Crore</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                    <div>
                      <span className="text-white/70 block">Lok Sabha Seats</span>
                      <span className="text-base font-bold font-mono">543</span>
                    </div>
                    <div>
                      <span className="text-white/70 block">Rajya Sabha Seats</span>
                      <span className="text-base font-bold font-mono">245</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/10 text-[11px] text-blue-100 flex items-center justify-between">
                    <span>Audit Guidelines:</span>
                    <span className="font-semibold">MoSPI Rev. 2023</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Pillars */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-[#12355B]">
            Comprehensive Scheme Oversight & Risk Interception
          </h2>
          <p className="text-sm text-[#667085] mt-1">
            Addressing critical monitoring vulnerabilities identified in CAG performance audits of MPLADS.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <div className="w-10 h-10 rounded-md bg-[#EAF2F8] text-[#1D4E89] flex items-center justify-center mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#12355B] mb-1">ML Risk Scoring</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Isolation Forest model trained on expenditure velocities, milestone delays, and tender presence to compute an objective 0-100 risk score.
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <div className="w-10 h-10 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#12355B] mb-1">Duplicate Work Detection</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              TF-IDF text embeddings and location proximity clustering intercept duplicate proposals for community halls and desilting works.
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <div className="w-10 h-10 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#12355B] mb-1">Utilization Benchmarking</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Contextual comparison of district expenditure rates against state averages and national performance baselines.
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-2xs">
            <div className="w-10 h-10 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#12355B] mb-1">Immutable Audit Trail</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Every verification, escalation, and clarification request generates an unalterable chronological audit log.
            </p>
          </div>
        </div>
      </section>

      {/* Statutory Mandate Note */}
      <section className="bg-white border-t border-[#E5E7EB] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-xs text-[#667085]">
            <Award className="w-6 h-6 text-[#12355B] flex-shrink-0" />
            <span>
              Developed in accordance with the <strong>Members of Parliament Local Area Development Scheme (MPLADS) Guidelines 2023</strong> and Central Vigilance Commission operating directives.
            </span>
          </div>
          <Link
            to="/login"
            className="text-xs font-semibold text-[#1D4E89] hover:text-[#12355B] flex items-center space-x-1"
          >
            <span>Proceed to Officer Sign-In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
};
