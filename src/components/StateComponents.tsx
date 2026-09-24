import React from 'react';
import { AlertCircle, FolderX, ShieldOff, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading verified MPLAD records...'
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="w-10 h-10 border-3 border-[#12355B] border-t-transparent rounded-full animate-spin mb-3" />
    <p className="text-sm font-semibold text-[#12355B]">{message}</p>
    <p className="text-xs text-[#667085] mt-1">Connecting to Government of India monitoring data service...</p>
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}> = ({
  title = 'No records found',
  description = 'No matching projects or transactions fit the current filter criteria.',
  actionText,
  onAction
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-[#E5E7EB]">
    <FolderX className="w-12 h-12 text-[#98A2B3] mb-3" />
    <h3 className="text-base font-bold text-[#263238]">{title}</h3>
    <p className="text-xs sm:text-sm text-[#667085] max-w-md mt-1">{description}</p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="mt-4 bg-[#12355B] text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-[#1D4E89] transition-colors"
      >
        {actionText}
      </button>
    )}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
}> = ({
  title = 'Unable to load project information',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-red-50/50 rounded-lg border border-red-200">
    <AlertCircle className="w-12 h-12 text-[#D92D20] mb-3" />
    <h3 className="text-base font-bold text-[#D92D20]">{title}</h3>
    <p className="text-xs sm:text-sm text-[#475467] max-w-md mt-1">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 flex items-center space-x-1.5 bg-[#12355B] text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-[#1D4E89] transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Retry Operation</span>
      </button>
    )}
  </div>
);

export const AccessRestrictedState: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-[#E5E7EB] shadow-xs max-w-xl mx-auto my-12">
    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 mb-4">
      <ShieldOff className="w-7 h-7" />
    </div>
    <h2 className="text-xl font-bold text-[#12355B]">Access Restricted — Administrative Clearance Required</h2>
    <p className="text-sm text-[#475467] mt-2 max-w-md">
      Your account is currently assigned <strong>PUBLIC (Read-Only)</strong> clearance. The Anomalies investigation queue, workflow dispute escalation, and administrative settings are restricted exclusively to the designated <strong>ADMIN</strong> account.
    </p>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <Link
        to="/dashboard"
        className="bg-[#12355B] text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-[#1D4E89] transition-colors"
      >
        Return to Dashboard
      </Link>
      <Link
        to="/projects"
        className="bg-white text-[#344054] border border-[#D0D5DD] text-xs font-semibold px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
      >
        Browse Public Projects
      </Link>
      <Link
        to="/login"
        className="bg-gray-50 text-[#12355B] border border-[#D0D5DD] text-xs font-semibold px-4 py-2 rounded-md hover:bg-gray-100 transition-colors"
      >
        Sign In as Officer
      </Link>
    </div>
  </div>
);
