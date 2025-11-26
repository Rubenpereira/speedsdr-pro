import React, { useRef, useEffect } from 'react';

interface SpectrumWaterfallProps {
  isPlaying: boolean;
  centerFrequency: number;
  bandwidth: number;
  waterfallSettings: { offset: number; contrast: number; range: number };
  onFrequencySelect: (freq: number) => void;
  fftSize: number;
  mainGain: number;
  rfGain: number;
  tunerAgc: boolean;
  step: number;
  realData: Uint8Array | null;
}

export const SpectrumWaterfall: React.FC<SpectrumWaterfallProps> = ({
  isPlaying,
  centerFrequency,
  bandwidth,
  waterfallSettings,
  onFrequencySelect,
  fftSize,
  realData
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const waterfall = waterfallRef.current;
    if (!canvas || !waterfall) return;

    const ctx = canvas.getContext('2d');
    const wctx = waterfall.getContext('2d');
    if (!ctx || !wctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Limpar
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    if (realData && realData.length > 0) {
      // Espectro
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < width; i++) {
        const idx = Math.floor((i / width) * realData.length);
        const val = realData[idx] || 0;
        const y = height - (val / 255) * height;
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();

      // Waterfall
      const imgData = wctx.createImageData(width, 1);
      for (let i = 0; i < width; i++) {
        const idx = Math.floor((i / width) * realData.length);
        const val = realData[idx] || 0;
        const intensity = Math.floor(val * waterfallSettings.contrast + waterfallSettings.offset);
        const clamped = Math.max(0, Math.min(255, intensity));
        
        imgData.data[i * 4] = 0;
        imgData.data[i * 4 + 1] = clamped;
        imgData.data[i * 4 + 2] = 0;
        imgData.data[i * 4 + 3] = 255;
      }
      
      // Scroll waterfall
      const temp = wctx.getImageData(0, 0, width, waterfall.height - 1);
      wctx.putImageData(temp, 0, 1);
      wctx.putImageData(imgData, 0, 0);
    }
  }, [realData, waterfallSettings]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = (x / rect.width) - 0.5;
    const offset = ratio * bandwidth;
    onFrequencySelect(centerFrequency + offset);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <canvas 
        ref={canvasRef} 
        width={1024} 
        height={200} 
        className="w-full h-1/3 border-b border-green-800"
        onClick={handleClick}
      />
      <canvas 
        ref={waterfallRef} 
        width={1024} 
        height={400} 
        className="w-full flex-1"
        onClick={handleClick}
      />
    </div>
  );
};