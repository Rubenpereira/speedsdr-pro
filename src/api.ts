// API service para comunicar com o backend SpeedSDR Pro

const API_BASE_URL = "http://127.0.0.1:8080";

export interface ApiResponse {
  status: string;
  app: string;
  [key: string]: any;
}

export async function checkBackendStatus(): Promise<ApiResponse | null> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Backend error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log("Backend response:", data);
    return data;
  } catch (error) {
    console.error("Failed to connect to backend:", error);
    return null;
  }
}

export async function getDeviceList(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Failed to get device list:", error);
    return [];
  }
}

export async function startCapture(frequency: number, sampleRate: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/capture/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ frequency, sampleRate }),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to start capture:", error);
    return false;
  }
}

export async function stopCapture(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/capture/stop`, {
      method: "POST",
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to stop capture:", error);
    return false;
  }
}
