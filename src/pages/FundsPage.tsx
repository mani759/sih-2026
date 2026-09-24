import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  Landmark, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Download, 
  Search, 
  ArrowUpRight,
  ShieldCheck,
  Building
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { KpiStatCard } from '../components/KpiStatCard';
import { LoadingState, ErrorState } from '../components/StateComponents';

interface StateFundData {
  state: string;
  sanctionedCr: number;
  expenditureCr: number;
  utilizationRate: number;
  projectCount: number;
}

export const FundsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFunds, setStateFunds] = useState<StateFundData[]>([]);
  const [summary, setSummary] = useState<{
    totalSanctionedCr: number;
    totalExpenditureCr: number;
    nationalUtilizationRate: number;
    coveredStatesCount?: number;
    totalProjectsMonitored?: number;
    avgDelayDays?: number;
    transactionCount?: number;
    activeProjectsCount?: number;
  }>({
    totalSanctionedCr: 0,
    totalExpenditureCr: 0,
    nationalUtilizationRate: 0,
    coveredStatesCount: 36,
    totalProjectsMonitored: 3364
  });

  useEffect(() => {
    let isMounted = true;
    async function loadFunds() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/funds');
        if (!res.ok) throw new Error('Failed to fetch funds ledger from server');
        const data = await res.json();
        if (isMounted) {
          if (data.stateDistribution && Array.isArray(data.stateDistribution)) {
            setStateFunds(data.stateDistribution);
          }
          if (data.summary) {
            setSummary(data.summary);
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(err);
          setError('Unable to load current data from financial ledger.');
          setLoading(false);
        }
      }
    }
    loadFunds();
    return () => { isMounted = false; };
  }, []);

  const filteredStates = stateFunds.filter(s =>
    s.state.toLowerCase().includes(search.toLowerCase())
  );

  const totalSanctioned = summary.totalSanctionedCr || stateFunds.reduce((acc, s) => acc + (s.sanctionedCr || 0), 0);
  const totalExpenditure = summary.totalExpenditureCr || stateFunds.reduce((acc, s) => acc + (s.expenditureCr || 0), 0);
  const utilizationRate = summary.nationalUtilizationRate || (totalSanctioned > 0 ? (totalExpenditure / totalSanctioned) * 100 : 0);

  const chartData = stateFunds.slice(0, 10).map(s => ({
    name: s.state,
    sanctioned: s.sanctionedCr,
    expenditure: s.expenditureCr
  }));

  if (loading) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen">
        <BreadcrumbContextStrip
          items={[{ label: 'National & State Funds Ledger' }]}
          contextDescription="Financial sanctions and actual expenditures across monitored states and districts (3,364 sample works)."
          badge="Audited Sample (3,364 Works)"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <LoadingState message="Retrieving verified financial allocations from project registry..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen">
        <BreadcrumbContextStrip
          items={[{ label: 'National & State Funds Ledger' }]}
          contextDescription="Financial sanctions and actual expenditures across monitored states and districts (3,364 sample works)."
          badge="Audited Sample (3,364 Works)"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'National & State Funds Ledger' }]}
        contextDescription="Financial sanctions and actual expenditures across monitored states and districts (3,364 sample works)."
        badge="Audited Sample (3,364 Works)"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sample Scope Disclosure Notice */}
        <div className="bg-[#EBF1F6] border border-[#12355B]/20 rounded-lg p-3 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#12355B]">
          <div className="flex items-center space-x-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-[#12355B] text-white px-2 py-0.5 rounded">
              Audited Sample Scope
            </span>
            <span>
              This register reflects the <strong>monitored project sample</strong> ({summary.totalProjectsMonitored ?? '3,364'} works across all 36 States & UTs) rather than total national statutory entitlement.
            </span>
          </div>
          <span className="text-[11px] text-[#475467] font-medium shrink-0">
            Source: GROUP BY state on projects registry
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiStatCard
            title="Total Sanctioned Portfolio"
            primaryValue={`₹${totalSanctioned.toFixed(1)} Cr`}
            subtitle={`Across ${summary.totalProjectsMonitored ?? 3364} Monitored Projects`}
            bandColor="navy"
            secondaryRows={[
              { label: 'States & UTs Covered', value: `${summary.coveredStatesCount ?? stateFunds.length}` },
              { label: 'Avg Sanction / State', value: `₹${stateFunds.length > 0 ? (totalSanctioned / stateFunds.length).toFixed(1) : '0'} Cr` }
            ]}
          />

          <KpiStatCard
            title="Actual Disbursements"
            primaryValue={`₹${totalExpenditure.toFixed(1)} Cr`}
            subtitle={`Realized Expenditure: ${utilizationRate.toFixed(1)}%`}
            bandColor="deepBlue"
            secondaryRows={[
              { label: 'National Baseline', value: '54.7%' },
              { label: 'Execution Velocity', value: `+${(utilizationRate - 54.7).toFixed(1)}% vs baseline` }
            ]}
          />

          <KpiStatCard
            title="Overall Utilization Rate"
            primaryValue={`${utilizationRate.toFixed(1)}%`}
            subtitle="SUM(Expenditure) / SUM(Sanctioned)"
            bandColor="navy"
            secondaryRows={[
              { label: 'Active Works in Queue', value: `${summary.activeProjectsCount ?? 0} works` },
              { label: 'Average Delay', value: `${summary.avgDelayDays ?? 0} days` }
            ]}
          />

          <KpiStatCard
            title="Sample Registry Coverage"
            primaryValue={`${summary.totalProjectsMonitored ?? 3364} Works`}
            subtitle="Audited Training / Demo Sample"
            bandColor="amber"
            secondaryRows={[
              { label: 'Avg Works / State', value: `~${Math.round((summary.totalProjectsMonitored ?? 3364) / (stateFunds.length || 36))}` },
              { label: 'Ledger Records', value: `${summary.transactionCount ?? 33} transactions` }
            ]}
          />
        </div>

        {/* State Comparison Chart */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#12355B]">
                Sanctions vs. Actual Expenditure by State (₹ Crores)
              </h3>
              <p className="text-xs text-[#667085]">
                State-level comparison showing expenditure velocity against sanctioned project portfolios in the monitored sample.
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1">
                <span className="w-3 h-3 bg-[#12355B] rounded-xs" />
                <span className="text-[#344054]">Sanctioned</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-3 h-3 bg-[#1D4E89] rounded-xs" />
                <span className="text-[#344054]">Actual Expenditure</span>
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475467' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475467' }} tickFormatter={v => `₹${v}Cr`} />
                <Tooltip
                  cursor={{ fill: 'rgba(18, 53, 91, 0.05)' }}
                  formatter={(val: any, name: string) => [
                    `₹${Number(val ?? 0).toFixed(2)} Cr`,
                    name === 'sanctioned' || name === 'Sanctioned' ? 'Sanctioned' : 'Actual Expenditure'
                  ]}
                  labelFormatter={(lbl) => `State/UT: ${lbl}`}
                  contentStyle={{
                    backgroundColor: '#12355B',
                    color: '#fff',
                    borderRadius: '6px',
                    fontSize: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="sanctioned" 
                  name="Sanctioned" 
                  fill="#12355B" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30} 
                  activeBar={{ fill: '#0E2A47' }}
                />
                <Bar 
                  dataKey="expenditure" 
                  name="Actual Expenditure" 
                  fill="#1D4E89" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30} 
                  activeBar={{ fill: '#163E6D' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* State-by-State Breakdown Table */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#F0F2F5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#12355B]">
                State & Union Territory Fund Utilization Register
              </h3>
              <p className="text-xs text-[#667085]">
                Aggregated sanctioned amounts, actual disbursements, and utilization percentages computed directly from monitored projects.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search state..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F5F7FA] border border-[#D0D5DD] rounded-md focus:outline-hidden focus:bg-white focus:border-[#12355B]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] text-[#667085] font-semibold border-b border-[#E5E7EB] uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">State / UT</th>
                  <th className="py-3 px-4">Monitored Works</th>
                  <th className="py-3 px-4">Sanctioned Amount</th>
                  <th className="py-3 px-4">Actual Expenditure</th>
                  <th className="py-3 px-4">Utilization %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F5] text-[#263238]">
                {filteredStates.map(s => (
                  <tr key={s.state} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 px-4 font-bold text-[#12355B]">{s.state}</td>
                    <td className="py-3 px-4 font-mono text-[#475467]">{s.projectCount} works</td>
                    <td className="py-3 px-4 font-mono font-medium text-[#1D4E89]">₹{s.sanctionedCr.toFixed(2)} Cr</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#12355B]">₹{s.expenditureCr.toFixed(2)} Cr</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-[#12355B]">{s.utilizationRate.toFixed(1)}%</span>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${s.utilizationRate > 60 ? 'bg-[#12B76A]' : 'bg-[#F79009]'}`}
                            style={{ width: `${Math.min(100, s.utilizationRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
