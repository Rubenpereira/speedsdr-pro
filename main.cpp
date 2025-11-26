#include <iostream>
#include <thread>
#include <atomic>
#include <vector>
#include string>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <string>
#include <rtl-sdr.h>
#include <queue>
#include <mutex>
#include dition_variable>
#include "demodulator.h"
#include "audio_processor.h"

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "rtlsdr.lib")

#define PORT 8080
#define BUFFER_SIZE 8192
#define SAMPLE_RATE 2048000

std::atomic<bool> running(true);
std::atomic<uint32_t> center_freq(145350000);
std::atomic<int> rf_gain(40);
std::atomic<int> demod_mode(1);  // 1=WFM por padrão
std::atomic<int> quad_mode(0);   // 0=Quadrature

rtlsdr_dev_t* dev = nullptr;
Demodulator* demodulator = nullptr;
AudioProcessor* audio_processor = nullptr;

// Thread-safe queue para IQ data
std::queue<std::vector<uint8_t>> iq_queue;
std::mutex iq_queue_mutex;
std::condition_variable iq_queue_cv;

SOCKET global_client = INVALID_SOCKET;
std::mutex client_mutex;

void rtl_callback(unsigned char* buf, uint32_t len, void* ctx) {
    // Enfileirar dados IQ sem processar aqui (evita overhead)
    {
        std::lock_guard<std::mutex> lock(iq_queue_mutex);
        std::vector<uint8_t> data(buf, buf + len);
        iq_queue.push(data);
    }
    iq_queue_cv.notify_one();
}

void audio_processing_thread() {
    std::cout << "[Audio Thread] Iniciada\n";
    
    while (running) {
        std::vector<uint8_t> iq_data;
        
        // Esperar por dados IQ
        {
            std::unique_lock<std::mutex> lock(iq_queue_mutex);
            if (iq_queue.empty()) {
                iq_queue_cv.wait_for(lock, std::chrono::milliseconds(100));
            }
            
            if (iq_queue.empty()) continue;
            
            iq_data = iq_queue.front();
            iq_queue.pop();
        }
        
        if (iq_data.empty() || !demodulator || !audio_processor) continue;
        
        // Demodular
        auto audio = demodulator->processIQ(iq_data.data(), iq_data.size());
        if (audio.empty()) continue;
        
        // Aplicar AGC
        audio_processor->processAudio(audio);
        
        // Converter para PCM 16-bit
        auto pcm = audio_processor->floatToPCM16(audio);
        if (pcm.empty()) continue;
        
        // Enviar para cliente
        {
            std::lock_guard<std::mutex> lock(client_mutex);
            if (global_client == INVALID_SOCKET) continue;
            
            // WebSocket binary frame
            size_t data_len = pcm.size() * sizeof(int16_t);
            unsigned char ws_header[10];
            ws_header[0] = 0x82;  // FIN + Binary
            
            if (data_len < 126) {
                ws_header[1] = static_cast<unsigned char>(data_len);
                send(global_client, (char*)ws_header, 2, 0);
            } else if (data_len < 65536) {
                ws_header[1] = 126;
                ws_header[2] = (data_len >> 8) & 0xFF;
                ws_header[3] = data_len & 0xFF;
                send(global_client, (char*)ws_header, 4, 0);
            } else {
                continue;
            }
            
            send(global_client, (char*)pcm.data(), data_len, 0);
        }
    }
    
    std::cout << "[Audio Thread] Finalizada\n";
}

void rtl_reader_thread() {
    std::cout << "[RTL-SDR Thread] Iniciada\n";
    
    while (running) {
        if (rtlsdr_read_async(dev, rtl_callback, nullptr, 0, BUFFER_SIZE) != 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }
    
    std::cout << "[RTL-SDR Thread] Finalizada\n";
}

std::string get_websocket_key(const std::string& request) {
    size_t pos = request.find("Sec-WebSocket-Key: ");
    if (pos == std::string::npos) return "";
    size_t end = request.find("\r\n", pos);
    return request.substr(pos + 19, end - pos - 19);
}

std::string generate_accept_key(const std::string& key) {
    return key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
}

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
        
        {
            std::lock_guard<std::mutex> lock(client_mutex);
            global_client = client;
        }
        
        // Processar comandos do cliente
        while (running) {
            char msg[512];
            int len = recv(client, msg, sizeof(msg), 0);
            
            if (len <= 0) break;
            
            if (len > 6 && (msg[0] & 0x81) == 0x81) {
                int payload_len = msg[1] & 0x7F;
                int mask_offset = 2;
                
                if (payload_len == 126) {
                    payload_len = (msg[2] << 8) | msg[3];
                    mask_offset = 4;
                }
                
                if (mask_offset + 4 > len) continue;
                
                unsigned char mask[4];
                memcpy(mask, &msg[mask_offset], 4);
                
                std::string payload;
                for (int i = 0; i < payload_len && (mask_offset + 4 + i) < len; i++) {
                    payload += msg[mask_offset + 4 + i] ^ mask[i % 4];
                }
                
                // SET_FREQ
                if (payload.find("\"type\":\"SET_FREQ\"") != std::string::npos) {
                    size_t pos = payload.find("\"freq\":");
                    if (pos != std::string::npos) {
                        uint32_t freq = std::stoul(payload.substr(pos + 7));
                        center_freq = freq;
                        rtlsdr_set_center_freq(dev, freq);
                        std::cout << "[RTL] Freq: " << freq << " Hz\n";
                    }
                }
                // SET_GAIN
                else if (payload.find("\"type\":\"SET_GAIN\"") != std::string::npos) {
                    size_t pos = payload.find("\"gain\":");
                    if (pos != std::string::npos) {
                        int gain = std::stoi(payload.substr(pos + 6));
                        rf_gain = gain;
                        rtlsdr_set_tuner_gain(dev, gain * 10);
                        std::cout << "[RTL] Gain: " << gain << " dB\n";
                    }
                }
                // SET_MODE
                else if (payload.find("\"type\":\"SET_MODE\"") != std::string::npos) {
                    size_t pos = payload.find("\"mode\":");
                    if (pos != std::string::npos) {
                        int mode = std::stoi(payload.substr(pos + 6));
                        demod_mode = mode;
                        
                        if (demodulator) {
                            switch (mode) {
                                case 0: demodulator->setMode(DemodMode::NFM); break;
                                case 1: demodulator->setMode(DemodMode::WFM); break;
                                case 2: demodulator->setMode(DemodMode::AM); break;
                                case 3: demodulator->setMode(DemodMode::USB); break;
                                case 4: demodulator->setMode(DemodMode::LSB); break;
                                case 5: demodulator->setMode(DemodMode::CW); break;
                            }
                        }
                        std::cout << "[Demod] Mode: " << mode << "\n";
                    }
                }
                // SET_QUAD_MODE
                else if (payload.find("\"type\":\"SET_QUAD_MODE\"") != std::string::npos) {
                    size_t pos = payload.find("\"quad_mode\":");
                    if (pos != std::string::npos) {
                        int qmode = std::stoi(payload.substr(pos + 11));
                        quad_mode = qmode;
                        
                        if (demodulator) {
                            demodulator->setQuadMode(
                                qmode == 0 ? QuadMode::QUADRATURE : QuadMode::Q_DIRECT
                            );
                        }
                        std::cout << "[Demod] Quad: " << (qmode == 0 ? "Quad" : "Direct") << "\n";
                    }
                }
            }
        }
        
        {
            std::lock_guard<std::mutex> lock(client_mutex);
            if (global_client == client) {
                global_client = INVALID_SOCKET;
            }
        }
    }
    
    closesocket(client);
}

int main() {
    std::cout << "\n=== SpeedSDR Pro Backend v3.0 ===\n";
    std::cout << "Processamento otimizado com AGC\n";
    std::cout << "Demodulacao: NFM,
