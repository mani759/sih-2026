import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FileWarning, Copy, MapPin, Calendar, Clock } from 'lucide-react';
import { Project } from '../types';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';

interface AlertCardProps {
  project: Project;
  onReview?: (project: Project) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ project, onReview }) => {
  const isDuplicate = project.is_potential_duplicate;
  const isHighRisk = project.severity === 'high';

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] hover:border-[#1D4E89] p-5 shadow-xs transition-all flex flex-col justify-between">
      <div>
        {/* Top badges row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <RiskBadge score={project.risk_score} severity={project.severity} size="sm" />
            <StatusBadge status={project.status} size="sm" />
            {isDuplicate && (
              <span className="inline-flex items-center text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                <Copy className="w-3.5 h-3.5 mr-1" />
                Possible Duplicate Work
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-[#667085] bg-[#F5F7FA] px-2 py-0.5 rounded border border-[#E5E7EB]">
            {project.project_id}
          </span>
        </div>

        {/* Project Name */}
        <h4 className="text-base sm:text-lg font-bold text-[#12355B] hover:text-[#1D4E89] mb-2 line-clamp-2 leading-snug">
          <Link to={`/projects/${project.project_id}`}>
            {project.project_name}
          </Link>
        </h4>

        {/* Short explanation reason */}
        <div className="p-3 bg-red-50/70 border-l-2 border-[#D92D20] rounded-r text-xs sm:text-sm text-[#263238] mb-3">
          <div className="flex items-start space-x-1.5">
            <FileWarning className="w-4 h-4 text-[#D92D20] mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-[#D92D20]">Audit Flag: </span>
              <span>{project.reason || 'Parameter variance detected by ML isolation forest and rule engine.'}</span>
            </div>
          </div>
        </div>

        {/* Metadata info rows */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-[#667085] mb-4">
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-[#1D4E89]" />
            <span className="truncate">{project.district}, {project.state}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-[#1D4E89]" />
            <span>Target: {project.expected_completion}</span>
          </div>
          {project.delay_days ? (
            <div className="flex items-center space-x-1.5 text-amber-700 col-span-2">
              <Clock className="w-4 h-4" />
              <span>Operational Delay: <strong>{project.delay_days} days</strong></span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Financial row + Review button */}
      <div className="pt-3 border-t border-[#F0F2F5] flex items-center justify-between">
        <div>
          <span className="text-xs uppercase font-bold text-[#667085] block">Disbursed / Sanctioned</span>
          <span className="text-sm sm:text-base font-bold text-[#12355B] font-mono">
            ₹{(project.actual_expenditure / 100000).toFixed(1)}L / ₹{(project.sanctioned_amount / 100000).toFixed(1)}L
          </span>
        </div>

        <Link
          to={`/anomalies/${project.project_id}`}
          className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors shadow-2xs"
        >
          <span>Review Anomaly</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
