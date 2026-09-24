import React from 'react';
import { Link } from 'react-router-dom';
import { FolderX, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#EAF2F8] text-[#12355B] flex items-center justify-center mb-4">
        <FolderX className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-[#12355B]">Page Not Found (404)</h1>
      <p className="text-sm text-[#475467] max-w-md mt-2">
        The requested scheme record, audit file, or portal endpoint does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link
          to="/dashboard"
          className="bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs font-semibold px-4 py-2.5 rounded-md inline-flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
};
