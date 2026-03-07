// ============================================
// Court Access — Main App Router
// ============================================

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { useAuthStore } from './stores/authStore';

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
import { HearingsPage } from './pages/case/HearingsPage';
import { TimelinePage } from './pages/case/TimelinePage';
import { EntitiesPage } from './pages/case/EntitiesPage';
import { NarrativePage } from './pages/case/NarrativePage';
import { IntegrityCertificatePage } from './pages/case/IntegrityCertificatePage';
import { ArchiveStatusPage } from './pages/case/ArchiveStatusPage';
import { MediaTranscriptsPage } from './pages/case/MediaTranscriptsPage';
import { CorrelationsPage } from './pages/case/CorrelationsPage';
import { PolicyCompliancePage } from './pages/case/PolicyCompliancePage';
import { CheckoutSuccessPage } from './pages/checkout/CheckoutSuccessPage';
import { CheckoutCancelPage } from './pages/checkout/CheckoutCancelPage';
import { BillingPage } from './pages/billing/BillingPage';
import { EvidenceViewerPage } from './pages/case/EvidenceViewerPage';
import { AdminControlsPage } from './pages/admin/AdminControlsPage';
import { AgencyIntelligencePage } from './pages/admin/AgencyIntelligencePage';
import { EmailAdminPage } from './pages/admin/EmailAdminPage';
import { RecordsRequestPage } from './pages/case/RecordsRequestPage';
import { CrossReferencePage } from './pages/case/CrossReferencePage';
import { FeedbackPage } from './pages/admin/FeedbackPage';
import { BugTrackingPage } from './pages/admin/BugTrackingPage';
import { HealthReportPage } from './pages/admin/HealthReportPage';
import { AlertsPage } from './pages/admin/AlertsPage';
import CaseInvestigationWorkspace from './pages/case/CaseInvestigationWorkspace';
import CaseIntelligenceDashboard from './pages/case/CaseIntelligenceDashboard';
import TrialPreparationCanvas from './pages/case/TrialPreparationCanvas';
import EvidenceIntelligenceDashboard from './pages/case/EvidenceIntelligenceDashboard';
import { SystemHealthDashboard } from './pages/admin/SystemHealthDashboard';

function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  // Restore JWT session eagerly on app mount (before ProtectedRoute checks auth)
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

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
          <Route
            path="admin/controls"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <AdminControlsPage />
              </ProtectedRoute>
            }
          />
          <Route path="billing" element={<BillingPage />} />
          <Route
            path="admin/agencies"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <AgencyIntelligencePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/email"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <EmailAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/alerts"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <AlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/feedback"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <FeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/bugs"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <BugTrackingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/health-reports"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <HealthReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/system-health"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <SystemHealthDashboard />
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
            <Route path="hearings" element={<HearingsPage />} />
            <Route
              path="timeline"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <TimelinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="entities"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <EntitiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="narrative"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <NarrativePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="integrity"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <IntegrityCertificatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="archive"
              element={
                <ProtectedRoute requiredPermission="canManageCases">
                  <ArchiveStatusPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="evidence-viewer"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <EvidenceViewerPage />
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
            <Route
              path="media-transcripts"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <MediaTranscriptsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="evidence-correlations"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <CorrelationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="records-requests"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <RecordsRequestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="cross-references"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <CrossReferencePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="policy-compliance"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <PolicyCompliancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="investigation"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <CaseInvestigationWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="intelligence"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <CaseIntelligenceDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="trial-prep"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <TrialPreparationCanvas />
                </ProtectedRoute>
              }
            />
            <Route
              path="evidence-intelligence-dashboard"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <EvidenceIntelligenceDashboard />
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
