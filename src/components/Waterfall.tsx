import React, { useRef, useEffect, useState, useMemo } from 'react';

export interface WaterfallProps {
  powerOn: boolean;
  frequency: number;
  contrast: number;
  offset: number;
  range: number;
  onFreqChange: (freq: number) => void;
  width: number;
  height: number;
  scroll: number;
  realData?: Uint8Array;
  waterfallHeight?: number;
}

export const Waterfall: React.FC<WaterfallProps> = ({
  powerOn,
  frequency,
  contrast,
  offset,
  range,
  onFreqChange,
  width,
  height,
  scroll,
  realData,
  waterfallHeight = 70
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallDataRef = useRef<ImageData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showFreqEdit, setShowFreqEdit] = useState(false);
  const [freqInput, setFreqInput] = useState('');
  const lastUpdateRef = useRef<number>(0);
  const pendingDataRef = useRef<Uint8Array | null>(null);

  // Calcular alturas em pixels absolutos usando useMemo para evitar recalculos
  const { actualWaterfallHeight, spectrumHeight } = useMemo(() => {
    const wfHeight = Math.floor(height * (waterfallHeight / 100));
    return {
      actualWaterfallHeight: wfHeight,
      spectrumHeight: height - wfHeight
    };
  }, [height, waterfallHeight]);

  // Armazenar dados recebidos
  useEffect(() => {
    if (realData && realData.length > 0) {
      pendingDataRef.current = realData;
    }
  }, [realData]);

  // Inicializar canvas apenas quando tamanho mudar
  useEffect(() => {
    const canvas = canvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!canvas || !spectrumCanvas) return;

    if (canvas.width !== width || canvas.height !== actualWaterfallHeight) {
      canvas.width = width;
      canvas.height = actualWaterfallHeight;
      spectrumCanvas.width = width;
      spectrumCanvas.height = spectrumHeight;
      waterfallDataRef.current = null;
      console.log(`[Waterfall] Redimensionado: ${width}x${actualWaterfallHeight}`);
    }
  }, [width, actualWaterfallHeight, spectrumHeight]);

  // Renderização principal
  useEffect(() => {
    const canvas = canvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!canvas || !spectrumCanvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const spectrumCtx = spectrumCanvas.getContext('2d');
    if (!ctx || !spectrumCtx) return;

    // Throttle: apenas renderizar a cada 33ms (30 FPS)
    const now = performance.now();
    if (now - lastUpdateRef.current < 33) return;
    lastUpdateRef.current = now;

    if (!powerOn) {
      // Modo desligado
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, actualWaterfallHeight);
      
      spectrumCtx.fillStyle = '#000000';
      spectrumCtx.fillRect(0, 0, width, spectrumHeight);
      
      spectrumCtx.strokeStyle = '#0a3d2a';
      spectrumCtx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = (spectrumHeight / 10) * i;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(0, y);
        spectrumCtx.lineTo(width, y);
        spectrumCtx.stroke();
      }
      for (let i = 0; i <= 8; i++) {
        const x = (width / 8) * i;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(x, 0);
        spectrumCtx.lineTo(x, spectrumHeight);
        spectrumCtx.stroke();
      }
      
      spectrumCtx.fillStyle = '#166534';
      spectrumCtx.font = 'bold 24px monospace';
      spectrumCtx.textAlign = 'center';
      spectrumCtx.fillText('RÁDIO DESLIGADO', width / 2, spectrumHeight / 2);
      
      waterfallDataRef.current = null;
      return;
    }

    // Processar dados IQ
    const dataToProcess = pendingDataRef.current;
    if (dataToProcess && dataToProcess.length > 0) {
      const fftSize = Math.min(dataToProcess.length / 2, 2048);
      const spectrum = new Float32Array(fftSize);

      for (let i = 0; i < fftSize && i * 2 + 1 < dataToProcess.length; i++) {
        const I = (dataToProcess[i * 2] - 127.5) / 127.5;
        const Q = (dataToProcess[i * 2 + 1] - 127.5) / 127.5;
        const power = I * I + Q * Q;
        spectrum[i] = 10 * Math.log10(power + 0.0000001);
      }

      // Desenhar espectro
      spectrumCtx.fillStyle = '#000000';
      spectrumCtx.fillRect(0, 0, width, spectrumHeight);

      spectrumCtx.strokeStyle = '#0a3d2a';
      spectrumCtx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = (spectrumHeight / 10) * i;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(0, y);
        spectrumCtx.lineTo(width, y);
        spectrumCtx.stroke();
      }

      spectrumCtx.strokeStyle = '#22c55e';
      spectrumCtx.lineWidth = 2;
      spectrumCtx.beginPath();
      for (let i = 0; i < width; i++) {
        const idx = Math.floor((i / width) * fftSize);
        const db = spectrum[idx] || -100;
        const normalizedDb = Math.max(0, Math.min(1, (db + 100) / 80));
        const y = spectrumHeight - normalizedDb * spectrumHeight;
        if (i === 0) spectrumCtx.moveTo(i, y);
        else spectrumCtx.lineTo(i, y);
      }
      spectrumCtx.stroke();

      spectrumCtx.strokeStyle = '#ef4444';
      spectrumCtx.lineWidth = 1;
      spectrumCtx.beginPath();
      spectrumCtx.moveTo(width / 2, 0);
      spectrumCtx.lineTo(width / 2, spectrumHeight);
      spectrumCtx.stroke();

      // Desenhar indicadores de range (largura de banda visível)
      if (range > 0.1) {
        const rangePixels = (range / 2.0) * width; // range é o total, dividir por 2 para cada lado
        const leftEdge = width / 2 - rangePixels;
        const rightEdge = width / 2 + rangePixels;
        
        spectrumCtx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        spectrumCtx.lineWidth = 2;
        spectrumCtx.setLineDash([5, 5]);
        
        // Linha esquerda
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(leftEdge, 0);
        spectrumCtx.lineTo(leftEdge, spectrumHeight);
        spectrumCtx.stroke();
        
        // Linha direita
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(rightEdge, 0);
        spectrumCtx.lineTo(rightEdge, spectrumHeight);
        spectrumCtx.stroke();
        
        spectrumCtx.setLineDash([]);
      }

      // Waterfall
      if (!waterfallDataRef.current) {
        waterfallDataRef.current = ctx.createImageData(width, actualWaterfallHeight);
      }

      const imageData = waterfallDataRef.current;
      const data = imageData.data;

      for (let y = actualWaterfallHeight - 1; y > 0; y--) {
        for (let x = 0; x < width; x++) {
          const destIdx = (y * width + x) * 4;
          const srcIdx = ((y - 1) * width + x) * 4;
          data[destIdx] = data[srcIdx];
          data[destIdx + 1] = data[srcIdx + 1];
          data[destIdx + 2] = data[srcIdx + 2];
          data[destIdx + 3] = 255;
        }
      }

      for (let x = 0; x < width; x++) {
        const idx = Math.floor((x / width) * fftSize);
        const db = spectrum[idx] || -100;
        const adjustedDb = (db + offset) * (contrast / 50);
        const normalizedDb = Math.max(0, Math.min(1, (adjustedDb + 100) / 80));
        const color = getColor(normalizedDb);
        const pixelIdx = x * 4;
        data[pixelIdx] = color[0];
        data[pixelIdx + 1] = color[1];
        data[pixelIdx + 2] = color[2];
        data[pixelIdx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
    }
  }, [powerOn, width, height, actualWaterfallHeight, spectrumHeight, contrast, offset, realData, range]);

  const getColor = (value: number): [number, number, number] => {
    // Cores suavizadas - reduzir intensidade
    const v = Math.pow(value, 1.5); // Aplicar gamma para suavizar
    
    if (v < 0.25) {
      const t = v / 0.25;
      return [0, Math.floor(t * 80), Math.floor(80 + t * 80)];
    } else if (v < 0.5) {
      const t = (v - 0.25) / 0.25;
      return [0, Math.floor(80 + t * 100), Math.floor(160 - t * 80)];
    } else if (v < 0.75) {
      const t = (v - 0.5) / 0.25;
      return [Math.floor(t * 180), Math.floor(180 + t * 75), Math.floor(80 - t * 80)];
    } else {
      const t = (v - 0.75) / 0.25;
      return [Math.floor(180 + t * 75), Math.floor(255 - t * 100), 0];
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!powerOn) return;
    setIsDragging(true);
    handleFreqClick(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!powerOn || !isDragging) return;
    handleFreqClick(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleFreqClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / width;
    // Range é em MHz, converter para Hz
    const span = (range * 1000000);
    const offsetFreq = (percent - 0.5) * span;
    const newFreq = frequency + offsetFreq;
    onFreqChange(Math.max(0, newFreq));
  };

  const handleFreqEditSubmit = () => {
    const parsed = parseFloat(freqInput);
    if (!isNaN(parsed) && parsed > 0) {
      onFreqChange(parsed * 1000000); // Converter MHz para Hz
    }
    setShowFreqEdit(false);
    setFreqInput('');
  };

  const handleFreqEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFreqEditSubmit();
    } else if (e.key === 'Escape') {
      setShowFreqEdit(false);
      setFreqInput('');
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <canvas
        ref={spectrumCanvasRef}
        className="w-full cursor-crosshair"
        style={{ height: `${spectrumHeight}px`, display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${actualWaterfallHeight}px`, display: 'block' }}
      />
      {powerOn && !showFreqEdit && (
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <div 
            className="bg-black/70 px-3 py-1 rounded border border-green-700 text-green-400 font-mono text-xs cursor-pointer hover:border-green-500"
            onClick={() => {
              setFreqInput((frequency / 1000000).toFixed(6));
              setShowFreqEdit(true);
            }}
            title="Clique para editar frequência"
          >
            {(frequency / 1000000).toFixed(3)} MHz
          </div>
          <div className="bg-black/70 px-2 py-0.5 rounded border border-yellow-700/50 text-yellow-400 font-mono text-[10px] text-center">
            ±{(range / 2).toFixed(1)} MHz
          </div>
        </div>
      )}
      {powerOn && showFreqEdit && (
        <div className="absolute top-2 right-2 bg-[#051005] border-2 border-green-500 p-2 rounded shadow-lg z-50">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              step="0.001"
              value={freqInput}
              onChange={(e) => setFreqInput(e.target.value)}
              onKeyDown={handleFreqEditKeyDown}
              placeholder="MHz"
              autoFocus
              className="w-32 bg-black border border-green-700 p-1 text-sm text-green-400 rounded font-mono"
            />
            <button 
              onClick={handleFreqEditSubmit} 
              className="px-2 py-1 bg-green-600 text-black text-xs font-bold rounded hover:bg-green-500"
            >
              OK
            </button>
            <button 
              onClick={() => { setShowFreqEdit(false); setFreqInput(''); }} 
              className="px-2 py-1 bg-red-700 text-white text-xs font-bold rounded hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
