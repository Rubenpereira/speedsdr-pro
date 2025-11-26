import React, { useState, useEffect, useRef } from 'react';
import { Power, Settings, Radio, Activity, Grid, List, X, ExternalLink, Sliders, Minimize2 } from 'lucide-react';
import { SMeter } from './components/SMeter';
import { Waterfall } from './components/Waterfall';
import { DecoderWindow } from './components/DecoderWindow';
import { DemodMode, BandPreset, SampleMode, SquelchState } from './types';
import { BANDS, PLUGINS, LICENSE_TEXT, SAMPLE_RATES, STEP_SIZES } from './constants';

export default function App() {
  // --- Global State ---
  const [powerOn, setPowerOn] = useState(false);
  const [frequency, setFrequency] = useState(145350000); // 145.350 MHz Default
  const [mode, setMode] = useState<DemodMode>(DemodMode.NFM);
  // Default BW for NFM is 10k
  const [bandwidth, setBandwidth] = useState(10000);
  // Default Sample Rate 1.024
  const [sampleRate, setSampleRate] = useState(1.024);
  // Default RF Gain 40 dB
  const [rfGain, setRfGain] = useState(40);
  // Default Squelch Off and Open (level 0)
  const [squelch, setSquelch] = useState<SquelchState>({ enabled: false, level: 0 });
  const [step, setStep] = useState(10); // kHz
  const [volume, setVolume] = useState(75);
  
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

  // --- Waterfall Controls ---
  const [wfOffset, setWfOffset] = useState(10);
  const [wfContrast, setWfContrast] = useState(50);
  const [wfRange, setWfRange] = useState(1.0);

  // --- Layout State ---
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Resize Observer ---
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
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

  // --- Format Frequency String ---
  const formatFreq = (freq: number) => {
    const mhz = (freq / 1000000).toFixed(6);
    // Split for styling
    const parts = mhz.split('.');
    return { main: parts[0], sub: parts[1] };
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // --- Mode Change Logic with Default Bandwidths ---
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
                            {SAMPLE_RATES.map(r => <option key={r} value={r}>{r} MSPS</option>)}
                        </select>

                        {/* Sample Mode */}
                        <label className="block text-green-600 mt-2 mb-1">Mode</label>
                        <select className="w-full bg-black border border-green-700 rounded p-1">
                             <option>{SampleMode.QUADRATURE}</option>
                             <option>{SampleMode.DIRECT_Q}</option>
                        </select>

                        {/* RF Gain */}
                        <label className="block text-green-600 mt-2 mb-1">RF Gain: {rfGain} dB</label>
                        <input 
                            type="range" min="0" max="49.6" step="0.1" 
                            value={rfGain} onChange={(e) => setRfGain(parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex items-center mt-2 space-x-2">
                            <input type="checkbox" id="agc" className="accent-green-500" />
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
                            Squelch
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
                        {STEP_SIZES.map(s => <option key={s} value={s}>{s} kHz</option>)}
                    </select>
                </div>

                {/* Audio Output */}
                <div>
                    <label className="block text-xs mb-1 text-green-500">Audio Input: RF (RTL-SDR)</label>
                    <label className="block text-xs mb-1">Volume</label>
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
            
            <div className="text-center text-[10px] text-green-700 mt-auto pt-4">
                Entrada MIC: Desativada (Direct RF)
            </div>

        </aside>

        {/* --- Center Display (Waterfall/Spectrum) --- */}
        <main className="flex-1 flex bg-black relative" ref={containerRef}>
             {/* S-Meter Floating Overlay */}
             <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <SMeter signalStrength={powerOn ? Math.random() * 100 : 0} powerOn={powerOn} />
             </div>

             <Waterfall 
                powerOn={powerOn} 
                frequency={frequency}
                contrast={wfContrast}
                offset={wfOffset}
                range={wfRange}
                onFreqChange={setFrequency}
                width={dimensions.width - 40} // subtract slider width
                height={dimensions.height}
             />

             {/* Right Sliders (Waterfall Control) */}
             <div className="w-10 bg-[#021810] border-l border-green-800 flex flex-col items-center py-4 space-y-6 z-20">
                <div className="h-1/3 flex flex-col items-center">
                    <span className="text-[9px] mb-2 rotate-90 whitespace-nowrap">OFFSET</span>
                    <input 
                        type="range" min="0" max="100" 
                        value={wfOffset} onChange={(e) => setWfOffset(parseInt(e.target.value))}
                        className="h-full appearance-none bg-green-900 rounded-full w-2"
                        style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                </div>
                <div className="h-1/3 flex flex-col items-center">
                    <span className="text-[9px] mb-2 rotate-90 whitespace-nowrap">CONTRAST</span>
                    <input 
                         type="range" min="10" max="100" 
                         value={wfContrast} onChange={(e) => setWfContrast(parseInt(e.target.value))}
                         className="h-full appearance-none bg-green-900 rounded-full w-2"
                         style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                </div>
                <div className="h-1/3 flex flex-col items-center">
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
                                <p className="text-sm text-green-300 mb-4">{PLUGINS.find(p => p.name === activePlugin)?.description}</p>
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
                {BANDS.map(band => (
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

    </div>
  );
}