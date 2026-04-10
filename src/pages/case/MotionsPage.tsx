// ============================================
// Court Access — Motion Recommendations Tab
// ============================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { MotionPriorityBadge } from '../../components/common/StatusBadge';
import { getMotionRecommendations } from '../../services/ai/motionRecommendations';
import type { Motion } from '../../types';
import { AlertTriangle, MessageSquare, Pencil, Loader2 } from 'lucide-react';
import { fetchCase, type ApiCase } from '../../services/caseApi';

export function MotionsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [motions, setMotions] = useState<Motion[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseLoading, setCaseLoading] = useState(true);
  const [currentCase, setCurrentCase] = useState<ApiCase | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setCaseLoading(true);
    fetchCase(caseId).then((c) => {
      if (!cancelled) { setCurrentCase(c); setCaseLoading(false); }
    }).catch(() => { if (!cancelled) setCaseLoading(false); });
    return () => { cancelled = true; };
  }, [caseId]);

  useEffect(() => {
    setLoading(true);
    if (!caseId) return;
    getMotionRecommendations({ caseId }).then((res) => {
      setMotions(res.motions);
      setLoading(false);
    });
  }, [caseId]);

  if (caseLoading) {
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
          <strong>Important:</strong> These are AI-generated ideas, not legal advice.
          Discuss all recommendations with your licensed attorney.
        </p>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Court Attorney - Motion Recommendations</h2>
          <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">
            <span>{currentCase.title || currentCase.caseType} - Case #{currentCase.caseNumber}</span>
            <button aria-label="Edit case"><Pencil size={14} /></button>
          </div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900">Recommended Motions to File</h3>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : motions.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No motion recommendations yet. Upload evidence and run analysis to generate motion recommendations.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {motions.map((motion) => (
            <Card key={motion.id}>
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-gray-900">
                  {motion.title}
                  {motion.code && <span className="text-gray-500 font-normal"> ({motion.code})</span>}
                </h4>
                <MotionPriorityBadge priority={motion.priority} />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {motion.description}
              </p>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors">
                <MessageSquare size={12} />
                Discuss with Attorney
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
