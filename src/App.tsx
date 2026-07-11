// ============================================
// Court Access — Main App Router
// Route-level code splitting: every route below the public landing page is
// lazy-loaded so heavy dependencies (three.js, recharts, workspace bundles)
// are fetched only when their route is visited, keeping first paint fast.
// ============================================

import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Landing page stays eager: it is the root route and must paint immediately.
import { LandingPage } from './pages/LandingPage';

// Helper: adapt a named export into the default shape React.lazy expects.
function named<T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  key: keyof T,
): ComponentType {
  return lazy(() =>
    loader().then((m) => ({ default: m[key] as ComponentType })),
  );
}

// Pricing (same module as landing)
const PricingPage = named(() => import('./pages/LandingPage'), 'PricingPage');

// Public Marketing Pages
const ForDefensePage = named(() => import('./pages/ForDefensePage'), 'ForDefensePage');
const ForProsecutorsPage = named(() => import('./pages/ForProsecutorsPage'), 'ForProsecutorsPage');
const GovernmentPage = named(() => import('./pages/GovernmentPage'), 'GovernmentPage');
const ContactSalesPage = named(() => import('./pages/ContactSalesPage'), 'ContactSalesPage');
const CaseStudiesPage = named(() => import('./pages/CaseStudiesPage'), 'CaseStudiesPage');
const LegalDisclaimerPage = named(() => import('./pages/LegalDisclaimerPage'), 'LegalDisclaimerPage');
const AboutPage = named(() => import('./pages/marketing/AboutPage'), 'AboutPage');
const FeaturesPage = named(() => import('./pages/marketing/FeaturesPage'), 'FeaturesPage');
const FAQPage = named(() => import('./pages/marketing/FAQPage'), 'FAQPage');
const PrivacyPolicyPage = named(() => import('./pages/marketing/PrivacyPolicyPage'), 'PrivacyPolicyPage');
const TermsOfServicePage = named(() => import('./pages/marketing/TermsOfServicePage'), 'TermsOfServicePage');
const HowItWorksPage = named(() => import('./pages/marketing/HowItWorksPage'), 'HowItWorksPage');
const SecurityPage = named(() => import('./pages/marketing/SecurityPage'), 'SecurityPage');
const BlogPage = named(() => import('./pages/marketing/BlogPage'), 'BlogPage');
const KnowledgeBasePage = named(() => import('./pages/marketing/KnowledgeBasePage'), 'KnowledgeBasePage');
const SupportPage = named(() => import('./pages/marketing/SupportPage'), 'SupportPage');
const AccessibilityPage = named(() => import('./pages/marketing/AccessibilityPage'), 'AccessibilityPage');
const SitemapPage = named(() => import('./pages/marketing/SitemapPage'), 'SitemapPage');
const PressPage = named(() => import('./pages/marketing/PressPage'), 'PressPage');
const CareersPage = named(() => import('./pages/marketing/CareersPage'), 'CareersPage');
const AttorneyPage = named(() => import('./pages/marketing/AudiencePages'), 'AttorneyPage');
const InvestigatorPage = named(() => import('./pages/marketing/AudiencePages'), 'InvestigatorPage');
const DefendantPage = named(() => import('./pages/marketing/AudiencePages'), 'DefendantPage');
const FamiliesPage = named(() => import('./pages/marketing/AudiencePages'), 'FamiliesPage');
const ExpertsAudiencePage = named(() => import('./pages/marketing/AudiencePages'), 'ExpertsPage');

// Auth / onboarding
const LoginPage = named(() => import('./pages/auth/LoginPage'), 'LoginPage');
const RegisterPage = named(() => import('./pages/auth/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = named(() => import('./pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = named(() => import('./pages/auth/ResetPasswordPage'), 'ResetPasswordPage');
const VerifyEmailPage = named(() => import('./pages/auth/VerifyEmailPage'), 'VerifyEmailPage');
const RoleOnboardingPage = named(() => import('./pages/onboarding/RoleOnboardingPage'), 'RoleOnboardingPage');
const AcceptInvitationPage = named(() => import('./pages/auth/AcceptInvitationPage'), 'AcceptInvitationPage');
const FirmOperatingPlatformPage = named(() => import('./pages/organization/FirmOperatingPlatformPage'), 'FirmOperatingPlatformPage');
const OrganizationSettingsPage = named(() => import('./pages/organization/OrganizationSettingsPage'), 'OrganizationSettingsPage');
const OrganizationOnboardingPage = named(() => import('./pages/organization/OrganizationOnboardingPage'), 'OrganizationOnboardingPage');

// Dashboards
const DashboardRouter = named(() => import('./pages/dashboard/DashboardRouter'), 'DashboardRouter');
const DemoRequestsDashboard = named(() => import('./pages/dashboard/DemoRequestsDashboard'), 'DemoRequestsDashboard');
const GovernmentOutreachDashboard = named(() => import('./pages/dashboard/GovernmentOutreachDashboard'), 'GovernmentOutreachDashboard');
const MarketingDashboard = named(() => import('./pages/dashboard/MarketingDashboard'), 'MarketingDashboard');
const PolicyPipelineDashboard = named(() => import('./pages/dashboard/PolicyPipelineDashboard'), 'PolicyPipelineDashboard');
const PolicyIntelligenceDashboard = named(() => import('./pages/dashboard/PolicyIntelligenceDashboard'), 'PolicyIntelligenceDashboard');
const RepositoryIntegrityDashboard = named(() => import('./pages/dashboard/RepositoryIntegrityDashboard'), 'RepositoryIntegrityDashboard');
const CpraDashboard = named(() => import('./pages/dashboard/CpraDashboard'), 'CpraDashboard');
const SystemHealthDashboard = named(() => import('./pages/dashboard/SystemHealthDashboard'), 'SystemHealthDashboard');
const DiscountCodesDashboard = named(() => import('./pages/dashboard/DiscountCodesDashboard'), 'DiscountCodesDashboard');
const PolicyOperationsDashboard = named(() => import('./pages/dashboard/PolicyOperationsDashboard'), 'PolicyOperationsDashboard');
const PolicyTopicsViewer = named(() => import('./pages/dashboard/PolicyTopicsViewer'), 'PolicyTopicsViewer');
const PolicyComplianceDashboard = named(() => import('./pages/dashboard/PolicyComplianceDashboard'), 'PolicyComplianceDashboard');
const CaseTimelineVisualizer = named(() => import('./pages/dashboard/CaseTimelineVisualizer'), 'CaseTimelineVisualizer');
const ExhibitViewer = lazy(() => import('./pages/dashboard/exhibits/ExhibitViewer'));
const EvidenceManagementDashboard = named(() => import('./pages/dashboard/EvidenceManagementDashboard'), 'EvidenceManagementDashboard');
const EvidenceProcessingTrace = named(() => import('./pages/dashboard/EvidenceProcessingTrace'), 'EvidenceProcessingTrace');
const WorkerQueueMonitoring = named(() => import('./pages/dashboard/WorkerQueueMonitoring'), 'WorkerQueueMonitoring');
const PolicyTopicRegistry = named(() => import('./pages/dashboard/PolicyTopicRegistry'), 'PolicyTopicRegistry');
const BetaDeploymentVerification = named(() => import('./pages/dashboard/BetaDeploymentVerification'), 'BetaDeploymentVerification');
const PolicyMatrixVirtualized = named(() => import('./pages/dashboard/PolicyMatrixVirtualized'), 'PolicyMatrixVirtualized');
const CpraCampaignTimeline = named(() => import('./pages/dashboard/CpraCampaignTimeline'), 'CpraCampaignTimeline');
const CpraMatrixDashboard = named(() => import('./pages/dashboard/CpraMatrixDashboard'), 'CpraMatrixDashboard');
const CpraAutonomousDashboard = named(() => import('./pages/dashboard/CpraAutonomousDashboard'), 'CpraAutonomousDashboard');
const UsageDashboard = named(() => import('./pages/dashboard/UsageDashboard'), 'UsageDashboard');
const EvidenceRequestsDashboard = named(() => import('./pages/dashboard/EvidenceRequestsDashboard'), 'EvidenceRequestsDashboard');
const CasesListPage = named(() => import('./pages/CasesListPage'), 'CasesListPage');
const SearchPage = named(() => import('./pages/SearchPage'), 'SearchPage');
const NotificationsPage = named(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const AccountSettingsPage = named(() => import('./pages/membership/AccountSettingsPage'), 'AccountSettingsPage');
const SharedAccessPage = named(() => import('./pages/membership/SharedAccessPage'), 'SharedAccessPage');
const AdminPage = named(() => import('./pages/admin/AdminPage'), 'AdminPage');
const OperationsCommandCenter = named(() => import('./pages/admin/OperationsCommandCenter'), 'OperationsCommandCenter');

// Case Pages
const CaseLayout = named(() => import('./pages/case/CaseLayout'), 'CaseLayout');
const CaseOverviewPage = named(() => import('./pages/case/CaseOverviewPage'), 'CaseOverviewPage');
const ChargesPage = named(() => import('./pages/case/ChargesPage'), 'ChargesPage');
const EvidencePage = named(() => import('./pages/case/EvidencePage'), 'EvidencePage');
const ExpertsPage = named(() => import('./pages/case/ExpertsPage'), 'ExpertsPage');
const MotionsPage = named(() => import('./pages/case/MotionsPage'), 'MotionsPage');
const ResearchPage = named(() => import('./pages/case/ResearchPage'), 'ResearchPage');
const ActivityPage = named(() => import('./pages/case/ActivityPage'), 'ActivityPage');
const DocumentsPage = named(() => import('./pages/case/DocumentsPage'), 'DocumentsPage');
const CaseSettingsPage = named(() => import('./pages/case/CaseSettingsPage'), 'CaseSettingsPage');
const TrialExhibitWorkspace = named(() => import('./pages/case/TrialExhibitWorkspace'), 'TrialExhibitWorkspace');
const LitigationStrategyView = named(() => import('./pages/case/LitigationStrategyView'), 'LitigationStrategyView');
const ContradictionDashboardPage = named(() => import('./pages/case/ContradictionDashboardPage'), 'ContradictionDashboardPage');
const NarrativeAnalysisPage = named(() => import('./pages/case/NarrativeAnalysisPage'), 'NarrativeAnalysisPage');
const AttorneyWorkbenchPage = named(() => import('./pages/case/AttorneyWorkbenchPage'), 'AttorneyWorkbenchPage');
const InvestigatorWorkbenchPage = named(() => import('./pages/case/InvestigatorWorkbenchPage'), 'InvestigatorWorkbenchPage');

// Client Portal
const ClientPortalLayout = named(() => import('./pages/client-portal/ClientPortalLayout'), 'ClientPortalLayout');
const ClientPortalIndex = named(() => import('./pages/client-portal/ClientPortalLayout'), 'ClientPortalIndex');
const ClientPortalDashboardPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalDashboardPage');
const ClientPortalCourtDatesPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalCourtDatesPage');
const ClientPortalMessagesPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalMessagesPage');
const ClientPortalDocumentsPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalDocumentsPage');
const ClientPortalEvidencePage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalEvidencePage');
const ClientPortalTimelinePage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalTimelinePage');
const ClientPortalTasksPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalTasksPage');
const ClientPortalBillingPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalBillingPage');
const ClientPortalNotificationsPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalNotificationsPage');
const ClientPortalUploadsPage = named(() => import('./pages/client-portal/ClientPortalPages'), 'ClientPortalUploadsPage');
const DocumentRedactionPage = named(() => import('./pages/redaction/DocumentRedactionPage'), 'DocumentRedactionPage');
const DisclosureManagerPage = named(() => import('./pages/disclosure/DisclosureManagerPage'), 'DisclosureManagerPage');

function RouteFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: '#64748b',
        fontSize: '0.875rem',
      }}
      role="status"
      aria-live="polite"
    >
      Loading…
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
