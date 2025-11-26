#pragma once
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <windows.h>
#include <iostream>
#include <vector>
#include <string>

// Definições de tipos para as funções da DLL
typedef struct rtlsdr_dev rtlsdr_dev_t;

typedef int(*p_rtlsdr_get_device_count)();
typedef const char* (*p_rtlsdr_get_device_name)(uint32_t index);
typedef int(*p_rtlsdr_open)(rtlsdr_dev_t** dev, uint32_t index);
typedef int(*p_rtlsdr_close)(rtlsdr_dev_t* dev);
typedef int(*p_rtlsdr_set_center_freq)(rtlsdr_dev_t* dev, uint32_t freq);
typedef int(*p_rtlsdr_set_sample_rate)(rtlsdr_dev_t* dev, uint32_t rate);
typedef int(*p_rtlsdr_set_tuner_gain_mode)(rtlsdr_dev_t* dev, int manual);
typedef int(*p_rtlsdr_set_tuner_gain)(rtlsdr_dev_t* dev, int gain);
typedef int(*p_rtlsdr_reset_buffer)(rtlsdr_dev_t* dev);
typedef int(*p_rtlsdr_read_sync)(rtlsdr_dev_t* dev, void* buf, int len, int* n_read);
typedef int(*p_rtlsdr_set_agc_mode)(rtlsdr_dev_t* dev, int on);

class RtlSdrParams {
public:
    HMODULE hLib;
    rtlsdr_dev_t* dev = nullptr;

    p_rtlsdr_get_device_count get_device_count;
    p_rtlsdr_get_device_name get_device_name;
    p_rtlsdr_open open;
    p_rtlsdr_close close;
    p_rtlsdr_set_center_freq set_center_freq;
    p_rtlsdr_set_sample_rate set_sample_rate;
    p_rtlsdr_set_tuner_gain_mode set_tuner_gain_mode;
    p_rtlsdr_set_tuner_gain set_tuner_gain;
    p_rtlsdr_reset_buffer reset_buffer;
    p_rtlsdr_read_sync read_sync;
    p_rtlsdr_set_agc_mode set_agc_mode;

    bool loadDLL() {
        // Tenta carregar a DLL
        hLib = LoadLibraryA("rtlsdr.dll");
        
        if (!hLib) {
            DWORD err = GetLastError();
            std::cerr << "\n[ERRO] Falha ao carregar rtlsdr.dll.\n";
            std::cerr << "Codigo de Erro do Windows: " << err << "\n";
            
            if (err == 126) {
                std::cerr << "--> O sistema nao encontrou o arquivo 'rtlsdr.dll' ou uma dependencia dele (libusb-1.0.dll).\n";
                std::cerr << "--> Verifique se rtlsdr.dll E libusb-1.0.dll estao na mesma pasta do executavel.\n";
            } else if (err == 193) {
                std::cerr << "--> INCOMPATIBILIDADE DETECTADA (Erro 193).\n";
                std::cerr << "--> Voce compilou o programa em 64-BITS (x64), mas suas DLLs sao de 32-BITS (x86).\n";
                std::cerr << "--> SOLUCAO: Substitua suas DLLs por versoes 64-bits OU use o 'x86 Native Tools Command Prompt' para compilar.\n";
            }
            return false;
        }

        // Carrega as funções
        get_device_count = (p_rtlsdr_get_device_count)GetProcAddress(hLib, "rtlsdr_get_device_count");
        get_device_name = (p_rtlsdr_get_device_name)GetProcAddress(hLib, "rtlsdr_get_device_name");
        open = (p_rtlsdr_open)GetProcAddress(hLib, "rtlsdr_open");
        close = (p_rtlsdr_close)GetProcAddress(hLib, "rtlsdr_close");
        set_center_freq = (p_rtlsdr_set_center_freq)GetProcAddress(hLib, "rtlsdr_set_center_freq");
        set_sample_rate = (p_rtlsdr_set_sample_rate)GetProcAddress(hLib, "rtlsdr_set_sample_rate");
        set_tuner_gain_mode = (p_rtlsdr_set_tuner_gain_mode)GetProcAddress(hLib, "rtlsdr_set_tuner_gain_mode");
        set_tuner_gain = (p_rtlsdr_set_tuner_gain)GetProcAddress(hLib, "rtlsdr_set_tuner_gain");
        reset_buffer = (p_rtlsdr_reset_buffer)GetProcAddress(hLib, "rtlsdr_reset_buffer");
        read_sync = (p_rtlsdr_read_sync)GetProcAddress(hLib, "rtlsdr_read_sync");
        set_agc_mode = (p_rtlsdr_set_agc_mode)GetProcAddress(hLib, "rtlsdr_set_agc_mode");

        if (!open || !read_sync || !set_center_freq) {
             std::cerr << "[ERRO] DLL carregada, mas algumas funcoes nao foram encontradas. Versao antiga da DLL?\n";
             return false;
        }
        
        return true;
    }

    void cleanup() {
        if (dev && close) close(dev);
        if (hLib) FreeLibrary(hLib);
    }
};