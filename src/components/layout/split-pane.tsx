import { useCallback, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftPercent?: number;
  minPercent?: number;
  maxPercent?: number;
  className?: string;
}

/**
 * Resizable two-pane split (e.g. document viewer + annotations).
 * Drag the divider; keyboard accessible via arrow keys on the handle.
 */
export function SplitPane({
  left,
  right,
  initialLeftPercent = 50,
  minPercent = 25,
  maxPercent = 75,
  className,
}: SplitPaneProps) {
  const [leftPct, setLeftPct] = useState(initialLeftPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clamp = useCallback(
    (v: number) => Math.max(minPercent, Math.min(maxPercent, v)),
    [minPercent, maxPercent],
  );

  const onMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setLeftPct(clamp(((clientX - rect.left) / rect.width) * 100));
    },
    [clamp],
  );

  const startDrag = () => {
    dragging.current = true;
    const move = (e: MouseEvent) => dragging.current && onMove(e.clientX);
    const up = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div ref={containerRef} className={cn('flex w-full h-full', className)}>
      <div style={{ width: `${leftPct}%` }} className="min-w-0 overflow-auto">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftPct)}
        tabIndex={0}
        onMouseDown={startDrag}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setLeftPct((p) => clamp(p - 2));
          if (e.key === 'ArrowRight') setLeftPct((p) => clamp(p + 2));
        }}
        className="w-1.5 cursor-col-resize bg-white/5 hover:bg-gold/30 focus:bg-gold/40 focus:outline-none transition-colors flex-shrink-0"
      />
      <div style={{ width: `${100 - leftPct}%` }} className="min-w-0 overflow-auto">
        {right}
      </div>
    </div>
  );
}
