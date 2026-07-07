// ============================================
// Court Access — Charges Analysis Tab
// ============================================

import { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { EvidenceStatusBadge } from '../../components/common/StatusBadge';
import { getDefenseInsights } from '../../services/ai/defenseInsights';
import type { DefenseInsight } from '../../types';
import type { ChargeEntity } from '../../models/CaseModel';
import { useParams } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { fetchCase } from '../../services/caseApi';

export function ChargesPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeChargeIndex, setActiveChargeIndex] = useState(0);
  const [insights, setInsights] = useState<DefenseInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [charges, setCharges] = useState<ChargeEntity[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setLoading(true);
    fetchCase(caseId).then((c) => {
      if (cancelled) return;
      // If the backend returns charges for the case, use them; otherwise show empty
      setCharges((c as unknown as { charges?: ChargeEntity[] }).charges ?? []);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;
    setInsightsLoading(true);
    getDefenseInsights({ caseId }).then((res) => {
      setInsights(res.insights);
      setInsightsLoading(false);
    });
  }, [caseId]);

  const activeCharge = charges[activeChargeIndex];

  return (
    <div className="space-y-6">
      {/* Charge Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveChargeIndex(-1)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            activeChargeIndex === -1 ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-gray-200'
          }`}
        >
          All Charges ({charges.length})
        </button>
        {charges.map((charge, idx) => (
          <button
            key={charge.id}
            onClick={() => setActiveChargeIndex(idx)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeChargeIndex === idx ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-gray-200'
            }`}
          >
            {charge.code} {charge.title}
          </button>
        ))}
      </div>

      {charges.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">No charges filed yet. Charges will appear here once they are added to the case.</p>
        </div>
      ) : activeChargeIndex >= 0 && activeCharge ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Elements Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-white mb-1">
                {activeCharge.code} {activeCharge.title} analysis
              </h2>
              {activeCharge.calcrimNumber && (
                <p className="text-sm font-semibold text-slate-200 mb-6">
                  {activeCharge.calcrimNumber} - Elements the Prosecution Must Prove
                </p>
              )}

              <div className="space-y-4">
                {activeCharge.elements.map((element) => (
                  <div key={element.number} className="flex gap-4 p-4 bg-white/5 rounded-xl">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      {element.number}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-white">{element.description}</p>
                        <EvidenceStatusBadge status={element.status} />
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{element.details}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sentencing Info */}
              {activeCharge.potentialSentence && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm">
                    <span className="font-bold text-white">Potential Maximum Sentence:</span>{' '}
                    <span className="text-slate-200">{activeCharge.potentialSentence}</span>
                  </p>
                  {activeCharge.enhancement && (
                    <p className="text-sm mt-1">
                      <span className="font-bold text-white">Enhancement:</span>{' '}
                      <span className="text-slate-200">{activeCharge.enhancement}</span>
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* AI Defense Insights */}
          <div>
            <Card className="bg-slate-50 border-slate-200">
              <h3 className="text-lg font-semibold text-white mb-4">AI Defense Insights</h3>
              {insightsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : insights.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No defense insights yet. Upload evidence to generate AI analysis.</p>
              ) : (
                <div className="space-y-3">
                  {insights.map((insight) => (
                    <div key={insight.id} className="flex gap-2">
                      <ArrowRight size={16} className="text-gold-light mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-200">{insight.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        /* All Charges View */
        <div className="space-y-4">
          {charges.map((charge, idx) => (
            <Card key={charge.id} hover className="cursor-pointer" onClick={() => setActiveChargeIndex(idx)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{charge.code} — {charge.title}</h3>
                  {charge.potentialSentence && (
                    <p className="text-sm text-slate-400 mt-1">Potential: {charge.potentialSentence}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {charge.elements.some(e => e.status === 'disputed') && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle size={12} />
                      Disputed elements
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {charge.elements.map((el) => (
                  <EvidenceStatusBadge key={el.number} status={el.status} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Defense Opportunities — populated by AI pipeline after evidence upload */}
      {insights.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold text-white mb-4">Defense Opportunities</h2>
          <ul className="space-y-3">
            {insights.map((insight) => (
              <li key={insight.id} className="text-sm text-slate-200">
                {insight.content}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
