#include "server.h"
#include <iostream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <wincrypt.h>

// CORREÇÃO AQUI: Adicionar Advapi32.lib para funções de hash (SHA1)
#pragma comment(lib, "Crypt32.lib")
#pragma comment(lib, "Advapi32.lib")

WebSocketServer::WebSocketServer(int p) : port(p), serverSocket(INVALID_SOCKET), running(false) {
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
}

WebSocketServer::~WebSocketServer() {
    running = false;
    closesocket(serverSocket);
    WSACleanup();
}

void WebSocketServer::setOnMessage(std::function<void(std::string)> callback) {
    onMessageCallback = callback;
}

void WebSocketServer::start() {
    struct addrinfo* result = NULL;
    struct addrinfo hints;

    ZeroMemory(&hints, sizeof(hints));
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;
    hints.ai_flags = AI_PASSIVE;

    std::string portStr = std::to_string(port);
    getaddrinfo(NULL, portStr.c_str(), &hints, &result);

    serverSocket = socket(result->ai_family, result->ai_socktype, result->ai_protocol);
    bind(serverSocket, result->ai_addr, (int)result->ai_addrlen);
    freeaddrinfo(result);

    listen(serverSocket, SOMAXCONN);
    running = true;

    std::cout << "Servidor WebSocket iniciado na porta " << port << std::endl;
    std::thread(&WebSocketServer::acceptLoop, this).detach();
}

void WebSocketServer::acceptLoop() {
    while (running) {
        SOCKET clientSocket = accept(serverSocket, NULL, NULL);
        if (clientSocket != INVALID_SOCKET) {
            std::thread(&WebSocketServer::handleClient, this, clientSocket).detach();
        }
    }
}

std::string WebSocketServer::base64_encode(const unsigned char* input, int length) {
    static const char* kBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string output;
    int val = 0, valb = -6;
    for (int i = 0; i < length; ++i) {
        val = (val << 8) + input[i];
        valb += 8;
        while (valb >= 0) {
            output.push_back(kBase64[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) output.push_back(kBase64[((val << 8) >> (valb + 8)) & 0x3F]);
    while (output.size() % 4) output.push_back('=');
    return output;
}

bool WebSocketServer::handshake(SOCKET clientSocket) {
    char buffer[4096];
    int bytesReceived = recv(clientSocket, buffer, 4096, 0);
    if (bytesReceived <= 0) return false;

    std::string request(buffer, bytesReceived);
    std::string keyHeader = "Sec-WebSocket-Key: ";
    size_t keyStart = request.find(keyHeader);
    
    if (keyStart == std::string::npos) return false;

    keyStart += keyHeader.length();
    size_t keyEnd = request.find("\r\n", keyStart);
    std::string clientKey = request.substr(keyStart, keyEnd - keyStart);

    std::string magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    std::string combined = clientKey + magic;

    HCRYPTPROV hProv = 0;
    HCRYPTHASH hHash = 0;
    DWORD hashLen = 20;
    BYTE hash[20];
    
    // Estas funções precisam de Advapi32.lib
    if(CryptAcquireContext(&hProv, NULL, NULL, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) {
        CryptCreateHash(hProv, CALG_SHA1, 0, 0, &hHash);
        CryptHashData(hHash, (BYTE*)combined.c_str(), combined.length(), 0);
        CryptGetHashParam(hHash, HP_HASHVAL, hash, &hashLen, 0);
        CryptDestroyHash(hHash);
        CryptReleaseContext(hProv, 0);
    }

    std::string acceptKey = base64_encode(hash, 20);

    std::string response = 
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";

    send(clientSocket, response.c_str(), response.length(), 0);
    return true;
}

void WebSocketServer::handleClient(SOCKET clientSocket) {
    if (!handshake(clientSocket)) {
        closesocket(clientSocket);
        return;
    }

    {
        std::lock_guard<std::mutex> lock(clientMutex);
        clients.push_back(clientSocket);
        std::cout << "Cliente conectado!" << std::endl;
    }

    char buffer[4096];
    while (running) {
        int bytesReceived = recv(clientSocket, buffer, 4096, 0);
        if (bytesReceived <= 0) break;
        
        uint8_t opcode = buffer[0] & 0x0F;
        if (opcode == 8) break; 

        uint8_t lenByte = buffer[1] & 0x7F;
        int payloadStart = 2;
        if (lenByte == 126) payloadStart = 4;
        
        uint8_t mask[4];
        memcpy(mask, buffer + payloadStart, 4);
        payloadStart += 4;

        std::string message;
        for (int i = 0; i < lenByte && (payloadStart + i) < bytesReceived; i++) {
            message += (char)(buffer[payloadStart + i] ^ mask[i % 4]);
        }

        if (onMessageCallback && !message.empty()) {
            onMessageCallback(message);
        }
    }

    {
        std::lock_guard<std::mutex> lock(clientMutex);
        clients.erase(std::remove(clients.begin(), clients.end(), clientSocket), clients.end());
    }
    closesocket(clientSocket);
    std::cout << "Cliente desconectado." << std::endl;
}

void WebSocketServer::broadcast(const std::vector<uint8_t>& data) {
    std::lock_guard<std::mutex> lock(clientMutex);
    for (SOCKET client : clients) {
        sendFrame(client, data, true);
    }
}

void WebSocketServer::sendFrame(SOCKET client, const std::vector<uint8_t>& data, bool isBinary) {
    std::vector<uint8_t> frame;
    frame.push_back(isBinary ? 0x82 : 0x81);

    if (data.size() <= 125) {
        frame.push_back((uint8_t)data.size());
    } else if (data.size() <= 65535) {
        frame.push_back(126);
        frame.push_back((data.size() >> 8) & 0xFF);
        frame.push_back(data.size() & 0xFF);
    } else {
        return; 
    }

    frame.insert(frame.end(), data.begin(), data.end());
    send(client, (char*)frame.data(), frame.size(), 0);
}