// ============================================
// Court Access — Security Page
// ============================================

import { Link } from 'react-router-dom';
import { Scale, Shield, Lock, FileSearch, ArrowRight, Database, Eye, Hash } from 'lucide-react';
import { useEffect } from 'react';

export function SecurityPage() {
  useEffect(() => {
    document.title = 'Security — Court Access';
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
          <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-800 rounded-2xl mb-6">
            <Shield className="text-amber-400" size={28} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            Security & Integrity
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Court Access is built with evidence-grade security. Every layer of the platform is designed
            to protect your data, verify integrity, and maintain an immutable audit trail.
          </p>
        </div>
      </section>

      {/* Security Sections */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-16">
          {/* Deterministic Analysis */}
          <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileSearch className="text-amber-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Deterministic Analysis</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Court Access produces the same structured output for the same input, every time. There is no
                randomness, no model drift, and no hallucination. Every extraction is reproducible and verifiable.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Same document always produces identical structured results
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  No probabilistic AI — only deterministic extraction and mapping
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Outputs are auditable and court-admissible by design
                </li>
              </ul>
            </div>
          </div>

          {/* Cryptographic Document Hashing */}
          <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Hash className="text-amber-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Cryptographic Document Hashing</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Every document is hashed with SHA-256 at the moment of ingestion. This creates a tamper-proof
                fingerprint that can be verified at any point in the future. Any modification — even a single
                byte — will produce a different hash, immediately flagging tampering.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  SHA-256 content hash computed on upload
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Hash-chained analysis pipeline for end-to-end integrity
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Daily anchor chain with Merkle root verification
                </li>
              </ul>
            </div>
          </div>

          {/* Tenant-Isolated Case Storage */}
          <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Database className="text-amber-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Tenant-Isolated Case Storage</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Every case and every tenant is isolated at the data layer. There is no shared state between
                tenants, and cross-tenant access is structurally impossible. Tenant boundaries are enforced
                at every query, every API call, and every data export.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Strict tenant ID enforcement on all database queries
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  No cross-tenant data leakage by design
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Role-based access control within each tenant
                </li>
              </ul>
            </div>
          </div>

          {/* Immutable Audit Trail */}
          <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Eye className="text-amber-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Immutable Audit Trail</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Every action in Court Access — document uploads, analysis runs, exports, and user actions —
                is recorded in an immutable, hash-chained audit log. Logs cannot be modified or deleted after
                creation. This ensures full traceability for compliance and court admissibility.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Hash-chained event log with sequential integrity
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  No retroactive modification of audit records
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Deterministic audit trace with reproducibility verification
                </li>
              </ul>
            </div>
          </div>

          {/* Evidence Preservation Integrity */}
          <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Lock className="text-amber-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Evidence Preservation Integrity</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Court Access treats every uploaded document as potential evidence. Original files are preserved
                exactly as uploaded, with cryptographic proof of their unaltered state. The platform generates
                verifiable evidence packets that can be independently validated.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Original document bytes preserved without modification
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  CAPS v1.0 public proof standard for evidence verification
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#x2022;</span>
                  Hybrid signature model (RSA + Ed25519) for document signing
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-800 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white">Security questions?</h2>
          <p className="mt-3 text-slate-300">
            Contact us at{' '}
            <a href="mailto:security@courtaccess.net" className="text-amber-400 hover:text-amber-300 underline">
              security@courtaccess.net
            </a>{' '}
            for our full security documentation or to schedule a review.
          </p>
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
            <Link to="/security" className="text-xs text-slate-400 hover:text-white">Security</Link>
            <Link to="/" className="text-xs text-slate-400 hover:text-white">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
