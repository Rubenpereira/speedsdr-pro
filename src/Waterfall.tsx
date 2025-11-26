import React, { useRef, useEffect, useState } from 'react';

interface WaterfallProps {
  powerOn: boolean;
  frequency: number;
  contrast: number;
  offset: number;
  range: number;
  onFreqChange: (freq: number) => void;
  width: number;
  height: number;
}

export const Waterfall: React.FC<WaterfallProps> = ({ 
  powerOn, 
  frequency, 
  contrast, 
  offset, 
  range,
  onFreqChange,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Interaction States
  const [crosshair, setCrosshair] = useState<{x: number, y: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastDragX = useRef<number>(0);

  // Simulated data buffer for waterfall scroll
  const waterfallData = useRef<ImageData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const specCanvas = spectrumRef.current;
    if (!canvas || !specCanvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const specCtx = specCanvas.getContext('2d');
    
    if (!ctx || !specCtx) return;

    // Initialize black screen
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const draw = () => {
      if (!powerOn) {
        // Just static or black when off
         specCtx.fillStyle = '#051005';
         specCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);
         animationRef.current = requestAnimationFrame(draw);
         return;
      }

      // 1. Shift Waterfall Down
      const wWidth = canvas.width;
      const wHeight = canvas.height;
      
      // Get existing image data
      try {
        const currentImage = ctx.getImageData(0, 0, wWidth, wHeight - 1);
        ctx.putImageData(currentImage, 0, 1);
      } catch (e) {
        // Handle canvas resize causing fetch issues
      }

      // 2. Generate New Line (Simulated RF)
      const newLine = ctx.createImageData(wWidth, 1);
      const data = newLine.data;
      
      // Spectrum Setup
      specCtx.fillStyle = '#001500';
      specCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);
      specCtx.beginPath();
      specCtx.moveTo(0, specCanvas.height);

      // Simulate a signal at the center (tuned frequency)
      const centerBin = wWidth / 2;
      
      // Generate noise and signals
      for (let x = 0; x < wWidth; x++) {
        let noise = Math.random() * 0.2; // Base noise floor
        
        // Create a "tuned" signal peak at center
        const distFromCenter = Math.abs(x - centerBin);
        if (distFromCenter < 20) {
           noise += (1 - distFromCenter / 20) * 0.8 * Math.random();
        }

        // Random signals elsewhere
        const randomSignal = Math.sin(x * 0.05 + Date.now() * 0.001) * Math.sin(x * 0.02);
        if (randomSignal > 0.95) noise += 0.4;

        // Apply Gain/Offset/Contrast logic (simplified)
        // Adjust value based on sliders
        let value = (noise * range) + (offset / 100);
        value = Math.min(Math.max(value, 0), 1); // Clamp 0-1

        // Color mapping (Blue intensity per user request)
        // "azul com tom meio forte"
        const r = 0;
        const g = value * 100 * (contrast/50);
        const b = value * 255 * (contrast/50);

        const index = x * 4;
        data[index] = r;     // R
        data[index + 1] = g; // G
        data[index + 2] = b; // B
        data[index + 3] = 255; // Alpha

        // Draw Spectrum Line
        const y = specCanvas.height - (value * specCanvas.height);
        specCtx.lineTo(x, y);
      }

      // Apply new line to top of waterfall
      ctx.putImageData(newLine, 0, 0);

      // Finish Spectrum
      specCtx.strokeStyle = '#00ff00';
      specCtx.lineWidth = 1;
      specCtx.stroke();

      // Draw Grid on Spectrum
      specCtx.strokeStyle = '#14532d';
      specCtx.beginPath();
      for(let i=0; i<specCanvas.width; i+=50) {
        specCtx.moveTo(i, 0);
        specCtx.lineTo(i, specCanvas.height);
      }
      specCtx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [powerOn, contrast, offset, range, width, height]);

  // Handle Interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastDragX.current = e.clientX;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // Calculate position relative to container (Spectrum + Waterfall)
    // Note: rect is just the waterfall part, we need the parent div
    const parentRect = e.currentTarget.getBoundingClientRect();
    
    const x = e.clientX - parentRect.left;
    const y = e.clientY - parentRect.top;
    setCrosshair({ x, y });

    // Drag Logic
    if (isDragging) {
        const deltaX = lastDragX.current - e.clientX;
        lastDragX.current = e.clientX;
        
        // Scale factor: 1 pixel drag = how much frequency shift?
        // Let's assume 10kHz per 10 pixels roughly, or dynamically based on width
        const scaleFactor = 2000; // Hz per pixel
        const freqShift = deltaX * scaleFactor;
        
        onFreqChange(frequency + freqShift);
    }
  };

  const handleMouseLeave = () => {
    setCrosshair(null);
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
     // Only click to tune if not dragging
     if (isDragging) return;
     
     if (!canvasRef.current) return;
     const parentRect = e.currentTarget.getBoundingClientRect();
     const x = e.clientX - parentRect.left;
     const center = parentRect.width / 2;
     
     // Only jump freq if click wasn't part of a drag operation
     // Simple check: if we are here, isDragging is false (due to mouseUp happening first usually)
     // But for standard UI, click usually happens on MouseUp. 
     // We'll let Drag logic handle continuous movement, and Click handle instant jumps 
     // but we need to distinguish a "click" from a "drag release".
     // For this simple implementation, we'll assume if delta was 0 it's a click.
     // Implementing simple click-to-tune:
     
     const diff = (x - center) * 1000; // Fake scale: 1px = 1kHz deviation
     onFreqChange(frequency + diff);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Scroll wheel adjusts frequency by 1kHz
    const delta = e.deltaY > 0 ? -1000 : 1000;
    onFreqChange(frequency + delta);
  };

  return (
    <div 
      className={`flex flex-col relative border border-green-800 bg-black h-full ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      // onClick handled via MouseUp logic mostly in SDRs, but here overlapping with Drag
    >
        {/* Spectrum (Top) */}
        <canvas 
            ref={spectrumRef} 
            width={width} 
            height={height * 0.3} // 30% height for spectrum
            className="w-full bg-black border-b border-green-900 pointer-events-none"
        />
        
        {/* Waterfall (Bottom) */}
        <canvas 
            ref={canvasRef} 
            width={width} 
            height={height * 0.7} // 70% height for waterfall
            className="w-full bg-black flex-grow pointer-events-none"
        />

        {/* Crosshairs */}
        {crosshair && (
            <>
                {/* Vertical Line */}
                <div 
                    className="absolute top-0 bottom-0 w-[1px] bg-red-500/50 pointer-events-none"
                    style={{ left: crosshair.x }}
                >
                    <div className="absolute top-0 text-[10px] bg-black text-red-500 ml-1 px-1 z-30">
                    {((frequency + (crosshair.x - (width/2)) * 1000)/1000000).toFixed(4)} MHz
                    </div>
                </div>

                {/* Horizontal Line */}
                <div 
                    className="absolute left-0 right-0 h-[1px] bg-red-500/50 pointer-events-none"
                    style={{ top: crosshair.y }}
                ></div>
            </>
        )}

        {/* Center Reference Line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-yellow-500/30 pointer-events-none"></div>
    </div>
  );
};