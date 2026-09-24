import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Info, 
  Calendar, 
  MapPin, 
  Filter, 
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  Search,
  Layers,
  PieChart as PieChartIcon,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart,
  Pie,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Cell,
  Legend
} from 'recharts';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { KpiStatCard } from '../components/KpiStatCard';
import { LoadingState, ErrorState } from '../components/StateComponents';

interface MonthlyTrendItem {
  month: string;
  monthKey: string;
  expenditure: number;
  sanctioned: number;
  cumulativeExpenditure?: number;
  cumulativeSanctioned?: number;
  flaggedAnomalies: number;
  completedProjects: number;
  transactionCount: number;
  utilizationRate: number;
}

interface StateBenchmarkItem {
  state: string;
  state_utilization: number;
  national_avg: number;
  difference: number;
  status: 'above' | 'below' | 'equal';
  provenance: string;
}

interface RiskDistributionItem {
  name: string;
  count: number;
  percentage: number;
  amount: number;
  fill: string;
}

interface DistrictExpenditureItem {
  district: string;
  state: string;
  sanctioned: number;
  expenditure: number;
  projectCount: number;
  flaggedCount: number;
  utilizationRate: number;
}

interface TrendApiResponse {
  kpis: {
    totalSanctioned: number;
    totalExpenditure: number;
    overallUtilization: number;
    nationalAvgBenchmark: number;
    totalFlaggedAnomalies: number;
    totalProjectsMonitored: number;
    statesAboveBenchmark: number;
    statesBelowBenchmark: number;
    statesEqualBenchmark: number;
    totalStatesCount: number;
  };
  monthlyTrends: MonthlyTrendItem[];
  stateBenchmarks: StateBenchmarkItem[];
  riskDistribution: RiskDistributionItem[];
  districtExpenditures: DistrictExpenditureItem[];
  provenance: {
    benchmarks: string;
    projects: string;
    transactions: string;
  };
}

export const TrendAnalysisPage: React.FC = () => {
  const [data, setData] = useState<TrendApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State comparison filters
  const [stateViewMode, setStateViewMode] = useState<'top10' | 'bottom10' | 'all'>('top10');
  const [stateSearch, setStateSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'above' | 'below'>('all');

  // District filter
  const [districtSearch, setDistrictSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/trend-analysis');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json: TrendApiResponse = await res.json();
      setData(json);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load trend analysis data:', err);
      setError('Unable to load current data.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen">
        <BreadcrumbContextStrip
          items={[{ label: 'Trend Analysis & Statistical Benchmarking' }]}
          contextDescription="Longitudinal utilization dynamics, multi-year expenditure velocity, and state-by-state comparisons."
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <LoadingState message="Aggregating scheme disbursements, monthly anomalies, and ML benchmarks..." />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen">
        <BreadcrumbContextStrip
          items={[{ label: 'Trend Analysis & Statistical Benchmarking' }]}
          contextDescription="Longitudinal utilization dynamics, multi-year expenditure velocity, and state-by-state comparisons."
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <ErrorState message={error || 'Unable to load current data.'} onRetry={loadData} />
        </div>
      </div>
    );
  }

  const { kpis, monthlyTrends, stateBenchmarks, riskDistribution, districtExpenditures, provenance } = data;

  // Filter state benchmarks for the chart according to active view mode
  const sortedStates = [...stateBenchmarks].sort((a, b) => b.state_utilization - a.state_utilization);
  let chartStates: StateBenchmarkItem[] = [];
  if (stateViewMode === 'top10') {
    chartStates = sortedStates.slice(0, 10);
  } else if (stateViewMode === 'bottom10') {
    chartStates = sortedStates.slice(-10).reverse();
  } else {
    chartStates = sortedStates;
  }

  // Filter state benchmarks for the full table
  const filteredTableStates = stateBenchmarks.filter(s => {
    const matchesSearch = s.state.toLowerCase().includes(stateSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter district expenditures
  const filteredDistricts = districtExpenditures.filter(d => 
    d.district.toLowerCase().includes(districtSearch.toLowerCase()) ||
    d.state.toLowerCase().includes(districtSearch.toLowerCase())
  );

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'Trend Analysis & Statistical Benchmarking' }]}
        contextDescription="Longitudinal disbursement velocities, monthly anomaly detections, ML benchmark comparisons, and district-level fund dynamics."
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top KPI Cards in 12-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiStatCard
            title="Total Monitored Sanctions"
            primaryValue={`₹${(kpis.totalSanctioned / 10000000).toFixed(2)} Cr`}
            subtitle={`${kpis.totalProjectsMonitored} registered works`}
            bandColor="navy"
            secondaryRows={[
              { label: 'States & UTs Covered', value: `${kpis.totalStatesCount}` },
              { label: 'Data Source', value: provenance.projects }
            ]}
          />

          <KpiStatCard
            title="Cumulative Expenditure"
            primaryValue={`₹${(kpis.totalExpenditure / 10000000).toFixed(2)} Cr`}
            subtitle={`Overall Realization: ${kpis.overallUtilization}%`}
            bandColor="deepBlue"
            secondaryRows={[
              { label: 'Disbursement Ledger', value: 'Audited PFMS' },
              { label: 'Realized Rate', value: `${kpis.overallUtilization}%` }
            ]}
          />

          <KpiStatCard
            title="National Avg Benchmark"
            primaryValue={`${kpis.nationalAvgBenchmark}%`}
            subtitle={`${kpis.statesAboveBenchmark} States Above | ${kpis.statesBelowBenchmark} Below`}
            bandColor="navy"
            secondaryRows={[
              { label: 'Source', value: provenance.benchmarks },
              { label: 'Baseline Type', value: 'Contextual Baseline' }
            ]}
          />

          <KpiStatCard
            title="Flagged Anomalies"
            primaryValue={`${kpis.totalFlaggedAnomalies}`}
            subtitle="Works requiring nodal verification"
            bandColor={kpis.totalFlaggedAnomalies > 0 ? "red" : "navy"}
            secondaryRows={[
              { label: 'High Severity Works', value: `${riskDistribution.find(r => r.name === 'High Risk')?.count || 0}` },
              { label: 'Medium Severity', value: `${riskDistribution.find(r => r.name === 'Medium Risk')?.count || 0}` }
            ]}
          />
        </div>

        {/* Row 1: Expenditure Over Time & Monthly Flagged Anomalies */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Expenditure Over Time Line Chart (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#12355B]">
                    Monthly Expenditure Over Time (₹ Lakhs)
                  </h3>
                  <p className="text-xs text-[#667085]">
                    Actual disbursements realized per month through treasury / PFMS.
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-[#EAF2F8] text-[#1D4E89] px-2 py-0.5 rounded font-semibold border border-[#1D4E89]/20">
                  PFMS Verified
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrends} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475467' }} angle={-25} textAnchor="end" />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#475467' }} 
                      tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} 
                    />
                    <Tooltip
                      formatter={(val: any) => [`₹${(Number(val) / 100000).toFixed(2)} Lakhs`, 'Monthly Disbursement']}
                      contentStyle={{
                        backgroundColor: '#12355B',
                        color: '#fff',
                        borderRadius: '6px',
                        fontSize: '11px',
                        border: 'none'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenditure"
                      name="Expenditure"
                      stroke="#1D4E89"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#12355B' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0F2F5] flex items-center justify-between text-[11px] text-[#667085]">
              <span>Data provenance: {provenance.transactions}</span>
              <span className="font-medium text-[#12355B]">Monthly Financial Run-Rate</span>
            </div>
          </div>

          {/* Monthly Flagged Anomaly Bar Chart (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#12355B]">
                    Monthly Flagged Anomalies & Irregularities
                  </h3>
                  <p className="text-xs text-[#667085]">
                    Items flagged for inspection by machine learning inference or rules.
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-red-50 text-[#D92D20] px-2 py-0.5 rounded font-semibold border border-red-200">
                  Risk Signal
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrends} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475467' }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#475467' }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(217, 45, 32, 0.06)' }}
                      formatter={(val: any) => [`${Number(val || 0)} works / transactions`, 'Flagged']}
                      labelFormatter={(lbl) => `Month: ${lbl}`}
                      contentStyle={{
                        backgroundColor: '#12355B',
                        color: '#fff',
                        borderRadius: '6px',
                        fontSize: '11px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="flaggedAnomalies" 
                      name="Flagged Items" 
                      fill="#D92D20" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                      activeBar={false}
                    >
                      {monthlyTrends.map((entry, index) => (
                        <Cell 
                          key={`anomaly-cell-${index}`} 
                          fill={entry.flaggedAnomalies > 4 ? '#D92D20' : '#F79009'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0F2F5] flex items-center justify-between text-[11px] text-[#667085]">
              <span>Data provenance: ML Pipeline Detection Stream</span>
              <span className="font-semibold text-amber-800">Red: High Vol. | Amber: Moderate</span>
            </div>
          </div>
        </div>

        {/* Row 2: Utilization Rate Trend vs Risk Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Utilization Rate Trend Line Chart (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#12355B]">
                    Cumulative Utilization Rate Trend vs. National Benchmark
                  </h3>
                  <p className="text-xs text-[#667085]">
                    Progression of realized fund execution compared against the 54.7% national baseline.
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 bg-[#12355B] rounded-full"></span>
                    <span className="text-[#344054]">Utilization</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-3 h-0.5 bg-[#D92D20] inline-block"></span>
                    <span className="text-[#D92D20] font-semibold">54.7% Baseline</span>
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrends} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475467' }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#475467' }} tickFormatter={v => `${v}%`} domain={[45, 80]} />
                    <Tooltip
                      formatter={(val: any, name: any, item: any) => {
                        const payload = item?.payload;
                        const cumExp = payload?.cumulativeExpenditure;
                        const cumSanc = payload?.cumulativeSanctioned;
                        const detail = cumExp && cumSanc 
                          ? ` (₹${(cumExp / 10000000).toFixed(1)} Cr / ₹${(cumSanc / 10000000).toFixed(1)} Cr)` 
                          : '';
                        return [`${val}%${detail}`, 'Cumulative Utilization'];
                      }}
                      contentStyle={{
                        backgroundColor: '#12355B',
                        color: '#fff',
                        borderRadius: '6px',
                        fontSize: '11px',
                        border: 'none'
                      }}
                    />
                    <ReferenceLine
                      y={54.7}
                      stroke="#D92D20"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{ value: 'National Baseline (54.7%)', position: 'top', fill: '#D92D20', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="utilizationRate"
                      name="Utilization Rate"
                      stroke="#12355B"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#1D4E89' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0F2F5] text-[11px] text-[#667085] flex items-center justify-between">
              <span>* Running cumulative disbursements ÷ running cumulative sanctions through each month</span>
              <span className="font-semibold text-[#12355B]">Sample Final: 64.9% (3,364 works)</span>
            </div>
          </div>

          {/* Risk Distribution Visualization (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#12355B]">
                    Project Portfolio Risk Distribution
                  </h3>
                  <p className="text-xs text-[#667085]">
                    Risk scoring segmentation across all monitored projects.
                  </p>
                </div>
                <PieChartIcon className="w-4 h-4 text-[#1D4E89]" />
              </div>

              {/* Summary Cards of Risk Breakdown */}
              <div className="space-y-3 pt-1">
                {riskDistribution.map(item => (
                  <div key={item.name} className="p-3 rounded-md border border-[#E5E7EB] bg-[#F5F7FA] flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span 
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.fill }}
                      />
                      <div>
                        <span className="text-xs font-bold text-[#12355B]">{item.name}</span>
                        <p className="text-[10px] text-[#667085]">
                          {item.count} projects ({item.percentage}%)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-[#12355B]">
                        ₹{(item.amount / 10000000).toFixed(2)} Cr
                      </span>
                      <span className="block text-[10px] text-[#667085]">Allocated</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-2.5 bg-[#EAF2F8] rounded-md border border-[#1D4E89]/20 text-[11px] text-[#1D4E89]">
                <strong>Color Policy:</strong> Green denotes verified low-risk; Amber indicates pending inspection; Red requires high-priority vigilance audit.
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0F2F5] text-[11px] text-[#667085]">
              Data provenance: Machine Learning Risk Assessment Model
            </div>
          </div>
        </div>

        {/* Row 3: State Utilization vs National Average Comparison (Requirement 3) */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-3 border-b border-[#F0F2F5] mb-4 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-[#12355B]">
                  State Utilization Rate vs. National Average Comparison
                </h3>
                <span className="text-[10px] font-mono bg-[#EAF2F8] text-[#1D4E89] px-2 py-0.5 rounded font-semibold border border-[#1D4E89]/20">
                  {stateBenchmarks.length} States &amp; UTs
                </span>
              </div>
              <p className="text-xs text-[#667085]">
                {provenance.benchmarks} — Benchmark derived from the project ML dataset.
              </p>
            </div>

            {/* Controls: Top 10, Bottom 10, All States View Tabs */}
            <div className="flex items-center space-x-1.5 bg-[#F5F7FA] p-1 rounded-md border border-[#E5E7EB]">
              <button
                onClick={() => setStateViewMode('top10')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  stateViewMode === 'top10'
                    ? 'bg-[#12355B] text-white shadow-2xs'
                    : 'text-[#475467] hover:text-[#12355B]'
                }`}
              >
                Top 10 States
              </button>
              <button
                onClick={() => setStateViewMode('bottom10')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  stateViewMode === 'bottom10'
                    ? 'bg-[#12355B] text-white shadow-2xs'
                    : 'text-[#475467] hover:text-[#12355B]'
                }`}
              >
                Bottom 10 States
              </button>
              <button
                onClick={() => setStateViewMode('all')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  stateViewMode === 'all'
                    ? 'bg-[#12355B] text-white shadow-2xs'
                    : 'text-[#475467] hover:text-[#12355B]'
                }`}
              >
                All States &amp; UTs ({stateBenchmarks.length})
              </button>
            </div>
          </div>

          {/* Contextual Warning Strip (Strictly Contextual Benchmark, Not Risk Signal) */}
          <div className="mb-4 p-2.5 bg-[#F5F7FA] border border-[#E5E7EB] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 text-[#475467]">
              <Info className="w-4 h-4 text-[#1D4E89] flex-shrink-0" />
              <span>
                <strong>Contextual Benchmark (Not a Risk Signal):</strong> State utilization measures administrative spending velocity against baseline, not fraud.
              </span>
            </div>
            <div className="flex items-center space-x-3 text-[11px] font-medium flex-shrink-0">
              <span className="flex items-center space-x-1">
                <span className="w-3 h-3 bg-[#12355B] rounded-xs inline-block"></span>
                <span>Above Benchmark</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-3 h-3 bg-[#667085] rounded-xs inline-block"></span>
                <span>Below Benchmark</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-3 h-0.5 bg-[#D92D20] inline-block"></span>
                <span className="text-[#D92D20] font-semibold">54.7% Nat. Avg</span>
              </span>
            </div>
          </div>

          {/* Bar Chart of Selected States */}
          <div className={`w-full ${stateViewMode === 'all' ? 'h-96' : 'h-72'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartStates} margin={{ top: 20, right: 15, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="state" 
                  tick={{ fontSize: 10, fill: '#475467' }} 
                  angle={-35} 
                  textAnchor="end"
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#475467' }} 
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`} 
                  domain={[0, 0.9]} 
                />
                <Tooltip
                  cursor={{ fill: 'rgba(18, 53, 91, 0.05)' }}
                  formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`, 'Utilization Rate']}
                  labelFormatter={(lbl) => `State/UT: ${lbl}`}
                  contentStyle={{
                    backgroundColor: '#12355B',
                    color: '#fff',
                    borderRadius: '6px',
                    fontSize: '11px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <ReferenceLine
                  y={0.547}
                  stroke="#D92D20"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{ value: 'National Average: 54.7%', position: 'top', fill: '#D92D20', fontSize: 10, fontWeight: 'bold' }}
                />
                <Bar 
                  dataKey="state_utilization" 
                  name="Utilization Rate"
                  radius={[3, 3, 0, 0]} 
                  maxBarSize={stateViewMode === 'all' ? 18 : 34}
                  activeBar={false}
                >
                  {chartStates.map((entry, index) => (
                    <Cell
                      key={`state-cell-${index}`}
                      fill={entry.state_utilization >= 0.547 ? '#12355B' : '#667085'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[#F0F2F5] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#667085]">
            <span>
              Showing {chartStates.length} of {stateBenchmarks.length} States &amp; UTs in active chart view.
            </span>
            <span className="font-medium text-[#12355B]">
              Data Provenance: {provenance.benchmarks}
            </span>
          </div>
        </div>

        {/* Row 4: Full Searchable States & UTs Table (Requirement 3 & 4) */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#F0F2F5] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-[#12355B]">
                  All States &amp; Union Territories Benchmark Registry
                </h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                  Complete 36 State/UT Dataset
                </span>
              </div>
              <p className="text-xs text-[#667085]">
                Full breakdown comparing every state against the national baseline with variance calculation.
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center bg-[#F5F7FA] p-0.5 rounded-md border border-[#D0D5DD] text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    statusFilter === 'all' ? 'bg-[#12355B] text-white' : 'text-[#475467]'
                  }`}
                >
                  All ({stateBenchmarks.length})
                </button>
                <button
                  onClick={() => setStatusFilter('above')}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    statusFilter === 'above' ? 'bg-[#12355B] text-white' : 'text-[#475467]'
                  }`}
                >
                  Above ({kpis.statesAboveBenchmark})
                </button>
                <button
                  onClick={() => setStatusFilter('below')}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    statusFilter === 'below' ? 'bg-[#12355B] text-white' : 'text-[#475467]'
                  }`}
                >
                  Below ({kpis.statesBelowBenchmark})
                </button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={stateSearch}
                  onChange={e => setStateSearch(e.target.value)}
                  placeholder="Search state/UT..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F5F7FA] border border-[#D0D5DD] rounded-md focus:outline-hidden focus:bg-white focus:border-[#12355B]"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] text-[#667085] font-semibold border-b border-[#E5E7EB] uppercase text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">State / Union Territory</th>
                  <th className="py-2.5 px-4 text-right">State Utilization</th>
                  <th className="py-2.5 px-4 text-right">National Baseline</th>
                  <th className="py-2.5 px-4 text-right">Variance</th>
                  <th className="py-2.5 px-4">Benchmark Status</th>
                  <th className="py-2.5 px-4">Data Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F5] text-[#263238]">
                {filteredTableStates.length > 0 ? (
                  filteredTableStates.map(s => {
                    const ratePct = (s.state_utilization * 100).toFixed(1);
                    const diffPct = ((s.state_utilization - s.national_avg) * 100).toFixed(1);
                    const isAbove = s.state_utilization >= s.national_avg;

                    return (
                      <tr key={s.state} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-2.5 px-4 font-bold text-[#12355B]">{s.state}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#12355B]">
                          {ratePct}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[#667085]">
                          {(s.national_avg * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold">
                          <span className={isAbove ? 'text-emerald-700' : 'text-amber-700'}>
                            {isAbove ? `+${diffPct}%` : `${diffPct}%`}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isAbove 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {isAbove ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span>{isAbove ? 'Above Benchmark' : 'Below Benchmark'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-[10px] text-[#667085] font-mono">
                          {s.provenance}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-[#667085]">
                      No states match the search criteria &ldquo;{stateSearch}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#F5F7FA] border-t border-[#E5E7EB] flex items-center justify-between text-[11px] text-[#667085]">
            <span>Showing {filteredTableStates.length} of {stateBenchmarks.length} States and Union Territories</span>
            <span className="font-semibold text-[#12355B]">Dataset: Official ML Model Benchmark Artifact</span>
          </div>
        </div>

        {/* Row 5: District Expenditure Breakdown (Requirement 2) */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#F0F2F5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#12355B]">
                District Expenditure &amp; Implementation Register
              </h3>
              <p className="text-xs text-[#667085]">
                District-level expenditure performance, project counts, and anomaly counts across states.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={districtSearch}
                onChange={e => setDistrictSearch(e.target.value)}
                placeholder="Search district or state..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F5F7FA] border border-[#D0D5DD] rounded-md focus:outline-hidden focus:bg-white focus:border-[#12355B]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] text-[#667085] font-semibold border-b border-[#E5E7EB] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">District</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4 text-right">Sanctioned</th>
                  <th className="py-2.5 px-4 text-right">Actual Expenditure</th>
                  <th className="py-2.5 px-4">Utilization</th>
                  <th className="py-2.5 px-4 text-center">Projects</th>
                  <th className="py-2.5 px-4 text-center">Flagged Works</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F5] text-[#263238]">
                {filteredDistricts.length > 0 ? (
                  filteredDistricts.map(d => (
                    <tr key={`${d.district}-${d.state}`} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2.5 px-4 font-bold text-[#12355B]">{d.district}</td>
                      <td className="py-2.5 px-4 text-[#475467]">{d.state}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-[#1D4E89]">
                        ₹{(d.sanctioned / 10000000).toFixed(2)} Cr
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#12355B]">
                        ₹{(d.expenditure / 10000000).toFixed(2)} Cr
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-mono text-[#12355B] w-10 text-right">
                            {d.utilizationRate}%
                          </span>
                          <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${d.utilizationRate >= 54.7 ? 'bg-[#12355B]' : 'bg-[#F79009]'}`}
                              style={{ width: `${Math.min(100, d.utilizationRate)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono">
                        {d.projectCount}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono">
                        {d.flaggedCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 bg-red-100 text-[#D92D20] font-bold rounded text-[10px]">
                            {d.flaggedCount}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-[#027A48] font-bold rounded text-[10px]">
                            0
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-[#667085]">
                      No districts match the search term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#F5F7FA] border-t border-[#E5E7EB] flex items-center justify-between text-[11px] text-[#667085]">
            <span>Data source: Audited Project Master Records</span>
            <span className="font-medium text-[#12355B]">District Portfolios Monitored</span>
          </div>
        </div>
      </main>
    </div>
  );
};

