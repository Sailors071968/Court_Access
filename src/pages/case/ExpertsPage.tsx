// ============================================
// Court Access — Expert Witness Recommendations Tab
// ============================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { ExpertRecommendationBadge } from '../../components/common/StatusBadge';
import { getExpertRecommendations } from '../../services/ai/expertRecommendations';
import type { Expert } from '../../types';
import { AlertTriangle, MessageSquare, Loader2 } from 'lucide-react';
import { fetchCase, type ApiCase } from '../../services/caseApi';

export function ExpertsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCase, setCurrentCase] = useState<ApiCase | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    fetchCase(caseId).then((c) => {
      if (!cancelled) setCurrentCase(c);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [caseId]);

  useEffect(() => {
    setLoading(true);
    if (!caseId) return;
    getExpertRecommendations({ caseId }).then((res) => {
      setExperts(res.experts);
      setLoading(false);
    });
  }, [caseId]);

  if (loading && !currentCase) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  if (!currentCase) {
    return <div className="p-8 text-center text-gray-500">No cases found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>DISCLAIMER:</strong> These recommendations are based on preliminary case data and strategy.
          Final selection and engagement should be determined through direct consultation with lead counsel and due diligence.
        </p>
      </div>

      {/* Case Info */}
      <div>
        <h2 className="text-xl font-bold text-blue-700">{currentCase.title || currentCase.caseType} - Case #{currentCase.caseNumber}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Status: {currentCase.status || 'Pre-Trial Motions'}
        </p>
      </div>

      <h3 className="text-lg font-bold text-gray-900">Recommended Expert Witnesses</h3>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : experts.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No expert recommendations yet. Upload evidence and run analysis to generate expert witness recommendations.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {experts.map((expert) => (
            <Card key={expert.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-blue-600 text-lg">⚗️</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">{expert.title}</h4>
                </div>
                <ExpertRecommendationBadge recommendation={expert.recommendation} />
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">WHY THIS EXPERT:</p>
                <p className="text-sm text-gray-600 leading-relaxed">{expert.reason}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Estimated Cost Range:</span> {expert.costRange}
                </p>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                  <MessageSquare size={12} />
                  Discuss with Attorney
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
