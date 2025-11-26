import React from 'react';
import { SdrPlugin } from '../types';

interface PluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: SdrPlugin[];
}

export const PluginsModal: React.FC<PluginsModalProps> = ({ isOpen, onClose, plugins }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="bg-[#051005] border-2 border-green-500 p-4 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-green-500 mb-4">PLUGINS</h2>
        
        <div className="space-y-2">
          {plugins.map(p => (
            <div key={p.id} className="border border-green-800 p-2">
              <div className="font-bold text-green-500">{p.name}</div>
              <div className="text-xs text-green-700">{p.description}</div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-4 w-full bg-green-700 text-white py-2 font-bold">
          FECHAR
        </button>
      </div>
    </div>
  );
};