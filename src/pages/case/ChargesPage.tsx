// ============================================
// Court Access — Charges Analysis Tab
// ============================================

import { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card';
import { EvidenceStatusBadge } from '../../components/common/StatusBadge';
import { caseDataProvider } from '../../services/caseDataProvider';
import { getDefenseInsights } from '../../services/ai/defenseInsights';
import type { DefenseInsight } from '../../types';
import type { ChargeEntity } from '../../models/CaseModel';
import { useParams } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export function ChargesPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeChargeIndex, setActiveChargeIndex] = useState(0);
  const [insights, setInsights] = useState<DefenseInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [charges, setCharges] = useState<ChargeEntity[]>([]);

  useEffect(() => {
    caseDataProvider.getCharges(caseId).then(setCharges);
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
            activeChargeIndex === -1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Charges ({charges.length})
        </button>
        {charges.map((charge, idx) => (
          <button
            key={charge.id}
            onClick={() => setActiveChargeIndex(idx)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeChargeIndex === idx ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {charge.code} {charge.title}
          </button>
        ))}
      </div>

      {activeChargeIndex >= 0 && activeCharge ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Elements Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {activeCharge.code} {activeCharge.title} analysis
              </h2>
              {activeCharge.calcrimNumber && (
                <p className="text-sm font-semibold text-gray-700 mb-6">
                  {activeCharge.calcrimNumber} - Elements the Prosecution Must Prove
                </p>
              )}

              <div className="space-y-4">
                {activeCharge.elements.map((element) => (
                  <div key={element.number} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      {element.number}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-gray-900">{element.description}</p>
                        <EvidenceStatusBadge status={element.status} />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{element.details}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sentencing Info */}
              {activeCharge.potentialSentence && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm">
                    <span className="font-bold text-gray-900">Potential Maximum Sentence:</span>{' '}
                    <span className="text-gray-700">{activeCharge.potentialSentence}</span>
                  </p>
                  {activeCharge.enhancement && (
                    <p className="text-sm mt-1">
                      <span className="font-bold text-gray-900">Enhancement:</span>{' '}
                      <span className="text-gray-700">{activeCharge.enhancement}</span>
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* AI Defense Insights */}
          <div>
            <Card className="bg-slate-50 border-slate-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Defense Insights</h3>
              {insightsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.map((insight) => (
                    <div key={insight.id} className="flex gap-2">
                      <ArrowRight size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{insight.content}</p>
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
                  <h3 className="font-semibold text-gray-900">{charge.code} — {charge.title}</h3>
                  {charge.potentialSentence && (
                    <p className="text-sm text-gray-500 mt-1">Potential: {charge.potentialSentence}</p>
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

      {/* Defense Opportunities */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Defense Opportunities</h2>
        <ul className="space-y-3">
          <li className="text-sm text-gray-700">
            <span className="font-semibold">Target Element 2:</span> Challenge knowledge of presence; emphasize lack of direct link to defendant and proximity argument limitations.
          </li>
          <li className="text-sm text-gray-700">
            <span className="font-semibold">Target Element 3:</span> Attack knowledge of substance character; utilize absence of priors and paraphernalia to create reasonable doubt.
          </li>
          <li className="text-sm text-gray-700">
            <span className="font-semibold">Review Lab Results:</span> Scrutinize impending lab report for chain of custody issues or discrepancies regarding the substance and weight.
          </li>
          <li className="text-sm text-gray-700">
            <span className="font-semibold">Motion to Suppress:</span> Evaluate vehicle search legality for potential constitutional violations.
          </li>
        </ul>
      </Card>
    </div>
  );
}
