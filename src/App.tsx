import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TopNavbar } from './components/TopNavbar';
import { AIAssistantModal } from './components/AIAssistantModal';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { GovFooter } from './components/GovFooter';

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
import { MLTesterPage } from './pages/MLTesterPage';
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
          <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
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
                path="/ml-tester"
                element={
                  <ProtectedRoute>
                    <MLTesterPage />
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
          <GovFooter />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
