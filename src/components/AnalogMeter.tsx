import React from 'react';

interface AnalogMeterProps {
  db: number;
}

export const AnalogMeter: React.FC<AnalogMeterProps> = ({ db }) => {
  const clampedDb = Math.max(-110, Math.min(60, db));
  const angle = ((clampedDb + 110) / 170) * 180 - 90;

  return (
    <div className="h-16 bg-black border-b border-green-800 flex items-center justify-center relative">
      <svg width="200" height="60" viewBox="0 0 200 60" className="absolute">
        <path d="M 20 50 Q 100 10 180 50" stroke="#39ff14" strokeWidth="2" fill="none" />
        <line 
          x1="100" 
          y1="50" 
          x2={100 + 70 * Math.cos((angle * Math.PI) / 180)} 
          y2={50 + 70 * Math.sin((angle * Math.PI) / 180)} 
          stroke="#39ff14" 
          strokeWidth="3" 
        />
      </svg>
      <div className="absolute bottom-1 text-xs font-mono text-green-600">
        S-Meter: {db.toFixed(1)} dBm
      </div>
    </div>
  );
};