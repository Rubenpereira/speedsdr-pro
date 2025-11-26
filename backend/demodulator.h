#pragma once
#include mplex>
#include <vector>
#include math>
#include string>
#include <algorithm>
#include stdint>
#include <deque>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

enum class DemodMode {
    NFM = 0,
    WFM = 1,
    AM = 2,
    USB = 3,
    LSB = 4,
    CW = 5
};

enum class QuadMode {
    QUADRATURE = 0,
    Q_DIRECT = 1
};

// Filtro simples 1ª ordem para anti-aliasing
class SimpleFilter {
public:
    SimpleFilter(float cutoff_ratio);
    ~SimpleFilter();
    float process(float sample);
    void reset();
    
private:
    float alpha;
    float prev_output;
};

// Resampler com interpolação linear
class LinearResampler {
public:
    LinearResampler(int input_rate, int output_rate);
    ~LinearResampler();
    std::vector<float> resample(const std::vector<float>& input);
    void reset();
    
private:
    int input_rate;
    int output_rate;
    float phase;
    std::deque<float> buffer;
};

class Demodulator {
public:
    Demodulator();
    ~Demodulator();
    
    void setMode(DemodMode mode);
    void setQuadMode(QuadMode mode);
    
    std::vector<float> processIQ(const uint8_t* iqData, int len);
    void reset();
    
private:
    DemodMode currentMode;
    QuadMode currentQuadMode;
    
    LinearResampler* resampler;
    SimpleFilter* pre_filter;      // Antes do resampling
    SimpleFilter* post_filter;     // Depois do resampling
    SimpleFilter* deemph_filter;   // De-emphasis para WFM
    
    std::complex<float> prev_sample;
    float prev_audio;
    
    std::vector<std::complex<float>> convertIQData(const uint8_t* data, int len);
    float fmDiscriminator(std::complex<float> sample);
    
    std::vector<float> demodNFM(const std::vector<std::complex<float>>& iq);
    std::vector<float> demodWFM(const std::vector<std::complex<float>>& iq);
    std::vector<float> demodAM(const std::vector<std::complex<float>>& iq);
    std::vector<float> demodUSB(const std::vector<std::complex<float>>& iq);
    std::vector<float> demodLSB(const std::vector<std::complex<float>>& iq);
    std::vector<float> demodCW(const std::vector<std::complex<float>>& iq);
};
