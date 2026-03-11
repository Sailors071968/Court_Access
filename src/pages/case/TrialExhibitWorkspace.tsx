// ============================================================================
// Phase 256 — Trial Exhibit System (Client Access)
// Route: /cases/:caseId/trial-exhibits
// ============================================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Layers, Box, MapPin, Play, Download, Image, Video,
  Clock, Eye, Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrialExhibit {
  id: string;
  exhibitNumber: number;
  title: string;
  type: 'timeline' | 'officer_action' | 'policy_comparison' | 'scene_reconstruction' | 'evidence_relationship';
  generatedDate: string;
  sourceCount: number;
  status: 'ready' | 'generating' | 'draft';
  thumbnail: string;
}

interface ExhibitMarker {
  id: string;
  exhibitId: string;
  x: number;
  y: number;
  z: number;
  label: string;
  description: string;
  timestamp: string;
}

interface ExhibitAnimation {
  id: string;
  exhibitId: string;
  title: string;
  duration: number;
  format: 'mp4' | 'png' | 'interactive';
  status: 'ready' | 'rendering';
}

type WorkspaceTab = 'library' | 'scene' | 'markers' | 'animation' | 'export';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_EXHIBITS: TrialExhibit[] = [
  { id: 'ex-1', exhibitNumber: 14, title: 'Officer Timeline vs Radio Traffic', type: 'timeline', generatedDate: 'Jan 12, 2026', sourceCount: 4, status: 'ready', thumbnail: '' },
  { id: 'ex-2', exhibitNumber: 15, title: 'Use of Force Sequence', type: 'officer_action', generatedDate: 'Jan 13, 2026', sourceCount: 3, status: 'ready', thumbnail: '' },
  { id: 'ex-3', exhibitNumber: 16, title: 'Pursuit Policy vs Officer Actions', type: 'policy_comparison', generatedDate: 'Jan 14, 2026', sourceCount: 5, status: 'ready', thumbnail: '' },
  { id: 'ex-4', exhibitNumber: 17, title: 'Intersection 3D Reconstruction', type: 'scene_reconstruction', generatedDate: 'Jan 15, 2026', sourceCount: 7, status: 'generating', thumbnail: '' },
  { id: 'ex-5', exhibitNumber: 18, title: 'Evidence Chain: BWC to Report', type: 'evidence_relationship', generatedDate: 'Jan 16, 2026', sourceCount: 6, status: 'ready', thumbnail: '' },
];

const MOCK_MARKERS: ExhibitMarker[] = [
  { id: 'mk-1', exhibitId: 'ex-4', x: 12.5, y: 0, z: -3.2, label: 'Officer Position A', description: 'Initial contact position per bodycam footage', timestamp: '00:02:14' },
  { id: 'mk-2', exhibitId: 'ex-4', x: 18.1, y: 0, z: -1.8, label: 'Suspect Vehicle', description: 'Vehicle position at time of stop', timestamp: '00:01:45' },
  { id: 'mk-3', exhibitId: 'ex-4', x: 5.0, y: 0, z: 2.1, label: 'Witness Location', description: 'Witness statement places them here', timestamp: '00:03:00' },
];

const MOCK_ANIMATIONS: ExhibitAnimation[] = [
  { id: 'an-1', exhibitId: 'ex-4', title: 'Officer Movement Sequence', duration: 45, format: 'mp4', status: 'ready' },
  { id: 'an-2', exhibitId: 'ex-4', title: 'Radio Traffic Overlay', duration: 30, format: 'interactive', status: 'rendering' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeLabel(type: TrialExhibit['type']): string {
  const labels: Record<TrialExhibit['type'], string> = {
    timeline: 'Timeline Exhibit',
    officer_action: 'Officer Action Exhibit',
    policy_comparison: 'Policy Comparison Exhibit',
    scene_reconstruction: 'Scene Reconstruction Exhibit',
    evidence_relationship: 'Evidence Relationship Exhibit',
  };
  return labels[type];
}

function getTypeColor(type: TrialExhibit['type']): string {
  const colors: Record<TrialExhibit['type'], string> = {
    timeline: 'bg-blue-100 text-blue-700',
    officer_action: 'bg-red-100 text-red-700',
    policy_comparison: 'bg-purple-100 text-purple-700',
    scene_reconstruction: 'bg-emerald-100 text-emerald-700',
    evidence_relationship: 'bg-amber-100 text-amber-700',
  };
  return colors[type];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrialExhibitWorkspace() {
  const { caseId: _caseId } = useParams<{ caseId: string }>();
  // _caseId reserved for API integration
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('library');
  const [selectedExhibit, setSelectedExhibit] = useState<TrialExhibit | null>(null);

  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'library', label: 'Exhibit Library', icon: <Layers size={16} /> },
    { id: 'scene', label: 'Scene Builder', icon: <Box size={16} /> },
    { id: 'markers', label: 'Evidence Markers', icon: <MapPin size={16} /> },
    { id: 'animation', label: 'Animation Builder', icon: <Play size={16} /> },
    { id: 'export', label: 'Export Center', icon: <Download size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Trial Exhibit Workspace</h2>
        <p className="text-sm text-gray-500 mt-1">Build, annotate, and export trial-ready exhibits</p>
      </div>

      {/* Workspace Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exhibit Library Tab */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Auto-Generated Exhibits</h3>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
              <Plus size={14} /> Create Custom Exhibit
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOCK_EXHIBITS.map((exhibit) => (
              <div
                key={exhibit.id}
                onClick={() => setSelectedExhibit(exhibit)}
                className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedExhibit?.id === exhibit.id ? 'border-blue-500' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-bold text-gray-400">EXHIBIT {exhibit.exhibitNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    exhibit.status === 'ready' ? 'bg-green-100 text-green-700' :
                    exhibit.status === 'generating' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {exhibit.status.toUpperCase()}
                  </span>
                </div>
                <div className="h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  <Image size={32} className="text-gray-300" />
                </div>
                <h4 className="font-semibold text-gray-900 text-sm mb-1">{exhibit.title}</h4>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${getTypeColor(exhibit.type)}`}>
                  {getTypeLabel(exhibit.type)}
                </span>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock size={10} /> {exhibit.generatedDate}</span>
                  <span>{exhibit.sourceCount} sources</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scene Builder Tab */}
      {activeTab === 'scene' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Box size={16} /> 3D Scene Builder
              </h3>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium">Camera Controls</button>
                <button className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">Timeline Slider</button>
                <button className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">Evidence Overlays</button>
              </div>
            </div>
            <div className="h-96 bg-gray-900 flex items-center justify-center relative">
              <div className="text-center">
                <Box size={64} className="mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 font-medium">3D Scene Reconstruction</p>
                <p className="text-gray-500 text-sm mt-1">Three.js renderer — requires bodycam, dashcam, scene photos</p>
              </div>
              {/* Scene controls overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                <button className="p-2 bg-white/10 rounded-lg text-white hover:bg-white/20">
                  <Play size={16} />
                </button>
                <div className="flex-1 bg-white/10 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full w-1/3" />
                </div>
                <span className="text-white text-xs font-mono">00:02:14 / 00:08:45</span>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <h4 className="text-xs font-semibold text-gray-600 mb-2">SCENE INPUTS</h4>
              <div className="flex gap-3">
                {['Bodycam Footage', 'Dashcam Footage', 'Scene Photos', 'Police Reports', 'Witness Statements'].map((input) => (
                  <div key={input} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs">
                    <Video size={12} className="text-gray-400" />
                    <span className="text-gray-700">{input}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Scene Outputs:</strong> 3D reconstruction, camera viewpoints, officer positions, lighting simulation, trajectory analysis
          </div>
        </div>
      )}

      {/* Evidence Markers Tab */}
      {activeTab === 'markers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Evidence Markers</h3>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
              <Plus size={14} /> Add Marker
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Position (X, Y, Z)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_MARKERS.map((marker) => (
                  <tr key={marker.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{marker.label}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">({marker.x}, {marker.y}, {marker.z})</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{marker.timestamp}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{marker.description}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-blue-600 hover:text-blue-700 text-xs font-medium">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Animation Builder Tab */}
      {activeTab === 'animation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Animation Builder</h3>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
              <Plus size={14} /> Create Animation
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Animation Inputs</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {['Officer Actions', 'Suspect Movements', 'Radio Calls', 'Timeline Events'].map((input) => (
                <div key={input} className="p-3 bg-gray-50 rounded-lg text-center">
                  <Play size={20} className="mx-auto mb-1 text-gray-400" />
                  <span className="text-xs font-medium text-gray-700">{input}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {MOCK_ANIMATIONS.map((anim) => (
              <div key={anim.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Play size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm">{anim.title}</h4>
                    <p className="text-xs text-gray-500">{anim.duration}s | {anim.format.toUpperCase()}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  anim.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {anim.status === 'ready' ? 'Ready' : 'Rendering...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Center Tab */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Export Center</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { format: 'MP4', desc: 'Animated video export for courtroom presentation', icon: <Video size={24} /> },
              { format: 'PNG', desc: 'High-resolution static exhibit images', icon: <Image size={24} /> },
              { format: 'Interactive Viewer', desc: 'Browser-based interactive exhibit for jury display', icon: <Eye size={24} /> },
            ].map((exp) => (
              <div key={exp.format} className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-12 h-12 bg-blue-100 rounded-xl mx-auto mb-3 flex items-center justify-center text-blue-600">
                  {exp.icon}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{exp.format}</h4>
                <p className="text-xs text-gray-500">{exp.desc}</p>
                <button className="mt-3 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700">
                  Export {exp.format}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
