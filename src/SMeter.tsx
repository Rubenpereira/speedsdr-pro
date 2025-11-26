import React, { useEffect, useState } from 'react';

interface SMeterProps {
  signalStrength: number; // 0 to 100
  powerOn: boolean;
}

export const SMeter: React.FC<SMeterProps> = ({ signalStrength, powerOn }) => {
  const [needleAngle, setNeedleAngle] = useState(-45);

  useEffect(() => {
    if (!powerOn) {
      setNeedleAngle(-45);
      return;
    }
    // Map 0-100 to -45 to 45 degrees
    const angle = -45 + (signalStrength * 0.9); 
    setNeedleAngle(angle);
  }, [signalStrength, powerOn]);

  return (
    <div className="relative w-48 h-24 bg-black border-2 border-green-800 rounded-t-xl overflow-hidden shadow-[0_0_15px_rgba(34,197,94,0.3)]">
        {/* Background Dial */}
        <div className="absolute w-full h-full flex justify-center items-end pb-2">
            <div className="text-[10px] text-green-600 font-bold flex space-x-2 w-full justify-between px-4 mb-6">
                <span>0</span>
                <span>3</span>
                <span>5</span>
                <span>7</span>
                <span>9</span>
                <span className="text-red-500">+10</span>
                <span className="text-red-600">+30</span>
            </div>
        </div>

        {/* Needle */}
        <div 
            className="absolute bottom-0 left-1/2 w-1 h-20 bg-red-500 origin-bottom transition-transform duration-150 ease-out z-10 shadow-sm"
            style={{ transform: `translateX(-50%) rotate(${needleAngle}deg)` }}
        />
        
        {/* Pivot */}
        <div className="absolute bottom-[-5px] left-1/2 w-4 h-4 bg-gray-400 rounded-full transform -translate-x-1/2 z-20 border border-black"></div>

        {/* Glass Glare */}
        <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

        {/* LED Bar (Underneath) */}
        <div className="absolute bottom-1 w-full px-2 flex space-x-1 h-2">
            {[...Array(10)].map((_, i) => (
                <div 
                    key={i} 
                    className={`flex-1 rounded-sm ${
                        powerOn && signalStrength > i * 10 
                            ? i > 7 ? 'bg-red-500 shadow-[0_0_5px_red]' : 'bg-green-500 shadow-[0_0_5px_green]' 
                            : 'bg-green-900/30'
                    }`}
                />
            ))}
        </div>
    </div>
  );
};