const WebSocket = require('ws');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const PORT = 8080;
const RTL_TCP_PORT = 1234;
let rtlTcpProcess = null;
let rtlTcpClient = null;
let currentFreq = 145350000;
let currentGain = 40;
let sampleMode = 'quadrature';
let sampleRate = 1024000; // 1.024 MHz padrão

const wss = new WebSocket.Server({ port: PORT });

console.log(`[Backend] Servidor WebSocket iniciado na porta ${PORT}`);

// Tentar iniciar rtl_tcp
function startRTLTCP() {
  const rtlTcpPath = path.join(__dirname, 'rtl_tcp.exe');
  
  try {
    console.log('[RTL-SDR] Iniciando rtl_tcp...');
    rtlTcpProcess = spawn(rtlTcpPath, [
      '-a', '127.0.0.1',
      '-p', RTL_TCP_PORT.toString(),
      '-f', currentFreq.toString(),
      '-s', sampleRate.toString(),
      '-g', (currentGain * 10).toString() // rtl_tcp usa ganho em décimos de dB
    ]);

    rtlTcpProcess.stdout.on('data', (data) => {
      console.log(`[rtl_tcp] ${data.toString().trim()}`);
    });

    rtlTcpProcess.stderr.on('data', (data) => {
      console.log(`[rtl_tcp] ${data.toString().trim()}`);
    });

    rtlTcpProcess.on('error', (err) => {
      console.error('[RTL-SDR] Erro ao iniciar rtl_tcp:', err.message);
      rtlTcpProcess = null;
    });

    rtlTcpProcess.on('exit', (code) => {
      console.log(`[rtl_tcp] Processo encerrado com código ${code}`);
      rtlTcpProcess = null;
      if (rtlTcpClient) {
        rtlTcpClient.destroy();
        rtlTcpClient = null;
      }
    });

    return true;
  } catch (err) {
    console.error('[RTL-SDR] Falha ao iniciar rtl_tcp:', err.message);
    return false;
  }
}

// Enviar comando para rtl_tcp
function sendRTLCommand(cmd, value) {
  if (!rtlTcpClient) return;
  
  const buffer = Buffer.alloc(5);
  buffer.writeUInt8(cmd, 0);
  buffer.writeUInt32BE(value, 1);
  
  try {
    rtlTcpClient.write(buffer);
  } catch (err) {
    console.error('[RTL-SDR] Erro ao enviar comando:', err.message);
  }
}

// Comandos rtl_tcp
const RTL_TCP_CMD = {
  SET_FREQ: 0x01,
  SET_SAMPLE_RATE: 0x02,
  SET_GAIN_MODE: 0x03,
  SET_GAIN: 0x04,
  SET_FREQ_CORRECTION: 0x05,
  SET_AGC_MODE: 0x08,
  SET_DIRECT_SAMPLING: 0x09,
  SET_OFFSET_TUNING: 0x0a,
  SET_RTL_XTAL: 0x0b,
  SET_TUNER_XTAL: 0x0c
};

const hasDevice = startRTLTCP(); 

// WebSocket connections
wss.on('connection', (ws) => {
  console.log('[WS] Cliente conectado');

  // Enviar status inicial
  ws.send(JSON.stringify({
    type: 'STATUS',
    freq: currentFreq,
    gain: currentGain,
    mode: sampleMode
  }));

  // Conectar ao rtl_tcp se disponível
  if (hasDevice && !rtlTcpClient) {
    setTimeout(() => {
      console.log('[RTL-SDR] Conectando ao rtl_tcp...');
      rtlTcpClient = new net.Socket();
      
      rtlTcpClient.connect(RTL_TCP_PORT, '127.0.0.1', () => {
        console.log('[RTL-SDR] Conectado ao rtl_tcp');
        
        // Configurar parâmetros iniciais
        sendRTLCommand(RTL_TCP_CMD.SET_FREQ, currentFreq);
        sendRTLCommand(RTL_TCP_CMD.SET_SAMPLE_RATE, sampleRate);
        sendRTLCommand(RTL_TCP_CMD.SET_GAIN_MODE, 1); // Manual gain
        sendRTLCommand(RTL_TCP_CMD.SET_GAIN, currentGain * 10);
        
        // Configurar modo de amostragem
        if (sampleMode === 'direct_q') {
          sendRTLCommand(RTL_TCP_CMD.SET_DIRECT_SAMPLING, 2); // Q branch
        } else {
          sendRTLCommand(RTL_TCP_CMD.SET_DIRECT_SAMPLING, 0); // Normal IQ
        }
      });

      rtlTcpClient.on('data', (data) => {
        // Repassar dados IQ para o WebSocket
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data, { binary: true });
        }
      });

      rtlTcpClient.on('error', (err) => {
        console.error('[RTL-SDR] Erro na conexão rtl_tcp:', err.message);
        rtlTcpClient = null;
        // Fallback para modo simulação
        console.log('[Backend] Usando modo SIMULAÇÃO (RTL-SDR não disponível)');
        startSimulationMode(ws);
      });

      rtlTcpClient.on('close', () => {
        console.log('[RTL-SDR] Conexão rtl_tcp fechada');
        rtlTcpClient = null;
      });
    }, 1000); // Aguardar rtl_tcp inicializar
  } else if (!hasDevice) {
    console.log('[Backend] RTL-SDR não encontrado, usando modo SIMULAÇÃO');
    startSimulationMode(ws);
  }

  // Função para iniciar modo simulação
  function startSimulationMode(ws) {
    const streamInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const demoBuffer = Buffer.alloc(16384);
        for (let i = 0; i < demoBuffer.length; i++) {
          demoBuffer[i] = Math.floor(Math.random() * 256);
        }
        ws.send(demoBuffer, { binary: true });
      }
    }, 50);

    ws.on('close', () => {
      clearInterval(streamInterval);
    });
  }

  // Receber comandos
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'SET_FREQ':
          currentFreq = msg.freq;
          console.log(`[RTL-SDR] Frequência: ${(currentFreq / 1e6).toFixed(6)} MHz`);
          if (rtlTcpClient) {
            sendRTLCommand(RTL_TCP_CMD.SET_FREQ, currentFreq);
          }
          ws.send(JSON.stringify({ type: 'STATUS', freq: currentFreq }));
          break;

        case 'SET_GAIN':
          currentGain = msg.gain;
          const agc = msg.agc || false;
          console.log(`[RTL-SDR] Gain: ${agc ? 'AGC' : currentGain + ' dB'}`);
          if (rtlTcpClient) {
            if (agc) {
              sendRTLCommand(RTL_TCP_CMD.SET_GAIN_MODE, 0); // AGC
            } else {
              sendRTLCommand(RTL_TCP_CMD.SET_GAIN_MODE, 1); // Manual
              sendRTLCommand(RTL_TCP_CMD.SET_GAIN, currentGain * 10);
            }
          }
          break;

        case 'SET_MODE':
          sampleMode = msg.mode;
          console.log(`[RTL-SDR] Modo: ${sampleMode}`);
          if (rtlTcpClient) {
            if (sampleMode === 'direct_q') {
              sendRTLCommand(RTL_TCP_CMD.SET_DIRECT_SAMPLING, 2); // Q branch
            } else {
              sendRTLCommand(RTL_TCP_CMD.SET_DIRECT_SAMPLING, 0); // Normal IQ
            }
          }
          break;

        case 'SET_SAMPLE_RATE':
          sampleRate = msg.rate;
          console.log(`[RTL-SDR] Sample Rate: ${sampleRate / 1e6} MHz`);
          if (rtlTcpClient) {
            sendRTLCommand(RTL_TCP_CMD.SET_SAMPLE_RATE, sampleRate);
          }
          break;

        default:
          // Ignora comandos desconhecidos
      }
    } catch (err) {
      console.error('[WS] Erro ao processar mensagem:', err);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Cliente desconectado');
  });

  ws.on('error', (err) => {
    console.error('[WS] Erro:', err);
  });
});

// Cleanup ao fechar
process.on('SIGINT', () => {
  console.log('\n[Backend] Encerrando...');
  
  if (rtlTcpClient) {
    rtlTcpClient.destroy();
  }
  
  if (rtlTcpProcess) {
    rtlTcpProcess.kill();
  }
  
  process.exit(0);
});

process.on('exit', () => {
  if (rtlTcpProcess) {
    rtlTcpProcess.kill();
  }
});

console.log('[Backend] Pronto para aceitar conexões');