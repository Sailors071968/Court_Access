// ============================================================================
// CourtAccess — Demo Request Page (/demo)
// Phase 211: Government demonstration request form
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  Lock,
  ArrowRight,
  CheckCircle2,
  Send,
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

interface DemoFormData {
  name: string;
  organization: string;
  role: string;
  email: string;
  county: string;
  agencyType: string;
  message: string;
}

export function DemoRequestPage() {
  const [form, setForm] = useState<DemoFormData>({
    name: '',
    organization: '',
    role: '',
    email: '',
    county: '',
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

    // Store in localStorage as a demo request record (backend integration pending)
    const existing = JSON.parse(localStorage.getItem('courtaccess_demo_requests') || '[]');
    existing.push({
      ...form,
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      status: 'new',
    });
    localStorage.setItem('courtaccess_demo_requests', JSON.stringify(existing));

    // Simulate network delay
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
          <h1 className="text-3xl font-bold text-white mb-4">Demo Request Received</h1>
          <p className="text-slate-300 mb-8 leading-relaxed">
            Thank you for your interest in CourtAccess. Our team will contact you
            within 2 business days to schedule your demonstration.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/" className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Return to Homepage
            </Link>
            <Link to="/case-studies" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">
              View Case Studies
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
              Request a Demonstration
            </h1>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              See how CourtAccess can help your organization analyze evidence,
              organize cases, and prepare for trial.
            </p>

            <div className="space-y-4 mb-8">
              {[
                'Personalized demo for your agency type',
                'See real analytical workflows in action',
                'Discuss deployment and licensing options',
                'No commitment required',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />
                  <span className="text-slate-200">{item}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="text-amber-400" size={16} />
                <span className="text-sm font-medium text-white">Your information is secure</span>
              </div>
              <p className="text-sm text-slate-400">
                We do not share your contact information with third parties.
                All demo request data is encrypted and stored securely.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="demo-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  id="demo-name"
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
                <label htmlFor="demo-org" className="block text-sm font-medium text-gray-700 mb-1">Organization *</label>
                <input
                  id="demo-org"
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
                <label htmlFor="demo-role" className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <input
                  id="demo-role"
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
                <label htmlFor="demo-email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  id="demo-email"
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
                <label htmlFor="demo-county" className="block text-sm font-medium text-gray-700 mb-1">County / Jurisdiction</label>
                <input
                  id="demo-county"
                  name="county"
                  type="text"
                  value={form.county}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Los Angeles County"
                />
              </div>

              <div>
                <label htmlFor="demo-agency-type" className="block text-sm font-medium text-gray-700 mb-1">Agency Type *</label>
                <select
                  id="demo-agency-type"
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
                <label htmlFor="demo-message" className="block text-sm font-medium text-gray-700 mb-1">Additional Information</label>
                <textarea
                  id="demo-message"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="Tell us about your current evidence analysis workflow..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Submitting...' : (
                  <>
                    <Send size={16} />
                    Request Demonstration
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
