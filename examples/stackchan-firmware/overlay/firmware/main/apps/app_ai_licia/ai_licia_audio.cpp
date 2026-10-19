/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#include "ai_licia_audio.h"

#include <algorithm>
#include <board.h>
#include <audio/audio_codec.h>
#include <hal/board/config.h>
#include <mbedtls/base64.h>
#include <mooncake_log.h>

namespace {
constexpr size_t kMaxQueuedSamples = AUDIO_OUTPUT_SAMPLE_RATE * 10;
constexpr TickType_t kIdleDelay = pdMS_TO_TICKS(5);
const std::string_view kTag = "AI-Licia-Audio";
}

AiLiciaAudioOutput::~AiLiciaAudioOutput()
{
    stop();
}

void AiLiciaAudioOutput::start()
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (_running) return;
    _running = true;
    if (xTaskCreatePinnedToCore(taskEntry, "ai_licia_audio", 6144, this, 4, &_task, 0) != pdPASS) {
        _running = false;
        _task = nullptr;
        mclog::tagError(kTag, "failed to start audio task");
    }
}

void AiLiciaAudioOutput::stop()
{
    {
        std::lock_guard<std::mutex> lock(_mutex);
        if (!_running) return;
        _running = false;
        _playing = false;
        _chunks.clear();
        _queued_samples = 0;
    }
    for (int attempt = 0; attempt < 100 && _task; ++attempt) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    auto codec = Board::GetInstance().GetAudioCodec();
    if (codec && codec->output_enabled()) codec->EnableOutput(false);
}

void AiLiciaAudioOutput::prepare(std::string utteranceId, std::string audioItemId, uint32_t sampleRateHz)
{
    std::lock_guard<std::mutex> lock(_mutex);
    _utterance_id = std::move(utteranceId);
    _audio_item_id = std::move(audioItemId);
    _source_rate_hz = sampleRateHz;
    _next_chunk_index = 0;
    _next_sample_offset = 0;
    _next_source_position = 0.0;
    _chunks.clear();
    _queued_samples = 0;
    _playing = false;
}

bool AiLiciaAudioOutput::pushPcmBase64(const std::string& audioItemId, uint32_t chunkIndex,
                                       uint64_t sampleOffset, const char* encoded, size_t encodedLength)
{
    if (!encoded || encodedLength == 0 || encodedLength > 131072) return false;

    size_t decodedLength = 0;
    const auto* encodedBytes = reinterpret_cast<const unsigned char*>(encoded);
    int result = mbedtls_base64_decode(nullptr, 0, &decodedLength, encodedBytes, encodedLength);
    if (result != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL || decodedLength == 0 || decodedLength % 2 != 0) {
        return false;
    }
    std::vector<int16_t> samples(decodedLength / sizeof(int16_t));
    auto* decodedBytes = reinterpret_cast<unsigned char*>(samples.data());
    result = mbedtls_base64_decode(decodedBytes, decodedLength, &decodedLength, encodedBytes, encodedLength);
    if (result != 0 || decodedLength % 2 != 0) return false;

    std::lock_guard<std::mutex> lock(_mutex);
    if (audioItemId != _audio_item_id || chunkIndex != _next_chunk_index ||
        sampleOffset != _next_sample_offset || _source_rate_hz == 0) {
        return false;
    }

    const size_t sourceSamples = decodedLength / sizeof(int16_t);
    auto output = resample(samples.data(), sourceSamples, sampleOffset);
    _next_chunk_index += 1;
    _next_sample_offset += sourceSamples;

    if (_queued_samples + output.size() > kMaxQueuedSamples) {
        mclog::tagWarn(kTag, "audio buffer exceeded ten seconds; dropping utterance");
        _chunks.clear();
        _queued_samples = 0;
        _playing = false;
        return false;
    }
    _queued_samples += output.size();
    _chunks.push_back(std::move(output));
    return true;
}

void AiLiciaAudioOutput::setPlaying(const std::string& utteranceId, bool playing)
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (utteranceId == _utterance_id) _playing = playing;
}

void AiLiciaAudioOutput::end(const std::string& utteranceId)
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (utteranceId != _utterance_id) return;
    _playing = false;
    _chunks.clear();
    _queued_samples = 0;
    _utterance_id.clear();
    _audio_item_id.clear();
}

std::vector<int16_t> AiLiciaAudioOutput::resample(const int16_t* input, size_t sampleCount,
                                                  uint64_t sampleOffset)
{
    std::vector<int16_t> output;
    if (!input || sampleCount == 0) return output;
    if (_source_rate_hz == AUDIO_OUTPUT_SAMPLE_RATE) {
        output.assign(input, input + sampleCount);
        _next_source_position = static_cast<double>(sampleOffset + sampleCount);
        return output;
    }

    const double step = static_cast<double>(_source_rate_hz) / AUDIO_OUTPUT_SAMPLE_RATE;
    const double end = static_cast<double>(sampleOffset + sampleCount);
    if (_next_source_position < sampleOffset) _next_source_position = sampleOffset;
    output.reserve(static_cast<size_t>(sampleCount / step) + 2);
    while (_next_source_position < end) {
        const auto absoluteIndex = static_cast<uint64_t>(_next_source_position);
        const auto localIndex = static_cast<size_t>(absoluteIndex - sampleOffset);
        if (localIndex >= sampleCount) break;
        output.push_back(input[localIndex]);
        _next_source_position += step;
    }
    return output;
}

void AiLiciaAudioOutput::taskEntry(void* context)
{
    static_cast<AiLiciaAudioOutput*>(context)->taskLoop();
}

void AiLiciaAudioOutput::taskLoop()
{
    auto codec = Board::GetInstance().GetAudioCodec();
    while (true) {
        std::vector<int16_t> chunk;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            if (!_running) break;
            if (_playing && !_chunks.empty()) {
                chunk = std::move(_chunks.front());
                _chunks.pop_front();
                _queued_samples -= chunk.size();
            }
        }
        if (chunk.empty()) {
            vTaskDelay(kIdleDelay);
            continue;
        }
        if (!codec) continue;
        if (!codec->output_enabled()) codec->EnableOutput(true);
        codec->OutputData(chunk);
    }
    if (codec && codec->output_enabled()) codec->EnableOutput(false);
    _task = nullptr;
    vTaskDelete(nullptr);
}

