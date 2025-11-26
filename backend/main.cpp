#include <iostream>
#include <thread>
#include <atomic>
#include <vector>
#include <cstring>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <string>
#include <rtl-sdr.h>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "rtlsdr.lib")

#define PORT 8080
#define BUFFER_SIZE 16384
#define SAMPLE_RATE 2048000

std::atomic<bool> running(true);
std::atomic<uint32_t> center_freq(145350000);
std::atomic<int> rf_gain(40);
rtlsdr_dev_t* dev = nullptr;

// Função de callback do RTL-SDR
void rtl_callback(unsigned char* buf, uint32_t len, void* ctx) {
    SOCKET client = *(SOCKET*)ctx;
    
    // Envia dados IQ via WebSocket (formato binário)
    unsigned char ws_header[10];
    ws_header[0] = 0x82; // FIN + Binary frame
    
    if (len < 126) {
        ws_header[1] = len;
        send(client, (char*)ws_header, 2, 0);
        send(client, (char*)buf, len, 0);
    } else if (len < 65536) {
        ws_header[1] = 126;
        ws_header[2] = (len >> 8) & 0xFF;
        ws_header[3] = len & 0xFF;
        send(client, (char*)ws_header, 4, 0);
        send(client, (char*)buf, len, 0);
    }
}

// Thread de leitura do RTL-SDR
void rtl_reader_thread(SOCKET client) {
    std::cout << "[RTL-SDR] Thread iniciada\n";
    
    while (running && rtlsdr_read_async(dev, rtl_callback, &client, 0, BUFFER_SIZE) == 0) {
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    
    std::cout << "[RTL-SDR] Thread encerrada\n";
}

// Parser WebSocket handshake
std::string get_websocket_key(const std::string& request) {
    size_t pos = request.find("Sec-WebSocket-Key: ");
    if (pos == std::string::npos) return "";
    
    size_t end = request.find("\r\n", pos);
    return request.substr(pos + 19, end - pos - 19);
}

// Gerador de accept key (simplificado - use biblioteca crypto em produção)
std::string generate_accept_key(const std::string& key) {
    return key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // Simplificado
}

// Handle client connection
void handle_client(SOCKET client) {
    char buffer[4096];
    int bytes = recv(client, buffer, sizeof(buffer), 0);
    
    if (bytes <= 0) {
        closesocket(client);
        return;
    }
    
    std::string request(buffer, bytes);
    
    // WebSocket handshake
    if (request.find("Upgrade: websocket") != std::string::npos) {
        std::string key = get_websocket_key(request);
        std::string accept = generate_accept_key(key);
        
        std::string response = 
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
        
        send(client, response.c_str(), response.length(), 0);
        std::cout << "[WebSocket] Cliente conectado\n";
        
        // Inicia thread de leitura do RTL-SDR
        std::thread rtl_thread(rtl_reader_thread, client);
        
        // Recebe comandos do cliente
        while (running) {
            char msg[512];
            int len = recv(client, msg, sizeof(msg), 0);
            
            if (len <= 0) break;
            
            // Parse WebSocket frame (simplificado)
            if (len > 6 && (msg[0] & 0x81) == 0x81) {
                int payload_len = msg[1] & 0x7F;
                int mask_offset = 2;
                
                if (payload_len == 126) {
                    payload_len = (msg[2] << 8) | msg[3];
                    mask_offset = 4;
                }
                
                unsigned char mask[4];
                memcpy(mask, &msg[mask_offset], 4);
                
                std::string payload;
                for (int i = 0; i < payload_len; i++) {
                    payload += msg[mask_offset + 4 + i] ^ mask[i % 4];
                }
                
                // Parse JSON command
                if (payload.find("\"type\":\"SET_FREQ\"") != std::string::npos) {
                    size_t pos = payload.find("\"freq\":");
                    if (pos != std::string::npos) {
                        uint32_t freq = std::stoul(payload.substr(pos + 7));
                        center_freq = freq;
                        rtlsdr_set_center_freq(dev, freq);
                        std::cout << "[RTL-SDR] Frequência: " << freq << " Hz\n";
                    }
                } else if (payload.find("\"type\":\"SET_GAIN\"") != std::string::npos) {
                    size_t pos = payload.find("\"gain\":");
                    if (pos != std::string::npos) {
                        int gain = std::stoi(payload.substr(pos + 6));
                        rf_gain = gain;
                        rtlsdr_set_tuner_gain(dev, gain * 10);
                        std::cout << "[RTL-SDR] Ganho: " << gain << " dB\n";
                    }
                }
            }
        }
        
        rtl_thread.join();
    }
    
    closesocket(client);
}

int main() {
    std::cout << "=== SpeedSDR Pro Backend v1.0 ===\n";
    std::cout << "Desenvolvido por PU1XTB\n\n";
    
    // Inicializa Winsock
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        std::cerr << "[Erro] Falha ao inicializar Winsock\n";
        return 1;
    }
    
    // Abre RTL-SDR
    int device_count = rtlsdr_get_device_count();
    if (device_count == 0) {
        std::cerr << "[Erro] Nenhum RTL-SDR detectado!\n";
        WSACleanup();
        return 1;
    }
    
    std::cout << "[RTL-SDR] Dispositivos encontrados: " << device_count << "\n";
    std::cout << "[RTL-SDR] Abrindo dispositivo 0...\n";
    
    if (rtlsdr_open(&dev, 0) < 0) {
        std::cerr << "[Erro] Falha ao abrir RTL-SDR\n";
        WSACleanup();
        return 1;
    }
    
    // Configura RTL-SDR
    rtlsdr_set_sample_rate(dev, SAMPLE_RATE);
    rtlsdr_set_center_freq(dev, center_freq);
    rtlsdr_set_tuner_gain_mode(dev, 1);
    rtlsdr_set_tuner_gain(dev, rf_gain * 10);
    rtlsdr_reset_buffer(dev);
    
    std::cout << "[RTL-SDR] Configurado:\n";
    std::cout << "  - Sample Rate: " << SAMPLE_RATE << " Hz\n";
    std::cout << "  - Frequência: " << center_freq << " Hz\n";
    std::cout << "  - Ganho: " << rf_gain << " dB\n\n";
    
    // Cria servidor WebSocket
    SOCKET server = socket(AF_INET, SOCK_STREAM, 0);
    if (server == INVALID_SOCKET) {
        std::cerr << "[Erro] Falha ao criar socket\n";
        rtlsdr_close(dev);
        WSACleanup();
        return 1;
    }
    
    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(PORT);
    
    if (bind(server, (sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        std::cerr << "[Erro] Falha no bind (porta " << PORT << " ocupada?)\n";
        closesocket(server);
        rtlsdr_close(dev);
        WSACleanup();
        return 1;
    }
    
    listen(server, 1);
    std::cout << "[WebSocket] Servidor rodando na porta " << PORT << "\n";
    std::cout << "[WebSocket] Aguardando conexão do frontend...\n\n";
    
    // Aceita conexões
    while (running) {
        SOCKET client = accept(server, nullptr, nullptr);
        if (client != INVALID_SOCKET) {
            std::thread(handle_client, client).detach();
        }
    }
    
    // Cleanup
    closesocket(server);
    rtlsdr_close(dev);
    WSACleanup();
    
    std::cout << "\n[Backend] Encerrado\n";
    return 0;
}
