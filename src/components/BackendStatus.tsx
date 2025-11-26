import React from "react";
import { Wifi, WifiOff, AlertCircle } from "lucide-react";

interface BackendStatusProps {
  isReady: boolean;
  error: string | null;
}

export function BackendStatus({ isReady, error }: BackendStatusProps) {
  if (isReady) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-900 border border-green-700 rounded">
        <Wifi size={16} className="text-green-400 animate-pulse" />
        <span className="text-sm text-green-400">Backend Conectado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-900 border border-red-700 rounded">
      <WifiOff size={16} className="text-red-400" />
      <span className="text-sm text-red-400">
        {error || "Backend Desconectado"}
      </span>
      {error && <AlertCircle size={14} className="text-red-300" />}
    </div>
  );
}
