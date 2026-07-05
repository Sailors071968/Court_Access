// ============================================================================
// Privacy Policy Page — Program 0 Production Website
// ============================================================================

import { LegalDocumentLayout, LegalSection } from '../../components/marketing/LegalDocumentLayout';

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy" lastUpdated="July 5, 2026">
      <LegalSection title="Introduction">
        <p>
          CourtAccess (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the CourtAccess platform at
          courtaccess.net. This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use our criminal case intelligence platform.
        </p>
      </LegalSection>

      <LegalSection title="Information We Collect">
        <p><strong className="text-slate-200">Account Information:</strong> Name, email address, organization, role, and authentication credentials when you register.</p>
        <p><strong className="text-slate-200">Case Data:</strong> Documents, evidence, notes, communications, and metadata you upload or create within the platform.</p>
        <p><strong className="text-slate-200">Usage Data:</strong> Log data, session history, feature usage, IP address, browser type, and device information.</p>
        <p><strong className="text-slate-200">Billing Information:</strong> Payment details processed by Stripe. We do not store full credit card numbers on our servers.</p>
        <p><strong className="text-slate-200">Communications:</strong> Messages you send through our contact forms or support channels.</p>
      </LegalSection>

      <LegalSection title="How We Use Your Information">
        <p>To provide, maintain, and improve the CourtAccess platform and its features.</p>
        <p>To process subscriptions, billing, and account management.</p>
        <p>To authenticate users, enforce permissions, and maintain audit logs.</p>
        <p>To analyze documents and evidence using AI-assisted tools at your direction.</p>
        <p>To send transactional emails (verification, password reset, billing notices).</p>
        <p>To respond to support requests and enterprise sales inquiries.</p>
        <p>To comply with legal obligations and protect against fraud or abuse.</p>
      </LegalSection>

      <LegalSection title="Case Data & Confidentiality">
        <p>
          Case data uploaded to CourtAccess is treated as confidential. We do not sell case
          data or use it to train general-purpose AI models. Tenant isolation ensures your
          data is segregated from other subscribers. Access within your account is controlled
          by delegated permissions you configure.
        </p>
      </LegalSection>

      <LegalSection title="Data Sharing">
        <p>We share information only in these circumstances:</p>
        <p><strong className="text-slate-200">Service Providers:</strong> Hosting, payment processing (Stripe), email delivery, and infrastructure partners bound by confidentiality agreements.</p>
        <p><strong className="text-slate-200">Delegated Users:</strong> Information you explicitly authorize through permission settings.</p>
        <p><strong className="text-slate-200">Legal Requirements:</strong> When required by law, court order, or to protect rights and safety.</p>
        <p>We do not sell personal information to third parties.</p>
      </LegalSection>

      <LegalSection title="Data Retention">
        <p>
          We retain account and case data for as long as your subscription is active. Upon
          account cancellation, data is retained for a limited period to allow export, then
          deleted in accordance with our data retention policy. Audit logs may be retained
          longer for security and compliance purposes.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We implement encryption in transit and at rest, multi-factor authentication,
          role-based access control, tenant isolation, and comprehensive audit logging.
          No system is completely secure; we encourage strong passwords and MFA for all accounts.
        </p>
      </LegalSection>

      <LegalSection title="Your Rights">
        <p>Depending on your jurisdiction, you may have the right to access, correct, delete, or export your personal data. California residents may have additional rights under the CCPA. Contact privacy@courtaccess.net to exercise these rights.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use essential cookies for authentication and session management. We do not use
          third-party advertising cookies. You can control cookie settings through your browser.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>CourtAccess is not intended for users under 18 years of age without parental or guardian authorization in connection with a legal case.</p>
      </LegalSection>

      <LegalSection title="Changes to This Policy">
        <p>We may update this Privacy Policy periodically. Material changes will be communicated via email or platform notice. Continued use after changes constitutes acceptance.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this Privacy Policy:{' '}
          <a href="mailto:privacy@courtaccess.net" className="text-amber-400 hover:text-amber-300">
            privacy@courtaccess.net
          </a>
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
