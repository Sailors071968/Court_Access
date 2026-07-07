// ============================================================================
// CourtAccess — Case Studies Page (/case-studies)
// Phase 212: Fictional/sanitized case study examples
// ============================================================================

import { Link } from 'react-router-dom';
import {
  Scale,
  Lock,
  ArrowRight,
  Shield,
  Clock,
  Map,
  Layers,
  Search,
  ChevronRight,
} from 'lucide-react';

const caseStudies = [
  {
    id: 'policy-comparison',
    icon: Shield,
    title: 'Policy Comparison Analysis',
    subtitle: 'Use-of-Force Incident — Multi-Officer Response',
    description: 'A defense team needed to compare the actions of four responding officers against their department\'s use-of-force policy during a single incident.',
    challenge: 'The department\'s use-of-force policy was 47 pages long. Cross-referencing each officer\'s actions against specific policy sections required manual review of body camera footage, dispatch records, and incident reports.',
    solution: 'CourtAccess ingested the department policy, all four body camera recordings, the dispatch log, and the incident reports. The system automatically identified officer actions and mapped them to relevant policy sections.',
    results: [
      'Identified 23 distinct officer actions across 4 officers',
      'Mapped each action to specific policy sections',
      'Generated a structured comparison report in 12 minutes',
      'Highlighted 6 potential procedural inconsistencies for legal review',
    ],
    color: 'amber',
  },
  {
    id: 'timeline-reconstruction',
    icon: Clock,
    title: 'Timeline Reconstruction',
    subtitle: 'Traffic Stop Escalation — Conflicting Accounts',
    description: 'An appellate team needed to reconstruct the precise sequence of events during a traffic stop that escalated, with conflicting accounts from officers and witnesses.',
    challenge: 'Three different accounts described events in different orders. Bodycam footage from two officers had different timestamps. Witness statements contradicted portions of the official report.',
    solution: 'CourtAccess synchronized all evidence sources — bodycam footage, dashcam video, dispatch audio, and written statements — into a unified timeline with evidence-linked timestamps.',
    results: [
      'Synchronized 5 separate evidence sources into one timeline',
      'Identified 4 chronological discrepancies between accounts',
      'Mapped each event to its supporting evidence',
      'Generated an annotated timeline exhibit for court presentation',
    ],
    color: 'blue',
  },
  {
    id: 'forensic-reconstruction',
    icon: Map,
    title: 'Forensic Reconstruction',
    subtitle: 'Nighttime Pursuit — Visibility and Line-of-Sight Analysis',
    description: 'A defense team challenged the officer\'s account of visual identification during a nighttime foot pursuit, questioning whether the officer could have seen what was described.',
    challenge: 'The incident occurred at night in an area with limited street lighting. The officer\'s report described visual details that the defense believed were inconsistent with the lighting conditions.',
    solution: 'CourtAccess reconstructed the scene using aerial mapping data, street lighting records, and the officer\'s described position. The system modeled line-of-sight and lighting conditions.',
    results: [
      'Generated 3D scene reconstruction with accurate lighting model',
      'Calculated line-of-sight from the officer\'s described position',
      'Produced visibility analysis at the reported time of observation',
      'Created interactive trial exhibit showing lighting conditions',
    ],
    color: 'emerald',
  },
  {
    id: 'multi-agency',
    icon: Layers,
    title: 'Multi-Agency Investigation',
    subtitle: 'Joint Task Force Operation — Cross-Jurisdictional Evidence',
    description: 'A case involved officers from three different agencies, each with different policies, procedures, and reporting standards.',
    challenge: 'Evidence was spread across three agencies with different formats, different policy standards, and different reporting structures. Coordinating the analysis manually would have taken weeks.',
    solution: 'CourtAccess ingested evidence from all three agencies, identified the relevant policies for each department, and analyzed officer conduct against their respective department standards.',
    results: [
      'Consolidated evidence from 3 separate agencies',
      'Applied correct department policies to each officer\'s actions',
      'Identified inter-agency communication gaps',
      'Generated per-agency compliance analysis reports',
    ],
    color: 'purple',
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; light: string }> = {
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', light: 'bg-amber-50' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', light: 'bg-blue-50' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', light: 'bg-emerald-50' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', light: 'bg-purple-50' },
};

function CaseStudyNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scale className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold text-white">CourtAccess</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/for-defense" className="text-sm text-slate-400 hover:text-white transition-colors">For Defense</Link>
            <Link to="/for-prosecutors" className="text-sm text-slate-400 hover:text-white transition-colors">For Prosecutors</Link>
            <Link to="/government" className="text-sm text-slate-400 hover:text-white transition-colors">Government</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white font-medium transition-colors">Sign In</Link>
            <Link to="/register" className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-white/5">
      <CaseStudyNav />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-8">
            <Search className="text-amber-400" size={16} />
            <span className="text-amber-300 text-sm font-medium">Case Studies</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Evidence Intelligence in Action
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Explore how CourtAccess analytical tools have been applied to representative
            case scenarios. All examples use fictional or sanitized data.
          </p>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-6 bg-amber-50 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-amber-800 text-center">
            <strong>Note:</strong> All case studies presented below use fictional scenarios and sanitized data
            for demonstration purposes. No real case information is depicted.
          </p>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {caseStudies.map((cs) => {
            const colors = colorMap[cs.color];
            return (
              <article key={cs.id} className="bg-white/5 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className={`${colors.light} ${colors.border} border-b p-8`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
                      <cs.icon className={colors.text} size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-1">{cs.title}</h2>
                      <p className="text-sm text-slate-500">{cs.subtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  {/* Description */}
                  <div>
                    <p className="text-slate-700 leading-relaxed">{cs.description}</p>
                  </div>

                  {/* Challenge */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Challenge</h3>
                    <p className="text-slate-600 leading-relaxed">{cs.challenge}</p>
                  </div>

                  {/* Solution */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">How CourtAccess Helped</h3>
                    <p className="text-slate-600 leading-relaxed">{cs.solution}</p>
                  </div>

                  {/* Results */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Results</h3>
                    <ul className="space-y-2">
                      {cs.results.map((result) => (
                        <li key={result} className="flex items-start gap-2 text-sm text-slate-700">
                          <ChevronRight className={`${colors.text} shrink-0 mt-0.5`} size={14} />
                          <span>{result}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            See CourtAccess in Action
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
            Start analyzing evidence today or contact our team for enterprise licensing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
            >
              Start Your First Case Analysis
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition-colors border border-white/20"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Scale className="text-white" size={16} />
              </div>
              <span className="text-white font-semibold">CourtAccess</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Lock size={14} />
              <span>Criminal Evidence Intelligence Platform</span>
            </div>
            <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} CourtAccess. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
