// ============================================
// Court Access — Notifications & Alerts Page
// ============================================

import { useState } from 'react';
import { Card } from '../components/common/Card';
import { MOCK_NOTIFICATIONS } from '../constants/mockData';
import { FileText, Calendar, Lightbulb, Phone, Mail } from 'lucide-react';

export function NotificationsPage() {
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [settings, setSettings] = useState({
    courtDateReminders: { oneWeek: true, twentyFourHours: true, twoHours: true },
    newDocumentAlerts: true,
    aiAnalysisUpdates: true,
  });

  const toggleSetting = (key: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications & Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Stay informed about your case</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Phone size={16} className="text-gray-500" />
            <span className="text-sm">SMS Alerts:</span>
            <button
              onClick={() => setSmsEnabled(!smsEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${smsEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={smsEnabled}
              aria-label="Toggle SMS alerts"
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${smsEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${smsEnabled ? 'text-blue-600' : 'text-gray-400'}`}>{smsEnabled ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-gray-500" />
            <span className="text-sm">Email Alerts:</span>
            <button
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${emailEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={emailEnabled}
              aria-label="Toggle email alerts"
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${emailEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${emailEnabled ? 'text-blue-600' : 'text-gray-400'}`}>{emailEnabled ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Notification Feed */}
        <div className="lg:col-span-2 space-y-3">
          {MOCK_NOTIFICATIONS.map((notif) => (
            <Card key={notif.id} hover>
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notif.type === 'document' ? 'bg-orange-100 text-orange-600' :
                  notif.type === 'hearing' ? 'bg-blue-100 text-blue-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {notif.type === 'document' ? <FileText size={18} /> :
                   notif.type === 'hearing' ? <Calendar size={18} /> :
                   <Lightbulb size={18} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">{notif.title}</h3>
                    {!notif.read && <span className="w-2 h-2 bg-blue-600 rounded-full mt-2" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{notif.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-400">{notif.timestamp}</span>
                    {notif.actionLabel && (
                      <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        {notif.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Notification Settings */}
        <div>
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Court Date Reminders</h4>
                <div className="space-y-2 ml-4">
                  {[
                    { key: 'oneWeek', label: '1 week before' },
                    { key: 'twentyFourHours', label: '24 hours before' },
                    { key: 'twoHours', label: '2 hours before' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.courtDateReminders[item.key as keyof typeof settings.courtDateReminders]}
                        onChange={() => {
                          setSettings(prev => ({
                            ...prev,
                            courtDateReminders: {
                              ...prev.courtDateReminders,
                              [item.key]: !prev.courtDateReminders[item.key as keyof typeof prev.courtDateReminders],
                            },
                          }));
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={settings.newDocumentAlerts} onChange={() => toggleSetting('newDocumentAlerts')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700 font-medium">New Document Alerts</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={settings.aiAnalysisUpdates} onChange={() => toggleSetting('aiAnalysisUpdates')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700 font-medium">AI Analysis Updates</span>
              </label>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                    <Phone size={14} className="text-gray-400" />
                    <input type="tel" defaultValue="(555) 123-4567" className="flex-1 text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                    <Mail size={14} className="text-gray-400" />
                    <input type="email" defaultValue="jane.doe@email.com" className="flex-1 text-sm focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
