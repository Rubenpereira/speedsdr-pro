#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#pragma comment(lib, "ws2_32.lib")

int main(int argc, char *argv[]) {
    printf("[SpeedSDR Pro] ========================================\n");
    printf("[SpeedSDR Pro] BACKEND SERVIDOR v1.0 x86\n");
    printf("[SpeedSDR Pro] ========================================\n");
    printf("[INFO] Compilacao: %s %s\n", __DATE__, __TIME__);
    printf("[INFO] Inicializando Winsock...\n");

    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        fprintf(stderr, "[ERRO] Falha ao inicializar Winsock\n");
        return 1;
    }
    printf("[OK] Winsock v%d.%d carregado\n", HIBYTE(wsaData.wVersion), LOBYTE(wsaData.wVersion));

    printf("[INFO] Criando socket de servidor...\n");
    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket == INVALID_SOCKET) {
        fprintf(stderr, "[ERRO] Falha ao criar socket (erro: %%d)\n", WSAGetLastError());
        WSACleanup();
        return 1;
    }
    printf("[OK] Socket criado\n");

    printf("[INFO] Configurando endereco do servidor...\n");
    struct sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(8080);
    serverAddr.sin_addr.s_addr = inet_addr("0.0.0.0");

    if (bind(serverSocket, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        fprintf(stderr, "[ERRO] Falha ao fazer bind (porta 8080 pode estar em uso)\n");
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }
    printf("[OK] Socket vinculado a 0.0.0.0:8080\n");

    if (listen(serverSocket, SOMAXCONN) == SOCKET_ERROR) {
        fprintf(stderr, "[ERRO] Falha ao colocar em escuta\n");
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    printf("[OK] Servidor escutando na porta 8080\n");
    printf("[INFO] Pressione CTRL+C para encerrar\n");
    printf("[SpeedSDR Pro] ========================================\n\n");

    while (1) {
        struct sockaddr_in clientAddr;
        int clientAddrLen = sizeof(clientAddr);

        printf("[AGUARDANDO] Conexoes na porta 8080...\n");
        SOCKET clientSocket = accept(serverSocket, (struct sockaddr*)&clientAddr, &clientAddrLen);

        if (clientSocket == INVALID_SOCKET) {
            printf("[INFO] Servidor encerrado\n");
            break;
        }

        char clientIP[16];
        strcpy_s(clientIP, sizeof(clientIP), inet_ntoa(clientAddr.sin_addr));
        int clientPort = ntohs(clientAddr.sin_port);

        printf("[CLIENTE] Conectado: %s:%d\n", clientIP, clientPort);

        const char *response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ok\",\"app\":\"SpeedSDR Pro\"}\r\n";
        send(clientSocket, response, strlen(response), 0);

        printf("[CLIENTE] Resposta enviada\n");
        closesocket(clientSocket);
    }

    closesocket(serverSocket);
    WSACleanup();
    printf("[SpeedSDR Pro] Servidor encerrado\n");

    return 0;
}
