// ============================================
// Court Access — Activity / Timeline Tab
// ============================================

import { Card } from '../../components/common/Card';
import { Clock } from 'lucide-react';

export function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Activity Timeline</h2>
        <p className="text-sm text-gray-500 mt-1">Complete audit log of case events</p>
      </div>

      <Card>
        <div className="text-center py-12">
          <Clock size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">No activity recorded yet.</p>
          <p className="text-gray-400 text-xs mt-1">Activity will appear here as case events are logged.</p>
        </div>
      </Card>
    </div>
  );
}
