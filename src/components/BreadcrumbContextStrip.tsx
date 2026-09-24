import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbContextStripProps {
  items: BreadcrumbItem[];
  contextDescription: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const BreadcrumbContextStrip: React.FC<BreadcrumbContextStripProps> = ({
  items,
  contextDescription,
  badge,
  actions
}) => {
  const pageTitle = items.length > 0 ? items[items.length - 1].label : '';
  const breadcrumbTrail = items.slice(0, -1);

  return (
    <div className="bg-[#EAF2F8] border-b border-[#D0E2EC] py-3.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          {/* Breadcrumb row */}
          <nav className="flex items-center space-x-1.5 text-xs sm:text-sm text-[#667085] mb-1" aria-label="Breadcrumb">
            <Link to="/dashboard" className="hover:text-[#12355B] flex items-center transition-colors">
              <Home className="w-4 h-4 mr-1 text-[#667085]" />
              <span>Home</span>
            </Link>
            {breadcrumbTrail.map((item, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />
                {item.href ? (
                  <Link to={item.href} className="hover:text-[#12355B] font-medium transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-[#475467] font-medium">{item.label}</span>
                )}
              </React.Fragment>
            ))}
            {breadcrumbTrail.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />}
            <span className="text-[#1D4E89] font-medium">{pageTitle}</span>
          </nav>

          {/* Prominent Page Title (H1 Tier) */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#12355B] tracking-tight leading-tight">
            {pageTitle}
          </h1>

          {/* Context Description Line */}
          <p className="text-sm sm:text-base text-[#475467] font-normal mt-0.5">
            {contextDescription}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start md:self-auto flex-shrink-0">
          {actions}
          {badge && (
            <span className="inline-flex items-center text-xs sm:text-sm font-semibold px-3 py-1.5 bg-white border border-[#1D4E89]/30 text-[#1D4E89] rounded-md shadow-2xs whitespace-nowrap">
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
