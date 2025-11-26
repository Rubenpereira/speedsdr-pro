import React from 'react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTune: (freq: number) => void;
  currentSquelch: number;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="bg-[#051005] border-2 border-green-500 p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-green-500 mb-4">SCANNER</h2>
        <p className="text-green-600">Em desenvolvimento...</p>
        <button onClick={onClose} className="mt-4 bg-green-700 text-white px-4 py-2 font-bold">
          FECHAR
        </button>
      </div>
    </div>
  );
};