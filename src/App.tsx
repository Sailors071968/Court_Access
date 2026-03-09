// ============================================
// Court Access — Main App Router
// ============================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Main Pages — Dashboard Router (role-based)
import { DashboardRouter } from './pages/dashboard/DashboardRouter';
import { PolicyPipelineDashboard } from './pages/dashboard/PolicyPipelineDashboard';
import { PolicyIntelligenceDashboard } from './pages/dashboard/PolicyIntelligenceDashboard';
import { CpraDashboard } from './pages/dashboard/CpraDashboard';
import { CasesListPage } from './pages/CasesListPage';
import { SearchPage } from './pages/SearchPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/admin/AdminPage';

// Case Pages
import { CaseLayout } from './pages/case/CaseLayout';
import { CaseOverviewPage } from './pages/case/CaseOverviewPage';
import { ChargesPage } from './pages/case/ChargesPage';
import { EvidencePage } from './pages/case/EvidencePage';
import { ExpertsPage } from './pages/case/ExpertsPage';
import { MotionsPage } from './pages/case/MotionsPage';
import { ResearchPage } from './pages/case/ResearchPage';
import { ActivityPage } from './pages/case/ActivityPage';
import { DocumentsPage } from './pages/case/DocumentsPage';
import { CaseSettingsPage } from './pages/case/CaseSettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected App Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardRouter />} />
          <Route
            path="dashboard/policy-acquisition/agencies"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <PolicyPipelineDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/policy-intelligence/coverage"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <PolicyIntelligenceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/cpra"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <CpraDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="cases" element={<CasesListPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route
            path="settings"
            element={
              <ProtectedRoute requiredPermission="canViewSettings">
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Case Routes — deterministic tab structure */}
          <Route path="cases/:caseId" element={<CaseLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<CaseOverviewPage />} />
            <Route
              path="charges"
              element={
                <ProtectedRoute requiredPermission="canViewCharges">
                  <ChargesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="evidence"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <EvidencePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="documents"
              element={
                <ProtectedRoute requiredPermission="canViewDocuments">
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="experts"
              element={
                <ProtectedRoute requiredPermission="canViewExperts">
                  <ExpertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="motions"
              element={
                <ProtectedRoute requiredPermission="canViewMotions">
                  <MotionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="research"
              element={
                <ProtectedRoute requiredPermission="canViewResearch">
                  <ResearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="activity"
              element={
                <ProtectedRoute requiredPermission="canViewActivity">
                  <ActivityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute requiredPermission="canManageCases">
                  <CaseSettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
