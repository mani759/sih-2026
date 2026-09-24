import React from 'react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { Cpu, Search, CheckCircle2, ShieldAlert, FileText, Database, ArrowRight, Bot, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      <BreadcrumbContextStrip
        items={[{ label: 'How It Works' }]}
        contextDescription="End-to-end technical pipeline: ML feature ingestion, duplicate clustering, AI reasoning, and audit actions."
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 sm:p-8 shadow-xs">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-[#12355B] mb-2">
              Operational & Technical Architecture
            </h1>
            <p className="text-sm text-[#475467] leading-relaxed">
              The portal integrates an external Python ML service (`/score`, `/duplicates`, `/utilization-benchmark`), a Node.js Express vigilance orchestration proxy, a Gemini-powered audit explanation synthesizer, and an immutable audit log.
            </p>
          </div>
        </div>

        {/* 5-Step Pipeline */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#12355B]">
            The 5-Stage Vigilance Workflow
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Step 1 */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs relative">
              <div className="w-7 h-7 rounded-full bg-[#12355B] text-white flex items-center justify-center font-bold text-xs mb-3">
                1
              </div>
              <h3 className="text-sm font-bold text-[#12355B] mb-1">Data Ingestion</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Project recommendations, sanction orders, milestone logs, and vendor invoices are ingested into the database.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs relative">
              <div className="w-7 h-7 rounded-full bg-[#1D4E89] text-white flex items-center justify-center font-bold text-xs mb-3">
                2
              </div>
              <h3 className="text-sm font-bold text-[#12355B] mb-1">ML Risk Scoring</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Render-hosted `get_risk_score()` computes expenditure velocity, milestone delays, and missing tender flags to output a 0-100 score.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs relative">
              <div className="w-7 h-7 rounded-full bg-purple-700 text-white flex items-center justify-center font-bold text-xs mb-3">
                3
              </div>
              <h3 className="text-sm font-bold text-[#12355B] mb-1">Duplicate Interception</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                TF-IDF text similarity clusters project titles in the same district to catch duplicate community halls or desilting tenders.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs relative">
              <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs mb-3">
                4
              </div>
              <h3 className="text-sm font-bold text-[#12355B] mb-1">AI Synthesis</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Gemini translates raw model parameters into objective audit findings using strictly approved non-accusatory terminology.
              </p>
            </div>

            {/* Step 5 */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs relative">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-3">
                5
              </div>
              <h3 className="text-sm font-bold text-[#12355B] mb-1">Auditor Action</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Officers review evidence, request clarifications, escalate to vigilance, or verify, creating an immutable audit log.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Constraints & Guardrails */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 shadow-xs">
          <h3 className="text-base font-bold text-[#12355B] mb-3 flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-[#D92D20]" />
            <span>Strict Systemic Guardrails & Terminology Compliance</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#344054]">
            <div className="p-3 bg-[#F5F7FA] rounded border border-[#E5E7EB]">
              <span className="font-bold text-[#027A48] block mb-1">Approved CVC Terminology:</span>
              <ul className="list-disc list-inside space-y-1 text-[#667085]">
                <li>"Potential irregularity detected"</li>
                <li>"Anomaly detected during automated screening"</li>
                <li>"Requires administrative review"</li>
                <li>"Elevated risk signal"</li>
              </ul>
            </div>
            <div className="p-3 bg-[#F5F7FA] rounded border border-[#E5E7EB]">
              <span className="font-bold text-[#D92D20] block mb-1">Strictly Banned Output:</span>
              <ul className="list-disc list-inside space-y-1 text-[#667085]">
                <li>"Fraud confirmed" or "Proven embezzlement"</li>
                <li>"Corrupt MP" or "Fraudulent officer"</li>
                <li>Premature accusations without due inquiry</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/login"
            className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs font-semibold px-5 py-2.5 rounded-md flex items-center space-x-2 shadow-xs transition-colors"
          >
            <span>Proceed to Officer Login</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
};
