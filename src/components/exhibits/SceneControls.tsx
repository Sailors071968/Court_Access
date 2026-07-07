// ============================================================================
// Phase 57 — Scene Controls (Toggle Switches & Radio Buttons)
// Simple UI control panel for 3D exhibit scene objects.
// ============================================================================

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObjectSettings {
  showTrees: boolean;
  showBushes: boolean;
  showVehicles: boolean;
  showPedestrians: boolean;
  showStreetlights: boolean;
  vehicleDensity: 'low' | 'medium' | 'high';
}

interface SceneControlsProps {
  settings: ObjectSettings;
  onSettingsChange: (settings: ObjectSettings) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-blue-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white/5 transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Radio Group Component
// ---------------------------------------------------------------------------

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="py-2">
      <span className="text-sm font-medium text-gray-200 block mb-2">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex-1 text-center py-1.5 px-2 rounded text-xs font-medium cursor-pointer transition-colors ${
              value === opt.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SceneControls({
  settings,
  onSettingsChange,
  className = '',
}: SceneControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateSetting = <K extends keyof ObjectSettings>(
    key: K,
    value: ObjectSettings[K],
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
          Scene Objects
        </h3>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Controls */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-1 border-t border-gray-700">
          <div className="pt-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Vegetation</p>
            <ToggleSwitch
              label="Include Trees"
              checked={settings.showTrees}
              onChange={(v) => updateSetting('showTrees', v)}
            />
            <ToggleSwitch
              label="Include Bushes"
              checked={settings.showBushes}
              onChange={(v) => updateSetting('showBushes', v)}
            />
          </div>

          <div className="border-t border-gray-700 pt-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Vehicles & People</p>
            <ToggleSwitch
              label="Include Vehicles"
              checked={settings.showVehicles}
              onChange={(v) => updateSetting('showVehicles', v)}
            />
            <ToggleSwitch
              label="Include Pedestrians"
              checked={settings.showPedestrians}
              onChange={(v) => updateSetting('showPedestrians', v)}
            />
          </div>

          <div className="border-t border-gray-700 pt-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Infrastructure</p>
            <ToggleSwitch
              label="Include Streetlights"
              checked={settings.showStreetlights}
              onChange={(v) => updateSetting('showStreetlights', v)}
            />
          </div>

          <div className="border-t border-gray-700 pt-2">
            <RadioGroup
              label="Vehicle Density"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
              value={settings.vehicleDensity}
              onChange={(v) => updateSetting('vehicleDensity', v as 'low' | 'medium' | 'high')}
            />
          </div>

          {/* Quick presets */}
          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Quick Presets</p>
            <div className="flex gap-2">
              <button
                onClick={() => onSettingsChange({
                  showTrees: true,
                  showBushes: true,
                  showVehicles: true,
                  showPedestrians: true,
                  showStreetlights: true,
                  vehicleDensity: 'medium',
                })}
                className="flex-1 text-xs py-1.5 px-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                Show All
              </button>
              <button
                onClick={() => onSettingsChange({
                  showTrees: false,
                  showBushes: false,
                  showVehicles: false,
                  showPedestrians: false,
                  showStreetlights: false,
                  vehicleDensity: 'low',
                })}
                className="flex-1 text-xs py-1.5 px-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                Hide All
              </button>
              <button
                onClick={() => onSettingsChange({
                  showTrees: false,
                  showBushes: false,
                  showVehicles: true,
                  showPedestrians: false,
                  showStreetlights: true,
                  vehicleDensity: 'low',
                })}
                className="flex-1 text-xs py-1.5 px-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                Minimal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
