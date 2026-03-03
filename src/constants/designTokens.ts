// ============================================
// Court Access — Design Tokens (Tailwind classes)
// Centralized mapping to prevent color drift.
// ============================================

export const STATUS_COLORS = {
  danger: 'text-red-600 bg-red-50',
  warning: 'text-amber-600 bg-amber-50',
  info: 'text-blue-600 bg-blue-50',
  neutral: 'text-gray-600 bg-gray-50',
  success: 'text-green-600 bg-green-50',
  accent: 'text-purple-600 bg-purple-50',
  orange: 'text-orange-600 bg-orange-50',
} as const;

export const TEXT_COLORS = {
  danger: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
  neutral: 'text-gray-600',
  success: 'text-green-600',
  accent: 'text-purple-600',
  orange: 'text-orange-600',
} as const;
