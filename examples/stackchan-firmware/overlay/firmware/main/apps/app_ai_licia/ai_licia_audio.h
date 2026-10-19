/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <cstddef>
#include <cstdint>
#include <deque>
#include <mutex>
#include <string>
#include <vector>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

class AiLiciaAudioOutput {
public:
    ~AiLiciaAudioOutput();

    void start();
    void stop();
    void prepare(std::string utteranceId, std::string audioItemId, uint32_t sampleRateHz);
    bool pushPcmBase64(const std::string& audioItemId, uint32_t chunkIndex, uint64_t sampleOffset,
                       const char* encoded, size_t encodedLength);
    void setPlaying(const std::string& utteranceId, bool playing);
    void end(const std::string& utteranceId);

private:
    static void taskEntry(void* context);
    void taskLoop();
    std::vector<int16_t> resample(const int16_t* input, size_t sampleCount, uint64_t sampleOffset);

    std::mutex _mutex;
    std::deque<std::vector<int16_t>> _chunks;
    std::string _utterance_id;
    std::string _audio_item_id;
    uint32_t _source_rate_hz = 0;
    uint32_t _next_chunk_index = 0;
    uint64_t _next_sample_offset = 0;
    double _next_source_position = 0.0;
    size_t _queued_samples = 0;
    bool _playing = false;
    bool _running = false;
    TaskHandle_t _task = nullptr;
};

