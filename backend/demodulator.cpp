#include "demodulator.h"
#include <iostream>

// ============ SimpleFilter Implementation ============

SimpleFilter::SimpleFilter(float cutoff_ratio)
    : alpha(cutoff_ratio), prev_output(0.0f) {}

SimpleFilter::~SimpleFilter() {}

float SimpleFilter::process(float sample) {
    // Filtro passa-baixa 1ª ordem
    prev_output = alpha * sample + (1.0f - alpha) * prev_output;
    return prev_output;
}

void SimpleFilter::reset() {
    prev_output = 0.0f;
}

// ============ LinearResampler Implementation ============

LinearResampler::LinearResampler(int in_rate, int out_rate)
    : input_rate(in_rate), output_rate(out_rate), phase(0.0f) {}

LinearResampler::~LinearResampler() {}

std::vector<float> LinearResampler::resample(const std::vector<float>& input) {
    std::vector<float> output;
    if (input.empty()) return output;
    
    for (float sample : input) {
        buffer.push_back(sample);
    }
    
    float ratio = static_cast<float>(input_rate) / static_cast<float>(output_rate);
    
    while (phase < static_cast<float>(buffer.size() - 1)) {
        size_t idx = static_cast<size_t>(phase);
        float frac = phase - idx;
        
        // Interpolação linear suave
        float s0 = buffer[idx];
        float s1 = buffer[idx + 1];
        float sample = s0 * (1.0f - frac) + s1 * frac;
        
        output.push_back(sample);
        phase += ratio;
    }
    
    if (phase >= buffer.size() - 1) {
        phase -= (buffer.size() - 1);
        buffer.clear();
    }
    
    return output;
}

void LinearResampler::reset() {
    phase = 0.0f;
    buffer.clear();
}

// ============ Demodulator Implementation ============

Demodulator::Demodulator()
    : currentMode(DemodMode::WFM),
      currentQuadMode(QuadMode::QUADRATURE),
      prev_sample(0, 0),
      prev_audio(0.0f) {
    
    // Resampler: 2048000 -> 48000
    resampler = new LinearResampler(2048000, 48000);
    
    // Filtro antes (anti-aliasing, cutoff ~25kHz)
    pre_filter = new SimpleFilter(25000.0f / 2048000.0f);
    
    // Filtro depois (audio, cutoff ~8kHz)
    post_filter = new SimpleFilter(8000.0f / 48000.0f);
    
    // De-emphasis para WFM (75µs)
    // tau = 75e-6, frequency = 1 / (2*pi*tau) ≈ 2122 Hz
    deemph_filter = new SimpleFilter(2122.0f / 48000.0f);
}

Demodulator::~Demodulator() {
    delete resampler;
    delete pre_filter;
    delete post_filter;
    delete deemph_filter;
}

void Demodulator::setMode(DemodMode mode) {
    if (currentMode != mode) {
        currentMode = mode;
        reset();
        
        std::cout << "[Demod] Modo: ";
        switch (mode) {
            case DemodMode::NFM: std::cout << "NFM (15kHz)\n"; break;
            case DemodMode::WFM: std::cout << "WFM (100kHz)\n"; break;
            case DemodMode::AM: std::cout << "AM (10kHz)\n"; break;
            case DemodMode::USB: std::cout << "USB (3kHz)\n"; break;
            case DemodMode::LSB: std::cout << "LSB (3kHz)\n"; break;
            case DemodMode::CW: std::cout << "CW (500Hz)\n"; break;
        }
    }
}

void Demodulator::setQuadMode(QuadMode mode) {
    if (currentQuadMode != mode) {
        currentQuadMode = mode;
        reset();
    }
}

void Demodulator::reset() {
    prev_sample = std::complex<float>(0, 0);
    prev_audio = 0.0f;
    if (pre_filter) pre_filter->reset();
    if (post_filter) post_filter->reset();
    if (deemph_filter) deemph_filter->reset();
}

std::vector<std::complex<float>> Demodulator::convertIQData(const uint8_t* data, int len) {
    std::vector<std::complex<float>> iq;
    
    for (int i = 0; i < len - 1; i += 2) {
        float i_val = (static_cast<float>(data[i]) - 127.5f) / 127.5f;
        float q_val = (static_cast<float>(data[i+1]) - 127.5f) / 127.5f;
        iq.push_back(std::complex<float>(i_val, q_val));
    }
    
    return iq;
}

float Demodulator::fmDiscriminator(std::complex<float> sample) {
    float mag = std::abs(sample);
    if (mag < 0.001f) return 0.0f;
    
    sample /= mag;  // Normalizar
    
    // Discriminador de fase
    std::complex<float> product = sample * std::conj(prev_sample);
    float phase = std::atan2(product.imag(), product.real());
    
    prev_sample = sample;
    
    return phase;
}

std::vector<float> Demodulator::demodNFM(const std::vector<std::complex<float>>& iq) {
    std::vector<float> demod_data;
    demod_data.reserve(iq.size());
    
    for (const auto& sample : iq) {
        float demod_val = fmDiscriminator(sample) / M_PI;
        
        // Suavização
        demod_val = prev_audio * 0.7f + demod_val * 0.3f;
        prev_audio = demod_val;
        
        // Pré-filtro anti-aliasing
        float filtered = pre_filter->process(demod_val);
        demod_data.push_back(filtered);
    }
    
    // Resampling
    auto resampled = resampler->resample(demod_data);
    
    // Pós-filtro
    for (auto& sample : resampled) {
        sample = post_filter->process(sample);
    }
    
    return resampled;
}

std::vector<float> Demodulator::demodWFM(const std::vector<std::complex<float>>& iq) {
    std::vector<float> demod_data;
    demod_data.reserve(iq.size());
    
    for (const auto& sample : iq) {
        float demod_val = fmDiscriminator(sample) / M_PI;
        
        // Suavização menor para WFM (para manter mais detalhes)
        demod_val = prev_audio * 0.5f + demod_val * 0.5f;
        prev_audio = demod_val;
        
        // Pré-filtro anti-aliasing (mais permissivo para WFM)
        float filtered = pre_filter->process(demod_val);
        demod_data.push_back(filtered);
    }
    
    // Resampling
    auto resampled = resampler->resample(demod_data);
    
    // De-emphasis 75µs (Brasil/Internacional)
    for (auto& sample : resampled) {
        sample = deemph_filter->process(sample);
        sample = post_filter->process(sample);
    }
    
    return resampled;
}

std::vector<float> Demodulator::demodAM(const std::vector<std::complex<float>>& iq) {
    std::vector<float> demod_data;
    demod_data.reserve(iq.size());
    
    for (const auto& sample : iq) {
        // AM: magnitude do sinal
        float magnitude = std::abs(sample);
        
        // Remover DC
        demod_data.push_back(magnitude - 0.5f);
    }
    
    auto resampled = resampler->resample(demod_data);
    
    for (auto& sample : resampled) {
        sample = post_filter->process(sample);
    }
    
    return resampled;
}

std::vector<float> Demodulator::demodUSB(const std::vector<std::complex<float>>& iq) {
    std::vector<float> demod_data;
    
    for (const auto& sample : iq) {
        // USB: I + Q
        float demod = (sample.real() + sample.imag()) * 0.5f;
        demod_data.push_back(demod);
    }
    
    auto resampled = resampler->resample(demod_data);
    
    for (auto& sample : resampled) {
        sample = post_filter->process(sample);
    }
    
    return resampled;
}

std::vector<float> Demodulator::demodLSB(const std::vector<std::complex<float>>& iq) {
    std::vector<float> demod_data;
    
    for (const auto& sample : iq) {
        // LSB: I - Q
        float demod = (sample.real() - sample.imag()) * 0.5f;
        demod_data.push_back(demod);
    }
    
    auto resampled = resampler->resample(demod_data);
    
    for (auto& sample : resampled) {
        sample = post_filter->process(sample);
    }
    
    return resampled;
}

std::vector<float> Demodulator::demodCW(const std::vector<std::complex<float>>& iq) {
    std::vector<float> demod_data;
    
    for (const auto& sample : iq) {
        // CW: detecção de envolvente
        float magnitude = std::abs(sample);
        demod_data.push_back(magnitude);
    }
    
    auto resampled = resampler->resample(demod_data);
    
    for (auto& sample : resampled) {
        sample = post_filter->process(sample);
    }
    
    return resampled;
}

std::vector<float> Demodulator::processIQ(const uint8_t* iqData, int len) {
    auto iq = convertIQData(iqData, len);
    
    std::vector<float> audio;
    
    switch (currentMode) {
        case DemodMode::NFM:
            audio = demodNFM(iq);
            break;
        case DemodMode::WFM:
            audio = demodWFM(iq);
            break;
        case DemodMode::AM:
            audio = demodAM(iq);
            break;
        case DemodMode::USB:
            audio = demodUSB(iq);
            break;
        case DemodMode::LSB:
            audio = demodLSB(iq);
            break;
        case Demo
