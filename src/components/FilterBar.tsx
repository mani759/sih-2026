import React from 'react';
import { Search, RotateCcw } from 'lucide-react';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterField {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  filterFields?: FilterField[];
  onApplyFilters?: () => void;
  onResetFilters: () => void;
  extraActions?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records by ID, keyword or MP name...',
  filterFields = [],
  onApplyFilters,
  onResetFilters,
  extraActions
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onApplyFilters) onApplyFilters();
  };

  return (
    <div className="bg-[#EAF2F8] border-b border-[#D0E2EC] py-4 sm:py-5">
      <div className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Main search field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="filterbar-search-input"
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 bg-white text-sm text-[#263238] rounded-md border border-[#D0D5DD] focus:outline-hidden focus:border-[#12355B] focus:ring-1 focus:ring-[#12355B] shadow-2xs placeholder:text-[#98A2B3]"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              id="filterbar-search-button"
              type="submit"
              className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-md transition-colors shadow-2xs flex items-center justify-center space-x-1.5"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
            <button
              id="filterbar-reset-button"
              type="button"
              onClick={onResetFilters}
              className="bg-white hover:bg-[#F5F7FA] text-[#344054] text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-md border border-[#D0D5DD] transition-colors shadow-2xs flex items-center justify-center space-x-1.5"
            >
              <RotateCcw className="w-4 h-4 text-[#667085]" />
              <span>Reset</span>
            </button>
            {extraActions}
          </div>
        </form>

        {/* Secondary Filters dropdown row */}
        {filterFields.length > 0 && (
          <div className="pt-2 border-t border-[#D0E2EC]/70 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
            {filterFields.map(field => (
              <div key={field.id} className="flex flex-col space-y-1">
                <label htmlFor={field.id} className="text-xs font-medium text-[#475467]">
                  {field.label}
                </label>
                <select
                  id={field.id}
                  value={field.value}
                  onChange={e => field.onChange(e.target.value)}
                  className="bg-white text-xs sm:text-sm text-[#263238] border border-[#D0D5DD] rounded-md px-2.5 py-1.5 focus:outline-hidden focus:border-[#12355B] shadow-2xs"
                >
                  {field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
