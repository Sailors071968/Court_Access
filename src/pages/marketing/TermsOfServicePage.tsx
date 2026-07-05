// ============================================================================
// Terms of Service Page — Program 0 Production Website
// ============================================================================

import { LegalDocumentLayout, LegalSection } from '../../components/marketing/LegalDocumentLayout';

export function TermsOfServicePage() {
  return (
    <LegalDocumentLayout title="Terms of Service" lastUpdated="July 5, 2026">
      <LegalSection title="Agreement to Terms">
        <p>
          By accessing or using CourtAccess at courtaccess.net, you agree to be bound by
          these Terms of Service. If you do not agree, do not use the platform.
        </p>
      </LegalSection>

      <LegalSection title="Description of Service">
        <p>
          CourtAccess provides a criminal case intelligence platform including document
          management, evidence analysis, legal research tools, workbench applications, and
          collaboration features for California criminal litigation. CourtAccess is a
          technology platform — not a law firm — and does not provide legal advice.
        </p>
      </LegalSection>

      <LegalSection title="Account Registration">
        <p>You must provide accurate registration information and maintain the security of your credentials. You are responsible for all activity under your account. The Primary Account Owner is responsible for billing, delegated access, and permission configuration.</p>
      </LegalSection>

      <LegalSection title="Universal Subscription">
        <p>
          Every subscriber receives access to the complete CourtAccess platform. Subscription
          plans differ by case complexity and usage — not by profession or feature tier.
          Authorization to view specific organizations, cases, documents, and evidence is
          determined exclusively by ownership and delegated permissions.
        </p>
      </LegalSection>

      <LegalSection title="Delegated Access">
        <p>
          Primary Account Owners may invite up to five additional users (limit subject to
          plan expansion). Each designee receives independent login credentials. The Primary
          Account Owner configures per-case and per-resource permissions. Unauthorized
          information must not be inferable by restricted users.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable Use">
        <p>You agree not to:</p>
        <p>Upload unlawful content or content you lack authorization to store.</p>
        <p>Attempt to access other tenants&apos; data or circumvent security controls.</p>
        <p>Reverse engineer, scrape, or overload platform infrastructure.</p>
        <p>Use the platform for any purpose that violates applicable law.</p>
        <p>Misrepresent AI-generated analysis as verified legal conclusions without independent review.</p>
      </LegalSection>

      <LegalSection title="Case Data & Evidence">
        <p>
          You retain ownership of case data you upload. You grant CourtAccess a limited license
          to process, store, and analyze your data solely to provide the service. Original
          evidence files remain immutable. You are responsible for ensuring you have legal
          authority to upload and share all case materials.
        </p>
      </LegalSection>

      <LegalSection title="AI-Generated Content">
        <p>
          CourtAccess uses artificial intelligence to assist with document analysis,
          contradiction detection, and classification. AI outputs may contain errors.
          You must independently verify all AI-generated content before use in legal
          proceedings. CourtAccess makes no warranties regarding AI accuracy.
        </p>
      </LegalSection>

      <LegalSection title="Billing & Subscriptions">
        <p>
          Paid subscriptions are billed monthly or annually through Stripe. Free trials
          convert to paid plans unless cancelled before the trial ends. Refunds are handled
          per our refund policy. Failed payments may result in service suspension after
          retry attempts. You may manage billing through the Stripe Customer Portal.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          You may cancel your subscription at any time. We may suspend or terminate accounts
          that violate these Terms or pose security risks. Upon termination, you may export
          your data during a grace period before deletion.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of Warranties">
        <p>
          THE PLATFORM IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. COURTACCESS
          DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT
          ANALYSIS RESULTS WILL BE ACCURATE OR COMPLETE. SEE OUR LEGAL DISCLAIMER FOR
          ADDITIONAL INFORMATION.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, COURTACCESS SHALL NOT BE LIABLE FOR
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
          OF DATA, PROFITS, OR GOODWILL ARISING FROM YOUR USE OF THE PLATFORM.
        </p>
      </LegalSection>

      <LegalSection title="Governing Law">
        <p>These Terms are governed by the laws of the State of California, without regard to conflict of law principles.</p>
      </LegalSection>

      <LegalSection title="Changes to Terms">
        <p>We may modify these Terms at any time. Material changes will be notified via email or platform notice. Continued use constitutes acceptance of revised Terms.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms:{' '}
          <a href="mailto:legal@courtaccess.net" className="text-amber-400 hover:text-amber-300">
            legal@courtaccess.net
          </a>
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
