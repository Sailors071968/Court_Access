// ============================================================================
// Billing Notification Banner
// Requirement #4: Dashboard-visible notifications for credit exhaustion
// warnings and subscription renewal alerts.
//
// Displays at top of dashboard when credit balance is low or subscription
// renewal is approaching.
// ============================================================================

import { useState } from 'react';
import { AlertTriangle, CreditCard, X, Zap, Clock, ArrowRight } from 'lucide-react';
import type { BillingNotification } from '../../services/billingNotificationEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillingNotificationBannerProps {
  notifications: BillingNotification[];
  onDismiss?: (notificationId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingNotificationBanner({
  notifications,
  onDismiss,
  className = '',
}: BillingNotificationBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleNotifications = notifications.filter(
    n => !n.dismissed && !dismissedIds.has(n.id)
  );

  if (visibleNotifications.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    onDismiss?.(id);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {visibleNotifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => handleDismiss(notification.id)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual Notification Item
// ---------------------------------------------------------------------------

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: BillingNotification;
  onDismiss: () => void;
}) {
  const severityStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-500',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: 'text-amber-500',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-500',
    },
  };

  const style = severityStyles[notification.severity] ?? severityStyles.info;

  const IconComponent = notification.type === 'credit_low' || notification.type === 'credit_exhausted'
    ? Zap
    : notification.type === 'renewal_approaching' || notification.type === 'renewal_today'
      ? Clock
      : notification.type === 'credits_purchased' || notification.type === 'plan_upgraded'
        ? CreditCard
        : AlertTriangle;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg} ${style.border}`}>
      <IconComponent size={18} className={`${style.icon} mt-0.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${style.text}`}>{notification.title}</p>
        <p className={`text-xs ${style.text} opacity-80 mt-0.5`}>{notification.message}</p>
        {notification.actionUrl && notification.actionLabel && (
          <a
            href={notification.actionUrl}
            className={`inline-flex items-center gap-1 text-xs font-medium ${style.text} mt-2 hover:underline`}
          >
            {notification.actionLabel}
            <ArrowRight size={12} />
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credit Warning Widget (compact version for sidebar/dashboard cards)
// ---------------------------------------------------------------------------

interface CreditWarningWidgetProps {
  currentBalance: number;
  monthlyAllotment: number;
  renewalDate: string;
  daysUntilRenewal: number;
  className?: string;
}

export function CreditWarningWidget({
  currentBalance,
  monthlyAllotment,
  renewalDate,
  daysUntilRenewal,
  className = '',
}: CreditWarningWidgetProps) {
  const percentRemaining = monthlyAllotment > 0
    ? Math.round((currentBalance / monthlyAllotment) * 100)
    : 0;

  const isLow = percentRemaining <= 10;
  const isExhausted = currentBalance <= 0;

  const barColor = isExhausted
    ? 'bg-red-500'
    : isLow
      ? 'bg-amber-500'
      : 'bg-blue-500';

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-purple-500" />
          <span className="text-sm font-semibold text-gray-900">AI Credits</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isExhausted ? 'bg-red-100 text-red-700' :
          isLow ? 'bg-amber-100 text-amber-700' :
          'bg-green-100 text-green-700'
        }`}>
          {currentBalance} / {monthlyAllotment}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(100, percentRemaining)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>{percentRemaining}% remaining</span>
        <span>Renews in {daysUntilRenewal} day{daysUntilRenewal !== 1 ? 's' : ''}</span>
      </div>

      {isExhausted && (
        <div className="mt-2 bg-red-50 border border-red-100 rounded p-2">
          <p className="text-[10px] text-red-700 font-medium">
            Credits exhausted. Purchase additional credits to continue analysis.
          </p>
        </div>
      )}

      {isLow && !isExhausted && (
        <div className="mt-2 bg-amber-50 border border-amber-100 rounded p-2">
          <p className="text-[10px] text-amber-700">
            Credits running low. Renewal: {renewalDate.split('T')[0]}
          </p>
        </div>
      )}

      <a
        href="/billing/credits"
        className="mt-3 w-full inline-flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <CreditCard size={12} />
        Purchase Credits
      </a>
    </div>
  );
}
