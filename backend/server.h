#pragma once

// Força o Winsock2 a ser o principal e evita conflito
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h> // Incluir DEPOIS do winsock2
#include <vector>
#include <string>
#include <thread>
#include <mutex>
#include <functional>

#pragma comment (lib, "Ws2_32.lib")

class WebSocketServer {
public:
    WebSocketServer(int port);
    ~WebSocketServer();
    void start();
    void broadcast(const std::vector<uint8_t>& data);
    void setOnMessage(std::function<void(std::string)> callback);

private:
    int port;
    SOCKET serverSocket;
    std::vector<SOCKET> clients;
    std::mutex clientMutex;
    std::function<void(std::string)> onMessageCallback;
    bool running;

    void acceptLoop();
    void handleClient(SOCKET clientSocket);
    bool handshake(SOCKET clientSocket);
    std::string base64_encode(const unsigned char* input, int length);
    void sendFrame(SOCKET client, const std::vector<uint8_t>& data, bool isBinary);
};