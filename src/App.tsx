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
import { AboutPage } from './pages/marketing/AboutPage';
import { FeaturesPage } from './pages/marketing/FeaturesPage';
import { FAQPage } from './pages/marketing/FAQPage';
import { PrivacyPolicyPage } from './pages/marketing/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/marketing/TermsOfServicePage';
import { HowItWorksPage } from './pages/marketing/HowItWorksPage';
import { SecurityPage } from './pages/marketing/SecurityPage';
import { BlogPage } from './pages/marketing/BlogPage';
import { KnowledgeBasePage } from './pages/marketing/KnowledgeBasePage';
import { SupportPage } from './pages/marketing/SupportPage';
import { AccessibilityPage } from './pages/marketing/AccessibilityPage';
import { SitemapPage } from './pages/marketing/SitemapPage';
import { PressPage } from './pages/marketing/PressPage';
import { CareersPage } from './pages/marketing/CareersPage';
import {
  AttorneyPage,
  InvestigatorPage,
  DefendantPage,
  FamiliesPage,
  ExpertsPage as ExpertsAudiencePage,
} from './pages/marketing/AudiencePages';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { RoleOnboardingPage } from './pages/onboarding/RoleOnboardingPage';
import { AcceptInvitationPage } from './pages/auth/AcceptInvitationPage';
import { FirmOperatingPlatformPage } from './pages/organization/FirmOperatingPlatformPage';
import { OrganizationSettingsPage } from './pages/organization/OrganizationSettingsPage';
import { OrganizationOnboardingPage } from './pages/organization/OrganizationOnboardingPage';

// Main Pages — Dashboard Router (role-based)
import { DashboardRouter } from './pages/dashboard/DashboardRouter';
import { DemoRequestsDashboard } from './pages/dashboard/DemoRequestsDashboard';
import { GovernmentOutreachDashboard } from './pages/dashboard/GovernmentOutreachDashboard';
import { MarketingDashboard } from './pages/dashboard/MarketingDashboard';
import { PolicyPipelineDashboard } from './pages/dashboard/PolicyPipelineDashboard';
import { PolicyIntelligenceDashboard } from './pages/dashboard/PolicyIntelligenceDashboard';
import { RepositoryIntegrityDashboard } from './pages/dashboard/RepositoryIntegrityDashboard';
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
import { AccountSettingsPage } from './pages/membership/AccountSettingsPage';
import { SharedAccessPage } from './pages/membership/SharedAccessPage';
import { AdminPage } from './pages/admin/AdminPage';
import { OperationsCommandCenter } from './pages/admin/OperationsCommandCenter';
import { GoldStandardCertification } from './pages/admin/GoldStandardCertification';

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
import { AttorneyWorkbenchPage } from './pages/case/AttorneyWorkbenchPage';
import { InvestigatorWorkbenchPage } from './pages/case/InvestigatorWorkbenchPage';
import { ClientPortalLayout, ClientPortalIndex } from './pages/client-portal/ClientPortalLayout';
import {
  ClientPortalDashboardPage,
  ClientPortalCourtDatesPage,
  ClientPortalMessagesPage,
  ClientPortalDocumentsPage,
  ClientPortalEvidencePage,
  ClientPortalTimelinePage,
  ClientPortalTasksPage,
  ClientPortalBillingPage,
  ClientPortalNotificationsPage,
  ClientPortalUploadsPage,
} from './pages/client-portal/ClientPortalPages';
import { DocumentRedactionPage } from './pages/redaction/DocumentRedactionPage';
import { DisclosureManagerPage } from './pages/disclosure/DisclosureManagerPage';

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
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/case-studies" element={<CaseStudiesPage />} />
        <Route path="/legal-disclaimer" element={<LegalDisclaimerPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/attorney" element={<AttorneyPage />} />
        <Route path="/attorneys" element={<Navigate to="/attorney" replace />} />
        <Route path="/investigator" element={<InvestigatorPage />} />
        <Route path="/investigators" element={<Navigate to="/investigator" replace />} />
        <Route path="/defendant" element={<DefendantPage />} />
        <Route path="/defendants" element={<Navigate to="/defendant" replace />} />
        <Route path="/families" element={<FamiliesPage />} />
        <Route path="/experts" element={<ExpertsAudiencePage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/sitemap" element={<SitemapPage />} />
        <Route path="/press" element={<PressPage />} />
        <Route path="/careers" element={<CareersPage />} />

        {/* Pricing (accessible to authenticated users without subscription) */}
        <Route path="/pricing" element={<PricingPage />} />

        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/onboarding" element={<RoleOnboardingPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/organization/onboarding" element={<OrganizationOnboardingPage />} />

        {/* Client Portal — dedicated defendant/client experience */}
        <Route
          path="/client-portal"
          element={
            <ProtectedRoute>
              <ClientPortalLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientPortalIndex />} />
          <Route path="dashboard" element={<ClientPortalDashboardPage />} />
          <Route path="court-dates" element={<ClientPortalCourtDatesPage />} />
          <Route path="messages" element={<ClientPortalMessagesPage />} />
          <Route path="documents" element={<ClientPortalDocumentsPage />} />
          <Route path="evidence" element={<ClientPortalEvidencePage />} />
          <Route path="timeline" element={<ClientPortalTimelinePage />} />
          <Route path="tasks" element={<ClientPortalTasksPage />} />
          <Route path="billing" element={<ClientPortalBillingPage />} />
          <Route path="notifications" element={<ClientPortalNotificationsPage />} />
          <Route path="uploads" element={<ClientPortalUploadsPage />} />
        </Route>

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
            path="dashboard/repository-integrity"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <RepositoryIntegrityDashboard />
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
              <ProtectedRoute>
                <AccountSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="shared-access"
            element={
              <ProtectedRoute>
                <SharedAccessPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="firm"
            element={
              <ProtectedRoute requiredPermission="canViewSettings">
                <FirmOperatingPlatformPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="organization/settings"
            element={
              <ProtectedRoute requiredPermission="canViewSettings">
                <OrganizationSettingsPage />
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
            path="admin/operations"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin">
                <OperationsCommandCenter />
              </ProtectedRoute>
            }
          />
          {/* Gold Standard Certification is an internal QA module holding real
              discovery corpora, so it is restricted to administrators. The
              server enforces the same restriction independently. */}
          <Route
            path="admin/gold-standard"
            element={
              <ProtectedRoute requiredPermission="canViewAdmin" requiredRole="admin">
                <GoldStandardCertification />
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
              path="documents/:documentId/redact"
              element={
                <ProtectedRoute requiredPermission="canViewDocuments">
                  <DocumentRedactionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="disclosures"
              element={
                <ProtectedRoute requiredPermission="canViewDocuments">
                  <DisclosureManagerPage />
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
              path="investigator-workbench"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <InvestigatorWorkbenchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="attorney-workbench"
              element={
                <ProtectedRoute requiredPermission="canViewEvidence">
                  <AttorneyWorkbenchPage />
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
