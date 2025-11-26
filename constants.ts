import { BandPreset, DemodMode, PluginDefinition } from './types';

export const SAMPLE_RATES = [
  1.024, 1.4, 1.8, 1.92, 2.048, 2.4
];

export const STEP_SIZES = [
  0.5, 1, 2.5, 5, 10, 15, 20, 25, 50, 100, 200
];

export const BANDS: BandPreset[] = [
  { name: 'OM (940 kHz)', frequency: 940000, mode: DemodMode.AM },
  { name: '160m (1.745 MHz)', frequency: 1745000, mode: DemodMode.LSB },
  { name: '80m (3.710 MHz)', frequency: 3710000, mode: DemodMode.LSB },
  { name: '60m (5.360 MHz)', frequency: 5360000, mode: DemodMode.LSB },
  { name: '40m (7.100 MHz)', frequency: 7100000, mode: DemodMode.LSB },
  { name: '30m (10.100 MHz)', frequency: 10100000, mode: DemodMode.USB },
  { name: '20m (14.200 MHz)', frequency: 14200000, mode: DemodMode.USB },
  { name: '17m (18.100 MHz)', frequency: 18100000, mode: DemodMode.USB },
  { name: '15m (21.200 MHz)', frequency: 21200000, mode: DemodMode.USB },
  { name: '11m (27.455 MHz)', frequency: 27455000, mode: DemodMode.USB },
  { name: '10m (28.460 MHz)', frequency: 28460000, mode: DemodMode.USB },
  { name: '6m (50.150 MHz)', frequency: 50150000, mode: DemodMode.USB },
  { name: 'AIR (119.450 MHz)', frequency: 119450000, mode: DemodMode.AM },
  { name: 'VHF (145.350 MHz)', frequency: 145350000, mode: DemodMode.NFM },
  { name: 'UHF (439.400 MHz)', frequency: 439400000, mode: DemodMode.NFM },
  { name: 'ADSB (1.090 GHz)', frequency: 1090000000, mode: DemodMode.AM }, 
  { name: 'SAT (1.545 GHz)', frequency: 1545000000, mode: DemodMode.USB },
];

export const PLUGINS: PluginDefinition[] = [
  { name: 'SimpleDMR Decoder v1.0', description: 'Sample Rate 10k', integrated: true, bandwidth: '12.5k' },
  { name: 'TETRA Decoder Pro', description: 'Bandwidth Padrão 25k', integrated: true, bandwidth: '25k' },
  { name: 'P25 Decoder Phase 1/2', description: 'BW 10k', integrated: true, bandwidth: '10k' },
  { name: 'ACARS Decoder v1.2', description: 'BW 6k', integrated: true, bandwidth: '6k' },
  { name: 'FT8 Decoder Pro', description: 'Visualizador de mensagens, BW 3k USB', integrated: true, bandwidth: '3k' },
  { name: 'FT4 Decoder', description: 'Ciclo rápido 7.5s, BW 3k USB', integrated: true, bandwidth: '3k' },
  { name: 'RTTY Decoder', description: 'Teletipo 45 baud, BW 3k USB', integrated: true, bandwidth: '3k' },
  { name: 'PACTOR / NAVTEX Decoder', description: 'Marítimo/Texto, BW 3k USB', integrated: true, bandwidth: '3k' },
  { name: 'HFDL Global Monitor', description: 'Dados Aéreos em HF, BW 3k USB', integrated: true, bandwidth: '3k' },
  { name: 'ADSB Radar 1090', description: 'Rastreamento Aéreo, BW 2M', integrated: true, bandwidth: '2M' },
  { name: 'CW Decoder', description: 'Morse Code com Auto Speed, BW 500Hz', integrated: true, bandwidth: '500Hz' },
];

export const LICENSE_TEXT = `
LICENÇA DE SOFTWARE - SpeedSDR Pro
==================================

Autor: PU1XTB
Email: pu1xtb@gmail.com
Versão: 1.0

Este software é proprietário e não é de código aberto.
O uso é permitido apenas para fins pessoais e educacionais.
A redistribuição ou modificação sem autorização expressa do autor é proibida.

Desenvolvido com paixão pelo rádio amadorismo.
73!
`;
