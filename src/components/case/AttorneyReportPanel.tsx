// ============================================
// Court Access — Attorney Report Panel
// Generates compliance and expert witness reports from backend APIs.
// ============================================

import { useState } from 'react';
import { FileDown, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '../common/Card';
import {
  generateComplianceReport,
  generateExpertWitnessPackage,
  type ApiComplianceReport,
} from '../../services/caseApi';

interface AttorneyReportPanelProps {
  caseId: string;
  caseTitle: string;
}

export function AttorneyReportPanel({ caseId, caseTitle }: AttorneyReportPanelProps) {
  const [loading, setLoading] = useState<'compliance' | 'expert' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ApiComplianceReport | null>(null);
  const [expertSummary, setExpertSummary] = useState<string | null>(null);

  const handleComplianceReport = async () => {
    try {
      setLoading('compliance');
      setError(null);
      const result = await generateComplianceReport(caseId, caseTitle);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate compliance report');
    } finally {
      setLoading(null);
    }
  };

  const handleExpertPackage = async () => {
    try {
      setLoading('expert');
      setError(null);
      const result = await generateExpertWitnessPackage(caseId);
      setExpertSummary(
        result.packageTitle
          ? `${result.packageTitle} — ${result.sections?.length ?? 0} section(s)`
          : 'Expert witness package generated',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate expert package');
    } finally {
      setLoading(null);
    }
  };

  const downloadReportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `compliance-report-${caseId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Attorney Reports</h2>
      <p className="text-sm text-gray-600 mb-4">
        Generate evidence-governed reports from uploaded case materials. Reports reflect only analyzed findings in the system.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleComplianceReport}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {loading === 'compliance' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          Generate Compliance Report
        </button>
        <button
          onClick={handleExpertPackage}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading === 'expert' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          Generate Expert Package
        </button>
        {report && (
          <button
            onClick={downloadReportJson}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <FileDown size={16} />
            Download Report JSON
          </button>
        )}
      </div>

      {report && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
            <CheckCircle size={16} />
            Compliance report generated
          </div>
          <p className="text-sm text-gray-700">{report.title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {report.summary.totalFindings} finding(s) ·{' '}
            {report.summary.potentialInconsistencies} potential inconsistency(ies) ·{' '}
            Avg confidence: {(report.summary.averageConfidence * 100).toFixed(0)}%
          </p>
          {report.findings.length === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              No compliance findings in database for this case — report reflects UNKNOWN coverage.
            </p>
          )}
        </div>
      )}

      {expertSummary && (
        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
          <CheckCircle size={16} className="inline mr-2" />
          {expertSummary}
        </div>
      )}
    </Card>
  );
}
