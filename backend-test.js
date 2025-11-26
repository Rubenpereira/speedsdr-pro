const WebSocket = require('ws');

const PORT = 8080;

try {
  const wss = new WebSocket.Server({ port: PORT });
  console.log(`[Backend Test] WebSocket ativo na porta ${PORT}`);
  console.log('[Backend Test] Aguardando conexão do frontend...');

  wss.on('connection', (ws) => {
    console.log('[Backend Test] ✓ Cliente conectado');

    let stopped = false;
    let phase = 0; // Fase do oscilador

    const sendFakeIQ = () => {
      if (stopped || ws.readyState !== WebSocket.OPEN) return;
      
      const fakeData = new Uint8Array(1024); // Aumentado para 1024 (512 amostras IQ)
      
      // Gera sinal de teste: tom puro 1 kHz + ruído leve
      for (let i = 0; i < fakeData.length; i += 2) {
        // Oscilador 1 kHz (simulando portadora FM)
        phase += 0.01;
        if (phase > Math.PI * 2) phase -= Math.PI * 2;
        
        const signal = Math.sin(phase) * 0.7; // Tom puro
        const noise = (Math.random() - 0.5) * 0.1; // Ruído leve
        
        const I = (signal + noise) * 127 + 127.5;
        const Q = (Math.cos(phase) * 0.7 + noise) * 127 + 127.5;
        
        fakeData[i] = Math.max(0, Math.min(255, Math.floor(I)));
        fakeData[i + 1] = Math.max(0, Math.min(255, Math.floor(Q)));
      }
      
      ws.send(fakeData);
      setTimeout(sendFakeIQ, 40); // 25 fps (mais suave)
    };
    sendFakeIQ();

    ws.on('message', (msg) => {
      try {
        const cmd = JSON.parse(msg.toString());
        if (cmd.type === 'SET_FREQ') {
          console.log(`[Backend Test] Frequência: ${cmd.freq} Hz`);
        } else if (cmd.type === 'SET_GAIN') {
          console.log(`[Backend Test] Ganho: ${cmd.gain} dB`);
        } else if (cmd.type === 'SET_RATE') {
          console.log(`[Backend Test] Sample rate: ${cmd.rate} Hz`);
        }
      } catch {
        // Ignora binário
      }
    });

    ws.on('close', () => {
      console.log('[Backend Test] Cliente desconectado');
      stopped = true;
    });

    ws.on('error', (err) => {
      console.error('[Backend Test] Erro:', err.message);
      stopped = true;
    });
  });

  wss.on('error', (err) => {
    console.error('[Backend Test] Erro servidor:', err.message);
  });

} catch (e) {
  console.error('[Backend Test] Falha:', e.message);
}