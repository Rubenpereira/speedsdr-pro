export enum DemodMode {
  NFM = 'NFM',
  WFM = 'WFM',
  AM = 'AM',
  LSB = 'LSB',
  USB = 'USB',
  CW = 'CW'
}

export enum SampleMode {
  QUADRATURE = 'Quadrature Sampling',
  DIRECT_Q = 'Direct Sample (Q branch)'
}

export interface BandPreset {
  name: string;
  frequency: number; // in Hz
  mode: DemodMode;
}

export interface PluginDefinition {
  name: string;
  description: string;
  integrated: boolean;
  bandwidth: string;
}

export interface SquelchState {
  enabled: boolean;
  level: number;
}
