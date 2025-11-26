#include "audio_processor.h"
#include <iostream>
#include math>
#include <algorithm>

AudioProcessor::AudioProcessor()
    : agc_gain(1.0f),
      agc_reference(0.9f),
      agc_attack(0.01f),
      agc_decay(0.001f),
      agc_target(0.9f) {}

AudioProcessor::~AudioProcessor() {}

void AudioProcessor::processAudio(std::vector<float>& audio) {
    if (audio.empty()) return;
    
    // Encontrar RMS (Root Mean Square)
    float sum_sq = 0.0f;
    for (float sample : audio) {
        sum_sq += sample * sample;
    }
    float rms = std::sqrt(sum_sq / audio.size());
    
    // Evitar divisão por zero
    if (rms < 0.0001f) rms = 0.0001f;
    
    // Calcular ganho necessário
    float target_gain = agc_target / rms;
    
    // Limitar ganho (evitar feedback)
    target_gain = std::min(target_gain, 50.0f);  // Máximo 50x
    target_gain = std::max(target_gain, 0.1f);   // Mínimo 0.1x
    
    // AGC com suavização
    if (target_gain > agc_gain) {
        // Attack: resposta rápida a sinais fracos
        agc_gain += (target_gain - agc_gain) * agc_attack;
    } else {
        // Decay: resposta lenta a sinais fortes
        agc_gain += (target_gain - agc_gain) * agc_decay;
    }
    
    // Aplicar ganho AGC
    for (auto& sample : audio) {
        sample *= agc_gain;
        
        // Hard clipping para evitar distorção
        if (sample > 1.0f) sample = 1.0f;
        else if (sample < -1.0f) sample = -1.0f;
    }
}

std::vector<int16_t> AudioProcessor::floatToPCM16(const std::vector<float>& audio) {
    std::vector<int16_t> pcm;
    pcm.reserve(audio.size());
    
    for (float sample : audio) {
        // Garantir intervalo [-1.0, 1.0]
        float clipped = std::max(-1.0f, std::min(1.0f, sample));
        
        // Converter para int16_t [-32768, 32767]
        int32_t pcm_val = static_cast<int32_t>(clipped * 32767.0f);
        pcm.push_back(static_cast<int16_t>(pcm_val));
    }
    
    return pcm;
}

void AudioProcessor::reset() {
    agc_gain = 1.0f;
}
