/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { Power, Settings, Radio, Activity, Grid, List, X, ExternalLink, Sliders, Minimize2, Volume2, Edit2, Volume } from 'lucide-react';
import { SMeter } from './components/SMeter';
import { Waterfall } from './components/Waterfall';
import { DecoderWindow } from './components/DecoderWindow';
import { DemodMode, BandPreset, SampleMode, SquelchState } from './types';
import { BANDS, PLUGINS, LICENSE_TEXT, SAMPLE_RATES, STEP_SIZES } from './constants';

export default function App() {
  // --- Global State ---
  const [powerOn, setPowerOn] = useState(false);
  const [frequency, setFrequency] = useState(145350000);
  const [mode, setMode] = useState<DemodMode>(DemodMode.NFM);
  const [bandwidth, setBandwidth] = useState(10000);
  const [sampleRate, setSampleRate] = useState(1.024);
  const [sampleMode, setSampleMode] = useState<SampleMode>(SampleMode.QUADRATURE);
  const [rfGain, setRfGain] = useState(49.6); // Iniciar no máximo para melhor recepção
  const [agcEnabled, setAgcEnabled] = useState(false);
  const [squelch, setSquelch] = useState<SquelchState>({ enabled: false, level: 0 });
  const [step, setStep] = useState(10);
  const [volume, setVolume] = useState(20);
  
  // --- UI State ---
  const [showConfig, setShowConfig] = useState(false);
  const [showTcpWindow, setShowTcpWindow] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [activePlugin, setActivePlugin] = useState<string | null>(null);
  const [runningPlugin, setRunningPlugin] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [nrActive, setNrActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
  const [showAudioOutput, setShowAudioOutput] = useState(false);
  const [audioOutput, setAudioOutput] = useState('speaker');
  const [showFreqEditor, setShowFreqEditor] = useState(false);
  const [freqInput, setFreqInput] = useState('');
  const [isDraggingWaterfall, setIsDraggingWaterfall] = useState(false);

  // --- Waterfall Controls ---
  const [wfOffset, setWfOffset] = useState(10);
  const [wfContrast, setWfContrast] = useState(50);
  const [wfRange, setWfRange] = useState(1.0);
  const [wfScroll, setWfScroll] = useState(0);
  const [wfHeight, setWfHeight] = useState(70); // Porcentagem da altura para cachoeira

  // --- Layout State ---
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [waterfallDimensions, setWaterfallDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const waterfallRef = useRef<HTMLDivElement>(null);

  // --- Audio + WebSocket State ---
  const [isConnected, setIsConnected] = useState(false);
  const [signalStrength, setSignalStrength] = useState(0);
  const [backendFreq, setBackendFreq] = useState<number | null>(null);
  const [isSquelchClosed, setIsSquelchClosed] = useState(false);
  const [latestIQData, setLatestIQData] = useState<Uint8Array | undefined>(undefined);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const squelchGainRef = useRef<GainNode | null>(null);
  const lastAngleRef = useRef(0);
  const isProcessingRef = useRef(false);
  const audioBufferQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const lastSampleRef = useRef(0);
  const prevSampleModeRef = useRef<SampleMode>(SampleMode.QUADRATURE);

  // --- Resize Observer ---
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
      if (waterfallRef.current) {
        setWaterfallDimensions({
          width: waterfallRef.current.offsetWidth,
          height: waterfallRef.current.offsetHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Forçar atualização após 100ms para garantir que o DOM está pronto
    const timer = setTimeout(handleResize, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!powerOn) return;
        
        if (e.key === 'ArrowUp') {
            setFrequency(prev => prev + 1000000);
        } else if (e.key === 'ArrowDown') {
            setFrequency(prev => Math.max(0, prev - 1000000));
        } else if (e.key === 'ArrowRight') {
            setFrequency(prev => prev + 10000);
        } else if (e.key === 'ArrowLeft') {
            setFrequency(prev => Math.max(0, prev - 10000));
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [powerOn]);

  // --- Waterfall Drag Handler ---
  const handleWaterfallMouseDown = (e: React.MouseEvent) => {
    setIsDraggingWaterfall(true);
  };

  const handleWaterfallMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingWaterfall) return;
    setWfScroll(prev => prev + e.movementY);
  };

  const handleWaterfallMouseUp = () => {
    setIsDraggingWaterfall(false);
  };

  useEffect(() => {
    if (isDraggingWaterfall) {
      const handleMouseMove = (e: MouseEvent) => {
        setWfScroll(prev => prev + e.movementY);
      };
      const handleMouseUp = () => {
        setIsDraggingWaterfall(false);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingWaterfall]);

  // --- Frequency Editor ---
  const handleFreqEdit = () => {
    const parsed = parseFloat(freqInput);
    if (!isNaN(parsed)) {
      setFrequency(parsed * 1000000);
    }
    setShowFreqEditor(false);
    setFreqInput('');
  };

  const handleFreqInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFreqEdit();
    } else if (e.key === 'Escape') {
      setShowFreqEditor(false);
      setFreqInput('');
    }
  };

  // --- Format Frequency String ---
  const formatFreq = (freq: number) => {
    const mhz = (freq / 1000000).toFixed(6);
    const parts = mhz.split('.');
    return { main: parts[0], sub: parts[1] };
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // --- Mode Change Logic ---
  const handleModeChange = (newMode: DemodMode) => {
    setMode(newMode);
    switch (newMode) {
      case DemodMode.NFM:
        setBandwidth(10000);
        break;
      case DemodMode.WFM:
        setBandwidth(100000);
        break;
      case DemodMode.AM:
        setBandwidth(6000);
        break;
      case DemodMode.LSB:
      case DemodMode.USB:
        setBandwidth(3000);
        break;
      case DemodMode.CW:
        setBandwidth(500);
        break;
      default:
        break;
    }
  };

  const setBand = (preset: BandPreset) => {
      setFrequency(preset.frequency);
      handleModeChange(preset.mode);
      closeContextMenu();
  };

  // --- Audio Playback ---
  const playAudioBuffer = (ctx: AudioContext, data: Float32Array) => {
    if (!squelchGainRef.current || !powerOn) return;
    audioBufferQueueRef.current.push(data);
    // Buffer otimizado para baixa latência
    if (audioBufferQueueRef.current.length > 4) {
      audioBufferQueueRef.current.shift();
    }
    // Começar reprodução rapidamente
    if (!isPlayingRef.current && audioBufferQueueRef.current.length >= 2) {
      processAudioQueue(ctx);
    }
  };

  const processAudioQueue = (ctx: AudioContext) => {
    if (audioBufferQueueRef.current.length === 0 || !powerOn || !squelchGainRef.current) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const chunk = audioBufferQueueRef.current.shift()!;
    const audioBuffer = ctx.createBuffer(1, chunk.length, ctx.sampleRate);
    const out = audioBuffer.getChannelData(0);
    
    // Blending suave entre chunks (4 amostras)
    const blendSamples = Math.min(4, chunk.length);
    for (let i = 0; i < chunk.length; i++) {
      if (i < blendSamples) {
        const blend = i / blendSamples;
        out[i] = lastSampleRef.current * (1 - blend) + chunk[i] * blend;
      } else {
        out[i] = chunk[i];
      }
    }
    lastSampleRef.current = chunk[chunk.length - 1];
    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(squelchGainRef.current);
    src.onended = () => {
      if (powerOn) {
        processAudioQueue(ctx);
      } else {
        isPlayingRef.current = false;
      }
    };
    src.start();
  };

  // --- WebSocket Connection ---
  const connectWebSocket = () => {
    if (wsRef.current) return;
    const ports = [8080, 8081, 8787];
    let idx = 0;

    const tryPort = () => {
      if (idx >= ports.length) {
        console.error('[WS] Nenhuma porta disponível');
        return;
      }
      const port = ports[idx++];
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Conectado porta ${port}`);
        setIsConnected(true);
        
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({ type: 'SET_MODE', mode: sampleMode === SampleMode.DIRECT_Q ? 'direct_q' : 'quadrature' }));
        }, 100);
        
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({ type: 'SET_FREQ', freq: frequency }));
        }, 200);
        
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({ type: 'SET_GAIN', gain: agcEnabled ? 0 : rfGain, agc: agcEnabled }));
        }, 300);
      };

      ws.onerror = () => {
        console.warn(`[WS] Erro porta ${port}, tentando próxima...`);
        try { ws.close(); } catch {}
        wsRef.current = null;
        tryPort();
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'STATUS') {
              setBackendFreq(msg.freq);
            }
          } catch {}
          return;
        }
        if (!(event.data instanceof ArrayBuffer)) return;
        if (!audioCtxRef.current || !squelchGainRef.current) return;
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        const buf = event.data.slice(0);
        
        // Atualizar dados IQ para o Waterfall
        const iqData = new Uint8Array(buf);
        setLatestIQData(iqData);
        
        // Processar imediatamente sem setTimeout para reduzir latency
        try {
          // --- CORREÇÃO AQUI: Verificação de segurança robusta ---
          if (!audioCtxRef.current || !squelchGainRef.current) {
            isProcessingRef.current = false;
            return;
          }
            
            const data = new Uint8Array(buf);
            const ctx = audioCtxRef.current;
            const gNode = squelchGainRef.current; // Captura a referência localmente
            
            // Validar tamanho mínimo de dados
            if (data.length < 64) {
              isProcessingRef.current = false;
              return;
            }
            
            let maxIQ = data.length / 2;
            if (sampleMode === SampleMode.DIRECT_Q) {
              maxIQ = data.length;
            }
            
            // Decimação ajustada por modo
            let decimation = 4;
            if (mode === DemodMode.NFM) decimation = 2;
            else if (mode === DemodMode.WFM) decimation = 3;
            else if (mode === DemodMode.AM) decimation = 4;
            else decimation = 6; // SSB, CW
            const samples = Math.min(Math.floor(maxIQ / decimation), 4096);
            
            if (samples <= 0) {
              isProcessingRef.current = false;
              return;
            }
            
            const audioOut = new Float32Array(samples);
            let energy = 0;
            let prevAngle = lastAngleRef.current;
            let outIdx = 0;

            if (sampleMode === SampleMode.DIRECT_Q) {
              // Direct Q sampling mode
              const maxIndex = Math.min(data.length, samples * decimation);
              for (let i = 0; i < maxIndex && outIdx < samples; i += decimation) {
                const Q = (data[i] - 127.5) / 127.5;
                energy += Q * Q;
                let v = 0;

                switch (mode) {
                  case DemodMode.NFM: {
                    const angle = Math.atan2(Q, 0.01);
                    let diff = angle - prevAngle;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    prevAngle = angle;
                    v = Math.max(-0.9, Math.min(0.9, diff * 5.0));
                    break;
                  }
                  case DemodMode.WFM: {
                    const angle = Math.atan2(Q, 0.01);
                    let diff = angle - prevAngle;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    prevAngle = angle;
                    v = diff * 1.8;
                    break;
                  }
                  case DemodMode.AM: {
                    const mag = Math.abs(Q);
                    const compressed = Math.log(mag * 10 + 1) / Math.log(11);
                    v = (compressed - 0.5) * 3.0;
                    break;
                  }
                  case DemodMode.USB: {
                    v = Q * 2.5;
                    break;
                  }
                  case DemodMode.LSB: {
                    v = -Q * 2.5;
                    break;
                  }
                  case DemodMode.CW: {
                    const t = outIdx / ctx.sampleRate;
                    const mag = Math.abs(Q);
                    const agcMag = Math.log(mag * 20 + 1) / Math.log(21);
                    v = agcMag * Math.sin(2 * Math.PI * 700 * t) * 2.5;
                    break;
                  }
                  default:
                    v = Q;
                }
                audioOut[outIdx++] = Math.max(-1, Math.min(1, v));
              }
            } else {
              // Quadrature IQ mode (RTL-SDR real samples)
              const maxIndex = Math.min(data.length - 1, samples * 2 * decimation);
              for (let i = 0; i < maxIndex && outIdx < samples; i += 2 * decimation) {
                const I = (data[i] - 127.5) / 127.5;
                const Q = (data[i + 1] - 127.5) / 127.5;
                energy += I * I + Q * Q;
                let v = 0;

                switch (mode) {
                  case DemodMode.NFM: {
                    // FM discriminator para NFM (Narrow FM)
                    const angle = Math.atan2(Q, I);
                    let diff = angle - prevAngle;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    prevAngle = angle;
                    // NFM precisa de ganho maior e limitação de deviação
                    v = Math.max(-0.9, Math.min(0.9, diff * 5.0));
                    break;
                  }
                  case DemodMode.WFM: {
                    // Wide FM discriminator para broadcast FM
                    const angle = Math.atan2(Q, I);
                    let diff = angle - prevAngle;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    prevAngle = angle;
                    // WFM tem maior deviação, ganho ajustado
                    v = diff * 1.8;
                    break;
                  }
                  case DemodMode.AM: {
                    // AM envelope detector com AGC
                    const mag = Math.sqrt(I * I + Q * Q);
                    // Aplicar compressão logarítmica para AGC natural
                    const compressed = Math.log(mag * 10 + 1) / Math.log(11);
                    v = (compressed - 0.5) * 3.0;
                    break;
                  }
                  case DemodMode.USB: {
                    // Upper sideband com Hilbert transform aproximado
                    // USB = I * cos + Q * sin (simplificado)
                    v = (I + Q * 0.7) * 2.5;
                    break;
                  }
                  case DemodMode.LSB: {
                    // Lower sideband com Hilbert transform aproximado  
                    // LSB = I * cos - Q * sin (simplificado)
                    v = (I - Q * 0.7) * 2.5;
                    break;
                  }
                  case DemodMode.CW: {
                    // CW com BFO de 700Hz e envelope detector
                    const mag = Math.sqrt(I * I + Q * Q);
                    const t = outIdx / ctx.sampleRate;
                    // Aplicar AGC logarítmico
                    const agcMag = Math.log(mag * 20 + 1) / Math.log(21);
                    v = agcMag * Math.sin(2 * Math.PI * 700 * t) * 2.5;
                    break;
                  }
                  default:
                    v = I;
                }
                audioOut[outIdx++] = Math.max(-1, Math.min(1, v));
              }
            }

            lastAngleRef.current = prevAngle;

            // Verificar se temos amostras válidas
            if (outIdx <= 1) {
              isProcessingRef.current = false;
              return;
            }

            // Filtro de áudio adaptativo por modo
            if (mode === DemodMode.WFM) {
              // De-emphasis suave para WFM (75us)
              for (let i = 1; i < outIdx; i++) {
                audioOut[i] = audioOut[i] * 0.5 + audioOut[i - 1] * 0.5;
              }
            } else if (mode === DemodMode.NFM) {
              // De-emphasis para NFM
              for (let i = 1; i < outIdx; i++) {
                audioOut[i] = audioOut[i] * 0.4 + audioOut[i - 1] * 0.6;
              }
            } else if (mode === DemodMode.AM) {
              // Filtro passa-baixa suave para AM
              for (let i = 1; i < outIdx; i++) {
                audioOut[i] = audioOut[i] * 0.6 + audioOut[i - 1] * 0.4;
              }
            } else if (mode === DemodMode.CW) {
              // Filtro passa-banda estreito para CW
              for (let i = 2; i < outIdx; i++) {
                audioOut[i] = audioOut[i] * 0.7 + audioOut[i - 1] * 0.2 + audioOut[i - 2] * 0.1;
              }
            } else {
              // SSB: filtro leve
              for (let i = 1; i < outIdx; i++) {
                audioOut[i] = audioOut[i] * 0.6 + audioOut[i - 1] * 0.4;
              }
            }

            // Calculate signal strength com correção de ganho
            const avgEnergy = energy / (outIdx + 1);
            const db = 10 * Math.log10(Math.max(avgEnergy, 1e-10)) + 60 + (rfGain * 0.3);
            if (Math.random() > 0.8) setSignalStrength(Math.max(-120, Math.min(-20, db)));

            // Squelch control - ajustado para ser mais efetivo
            if (squelch.enabled) {
              // Threshold mais sensível: -120 dB (mínimo) a -40 dB (máximo)
              const threshold = -120 + (squelch.level * 0.8);
              const closed = db < threshold;
              setIsSquelchClosed(closed);
              const target = closed ? 0.0001 : 1.0;
              
              // Aplicar squelch imediatamente
              if (Math.abs(gNode.gain.value - target) > 0.01) {
                gNode.gain.setValueAtTime(gNode.gain.value, ctx.currentTime);
                gNode.gain.exponentialRampToValueAtTime(target, ctx.currentTime + 0.01);
              }
            } else {
              if (gNode.gain.value < 0.95) {
                gNode.gain.setValueAtTime(gNode.gain.value, ctx.currentTime);
                gNode.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 0.02);
              }
            }

            // Só reproduzir áudio se tiver amostras válidas
            if (outIdx > 0) {
              playAudioBuffer(ctx, outIdx < samples ? audioOut.subarray(0, outIdx) : audioOut);
            }
        } catch (e) {
          console.warn('[Demod] Erro:', e);
        } finally {
          isProcessingRef.current = false;
        }
      };
    };
    tryPort();
  };

  // --- Sample Mode Change ---
  useEffect(() => {
    if (sampleMode === prevSampleModeRef.current) return;
    if (!powerOn) return;
    
    prevSampleModeRef.current = sampleMode;
    console.log('[Mode] Mudando para:', sampleMode);
    
    // Limpar áudio ao mudar modo
    audioBufferQueueRef.current = [];
    isPlayingRef.current = false;
    lastAngleRef.current = 0;
    isProcessingRef.current = false;
    
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    setIsConnected(false);
    
    const timer = setTimeout(() => {
      console.log('[Mode] Reconectando...');
      if (powerOn && !wsRef.current) {
        connectWebSocket();
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [sampleMode, powerOn]);

  // --- Power On/Off ---
  useEffect(() => {
    if (powerOn) {
      // Limpar fila de áudio antes de religar
      audioBufferQueueRef.current = [];
      isPlayingRef.current = false;
      lastAngleRef.current = 0;
      lastSampleRef.current = 0;
      
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        // 48kHz para qualidade de áudio adequada
        audioCtxRef.current = new AC({ sampleRate: 48000 });
        const ctx = audioCtxRef.current;
        
        // Garantir que o contexto está ativo
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            console.log('[Audio] Contexto retomado');
          });
        }
        
        const squelchGain = ctx.createGain();
        squelchGain.gain.value = 1;
        squelchGainRef.current = squelchGain;
        const master = ctx.createGain();
        master.gain.value = volume / 100;
        masterGainRef.current = master;
        squelchGain.connect(master);
        master.connect(ctx.destination);
      } else {
        // Recriar nodes se contexto existir mas está suspended
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            console.log('[Audio] Contexto retomado');
          });
        }
        
        // Sempre recriar gain nodes ao religar para garantir estado limpo
        try {
          if (squelchGainRef.current) {
            squelchGainRef.current.disconnect();
          }
          if (masterGainRef.current) {
            masterGainRef.current.disconnect();
          }
        } catch {}
        
        const squelchGain = ctx.createGain();
        squelchGain.gain.value = 1;
        squelchGainRef.current = squelchGain;
        const master = ctx.createGain();
        master.gain.value = volume / 100;
        masterGainRef.current = master;
        squelchGain.connect(master);
        master.connect(ctx.destination);
      }
      if (!wsRef.current) {
        connectWebSocket();
      }
    } else {
      if (wsRef.current) { 
        try { wsRef.current.close(); } catch {} 
        wsRef.current = null; 
      }
      if (audioCtxRef.current) { 
        try { audioCtxRef.current.close(); } catch {} 
        audioCtxRef.current = null;
      }
      masterGainRef.current = null;
      squelchGainRef.current = null;
      setIsConnected(false);
      setSignalStrength(0);
      setIsSquelchClosed(false);
      audioBufferQueueRef.current = [];
      isPlayingRef.current = false;
      setLatestIQData(undefined);
    }
  }, [powerOn]);

  useEffect(() => {
    if (masterGainRef.current) masterGainRef.current.gain.value = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (!powerOn || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const t = setTimeout(() => {
      wsRef.current?.send(JSON.stringify({ type: 'SET_FREQ', freq: frequency }));
      console.log('[Freq] Enviado', (frequency / 1e6).toFixed(6), 'MHz');
    }, 120);
    return () => clearTimeout(t);
  }, [frequency, powerOn]);

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ 
      type: 'SET_GAIN', 
      gain: agcEnabled ? 0 : rfGain,
      agc: agcEnabled
    }));
    console.log('[AGC]', agcEnabled ? 'Ligado' : 'Desligado');
  }, [rfGain, agcEnabled]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#051005] text-green-400 select-none" onClick={closeContextMenu} onContextMenu={handleContextMenu}>
      
      {/* --- Top Bar --- */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-green-800 bg-[#022c22]">
        <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold font-digital tracking-wider text-green-300 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]">
                SpeedSDR Pro <span className="text-xs text-green-600">v1.0 PU1XTB</span>
            </h1>
        </div>

        {/* Frequency Display */}
        <div className="flex items-baseline space-x-1 bg-black px-6 py-2 rounded border border-green-700 shadow-inner">
            <span className="text-4xl font-digital text-green-400 font-bold">{formatFreq(frequency).main}</span>
            <span className="text-2xl font-digital text-green-600">.{formatFreq(frequency).sub}</span>
            <span className="text-sm font-digital text-green-800 ml-2">MHz</span>
        </div>

        {/* Controls Top Right */}
        <div className="flex items-center space-x-3">
           <button onClick={() => setShowLicense(true)} className="text-xs hover:text-white underline">Licença</button>
           <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse mr-2" style={{ opacity: powerOn ? 1 : 0.2 }}></div>
           
           {/* Window Controls */}
           <div className="flex space-x-1 ml-4 border-l border-green-800 pl-4">
              <button className="p-1 hover:bg-green-800 rounded text-green-400">
                <Minimize2 size={16} />
              </button>
              <button className="p-1 hover:bg-red-900 rounded text-red-400">
                <X size={16} />
              </button>
           </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* --- Left Sidebar (Controls) --- */}
        <aside className="w-72 bg-[#021810] border-r border-green-800 flex flex-col overflow-y-auto p-2 space-y-3 custom-scrollbar">
            
            {/* Power Button */}
            <button 
                onClick={() => setPowerOn(!powerOn)}
                className={`w-full py-3 rounded font-bold text-lg flex items-center justify-center space-x-2 transition-all ${
                    powerOn 
                    ? 'bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-900' 
                    : 'bg-green-800 text-green-100 hover:bg-green-700'
                }`}
            >
                <Power size={20} />
                <span>{powerOn ? 'DESLIGAR' : 'LIGAR RÁDIO'}</span>
            </button>

            {/* Config Menu */}
            <div className="border border-green-800 rounded bg-green-950/30">
                <button 
                    onClick={() => setShowConfig(!showConfig)}
                    className="w-full px-3 py-2 flex items-center justify-between text-sm font-bold bg-green-900/40 hover:bg-green-900/60"
                >
                    <span className="flex items-center"><Settings size={14} className="mr-2"/> CONFIGURAR</span>
                    <span>{showConfig ? '-' : '+'}</span>
                </button>
                
                {showConfig && (
                    <div className="p-2 space-y-2 text-xs">
                        {/* Source Select */}
                        <div className="grid grid-cols-2 gap-1 mb-2">
                             <button className="bg-green-700 text-white p-1 rounded">RTL-SDR</button>
                             <button onClick={() => setShowTcpWindow(true)} className="bg-green-900/50 text-green-400 p-1 rounded hover:bg-green-800">TCP-IP</button>
                        </div>
                        
                        {/* Sample Rate */}
                        <label className="block text-green-600 mb-1">Sample Rate (MSPS)</label>
                        <select 
                            value={sampleRate} 
                            onChange={(e) => setSampleRate(parseFloat(e.target.value))}
                            className="w-full bg-black border border-green-700 rounded p-1"
                        >
                            {SAMPLE_RATES.map((r) => <option key={r} value={r}>{r} MSPS</option>)}
                        </select>

                        {/* Sample Mode */}
                        <label className="block text-green-600 mt-2 mb-1">Mode</label>
                        <select value={sampleMode} onChange={(e) => setSampleMode(e.target.value as SampleMode)} className="w-full bg-black border border-green-700 rounded p-1">
                             <option value={SampleMode.QUADRATURE}>{SampleMode.QUADRATURE}</option>
                             <option value={SampleMode.DIRECT_Q}>{SampleMode.DIRECT_Q}</option>
                        </select>

                        {/* RF Gain */}
                        <label className="block text-green-600 mt-2 mb-1">RF Gain: {rfGain} dB</label>
                        <input 
                            type="range" min="0" max="49.6" step="0.1" 
                            value={rfGain} onChange={(e) => setRfGain(parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex items-center mt-2 space-x-2">
                            <input type="checkbox" id="agc" checked={agcEnabled} onChange={(e) => setAgcEnabled(e.target.checked)} className="accent-green-500" />
                            <label htmlFor="agc">Tuner AGC</label>
                        </div>
                    </div>
                )}
            </div>

            {/* Demodulation Modes */}
            <div className="grid grid-cols-3 gap-1">
                {Object.values(DemodMode).map((m) => (
                    <button 
                        key={m}
                        onClick={() => handleModeChange(m)}
                        className={`py-2 text-sm font-bold border border-green-800 rounded ${
                            mode === m ? 'bg-green-600 text-black shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'hover:bg-green-900/50'
                        }`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            {/* Common Controls */}
            <div className="space-y-4 p-2 border border-green-800 rounded bg-green-950/20">
                {/* Bandwidth */}
                <div>
                    <label className="flex justify-between text-xs mb-1">
                        <span>BW (Bandwidth)</span>
                        <span>{bandwidth} Hz</span>
                    </label>
                    <input 
                        type="range" min="5" max="150000" 
                        value={bandwidth} onChange={(e) => setBandwidth(parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>

                {/* Squelch */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className={`text-xs font-bold transition-all ${squelch.enabled ? 'text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]' : 'text-green-700'}`}>
                            Squelch {squelch.enabled && `(${squelch.level}%)`}
                        </label>
                        <input 
                            type="checkbox" 
                            checked={squelch.enabled} 
                            onChange={(e) => setSquelch({...squelch, enabled: e.target.checked})}
                            className="accent-green-500" 
                        />
                    </div>
                    <input 
                        type="range" min="0" max="100" 
                        value={squelch.level} onChange={(e) => setSquelch({...squelch, level: parseInt(e.target.value)})}
                        disabled={!squelch.enabled}
                        className={`w-full ${!squelch.enabled ? 'opacity-50' : ''}`}
                    />
                </div>

                {/* Step */}
                 <div>
                    <label className="block text-xs mb-1">Step Size</label>
                    <select 
                        value={step} 
                        onChange={(e) => setStep(parseFloat(e.target.value))}
                        className="w-full bg-black border border-green-700 rounded p-1 text-sm"
                    >
                        {STEP_SIZES.map((s) => <option key={s} value={s}>{s} kHz</option>)}
                    </select>
                </div>

                {/* Audio Output */}
                <div>
                    <label className="block text-xs mb-1 text-green-500">Audio: {audioOutput}</label>
                    <label className="block text-xs mb-1">Volume: {volume}%</label>
                    <input 
                        type="range" min="0" max="100" 
                        value={volume} onChange={(e) => setVolume(parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>

            {/* Special Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => setShowScanner(!showScanner)}
                    className={`flex items-center justify-center py-2 border rounded text-xs font-bold transition-all ${
                        showScanner 
                        ? 'bg-green-600 text-black border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.6)]' 
                        : 'border-green-600 hover:bg-green-900'
                    }`}
                >
                    <Radio size={14} className="mr-1"/> SCANNER
                </button>
                <button 
                    onClick={() => setShowPlugins(true)}
                    className={`flex items-center justify-center py-2 border rounded text-xs font-bold transition-all ${
                        showPlugins 
                        ? 'bg-green-600 text-black border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.6)]' 
                        : 'border-green-600 hover:bg-green-900'
                    }`}
                >
                    <Grid size={14} className="mr-1"/> PLUGINS
                </button>
            </div>

             {/* NR Filter */}
             <button 
                onClick={() => setNrActive(!nrActive)}
                className={`w-full py-1 border rounded text-xs font-bold transition-all ${
                    nrActive 
                    ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.6)]' 
                    : 'border-yellow-700 text-yellow-500 hover:bg-yellow-900/30'
                }`}
             >
                NR FILTER (Noise Reduction)
            </button>

            {/* Audio Output Button */}
            <button 
                onClick={() => setShowAudioOutput(!showAudioOutput)}
                className={`w-full py-1 border rounded text-xs font-bold transition-all flex items-center justify-center ${
                    showAudioOutput
                    ? 'bg-cyan-600 text-black border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                    : 'border-cyan-600 text-cyan-400 hover:bg-cyan-900/30'
                }`}
            >
                <Volume2 size={12} className="mr-1"/> ÁUDIO OUT
            </button>
            
            <div className="text-center text-[10px] text-green-700 mt-auto pt-4">
                Status: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'} | S: {signalStrength.toFixed(0)} dB
            </div>

        </aside>

        {/* --- Center Display (Waterfall/Spectrum) --- */}
        <main 
          className="flex-1 flex bg-black relative overflow-hidden" 
          ref={containerRef}
          onMouseDown={handleWaterfallMouseDown}
          onMouseMove={handleWaterfallMouseMove}
          onMouseUp={handleWaterfallMouseUp}
          onMouseLeave={handleWaterfallMouseUp}
        >
             {/* S-Meter Floating Overlay */}
             <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <SMeter signalStrength={signalStrength} powerOn={powerOn} />
             </div>

             {/* Frequency Editor */}
             {showFreqEditor && (
               <div className="absolute top-2 right-2 z-20 bg-[#051005] border-2 border-green-500 p-2 rounded shadow-lg">
                 <div className="flex gap-2 items-center">
                   <input
                     type="number"
                     value={freqInput}
                     onChange={(e) => setFreqInput(e.target.value)}
                     onKeyDown={handleFreqInputKeyDown}
                     placeholder="MHz"
                     autoFocus
                     className="w-24 bg-black border border-green-700 p-1 text-sm text-green-400 rounded"
                   />
                   <button onClick={handleFreqEdit} className="px-2 py-1 bg-green-600 text-black text-xs font-bold rounded hover:bg-green-500">
                     OK
                   </button>
                   <button onClick={() => { setShowFreqEditor(false); setFreqInput(''); }} className="px-2 py-1 bg-red-700 text-white text-xs font-bold rounded hover:bg-red-600">
                     ✕
                   </button>
                 </div>
               </div>
             )}
             {!showFreqEditor && (
               <button
                 onClick={() => setShowFreqEditor(true)}
                 className="absolute top-2 right-2 z-20 p-1 bg-green-700 hover:bg-green-600 rounded"
                 title="Editar frequência"
               >
                 <Edit2 size={14} />
               </button>
             )}

             <div ref={waterfallRef} className="flex-1">
               <Waterfall 
                  powerOn={powerOn} 
                  frequency={frequency}
                  contrast={wfContrast}
                  offset={wfOffset}
                  range={wfRange}
                  onFreqChange={setFrequency}
                  width={waterfallDimensions.width}
                  height={waterfallDimensions.height}
                  scroll={wfScroll}
                  realData={latestIQData}
                  waterfallHeight={wfHeight}
               />
             </div>

             {/* Right Sliders (Waterfall Control) */}
             <div className="w-10 bg-[#021810] border-l border-green-800 flex flex-col items-center py-4 space-y-4 z-20">
                <div className="h-1/4 flex flex-col items-center">
                    <span className="text-[9px] mb-2 rotate-90 whitespace-nowrap">ALTURA</span>
                    <input 
                        type="range" min="40" max="90" 
                        value={wfHeight} onChange={(e) => setWfHeight(parseInt(e.target.value))}
                        className="h-full appearance-none bg-cyan-900 rounded-full w-2"
                        style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                        title="Ajustar altura da cachoeira"
                    />
                </div>
                <div className="h-1/4 flex flex-col items-center">
                    <span className="text-[9px] mb-2 rotate-90 whitespace-nowrap">OFFSET</span>
                    <input 
                        type="range" min="0" max="100" 
                        value={wfOffset} onChange={(e) => setWfOffset(parseInt(e.target.value))}
                        className="h-full appearance-none bg-green-900 rounded-full w-2"
                        style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                </div>
                <div className="h-1/4 flex flex-col items-center">
                    <span className="text-[9px] mb-2 rotate-90 whitespace-nowrap">CONTRAST</span>
                    <input 
                         type="range" min="10" max="100" 
                         value={wfContrast} onChange={(e) => setWfContrast(parseInt(e.target.value))}
                         className="h-full appearance-none bg-green-900 rounded-full w-2"
                         style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                </div>
                <div className="h-1/4 flex flex-col items-center">
                    <span className="text-[9px] mb-2 rotate-90 whitespace-nowrap">RANGE</span>
                    <input 
                         type="range" min="0.1" max="2" step="0.1"
                         value={wfRange} onChange={(e) => setWfRange(parseFloat(e.target.value))}
                         className="h-full appearance-none bg-green-900 rounded-full w-2"
                         style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                </div>
             </div>
        </main>
      </div>

      {/* --- Modals / Floating Windows --- */}

      {/* Audio Output Modal */}
      {showAudioOutput && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
            <div className="bg-[#051005] border-2 border-cyan-500 w-80 shadow-[0_0_30px_rgba(34,211,238,0.2)] flex flex-col p-4 rounded">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-cyan-400 flex items-center"><Volume size={16} className="mr-2"/> SAÍDA DE ÁUDIO</h2>
                    <button onClick={() => setShowAudioOutput(false)}><X size={16}/></button>
                </div>
                <div className="space-y-2">
                    <button 
                        onClick={() => { setAudioOutput('speaker'); setShowAudioOutput(false); }}
                        className={`w-full py-2 border rounded text-sm font-bold transition-all ${
                            audioOutput === 'speaker' ? 'bg-cyan-600 text-black border-cyan-400' : 'border-cyan-600 hover:bg-cyan-900/30'
                        }`}
                    >
                        🔊 Auto-falante
                    </button>
                    <button 
                        onClick={() => { setAudioOutput('headphone'); setShowAudioOutput(false); }}
                        className={`w-full py-2 border rounded text-sm font-bold transition-all ${
                            audioOutput === 'headphone' ? 'bg-cyan-600 text-black border-cyan-400' : 'border-cyan-600 hover:bg-cyan-900/30'
                        }`}
                    >
                        🎧 Headfone
                    </button>
                    <button 
                        onClick={() => { setAudioOutput('vac'); setShowAudioOutput(false); }}
                        className={`w-full py-2 border rounded text-sm font-bold transition-all ${
                            audioOutput === 'vac' ? 'bg-cyan-600 text-black border-cyan-400' : 'border-cyan-600 hover:bg-cyan-900/30'
                        }`}
                    >
                        🔌 VAC (Virtual Audio Cable)
                    </button>
                    <button 
                        onClick={() => { setAudioOutput('mix'); setShowAudioOutput(false); }}
                        className={`w-full py-2 border rounded text-sm font-bold transition-all ${
                            audioOutput === 'mix' ? 'bg-cyan-600 text-black border-cyan-400' : 'border-cyan-600 hover:bg-cyan-900/30'
                        }`}
                    >
                        🎛️ Mixagem (PC)
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Plugins Modal */}
      {showPlugins && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
            <div className="bg-[#051005] border-2 border-green-500 w-[600px] h-[400px] shadow-[0_0_30px_rgba(34,197,94,0.2)] flex flex-col">
                <div className="flex justify-between items-center p-2 border-b border-green-800 bg-green-900/20">
                    <h2 className="font-bold flex items-center"><Grid size={16} className="mr-2"/> GERENCIADOR DE PLUGINS</h2>
                    <button onClick={() => setShowPlugins(false)}><X size={16}/></button>
                </div>
                <div className="flex-1 flex overflow-hidden">
                    {/* List */}
                    <div className="w-1/2 border-r border-green-800 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {PLUGINS.map((p) => (
                            <div 
                                key={p.name}
                                onClick={() => setActivePlugin(p.name)}
                                className={`p-2 cursor-pointer text-xs border border-transparent hover:border-green-600 ${activePlugin === p.name ? 'bg-green-800/40 text-white' : ''}`}
                            >
                                <div className="font-bold">{p.name}</div>
                                <div className="text-[10px] text-green-600">{p.bandwidth}</div>
                            </div>
                        ))}
                    </div>
                    {/* Details / Action */}
                    <div className="w-1/2 p-4 flex flex-col">
                        {activePlugin ? (
                            <>
                                <h3 className="font-bold text-lg mb-2">{activePlugin}</h3>
                                <p className="text-sm text-green-300 mb-4">{PLUGINS.find((p) => p.name === activePlugin)?.description}</p>
                                <div className="mt-auto">
                                    <button 
                                        className="w-full bg-green-600 text-black font-bold py-2 hover:bg-green-500 shadow-lg"
                                        onClick={() => {
                                            setShowPlugins(false);
                                            setRunningPlugin(activePlugin);
                                        }}
                                    >
                                        ABRIR DECODIFICADOR
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-green-800">Selecione um plugin</div>
                        )}
                    </div>
                </div>
                <div className="p-2 border-t border-green-800 text-[10px] text-center">
                    Para adicionar novos plugins, consulte o arquivo 'plugin.txt' na pasta do programa.
                </div>
            </div>
        </div>
      )}

      {/* Active Plugin Window */}
      {runningPlugin && (
          <DecoderWindow name={runningPlugin} onClose={() => setRunningPlugin(null)} />
      )}

      {/* TCP Config Modal */}
      {showTcpWindow && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
            <div className="bg-[#051005] border border-green-500 p-6 rounded shadow-lg w-80">
                <h3 className="font-bold mb-4">Configuração TCP RTL-SDR</h3>
                <label className="block text-xs mb-1">IP Address</label>
                <input type="text" defaultValue="127.0.0.1" className="w-full bg-black border border-green-700 p-1 mb-3"/>
                <label className="block text-xs mb-1">Port</label>
                <input type="text" defaultValue="1234" className="w-full bg-black border border-green-700 p-1 mb-4"/>
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setShowTcpWindow(false)} className="px-3 py-1 border border-red-500 text-red-500 rounded text-xs">Cancelar</button>
                    <button onClick={() => setShowTcpWindow(false)} className="px-3 py-1 bg-green-600 text-black font-bold rounded text-xs">Conectar</button>
                </div>
            </div>
        </div>
      )}

      {/* Scanner Floating Window */}
      {showScanner && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 bg-green-950 border-2 border-green-400 p-2 shadow-2xl z-40">
             <div className="flex justify-between items-center mb-2 border-b border-green-800 pb-1">
                <span className="font-bold text-xs">SCANNER DE FREQUÊNCIA</span>
                <button onClick={() => setShowScanner(false)}><X size={12}/></button>
             </div>
             <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span>Range:</span>
                    <span className="font-mono">144 - 148 MHz</span>
                </div>
                <div className="h-20 bg-black border border-green-800 p-1 font-mono text-center flex flex-col justify-center">
                    {scannerActive ? (
                        <>
                            <span className="animate-pulse text-green-200">ESCANNEANDO...</span>
                            <span className="text-lg">{(144 + Math.random() * 4).toFixed(3)} MHz</span>
                        </>
                    ) : (
                        <span className="text-gray-500">PARADO</span>
                    )}
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setScannerActive(true)}
                        className={`flex-1 py-1 ${scannerActive ? 'bg-green-500 text-black' : 'bg-green-900 border border-green-600'}`}
                    >
                        INICIAR
                    </button>
                    <button 
                        onClick={() => setScannerActive(false)}
                        className="flex-1 py-1 bg-red-900/40 border border-red-600 text-red-400"
                    >
                        PARAR
                    </button>
                </div>
             </div>
        </div>
      )}

       {/* License Window */}
       {showLicense && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
             <div className="bg-black border border-green-500 p-6 max-w-lg relative">
                 <button onClick={() => setShowLicense(false)} className="absolute top-2 right-2"><X size={16}/></button>
                 <pre className="font-mono text-xs whitespace-pre-wrap">{LICENSE_TEXT}</pre>
             </div>
        </div>
       )}

      {/* Context Menu (Right Click) */}
      {contextMenu && (
        <div 
            className="fixed bg-black border border-green-500 shadow-[0_0_15px_rgba(0,255,0,0.3)] z-50 text-xs py-1 w-40"
            style={{ top: contextMenu.y, left: contextMenu.x }}
        >
            <div className="px-2 py-1 bg-green-900/50 font-bold mb-1 border-b border-green-800">BANDAS</div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {BANDS.map((band) => (
                    <button 
                        key={band.name}
                        onClick={() => setBand(band)}
                        className="w-full text-left px-3 py-1 hover:bg-green-700 flex justify-between group"
                    >
                        <span>{band.name.split(' ')[0]}</span>
                        <span className="text-gray-500 group-hover:text-white text-[10px]">{band.name.split(' ')[1]}</span>
                    </button>
                ))}
            </div>
        </div>
      )}

      {/* Suppress TypeScript warnings */}
      {false && (
        <>
          {Activity}
          {List}
          {ExternalLink}
          {Sliders}
          {isSquelchClosed}
          {backendFreq}
        </>
      )}

    </div>
  );
}
