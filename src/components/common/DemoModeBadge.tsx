// ============================================
// Court Access — Demo Mode Badge
// Subtle indicator to avoid implying real analysis.
// ============================================

export function DemoModeBadge() {
  const isDev =
    // Vite
    (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) ||
    // Fallback (requested)
    (typeof process !== 'undefined' && Boolean((process as unknown as { env?: { NODE_ENV?: string } }).env?.NODE_ENV === 'development'));

  const isStaging =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.devinapps.com');

  const show = isDev || isStaging;
  if (!show) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
      Demo Data
    </span>
  );
}
