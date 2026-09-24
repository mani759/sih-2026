import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AccessRestrictedState } from './StateComponents';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="w-8 h-8 border-3 border-[#12355B] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#12355B]">Verifying session authorization...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="w-8 h-8 border-3 border-[#12355B] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#12355B]">Verifying administrative clearance...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <AccessRestrictedState />;
  }

  return <>{children}</>;
};
