#pragma once
#include <vector>
#include stdint>

class AudioProcessor {
public:
    AudioProcessor();
    ~AudioProcessor();
    
    // Processar áudio com AGC
    void processAudio(std::vector<float>& audio);
    
    // Converter float para PCM 16-bit
    std::vector<int16_t> floatToPCM16(const std::vector<float>& audio);
    
    // Resetar estado
    void reset();
    
private:
    float agc_gain;
    float agc_reference;
    float agc_attack;
    float agc_decay;
    float agc_target;
};
