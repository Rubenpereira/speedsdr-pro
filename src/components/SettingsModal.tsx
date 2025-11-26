import React from 'react';
import { SdrSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SdrSettings;
  onSettingsChange: (settings: SdrSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="bg-[#051005] border-2 border-green-500 p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-green-500 mb-4">CONFIGURAÇÕES SDR</h2>
        
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-green-600 mb-1">Sample Rate</label>
            <select 
              className="w-full bg-black border border-green-800 text-green-500 p-1"
              value={settings.sampleRate}
              onChange={(e) => onSettingsChange({...settings, sampleRate: parseInt(e.target.value)})}
            >
              <option value={1024000}>1.024 MHz</option>
              <option value={2048000}>2.048 MHz</option>
            </select>
          </div>

          <div>
            <label className="block text-green-600 mb-1">FFT Size</label>
            <input 
              type="number" 
              className="w-full bg-black border border-green-800 text-green-500 p-1"
              value={settings.fftSize}
              onChange={(e) => onSettingsChange({...settings, fftSize: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <button onClick={onClose} className="mt-4 w-full bg-green-700 text-white py-2 font-bold border border-green-500">
          FECHAR
        </button>
      </div>
    </div>
  );
};