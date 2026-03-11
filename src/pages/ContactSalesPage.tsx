// ============================================================================
// CourtAccess — Contact Sales Page (/contact)
// Phase 220: Simple enterprise contact form replacing demo request
// Submissions stored to GovernmentLead and visible in /dashboard/government-outreach
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  CheckCircle2,
  Send,
  Building2,
} from 'lucide-react';

const AGENCY_TYPES = [
  'District Attorney Office',
  'Public Defender Office',
  'Criminal Defense Firm',
  'State Agency',
  'Federal Defender Office',
  'Investigation Agency',
  'Other',
] as const;

interface ContactFormData {
  name: string;
  organization: string;
  role: string;
  email: string;
  agencyType: string;
  message: string;
}

export function ContactSalesPage() {
  const [form, setForm] = useState<ContactFormData>({
    name: '',
    organization: '',
    role: '',
    email: '',
    agencyType: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Store as GovernmentLead in localStorage (visible in /dashboard/government-outreach)
    const existing = JSON.parse(localStorage.getItem('courtaccess_government_leads') || '[]');
    existing.push({
      id: crypto.randomUUID(),
      agencyName: form.organization,
      contactName: form.name,
      role: form.role,
      email: form.email,
      county: '',
      status: 'new',
      notes: form.message,
      agencyType: form.agencyType,
      seatEstimate: 0,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('courtaccess_government_leads', JSON.stringify(existing));

    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Message Received</h1>
          <p className="text-slate-300 mb-8 leading-relaxed">
            Thank you for reaching out. Our team will respond within 2 business days
            to discuss how CourtAccess can support your organization.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/" className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Return to Homepage
            </Link>
            <Link to="/register" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">
              Create Your Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800">
      {/* Nav */}
      <nav className="border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <Scale className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold text-white">CourtAccess</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-slate-300 hover:text-white font-medium transition-colors">Sign In</Link>
              <Link to="/register" className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Info */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Contact Sales
            </h1>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Interested in enterprise licensing or government deployment?
              Our team will help you find the right plan for your organization.
            </p>

            <div className="space-y-4 mb-8">
              {[
                'Enterprise licensing for offices of any size',
                'Multi-office and multi-jurisdiction deployment',
                'Dedicated onboarding and support',
                'Government procurement assistance',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />
                  <span className="text-slate-200">{item}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="text-amber-400" size={16} />
                <span className="text-sm font-medium text-white">Looking to get started right away?</span>
              </div>
              <p className="text-sm text-slate-400">
                You can <Link to="/register" className="text-amber-400 hover:text-amber-300 underline">create your account</Link> and
                start analyzing your first case immediately. Contact sales for enterprise pricing and volume licensing.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Jane Smith"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-org" className="block text-sm font-medium text-gray-700 mb-1">Organization *</label>
                <input
                  id="contact-org"
                  name="organization"
                  type="text"
                  value={form.organization}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Los Angeles County DA Office"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-role" className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <input
                  id="contact-role"
                  name="role"
                  type="text"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Chief Deputy District Attorney"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="jane.smith@agency.gov"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-agency-type" className="block text-sm font-medium text-gray-700 mb-1">Agency Type *</label>
                <select
                  id="contact-agency-type"
                  name="agencyType"
                  value={form.agencyType}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  required
                >
                  <option value="">Select agency type</option>
                  {AGENCY_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="Tell us about your organization and what you're looking for..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Sending...' : (
                  <>
                    <Send size={16} />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
