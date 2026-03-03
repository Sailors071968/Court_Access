// ============================================
// Court Access — Activity / Timeline Tab
// ============================================

import { Card } from '../../components/common/Card';
import { MOCK_ACTIVITY } from '../../constants/mockData';
import { FileText, Calendar, Lightbulb, Gavel } from 'lucide-react';

const iconMap = {
  document: { icon: FileText, bg: 'bg-orange-100', color: 'text-orange-600' },
  hearing: { icon: Calendar, bg: 'bg-blue-100', color: 'text-blue-600' },
  analysis: { icon: Lightbulb, bg: 'bg-green-100', color: 'text-green-600' },
  motion: { icon: Gavel, bg: 'bg-purple-100', color: 'text-purple-600' },
  system: { icon: FileText, bg: 'bg-gray-100', color: 'text-gray-600' },
};

export function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Activity Timeline</h2>
        <p className="text-sm text-gray-500 mt-1">Complete audit log of case events</p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {MOCK_ACTIVITY.map((item) => {
            const config = iconMap[item.type];
            const Icon = config.icon;
            return (
              <div key={item.id} className="flex gap-4 relative">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${config.bg} ${config.color}`}>
                  <Icon size={20} />
                </div>
                <Card className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{item.timestamp}</span>
                  </div>
                  {item.actionLabel && (
                    <button className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      {item.actionLabel}
                    </button>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
