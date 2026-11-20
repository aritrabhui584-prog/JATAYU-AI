import React, { useState } from 'react';
import { AOIConfig, AOIPreset, BoundingBox } from '../types';
import { Compass, Check, X, Sliders, MapPin, AlertCircle } from 'lucide-react';

interface AOISelectorProps {
  activeAOI: AOIConfig | null;
  presets: AOIPreset[];
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetId: string) => Promise<void>;
  onSetCustom: (bbox: BoundingBox, name: string) => Promise<void>;
}

export const AOISelector: React.FC<AOISelectorProps> = ({
  activeAOI,
  presets,
  isOpen,
  onClose,
  onSelectPreset,
  onSetCustom,
}) => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState('Custom Teesta Focus Area');
  const [minLat, setMinLat] = useState(activeAOI?.bbox.min_lat?.toString() || '26.85');
  const [minLon, setMinLon] = useState(activeAOI?.bbox.min_lon?.toString() || '88.35');
  const [maxLat, setMaxLat] = useState(activeAOI?.bbox.max_lat?.toString() || '27.30');
  const [maxLon, setMaxLon] = useState(activeAOI?.bbox.max_lon?.toString() || '88.65');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const s = parseFloat(minLat);
    const w = parseFloat(minLon);
    const n = parseFloat(maxLat);
    const e_lon = parseFloat(maxLon);

    if (isNaN(s) || isNaN(w) || isNaN(n) || isNaN(e_lon)) {
      setError('All coordinates must be valid numbers.');
      return;
    }
    if (s >= n) {
      setError('South latitude must be strictly less than North latitude.');
      return;
    }
    if (w >= e_lon) {
      setError('West longitude must be strictly less than East longitude.');
      return;
    }
    if (s < -90 || n > 90 || w < -180 || e_lon > 180) {
      setError('Coordinates out of global WGS84 range.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSetCustom({ min_lat: s, min_lon: w, max_lat: n, max_lon: e_lon }, customName);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update AOI');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPreset = async (presetId: string) => {
    try {
      setIsSubmitting(true);
      await onSelectPreset(presetId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to select preset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Configure Area of Interest (AOI)</h3>
              <p className="text-xs text-slate-400">
                Constrain all real-data GIS queries to a targeted river corridor bounding box
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Toggle Tabs */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setIsCustomMode(false)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                !isCustomMode
                  ? 'bg-cyan-900/80 text-cyan-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Teesta Corridor Presets
            </button>
            <button
              onClick={() => setIsCustomMode(true)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                isCustomMode
                  ? 'bg-cyan-900/80 text-cyan-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Custom Bounding Box
            </button>
          </div>

          {!isCustomMode ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Select a validated geographic sector along the Teesta River basin:
              </p>
              <div className="grid grid-cols-1 gap-3">
                {presets.map((preset) => {
                  const isSelected = activeAOI?.id === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => !isSubmitting && handleSelectPreset(preset.id)}
                      className={`p-4 rounded-xl border text-left transition cursor-pointer flex items-start justify-between ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/20'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-slate-200">
                            {preset.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] bg-cyan-900 text-cyan-200 font-bold px-2 py-0.5 rounded-full">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{preset.description}</p>
                        <div className="font-mono text-[11px] text-cyan-400/90 pt-1">
                          Bounds: [{preset.min_lat}°N, {preset.min_lon}°E] to [{preset.max_lat}°N, {preset.max_lon}°E]
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-slate-950 shrink-0 mt-0.5">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Area Name / Sector Label
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    South Latitude (min_lat)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={minLat}
                    onChange={(e) => setMinLat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    North Latitude (max_lat)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={maxLat}
                    onChange={(e) => setMaxLat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    West Longitude (min_lon)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={minLon}
                    onChange={(e) => setMinLon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    East Longitude (max_lon)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={maxLon}
                    onChange={(e) => setMaxLon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300">Teesta Basin Geographic Reference:</span>
                <div>• North Sikkim (Mangan / Chungthang): 27.40°N to 27.80°N, 88.40°E to 88.75°E</div>
                <div>• Middle Gorge (Kalimpong / Rangpo / Sevoke): 26.85°N to 27.30°N, 88.35°E to 88.65°E</div>
                <div>• Lower Plains (Siliguri / Jalpaiguri): 26.40°N to 26.85°N, 88.40°E to 88.90°E</div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Applying AOI...' : 'Apply Custom AOI'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
