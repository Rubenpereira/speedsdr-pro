import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

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
  const lastUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const pendingDataRef = useRef<Uint8Array | null>(null);
  const waterfallHeightRef = useRef<number>(waterfallHeight);

  // Atualizar ref quando waterfallHeight mudar
  useEffect(() => {
    waterfallHeightRef.current = waterfallHeight;
  }, [waterfallHeight]);

  // Calcular alturas em pixels absolutos usando useMemo
  const { actualWaterfallHeight, spectrumHeight } = useMemo(() => {
    const wfHeight = Math.floor(height * (waterfallHeightRef.current / 100));
    return {
      actualWaterfallHeight: wfHeight,
      spectrumHeight: height - wfHeight
    };
  }, [height]);

  // Armazenar dados recebidos para processar no próximo frame
  useEffect(() => {
    if (realData && realData.length > 0) {
      pendingDataRef.current = realData;
    }
  }, [realData]);

  // useEffect separado para inicialização do canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!canvas || !spectrumCanvas) return;
    if (width <= 0 || height <= 0) return;

    // Verificar se precisa recriar canvas (apenas uma vez por mudança de tamanho)
    if (canvas.width !== width || canvas.height !== actualWaterfallHeight) {
      canvas.width = width;
      canvas.height = actualWaterfallHeight;
      spectrumCanvas.width = width;
      spectrumCanvas.height = spectrumHeight;
      waterfallDataRef.current = null;
      console.log(`[Waterfall] RECRIADO: ${width}x${actualWaterfallHeight}`);
    }
  }, [width, actualWaterfallHeight, spectrumHeight]);

  // useEffect separado para renderização
  useEffect(() => {
    const canvas = canvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!canvas || !spectrumCanvas) return;
    if (width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const spectrumCtx = spectrumCanvas.getContext('2d');
    if (!ctx || !spectrumCtx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      // Throttle de renderização: máximo 30 FPS
      const now = performance.now();
      if (now - lastUpdateRef.current < 33) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }
      lastUpdateRef.current = now;

      if (!powerOn) {
        // Limpar quando desligado
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, actualWaterfallHeight);
        
        spectrumCtx.fillStyle = '#000000';
        spectrumCtx.fillRect(0, 0, width, spectrumHeight);
      
      // Desenhar grid de fundo no espectro
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

      // Texto "OFF"
      spectrumCtx.fillStyle = '#166534';
      spectrumCtx.font = 'bold 24px monospace';
      spectrumCtx.textAlign = 'center';
      spectrumCtx.fillText('RÁDIO DESLIGADO', width / 2, spectrumHeight / 2);
      
      waterfallDataRef.current = null;
      return;
    }

    // Throttle de renderização: máximo 30 FPS
    const now = performance.now();
    if (now - lastUpdateRef.current < 33) {
      return; // Skip se menos de 33ms desde último update
    }
    lastUpdateRef.current = now;

    // Processar dados reais se disponíveis (usar dados pendentes)
    const dataToProcess = pendingDataRef.current;
    if (dataToProcess && dataToProcess.length > 0) {
      const fftSize = Math.min(dataToProcess.length / 2, 2048);
      const spectrum = new Float32Array(fftSize);

      // Calcular espectro de potência
      for (let i = 0; i < fftSize && i * 2 + 1 < dataToProcess.length; i++) {
        const I = (dataToProcess[i * 2] - 127.5) / 127.5;
        const Q = (dataToProcess[i * 2 + 1] - 127.5) / 127.5;
        const power = I * I + Q * Q;
        spectrum[i] = 10 * Math.log10(power + 0.0000001);
      }

      // Desenhar espectro
      spectrumCtx.fillStyle = '#000000';
      spectrumCtx.fillRect(0, 0, width, spectrumHeight);

      // Grid
      spectrumCtx.strokeStyle = '#0a3d2a';
      spectrumCtx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = (spectrumHeight / 10) * i;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(0, y);
        spectrumCtx.lineTo(width, y);
        spectrumCtx.stroke();
      }

      // Linha do espectro
      spectrumCtx.strokeStyle = '#22c55e';
      spectrumCtx.lineWidth = 2;
      spectrumCtx.beginPath();

      for (let i = 0; i < width; i++) {
        const idx = Math.floor((i / width) * fftSize);
        const db = spectrum[idx] || -100;
        const normalizedDb = Math.max(0, Math.min(1, (db + 100) / 80));
        const y = spectrumHeight - normalizedDb * spectrumHeight;
        
        if (i === 0) {
          spectrumCtx.moveTo(i, y);
        } else {
          spectrumCtx.lineTo(i, y);
        }
      }
      spectrumCtx.stroke();

      // Linha central
      spectrumCtx.strokeStyle = '#ef4444';
      spectrumCtx.lineWidth = 1;
      spectrumCtx.beginPath();
      spectrumCtx.moveTo(width / 2, 0);
      spectrumCtx.lineTo(width / 2, spectrumHeight);
      spectrumCtx.stroke();

      // Atualizar waterfall
      if (!waterfallDataRef.current) {
        waterfallDataRef.current = ctx.createImageData(width, actualWaterfallHeight);
      }

      const imageData = waterfallDataRef.current;
      const data = imageData.data;

      // Scroll down (mover dados antigos para baixo)
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

      // Nova linha no topo
      for (let x = 0; x < width; x++) {
        const idx = Math.floor((x / width) * fftSize);
        const db = spectrum[idx] || -100;
        
        // Aplicar controles de offset e contrast
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

    } else {
      // Dados simulados se não houver dados reais
      const fakeSpectrum = new Float32Array(width);
      for (let i = 0; i < width; i++) {
        fakeSpectrum[i] = -80 + Math.random() * 40 + Math.sin(i * 0.1) * 10;
      }

      // Desenhar espectro simulado
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
        const db = fakeSpectrum[i];
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

      // Waterfall simulado
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
        const db = fakeSpectrum[x];
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

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [powerOn, width, height, contrast, offset]);

  // Colormap (azul -> verde -> amarelo -> vermelho)
  const getColor = (value: number): [number, number, number] => {
    if (value < 0.25) {
      const t = value / 0.25;
      return [0, Math.floor(t * 128), Math.floor(128 + t * 127)];
    } else if (value < 0.5) {
      const t = (value - 0.25) / 0.25;
      return [0, Math.floor(128 + t * 127), Math.floor(255 - t * 128)];
    } else if (value < 0.75) {
      const t = (value - 0.5) / 0.25;
      return [Math.floor(t * 255), 255, Math.floor(127 - t * 127)];
    } else {
      const t = (value - 0.75) / 0.25;
      return [255, Math.floor(255 - t * 255), 0];
    }
  };

  // Handlers de clique/arrasto para mudança de frequência
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
    const span = (range * 1000000);
    const offsetFreq = (percent - 0.5) * span;
    const newFreq = frequency + offsetFreq;
    onFreqChange(newFreq);
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Espectro */}
      <canvas
        ref={spectrumCanvasRef}
        className="w-full cursor-crosshair"
        style={{ height: `${spectrumHeight}px`, display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {/* Waterfall */}
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${actualWaterfallHeight}px`, display: 'block' }}
      />

      {/* Overlay de frequência */}
      {powerOn && (
        <div className="absolute top-2 right-2 bg-black/70 px-3 py-1 rounded border border-green-700 text-green-400 font-mono text-xs pointer-events-none">
          {(frequency / 1000000).toFixed(3)} MHz
        </div>
      )}
    </div>
  );
};