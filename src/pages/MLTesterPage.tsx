import React, { useState } from 'react';
import { Cpu, Play, RotateCcw, Loader2, AlertTriangle, Flag, Clock, Code2 } from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { RiskBadge } from '../components/RiskBadge';
import { MLScoreResult } from '../types';

interface TestForm {
  state: string;
  work_category: string;
  mp_name: string;
  sanctioned_amount: string;
  actual_expenditure: string;
  start_date: string;
  expected_completion: string;
  actual_completion: string;
  status: string;
  has_tender_on_file: boolean;
  has_mp_recommendation: boolean;
}

interface TestResponse {
  result: MLScoreResult;
  payload: Record<string, unknown>;
  latency_ms: number;
}

const STATES = [
  'Andaman And Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu And Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal'
];

const CATEGORIES = [
  'Railways, Roads, Pathways & Bridges', 'Drinking Water Facility', 'Sanitation & Public Health',
  'Education', 'Other Public Facilities', 'Others'
];

const STATUSES = ['Not Started', 'In Progress', 'Stalled', 'Completed'];

// What each flag returned by the ML service means
const FLAG_INFO: Record<string, { label: string; description: string }> = {
  delayed_stalled: {
    label: 'Delayed / Stalled',
    description: 'Work is past its expected completion date without being completed, or is marked stalled.'
  },
  cost_overrun: {
    label: 'Cost Overrun',
    description: 'Expenditure is high relative to the sanctioned amount or the progress of the work.'
  },
  ghost_project: {
    label: 'Ghost Project',
    description: 'Funds have been spent but the work is recorded as not started.'
  },
  no_tender_high_value: {
    label: 'No Tender (High Value)',
    description: 'Significant expenditure without a tender document on file.'
  },
  no_mp_recommendation: {
    label: 'No MP Recommendation',
    description: 'Project sanctioned without the statutory MP recommendation.'
  },
  statistical_anomaly: {
    label: 'Statistical Anomaly',
    description: 'Isolation Forest marked this record as an outlier compared with similar projects.'
  }
};

// Presets copied from real records in the MPLADS dataset, so each one reproduces a known model outcome
const PRESETS: Array<{ label: string; source: string; form: TestForm }> = [
  {
    label: 'Clean project',
    source: 'MPLADS-00001',
    form: {
      state: 'Maharashtra', work_category: 'Other Public Facilities', mp_name: 'Test MP',
      sanctioned_amount: '658000', actual_expenditure: '543900',
      start_date: '2024-10-16', expected_completion: '2025-01-19', actual_completion: '2025-03-17',
      status: 'Completed', has_tender_on_file: true, has_mp_recommendation: true
    }
  },
  {
    label: 'Delayed work',
    source: 'MPLADS-00002',
    form: {
      state: 'Maharashtra', work_category: 'Railways, Roads, Pathways & Bridges', mp_name: 'Test MP',
      sanctioned_amount: '514000', actual_expenditure: '301400',
      start_date: '2023-04-15', expected_completion: '2023-11-09', actual_completion: '',
      status: 'In Progress', has_tender_on_file: true, has_mp_recommendation: true
    }
  },
  {
    label: 'No tender',
    source: 'MPLADS-00144',
    form: {
      state: 'Andhra Pradesh', work_category: 'Railways, Roads, Pathways & Bridges', mp_name: 'Test MP',
      sanctioned_amount: '499000', actual_expenditure: '409900',
      start_date: '2024-06-30', expected_completion: '2024-11-28', actual_completion: '2024-12-20',
      status: 'Completed', has_tender_on_file: false, has_mp_recommendation: true
    }
  },
  {
    label: 'No MP recommendation',
    source: 'MPLADS-00038',
    form: {
      state: 'West Bengal', work_category: 'Drinking Water Facility', mp_name: 'Test MP',
      sanctioned_amount: '650000', actual_expenditure: '584600',
      start_date: '2023-12-05', expected_completion: '2024-08-13', actual_completion: '2024-07-27',
      status: 'Completed', has_tender_on_file: true, has_mp_recommendation: false
    }
  },
  {
    label: 'Ghost project',
    source: 'MPLADS-00039',
    form: {
      state: 'West Bengal', work_category: 'Other Public Facilities', mp_name: 'Test MP',
      sanctioned_amount: '550000', actual_expenditure: '510500',
      start_date: '2024-07-06', expected_completion: '2025-02-24', actual_completion: '2025-04-06',
      status: 'Not Started', has_tender_on_file: true, has_mp_recommendation: true
    }
  },
  {
    label: 'High risk (multiple flags)',
    source: 'MPLADS-00045',
    form: {
      state: 'Uttar Pradesh', work_category: 'Other Public Facilities', mp_name: 'Test MP',
      sanctioned_amount: '1121000', actual_expenditure: '1086400',
      start_date: '2024-03-29', expected_completion: '2024-11-09', actual_completion: '',
      status: 'Not Started', has_tender_on_file: true, has_mp_recommendation: true
    }
  }
];

const EMPTY_FORM: TestForm = {
  state: '', work_category: '', mp_name: '',
  sanctioned_amount: '', actual_expenditure: '',
  start_date: '', expected_completion: '', actual_completion: '',
  status: 'In Progress', has_tender_on_file: true, has_mp_recommendation: true
};

const inputClass =
  'w-full px-3 py-2 border border-[#D0D5DD] rounded-md text-sm text-[#263238] bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30 focus:border-[#1D4E89]';
const labelClass = 'block text-xs font-semibold text-[#344054] mb-1';

export const MLTesterPage: React.FC = () => {
  const [form, setForm] = useState<TestForm>(PRESETS[0].form);
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].label);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  const update = <K extends keyof TestForm>(key: K, value: TestForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setActivePreset(null);
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setForm(preset.form);
    setActivePreset(preset.label);
    setResponse(null);
    setError(null);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setActivePreset(null);
    setResponse(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch('/api/ml/test-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sanctioned_amount: Number(form.sanctioned_amount),
          actual_expenditure: Number(form.actual_expenditure),
          actual_completion: form.actual_completion || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed with HTTP ${res.status}`);
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to reach the ML service.');
    } finally {
      setLoading(false);
    }
  };

  // Input summary (computed from the form, not from the model)
  const sanctioned = Number(form.sanctioned_amount) || 0;
  const spent = Number(form.actual_expenditure) || 0;
  const utilization = sanctioned > 0 ? (spent / sanctioned) * 100 : 0;

  const result = response?.result;
  const score = result?.risk_score ?? 0;
  const barColor = score >= 70 ? 'bg-[#F04438]' : score >= 45 ? 'bg-[#F79009]' : 'bg-[#12B76A]';

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'ML Model Tester' }]}
        contextDescription="Enter project details and score them live against the Render-hosted anomaly detection model."
      />

      <main className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Presets */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
          <h3 className="text-base font-bold text-[#12355B]">Example scenarios</h3>
          <p className="text-xs text-[#667085] mb-3">
            Each example is copied from a real record in the MPLADS dataset. Pick one, then edit any field to see how the score changes.
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                  activePreset === preset.label
                    ? 'bg-[#1D4E89] text-white border-[#1D4E89]'
                    : 'bg-[#EAF2F8] text-[#1D4E89] border-[#D0E2EC] hover:bg-[#D0E2EC]'
                }`}
                title={`Based on ${preset.source}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Input form */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#12355B]">Project details</h3>
                <p className="text-xs text-[#667085]">Test inputs are only scored, never saved to the project database.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-[#F5F7FA] hover:bg-[#E5E7EB] text-[#475467] rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="state">State / UT *</label>
                <select id="state" required className={inputClass} value={form.state} onChange={e => update('state', e.target.value)}>
                  <option value="">Select state</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="work_category">Work category *</label>
                <select id="work_category" required className={inputClass} value={form.work_category} onChange={e => update('work_category', e.target.value)}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="sanctioned_amount">Sanctioned amount (₹) *</label>
                <input id="sanctioned_amount" type="number" min="1" step="1" required className={inputClass}
                  value={form.sanctioned_amount} onChange={e => update('sanctioned_amount', e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="actual_expenditure">Actual expenditure (₹) *</label>
                <input id="actual_expenditure" type="number" min="0" step="1" required className={inputClass}
                  value={form.actual_expenditure} onChange={e => update('actual_expenditure', e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="start_date">Start date *</label>
                <input id="start_date" type="date" required className={inputClass}
                  value={form.start_date} onChange={e => update('start_date', e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="expected_completion">Expected completion *</label>
                <input id="expected_completion" type="date" required className={inputClass}
                  value={form.expected_completion} onChange={e => update('expected_completion', e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="status">Status *</label>
                <select id="status" required className={inputClass} value={form.status} onChange={e => update('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="actual_completion">Actual completion <span className="font-normal text-[#667085]">(optional)</span></label>
                <input id="actual_completion" type="date" className={inputClass}
                  value={form.actual_completion} onChange={e => update('actual_completion', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="mp_name">MP name <span className="font-normal text-[#667085]">(optional)</span></label>
                <input id="mp_name" type="text" className={inputClass} placeholder="Test MP"
                  value={form.mp_name} onChange={e => update('mp_name', e.target.value)} />
              </div>
              <label className="flex items-center space-x-2 text-sm text-[#344054] cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#1D4E89]"
                  checked={form.has_tender_on_file} onChange={e => update('has_tender_on_file', e.target.checked)} />
                <span>Tender document on file</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-[#344054] cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#1D4E89]"
                  checked={form.has_mp_recommendation} onChange={e => update('has_mp_recommendation', e.target.checked)} />
                <span>MP recommendation received</span>
              </label>
            </div>

            <div className="mt-5 pt-4 border-t border-[#F0F2F5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-[#667085]">
                Fund utilization: <span className="font-semibold text-[#12355B]">{utilization.toFixed(1)}%</span> of sanctioned amount
              </p>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#1D4E89] hover:bg-[#12355B] disabled:opacity-60 text-white rounded-md text-sm font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{loading ? 'Scoring...' : 'Run anomaly check'}</span>
              </button>
            </div>
          </form>

          {/* Result panel */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
            <div className="flex items-center space-x-2 pb-3 border-b border-[#F0F2F5] mb-4">
              <Cpu className="w-4 h-4 text-purple-700" />
              <h3 className="text-base font-bold text-[#12355B]">Model output</h3>
            </div>

            {loading && (
              <div className="py-10 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1D4E89] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#12355B]">Calling the ML service...</p>
                <p className="text-xs text-[#667085] mt-1">
                  If the Render service was idle, the first request can take up to a minute while it wakes up.
                </p>
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

            {!loading && !error && !result && (
              <div className="py-10 text-center text-sm text-[#667085]">
                Fill in the form or choose an example, then select <span className="font-semibold">Run anomaly check</span>.
              </div>
            )}

            {!loading && result && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Risk score</p>
                      <p className="text-4xl font-bold text-[#12355B] leading-none mt-1">
                        {result.risk_score}<span className="text-lg text-[#667085] font-semibold">/100</span>
                      </p>
                    </div>
                    <RiskBadge severity={result.severity} size="md" />
                  </div>
                  <div className="h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2 flex items-center">
                    <Flag className="w-3.5 h-3.5 mr-1" /> Anomaly flags ({result.flags.length})
                  </p>
                  {result.flags.length === 0 ? (
                    <p className="text-sm text-[#027A48] bg-emerald-50 border border-[#12B76A] rounded-md px-3 py-2">
                      No anomaly flags raised.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {result.flags.map(flag => (
                        <li key={flag} className="px-3 py-2 bg-[#FFFAEB] border border-[#FEC84B] rounded-md">
                          <p className="text-sm font-semibold text-[#B54708]">{FLAG_INFO[flag]?.label || flag}</p>
                          {FLAG_INFO[flag] && <p className="text-xs text-[#475467] mt-0.5">{FLAG_INFO[flag].description}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-1">Model reason</p>
                  <p className="text-sm text-[#344054]">{result.reason}</p>
                </div>

                <div className="pt-3 border-t border-[#F0F2F5]">
                  <div className="flex items-center justify-between text-xs text-[#667085]">
                    <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {response!.latency_ms} ms from Render /score</span>
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
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-semibold text-[#475467]">Sent to ML service</p>
                      <pre className="text-[11px] bg-[#101828] text-[#D0D5DD] rounded-md p-3 overflow-x-auto">{JSON.stringify(response!.payload, null, 2)}</pre>
                      <p className="text-[11px] font-semibold text-[#475467]">Returned by ML service</p>
                      <pre className="text-[11px] bg-[#101828] text-[#D0D5DD] rounded-md p-3 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
