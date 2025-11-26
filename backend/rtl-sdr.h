#ifndef __RTL_SDR_H
#define __RTL_SDR_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

typedef struct rtlsdr_dev rtlsdr_dev_t;

// Funções principais do RTL-SDR
int rtlsdr_get_device_count(void);
const char* rtlsdr_get_device_name(uint32_t index);
int rtlsdr_open(rtlsdr_dev_t **dev, uint32_t index);
int rtlsdr_close(rtlsdr_dev_t *dev);

// Configuração de frequência
int rtlsdr_set_center_freq(rtlsdr_dev_t *dev, uint32_t freq);
uint32_t rtlsdr_get_center_freq(rtlsdr_dev_t *dev);

// Configuração de sample rate
int rtlsdr_set_sample_rate(rtlsdr_dev_t *dev, uint32_t rate);
uint32_t rtlsdr_get_sample_rate(rtlsdr_dev_t *dev);

// Configuração de ganho
int rtlsdr_set_tuner_gain_mode(rtlsdr_dev_t *dev, int manual);
int rtlsdr_set_tuner_gain(rtlsdr_dev_t *dev, int gain);
int rtlsdr_get_tuner_gain(rtlsdr_dev_t *dev);

// Buffer e leitura
int rtlsdr_reset_buffer(rtlsdr_dev_t *dev);
int rtlsdr_read_sync(rtlsdr_dev_t *dev, void *buf, int len, int *n_read);

// Leitura assíncrona
typedef void(*rtlsdr_read_async_cb_t)(unsigned char *buf, uint32_t len, void *ctx);
int rtlsdr_read_async(rtlsdr_dev_t *dev, rtlsdr_read_async_cb_t cb, void *ctx, uint32_t buf_num, uint32_t buf_len);
int rtlsdr_cancel_async(rtlsdr_dev_t *dev);

#ifdef __cplusplus
}
#endif

#endif