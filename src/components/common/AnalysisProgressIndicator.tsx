// ============================================================================
// Analysis Progress Indicator
// Animated visual loader shown during any AI/CALCRIM analysis.
// Requirement #4: "When analysis is occurring, there must always be a
// visual moving object to allow clients to be made aware of an analysis
// in progress."
// ============================================================================

import { useEffect, useState } from 'react';

interface AnalysisProgressIndicatorProps {
  /** 0-100 progress percentage. If not provided, shows indeterminate animation. */
  progress?: number;
  /** Label shown below the animation */
  label?: string;
  /** Compact mode for inline use */
  compact?: boolean;
}

export function AnalysisProgressIndicator({
  progress,
  label = 'Analyzing evidence...',
  compact = false,
}: AnalysisProgressIndicatorProps) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const dotString = '.'.repeat(dots);

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border-2 border-blue-200" />
          <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
        <span className="text-sm text-blue-700 font-medium">
          {label}{dotString}
        </span>
        {progress !== undefined && (
          <span className="text-xs text-blue-500 font-mono">{Math.round(progress)}%</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      {/* Animated orbital rings */}
      <div className="relative w-24 h-24 mb-6">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-400"
          style={{ animation: 'spin 1.5s linear infinite' }}
        />

        {/* Middle ring */}
        <div className="absolute inset-3 rounded-full border-3 border-indigo-100" />
        <div
          className="absolute inset-3 rounded-full border-3 border-transparent border-b-indigo-500 border-l-indigo-400"
          style={{ animation: 'spin 2s linear infinite reverse' }}
        />

        {/* Inner pulse */}
        <div className="absolute inset-6 rounded-full bg-blue-50 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full bg-blue-500"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
          />
        </div>

        {/* Orbiting dot */}
        <div
          className="absolute w-3 h-3 bg-amber-400 rounded-full shadow-lg"
          style={{
            animation: 'orbit 3s linear infinite',
            top: '0',
            left: '50%',
            transformOrigin: '0 48px',
          }}
        />
      </div>

      {/* Progress bar (determinate) */}
      {progress !== undefined && (
        <div className="w-64 mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">Analyzing</span>
            <span className="text-xs font-mono text-blue-600">{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {/* Label */}
      <p className="text-sm font-medium text-gray-700">
        {label}{dotString}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        This may take a moment
      </p>

      {/* CSS animations injected via style tag */}
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(48px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(48px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
