// ============================================
// Court Access — Main App Router
// ============================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Marketing Pages (separate from app)
import { LandingPage } from './pages/marketing/LandingPage';
import { PricingPage } from './pages/marketing/PricingPage';
import { AboutPage } from './pages/marketing/AboutPage';
import { SecurityPage } from './pages/marketing/SecurityPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Main Pages — Dashboard Router (role-based)
import { DashboardRouter } from './pages/dashboard/DashboardRouter';
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
import { EvidenceDashboardPage } from './pages/case/EvidenceDashboardPage';
import { MonitoringPage } from './pages/admin/MonitoringPage';
import { BetaManagementPage } from './pages/admin/BetaManagementPage';
import { CollaborationPage } from './pages/case/CollaborationPage';
import { CheckoutSuccessPage } from './pages/checkout/CheckoutSuccessPage';
import { CheckoutCancelPage } from './pages/checkout/CheckoutCancelPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Marketing Pages (public) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/security" element={<SecurityPage />} />

        {/* Auth Pages (public) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Checkout Pages (Stripe) */}
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />

        {/* Protected App Routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardRouter />} />
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
          <Route
            path="admin/monitoring"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <MonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/beta"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <BetaManagementPage />
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
              path="evidence-intelligence"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <EvidenceDashboardPage />
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
            <Route
              path="collaboration"
              element={
                <ProtectedRoute requiredPermission="canViewActivity">
                  <CollaborationPage />
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
