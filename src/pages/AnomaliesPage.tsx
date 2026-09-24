import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  Layers, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles, 
  Filter,
  Search,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { FilterBar } from '../components/FilterBar';
import { AlertCard } from '../components/AlertCard';
import { LoadingState, EmptyState, ErrorState } from '../components/StateComponents';
import { Project } from '../types';

export const AnomaliesPage: React.FC = () => {
  const { token, user, isAdmin, isLoading: authLoading } = useAuth();
  const [anomalies, setAnomalies] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [duplicateFilter, setDuplicateFilter] = useState('');
  const [includeDuplicates, setIncludeDuplicates] = useState(true);
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [duplicateScanMessage, setDuplicateScanMessage] = useState<string | null>(null);

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

  const fetchAnomalies = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        includeDuplicates: includeDuplicates.toString(),
        limit: '50',
        ...(severity && { severity }),
        ...(selectedState && { state: selectedState })
      });

      const res = await fetch(`/api/anomalies?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not fetch vigilance queue.');
      }

      const data = await res.json();
      setAnomalies(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Error communicating with anomaly engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [severity, selectedState, includeDuplicates]);

  // Run On-Demand Duplicate Check
  const runOnDemandDuplicateCheck = async () => {
    setScanningDuplicates(true);
    setDuplicateScanMessage(null);
    try {
      const res = await fetch('/api/ml/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projects: anomalies
        })
      });

      if (!res.ok) throw new Error('Duplicate scanning model call failed.');

      const data = await res.json();
      const duplicateCount = data.duplicates?.length || 0;
      setDuplicateScanMessage(
        duplicateCount > 0
          ? `Analysis complete: ${duplicateCount} potential duplicate proposals or overlapping tender titles identified via text embeddings.`
          : 'Analysis complete: No new overlapping duplicate proposals identified among current queue.'
      );
      // Refresh list to pick up marked duplicates
      fetchAnomalies();
    } catch (err: any) {
      setDuplicateScanMessage('Duplicate scanner error: ' + err.message);
    } finally {
      setScanningDuplicates(false);
    }
  };

  const filteredList = anomalies.filter(item => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.project_name.toLowerCase().includes(q);
      const matchId = item.project_id.toLowerCase().includes(q);
      const matchDistrict = item.district.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDistrict) return false;
    }
    if (selectedCategory && item.work_category !== selectedCategory) return false;
    if (duplicateFilter === 'yes' && !item.is_potential_duplicate) return false;
    if (duplicateFilter === 'no' && item.is_potential_duplicate) return false;
    return true;
  });

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'Investigation Queue' }]}
        contextDescription="Priority vigilance queue for transactions and sanctioned works with elevated risk scores."
        badge={`${anomalies.filter(a => a.severity === 'high').length} Flagged (${anomalies.filter(a => a.severity === 'medium').length} Under Review)`}
      />

      {/* Utility Filter Bar */}
      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter queue by ID, project title, or district..."
        onResetFilters={() => {
          setSearch('');
          setSeverity('');
          setSelectedState('');
          setSelectedCategory('');
          setDuplicateFilter('');
        }}
        filterFields={[
          {
            id: 'filter-state',
            label: 'State / Territory',
            value: selectedState,
            onChange: setSelectedState,
            options: [
              { label: 'All States', value: '' },
              ...(availableStates.length > 0 ? availableStates : [
                'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
                'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
                'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
                'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
                'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
                'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
              ]).map(s => ({ label: s, value: s }))
            ]
          },
          {
            id: 'filter-category',
            label: 'Work Category',
            value: selectedCategory,
            onChange: setSelectedCategory,
            options: [
              { label: 'All Categories', value: '' },
              ...(availableCategories.length > 0 ? availableCategories : [
                'Other Public Facilities',
                'Railways, Roads, Pathways & Bridges',
                'Others',
                'Education',
                'Drinking Water Facility',
                'Sanitation & Public Health'
              ]).map(c => ({ label: c, value: c }))
            ]
          },
          {
            id: 'filter-severity',
            label: 'Risk Classification',
            value: severity,
            onChange: setSeverity,
            options: [
              { label: 'All Queued Items', value: '' },
              { label: 'High Risk (Flagged)', value: 'high' },
              { label: 'Medium Risk (Under Review)', value: 'medium' }
            ]
          },
          {
            id: 'filter-dup',
            label: 'Duplicate Proposal Flag',
            value: duplicateFilter,
            onChange: setDuplicateFilter,
            options: [
              { label: 'All Items', value: '' },
              { label: 'Potential Duplicates Only', value: 'yes' },
              { label: 'Exclude Duplicates', value: 'no' }
            ]
          }
        ]}
        extraActions={
          <button
            id="run-duplicate-scanner-button"
            type="button"
            onClick={runOnDemandDuplicateCheck}
            disabled={scanningDuplicates}
            className="bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-md flex items-center space-x-2 shadow-2xs transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {scanningDuplicates ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Embedding Model...</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                <span>On-Demand Duplicate Check</span>
              </>
            )}
          </button>
        }
      />

      <main className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Duplicate Scan Status Banner */}
        {duplicateScanMessage && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-900 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Layers className="w-5 h-5 text-purple-700 flex-shrink-0" />
              <span>{duplicateScanMessage}</span>
            </div>
            <button
              onClick={() => setDuplicateScanMessage(null)}
              className="text-purple-600 hover:text-purple-800 font-bold p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Queue Overview Summary */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-[#D92D20]" />
            <span className="font-semibold text-sm sm:text-base text-[#12355B]">
              Active Queue: Showing {filteredList.length} of {anomalies.length} Flagged Works
            </span>
          </div>

          <div className="flex items-center space-x-5 text-xs sm:text-sm text-[#475467]">
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-[#D92D20]" />
              <span>High Risk: <strong className="text-[#D92D20] font-mono">{anomalies.filter(a => a.severity === 'high').length}</strong></span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-600" />
              <span>Duplicate Flags: <strong className="text-purple-700 font-mono">{anomalies.filter(a => a.is_potential_duplicate).length}</strong></span>
            </span>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Scanning projects for parameter irregularities and duplicate clusters..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchAnomalies} />
        ) : filteredList.length === 0 ? (
          <EmptyState
            title="No anomalies matching current filters"
            description="All active works in this selection meet procedural guidelines or have been marked verified."
            actionText="Reset Queue Filters"
            onAction={() => { setSearch(''); setSeverity(''); setDuplicateFilter(''); }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredList.map(item => (
              <AlertCard key={item.project_id} project={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
