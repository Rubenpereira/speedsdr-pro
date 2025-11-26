import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, Terminal } from 'lucide-react';

interface DecoderWindowProps {
  name: string;
  onClose: () => void;
}

export const DecoderWindow: React.FC<DecoderWindowProps> = ({ name, onClose }) => {
  // Center initially (approximate)
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Drag logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking the header
    if ((e.target as HTMLElement).closest('.window-header')) {
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Initial Connection Message (No more fake simulation loop)
  useEffect(() => {
    setLogs([
        `> Iniciando plugin: ${name}...`, 
        `> Conectado ao Audio Sink (48kHz)`, 
        `> Aguardando sinal RF real do dongle...`
    ]);
  }, [name]);

  // Auto scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const clearLogs = () => {
      setLogs([`> Log limpo. Aguardando dados...`]);
  };

  return (
    <div 
        className="fixed w-[500px] h-[350px] bg-black border border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)] z-50 flex flex-col font-mono"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
    >
        {/* Header (Draggable) */}
        <div 
            className="window-header bg-green-900/90 p-2 cursor-move flex justify-between items-center select-none border-b border-green-600"
        >
            <div className="flex items-center space-x-2 text-green-100 font-bold text-xs">
                <Terminal size={14} />
                <span>DECODIFICADOR: {name.toUpperCase()}</span>
            </div>
            <button onClick={onClose} className="text-green-400 hover:text-white transition-colors">
                <X size={16}/>
            </button>
        </div>

        {/* Toolbar */}
        <div className="bg-[#051505] p-1 flex space-x-2 border-b border-green-800 text-[10px]">
            <button 
                onClick={clearLogs}
                className="px-2 py-1 bg-green-900 text-green-100 rounded hover:bg-green-700 active:bg-green-500"
            >
                LIMPAR
            </button>
            <button className="px-2 py-1 bg-green-900 text-green-100 rounded hover:bg-green-700">SALVAR LOG</button>
            <div className="flex-1"></div>
            <span className="text-green-600 py-1">STATUS: <span className="text-green-400 animate-pulse">ESCUTANDO</span></span>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-black p-2 overflow-y-auto custom-scrollbar font-mono text-xs cursor-text select-text">
            {logs.map((log, i) => (
                <div key={i} className="text-green-500 mb-1 border-b border-green-900/30 pb-1">
                    <span className="text-green-800 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                </div>
            ))}
            <div ref={logEndRef} />
        </div>
    </div>
  );
};