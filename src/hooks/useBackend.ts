import { useEffect, useState } from "react";
import { checkBackendStatus, startCapture, stopCapture } from "../api";

export function useBackend() {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const status = await checkBackendStatus();
      if (status) {
        setIsBackendReady(true);
        setBackendError(null);
        console.log("Backend connected:", status);
      } else {
        setIsBackendReady(false);
        setBackendError("Backend não disponível em http://127.0.0.1:8080");
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  return { isBackendReady, backendError, startCapture, stopCapture };
}
