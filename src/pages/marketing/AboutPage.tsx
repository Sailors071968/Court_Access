// ============================================
// Court Access — About Page
// ============================================

import { Link } from 'react-router-dom';
import { Scale, Shield, Lock, FileSearch, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

export function AboutPage() {
  useEffect(() => {
    document.title = 'About — Court Access';
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center">
              <Scale className="text-amber-400" size={18} />
            </div>
            <span className="text-lg font-semibold text-slate-900 tracking-tight">Court Access</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2">Sign in</Link>
            <Link to="/signup" className="text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors">
              Start Free Analysis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 bg-slate-50 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            Built for the defense
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Court Access is a structured court record analysis platform designed for defense attorneys,
            investigators, and legal teams who need reliable, auditable intelligence from court documents.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Our mission</h2>
          <div className="space-y-4 text-gray-600 leading-relaxed">
            <p>
              Every defendant deserves a thorough review of their court records. But the volume of
              filings, evidence, and procedural documents has grown faster than defense teams can keep up.
            </p>
            <p>
              Court Access exists to close that gap — not by replacing attorneys, but by giving them
              structured, deterministic tools that surface what matters. No AI opinions. No hallucinated
              case law. Just the facts, mapped and organized.
            </p>
            <p>
              We believe legal technology should be transparent, auditable, and built with the same
              rigor expected in a courtroom.
            </p>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="py-16 bg-slate-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Core principles</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: FileSearch,
                title: 'Deterministic analysis',
                desc: 'Same document, same output. Every time. No randomness, no model drift, no hallucination.',
              },
              {
                icon: Lock,
                title: 'Cryptographic integrity',
                desc: 'Every document hashed on ingestion. Every analysis step hash-chained for tamper detection.',
              },
              {
                icon: Shield,
                title: 'Tenant isolation',
                desc: 'Each case and tenant cryptographically separated. No cross-contamination, no data leaks.',
              },
              {
                icon: Scale,
                title: 'Constitutional compliance',
                desc: 'The system self-polices against scope creep. Analysis stays within defined boundaries.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white p-6 rounded-xl border border-gray-100">
                <item.icon className="text-amber-600 mb-3" size={22} />
                <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-800 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white">See it for yourself</h2>
          <p className="mt-3 text-slate-300">Upload your first document free. No credit card required.</p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-xl font-medium hover:bg-amber-400 transition-colors"
          >
            Start Free Analysis <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} Court Access. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs text-slate-400 hover:text-white">Privacy</Link>
            <Link to="/terms" className="text-xs text-slate-400 hover:text-white">Terms</Link>
            <Link to="/" className="text-xs text-slate-400 hover:text-white">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
