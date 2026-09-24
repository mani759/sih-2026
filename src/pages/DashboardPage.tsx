import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  FileText, 
  TrendingUp, 
  PieChart as PieChartIcon,
  Filter,
  RefreshCw,
  Copy,
  Landmark
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { KpiStatCard } from '../components/KpiStatCard';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState, ErrorState } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { Project, DashboardMetrics } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, token } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [flaggedProjects, setFlaggedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
      const [mRes, aRes] = await Promise.all([
        fetch('/api/metrics', { headers: authHeaders }),
        fetch('/api/projects?risk_level=high&limit=5', { headers: authHeaders })
      ]);

      if (!mRes.ok || !aRes.ok) throw new Error('Could not fetch operational dashboard metrics.');

      const mContentType = mRes.headers.get('content-type') || '';
      const aContentType = aRes.headers.get('content-type') || '';
      if (!mContentType.includes('application/json') || !aContentType.includes('application/json')) {
        throw new Error('Backend returned unexpected non-JSON response. Please retry in a moment.');
      }

      const mData = await mRes.json();
      const aData = await aRes.json();

      setMetrics(mData);
      setFlaggedProjects(aData.data || []);
    } catch (err: any) {
      setError(err.message || 'Error communicating with backend service.');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch on component mount
    fetchDashboardData(true);

    // Event listener for actions taken anywhere in the application
    const onWorkflowActionUpdated = () => {
      fetchDashboardData(false);
    };

    window.addEventListener('mplads-workflow-action-updated', onWorkflowActionUpdated);
    return () => {
      window.removeEventListener('mplads-workflow-action-updated', onWorkflowActionUpdated);
    };
  }, []);

  if (loading) return <LoadingState message="Compiling national MPLAD vigilance metrics..." />;
  if (error || !metrics) return <ErrorState message={error || 'Failed to load dashboard'} onRetry={() => fetchDashboardData(true)} />;

  // Sector breakdown chart data
  const sectorData = Object.entries(metrics.categoryBreakdown || {}).map(([name, count]) => ({
    name,
    count
  }));

  const riskPieData = [
    { name: 'High Risk (Flagged)', value: metrics.highRiskProjects, color: '#D92D20' },
    { name: 'Medium Risk (Under Review)', value: metrics.underReviewProjects || metrics.mediumRiskProjects, color: '#F79009' },
    { name: 'Low Risk (Verified Normal)', value: metrics.lowRiskProjects, color: '#12B76A' }
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'Operational Vigilance Dashboard' }]}
        contextDescription="Live oversight of sanctioned works, expenditure velocity, and high-risk audit flags."
        badge="MoSPI Vigilance Engine Active"
        actions={
          <button
            onClick={() => fetchDashboardData(false)}
            disabled={refreshing}
            title="Refresh latest metrics from server"
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-[#1D4E89] hover:text-[#12355B] bg-white hover:bg-[#F0F2F5] border border-[#1D4E89]/30 rounded-md shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        }
      />

      <main className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top KPI Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiStatCard
            title="Total Sanctioned Works"
            primaryValue={`₹${(metrics.totalSanctioned / 10000000).toFixed(2)} Cr`}
            subtitle={`${metrics.totalProjects} Monitored Projects`}
            bandColor="navy"
            secondaryRows={[
              { label: 'Completed Works', value: `${metrics.completedProjects} units` },
              { label: 'In Execution', value: `${metrics.inProgressProjects} units` }
            ]}
          />

          <KpiStatCard
            title="Actual Expenditure"
            primaryValue={`₹${(metrics.totalDisbursed / 10000000).toFixed(2)} Cr`}
            subtitle={`Sample Utilization: ${(metrics.overallUtilizationRate * 100).toFixed(1)}%`}
            bandColor="deepBlue"
            secondaryRows={[
              { label: 'National Baseline', value: '54.7%' },
              { label: 'Unspent Sanctions', value: `₹${((metrics.totalSanctioned - metrics.totalDisbursed) / 10000000).toFixed(2)} Cr` }
            ]}
          />

          <KpiStatCard
            title="High-Risk Flagged Works"
            primaryValue={`${metrics.flaggedProjects} Projects`}
            subtitle={`${metrics.highRiskProjects} High Risk (Flagged) • ${metrics.underReviewProjects || metrics.mediumRiskProjects || 0} Under Review`}
            bandColor="red"
            clickable
            onClick={() => navigate('/anomalies')}
            secondaryRows={[
              { label: 'High Risk (Flagged)', value: `${metrics.highRiskProjects} items` },
              { label: 'Medium Risk (Under Review)', value: `${metrics.underReviewProjects || metrics.mediumRiskProjects || 0} items` }
            ]}
          />

          <KpiStatCard
            title="Audit Action Queue"
            primaryValue={`${metrics.pendingReviewsCount} Pending`}
            subtitle={`${metrics.verifiedCount} Verified by Auditors`}
            bandColor="amber"
            clickable
            onClick={() => navigate('/anomalies')}
            secondaryRows={[
              { label: 'Under Escalation', value: `${metrics.escalatedCount ?? 0} records` },
              { label: 'False Positives Cleared', value: `${metrics.dismissedCount ?? 0} records` }
            ]}
          />
        </div>

        {/* 2 Analytical Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sector / Category Work Distribution */}
          <div className="lg:col-span-7 bg-white rounded-lg border border-[#E5E7EB] p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#F0F2F5] mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#12355B]">
                  Projects by Work Category
                </h3>
                <p className="text-xs sm:text-sm text-[#475467] mt-0.5">
                  Constituency development sectors defined under MPLAD guidelines.
                </p>
              </div>
              <span className="text-xs sm:text-sm font-mono text-[#667085] bg-[#F5F7FA] px-2.5 py-1 rounded">
                {sectorData.length} Sectors
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorData} margin={{ top: 10, right: 15, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#475467' }} 
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#475467' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(29, 78, 137, 0.06)' }}
                    formatter={(val: any) => [`${Number(val || 0)} Projects`, 'Total Projects']}
                    contentStyle={{
                      backgroundColor: '#12355B',
                      color: '#fff',
                      borderRadius: '6px',
                      fontSize: '13px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    name="Projects" 
                    fill="#1D4E89" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={38} 
                    activeBar={{ fill: '#12355B' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Severity Composition */}
          <div className="lg:col-span-5 bg-white rounded-lg border border-[#E5E7EB] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-[#F0F2F5] mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#12355B]">
                    Risk Profile Distribution
                  </h3>
                  <p className="text-xs sm:text-sm text-[#475467] mt-0.5">
                    Scored via Isolation Forest & procurement flags.
                  </p>
                </div>
                <PieChartIcon className="w-5 h-5 text-[#1D4E89]" />
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {riskPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#12355B',
                        color: '#fff',
                        borderRadius: '6px',
                        fontSize: '13px',
                        border: 'none'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend rows */}
              <div className="space-y-2 mt-3">
                {riskPieData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-3.5 h-3.5 rounded-xs" style={{ backgroundColor: item.color }} />
                      <span className="text-[#344054] font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold font-mono text-[#12355B]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Priority Investigation Queue Preview Table */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#F0F2F5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-[#D92D20]" />
                <h2 className="text-lg sm:text-xl font-bold text-[#12355B]">
                  Priority Vigilance Queue
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#475467] mt-0.5">
                Highest risk projects flagged for missing tenders, severe delays, or possible duplicate works.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {isAdmin ? (
                <Link
                  to="/anomalies"
                  className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-md flex items-center space-x-1.5 transition-colors shadow-2xs"
                >
                  <span>Open Full Vigilance Queue ({metrics.flaggedProjects})</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  to="/projects?risk_level=HIGH"
                  className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-md flex items-center space-x-1.5 transition-colors shadow-2xs"
                >
                  <span>Browse High Risk Works</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F5F7FA] text-[#475467] font-semibold border-b border-[#E5E7EB] uppercase text-xs">
                <tr>
                  <th className="py-3 px-4">Project ID & Description</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Sanctioned / Spent</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Audit Finding</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F5] text-[#263238]">
                {flaggedProjects.map(proj => (
                  <tr key={proj.project_id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-xs sm:text-sm font-bold text-[#1D4E89]">
                          {proj.project_id}
                        </span>
                        {proj.is_potential_duplicate && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                            Duplicate
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-xs sm:text-sm text-[#12355B] mt-0.5 line-clamp-1" title={proj.project_name}>
                        {proj.project_name}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-[#475467]">
                      <div className="font-medium text-xs sm:text-sm">{proj.district}</div>
                      <div className="text-xs text-[#667085]">{proj.state}</div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                      <div className="font-bold text-[#12355B] text-xs sm:text-sm">₹{(proj.actual_expenditure / 100000).toFixed(1)}L</div>
                      <div className="text-xs text-[#667085]">of ₹{(proj.sanctioned_amount / 100000).toFixed(1)}L</div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <RiskBadge score={proj.risk_score} severity={proj.severity} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 max-w-xs text-[#475467] text-xs sm:text-sm">
                      <span className="line-clamp-2">{proj.reason || 'Parameter variance flagged.'}</span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <Link
                        to={isAdmin ? `/anomalies/${proj.project_id}` : `/projects/${proj.project_id}`}
                        className="inline-flex items-center text-xs sm:text-sm font-semibold text-[#1D4E89] hover:text-[#12355B] bg-[#EAF2F8] hover:bg-[#D0E2EC] px-3 py-1.5 rounded transition-colors"
                      >
                        <span>{isAdmin ? 'Audit Review' : 'View Details'}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
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
