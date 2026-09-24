import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricRow {
  icon?: LucideIcon;
  label: string;
  value: string | number;
}

interface KpiStatCardProps {
  title: string;
  primaryValue: string;
  subtitle?: string;
  bandColor?: 'navy' | 'deepBlue' | 'red' | 'amber';
  secondaryRows?: MetricRow[];
  onClick?: () => void;
  clickable?: boolean;
}

export const KpiStatCard: React.FC<KpiStatCardProps> = ({
  title,
  primaryValue,
  subtitle,
  bandColor = 'navy',
  secondaryRows = [],
  onClick,
  clickable = false
}) => {
  const bandBg = {
    navy: 'bg-[#12355B] text-white',
    deepBlue: 'bg-[#1D4E89] text-white',
    red: 'bg-[#D92D20] text-white',
    amber: 'bg-[#B54708] text-white'
  }[bandColor];

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden transition-all ${
        clickable ? 'cursor-pointer hover:border-[#1D4E89] hover:shadow-md' : ''
      }`}
    >
      {/* Top Title Bar */}
      <div className="px-4 py-3 bg-white border-b border-[#F0F2F5] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#475467] uppercase tracking-wider">
          {title}
        </h3>
        {clickable && (
          <span className="text-xs text-[#1D4E89] font-semibold hover:underline">
            View Details →
          </span>
        )}
      </div>

      {/* Flat Fill Primary Stat Band */}
      <div className={`px-4 py-4 ${bandBg} flex flex-col justify-center`}>
        <div className="text-3xl sm:text-4xl font-bold tracking-tight font-sans">
          {primaryValue}
        </div>
        {subtitle && (
          <div className="text-sm text-white/90 font-medium mt-1">
            {subtitle}
          </div>
        )}
      </div>

      {/* Secondary Metrics Rows */}
      {secondaryRows.length > 0 && (
        <div className="p-3.5 bg-white space-y-2">
          {secondaryRows.map((row, idx) => {
            const Icon = row.icon;
            return (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 bg-[#EAF2F8] rounded-md text-sm text-[#263238]"
              >
                <div className="flex items-center space-x-2 text-[#475467]">
                  {Icon && <Icon className="w-4 h-4 text-[#1D4E89]" />}
                  <span className="font-medium text-sm">{row.label}</span>
                </div>
                <span className="font-bold text-[#12355B] font-mono text-sm">
                  {row.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
