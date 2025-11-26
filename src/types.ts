export enum DemodMode {
  NFM = 'NFM',
  WFM = 'WFM',
  AM = 'AM',
  LSB = 'LSB',
  USB = 'USB',
  CW = 'CW'
}

export enum SamplingMode {
  QUADRATURE = 'QUADRATURE',
  DIRECT_I = 'DIRECT_I',
  DIRECT_Q = 'DIRECT_Q'
}

export enum SampleMode {
  QUADRATURE = 'Quadrature',
  DIRECT_Q = 'Direct Q'
}

export enum SourceType {
  RTL_SDR = 'RTL_SDR',
  AIRSPY = 'AIRSPY',
  HACKRF = 'HACKRF',
  NETWORK = 'NETWORK'
}

export enum SampleRate {
  SR_1024K = 1024000,
  SR_2048K = 2048000,
  SR_2560K = 2560000
}

export interface BandPreset {
  name: string;
  frequency: number;
  mode: DemodMode;
}

export interface SdrSettings {
  sampleRate: number;
  samplingMode: SamplingMode;
  rfGain: number;
  mainGain: number;
  tunerAgc: boolean;
  freqCorrection: number;
  fftSize: number;
  sourceType: SourceType;
  serverIp: string;
  serverPort: number;
}

export interface WaterfallSettings {
  offset: number;
  contrast: number;
  range: number;
}

export interface SdrPlugin {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  version: string;
  description: string;
  bandwidth?: string;
  protocol?: string;
}

export interface FrequencyMemory {
  id: string;
  name: string;
  frequency: number;
  mode: DemodMode;
  bandwidth: number;
  squelch: number;
}

export interface ScannerConfig {
  enabled: boolean;
  startFreq: number;
  endFreq: number;
  step: number;
  dwellTime: number;
  squelchLevel: number;
  memories: FrequencyMemory[];
}

export interface SquelchState {
  enabled: boolean;
  level: number;
}
