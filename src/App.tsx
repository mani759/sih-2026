import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TopNavbar } from './components/TopNavbar';
import { AIAssistantModal } from './components/AIAssistantModal';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { ChakraLogo } from './components/ChakraLogo';

// Pages
import { PublicHome } from './pages/PublicHome';
import { AboutPage } from './pages/AboutPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { AnomalyDetailPage } from './pages/AnomalyDetailPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransactionDetailPage } from './pages/TransactionDetailPage';
import { FundsPage } from './pages/FundsPage';
import { ReportsPage } from './pages/ReportsPage';
import { TrendAnalysisPage } from './pages/TrendAnalysisPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-[#263238] font-sans">
          {/* Top Navbar with Government Banner and Nav Links */}
          <TopNavbar onOpenAssistant={() => setAssistantOpen(true)} />

          {/* Main Routing Outlet */}
          <div className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<PublicHome />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Authenticated Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute>
                    <ProjectsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId"
                element={
                  <ProtectedRoute>
                    <ProjectDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/anomalies"
                element={
                  <AdminRoute>
                    <AnomaliesPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/anomalies/:anomalyId"
                element={
                  <AdminRoute>
                    <AnomalyDetailPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <TransactionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/:transactionId"
                element={
                  <ProtectedRoute>
                    <TransactionDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/funds"
                element={
                  <ProtectedRoute>
                    <FundsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trend-analysis"
                element={
                  <ProtectedRoute>
                    <TrendAnalysisPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <AdminRoute>
                    <SettingsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <SettingsPage />
                  </AdminRoute>
                }
              />

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>

          {/* Natural Language AI Vigilance Query Assistant Modal */}
          <AIAssistantModal
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
          />

          {/* Government Portal Footer */}
          <footer className="bg-white border-t border-[#E5E7EB] py-6 px-4 sm:px-6 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-[#667085] gap-3">
              <div className="flex items-center space-x-3">
                <ChakraLogo className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[#12355B]">
                    MPLAD Scheme Vigilance & Anomaly Detection Portal
                  </p>
                  <p className="text-[11px] mt-0.5">
                    Ministry of Statistics and Programme Implementation (MoSPI) • Government of India
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-[11px]">
                <span>SIH PS ID: 26102</span>
                <span>•</span>
                <span>IT Act 2000 Audit Certified</span>
                <span>•</span>
                <span>Version 1.0.4 Production</span>
              </div>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
