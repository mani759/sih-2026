import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  ArrowRight, 
  AlertTriangle, 
  FileText, 
  CheckCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { FilterBar } from '../components/FilterBar';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../components/StateComponents';
import { Project } from '../types';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Load actual states and categories present in the dataset
  useEffect(() => {
    fetch('/api/states')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const names = data.filter((s: any) => s.projectCount > 0).map((s: any) => s.state);
          setAvailableStates(names);
        }
      })
      .catch(err => console.warn('Could not load states list:', err));

    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const names = data.filter((c: any) => c.count > 0).map((c: any) => c.category);
          setAvailableCategories(names);
        }
      })
      .catch(err => console.warn('Could not load categories list:', err));
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: page.toString(),
      limit: '8',
      ...(search && { q: search }),
      ...(selectedState && { state: selectedState }),
      ...(selectedCategory && { category: selectedCategory }),
      ...(selectedStatus && { status: selectedStatus }),
      ...(selectedSeverity && { risk_level: selectedSeverity })
    });

    try {
      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) throw new Error('Could not retrieve project records.');

      const data = await res.json();
      setProjects(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Error fetching projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [page, selectedState, selectedCategory, selectedStatus, selectedSeverity]);

  const handleSearchSubmit = () => {
    setPage(1);
    fetchProjects();
  };

  const handleReset = () => {
    setSearch('');
    setSelectedState('');
    setSelectedCategory('');
    setSelectedStatus('');
    setSelectedSeverity('');
    setPage(1);
  };

  const states = [
    { label: 'All States', value: '' },
    ...(availableStates.length > 0 ? availableStates : [
      'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
      'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
      'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
      'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
      'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
    ]).map(s => ({ label: s, value: s }))
  ];

  const defaultCategories = [
    'Other Public Facilities',
    'Railways, Roads, Pathways & Bridges',
    'Others',
    'Education',
    'Drinking Water Facility',
    'Sanitation & Public Health'
  ];

  const categories = [
    { label: 'All Categories', value: '' },
    ...(availableCategories.length > 0 ? availableCategories : defaultCategories).map(c => ({ label: c, value: c }))
  ];

  const statuses = [
    { label: 'All Statuses', value: '' },
    { label: 'Completed', value: 'Completed' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Stalled', value: 'Stalled' },
    { label: 'Not Started', value: 'Not Started' }
  ];

  const severities = [
    { label: 'All Risk Levels', value: '' },
    { label: 'High Risk (Flagged)', value: 'high' },
    { label: 'Medium Risk (Under Review)', value: 'medium' },
    { label: 'Low Risk (Verified Normal)', value: 'low' }
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'MPLAD Sanctioned Projects' }]}
        contextDescription="Constituency-level project registry with real-time expenditure utilization and ML risk scoring."
      />

      {/* Light-blue banded search & filter utility bar */}
      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by Project ID, title, MP name, or district..."
        onApplyFilters={handleSearchSubmit}
        onResetFilters={handleReset}
        filterFields={[
          {
            id: 'filter-state',
            label: 'State / UT',
            value: selectedState,
            onChange: v => { setSelectedState(v); setPage(1); },
            options: states
          },
          {
            id: 'filter-category',
            label: 'Work Category',
            value: selectedCategory,
            onChange: v => { setSelectedCategory(v); setPage(1); },
            options: categories
          },
          {
            id: 'filter-status',
            label: 'Implementation Status',
            value: selectedStatus,
            onChange: v => { setSelectedStatus(v); setPage(1); },
            options: statuses
          },
          {
            id: 'filter-severity',
            label: 'Vigilance Risk Score',
            value: selectedSeverity,
            onChange: v => { setSelectedSeverity(v); setPage(1); },
            options: severities
          }
        ]}
      />

      <main className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Results summary bar */}
        <div className="flex flex-wrap items-center justify-between text-sm text-[#475467] bg-white px-4 sm:px-5 py-3 rounded-lg border border-[#E5E7EB]">
          <div>
            Showing <strong className="text-[#12355B] font-mono">{projects.length}</strong> of{' '}
            <strong className="text-[#12355B] font-mono">{totalCount}</strong> sanctioned works
          </div>
          <div className="flex items-center space-x-2">
            <span>Sorted by: <strong className="text-[#12355B]">Risk Score (High to Low)</strong></span>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading projects from MoSPI repository..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchProjects} />
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects match your filter criteria"
            description="Try relaxing your search terms or clearing state/category selections."
            actionText="Clear Filters"
            onAction={handleReset}
          />
        ) : (
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F5F7FA] text-[#475467] font-semibold border-b border-[#E5E7EB] uppercase text-xs">
                  <tr>
                    <th className="py-3 px-4">Project ID & Title</th>
                    <th className="py-3 px-4">Location & MP</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Sanction & Expenditure</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Risk Level</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5] text-[#263238]">
                  {projects.map(project => (
                    <tr key={project.project_id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-xs sm:text-sm font-bold text-[#1D4E89]">
                            {project.project_id}
                          </span>
                          {!project.has_tender_on_file && (
                            <span className="text-xs bg-red-100 text-[#D92D20] font-semibold px-1.5 py-0.5 rounded">
                              No Tender
                            </span>
                          )}
                        </div>
                        <Link
                          to={`/projects/${project.project_id}`}
                          className="font-bold text-sm sm:text-base text-[#12355B] hover:text-[#1D4E89] mt-1 block line-clamp-2 transition-colors"
                        >
                          {project.project_name}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-[#475467]">
                        <div className="font-medium text-xs sm:text-sm text-[#263238]">{project.district}, {project.state}</div>
                        <div className="text-xs text-[#667085]">{project.constituency}</div>
                        <div className="text-xs text-[#1D4E89] font-medium">{project.mp_name}</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block bg-[#F5F7FA] text-[#344054] px-2.5 py-1 rounded border border-[#E5E7EB] font-medium text-xs sm:text-sm">
                          {project.work_category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                        <div className="font-bold text-[#12355B] text-xs sm:text-sm">
                          ₹{(project.actual_expenditure / 100000).toFixed(2)}L
                        </div>
                        <div className="text-xs text-[#667085]">
                          of ₹{(project.sanctioned_amount / 100000).toFixed(2)}L
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full ${
                              project.expenditure_utilization && project.expenditure_utilization > 1
                                ? 'bg-[#D92D20]'
                                : 'bg-[#12355B]'
                            }`}
                            style={{
                              width: `${Math.min(100, ((project.actual_expenditure / project.sanctioned_amount) * 100))}%`
                            }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={project.status} size="sm" />
                        {project.delay_days && project.delay_days > 0 ? (
                          <div className="text-xs text-amber-700 mt-1 font-medium">
                            +{project.delay_days}d delay
                          </div>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <RiskBadge score={project.risk_score} severity={project.severity} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-1">
                        <Link
                          to={`/projects/${project.project_id}`}
                          className="inline-flex items-center text-xs sm:text-sm font-semibold text-[#12355B] bg-[#EAF2F8] hover:bg-[#D0E2EC] px-3 py-1.5 rounded transition-colors"
                        >
                          <span>Details</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-white border-t border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs text-[#667085]">
                Page <strong className="font-mono text-[#12355B]">{page}</strong> of <strong className="font-mono text-[#12355B]">{totalPages}</strong>
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-white border border-[#D0D5DD] rounded text-xs text-[#344054] disabled:opacity-40 hover:bg-gray-50 flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 bg-white border border-[#D0D5DD] rounded text-xs text-[#344054] disabled:opacity-40 hover:bg-gray-50 flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
