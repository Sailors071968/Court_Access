// ============================================
// Court Access — Main App Router
// ============================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Landing Page
import { LandingPage, PricingPage } from './pages/LandingPage';

// Public Marketing Pages (Phase 207-216)
import { ForDefensePage } from './pages/ForDefensePage';
import { ForProsecutorsPage } from './pages/ForProsecutorsPage';
import { GovernmentPage } from './pages/GovernmentPage';
import { ContactSalesPage } from './pages/ContactSalesPage';
import { CaseStudiesPage } from './pages/CaseStudiesPage';
import { LegalDisclaimerPage } from './pages/LegalDisclaimerPage';

// Onboarding & Checkout
import { OnboardingPage } from './pages/OnboardingPage';
import { CheckoutSuccessPage, CheckoutCancelPage } from './pages/CheckoutResultPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Main Pages — Dashboard Router (role-based)
import { DashboardRouter } from './pages/dashboard/DashboardRouter';
import { DemoRequestsDashboard } from './pages/dashboard/DemoRequestsDashboard';
import { GovernmentOutreachDashboard } from './pages/dashboard/GovernmentOutreachDashboard';
import { MarketingDashboard } from './pages/dashboard/MarketingDashboard';
import { PolicyPipelineDashboard } from './pages/dashboard/PolicyPipelineDashboard';
import { PolicyIntelligenceDashboard } from './pages/dashboard/PolicyIntelligenceDashboard';
import { CpraDashboard } from './pages/dashboard/CpraDashboard';
import { SystemHealthDashboard } from './pages/dashboard/SystemHealthDashboard';
import { DiscountCodesDashboard } from './pages/dashboard/DiscountCodesDashboard';
import { PolicyOperationsDashboard } from './pages/dashboard/PolicyOperationsDashboard';
import { PolicyTopicsViewer } from './pages/dashboard/PolicyTopicsViewer';
import { PolicyComplianceDashboard } from './pages/dashboard/PolicyComplianceDashboard';
import { CaseTimelineVisualizer } from './pages/dashboard/CaseTimelineVisualizer';
import ExhibitViewer from './pages/dashboard/exhibits/ExhibitViewer';
import { EvidenceManagementDashboard } from './pages/dashboard/EvidenceManagementDashboard';
import { EvidenceProcessingTrace } from './pages/dashboard/EvidenceProcessingTrace';
import { WorkerQueueMonitoring } from './pages/dashboard/WorkerQueueMonitoring';
import { PolicyTopicRegistry } from './pages/dashboard/PolicyTopicRegistry';
import { BetaDeploymentVerification } from './pages/dashboard/BetaDeploymentVerification';
import { PolicyMatrixVirtualized } from './pages/dashboard/PolicyMatrixVirtualized';
import { CpraCampaignTimeline } from './pages/dashboard/CpraCampaignTimeline';
import { CpraMatrixDashboard } from './pages/dashboard/CpraMatrixDashboard';
import { CpraAutonomousDashboard } from './pages/dashboard/CpraAutonomousDashboard';
import { UsageDashboard } from './pages/dashboard/UsageDashboard';
import { EvidenceRequestsDashboard } from './pages/dashboard/EvidenceRequestsDashboard';
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
import { TrialExhibitWorkspace } from './pages/case/TrialExhibitWorkspace';
import { LitigationStrategyView } from './pages/case/LitigationStrategyView';
import { ContradictionDashboardPage } from './pages/case/ContradictionDashboardPage';
import { NarrativeAnalysisPage } from './pages/case/NarrativeAnalysisPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Public Marketing Pages */}
        <Route path="/for-defense" element={<ForDefensePage />} />
        <Route path="/for-prosecutors" element={<ForProsecutorsPage />} />
        <Route path="/government" element={<GovernmentPage />} />
        <Route path="/contact" element={<ContactSalesPage />} />
        <Route path="/case-studies" element={<CaseStudiesPage />} />
        <Route path="/legal-disclaimer" element={<LegalDisclaimerPage />} />

        {/* Pricing (accessible to authenticated users without subscription) */}
        <Route path="/pricing" element={<PricingPage />} />

        {/* Onboarding & Checkout Result */}
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />

        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected App Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
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
          <Route
            path="dashboard/policy-operations"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <PolicyOperationsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/policy-topics"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <PolicyTopicsViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/policy-compliance"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <PolicyComplianceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/case-timeline"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <CaseTimelineVisualizer />
              </ProtectedRoute>
            }
          />
          <Route path="dashboard/exhibits/viewer" element={<ExhibitViewer />} />
          <Route
            path="dashboard/demo-requests"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <DemoRequestsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/government-outreach"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <GovernmentOutreachDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/marketing"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <MarketingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/system-health"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <SystemHealthDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/discount-codes"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <DiscountCodesDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/evidence-management"
            element={
              <ProtectedRoute requiredPermission="canViewEvidenceManagement">
                <EvidenceManagementDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/evidence-processing"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <EvidenceProcessingTrace />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/system/workers"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <WorkerQueueMonitoring />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/policy-topic-registry"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <PolicyTopicRegistry />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/beta-verification"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <BetaDeploymentVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/policy-matrix"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <PolicyMatrixVirtualized />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/cpra-timeline"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <CpraCampaignTimeline />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/cpra-matrix"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <CpraMatrixDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/cpra-autonomous"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <CpraAutonomousDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="dashboard/usage" element={<UsageDashboard />} />
          <Route
            path="dashboard/evidence-requests"
            element={
              <ProtectedRoute requiredPermission="canViewEvidence">
                <EvidenceRequestsDashboard />
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
            <Route
              path="trial-exhibits"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <TrialExhibitWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="litigation-strategy"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <LitigationStrategyView />
                </ProtectedRoute>
              }
            />
            <Route
              path="contradictions"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <ContradictionDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="narrative-analysis"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <NarrativeAnalysisPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
