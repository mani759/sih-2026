import React, { useState } from 'react';
import { Cpu, Play, Loader2, AlertTriangle, Flag, Clock, Code2, Search, Database, Radio } from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { RiskBadge } from '../components/RiskBadge';
import { MLTesterResponse, StoredWorkScore, V3ScoreResult } from '../types';

// OLD: this page collected old-schema fields (sanctioned amount, expected completion, tender on file, ...)
// and presets copied from the synthetic MPLADS-xxxxx dataset. It now scores REAL works from the
// eSAKSHI v3 `works` table through the v3 ML service and compares against the stored work_scores row.

interface RefusalBody {
  error: string;
  missing?: string[];
  invalid?: string[];
}

interface SearchHit {
  project_id: string;
  project_name: string;
  state: string;
  mp_name: string;
  severity: string | null;
  risk_score: number | null;
}

// What each flag returned by the v3 scoring pipeline means
const FLAG_INFO: Record<string, string> = {
  overdue_stalled: 'Overdue & stalled',
  overdue: 'Overdue',
  paid_but_stalled: 'Paid but stalled',
  duplicate_paid: 'Duplicate (paid)',
  possible_duplicate: 'Possible duplicate',
  same_work_other_mp: 'Same work under another MP',
  bundled_work: 'Bundled work',
  unusually_expensive: 'Unusually expensive',
  completed_far_below_sanction: 'Completed far below sanction',
  completed_without_payment: 'Completed without payment',
  construction_within_7_days: 'Construction within 7 days',
  construction_same_day: 'Construction same day',
  sanction_pending: 'Sanction pending',
  repeated_payment_entries: 'Repeated payment entries',
  no_recommendation_record: 'No recommendation record',
  statistical_anomaly: 'Statistical anomaly',
  vague_description: 'Vague description'
};

// Real works from the Supabase `works` table, chosen for their stored v3 outcome
const PRESETS: Array<{ label: string; workId: string }> = [
  { label: 'High · duplicate paid', workId: 'LS-192922' },
  { label: 'High · paid but stalled', workId: 'RS-1199' },
  { label: 'Medium · overdue', workId: 'RS-1518' },
  { label: 'Medium · unusually expensive', workId: 'RS-1762' },
  { label: 'Low · statistical anomaly', workId: 'RS-1604' },
  { label: 'No signal · completed', workId: 'RS-1211' },
  // Real works with fields missing in eSAKSHI — scored with those fields as null, nothing filled in
  { label: 'No activity type recorded', workId: 'LS--23' },
  { label: 'No recommended amount (sanctioned only)', workId: 'RS-19503' },
  { label: 'No work description', workId: 'RS-133530' }
];

const inputClass =
  'w-full px-3 py-2 border border-[#D0D5DD] rounded-md text-sm text-[#263238] bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30 focus:border-[#1D4E89]';
const labelClass = 'block text-xs font-semibold text-[#344054] mb-1';

const SeverityChip: React.FC<{ score: number; severity: string }> = ({ score, severity }) =>
  severity === 'none' ? (
    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border bg-gray-50 border-gray-300 text-gray-600">
      No Risk Signal ({score}%)
    </span>
  ) : (
    <RiskBadge score={score} severity={severity} size="md" />
  );

const ScorePanel: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  score: V3ScoreResult | StoredWorkScore | null;
  highlightFlags?: string[];
}> = ({ title, subtitle, icon, score, highlightFlags = [] }) => {
  const barColor = !score ? '' : score.risk_score >= 70 ? 'bg-[#F04438]' : score.risk_score >= 45 ? 'bg-[#F79009]' : 'bg-[#12B76A]';
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
      <div className="flex items-center space-x-2 pb-3 border-b border-[#F0F2F5] mb-4">
        {icon}
        <div>
          <h3 className="text-base font-bold text-[#12355B]">{title}</h3>
          <p className="text-[11px] text-[#667085]">{subtitle}</p>
        </div>
      </div>

      {!score ? (
        <p className="text-sm text-[#667085] py-6 text-center">No stored score for this work.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-end justify-between mb-2">
              <p className="text-4xl font-bold text-[#12355B] leading-none">
                {score.risk_score}<span className="text-lg text-[#667085] font-semibold">/100</span>
              </p>
              <SeverityChip score={score.risk_score} severity={score.severity} />
            </div>
            <div className="h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, score.risk_score))}%` }} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2 flex items-center">
              <Flag className="w-3.5 h-3.5 mr-1" /> Flags ({score.flags.length})
            </p>
            {score.flags.length === 0 ? (
              <p className="text-sm text-[#027A48] bg-emerald-50 border border-[#12B76A] rounded-md px-3 py-2">No flags raised.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {score.flags.map(flag => (
                  <span
                    key={flag}
                    title={flag}
                    className={`text-xs font-semibold px-2 py-1 rounded border ${
                      highlightFlags.includes(flag)
                        ? 'bg-purple-50 border-purple-300 text-purple-700'
                        : 'bg-[#FFFAEB] border-[#FEC84B] text-[#B54708]'
                    }`}
                  >
                    {FLAG_INFO[flag] || flag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {score.reasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-1">Reasons</p>
              <ul className="list-disc pl-4 space-y-1 text-sm text-[#344054]">
                {score.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-3 border-t border-[#F0F2F5]">
            <dt className="text-[#667085]">ML anomaly score</dt>
            <dd className="font-mono text-[#12355B] text-right">{score.ml_anomaly_score ?? '—'}</dd>
            <dt className="text-[#667085]">Delay risk</dt>
            <dd className="font-mono text-[#12355B] text-right">{score.delay_risk ?? '—'}</dd>
            <dt className="text-[#667085]">As of</dt>
            <dd className="font-mono text-[#12355B] text-right">{score.as_of}</dd>
            <dt className="text-[#667085]">Model version</dt>
            <dd className="font-mono text-[#12355B] text-right">{score.model_version}</dd>
          </dl>
        </div>
      )}
    </div>
  );
};

export const MLTesterPage: React.FC = () => {
  const [workId, setWorkId] = useState(PRESETS[0].workId);
  const [useStoredAsOf, setUseStoredAsOf] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<RefusalBody | null>(null);
  const [response, setResponse] = useState<MLTesterResponse | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);

  const runScore = async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setWorkId(trimmed);
    setLoading(true);
    setError(null);
    setRefusal(null);
    setResponse(null);
    try {
      const res = await fetch('/api/ml/test-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_id: trimmed, as_of_mode: useStoredAsOf ? 'stored' : 'service' })
      });
      const data = await res.json();
      if (res.status === 422) {
        setRefusal(data);
        return;
      }
      if (!res.ok) throw new Error(data.error || `Request failed with HTTP ${res.status}`);
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to reach the ML service.');
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/projects?q=${encodeURIComponent(searchTerm.trim())}&limit=8`);
      const data = await res.json();
      setHits(res.ok ? data.data || [] : []);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const cmp = response?.comparison;

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'ML Model Tester' }]}
        contextDescription="Score a real eSAKSHI work live against the v3 ML service and compare it with the stored work_scores result."
      />

      <main className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Work selection */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#12355B]">Select a work</h3>
            <p className="text-xs text-[#667085]">
              The request is built only from the work's stored row. Fields missing in eSAKSHI are sent as empty, never
              filled in, and nothing is saved: work_scores is never modified.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.workId}
                type="button"
                onClick={() => runScore(preset.workId)}
                disabled={loading}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors disabled:opacity-60 ${
                  workId === preset.workId
                    ? 'bg-[#1D4E89] text-white border-[#1D4E89]'
                    : 'bg-[#EAF2F8] text-[#1D4E89] border-[#D0E2EC] hover:bg-[#D0E2EC]'
                }`}
                title={preset.workId}
              >
                {preset.label} <span className="font-mono opacity-75">({preset.workId})</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form
              onSubmit={e => { e.preventDefault(); runScore(workId); }}
              className="space-y-2"
            >
              <label className={labelClass} htmlFor="work_id">Work ID <span className="font-normal text-[#667085]">(house-work_id, e.g. LS-195388)</span></label>
              <div className="flex gap-2">
                <input id="work_id" className={`${inputClass} font-mono`} value={workId} onChange={e => setWorkId(e.target.value)} />
                <button
                  type="submit"
                  disabled={loading || !workId.trim()}
                  className="px-4 py-2 bg-[#1D4E89] hover:bg-[#12355B] disabled:opacity-60 text-white rounded-md text-sm font-semibold flex items-center space-x-2 whitespace-nowrap"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  <span>{loading ? 'Scoring...' : 'Score live'}</span>
                </button>
              </div>
              <label className="flex items-center space-x-2 text-xs text-[#344054] cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#1D4E89]" checked={useStoredAsOf} onChange={e => setUseStoredAsOf(e.target.checked)} />
                <span>Score as of the stored score's date (as_of), so live and stored results are directly comparable</span>
              </label>
            </form>

            <div className="space-y-2">
              <form onSubmit={runSearch}>
                <label className={labelClass} htmlFor="work_search">Find a work</label>
                <div className="flex gap-2">
                  <input
                    id="work_search"
                    className={inputClass}
                    placeholder="Description, MP, constituency or IDA"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <button type="submit" disabled={searching} className="px-3 py-2 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#475467] rounded-md border border-[#D0D5DD] disabled:opacity-60">
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </form>
              {hits.length > 0 && (
                <ul className="border border-[#E5E7EB] rounded-md divide-y divide-[#F0F2F5] max-h-56 overflow-y-auto">
                  {hits.map(h => (
                    <li key={h.project_id}>
                      <button
                        type="button"
                        onClick={() => runScore(h.project_id)}
                        className="w-full text-left px-3 py-2 hover:bg-[#F9FAFB] text-xs"
                      >
                        <span className="font-mono font-bold text-[#1D4E89] mr-2">{h.project_id}</span>
                        <span className="text-[#263238]">{h.project_name || '—'}</span>
                        <span className="block text-[11px] text-[#667085]">
                          {h.mp_name} · {h.state} · stored: {h.risk_score ?? '—'} ({h.severity ?? 'unscored'})
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-10 text-center shadow-xs">
            <Loader2 className="w-8 h-8 animate-spin text-[#1D4E89] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#12355B]">Calling the v3 ML service...</p>
            <p className="text-xs text-[#667085] mt-1">If the Render service was idle, the first request can take up to a minute while it wakes up.</p>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 bg-red-50 border border-[#F04438] rounded-md flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#D92D20] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#D92D20]">Scoring failed</p>
              <p className="text-xs text-[#B42318] mt-0.5 break-words">{error}</p>
            </div>
          </div>
        )}

        {!loading && refusal && (
          <div className="p-4 bg-amber-50 border border-[#F79009] rounded-md flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#B54708] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#B54708]">Not sent to the ML service</p>
              <p className="text-xs text-[#93370D] mt-0.5 break-words">{refusal.error}</p>
              {refusal.missing && refusal.missing.length > 0 && (
                <p className="text-xs text-[#93370D] mt-1">
                  Empty in the stored work: <span className="font-mono">{refusal.missing.join(', ')}</span>. Values are never filled in or defaulted.
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && response && (
          <>
            {/* Work summary + comparison */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-bold text-[#1D4E89] bg-[#EAF2F8] px-2.5 py-0.5 rounded">{response.work_id}</span>
                  <h2 className="text-base font-bold text-[#12355B] mt-2">{response.work.work_description || response.work.activity_type}</h2>
                  <p className="text-xs text-[#667085] mt-0.5">
                    {response.work.mp_name} · {response.work.constituency} · {response.work.state} · Stage: {response.work.stage ?? '—'}
                    {response.work.is_completed ? ' · Completed' : ''}
                  </p>
                </div>
                {cmp && response.stored && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:text-right">
                    <span className="text-[#667085]">Risk score change</span>
                    <span className={`font-mono font-bold ${cmp.risk_score_delta === 0 ? 'text-[#027A48]' : 'text-[#B54708]'}`}>
                      {cmp.risk_score_delta !== null && cmp.risk_score_delta > 0 ? '+' : ''}{cmp.risk_score_delta}
                    </span>
                    <span className="text-[#667085]">Severity</span>
                    <span className={`font-semibold ${cmp.severity_match ? 'text-[#027A48]' : 'text-[#B54708]'}`}>
                      {cmp.severity_match ? 'Matches' : 'Differs'}
                    </span>
                    <span className="text-[#667085]">Flags only in live</span>
                    <span className="font-mono">{cmp.flags_only_live.join(', ') || '—'}</span>
                    <span className="text-[#667085]">Flags only in stored</span>
                    <span className="font-mono">{cmp.flags_only_stored.join(', ') || '—'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScorePanel
                title="Live score"
                subtitle="Fresh result from the v3 ML service POST /score (not saved)"
                icon={<Radio className="w-4 h-4 text-purple-700" />}
                score={response.live}
                highlightFlags={cmp?.flags_only_live}
              />
              <ScorePanel
                title="Stored score"
                subtitle="Batch result in Supabase work_scores for the same work"
                icon={<Database className="w-4 h-4 text-[#1D4E89]" />}
                score={response.stored}
                highlightFlags={cmp?.flags_only_stored}
              />
            </div>

            <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#667085]">
                <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {response.latency_ms} ms from v3 /score</span>
                <button
                  type="button"
                  onClick={() => setShowPayload(v => !v)}
                  className="flex items-center font-semibold text-[#1D4E89] hover:underline"
                >
                  <Code2 className="w-3.5 h-3.5 mr-1" />
                  {showPayload ? 'Hide' : 'Show'} raw request/response
                </button>
              </div>
              {showPayload && (
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[#475467] mb-1">Sent to ML service (from the stored works row)</p>
                    <pre className="text-[11px] bg-[#101828] text-[#D0D5DD] rounded-md p-3 overflow-x-auto">{JSON.stringify(response.request, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#475467] mb-1">Returned by ML service (including features)</p>
                    <pre className="text-[11px] bg-[#101828] text-[#D0D5DD] rounded-md p-3 overflow-x-auto">{JSON.stringify(response.live, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!loading && !error && !refusal && !response && (
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-10 text-center text-sm text-[#667085] shadow-xs">
            <Cpu className="w-6 h-6 text-purple-700 mx-auto mb-2" />
            Choose an example or enter a work ID, then select <span className="font-semibold">Score live</span>.
          </div>
        )}
      </main>
    </div>
  );
};
