// ============================================================================
// Top 5 Inconsistencies Dashboard Widget
// Requirement #3: "Five of the highest rated inconsistencies and
// contradictions must be highlighted in plain view on the front page
// of the dashboard."
// ============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react';
import { Card } from '../common/Card';
import { AnalysisProgressIndicator } from '../common/AnalysisProgressIndicator';
import { caseDataProvider } from '../../services/caseDataProvider';
import { analyzeFullCase, type Inconsistency } from '../../services/calcrim';

interface TopInconsistenciesWidgetProps {
  caseId: string;
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-gray-100 text-gray-700';
  if (score >= 80) color = 'bg-red-100 text-red-800';
  else if (score >= 60) color = 'bg-orange-100 text-orange-800';
  else if (score >= 40) color = 'bg-amber-100 text-amber-800';

  return (
    <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold ${color}`}>
      {score}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    timeline: 'bg-blue-100 text-blue-700',
    narrative: 'bg-purple-100 text-purple-700',
    physical: 'bg-green-100 text-green-700',
    witness: 'bg-teal-100 text-teal-700',
    procedural: 'bg-red-100 text-red-700',
    documentary: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[category] || 'bg-gray-100 text-gray-700'}`}>
      {category}
    </span>
  );
}

export function TopInconsistenciesWidget({ caseId }: TopInconsistenciesWidgetProps) {
  const navigate = useNavigate();
  const [topInconsistencies, setTopInconsistencies] = useState<Inconsistency[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const charges = caseDataProvider.getCharges(caseId);
    const documents = caseDataProvider.getDocuments(caseId);

    if (charges.length === 0) {
      setIsAnalyzing(false);
      return;
    }

    // Simulate progressive analysis
    let step = 0;
    const steps = 10;
    const interval = setInterval(() => {
      step++;
      setProgress(Math.min(95, (step / steps) * 100));
      if (step >= steps) {
        clearInterval(interval);

        const chargeInputs = charges.map((c) => ({
          id: c.id,
          code: c.code,
          calcrimNumber: c.calcrimNumber ?? undefined,
        }));

        const evidenceDocs = documents.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          content: `${d.name}. Filed ${d.filedDate}. Document type: ${d.type}. Evidence document ${d.id}.`,
        }));

        const result = analyzeFullCase(caseId, chargeInputs, evidenceDocs);
        setTopInconsistencies(result.topInconsistencies);
        setTotalCount(result.totalInconsistencies);
        setProgress(100);
        setTimeout(() => setIsAnalyzing(false), 300);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [caseId]);

  if (isAnalyzing) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Key Inconsistencies</h3>
        </div>
        <AnalysisProgressIndicator compact progress={progress} label="Scanning for contradictions" />
      </Card>
    );
  }

  if (topInconsistencies.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Key Inconsistencies</h3>
        </div>
        <p className="text-sm text-gray-500">
          No inconsistencies detected yet. Upload evidence and add charges to begin analysis.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Top Inconsistencies</h3>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {totalCount} total
          </span>
        </div>
        <button
          onClick={() => navigate(`/cases/${caseId}/inconsistencies`)}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View All <ExternalLink size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {topInconsistencies.map((inc, idx) => (
          <div
            key={inc.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => navigate(`/cases/${caseId}/inconsistencies`)}
          >
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
              <ScoreBadge score={inc.score} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 line-clamp-2">{inc.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <CategoryBadge category={inc.category} />
                {inc.sources.slice(0, 2).map((s, i) => (
                  <span key={i} className="text-[10px] text-gray-400 truncate max-w-[100px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate(`/cases/${caseId}/inconsistencies`)}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
      >
        <AlertTriangle size={16} />
        View All {totalCount} Inconsistencies
        <ArrowRight size={14} />
      </button>
    </Card>
  );
}
