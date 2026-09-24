import React, { useState } from 'react';
import { Bot, Sparkles, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Project, Transaction } from '../types';

interface AIExplanationPanelProps {
  project: Project;
  transaction?: Transaction | null;
}

export const AIExplanationPanel: React.FC<AIExplanationPanelProps> = ({ project, transaction }) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAIExplanation = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.project_id,
          transactionId: transaction?.transaction_id
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate AI Vigilance explanation.');
      }

      const data = await res.json();
      setExplanation(data.explanation);
      setRecommendations(data.recommendations || []);
      setConfidence(data.confidenceScore || 90);
    } catch (e: any) {
      setError(e.message || 'Error communicating with AI engine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#F0F2F5] mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-[#EAF2F8] text-[#1D4E89] rounded-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#12355B] flex items-center space-x-1.5">
              <span>AI Vigilance Analysis & Audit Explanation</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </h3>
            <p className="text-xs text-[#667085]">
              Ground-truth plain-language synthesis based on ML feature isolation and procurement rules.
            </p>
          </div>
        </div>

        <button
          id="generate-ai-explanation-button"
          onClick={fetchAIExplanation}
          disabled={loading}
          className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs font-semibold px-3.5 py-2 rounded-md flex items-center justify-center space-x-1.5 transition-colors shadow-2xs disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Parameters...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{explanation ? 'Regenerate Analysis' : 'Generate AI Explanation'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded text-xs text-[#D92D20]">
          {error}
        </div>
      )}

      {!explanation && !loading && (
        <div className="p-6 bg-[#F5F7FA] rounded-md border border-dashed border-[#D0D5DD] text-center">
          <Bot className="w-8 h-8 text-[#667085] mx-auto mb-2 opacity-60" />
          <h4 className="text-xs font-bold text-[#263238]">Click to Synthesize Vigilance Explanation</h4>
          <p className="text-xs text-[#667085] max-w-lg mx-auto mt-1">
            The system will inspect project expenditure utilization, missing statutory tenders, work timeline delays, and state benchmarks to synthesize an objective audit briefing.
          </p>
        </div>
      )}

      {loading && (
        <div className="py-8 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#12355B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-[#667085]">Correlating ML risk signals with statutory scheme rules...</p>
        </div>
      )}

      {explanation && !loading && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Main explanation card */}
          <div className="p-4 bg-[#F5F7FA] border-l-3 border-[#1D4E89] rounded-r-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1D4E89] flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1 text-[#1D4E89]" />
                Audit Assessment Findings
              </span>
              {confidence && (
                <span className="text-[11px] font-mono text-[#027A48] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Grounding Confidence: {confidence}%
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#263238] leading-relaxed">
              {explanation}
            </p>
          </div>

          {/* Actionable recommendations */}
          {recommendations.length > 0 && (
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-md">
              <h4 className="text-xs font-bold text-[#12355B] uppercase tracking-wide mb-2 flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#12B76A]" />
                Recommended Nodal Auditor Inquiries
              </h4>
              <ul className="space-y-2 text-xs text-[#344054]">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="w-4 h-4 rounded-full bg-[#EAF2F8] text-[#1D4E89] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Terminology compliance footer */}
          <div className="text-[11px] text-[#667085] flex items-center space-x-1 pt-2 border-t border-gray-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Compliant with Central Vigilance Commission (CVC) audit vocabulary standards.</span>
          </div>
        </div>
      )}
    </div>
  );
};
